//! Level meter ballistics: how a channel's peak level is displayed.

use serde::Serialize;

/// Lowest level reported, in dBFS (JSON has no -infinity).
pub const FLOOR_DB: f32 = -120.0;
/// Peaks at or above this count as "signal" (noise floor is ~-100 dBFS).
pub const SIGNAL_THRESHOLD_DB: f32 = -60.0;
/// Raw (pre-gain) peaks at or above this mean the interface is clipping.
pub const RAW_CLIP_DB: f32 = -0.5;
/// Post-gain peaks at or above this (0 dBFS) mean the gain is too high.
pub const GAIN_CLIP_DB: f32 = 0.0;
/// How fast the bar falls back, in dB per second.
pub const RELEASE_DB_PER_SEC: f32 = 24.0;
/// How long the peak-hold marker stays, in seconds.
pub const PEAK_HOLD_SECS: f64 = 1.5;
/// How long the clip indicator stays lit, in seconds.
pub const CLIP_HOLD_SECS: f64 = 2.0;
/// How long "signal" stays on after the level drops (avoids flicker), in seconds.
pub const SIGNAL_HOLD_SECS: f64 = 0.4;

/// Linear amplitude (1.0 = full scale) to dBFS, floored at `FLOOR_DB`.
pub fn to_db(linear: f32) -> f32 {
    if linear > 0.0 && linear.is_finite() {
        (20.0 * linear.log10()).max(FLOOR_DB)
    } else {
        FLOOR_DB
    }
}

/// Decibels to a linear gain factor.
pub fn db_to_gain(db: f32) -> f32 {
    10f32.powf(db / 20.0)
}

/// What the UI draws for one channel.
#[derive(Debug, Clone, Copy, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MeterReading {
    /// Bar level in dBFS (instant attack, linear release).
    pub db: f32,
    /// Peak-hold marker in dBFS.
    pub hold_db: f32,
    pub has_signal: bool,
    pub clipping: bool,
}

#[derive(Debug, Clone)]
pub struct ChannelMeter {
    db: f32,
    hold_db: f32,
    hold_until: f64,
    clip_until: f64,
    signal_until: f64,
    last_update: Option<f64>,
}

impl Default for ChannelMeter {
    fn default() -> Self {
        Self {
            db: FLOOR_DB,
            hold_db: FLOOR_DB,
            hold_until: 0.0,
            clip_until: f64::NEG_INFINITY,
            signal_until: f64::NEG_INFINITY,
            last_update: None,
        }
    }
}

impl ChannelMeter {
    /// `peak` is the post-gain peak since the last update, `raw_peak` the
    /// pre-gain one (both linear); `now` is in seconds.
    pub fn update(&mut self, peak: f32, raw_peak: f32, now: f64) -> MeterReading {
        let dt = self.last_update.map_or(0.0, |t| (now - t).max(0.0)) as f32;
        self.last_update = Some(now);

        let db = to_db(peak);
        self.db = db.max(self.db - RELEASE_DB_PER_SEC * dt).max(FLOOR_DB);
        if db >= self.hold_db || now > self.hold_until {
            self.hold_db = db;
            self.hold_until = now + PEAK_HOLD_SECS;
        }
        if to_db(raw_peak) >= RAW_CLIP_DB || db >= GAIN_CLIP_DB {
            self.clip_until = now + CLIP_HOLD_SECS;
        }
        if db >= SIGNAL_THRESHOLD_DB {
            self.signal_until = now + SIGNAL_HOLD_SECS;
        }

        MeterReading {
            db: self.db,
            hold_db: self.hold_db,
            has_signal: now < self.signal_until,
            clipping: now < self.clip_until,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn db_conversions() {
        assert!((to_db(1.0)).abs() < 1e-4);
        assert!((to_db(0.5) + 6.02).abs() < 0.01);
        assert_eq!(to_db(0.0), FLOOR_DB);
        assert_eq!(to_db(f32::NAN), FLOOR_DB);
        assert!((db_to_gain(6.0) - 1.995).abs() < 0.01);
        assert!((db_to_gain(0.0) - 1.0).abs() < 1e-6);
    }

    #[test]
    fn attack_is_instant_release_is_gradual() {
        let mut m = ChannelMeter::default();
        let r = m.update(0.5, 0.5, 0.0);
        assert!((r.db + 6.02).abs() < 0.01);
        let r = m.update(0.0, 0.0, 0.5);
        assert!((r.db - (-6.02 - 12.0)).abs() < 0.1, "{r:?}");
    }

    #[test]
    fn signal_flag_with_hold() {
        let mut m = ChannelMeter::default();
        assert!(!m.update(0.0001, 0.0001, 0.0).has_signal); // -80 dBFS
        assert!(m.update(0.01, 0.01, 0.1).has_signal); // -40 dBFS
        assert!(m.update(0.0, 0.0, 0.3).has_signal); // still held
        assert!(!m.update(0.0, 0.0, 0.6).has_signal);
    }

    #[test]
    fn clips_on_raw_or_post_gain() {
        let mut m = ChannelMeter::default();
        assert!(!m.update(0.5, 0.5, 0.0).clipping);
        assert!(m.update(0.5, 0.99, 0.1).clipping, "raw near full scale");
        let mut m = ChannelMeter::default();
        assert!(m.update(1.2, 0.3, 0.0).clipping, "gain pushed it over");
        assert!(!m.update(0.1, 0.1, 2.5).clipping, "clip hold expired");
    }
}
