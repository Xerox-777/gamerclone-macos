use serde::Serialize;
use tauri::State;

use crate::capture::{enumerate_windows, WindowInfo};
use crate::state::AppState;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CaptureStatus {
    pub is_capturing: bool,
    pub frame_count: usize,
}

#[tauri::command]
pub fn list_windows() -> Result<Vec<WindowInfo>, String> {
    enumerate_windows()
}

#[tauri::command]
pub fn select_window(hwnd: isize, state: State<'_, AppState>) -> Result<(), String> {
    state.capture_manager.start(hwnd)
}

#[tauri::command]
pub fn start_capture(state: State<'_, AppState>) -> Result<(), String> {
    let hwnd = state
        .capture_manager
        .selected_hwnd()
        .ok_or_else(|| "No window selected".to_string())?;
    state.capture_manager.start(hwnd)
}

#[tauri::command]
pub fn stop_capture(state: State<'_, AppState>) {
    state.capture_manager.stop();
}

#[tauri::command]
pub fn get_capture_status(state: State<'_, AppState>) -> CaptureStatus {
    CaptureStatus {
        is_capturing: state.capture_manager.is_capturing(),
        frame_count: state.capture_manager.frame_count(),
    }
}
