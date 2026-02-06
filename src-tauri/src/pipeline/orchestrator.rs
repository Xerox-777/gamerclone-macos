use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use serde::Serialize;
use tauri::{AppHandle, Emitter};

use crate::audio::{AudioCue, AudioPlayer, AudioRecorder};
use crate::capture::CaptureManager;
use crate::services::types::Screenshot;
use crate::services::CoachingService;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineStageEvent {
    pub stage: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineCompleteEvent {
    pub transcript: String,
    pub response: String,
    pub latency_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PipelineErrorEvent {
    pub stage: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VoiceQueryResult {
    pub transcript: String,
    pub response: String,
    pub latency_ms: u64,
}

/// RAII guard that resets the processing flag on drop.
#[derive(Debug)]
struct ProcessingGuard<'a> {
    flag: &'a AtomicBool,
}

impl<'a> ProcessingGuard<'a> {
    fn acquire(flag: &'a AtomicBool) -> Result<Self, String> {
        if flag
            .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
            .is_err()
        {
            return Err("Query already in progress".to_string());
        }
        Ok(Self { flag })
    }
}

impl Drop for ProcessingGuard<'_> {
    fn drop(&mut self) {
        self.flag.store(false, Ordering::SeqCst);
    }
}

pub struct VoicePipeline {
    service: Arc<dyn CoachingService>,
    is_processing: AtomicBool,
}

impl VoicePipeline {
    pub fn new(service: Arc<dyn CoachingService>) -> Self {
        Self {
            service,
            is_processing: AtomicBool::new(false),
        }
    }

    fn emit_stage(app: &AppHandle, stage: &str, message: &str) {
        let _ = app.emit(
            "pipeline:stage",
            PipelineStageEvent {
                stage: stage.to_string(),
                message: message.to_string(),
            },
        );
    }

    fn emit_error(app: &AppHandle, stage: &str, message: &str) {
        let _ = app.emit(
            "pipeline:error",
            PipelineErrorEvent {
                stage: stage.to_string(),
                message: message.to_string(),
            },
        );
    }

    pub async fn process_query(
        &self,
        app: &AppHandle,
        audio_recorder: &AudioRecorder,
        capture_manager: &CaptureManager,
        audio_player: &AudioPlayer,
        game_id: &str,
    ) -> Result<VoiceQueryResult, String> {
        let start = Instant::now();

        // Acquire processing guard (prevents concurrent queries)
        let _guard = ProcessingGuard::acquire(&self.is_processing)?;

        // 1. Stop recording and get WAV bytes
        let wav_bytes = audio_recorder.stop_recording().inspect_err(|e| {
            Self::emit_error(app, "recording", e);
            audio_player.play_cue(AudioCue::Error);
        })?;

        tracing::info!("Recording stopped, {} bytes of WAV data", wav_bytes.len());

        // 2. Transcribe audio
        Self::emit_stage(app, "transcribing", "Converting speech to text...");

        let transcript = self.service.transcribe(wav_bytes).await.map_err(|e| {
            let msg = format!("Transcription failed: {e}");
            Self::emit_error(app, "transcribing", &msg);
            audio_player.play_cue(AudioCue::Error);
            msg
        })?;

        if transcript.is_empty() {
            let msg = "No speech detected in recording".to_string();
            Self::emit_error(app, "transcribing", &msg);
            audio_player.play_cue(AudioCue::Error);
            return Err(msg);
        }

        // 3. Look up game profile
        let profile = crate::profiles::get_profile_or_default(game_id);
        tracing::info!("Using profile: {} ({})", profile.name, profile.id);

        // 4. Get screenshots from capture buffer
        let frames = capture_manager.get_recent_frames(profile.screenshot_count);
        let now = Instant::now();
        let screenshots: Vec<Screenshot> = frames
            .into_iter()
            .map(|f| Screenshot {
                jpeg_bytes: f.jpeg_bytes,
                timestamp_ms: now.duration_since(f.timestamp).as_millis() as u64,
            })
            .collect();

        let screenshot_count = screenshots.len();
        tracing::info!("Collected {screenshot_count} screenshots for vision analysis");

        // 5. RAG search for relevant knowledge
        Self::emit_stage(app, "searching", "Searching knowledge base...");

        let rag_context = self
            .service
            .rag_search(&transcript, game_id, 3)
            .await
            .unwrap_or_else(|e| {
                tracing::warn!("RAG search failed: {e}");
                vec![]
            });

        tracing::info!("RAG returned {} chunks", rag_context.len());

        // 6. Analyze gameplay with Vision + RAG context
        Self::emit_stage(app, "analyzing", "Analyzing gameplay...");

        let response = self
            .service
            .analyze_gameplay(&transcript, screenshots, &profile, rag_context)
            .await
            .map_err(|e| {
                let msg = format!("Vision analysis failed: {e}");
                Self::emit_error(app, "analyzing", &msg);
                audio_player.play_cue(AudioCue::Error);
                msg
            })?;

        // 7. Text to speech
        Self::emit_stage(app, "speaking", "Generating speech...");

        let tts_voice = std::env::var("TTS_VOICE").unwrap_or_else(|_| "nova".to_string());

        match self.service.text_to_speech(&response, &tts_voice).await {
            Ok(mp3_bytes) => {
                tracing::info!("TTS generated {} bytes, playing...", mp3_bytes.len());
                if let Err(e) = audio_player.play_bytes(mp3_bytes) {
                    tracing::warn!("Audio playback failed: {e} — response text still available");
                    // Don't fail the entire query — the text response is still useful
                }
            }
            Err(e) => {
                tracing::warn!("TTS failed: {e} — falling back to text-only response");
                // Graceful degradation: don't fail, just skip audio
            }
        }

        // 8. Emit completion
        let latency_ms = start.elapsed().as_millis() as u64;

        let _ = app.emit(
            "pipeline:complete",
            PipelineCompleteEvent {
                transcript: transcript.clone(),
                response: response.clone(),
                latency_ms,
            },
        );

        tracing::info!(
            "Pipeline complete in {latency_ms}ms: \"{}\" -> \"{}\"",
            transcript,
            response
        );

        Ok(VoiceQueryResult {
            transcript,
            response,
            latency_ms,
        })
    }

    pub fn is_processing(&self) -> bool {
        self.is_processing.load(Ordering::Relaxed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::services::mock::MockCoachingService;

    #[test]
    fn test_processing_guard_acquire_release() {
        let flag = AtomicBool::new(false);
        {
            let guard = ProcessingGuard::acquire(&flag);
            assert!(guard.is_ok());
            assert!(flag.load(Ordering::SeqCst));
        }
        // Guard dropped — flag should be reset
        assert!(!flag.load(Ordering::SeqCst));
    }

    #[test]
    fn test_processing_guard_double_acquire_fails() {
        let flag = AtomicBool::new(false);
        let _guard = ProcessingGuard::acquire(&flag).unwrap();
        let second = ProcessingGuard::acquire(&flag);
        assert!(second.is_err());
        assert_eq!(second.unwrap_err(), "Query already in progress".to_string());
    }

    #[test]
    fn test_processing_guard_reacquire_after_drop() {
        let flag = AtomicBool::new(false);
        {
            let _guard = ProcessingGuard::acquire(&flag).unwrap();
        }
        // Should succeed after drop
        let guard = ProcessingGuard::acquire(&flag);
        assert!(guard.is_ok());
    }

    #[test]
    fn test_voice_pipeline_default_not_processing() {
        let service = Arc::new(MockCoachingService::default());
        let pipeline = VoicePipeline::new(service);
        assert!(!pipeline.is_processing());
    }
}
