pub mod audio;
pub mod capture;
pub mod hotkeys;
pub mod profiles;
pub mod settings;
pub mod voice;

/// Simple IPC test command
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! GamerClone is running.", name)
}
