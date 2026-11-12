//! Print live input peak levels from a device for a few seconds (no UI needed).
//!
//! cargo run -p audio-engine --example monitor_levels                 # default device
//! cargo run -p audio-engine --example monitor_levels -- "Device name"
use std::time::Duration;

use audio_engine::{DeviceId, InputStream};

fn main() {
    let devices = audio_engine::list_input_devices().expect("list devices");
    let wanted = std::env::args().nth(1);
    let Some(device) = devices.iter().find(|d| match &wanted {
        Some(name) => &d.id.name == name,
        None => d.is_default,
    }) else {
        eprintln!("Device not found. Available:");
        for d in &devices {
            eprintln!("  {}", d.id.name);
        }
        return;
    };

    let id: &DeviceId = &device.id;
    let mut input = InputStream::open(id).expect("open input");
    println!("Monitoring {} — {:?}", id.name, input.info());
    let channels = input.info().channels as usize;

    let mut samples = Vec::new();
    for _ in 0..30 {
        std::thread::sleep(Duration::from_millis(100));
        input.read_samples(&mut samples);
        let line: Vec<String> = (0..channels)
            .map(|ch| {
                let peak = samples
                    .iter()
                    .skip(ch)
                    .step_by(channels)
                    .fold(0.0f32, |m, s| m.max(s.abs()));
                format!("{:>6.1} dBFS", 20.0 * peak.max(1e-9).log10())
            })
            .collect();
        println!("{}", line.join(" | "));
    }
}
