pub mod settings;

/// Simple IPC test command
#[tauri::command]
pub fn greet(name: &str) -> String {
    format!("Hello, {}! GamerClone is running.", name)
}
