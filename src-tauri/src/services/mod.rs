pub mod local;
#[cfg(test)]
pub mod mock;
pub mod types;

use anyhow::Result;
use async_trait::async_trait;
use types::{GameProfile, KnowledgeChunk, Screenshot};

/// Core abstraction for all AI service calls.
///
/// POC: `LocalCoachingService` implements this with direct async-openai calls.
/// MVP: `RemoteCoachingService` will implement this with HTTPS calls to api.gamerclone.com.
#[async_trait]
pub trait CoachingService: Send + Sync {
    /// Transcribe audio (WAV bytes) to text via Whisper STT.
    async fn transcribe(&self, wav_bytes: Vec<u8>) -> Result<String>;

    /// Search the RAG knowledge base for relevant chunks.
    async fn rag_search(
        &self,
        query: &str,
        game_id: &str,
        limit: usize,
    ) -> Result<Vec<KnowledgeChunk>>;

    /// Analyze gameplay with GPT-4o Vision using transcript, screenshots, and RAG context.
    async fn analyze_gameplay(
        &self,
        transcript: &str,
        screenshots: Vec<Screenshot>,
        profile: &GameProfile,
        rag_context: Vec<KnowledgeChunk>,
    ) -> Result<String>;

    /// Convert text to speech audio bytes (MP3).
    async fn text_to_speech(&self, text: &str, voice: &str) -> Result<Vec<u8>>;

    /// Get available game profiles.
    async fn get_game_profiles(&self) -> Result<Vec<GameProfile>>;

    /// Get the system prompt for a specific game.
    async fn get_system_prompt(&self, game_id: &str) -> Result<String>;
}
