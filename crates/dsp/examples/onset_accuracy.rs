//! How well does the onset detector handle fast notes? Synthesizes runs of
//! sixteenth notes at several tempos and pitches and reports detection rate
//! and timing error.
//!
//! cargo run -p dsp --example onset_accuracy --release
use std::f32::consts::TAU;

use dsp::OnsetDetector;

const SR: u32 = 48_000;
const NOTES: usize = 32;

/// A plucked string: fast pick attack, harmonics that decay faster than the
/// fundamental. Low strings ring longer than high ones.
fn pluck(hz: f32, t: f32) -> f32 {
    let sustain = 2.5 * (110.0 / hz).sqrt(); // seconds; E2 ~2.9 s, A4 ~1.3 s
    let attack = (t / 0.002).min(1.0);
    (1..=8)
        .map(|h| {
            let h = h as f32;
            (-t * h / sustain).exp() * (TAU * hz * h * t).sin() / h
        })
        .sum::<f32>()
        * attack
        * 0.4
}

/// `ring`: false = each pick restarts the same string (the previous note
/// stops); true = notes overlap (different strings, sustain pedal).
fn signal(hz: f32, gap_secs: f32, ring: bool) -> (Vec<f32>, Vec<u64>) {
    let lead = 0.2;
    let len = ((lead + gap_secs * NOTES as f32 + 0.5) * SR as f32) as usize;
    let starts: Vec<u64> = (0..NOTES)
        .map(|k| ((lead + k as f32 * gap_secs) * SR as f32) as u64)
        .collect();
    let mut out = vec![0.0f32; len];
    for (k, &start) in starts.iter().enumerate() {
        let end = if ring {
            len
        } else {
            starts.get(k + 1).map_or(len, |&s| s as usize)
        };
        for (i, s) in out[start as usize..end].iter_mut().enumerate() {
            *s += pluck(hz, i as f32 / SR as f32);
        }
    }
    // Low-level noise floor (~ -70 dBFS).
    let mut seed = 1u32;
    for s in &mut out {
        seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        *s += ((seed >> 8) as f32 / (1u32 << 24) as f32 - 0.5) * 0.0006;
    }
    (out, starts)
}

fn main() {
    println!(
        "sixteenth notes, {NOTES} per run; hit% (detected within 30 ms), +extra onsets, mean |error|"
    );
    for ring in [false, true] {
        println!(
            "\n{}",
            if ring {
                "notes ring into each other"
            } else {
                "same string re-picked"
            }
        );
        print!("{:>5} {:>7}", "BPM", "gap ms");
        let pitches = [
            ("E2", 82.41),
            ("A2", 110.0),
            ("D3", 146.8),
            ("E4", 329.6),
            ("A4", 440.0),
        ];
        for (name, _) in pitches {
            print!(" | {name:>18}");
        }
        println!();
        for bpm in [60.0f32, 90.0, 120.0, 140.0, 150.0, 160.0, 180.0, 200.0] {
            let gap = 15.0 / bpm; // sixteenth = quarter / 4
            print!("{bpm:>5} {:>7.1}", gap * 1000.0);
            for (_, hz) in pitches {
                let (sig, starts) = signal(hz, gap, ring);
                let mut det = OnsetDetector::new(SR, 0);
                let mut onsets = Vec::new();
                for chunk in sig.chunks(480) {
                    det.push(chunk, &mut onsets);
                }
                let mut hits = 0;
                let mut err = 0.0;
                for &s in &starts {
                    if let Some(o) = onsets
                        .iter()
                        .map(|&o| (o as f64 - s as f64) / SR as f64 * 1000.0)
                        .filter(|d| d.abs() <= 30.0)
                        .min_by(|a, b| a.abs().total_cmp(&b.abs()))
                    {
                        hits += 1;
                        err += o.abs();
                    }
                }
                let rate = hits as f64 * 100.0 / NOTES as f64;
                let mean = if hits > 0 {
                    err / hits as f64
                } else {
                    f64::NAN
                };
                let extra = onsets.len().saturating_sub(hits);
                print!(" | {rate:>4.0}% +{extra:<2} {mean:>4.1}ms");
            }
            println!();
        }
    }
}
