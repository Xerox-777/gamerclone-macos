use anyhow::Result;
use async_trait::async_trait;

use super::types::{GameProfile, KnowledgeChunk, Screenshot};
use super::CoachingService;

/// Mock implementation of CoachingService for testing.
/// Returns configurable canned responses without making any API calls.
pub struct MockCoachingService {
    pub transcript_response: String,
    pub analysis_response: String,
    pub tts_bytes: Vec<u8>,
    pub rag_chunks: Vec<KnowledgeChunk>,
}

impl Default for MockCoachingService {
    fn default() -> Self {
        Self {
            transcript_response: "Test transcript".to_string(),
            analysis_response: "Test coaching response".to_string(),
            tts_bytes: vec![0xFF, 0xFB, 0x90, 0x00], // Fake MP3 header bytes
            rag_chunks: vec![KnowledgeChunk {
                id: "1".to_string(),
                game_id: "generic".to_string(),
                category: "basics".to_string(),
                title: "Test Tip".to_string(),
                content: "This is a test knowledge chunk.".to_string(),
                relevance_score: 0.9,
            }],
        }
    }
}

#[async_trait]
impl CoachingService for MockCoachingService {
    async fn transcribe(&self, _wav_bytes: Vec<u8>) -> Result<String> {
        Ok(self.transcript_response.clone())
    }

    async fn rag_search(
        &self,
        _query: &str,
        _game_id: &str,
        limit: usize,
    ) -> Result<Vec<KnowledgeChunk>> {
        Ok(self.rag_chunks.iter().take(limit).cloned().collect())
    }

    async fn analyze_gameplay(
        &self,
        _transcript: &str,
        _screenshots: Vec<Screenshot>,
        _profile: &GameProfile,
        _rag_context: Vec<KnowledgeChunk>,
    ) -> Result<String> {
        Ok(self.analysis_response.clone())
    }

    async fn text_to_speech(&self, _text: &str, _voice: &str) -> Result<Vec<u8>> {
        Ok(self.tts_bytes.clone())
    }

    async fn get_game_profiles(&self) -> Result<Vec<GameProfile>> {
        Ok(crate::profiles::all_profiles())
    }

    async fn get_system_prompt(&self, game_id: &str) -> Result<String> {
        let profile = crate::profiles::get_profile_or_default(game_id);
        Ok(profile.system_prompt_template)
    }
}
