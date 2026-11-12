# Music Teacher

Desktop app (Tauri 2 + React + Rust) that listens to an instrument through an
audio interface and shows what is being played.

Before writing or changing code, read and follow:

- [docs/CODING_RULES.md](docs/CODING_RULES.md): how code is written here (mandatory).
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): modules, audio data flow, state and persistence.
- [docs/features/](docs/features/): behaviour of each section (Tuner, Practice, Settings).

Any change to the architecture (new module boundaries, threads, IPC shape,
persistence, algorithms) needs a new ADR in [docs/adr/](docs/adr/) and updated docs
in the same change.

## Commands

```sh
npm run tauri dev                     # run the app
cargo fmt --all                       # format Rust code
cargo test --workspace                # Rust unit tests (all DSP logic lives here)
cargo clippy --workspace --all-targets -- -D warnings
npm run build                         # type-check + build the frontend
```
