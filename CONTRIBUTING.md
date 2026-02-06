# Contributing to GamerClone

## Development Setup

See [README.md](README.md) for prerequisites and setup instructions.

## Code Standards

### Error Handling

- **Tauri commands** return `Result<T, String>` (Tauri's IPC requirement).
- **Internal code** uses `anyhow::Result` for convenience, `thiserror` for typed errors.
- **Never use `.expect()`** on fallible operations in application code. Propagate errors with `?` or handle them gracefully.
- **Startup failures** must propagate through `Result` to Tauri's `.setup()` hook, which shows an error dialog and exits cleanly.
- The one exception: `std::thread::Builder::spawn().expect(...)` is acceptable — if the OS can't spawn a thread, there's no recovery.

### Mutex Usage (`parking_lot`)

We use `parking_lot::Mutex` instead of `std::sync::Mutex`:

```rust
// Good — parking_lot::Mutex::lock() returns the guard directly
use parking_lot::Mutex;
let value = self.data.lock();

// Bad — std::sync::Mutex requires unwrap and can poison
use std::sync::Mutex;
let value = self.data.lock().unwrap(); // panics on poison
```

- `parking_lot::Mutex` never poisons, eliminating an entire class of panics.
- Keep `Arc` from `std::sync` — only `Mutex` comes from `parking_lot`.
- `RwLock` in `frame_buffer.rs` stays as `std::sync::RwLock` (used on the capture thread).

### Tauri Command Conventions

```rust
#[tauri::command]
pub fn my_command(state: State<'_, AppState>) -> Result<MyResponse, String> {
    // Access state fields directly
    let value = state.some_field.lock().clone();
    Ok(MyResponse { value })
}

// Async commands for I/O operations
#[tauri::command]
pub async fn my_async_command(
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<MyResponse, String> {
    // ...
}
```

- Commands that only read state can be sync.
- Commands that perform I/O (API calls, file operations) should be async.
- Always validate inputs before processing.

### Service Abstraction

All AI service calls go through the `CoachingService` trait. Never call OpenAI (or any external API) directly from Tauri commands or frontend code. This enables swapping `LocalCoachingService` (direct API calls) for `RemoteCoachingService` (calls to api.gamerclone.com) without changing any other code.

### Testing

- Use `MockCoachingService` (in `services/mock.rs`) for pipeline tests that don't need real API calls.
- Unit tests should be fast and have no external dependencies.
- RAG integration tests that require the fastembed model download should be marked `#[ignore]`.
- Run all checks before pushing:

```bash
cargo fmt --manifest-path src-tauri/Cargo.toml --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --no-default-features --features local -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --no-default-features --features local
pnpm exec tsc --noEmit
```

## Project Structure

See [README.md](README.md#project-structure) for the full file map.
