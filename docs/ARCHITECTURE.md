# Architecture

Music Teacher is a Tauri 2 desktop app. Audio capture, playback and all
analysis run natively in Rust; the React frontend only renders what the engine
reports and sends user commands. Nothing is recorded or saved except settings.

## Module map

```
crates/
  dsp/                 Pure signal analysis. No devices, no threads, no Tauri.
    note.rs            Frequency → note/octave/cents (A4_HZ constant)
    pitch.rs           PitchTracker: McLeod pitch detection on a sliding window
    stabilizer.rs      NoteStabilizer: note confirmation, smoothing, hold
    meter.rs           ChannelMeter: level ballistics, peak hold, signal/clip flags
    waveform.rs        Min/max reduction of samples for drawing
    onset.rs           OnsetDetector: spectral-flux note onsets, ~1 ms timing (ADR 0010)
    calibration.rs     Latency estimate from click/onset times (+ constants)
  rhythm/              Pure rhythm logic (ADR 0006). No devices, threads or Tauri.
    model.rs           NoteValue, Symbol, TimeSignature, Difficulty presets, Exercise
    generate.rs        Seeded exercise generator (exact bar filling, readability rules)
    judge.rs           TimingJudge: onsets vs notes, timing report (ADR 0008)
    written.rs         layout(): user-written symbol sequence into bars (ADR 0009)
  theory/              Pure music theory + pitch exercises (ADR 0011). Same rules.
    pitch.rs           Pitch: letter/accidental/octave, MIDI, correct transposition
    instrument.rs      Clef, Instrument presets (clef, transposition, range)
    task.rs            PitchTask/TaskNote/Prompt/Matching: one question of an exercise
    judge.rs           NoteJudge: pitch readings vs the task's notes, in order
    exercise.rs        PitchExercise(+Kind), seeded generate(), TheoryError
    notes.rs           Note reading generator
  audio-engine/        Device I/O with cpal. No analysis, no Tauri.
    lib.rs             Device listing, DeviceId, AudioError (+ error kind)
    input.rs           InputStream: samples + capture timestamps via ring buffers
    output.rs          ClickPlayer/ClickTrack: sample-accurate clicks with accents
                       + playback timestamps, optional tones (exercise playback),
                       origin() = playback instant of the first output frame
src-tauri/src/
  lib.rs               Tauri builder: plugins, state, command registration
  commands.rs          Thin #[tauri::command] wrappers around the engine/settings
  engine/mod.rs        AudioEngine service: one instance, owns all audio state
  engine/analysis.rs   Per-frame analysis pipeline (gain, meters, waveform, pitch)
  engine/calibration.rs Calibration session (clicks ↔ onsets on the audio clock)
  engine/practice.rs   Rhythm practice session (count-in, metronome, position,
                       onset detection + timing judgement)
  engine/pitch.rs      Pitch practice session (task after task, NoteJudge on the
                       raw pitch, reference playback, score)
  engine/events.rs     EngineEvent / EngineStatus types sent to the UI
  settings.rs          Settings model + JSON persistence
src/
  main.tsx             Entry; theme; mounts <AudioEngineProvider>
  App.tsx              App shell: main menu + active section
  sections.ts          Registry of menu sections (SECTIONS)
  lib/engine.ts        Typed IPC: command wrappers + types mirroring Rust
  providers/
    audio-engine-provider.tsx  Subscribes once; holds engine state, latest frame,
                               rhythm and pitch practice state in four contexts
    audio-engine-context.ts    useEngine / useFrame / usePractice / usePitchPractice /
                               useSettings / useLatency
  features/tuner/      Tuner screen, note display + cents gauge
  features/settings/   Device and gain cards (+ shared calibration card); useInputDevices
  features/practice/   Practice tabs (PRACTICE_SECTIONS)
    rhythm/            Rhythm practice: settings, VexFlow score, transport
    pitch/             Shared by pitch exercises: session card, VexFlow staff,
                       instrument select, usePitchSettings
    notes/             Note reading tab
  components/          Shared: level meter, waveform canvas, engine status banner,
                       calibration panel/card/dialog (Settings + Practice)
  components/ui/       shadcn/ui primitives (generated, do not hand-edit)
```

## Audio data flow

```mermaid
flowchart LR
  subgraph Device threads
    IN[cpal input callback] -->|samples, f32 interleaved| RB1[(ring buffer)]
    IN -->|frame index + capture instant| RB2[(timestamp ring)]
    CP[ClickPlayer output callback] -->|click playback instants| RB3[(click ring)]
  end
  subgraph Engine thread ~30 Hz
    RB1 --> G[gain] --> M[ChannelMeter] & W[waveform] & P[PitchTracker → NoteStabilizer]
    G --> O[OnsetDetector]
    RB2 --> T[frame → audio-clock time]
    O --> T --> C[calibration math]
    RB3 --> C
    P --> J[NoteJudge: pitch exercises]
  end
  M & W & P & C & J -->|EngineEvent over Tauri Channel| UI[AudioEngineProvider → screens]
  UI -->|commands: set device / gain / calibrate| ENGINE[AudioEngine]
```

1. The cpal input callback (real-time thread) converts samples to `f32`, pushes
   them into a lock-free `rtrb` ring buffer and records `(first frame index,
   capture StreamInstant)` per buffer. It never allocates, locks, logs or blocks.
2. The engine thread wakes every ~33 ms, drains both rings, applies the input
   gain, and runs the analysis pipeline per channel.
3. Results go to every subscribed webview as one `EngineEvent::Frame` (meters,
   waveform, note), plus `Status`, `Calibration`, `Practice`, `PitchPractice`
   and `Settings` events when those change (`Practice` every tick while a
   rhythm session runs, `PracticeJudged` whenever notes are judged,
   `PitchPractice` when a pitch task, its progress or the heard note changes).
4. `AudioEngineProvider` keeps rarely changing state (status, settings,
   calibration), the latest frame, rhythm practice and pitch practice in
   separate React contexts, so only live views (meters, waveform, note)
   re-render 30 times per second. Switching sections never starts or stops
   audio (leaving a pitch exercise's tab stops that exercise).

## Threads

| Thread | Owner | Work |
| --- | --- | --- |
| cpal input callback | cpal | Copy samples + timestamps into rings (real-time) |
| `audio-input` | `InputStream` | Owns the cpal input stream (streams are not `Send` everywhere) |
| cpal output callback | cpal | Render clicks, record their playback instants (real-time) |
| `click-output` | `ClickPlayer` | Owns the cpal output stream during calibration, rhythm practice or a pitch exercise playing its notes |
| `audio-engine` | `AudioEngine` | Commands, reconnects, analysis, calibration, events |
| main / webview | Tauri | Commands from the UI and rendering |

## State and persistence

- **Engine state** (status, device, stream info, calibration, rhythm and pitch
  practice sessions) lives in `AudioEngine` on the Rust side.
  `subscribe_engine(channel)` registers the webview and returns an
  `EngineSnapshot` (status, settings, calibration, practice and pitch practice
  state, subscription id); live updates then arrive through that `Channel`. Events
  that arrive before the snapshot are replayed on top of it. The provider
  calls `unsubscribe_engine(id)` on unmount; channels that fail to receive
  (reloaded or closed webview) are dropped automatically.
- **Settings** (`Settings`: input device, gain in dB, latency calibration,
  `practice.rhythm` tempo/difficulty/custom/time signature/bars,
  `practice.pitch` instrument and pitch exercise options) are
  owned by `settings.rs`, loaded at startup and written atomically as JSON to
  the app config folder (`%APPDATA%\com.musicteacher.app\settings.json` on
  Windows) whenever they change. See ADR 0004.
- **UI-only state** (selected section) stays in React.
- Practice (and anything else) reads the latency through `useLatency()` in the
  UI or `AudioEngine::latency()` in Rust.

## Error handling

`audio_engine::AudioError::kind()` classifies failures as `PermissionDenied`
(WASAPI `E_ACCESSDENIED`), `NoDevices`, `DeviceLost` or `Other`. The engine
reports them in `EngineStatus.error` (state `error` if the device never opened,
`reconnecting` if a running stream died) and keeps retrying every 750 ms, so
plugging a device back in (or granting microphone permission) recovers without
user action. `EngineStatusBanner` turns each case into a message with the next
step for the user.

## Decisions

See [adr/README.md](adr/README.md) for the index of architecture decisions.
