use std::sync::OnceLock;

static PTT_ON_WAV: OnceLock<Vec<u8>> = OnceLock::new();
static PTT_OFF_WAV: OnceLock<Vec<u8>> = OnceLock::new();
static ERROR_WAV: OnceLock<Vec<u8>> = OnceLock::new();

const SAMPLE_RATE: u32 = 44100;

/// 50ms 880Hz sine with decay envelope (click)
pub fn ptt_on_wav() -> &'static Vec<u8> {
    PTT_ON_WAV.get_or_init(|| generate_tone(880.0, 0.05, 0.8, true))
}

/// 100ms 660Hz sine with decay envelope (processing tone)
pub fn ptt_off_wav() -> &'static Vec<u8> {
    PTT_OFF_WAV.get_or_init(|| generate_tone(660.0, 0.10, 0.6, true))
}

/// Two 150ms alternating tones 440Hz/330Hz (error chime)
pub fn error_wav() -> &'static Vec<u8> {
    ERROR_WAV.get_or_init(|| {
        let tone1 = generate_samples(440.0, 0.15, 0.7, true);
        let tone2 = generate_samples(330.0, 0.15, 0.7, true);
        let mut samples = tone1;
        samples.extend(tone2);
        encode_wav(&samples)
    })
}

fn generate_samples(freq: f32, duration: f32, amplitude: f32, decay: bool) -> Vec<i16> {
    let num_samples = (SAMPLE_RATE as f32 * duration) as usize;
    let mut samples = Vec::with_capacity(num_samples);

    for i in 0..num_samples {
        let t = i as f32 / SAMPLE_RATE as f32;
        let envelope = if decay {
            1.0 - (i as f32 / num_samples as f32)
        } else {
            1.0
        };
        let sample = (t * freq * 2.0 * std::f32::consts::PI).sin() * amplitude * envelope;
        samples.push((sample * i16::MAX as f32) as i16);
    }

    samples
}

fn generate_tone(freq: f32, duration: f32, amplitude: f32, decay: bool) -> Vec<u8> {
    let samples = generate_samples(freq, duration, amplitude, decay);
    encode_wav(&samples)
}

fn encode_wav(samples: &[i16]) -> Vec<u8> {
    let mut buf = Vec::new();
    let cursor = std::io::Cursor::new(&mut buf);

    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: SAMPLE_RATE,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::new(cursor, spec).expect("WAV writer creation failed");
    for &sample in samples {
        writer
            .write_sample(sample)
            .expect("WAV sample write failed");
    }
    writer.finalize().expect("WAV finalize failed");

    buf
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    fn validate_wav(data: &[u8]) -> hound::WavSpec {
        assert!(!data.is_empty(), "WAV data should not be empty");
        let reader = hound::WavReader::new(Cursor::new(data)).expect("Should parse as valid WAV");
        let spec = reader.spec();
        assert_eq!(spec.sample_rate, 44100);
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.bits_per_sample, 16);
        spec
    }

    #[test]
    fn test_ptt_on_valid_wav() {
        validate_wav(ptt_on_wav());
    }

    #[test]
    fn test_ptt_off_valid_wav() {
        validate_wav(ptt_off_wav());
    }

    #[test]
    fn test_error_valid_wav() {
        validate_wav(error_wav());
    }

    #[test]
    fn test_cues_are_cached() {
        let a = ptt_on_wav() as *const Vec<u8>;
        let b = ptt_on_wav() as *const Vec<u8>;
        assert!(std::ptr::eq(a, b), "OnceLock should return same pointer");
    }

    #[test]
    fn test_error_longer_than_ptt_on() {
        // error = 2 * 150ms = 300ms, ptt_on = 50ms
        assert!(
            error_wav().len() > ptt_on_wav().len(),
            "Error cue (300ms) should be longer than PTT on (50ms)"
        );
    }
}
