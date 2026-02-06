use serde::Serialize;
use tauri::State;

use crate::audio::{list_input_devices, list_output_devices, AudioDeviceInfo};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioStatus {
    pub input_stream_active: bool,
    pub output_initialized: bool,
    pub is_recording: bool,
}

#[tauri::command]
pub fn list_audio_devices(kind: String) -> Result<Vec<AudioDeviceInfo>, String> {
    match kind.as_str() {
        "input" => list_input_devices(),
        "output" => list_output_devices(),
        _ => Err(format!(
            "Invalid device kind: {kind}. Use 'input' or 'output'."
        )),
    }
}

#[tauri::command]
pub fn set_input_device(device_name: String, state: State<'_, AppState>) -> Result<(), String> {
    state.audio_recorder.init_stream(&device_name)
}

#[tauri::command]
pub fn set_output_device(device_name: String, state: State<'_, AppState>) -> Result<(), String> {
    state.audio_player.init_stream(&device_name)
}

#[tauri::command]
pub async fn test_microphone(state: State<'_, AppState>) -> Result<String, String> {
    // Start recording
    state.audio_recorder.start_recording();

    // Record for 2 seconds
    tokio::time::sleep(std::time::Duration::from_secs(2)).await;

    // Stop and get WAV bytes
    let wav_bytes = state.audio_recorder.stop_recording()?;
    let size_kb = wav_bytes.len() / 1024;

    // Play back through speakers
    state.audio_player.play_bytes(wav_bytes)?;

    Ok(format!("Recorded {size_kb}KB, playing back..."))
}

#[tauri::command]
pub fn get_audio_status(state: State<'_, AppState>) -> AudioStatus {
    AudioStatus {
        input_stream_active: state.audio_recorder.is_stream_active(),
        output_initialized: state.audio_player.is_initialized(),
        is_recording: state.audio_recorder.is_recording(),
    }
}
