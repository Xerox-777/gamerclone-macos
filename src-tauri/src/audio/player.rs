use std::io::Cursor;

use parking_lot::Mutex;

use rodio::{Decoder, OutputStream, OutputStreamHandle, Sink};

use super::devices::find_output_device_by_name;

#[derive(Debug, Clone, Copy)]
pub enum AudioCue {
    PttOn,
    PttOff,
    Error,
}

struct OutputState {
    _stream: OutputStream,
    handle: OutputStreamHandle,
}

// SAFETY: OutputStream is Send but not Sync. We protect access with Mutex.
unsafe impl Send for OutputState {}
unsafe impl Sync for OutputState {}

pub struct AudioPlayer {
    output: Mutex<Option<OutputState>>,
}

impl Default for AudioPlayer {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioPlayer {
    pub fn new() -> Self {
        Self {
            output: Mutex::new(None),
        }
    }

    pub fn init_stream(&self, device_name: &str) -> Result<(), String> {
        // Drop existing output
        *self.output.lock() = None;

        let device = find_output_device_by_name(device_name)
            .ok_or_else(|| "No output device found".to_string())?;

        let (_stream, handle) = OutputStream::try_from_device(&device)
            .map_err(|e| format!("Failed to open output stream: {e}"))?;

        *self.output.lock() = Some(OutputState { _stream, handle });

        let device_display = if device_name.is_empty() {
            "default"
        } else {
            device_name
        };
        tracing::info!("Audio output initialized: {device_display}");

        Ok(())
    }

    pub fn play_bytes(&self, bytes: Vec<u8>) -> Result<(), String> {
        let guard = self.output.lock();
        let output = guard
            .as_ref()
            .ok_or_else(|| "Audio output not initialized".to_string())?;

        let cursor = Cursor::new(bytes);
        let source = Decoder::new(cursor).map_err(|e| format!("Failed to decode audio: {e}"))?;

        let sink = Sink::try_new(&output.handle)
            .map_err(|e| format!("Failed to create audio sink: {e}"))?;

        sink.append(source);
        sink.detach(); // Play in background

        Ok(())
    }

    pub fn play_cue(&self, cue: AudioCue) {
        tracing::debug!("Audio cue: {:?}", cue);

        let wav_bytes = match cue {
            AudioCue::PttOn => super::cues::ptt_on_wav(),
            AudioCue::PttOff => super::cues::ptt_off_wav(),
            AudioCue::Error => super::cues::error_wav(),
        };

        if let Err(e) = self.play_bytes(wav_bytes.clone()) {
            tracing::warn!("Failed to play audio cue {:?}: {e}", cue);
        }
    }

    pub fn is_initialized(&self) -> bool {
        self.output.lock().is_some()
    }
}
