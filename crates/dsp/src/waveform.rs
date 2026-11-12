//! Keeps recent samples and reduces them to something cheap to draw.

use std::collections::VecDeque;

/// The most recent `capacity` samples of one channel.
#[derive(Debug, Clone)]
pub struct SampleHistory {
    samples: VecDeque<f32>,
    capacity: usize,
}

impl SampleHistory {
    pub fn new(capacity: usize) -> Self {
        Self {
            samples: VecDeque::with_capacity(capacity),
            capacity,
        }
    }

    pub fn push(&mut self, samples: impl IntoIterator<Item = f32>) {
        for s in samples {
            if self.samples.len() == self.capacity {
                self.samples.pop_front();
            }
            self.samples.push_back(s);
        }
    }

    /// Reduce the history to `points` buckets and write `[min, max]` per
    /// bucket into `out` (so `out.len() == 2 * points` once the history is
    /// full). Missing history at the start is treated as silence.
    pub fn min_max(&self, points: usize, out: &mut Vec<f32>) {
        out.clear();
        if points == 0 {
            return;
        }
        let missing = self.capacity - self.samples.len();
        for p in 0..points {
            let start = p * self.capacity / points;
            let end = ((p + 1) * self.capacity / points).max(start + 1);
            let (mut lo, mut hi) = (0.0f32, 0.0f32);
            for i in start..end {
                if let Some(&s) = i.checked_sub(missing).and_then(|j| self.samples.get(j)) {
                    lo = lo.min(s);
                    hi = hi.max(s);
                }
            }
            out.push(lo);
            out.push(hi);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_only_the_latest_samples() {
        let mut h = SampleHistory::new(4);
        h.push([1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
        let mut out = Vec::new();
        h.min_max(4, &mut out);
        assert_eq!(out, vec![0.0, 3.0, 0.0, 4.0, 0.0, 5.0, 0.0, 6.0]);
    }

    #[test]
    fn buckets_hold_min_and_max() {
        let mut h = SampleHistory::new(8);
        h.push([0.1, -0.5, 0.2, 0.9, -0.3, -0.1, 0.4, 0.0]);
        let mut out = Vec::new();
        h.min_max(2, &mut out);
        assert_eq!(out, vec![-0.5, 0.9, -0.3, 0.4]);
    }

    #[test]
    fn partially_filled_history_is_silent_at_start() {
        let mut h = SampleHistory::new(4);
        h.push([0.5]);
        let mut out = Vec::new();
        h.min_max(4, &mut out);
        assert_eq!(out, vec![0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.5]);
    }
}
