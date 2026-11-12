//! Print live input levels from a device for a few seconds (no UI needed).
//!
//! cargo run -p audio-engine --example monitor_levels                 # default device
//! cargo run -p audio-engine --example monitor_levels -- "Device name"
use std::time::Duration;

fn main() {
    let devices = audio_engine::list_input_devices().expect("list devices");
    let wanted = std::env::args().nth(1);
    let Some(device) = devices.iter().find(|d| match &wanted {
        Some(name) => &d.name == name,
        None => d.is_default,
    }) else {
        eprintln!("Device not found. Available:");
        for d in &devices {
            eprintln!("  {}", d.name);
        }
        return;
    };

    let monitor = audio_engine::InputMonitor::start(&device.host, &device.name).expect("start");
    println!("Monitoring {} — {:?}", device.name, monitor.info());

    let mut peaks = Vec::new();
    for _ in 0..30 {
        std::thread::sleep(Duration::from_millis(100));
        monitor.take_peaks(&mut peaks);
        let line: Vec<String> = peaks
            .iter()
            .map(|p| format!("{:>6.1} dBFS", 20.0 * p.max(1e-9).log10()))
            .collect();
        println!("{}", line.join(" | "));
    }
}
