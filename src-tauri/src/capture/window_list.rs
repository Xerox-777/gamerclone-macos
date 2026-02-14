use serde::{Deserialize, Serialize};
use windows_capture::monitor::Monitor;
use windows_capture::window::Window;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
    pub process_name: String,
    pub capture_type: String, // "window" or "monitor"
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
                capture_type: "window".to_string(),
            })
        })
        .collect();

    // Sort by title for consistent ordering
    result.sort_by(|a, b| a.title.cmp(&b.title));

    tracing::debug!("Enumerated {} windows", result.len());
    Ok(result)
}

pub fn enumerate_monitors() -> Result<Vec<WindowInfo>, String> {
    let monitors =
        Monitor::enumerate().map_err(|e| format!("Failed to enumerate monitors: {e}"))?;

    let result: Vec<WindowInfo> = monitors
        .iter()
        .enumerate()
        .filter_map(|(i, m)| {
            let name = m.name().ok().unwrap_or_else(|| "Unknown".to_string());
            let width = m.width().ok()?;
            let height = m.height().ok()?;
            let handle = m.as_raw_hmonitor() as isize;

            let title = format!("Display {} \u{2014} {} ({}x{})", i + 1, name, width, height);

            Some(WindowInfo {
                hwnd: handle,
                title,
                process_name: "Full Screen".to_string(),
                capture_type: "monitor".to_string(),
            })
        })
        .collect();

    tracing::debug!("Enumerated {} monitors", result.len());
    Ok(result)
}

/// Returns monitors first, then windows.
pub fn enumerate_all() -> Result<Vec<WindowInfo>, String> {
    let mut all = enumerate_monitors().unwrap_or_default();
    all.extend(enumerate_windows()?);
    Ok(all)
}
