use tauri::State;

use crate::services::types::GameProfile;
use crate::state::AppState;

#[tauri::command]
pub fn list_game_profiles() -> Vec<GameProfile> {
    crate::profiles::all_profiles()
}

#[tauri::command]
pub fn get_active_profile(state: State<'_, AppState>) -> String {
    state.active_game_id.lock().clone()
}

#[tauri::command]
pub fn set_active_profile(state: State<'_, AppState>, game_id: String) -> Result<(), String> {
    // Validate the profile exists
    crate::profiles::get_profile(&game_id)
        .ok_or_else(|| format!("Unknown game profile: {game_id}"))?;

    *state.active_game_id.lock() = game_id.clone();
    tracing::info!("Active game profile set to: {game_id}");
    Ok(())
}
