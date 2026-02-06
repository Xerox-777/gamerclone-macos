use std::io::Cursor;

const TARGET_SAMPLE_RATE: usize = 16000;

/// Encode raw f32 audio samples to 16kHz mono 16-bit WAV (Whisper-compatible).
pub fn encode_wav(
    samples: &[f32],
    source_sample_rate: u32,
    source_channels: u16,
) -> Result<Vec<u8>, String> {
    if samples.is_empty() {
        return Err("No audio samples to encode".to_string());
    }

    // Step 1: Convert to mono if stereo
    let mono: Vec<f32> = if source_channels > 1 {
        samples
            .chunks(source_channels as usize)
            .map(|chunk| chunk.iter().sum::<f32>() / chunk.len() as f32)
            .collect()
    } else {
        samples.to_vec()
    };

    // Step 2: Resample to 16kHz if needed
    let resampled = if source_sample_rate as usize != TARGET_SAMPLE_RATE {
        resample(&mono, source_sample_rate as usize, TARGET_SAMPLE_RATE)?
    } else {
        mono
    };

    // Step 3: Convert f32 -> i16
    let i16_samples: Vec<i16> = resampled
        .iter()
        .map(|&s| {
            let clamped = s.clamp(-1.0, 1.0);
            (clamped * i16::MAX as f32) as i16
        })
        .collect();

    // Step 4: Write WAV to bytes
    let mut buf = Cursor::new(Vec::new());
    let spec = hound::WavSpec {
        channels: 1,
        sample_rate: TARGET_SAMPLE_RATE as u32,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };

    let mut writer = hound::WavWriter::new(&mut buf, spec)
        .map_err(|e| format!("Failed to create WAV writer: {e}"))?;

    for sample in &i16_samples {
        writer
            .write_sample(*sample)
            .map_err(|e| format!("Failed to write WAV sample: {e}"))?;
    }

    writer
        .finalize()
        .map_err(|e| format!("Failed to finalize WAV: {e}"))?;

    Ok(buf.into_inner())
}

fn resample(input: &[f32], from_rate: usize, to_rate: usize) -> Result<Vec<f32>, String> {
    use rubato::{
        Resampler, SincFixedIn, SincInterpolationParameters, SincInterpolationType, WindowFunction,
    };

    let params = SincInterpolationParameters {
        sinc_len: 256,
        f_cutoff: 0.95,
        interpolation: SincInterpolationType::Linear,
        oversampling_factor: 256,
        window: WindowFunction::BlackmanHarris2,
    };

    let chunk_size = 1024;
    let mut resampler = SincFixedIn::<f32>::new(
        to_rate as f64 / from_rate as f64,
        2.0,
        params,
        chunk_size,
        1, // mono
    )
    .map_err(|e| format!("Failed to create resampler: {e}"))?;

    let mut output = Vec::new();
    let mut pos = 0;

    while pos < input.len() {
        let frames_needed = resampler.input_frames_next();
        let end = (pos + frames_needed).min(input.len());
        let mut chunk = input[pos..end].to_vec();

        // Pad last chunk if needed
        if chunk.len() < frames_needed {
            chunk.resize(frames_needed, 0.0);
        }

        let result = resampler
            .process(&[chunk], None)
            .map_err(|e| format!("Resampling failed: {e}"))?;

        if !result.is_empty() {
            output.extend_from_slice(&result[0]);
        }

        pos += frames_needed;
    }

    Ok(output)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn test_empty_samples_returns_error() {
        let result = encode_wav(&[], 16000, 1);
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("No audio samples"));
    }

    #[test]
    fn test_mono_16khz_passthrough() {
        // 1000 samples at 16kHz mono — no resampling needed
        let samples: Vec<f32> = (0..1000).map(|i| (i as f32 * 0.001).sin()).collect();
        let wav = encode_wav(&samples, 16000, 1).unwrap();

        let reader = hound::WavReader::new(Cursor::new(&wav)).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.sample_rate, 16000);
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.bits_per_sample, 16);
        assert_eq!(reader.len() as usize, 1000);
    }

    #[test]
    fn test_stereo_to_mono() {
        // 500 stereo frames = 1000 samples at 16kHz
        let samples: Vec<f32> = (0..1000).map(|i| (i as f32 * 0.001).sin()).collect();
        let wav = encode_wav(&samples, 16000, 2).unwrap();

        let reader = hound::WavReader::new(Cursor::new(&wav)).unwrap();
        let spec = reader.spec();
        assert_eq!(spec.channels, 1);
        assert_eq!(spec.sample_rate, 16000);
        assert_eq!(reader.len() as usize, 500); // 500 mono samples from 500 stereo frames
    }

    #[test]
    fn test_48khz_to_16khz_resample() {
        // 48000 samples at 48kHz = 1 second → should resample to ~16000 samples
        let samples: Vec<f32> = (0..48000)
            .map(|i| (i as f32 / 48000.0 * 440.0 * 2.0 * std::f32::consts::PI).sin())
            .collect();
        let wav = encode_wav(&samples, 48000, 1).unwrap();

        let reader = hound::WavReader::new(Cursor::new(&wav)).unwrap();
        assert_eq!(reader.spec().sample_rate, 16000);

        // Resampled count should be ~16000 (5% tolerance)
        let count = reader.len() as f64;
        assert!(
            (count - 16000.0).abs() / 16000.0 < 0.05,
            "got {count} samples"
        );
    }

    #[test]
    fn test_stereo_48khz() {
        // 48000 stereo frames = 96000 samples at 48kHz
        let samples: Vec<f32> = (0..96000).map(|i| (i as f32 * 0.001).sin()).collect();
        let wav = encode_wav(&samples, 48000, 2).unwrap();

        let reader = hound::WavReader::new(Cursor::new(&wav)).unwrap();
        assert_eq!(reader.spec().sample_rate, 16000);
        assert_eq!(reader.spec().channels, 1);
    }

    #[test]
    fn test_valid_wav_output() {
        // 1 second of 440Hz sine at 44100Hz
        let samples: Vec<f32> = (0..44100)
            .map(|i| (i as f32 / 44100.0 * 440.0 * 2.0 * std::f32::consts::PI).sin())
            .collect();
        let wav = encode_wav(&samples, 44100, 1).unwrap();

        // Must be parseable by hound
        let reader = hound::WavReader::new(Cursor::new(&wav));
        assert!(reader.is_ok());
    }

    #[test]
    fn test_clamps_out_of_range() {
        let samples = vec![2.0f32, -3.0, 1.5, -1.5, 0.5];
        let wav = encode_wav(&samples, 16000, 1).unwrap();

        let mut reader = hound::WavReader::new(Cursor::new(&wav)).unwrap();
        let output: Vec<i16> = reader.samples::<i16>().map(|s| s.unwrap()).collect();

        // Verify we got the expected number of samples
        assert_eq!(output.len(), 5);
        // First sample (2.0 clamped to 1.0) should be near i16::MAX
        assert!(output[0] > 30000);
        // Second sample (-3.0 clamped to -1.0) should be near i16::MIN
        assert!(output[1] < -30000);
    }
}
