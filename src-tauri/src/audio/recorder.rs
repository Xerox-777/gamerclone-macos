use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use parking_lot::Mutex;

use cpal::traits::{DeviceTrait, StreamTrait};

use super::devices::find_input_device_by_name;
use super::encoder::encode_wav;

const MAX_RECORDING_SECS: f32 = 30.0;
const MIN_RECORDING_MS: u128 = 200;
const PRE_ROLL_MS: u32 = 300;

struct StreamState {
    _stream: cpal::Stream,
}

// SAFETY: cpal::Stream is Send but not Sync. We only access it from one thread
// at a time (init_stream / drop), protected by the outer Mutex.
unsafe impl Send for StreamState {}
unsafe impl Sync for StreamState {}

pub struct AudioRecorder {
    is_recording: Arc<AtomicBool>,
    is_stream_active: AtomicBool,
    recording_samples: Arc<Mutex<Vec<f32>>>,
    pre_roll_buffer: Arc<Mutex<VecDeque<f32>>>,
    pre_roll_capacity: Arc<Mutex<usize>>, // samples count for PRE_ROLL_MS
    stream_state: Mutex<Option<StreamState>>,
    recording_start: Mutex<Option<std::time::Instant>>,
    sample_rate: Mutex<u32>,
    channels: Mutex<u16>,
}

impl Default for AudioRecorder {
    fn default() -> Self {
        Self::new()
    }
}

impl AudioRecorder {
    pub fn new() -> Self {
        Self {
            is_recording: Arc::new(AtomicBool::new(false)),
            is_stream_active: AtomicBool::new(false),
            recording_samples: Arc::new(Mutex::new(Vec::new())),
            pre_roll_buffer: Arc::new(Mutex::new(VecDeque::new())),
            pre_roll_capacity: Arc::new(Mutex::new(0)),
            stream_state: Mutex::new(None),
            recording_start: Mutex::new(None),
            sample_rate: Mutex::new(48000),
            channels: Mutex::new(1),
        }
    }

    pub fn init_stream(&self, device_name: &str) -> Result<(), String> {
        // Stop existing stream
        self.stop_stream();

        let device = find_input_device_by_name(device_name)
            .ok_or_else(|| "No input device found".to_string())?;

        let config = device
            .default_input_config()
            .map_err(|e| format!("Failed to get input config: {e}"))?;

        let sample_rate = config.sample_rate().0;
        let channels = config.channels();

        *self.sample_rate.lock() = sample_rate;
        *self.channels.lock() = channels;

        // Calculate pre-roll capacity in samples
        let pre_roll_samples =
            (sample_rate as usize * channels as usize * PRE_ROLL_MS as usize) / 1000;
        *self.pre_roll_capacity.lock() = pre_roll_samples;

        // Calculate max recording samples
        let max_samples = (sample_rate as f32 * channels as f32 * MAX_RECORDING_SECS) as usize;

        let is_recording = Arc::clone(&self.is_recording);
        let recording_samples = Arc::clone(&self.recording_samples);
        let pre_roll_buffer = Arc::clone(&self.pre_roll_buffer);
        let pre_roll_cap = Arc::clone(&self.pre_roll_capacity);

        let stream_config: cpal::StreamConfig = config.into();

        let stream = device
            .build_input_stream(
                &stream_config,
                move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    if is_recording.load(Ordering::Relaxed) {
                        let mut samples = recording_samples.lock();
                        if samples.len() < max_samples {
                            let remaining = max_samples - samples.len();
                            let to_copy = data.len().min(remaining);
                            samples.extend_from_slice(&data[..to_copy]);
                        }
                        // Auto-stop handled by stop_recording check
                    } else {
                        // Fill pre-roll circular buffer
                        let cap = *pre_roll_cap.lock();
                        if cap > 0 {
                            let mut buf = pre_roll_buffer.lock();
                            for &sample in data {
                                if buf.len() >= cap {
                                    buf.pop_front();
                                }
                                buf.push_back(sample);
                            }
                        }
                    }
                },
                |err| {
                    tracing::error!("Audio input stream error: {err}");
                },
                None,
            )
            .map_err(|e| format!("Failed to build input stream: {e}"))?;

        stream
            .play()
            .map_err(|e| format!("Failed to start input stream: {e}"))?;

        *self.stream_state.lock() = Some(StreamState { _stream: stream });
        self.is_stream_active.store(true, Ordering::Relaxed);

        let device_display = if device_name.is_empty() {
            "default"
        } else {
            device_name
        };
        tracing::info!(
            "Audio input stream started: {device_display} ({sample_rate}Hz, {channels}ch)"
        );

        Ok(())
    }

    pub fn start_recording(&self) {
        // Clear previous recording
        self.recording_samples.lock().clear();

        // Prepend pre-roll buffer
        {
            let pre_roll = self.pre_roll_buffer.lock();
            if !pre_roll.is_empty() {
                let mut samples = self.recording_samples.lock();
                samples.extend(pre_roll.iter());
            }
        }

        *self.recording_start.lock() = Some(std::time::Instant::now());
        self.is_recording.store(true, Ordering::Relaxed);
        tracing::debug!("Recording started");
    }

    pub fn stop_recording(&self) -> Result<Vec<u8>, String> {
        self.is_recording.store(false, Ordering::Relaxed);

        // Check minimum duration
        if let Some(start) = self.recording_start.lock().take() {
            let duration_ms = start.elapsed().as_millis();
            if duration_ms < MIN_RECORDING_MS {
                tracing::debug!("Recording too short ({duration_ms}ms), discarding");
                self.recording_samples.lock().clear();
                return Err("Recording too short (< 200ms)".to_string());
            }
        }

        let samples = {
            let mut s = self.recording_samples.lock();
            std::mem::take(&mut *s)
        };

        if samples.is_empty() {
            return Err("No audio recorded".to_string());
        }

        let sample_rate = *self.sample_rate.lock();
        let channels = *self.channels.lock();

        let duration_secs = samples.len() as f32 / (sample_rate as f32 * channels as f32);
        tracing::debug!(
            "Recording stopped: {:.1}s, {} samples",
            duration_secs,
            samples.len()
        );

        encode_wav(&samples, sample_rate, channels)
    }

    pub fn is_recording(&self) -> bool {
        self.is_recording.load(Ordering::Relaxed)
    }

    pub fn is_stream_active(&self) -> bool {
        self.is_stream_active.load(Ordering::Relaxed)
    }

    fn stop_stream(&self) {
        let mut state = self.stream_state.lock();
        if state.is_some() {
            *state = None; // Drop the stream
            self.is_stream_active.store(false, Ordering::Relaxed);
            self.is_recording.store(false, Ordering::Relaxed);
            tracing::info!("Audio input stream stopped");
        }
    }
}

impl Drop for AudioRecorder {
    fn drop(&mut self) {
        self.is_recording.store(false, Ordering::Relaxed);
        // Stream will be dropped automatically
    }
}
