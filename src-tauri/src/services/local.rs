use anyhow::{Context, Result};
use async_openai::{
    config::OpenAIConfig,
    types::{
        AudioInput, AudioResponseFormat, ChatCompletionRequestMessage,
        ChatCompletionRequestMessageContentPartImage, ChatCompletionRequestSystemMessageArgs,
        ChatCompletionRequestUserMessageArgs, ChatCompletionRequestUserMessageContent,
        ChatCompletionRequestUserMessageContentPart, CreateChatCompletionRequestArgs,
        CreateSpeechRequestArgs, CreateTranscriptionRequestArgs, ImageDetail, ImageUrl,
        SpeechModel, SpeechResponseFormat, Voice,
    },
    Client,
};
use async_trait::async_trait;
use base64::Engine;
use std::sync::Arc;

use super::types::{GameProfile, KnowledgeChunk, Screenshot};
use super::CoachingService;
use crate::rag::RagDatabase;

pub struct LocalCoachingService {
    client: Client<OpenAIConfig>,
    tts_voice: String,
    vision_model: String,
    rag_db: Arc<RagDatabase>,
}

impl LocalCoachingService {
    pub fn new(rag_db: Arc<RagDatabase>) -> Result<Self> {
        let api_key = std::env::var("OPENAI_API_KEY").map_err(|_| {
            anyhow::anyhow!(
                "OPENAI_API_KEY not found. Create a .env file with OPENAI_API_KEY=sk-..."
            )
        })?;

        let config = OpenAIConfig::new().with_api_key(api_key);
        let client = Client::with_config(config);

        let tts_voice = std::env::var("TTS_VOICE").unwrap_or_else(|_| "nova".to_string());
        let vision_model = std::env::var("VISION_MODEL").unwrap_or_else(|_| "gpt-4o".to_string());

        tracing::info!(
            "LocalCoachingService initialized (model={vision_model}, voice={tts_voice})"
        );

        Ok(Self {
            client,
            tts_voice,
            vision_model,
            rag_db,
        })
    }

    fn build_system_prompt(profile: &GameProfile, rag_context: &[KnowledgeChunk]) -> String {
        let mut rag_section = String::new();

        if !rag_context.is_empty() {
            rag_section.push_str("RELEVANT KNOWLEDGE:\n");
            for (i, chunk) in rag_context.iter().enumerate() {
                rag_section.push_str(&format!(
                    "{}. [{}] {}: {}\n",
                    i + 1,
                    chunk.category,
                    chunk.title,
                    chunk.content
                ));
            }
            rag_section.push_str("\nUse the above knowledge to give specific, accurate advice.");
        }

        profile
            .system_prompt_template
            .replace("{rag_context}", &rag_section)
    }

    fn parse_voice(voice_str: &str) -> Voice {
        match voice_str.to_lowercase().as_str() {
            "alloy" => Voice::Alloy,
            "echo" => Voice::Echo,
            "fable" => Voice::Fable,
            "onyx" => Voice::Onyx,
            "nova" => Voice::Nova,
            "shimmer" => Voice::Shimmer,
            _ => Voice::Nova,
        }
    }
}

#[async_trait]
impl CoachingService for LocalCoachingService {
    async fn transcribe(&self, wav_bytes: Vec<u8>) -> Result<String> {
        tracing::debug!("Transcribing {} bytes of audio", wav_bytes.len());

        let audio_input = AudioInput::from_vec_u8("recording.wav".to_string(), wav_bytes);

        let request = CreateTranscriptionRequestArgs::default()
            .file(audio_input)
            .model("whisper-1")
            .response_format(AudioResponseFormat::Text)
            .build()
            .context("Failed to build transcription request")?;

        let response = self
            .client
            .audio()
            .transcribe(request)
            .await
            .context("Whisper API call failed")?;

        let text = response.text.trim().to_string();
        tracing::info!("Transcribed: \"{text}\"");
        Ok(text)
    }

    async fn rag_search(
        &self,
        query: &str,
        game_id: &str,
        limit: usize,
    ) -> Result<Vec<KnowledgeChunk>> {
        let db = Arc::clone(&self.rag_db);
        let query = query.to_string();
        let game_id = game_id.to_string();
        tokio::task::spawn_blocking(move || db.search(&query, &game_id, limit))
            .await
            .context("RAG search task panicked")?
    }

    async fn analyze_gameplay(
        &self,
        transcript: &str,
        screenshots: Vec<Screenshot>,
        profile: &GameProfile,
        rag_context: Vec<KnowledgeChunk>,
    ) -> Result<String> {
        tracing::debug!(
            "Analyzing gameplay [{}]: \"{}\" with {} screenshots, {} RAG chunks",
            profile.id,
            transcript,
            screenshots.len(),
            rag_context.len()
        );

        let system_prompt = Self::build_system_prompt(profile, &rag_context);

        // Build user message parts: text first, then images
        let mut content_parts: Vec<ChatCompletionRequestUserMessageContentPart> = Vec::new();

        // Text part
        content_parts.push(ChatCompletionRequestUserMessageContentPart::Text(
            transcript.to_string().into(),
        ));

        // Image parts — encode each screenshot as base64 data URI
        let b64_engine = base64::engine::general_purpose::STANDARD;
        for screenshot in &screenshots {
            let b64 = b64_engine.encode(&screenshot.jpeg_bytes);
            let data_uri = format!("data:image/jpeg;base64,{b64}");

            content_parts.push(ChatCompletionRequestUserMessageContentPart::ImageUrl(
                ChatCompletionRequestMessageContentPartImage {
                    image_url: ImageUrl {
                        url: data_uri,
                        detail: Some(ImageDetail::Low),
                    },
                },
            ));
        }

        let messages: Vec<ChatCompletionRequestMessage> = vec![
            ChatCompletionRequestSystemMessageArgs::default()
                .content(system_prompt)
                .build()?
                .into(),
            ChatCompletionRequestUserMessageArgs::default()
                .content(ChatCompletionRequestUserMessageContent::Array(
                    content_parts,
                ))
                .build()?
                .into(),
        ];

        let request = CreateChatCompletionRequestArgs::default()
            .model(&self.vision_model)
            .messages(messages)
            .max_tokens(profile.max_response_tokens)
            .temperature(0.7)
            .build()
            .context("Failed to build chat completion request")?;

        let response = self
            .client
            .chat()
            .create(request)
            .await
            .context("GPT-4o Vision API call failed")?;

        let text = response
            .choices
            .first()
            .and_then(|c| c.message.content.as_deref())
            .unwrap_or("I couldn't generate a response. Try asking again.")
            .trim()
            .to_string();

        tracing::info!("Vision response: \"{text}\"");
        Ok(text)
    }

    async fn text_to_speech(&self, text: &str, voice: &str) -> Result<Vec<u8>> {
        tracing::debug!("TTS: \"{}\" (voice={voice})", text);

        let voice_enum = Self::parse_voice(if voice.is_empty() {
            &self.tts_voice
        } else {
            voice
        });

        let request = CreateSpeechRequestArgs::default()
            .model(SpeechModel::Tts1)
            .voice(voice_enum)
            .input(text)
            .response_format(SpeechResponseFormat::Mp3)
            .build()
            .context("Failed to build TTS request")?;

        let response = self
            .client
            .audio()
            .speech(request)
            .await
            .context("TTS API call failed")?;

        let bytes = response.bytes.to_vec();
        tracing::info!("TTS generated {} bytes of audio", bytes.len());
        Ok(bytes)
    }

    async fn get_game_profiles(&self) -> Result<Vec<GameProfile>> {
        Ok(crate::profiles::all_profiles())
    }

    async fn get_system_prompt(&self, game_id: &str) -> Result<String> {
        let profile = crate::profiles::get_profile_or_default(game_id);
        Ok(Self::build_system_prompt(&profile, &[]))
    }
}
