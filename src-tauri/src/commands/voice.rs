use tauri::State;

use crate::pipeline::VoiceQueryResult;
use crate::state::AppState;

#[tauri::command]
pub async fn start_recording(state: State<'_, AppState>) -> Result<(), String> {
    state.audio_recorder.start_recording();
    Ok(())
}

#[tauri::command]
pub async fn process_voice_query(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    game_id: Option<String>,
) -> Result<VoiceQueryResult, String> {
    let gid = game_id.unwrap_or_else(|| state.active_game_id.lock().clone());

    state
        .voice_pipeline
        .process_query(
            &app,
            &state.audio_recorder,
            &state.capture_manager,
            &state.audio_player,
            &gid,
        )
        .await
}
