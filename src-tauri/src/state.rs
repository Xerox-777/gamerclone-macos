use std::sync::Arc;

use parking_lot::Mutex;
use serde::{Deserialize, Serialize};

use crate::audio::{AudioPlayer, AudioRecorder};
use crate::capture::CaptureManager;
use crate::hotkeys::HotkeyManager;
use crate::pipeline::VoicePipeline;
use crate::rag::RagDatabase;
use crate::services::local::LocalCoachingService;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AppStatus {
    Initializing,
    Ready,
    Listening,
    Processing,
    Error(String),
}

pub struct AppState {
    pub status: Mutex<AppStatus>,
    pub capture_manager: CaptureManager,
    pub audio_recorder: AudioRecorder,
    pub audio_player: AudioPlayer,
    pub hotkey_manager: HotkeyManager,
    pub voice_pipeline: VoicePipeline,
    pub active_game_id: Mutex<String>,
}

impl AppState {
    pub fn new() -> Result<Self, String> {
        let buffer_capacity: usize = std::env::var("CAPTURE_MAX_FRAMES")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(30);

        let capture_interval_ms: u64 = std::env::var("CAPTURE_INTERVAL_MS")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(2000);

        let jpeg_quality: i32 = std::env::var("CAPTURE_QUALITY")
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(75);

        // Initialize RAG database
        let rag_db = Arc::new(
            RagDatabase::new("./data/rag.db")
                .map_err(|e| format!("Failed to init RAG database: {e}"))?,
        );

        // Seed knowledge base on first launch
        if !rag_db.is_seeded() {
            tracing::info!("Seeding knowledge base...");
            let seed_files: &[&[u8]] = &[
                include_bytes!("rag/seed_data/minecraft.json"),
                include_bytes!("rag/seed_data/valorant.json"),
                include_bytes!("rag/seed_data/cs2.json"),
                include_bytes!("rag/seed_data/fortnite.json"),
                include_bytes!("rag/seed_data/league.json"),
                include_bytes!("rag/seed_data/elden_ring.json"),
                include_bytes!("rag/seed_data/rocket_league.json"),
                include_bytes!("rag/seed_data/generic.json"),
            ];

            let mut total = 0;
            for seed_json in seed_files {
                match rag_db.seed_from_json(seed_json) {
                    Ok(count) => total += count,
                    Err(e) => tracing::error!("Failed to seed: {e}"),
                }
            }
            tracing::info!("Knowledge base seeded with {total} entries");
        } else {
            tracing::info!("Knowledge base already seeded");
        }

        let service = Arc::new(LocalCoachingService::new(rag_db).map_err(|e| e.to_string())?);
        let voice_pipeline = VoicePipeline::new(service);

        Ok(Self {
            status: Mutex::new(AppStatus::Ready),
            capture_manager: CaptureManager::new(
                buffer_capacity,
                capture_interval_ms,
                jpeg_quality,
            ),
            audio_recorder: AudioRecorder::new(),
            audio_player: AudioPlayer::new(),
            hotkey_manager: HotkeyManager::new(),
            voice_pipeline,
            active_game_id: Mutex::new("generic".to_string()),
        })
    }
}
