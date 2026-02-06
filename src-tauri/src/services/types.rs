use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Screenshot {
    /// JPEG-encoded image bytes
    pub jpeg_bytes: Vec<u8>,
    /// Timestamp when the screenshot was captured
    pub timestamp_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct KnowledgeChunk {
    pub id: String,
    pub game_id: String,
    pub category: String,
    pub title: String,
    pub content: String,
    pub relevance_score: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameProfile {
    pub id: String,
    pub name: String,
    pub genre: String,
    pub description: String,
    pub system_prompt_template: String,
    pub screenshot_count: usize,
    pub max_response_tokens: u16,
}

#[derive(Debug, thiserror::Error)]
pub enum ServiceError {
    #[error("API error: {0}")]
    Api(String),
    #[error("Transcription failed: {0}")]
    Transcription(String),
    #[error("TTS failed: {0}")]
    TextToSpeech(String),
    #[error("RAG search failed: {0}")]
    RagSearch(String),
    #[error("Configuration error: {0}")]
    Config(String),
}
