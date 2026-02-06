use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioDeviceInfo {
    pub name: String,
    pub is_default: bool,
}

pub fn list_input_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let host = cpal::default_host();
    let default_name = host
        .default_input_device()
        .and_then(|d| d.name().ok());

    let devices: Vec<AudioDeviceInfo> = host
        .input_devices()
        .map_err(|e| format!("Failed to enumerate input devices: {e}"))?
        .filter_map(|d| {
            let name = d.name().ok()?;
            Some(AudioDeviceInfo {
                is_default: default_name.as_deref() == Some(&name),
                name,
            })
        })
        .collect();

    Ok(devices)
}

pub fn list_output_devices() -> Result<Vec<AudioDeviceInfo>, String> {
    let host = cpal::default_host();
    let default_name = host
        .default_output_device()
        .and_then(|d| d.name().ok());

    let devices: Vec<AudioDeviceInfo> = host
        .output_devices()
        .map_err(|e| format!("Failed to enumerate output devices: {e}"))?
        .filter_map(|d| {
            let name = d.name().ok()?;
            Some(AudioDeviceInfo {
                is_default: default_name.as_deref() == Some(&name),
                name,
            })
        })
        .collect();

    Ok(devices)
}

pub fn find_input_device_by_name(name: &str) -> Option<cpal::Device> {
    let host = cpal::default_host();
    if name.is_empty() {
        return host.default_input_device();
    }
    host.input_devices()
        .ok()?
        .find(|d| d.name().ok().as_deref() == Some(name))
        .or_else(|| host.default_input_device())
}

pub fn find_output_device_by_name(name: &str) -> Option<cpal::Device> {
    let host = cpal::default_host();
    if name.is_empty() {
        return host.default_output_device();
    }
    host.output_devices()
        .ok()?
        .find(|d| d.name().ok().as_deref() == Some(name))
        .or_else(|| host.default_output_device())
}
