use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Instant;

use parking_lot::Mutex;

use image::imageops::FilterType;
use image::RgbaImage;
use windows_capture::capture::{CaptureControl, Context, GraphicsCaptureApiHandler};
use windows_capture::frame::Frame;
use windows_capture::graphics_capture_api::InternalCaptureControl;
use windows_capture::settings::{
    ColorFormat, CursorCaptureSettings, DirtyRegionSettings, DrawBorderSettings,
    MinimumUpdateIntervalSettings, SecondaryWindowSettings, Settings,
};
use windows_capture::monitor::Monitor;
use windows_capture::window::Window;

use super::frame_buffer::{CapturedFrame, FrameBuffer};

type CaptureError = Box<dyn std::error::Error + Send + Sync>;

// ---------- CaptureHandler (inner, lives on capture thread) ----------

struct CaptureFlags {
    frame_buffer: FrameBuffer,
    capture_interval_ms: u64,
    jpeg_quality: i32,
    stop_flag: Arc<AtomicBool>,
}

struct CaptureHandler {
    frame_buffer: FrameBuffer,
    capture_interval_ms: u64,
    jpeg_quality: i32,
    last_capture: Instant,
    stop_flag: Arc<AtomicBool>,
}

impl GraphicsCaptureApiHandler for CaptureHandler {
    type Flags = CaptureFlags;
    type Error = CaptureError;

    fn new(ctx: Context<Self::Flags>) -> Result<Self, Self::Error> {
        tracing::info!("CaptureHandler initialized on capture thread");
        Ok(Self {
            frame_buffer: ctx.flags.frame_buffer,
            capture_interval_ms: ctx.flags.capture_interval_ms,
            jpeg_quality: ctx.flags.jpeg_quality,
            last_capture: Instant::now()
                - std::time::Duration::from_millis(ctx.flags.capture_interval_ms),
            stop_flag: ctx.flags.stop_flag,
        })
    }

    fn on_frame_arrived(
        &mut self,
        frame: &mut Frame,
        capture_control: InternalCaptureControl,
    ) -> Result<(), Self::Error> {
        // Check if we should stop
        if self.stop_flag.load(Ordering::Relaxed) {
            capture_control.stop();
            return Ok(());
        }

        // Throttle to capture interval
        let elapsed = self.last_capture.elapsed().as_millis() as u64;
        if elapsed < self.capture_interval_ms {
            return Ok(());
        }
        self.last_capture = Instant::now();

        let src_width = frame.width();
        let src_height = frame.height();

        // Get raw pixel data
        let buffer = frame.buffer()?;
        let mut pixel_buf = Vec::new();
        let pixels = buffer.as_nopadding_buffer(&mut pixel_buf);

        // Build image from raw RGBA data
        let rgba_image = match RgbaImage::from_raw(src_width, src_height, pixels.to_vec()) {
            Some(img) => img,
            None => {
                tracing::warn!("Failed to create RgbaImage from frame data");
                return Ok(());
            }
        };

        // Resize to 1280x720
        let (target_w, target_h) = (1280u32, 720u32);
        let resized = if src_width != target_w || src_height != target_h {
            image::imageops::resize(&rgba_image, target_w, target_h, FilterType::Triangle)
        } else {
            rgba_image
        };

        let (final_w, final_h) = (resized.width() as usize, resized.height() as usize);
        let rgba_bytes = resized.into_raw();

        // JPEG compress via turbojpeg — use RGBX to skip alpha (X byte ignored)
        let jpeg_bytes = match turbojpeg::compress(
            turbojpeg::Image {
                pixels: rgba_bytes.as_slice(),
                width: final_w,
                pitch: final_w * 4,
                height: final_h,
                format: turbojpeg::PixelFormat::RGBX,
            },
            self.jpeg_quality,
            turbojpeg::Subsamp::Sub2x2,
        ) {
            Ok(buf) => buf.as_ref().to_vec(),
            Err(e) => {
                tracing::warn!("JPEG compression failed: {e}");
                return Ok(());
            }
        };

        let frame_size_kb = jpeg_bytes.len() / 1024;
        tracing::trace!(
            "Captured frame {}x{} -> JPEG {}KB",
            final_w,
            final_h,
            frame_size_kb
        );

        self.frame_buffer.push_frame(CapturedFrame {
            jpeg_bytes,
            timestamp: Instant::now(),
            width: final_w as u32,
            height: final_h as u32,
        });

        Ok(())
    }

    fn on_closed(&mut self) -> Result<(), Self::Error> {
        tracing::info!("Capture source window was closed");
        Ok(())
    }
}

// ---------- CaptureManager (public API) ----------

type BoxedCaptureControl = CaptureControl<CaptureHandler, CaptureError>;

pub struct CaptureManager {
    frame_buffer: FrameBuffer,
    capture_control: Mutex<Option<BoxedCaptureControl>>,
    is_capturing: AtomicBool,
    selected_hwnd: Mutex<Option<isize>>,
    selected_capture_type: Mutex<Option<String>>,
    stop_flag: Arc<AtomicBool>,
    capture_interval_ms: u64,
    jpeg_quality: i32,
}

impl CaptureManager {
    pub fn new(buffer_capacity: usize, capture_interval_ms: u64, jpeg_quality: i32) -> Self {
        Self {
            frame_buffer: FrameBuffer::new(buffer_capacity),
            capture_control: Mutex::new(None),
            is_capturing: AtomicBool::new(false),
            selected_hwnd: Mutex::new(None),
            selected_capture_type: Mutex::new(None),
            stop_flag: Arc::new(AtomicBool::new(false)),
            capture_interval_ms,
            jpeg_quality,
        }
    }

    /// Start capturing a target by handle and type.
    pub fn start_capture_target(
        &self,
        handle: isize,
        capture_type: &str,
    ) -> Result<(), String> {
        match capture_type {
            "monitor" => self.start_monitor(handle),
            _ => self.start_window(handle),
        }
    }

    pub fn start_window(&self, hwnd: isize) -> Result<(), String> {
        self.stop_internal();

        let window = Window::from_raw_hwnd(hwnd as *mut std::ffi::c_void);

        if !window.is_valid() {
            return Err("Invalid window handle".to_string());
        }

        let title = window.title().unwrap_or_else(|_| "Unknown".to_string());
        tracing::info!("Starting capture for window: {title} (hwnd: {hwnd})");

        let flags = self.make_flags();
        let settings = Settings::new(
            window,
            CursorCaptureSettings::WithoutCursor,
            DrawBorderSettings::WithoutBorder,
            SecondaryWindowSettings::Default,
            MinimumUpdateIntervalSettings::Default,
            DirtyRegionSettings::Default,
            ColorFormat::Rgba8,
            flags,
        );

        self.launch_capture(settings, hwnd, "window")
    }

    pub fn start_monitor(&self, hmonitor: isize) -> Result<(), String> {
        self.stop_internal();

        let monitor =
            Monitor::from_raw_hmonitor(hmonitor as *mut std::ffi::c_void);
        tracing::info!("Starting capture for monitor (handle: {hmonitor})");

        let flags = self.make_flags();
        let settings = Settings::new(
            monitor,
            CursorCaptureSettings::WithoutCursor,
            DrawBorderSettings::WithoutBorder,
            SecondaryWindowSettings::Default,
            MinimumUpdateIntervalSettings::Default,
            DirtyRegionSettings::Default,
            ColorFormat::Rgba8,
            flags,
        );

        self.launch_capture(settings, hmonitor, "monitor")
    }

    fn make_flags(&self) -> CaptureFlags {
        self.stop_flag.store(false, Ordering::Relaxed);
        self.frame_buffer.clear();

        CaptureFlags {
            frame_buffer: self.frame_buffer.clone(),
            capture_interval_ms: self.capture_interval_ms,
            jpeg_quality: self.jpeg_quality,
            stop_flag: Arc::clone(&self.stop_flag),
        }
    }

    fn launch_capture<T>(
        &self,
        settings: Settings<CaptureFlags, T>,
        handle: isize,
        capture_type: &str,
    ) -> Result<(), String>
    where
        T: TryInto<windows_capture::settings::GraphicsCaptureItemType>
            + Send
            + 'static,
        T::Error: std::fmt::Debug,
    {
        let control = CaptureHandler::start_free_threaded(settings)
            .map_err(|e| format!("Failed to start capture: {e}"))?;

        *self.capture_control.lock() = Some(control);
        *self.selected_hwnd.lock() = Some(handle);
        *self.selected_capture_type.lock() = Some(capture_type.to_string());
        self.is_capturing.store(true, Ordering::Relaxed);

        tracing::info!("Capture started successfully");
        Ok(())
    }

    /// Backward-compatible alias: starts a window capture.
    pub fn start(&self, hwnd: isize) -> Result<(), String> {
        self.start_window(hwnd)
    }

    pub fn stop(&self) {
        self.stop_internal();
    }

    fn stop_internal(&self) {
        // Signal the capture handler to stop
        self.stop_flag.store(true, Ordering::Relaxed);

        let control = self.capture_control.lock().take();
        if let Some(control) = control {
            if !control.is_finished() {
                tracing::info!("Stopping capture...");
                if let Err(e) = control.stop() {
                    tracing::warn!("Error stopping capture: {e:?}");
                }
            }
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
