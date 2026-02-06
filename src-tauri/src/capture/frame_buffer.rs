use std::collections::VecDeque;
use std::sync::{Arc, RwLock};
use std::time::Instant;

#[derive(Clone)]
pub struct CapturedFrame {
    pub jpeg_bytes: Vec<u8>,
    pub timestamp: Instant,
    pub width: u32,
    pub height: u32,
}

#[derive(Clone)]
pub struct FrameBuffer {
    frames: Arc<RwLock<VecDeque<CapturedFrame>>>,
    capacity: usize,
}

impl FrameBuffer {
    pub fn new(capacity: usize) -> Self {
        Self {
            frames: Arc::new(RwLock::new(VecDeque::with_capacity(capacity))),
            capacity,
        }
    }

    pub fn push_frame(&self, frame: CapturedFrame) {
        let mut frames = self.frames.write().unwrap();
        if frames.len() >= self.capacity {
            frames.pop_front();
        }
        frames.push_back(frame);
    }

    pub fn get_recent(&self, n: usize) -> Vec<CapturedFrame> {
        let frames = self.frames.read().unwrap();
        frames.iter().rev().take(n).cloned().collect()
    }

    pub fn clear(&self) {
        let mut frames = self.frames.write().unwrap();
        frames.clear();
    }

    pub fn len(&self) -> usize {
        let frames = self.frames.read().unwrap();
        frames.len()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_frame(data: u8) -> CapturedFrame {
        CapturedFrame {
            jpeg_bytes: vec![data],
            timestamp: Instant::now(),
            width: 1920,
            height: 1080,
        }
    }

    #[test]
    fn test_new_empty() {
        let buf = FrameBuffer::new(10);
        assert_eq!(buf.len(), 0);
    }

    #[test]
    fn test_push_single() {
        let buf = FrameBuffer::new(10);
        buf.push_frame(make_frame(1));
        assert_eq!(buf.len(), 1);
    }

    #[test]
    fn test_push_to_capacity() {
        let buf = FrameBuffer::new(5);
        for i in 0..5 {
            buf.push_frame(make_frame(i));
        }
        assert_eq!(buf.len(), 5);
    }

    #[test]
    fn test_evicts_oldest_beyond_capacity() {
        let buf = FrameBuffer::new(5);
        for i in 0..10 {
            buf.push_frame(make_frame(i));
        }
        assert_eq!(buf.len(), 5);
        // Oldest should be gone; newest frames are 5..9
        let recent = buf.get_recent(5);
        assert_eq!(recent[0].jpeg_bytes[0], 9); // most recent
        assert_eq!(recent[4].jpeg_bytes[0], 5); // oldest remaining
    }

    #[test]
    fn test_get_recent_newest_first() {
        let buf = FrameBuffer::new(10);
        for i in 0..5 {
            buf.push_frame(make_frame(i));
        }
        let recent = buf.get_recent(3);
        assert_eq!(recent.len(), 3);
        assert_eq!(recent[0].jpeg_bytes[0], 4);
        assert_eq!(recent[1].jpeg_bytes[0], 3);
        assert_eq!(recent[2].jpeg_bytes[0], 2);
    }

    #[test]
    fn test_get_recent_more_than_available() {
        let buf = FrameBuffer::new(10);
        buf.push_frame(make_frame(1));
        buf.push_frame(make_frame(2));
        let recent = buf.get_recent(10);
        assert_eq!(recent.len(), 2);
    }

    #[test]
    fn test_clear() {
        let buf = FrameBuffer::new(10);
        for i in 0..5 {
            buf.push_frame(make_frame(i));
        }
        assert_eq!(buf.len(), 5);
        buf.clear();
        assert_eq!(buf.len(), 0);
    }

    #[test]
    fn test_concurrent_push_and_read() {
        let buf = FrameBuffer::new(100);
        let buf_writer = buf.clone();
        let buf_reader = buf.clone();

        let writer = std::thread::spawn(move || {
            for i in 0..50u8 {
                buf_writer.push_frame(make_frame(i));
            }
        });

        let reader = std::thread::spawn(move || {
            for _ in 0..50 {
                let _ = buf_reader.get_recent(5);
                let _ = buf_reader.len();
            }
        });

        writer.join().unwrap();
        reader.join().unwrap();
        assert!(buf.len() <= 100);
    }
}
