use serde::{Deserialize, Serialize};
use std::sync::Mutex;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum AppStatus {
    Initializing,
    Ready,
    Listening,
    Processing,
    Error(String),
}

pub struct AppState {
    pub status: Mutex<AppStatus>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            status: Mutex::new(AppStatus::Ready),
        }
    }
}
