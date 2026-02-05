use serde_json::Value;
use std::collections::HashMap;
use tauri_plugin_store::StoreExt;

const STORE_FILE: &str = "settings.json";

#[tauri::command]
pub fn get_all_settings(app: tauri::AppHandle) -> Result<HashMap<String, Value>, String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    let mut settings = HashMap::new();

    for (key, value) in store.entries() {
        settings.insert(key.clone(), value.clone());
    }

    Ok(settings)
}

#[tauri::command]
pub fn save_setting(app: tauri::AppHandle, key: String, value: Value) -> Result<(), String> {
    let store = app.store(STORE_FILE).map_err(|e| e.to_string())?;
    store.set(key, value);
    Ok(())
}
