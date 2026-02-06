use serde::{Deserialize, Serialize};
use windows_capture::window::Window;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
    pub process_name: String,
}

pub fn enumerate_windows() -> Result<Vec<WindowInfo>, String> {
    let windows = Window::enumerate().map_err(|e| format!("Failed to enumerate windows: {e}"))?;

    let mut result: Vec<WindowInfo> = windows
        .iter()
        .filter_map(|w| {
            let title = w.title().ok()?;
            if title.is_empty() {
                return None;
            }

            // Skip known system windows
            let skip_titles = [
                "Program Manager",
                "Windows Input Experience",
                "MSCTFIME UI",
                "Default IME",
            ];
            if skip_titles.iter().any(|s| title.contains(s)) {
                return None;
            }

            let raw_hwnd = w.as_raw_hwnd() as isize;
            let process_name = w.process_name().ok().unwrap_or_default();

            Some(WindowInfo {
                hwnd: raw_hwnd,
                title,
                process_name,
            })
        })
        .collect();

    // Sort by title for consistent ordering
    result.sort_by(|a, b| a.title.cmp(&b.title));

    tracing::debug!("Enumerated {} windows", result.len());
    Ok(result)
}
