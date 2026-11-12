//! Run with: cargo run -p audio-engine --example list_devices
fn main() {
    match audio_engine::list_input_devices() {
        Ok(devices) if devices.is_empty() => println!("No input devices found."),
        Ok(devices) => {
            for d in devices {
                println!(
                    "[{}] {}{} — {:?} ch, {:?} Hz, {:?}",
                    d.id.host,
                    d.id.name,
                    if d.is_default { " (default)" } else { "" },
                    d.channels,
                    d.sample_rate,
                    d.sample_format
                );
            }
        }
        Err(e) => eprintln!("Error: {e} ({:?})", e.kind()),
    }
}
