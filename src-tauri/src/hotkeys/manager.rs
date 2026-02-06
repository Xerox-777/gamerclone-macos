use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;

use rdev::{Button, Event, EventType, Key};
use tauri::Emitter;

/// Represents a PTT key binding — either a keyboard key or a mouse button.
#[derive(Debug, Clone)]
pub enum PttBinding {
    Key(Key),
    Button(Button),
}

impl PttBinding {
    pub fn from_string(s: &str) -> Result<Self, String> {
        // Try mouse buttons first
        match s.to_lowercase().as_str() {
            "mouse4" | "xbutton1" => return Ok(PttBinding::Button(Button::Unknown(1))),
            "mouse5" | "xbutton2" => return Ok(PttBinding::Button(Button::Unknown(2))),
            "middlemouse" | "mouse3" => return Ok(PttBinding::Button(Button::Middle)),
            _ => {}
        }

        // Try keyboard keys
        let key = match s.to_lowercase().as_str() {
            "backquote" | "tilde" | "`" | "~" => Key::BackQuote,
            "f1" => Key::F1,
            "f2" => Key::F2,
            "f3" => Key::F3,
            "f4" => Key::F4,
            "f5" => Key::F5,
            "f6" => Key::F6,
            "f7" => Key::F7,
            "f8" => Key::F8,
            "f9" => Key::F9,
            "f10" => Key::F10,
            "f11" => Key::F11,
            "f12" => Key::F12,
            "capslock" => Key::CapsLock,
            "numlock" => Key::NumLock,
            "scrolllock" => Key::ScrollLock,
            "pause" => Key::Pause,
            "insert" => Key::Insert,
            "home" => Key::Home,
            "end" => Key::End,
            "pageup" => Key::PageUp,
            "pagedown" => Key::PageDown,
            "printscreen" => Key::PrintScreen,
            _ => return Err(format!("Unsupported PTT key: {s}")),
        };

        // Validate: reject game-critical keys
        if is_blocked_key(&key) {
            return Err(format!(
                "Key '{s}' is blocked — it conflicts with common game controls"
            ));
        }

        Ok(PttBinding::Key(key))
    }

    pub fn to_display_string(&self) -> String {
        match self {
            PttBinding::Key(key) => match key {
                Key::BackQuote => "Tilde (~)".to_string(),
                Key::F1 => "F1".to_string(),
                Key::F2 => "F2".to_string(),
                Key::F3 => "F3".to_string(),
                Key::F4 => "F4".to_string(),
                Key::F5 => "F5".to_string(),
                Key::F6 => "F6".to_string(),
                Key::F7 => "F7".to_string(),
                Key::F8 => "F8".to_string(),
                Key::F9 => "F9".to_string(),
                Key::F10 => "F10".to_string(),
                Key::F11 => "F11".to_string(),
                Key::F12 => "F12".to_string(),
                Key::CapsLock => "CapsLock".to_string(),
                Key::NumLock => "NumLock".to_string(),
                Key::ScrollLock => "ScrollLock".to_string(),
                Key::Pause => "Pause".to_string(),
                Key::Insert => "Insert".to_string(),
                Key::Home => "Home".to_string(),
                Key::End => "End".to_string(),
                Key::PageUp => "PageUp".to_string(),
                Key::PageDown => "PageDown".to_string(),
                Key::PrintScreen => "PrintScreen".to_string(),
                other => format!("{:?}", other),
            },
            PttBinding::Button(btn) => match btn {
                Button::Unknown(1) => "Mouse4".to_string(),
                Button::Unknown(2) => "Mouse5".to_string(),
                Button::Middle => "MiddleMouse".to_string(),
                other => format!("{:?}", other),
            },
        }
    }

    fn matches_event(&self, event_type: &EventType) -> bool {
        match (self, event_type) {
            (PttBinding::Key(k), EventType::KeyPress(ek)) => {
                std::mem::discriminant(k) == std::mem::discriminant(ek)
            }
            (PttBinding::Key(k), EventType::KeyRelease(ek)) => {
                std::mem::discriminant(k) == std::mem::discriminant(ek)
            }
            (PttBinding::Button(b), EventType::ButtonPress(eb)) => {
                std::mem::discriminant(b) == std::mem::discriminant(eb)
            }
            (PttBinding::Button(b), EventType::ButtonRelease(eb)) => {
                std::mem::discriminant(b) == std::mem::discriminant(eb)
            }
            _ => false,
        }
    }
}

fn is_blocked_key(key: &Key) -> bool {
    matches!(
        key,
        Key::KeyW
            | Key::KeyA
            | Key::KeyS
            | Key::KeyD
            | Key::Space
            | Key::ShiftLeft
            | Key::ShiftRight
            | Key::ControlLeft
            | Key::ControlRight
            | Key::Alt
            | Key::Tab
            | Key::Escape
            | Key::Return
    )
}

pub struct HotkeyManager {
    binding: Arc<Mutex<PttBinding>>,
    is_ptt_held: Arc<AtomicBool>,
    is_running: AtomicBool,
}

impl Default for HotkeyManager {
    fn default() -> Self {
        Self::new()
    }
}

impl HotkeyManager {
    pub fn new() -> Self {
        Self {
            binding: Arc::new(Mutex::new(PttBinding::Button(Button::Unknown(1)))), // Mouse4
            is_ptt_held: Arc::new(AtomicBool::new(false)),
            is_running: AtomicBool::new(false),
        }
    }

    pub fn start(&self, app_handle: tauri::AppHandle) {
        if self.is_running.load(Ordering::Relaxed) {
            tracing::warn!("Hotkey listener already running");
            return;
        }

        let binding = Arc::clone(&self.binding);
        let is_ptt_held = Arc::clone(&self.is_ptt_held);
        self.is_running.store(true, Ordering::Relaxed);

        std::thread::Builder::new()
            .name("hotkey-listener".to_string())
            .spawn(move || {
                tracing::info!("Hotkey listener thread started");

                let press_time: Arc<Mutex<Option<std::time::Instant>>> = Arc::new(Mutex::new(None));

                let callback = move |event: Event| {
                    let current_binding = binding.lock().clone();

                    let is_press = matches!(
                        event.event_type,
                        EventType::KeyPress(_) | EventType::ButtonPress(_)
                    );
                    let is_release = matches!(
                        event.event_type,
                        EventType::KeyRelease(_) | EventType::ButtonRelease(_)
                    );

                    if !current_binding.matches_event(&event.event_type) {
                        return;
                    }

                    if is_press && !is_ptt_held.load(Ordering::Relaxed) {
                        is_ptt_held.store(true, Ordering::Relaxed);
                        *press_time.lock() = Some(std::time::Instant::now());
                        let _ = app_handle.emit("ptt-started", ());
                        tracing::debug!("PTT pressed");
                    } else if is_release && is_ptt_held.load(Ordering::Relaxed) {
                        is_ptt_held.store(false, Ordering::Relaxed);

                        // Filter taps < 200ms
                        let duration_ms = press_time
                            .lock()
                            .take()
                            .map(|t| t.elapsed().as_millis())
                            .unwrap_or(0);

                        if duration_ms < 200 {
                            tracing::debug!("PTT tap too short ({duration_ms}ms), ignoring");
                            return;
                        }

                        // Small delay to prevent accidental cutoff
                        let app = app_handle.clone();
                        std::thread::spawn(move || {
                            std::thread::sleep(std::time::Duration::from_millis(100));
                            let _ = app.emit("ptt-stopped", ());
                        });
                        tracing::debug!("PTT released after {duration_ms}ms");
                    }
                };

                // rdev::listen blocks forever — this is expected
                if let Err(e) = rdev::listen(callback) {
                    tracing::error!("Hotkey listener error: {:?}", e);
                }
            })
            .expect("Failed to spawn hotkey listener thread");
    }

    pub fn set_ptt_binding(&self, key_str: &str) -> Result<(), String> {
        let new_binding = PttBinding::from_string(key_str)?;
        tracing::info!(
            "PTT binding changed to: {}",
            new_binding.to_display_string()
        );
        *self.binding.lock() = new_binding;
        Ok(())
    }

    pub fn get_ptt_binding(&self) -> String {
        self.binding.lock().to_display_string()
    }

    pub fn is_ptt_held(&self) -> bool {
        self.is_ptt_held.load(Ordering::Relaxed)
    }
}
