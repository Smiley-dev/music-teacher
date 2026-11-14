# Music Teacher

A desktop app that listens to your instrument through an audio interface (or
a microphone) and shows what you're playing. Nothing is recorded; audio is only
analysed live.

- **Tuner**: detected note and octave, frequency, cents sharp/flat with a
  gauge, live waveform and level meters.
- **Settings**: input device, input gain with clip indicator, and a
  click-along latency calibration.
- **Practice**: rhythm exercises (easy, medium, hard or custom) shown in
  standard notation, with a count-in and metronome at your tempo, and note
  exercises judged by pitch for guitar, bass, keyboard and strings: note
  reading, intervals, scales, chords and ear training. **Sight reading**:
  generated melodies in standard notation (choose scales, key signatures,
  intervals, note lengths, time signature), to hear and to play.
- **Theme**: light, dark or follow the system (bottom of the menu).

Built with Tauri 2, React 19, Tailwind v4 + shadcn/ui, and Rust (cpal for
audio, McLeod pitch detection, VexFlow for notation).

## Development

Prerequisites (Windows): Rust (stable, MSVC), Visual Studio Build Tools with
the C++ workload, Node.js 22.12+.

```sh
npm install
npm run tauri dev
```

Checks:

```sh
cargo fmt --all
cargo test --workspace
cargo clippy --workspace --all-targets -- -D warnings
npm run build
```

Without the UI:

```sh
cargo run -p audio-engine --example list_devices
cargo run -p audio-engine --example monitor_levels
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): modules, audio data flow, state
- [docs/CODING_RULES.md](docs/CODING_RULES.md): how code is written here
- [docs/adr/](docs/adr/README.md): architecture decisions
- [docs/features/](docs/features/): Tuner, Settings, Practice
