use std::io::Cursor;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use image::codecs::jpeg::JpegEncoder;
use image::imageops::FilterType;
use image::ImageEncoder;
use parking_lot::Mutex;

use super::frame_buffer::{CapturedFrame, FrameBuffer};

/// Which kind of target to capture.
#[derive(Clone)]
enum CaptureTarget {
    Window(u32),
    Monitor(u32),
}

pub struct CaptureManager {
    frame_buffer: FrameBuffer,
    capture_thread: Mutex<Option<std::thread::JoinHandle<()>>>,
    is_capturing: AtomicBool,
    selected_hwnd: Mutex<Option<isize>>,
    selected_capture_type: Mutex<Option<String>>,
    stop_flag: Arc<AtomicBool>,
    capture_interval_ms: u64,
    jpeg_quality: u8,
}

impl CaptureManager {
    pub fn new(buffer_capacity: usize, capture_interval_ms: u64, jpeg_quality: i32) -> Self {
        Self {
            frame_buffer: FrameBuffer::new(buffer_capacity),
            capture_thread: Mutex::new(None),
            is_capturing: AtomicBool::new(false),
            selected_hwnd: Mutex::new(None),
            selected_capture_type: Mutex::new(None),
            stop_flag: Arc::new(AtomicBool::new(false)),
            capture_interval_ms,
            jpeg_quality: jpeg_quality.clamp(1, 100) as u8,
        }
    }

    /// Start capturing a target by handle and type.
    pub fn start_capture_target(
        &self,
        handle: isize,
        capture_type: &str,
    ) -> Result<(), String> {
        self.stop_internal();

        let target = match capture_type {
            "monitor" => CaptureTarget::Monitor(handle as u32),
            _ => CaptureTarget::Window(handle as u32),
        };

        // Verify the target exists before spawning the thread
        match &target {
            CaptureTarget::Window(id) => {
                let windows = xcap::Window::all()
                    .map_err(|e| format!("Failed to enumerate windows: {e}"))?;
                if !windows.iter().any(|w| w.id().ok() == Some(*id)) {
                    return Err(format!("Window with id {} not found", id));
                }
                tracing::info!("Starting capture for window (id: {id})");
            }
            CaptureTarget::Monitor(id) => {
                let monitors = xcap::Monitor::all()
                    .map_err(|e| format!("Failed to enumerate monitors: {e}"))?;
                if !monitors.iter().any(|m| m.id().ok() == Some(*id)) {
                    return Err(format!("Monitor with id {} not found", id));
                }
                tracing::info!("Starting capture for monitor (id: {id})");
            }
        }

        self.stop_flag.store(false, Ordering::Relaxed);
        self.frame_buffer.clear();

        let stop_flag = Arc::clone(&self.stop_flag);
        let frame_buffer = self.frame_buffer.clone();
        let interval = Duration::from_millis(self.capture_interval_ms);
        let quality = self.jpeg_quality;

        let thread = std::thread::Builder::new()
            .name("xcap-capture".into())
            .spawn(move || {
                capture_loop(target, stop_flag, frame_buffer, interval, quality);
            })
            .map_err(|e| format!("Failed to spawn capture thread: {e}"))?;

        *self.capture_thread.lock() = Some(thread);
        *self.selected_hwnd.lock() = Some(handle);
        *self.selected_capture_type.lock() = Some(capture_type.to_string());
        self.is_capturing.store(true, Ordering::Relaxed);

        tracing::info!("Capture started successfully");
        Ok(())
    }

    /// Backward-compatible alias: starts a window capture.
    pub fn start(&self, hwnd: isize) -> Result<(), String> {
        self.start_capture_target(hwnd, "window")
    }

    pub fn start_window(&self, hwnd: isize) -> Result<(), String> {
        self.start_capture_target(hwnd, "window")
    }

    pub fn start_monitor(&self, hmonitor: isize) -> Result<(), String> {
        self.start_capture_target(hmonitor, "monitor")
    }

    pub fn stop(&self) {
        self.stop_internal();
    }

    fn stop_internal(&self) {
        self.stop_flag.store(true, Ordering::Relaxed);

        let thread = self.capture_thread.lock().take();
        if let Some(thread) = thread {
            tracing::info!("Stopping capture...");
            let _ = thread.join();
        }

        self.is_capturing.store(false, Ordering::Relaxed);
    }

    pub fn get_recent_frames(&self, n: usize) -> Vec<CapturedFrame> {
        self.frame_buffer.get_recent(n)
    }

    pub fn frame_count(&self) -> usize {
        self.frame_buffer.len()
    }

    pub fn is_capturing(&self) -> bool {
        self.is_capturing.load(Ordering::Relaxed)
    }

    pub fn selected_hwnd(&self) -> Option<isize> {
        *self.selected_hwnd.lock()
    }

    pub fn selected_capture_type(&self) -> Option<String> {
        self.selected_capture_type.lock().clone()
    }
}

impl Drop for CaptureManager {
    fn drop(&mut self) {
        self.stop_internal();
    }
}

/// Background thread: captures screenshots at a fixed interval.
fn capture_loop(
    target: CaptureTarget,
    stop_flag: Arc<AtomicBool>,
    frame_buffer: FrameBuffer,
    interval: Duration,
    jpeg_quality: u8,
) {
    tracing::info!("Capture loop started");

    while !stop_flag.load(Ordering::Relaxed) {
        let start = Instant::now();

        // Look up the target fresh each iteration (handles if it moves monitors, etc.)
        let rgba_image = match &target {
            CaptureTarget::Window(id) => {
                lookup_window(*id).and_then(|w| {
                    w.capture_image()
                        .map_err(|e| format!("Window capture failed: {e}"))
                })
            }
            CaptureTarget::Monitor(id) => {
                lookup_monitor(*id).and_then(|m| {
                    m.capture_image()
                        .map_err(|e| format!("Monitor capture failed: {e}"))
                })
            }
        };

        let rgba_image = match rgba_image {
            Ok(img) => img,
            Err(e) => {
                tracing::warn!("{e}");
                sleep_remaining(start, interval, &stop_flag);
                continue;
            }
        };

        let (src_w, src_h) = (rgba_image.width(), rgba_image.height());
        let (target_w, target_h) = (1280u32, 720u32);

        // Resize to 1280x720 if needed
        let resized = if src_w != target_w || src_h != target_h {
            image::imageops::resize(&rgba_image, target_w, target_h, FilterType::Triangle)
        } else {
            rgba_image
        };

        let (final_w, final_h) = (resized.width(), resized.height());

        // JPEG encode using the image crate
        let mut jpeg_buf = Cursor::new(Vec::new());
        let encoder = JpegEncoder::new_with_quality(&mut jpeg_buf, jpeg_quality);
        if let Err(e) = encoder.write_image(
            resized.as_raw(),
            final_w,
            final_h,
            image::ExtendedColorType::Rgba8,
        ) {
            tracing::warn!("JPEG encoding failed: {e}");
            sleep_remaining(start, interval, &stop_flag);
            continue;
        }

        let jpeg_bytes = jpeg_buf.into_inner();
        let frame_size_kb = jpeg_bytes.len() / 1024;
        tracing::trace!(
            "Captured frame {}x{} -> JPEG {}KB",
            final_w,
            final_h,
            frame_size_kb
        );

        frame_buffer.push_frame(CapturedFrame {
            jpeg_bytes,
            timestamp: Instant::now(),
            width: final_w,
            height: final_h,
        });

        sleep_remaining(start, interval, &stop_flag);
    }

    tracing::info!("Capture loop stopped");
}

/// Find a window by xcap ID.
fn lookup_window(id: u32) -> Result<xcap::Window, String> {
    let windows = xcap::Window::all().map_err(|e| format!("Failed to enumerate windows: {e}"))?;
    windows
        .into_iter()
        .find(|w| w.id().ok() == Some(id))
        .ok_or_else(|| format!("Window id {} no longer found", id))
}

/// Find a monitor by xcap ID.
fn lookup_monitor(id: u32) -> Result<xcap::Monitor, String> {
    let monitors =
        xcap::Monitor::all().map_err(|e| format!("Failed to enumerate monitors: {e}"))?;
    monitors
        .into_iter()
        .find(|m| m.id().ok() == Some(id))
        .ok_or_else(|| format!("Monitor id {} no longer found", id))
}

/// Sleep for the remainder of the interval, checking the stop flag periodically.
fn sleep_remaining(start: Instant, interval: Duration, stop_flag: &AtomicBool) {
    let elapsed = start.elapsed();
    if elapsed < interval {
        let remaining = interval - elapsed;
        // Sleep in small chunks so we can respond to stop_flag quickly
        let chunk = Duration::from_millis(100);
        let mut slept = Duration::ZERO;
        while slept < remaining && !stop_flag.load(Ordering::Relaxed) {
            let to_sleep = chunk.min(remaining - slept);
            std::thread::sleep(to_sleep);
            slept += to_sleep;
        }
    }
}
