use tauri::State;

use crate::state::AppState;

#[tauri::command]
pub fn get_ptt_key(state: State<'_, AppState>) -> String {
    state.hotkey_manager.get_ptt_binding()
}

#[tauri::command]
pub fn set_ptt_key(key: String, state: State<'_, AppState>) -> Result<(), String> {
    state.hotkey_manager.set_ptt_binding(&key)
}

#[tauri::command]
pub fn get_ptt_status(state: State<'_, AppState>) -> bool {
    state.hotkey_manager.is_ptt_held()
}
