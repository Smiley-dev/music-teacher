//! Latency calibration math: match metronome clicks to played onsets.
//!
//! All times are seconds on one shared clock (the audio clock). The result is
//! round-trip latency: output + input + the player's reaction offset.

use serde::Serialize;

/// Metronome tempo during calibration.
pub const CALIBRATION_BPM: f64 = 90.0;
/// Beats per bar (4/4).
pub const BEATS_PER_BAR: u32 = 4;
/// Number of bars played.
pub const BARS: u32 = 4;
/// Total clicks played (16).
pub const CLICK_COUNT: u32 = BEATS_PER_BAR * BARS;
/// An onset matches a click if it is within this fraction of a beat.
pub const MATCH_WINDOW_BEATS: f64 = 0.4;
/// Fewer kept matches than this is a failed calibration.
pub const MIN_MATCHES: usize = 8;
/// Outliers are offsets further than `OUTLIER_MAD_K` scaled MADs from the median...
pub const OUTLIER_MAD_K: f64 = 3.0;
/// ...but never reject anything within this many seconds of the median.
pub const MIN_OUTLIER_TOLERANCE_SECS: f64 = 0.015;
/// Scales MAD to a standard-deviation estimate for normal data.
const MAD_TO_SIGMA: f64 = 1.4826;

/// Duration of one beat at `bpm`, in seconds.
pub fn beat_secs(bpm: f64) -> f64 {
    60.0 / bpm
}

#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LatencyEstimate {
    /// Mean offset (onset - click) of the kept matches, in milliseconds.
    pub latency_ms: f64,
    /// Clicks with a matching onset that survived outlier rejection.
    pub matched: usize,
    /// Matches dropped as outliers.
    pub rejected: usize,
    /// Clicks played.
    pub total_clicks: usize,
}

#[derive(Debug, Clone, PartialEq, thiserror::Error)]
pub enum CalibrationError {
    #[error("only {matched} of {total_clicks} clicks matched a played note (need {required})")]
    TooFewMatches {
        matched: usize,
        required: usize,
        total_clicks: usize,
    },
}

/// For each click, the offset to its nearest not-yet-used onset within
/// `window` seconds, or `None` if there is none.
pub fn match_clicks(clicks: &[f64], onsets: &[f64], window: f64) -> Vec<Option<f64>> {
    let mut used = vec![false; onsets.len()];
    clicks
        .iter()
        .map(|&click| {
            let (index, offset) = onsets
                .iter()
                .enumerate()
                .filter(|(i, _)| !used[*i])
                .map(|(i, &onset)| (i, onset - click))
                .filter(|(_, offset)| offset.abs() <= window)
                .min_by(|a, b| a.1.abs().total_cmp(&b.1.abs()))?;
            used[index] = true;
            Some(offset)
        })
        .collect()
}

fn median(values: &mut [f64]) -> f64 {
    values.sort_by(f64::total_cmp);
    let n = values.len();
    if n % 2 == 1 {
        values[n / 2]
    } else {
        (values[n / 2 - 1] + values[n / 2]) / 2.0
    }
}

/// Estimate latency from click and onset times (seconds, same clock).
pub fn estimate_latency(
    clicks: &[f64],
    onsets: &[f64],
    beat_secs: f64,
) -> Result<LatencyEstimate, CalibrationError> {
    let offsets: Vec<f64> = match_clicks(clicks, onsets, beat_secs * MATCH_WINDOW_BEATS)
        .into_iter()
        .flatten()
        .collect();
    let too_few = |matched| CalibrationError::TooFewMatches {
        matched,
        required: MIN_MATCHES,
        total_clicks: clicks.len(),
    };
    if offsets.len() < MIN_MATCHES {
        return Err(too_few(offsets.len()));
    }

    let m = median(&mut offsets.clone());
    let mad = median(&mut offsets.iter().map(|o| (o - m).abs()).collect::<Vec<_>>());
    let tolerance = (OUTLIER_MAD_K * MAD_TO_SIGMA * mad).max(MIN_OUTLIER_TOLERANCE_SECS);
    let kept: Vec<f64> = offsets
        .iter()
        .copied()
        .filter(|o| (o - m).abs() <= tolerance)
        .collect();
    if kept.len() < MIN_MATCHES {
        return Err(too_few(kept.len()));
    }

    Ok(LatencyEstimate {
        latency_ms: kept.iter().sum::<f64>() / kept.len() as f64 * 1000.0,
        matched: kept.len(),
        rejected: offsets.len() - kept.len(),
        total_clicks: clicks.len(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    const BEAT: f64 = 60.0 / CALIBRATION_BPM;

    fn clicks() -> Vec<f64> {
        (0..CLICK_COUNT).map(|i| 1.0 + i as f64 * BEAT).collect()
    }

    #[test]
    fn sixteen_clicks_at_90_bpm() {
        assert_eq!(CLICK_COUNT, 16);
        assert!((beat_secs(CALIBRATION_BPM) - 0.6667).abs() < 1e-3);
    }

    #[test]
    fn constant_latency() {
        let clicks = clicks();
        let onsets: Vec<f64> = clicks.iter().map(|c| c + 0.045).collect();
        let r = estimate_latency(&clicks, &onsets, BEAT).unwrap();
        assert!((r.latency_ms - 45.0).abs() < 1e-6);
        assert_eq!((r.matched, r.rejected, r.total_clicks), (16, 0, 16));
    }

    #[test]
    fn jitter_averages_out() {
        let clicks = clicks();
        let jitter = [-8.0, 5.0, 3.0, -2.0, 7.0, -6.0, 1.0, 0.0];
        let onsets: Vec<f64> = clicks
            .iter()
            .enumerate()
            .map(|(i, c)| c + 0.060 + jitter[i % 8] / 1000.0)
            .collect();
        let r = estimate_latency(&clicks, &onsets, BEAT).unwrap();
        assert!((r.latency_ms - 60.0).abs() < 1.0, "{r:?}");
    }

    #[test]
    fn rejects_outliers() {
        let clicks = clicks();
        let mut onsets: Vec<f64> = clicks.iter().map(|c| c + 0.050).collect();
        onsets[3] = clicks[3] + 0.200; // late, but still inside the window
        onsets[9] = clicks[9] - 0.150; // early
        let r = estimate_latency(&clicks, &onsets, BEAT).unwrap();
        assert!((r.latency_ms - 50.0).abs() < 1e-6, "{r:?}");
        assert_eq!((r.matched, r.rejected), (14, 2));
    }

    #[test]
    fn skips_unmatched_clicks_and_extra_onsets() {
        let clicks = clicks();
        let mut onsets: Vec<f64> = clicks.iter().skip(4).map(|c| c + 0.030).collect();
        onsets.push(clicks[10] + 0.3); // a stray hit far from any click
        onsets.sort_by(f64::total_cmp);
        let r = estimate_latency(&clicks, &onsets, BEAT).unwrap();
        assert!((r.latency_ms - 30.0).abs() < 1e-6, "{r:?}");
        assert_eq!(r.matched, 12);
    }

    #[test]
    fn onset_is_used_only_once() {
        let m = match_clicks(&[1.0, 1.1], &[1.05], 0.2);
        assert_eq!(m.iter().flatten().count(), 1);
    }

    #[test]
    fn too_few_matches_fails() {
        let clicks = clicks();
        let onsets: Vec<f64> = clicks.iter().take(5).map(|c| c + 0.04).collect();
        assert_eq!(
            estimate_latency(&clicks, &onsets, BEAT),
            Err(CalibrationError::TooFewMatches {
                matched: 5,
                required: MIN_MATCHES,
                total_clicks: 16
            })
        );
    }

    #[test]
    fn too_few_after_outlier_rejection_fails() {
        let clicks = clicks();
        // 8 matches, but scattered so widely that several are outliers.
        let spread = [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.2, -0.2];
        let onsets: Vec<f64> = clicks
            .iter()
            .take(8)
            .zip(spread)
            .map(|(c, s)| c + 0.04 + s)
            .collect();
        assert!(matches!(
            estimate_latency(&clicks, &onsets, BEAT),
            Err(CalibrationError::TooFewMatches { matched: 6, .. })
        ));
    }

    #[test]
    fn early_playing_gives_negative_latency() {
        let clicks = clicks();
        let onsets: Vec<f64> = clicks.iter().map(|c| c - 0.010).collect();
        let r = estimate_latency(&clicks, &onsets, BEAT).unwrap();
        assert!((r.latency_ms + 10.0).abs() < 1e-6);
    }
}
