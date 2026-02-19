use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WindowInfo {
    pub hwnd: isize,
    pub title: String,
    pub process_name: String,
    pub capture_type: String, // "window" or "monitor"
}

pub fn enumerate_windows() -> Result<Vec<WindowInfo>, String> {
    let windows =
        xcap::Window::all().map_err(|e| format!("Failed to enumerate windows: {e}"))?;

    let mut result: Vec<WindowInfo> = windows
        .into_iter()
        .filter_map(|w| {
            let title = w.title().ok()?;
            if title.is_empty() {
                return None;
            }

            // Skip minimized windows
            if w.is_minimized().unwrap_or(true) {
                return None;
            }

            let id = w.id().ok()? as isize;
            let app_name = w.app_name().ok().unwrap_or_default();

            Some(WindowInfo {
                hwnd: id,
                title,
                process_name: app_name,
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
        xcap::Monitor::all().map_err(|e| format!("Failed to enumerate monitors: {e}"))?;

    let result: Vec<WindowInfo> = monitors
        .into_iter()
        .enumerate()
        .filter_map(|(i, m)| {
            let name = m.name().ok().unwrap_or_else(|| "Unknown".to_string());
            let width = m.width().ok()?;
            let height = m.height().ok()?;
            let id = m.id().ok()? as isize;

            let title = format!("Display {} \u{2014} {} ({}x{})", i + 1, name, width, height);

            Some(WindowInfo {
                hwnd: id,
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
