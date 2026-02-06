#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use gamerclone::commands;
use gamerclone::state::AppState;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use tauri_plugin_store::StoreExt;
use tracing_subscriber::EnvFilter;

fn main() {
    // Load .env file — try CWD first, then parent (cargo tauri dev runs from src-tauri/)
    if dotenv::dotenv().is_err() {
        let _ = dotenv::from_path("../.env");
    }

    // Initialize structured logging
    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| EnvFilter::new("gamerclone=debug,info")),
        )
        .init();

    tracing::info!("GamerClone starting up");

    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            // Focus the main window when a second instance is launched
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_store::Builder::default().build())
        .manage(AppState::new())
        .setup(|app| {
            // Build tray menu
            let settings_item =
                MenuItem::with_id(app, "settings", "Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&settings_item, &quit_item])?;

            // Build tray icon
            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("GamerClone - AI Gaming Coach")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::DoubleClick { .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Initialize audio streams with default devices (non-fatal)
            {
                let state = app.state::<gamerclone::state::AppState>();
                if let Err(e) = state.audio_recorder.init_stream("") {
                    tracing::warn!("Failed to init default audio input: {e}");
                }
                if let Err(e) = state.audio_player.init_stream("") {
                    tracing::warn!("Failed to init default audio output: {e}");
                }

                // Restore saved active game profile from store
                match app.handle().store("settings.json") {
                    Ok(store) => {
                        if let Some(val) = store.get("activeGameId") {
                            if let Some(game_id) = val.as_str() {
                                if gamerclone::profiles::get_profile(game_id).is_some() {
                                    *state.active_game_id.lock().unwrap() = game_id.to_string();
                                    tracing::info!("Restored active game profile: {game_id}");
                                }
                            }
                        }
                    }
                    Err(e) => tracing::debug!("No settings store yet: {e}"),
                }

                // Start hotkey listener
                state.hotkey_manager.start(app.handle().clone());
            }

            tracing::info!("GamerClone initialized successfully");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::greet,
            commands::settings::get_all_settings,
            commands::settings::save_setting,
            commands::capture::list_windows,
            commands::capture::select_window,
            commands::capture::start_capture,
            commands::capture::stop_capture,
            commands::capture::get_capture_status,
            commands::audio::list_audio_devices,
            commands::audio::set_input_device,
            commands::audio::set_output_device,
            commands::audio::test_microphone,
            commands::audio::get_audio_status,
            commands::hotkeys::get_ptt_key,
            commands::hotkeys::set_ptt_key,
            commands::hotkeys::get_ptt_status,
            commands::voice::start_recording,
            commands::voice::process_voice_query,
            commands::profiles::list_game_profiles,
            commands::profiles::get_active_profile,
            commands::profiles::set_active_profile,
        ])
        .run(tauri::generate_context!())
        .expect("error while running GamerClone");
}
