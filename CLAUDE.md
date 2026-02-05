# GamerClone — Claude Code INITIAL

> **Read GAMERCLONE-POC-PRD.md first.** It contains the complete product requirements, architecture diagrams, technology decisions, and implementation roadmap. This file is your quick-reference operating manual.

---

## What We're Building

A **Tauri 2.0** desktop app (Windows only) that acts as a real-time AI voice coach for PC gamers. The user selects a game window, presses push-to-talk, asks a question, and hears a spoken coaching response — all while the game stays in focus. No overlay. No alt-tabbing.

**Core Pipeline**: PTT → record audio → Whisper STT → RAG search → GPT-4o Vision (with screenshots) → TTS → play audio

**Phase**: POC (Proof of Concept) — everything runs locally on the developer's machine. No auth, no server, no payments. Just prove the voice loop works.

---

## Tech Stack (Locked — Do Not Change)

| Component | Technology | Why |
|-----------|-----------|-----|
| Desktop framework | **Tauri 2.0** | 5 MB installer, 30 MB RAM, fullscreen DirectX capture works |
| Backend language | **Rust** | Tauri's native backend, direct Win32 access |
| Frontend | **React 18 + TypeScript + Vite** | Familiar, Tauri has first-class Vite support |
| Styling | **Tailwind CSS** | Fast utility styling |
| State management | **Zustand** | Minimal boilerplate |
| Screen capture | **windows-capture 2.0** | WGC + DXGI Desktop Duplication for fullscreen games |
| Global hotkeys | **rdev** | Low-level Windows hooks, works in fullscreen, supports mouse buttons |
| Audio recording | **cpal** | WASAPI shared mode, cross-platform |
| Audio playback | **rodio** | MP3/WAV decode + playback |
| WAV encoding | **hound** | Simple WAV writer |
| Audio resampling | **rubato** | 48kHz → 16kHz for Whisper |
| JPEG compression | **turbojpeg** | SIMD-optimized, 3–5ms per 1080p frame |
| Image resize | **image** | Resize to 1280x720 before compression |
| OpenAI API | **async-openai** | Whisper, GPT-4o Vision, TTS — typed, async, retry built-in |
| SQLite | **rusqlite** | Local database for RAG |
| Vector search | **sqlite-vec** | KNN extension for rusqlite |
| Embeddings | **fastembed** | Local AllMiniLM-L6-v2 (384 dims), no Python needed |
| Serialization | **serde + serde_json** | Standard Rust JSON handling |
| HTTP | **reqwest** | Bundled with async-openai |
| Encoding | **base64** | Screenshots → base64 for OpenAI Vision API |
| Logging | **tracing + tracing-subscriber** | Structured logging with timing |
| Settings | **tauri-plugin-store** | Persistent JSON key-value store |
| Single instance | **tauri-plugin-single-instance** | Prevent duplicate app launches |
| Package manager | **pnpm** | Faster than npm for frontend |

---

## Project Initialization

```bash
# 1. Create Tauri project
pnpm create tauri-app gamerclone -- --template react-ts
cd gamerclone

# 2. Add Tauri plugins
cd src-tauri
cargo add tauri-plugin-store tauri-plugin-single-instance

# 3. Add Rust dependencies (in src-tauri/Cargo.toml)
# See Cargo.toml section below

# 4. Frontend dependencies
cd ..
pnpm add zustand lucide-react
pnpm add -D tailwindcss @tailwindcss/vite

# 5. Environment setup
cp .env.example .env
# Edit .env: add OPENAI_API_KEY=sk-proj-...

# 6. Run
cargo tauri dev
```

### Cargo.toml Dependencies

```toml
[dependencies]
tauri = { version = "2", features = ["tray-icon"] }
tauri-plugin-store = "2"
tauri-plugin-single-instance = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
tokio = { version = "1", features = ["full"] }
async-trait = "0.1"

# Screen capture
windows-capture = "2"

# Audio
cpal = "0.15"
rodio = "0.19"
hound = "3.5"
rubato = "0.15"

# Image processing
turbojpeg = "1"
image = "0.25"
base64 = "0.22"

# Global hotkeys
rdev = "0.5"

# AI
async-openai = "0.30"

# RAG
rusqlite = { version = "0.32", features = ["bundled"] }
# sqlite-vec loaded as extension at runtime
fastembed = "4"

# Utilities
uuid = { version = "1", features = ["v4"] }
chrono = "0.4"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
dotenv = "0.15"
anyhow = "1"
thiserror = "2"

[features]
default = ["local"]
local = []    # POC: direct OpenAI calls
remote = []   # MVP: calls GamerClone.com API
```

---

## Critical Architecture Rules

### 1. Service Abstraction Layer — The Most Important Pattern

Every AI service call MUST go through the `CoachingService` trait:

```rust
#[async_trait]
pub trait CoachingService: Send + Sync {
    async fn transcribe(&self, wav_bytes: Vec<u8>) -> Result<String>;
    async fn rag_search(&self, query: &str, game_id: &str, limit: usize) -> Result<Vec<KnowledgeChunk>>;
    async fn analyze_gameplay(&self, transcript: &str, screenshots: Vec<Screenshot>, profile: &GameProfile, rag_context: Vec<KnowledgeChunk>) -> Result<String>;
    async fn text_to_speech(&self, text: &str, voice: &str) -> Result<Vec<u8>>;
    async fn get_game_profiles(&self) -> Result<Vec<GameProfile>>;
    async fn get_system_prompt(&self, game_id: &str) -> Result<String>;
}
```

**POC**: `LocalCoachingService` implements this with direct async-openai calls.
**MVP** (future): `RemoteCoachingService` implements this with HTTPS calls to api.gamerclone.com.

The frontend, capture, audio, and hotkey modules NEVER call OpenAI directly. They go through the pipeline orchestrator, which uses `dyn CoachingService`.

### 2. Thread Model

| Thread | Module | Created By |
|--------|--------|-----------|
| Main (Tokio) | IPC handlers, async API calls | Tauri runtime |
| Capture | windows-capture frame loop | `tokio::task::spawn_blocking` |
| Hotkey | rdev::listen() + Win32 message pump | `std::thread::spawn` |
| Audio In | cpal input stream callback | cpal internally |
| Audio Out | rodio output stream | rodio internally |

**Rules**:
- Never block the Tokio runtime with CPU work — use `spawn_blocking`
- Capture thread runs at Below Normal priority
- Hotkey thread MUST have its own Windows message pump (rdev handles this)
- Cross-thread communication: use `Arc<AtomicBool>` for flags, `Arc<Mutex<>>` for shared data, `mpsc::channel` for streaming data

### 3. Security

- `OPENAI_API_KEY` in `.env` file only — never hardcoded, never in Tauri config
- Screenshots exist only in memory — never written to disk
- Audio recordings exist only in memory — never written to disk
- No telemetry, no analytics, no phone-home in POC

### 4. Error Handling

- All Tauri commands return `Result<T, String>` (Tauri requirement)
- Internal code uses `anyhow::Result` for convenience, `thiserror` for typed errors
- Every API call wrapped in retry logic (async-openai has built-in exponential backoff)
- User-facing errors communicated via audio cues + status log — never silent failures
- If Vision API fails → play error sound + show text in status log
- If TTS fails → display text response in frontend (graceful fallback)

### 5. Performance

- JPEG quality: **75** — balance of size and Vision API comprehension
- Resize screenshots to **1280×720** before compression
- Vision API `detail`: **"low"** (85 tokens per image — fast and cheap)
- `max_tokens`: **200** for GPT-4o (keep responses short for voice)
- Screenshot buffer: **30 frames** max
- Capture interval: **2 seconds**
- Max PTT recording: **30 seconds**
- Target total latency: **< 5 seconds** PTT release → audio playback start

---

## Module Ownership + File Map

```
src-tauri/src/
├── main.rs                     # Tauri builder, state init, plugin registration
├── lib.rs                      # pub mod declarations
├── state.rs                    # AppState struct (owns all managers)
│
├── capture/
│   ├── mod.rs                  # pub use
│   ├── manager.rs              # CaptureManager: start/stop/get_frames
│   ├── window_list.rs          # enumerate_windows() → Vec<WindowInfo>
│   └── frame_buffer.rs         # FrameBuffer: VecDeque<CapturedFrame> + RwLock
│
├── audio/
│   ├── mod.rs
│   ├── recorder.rs             # AudioRecorder: start/stop/get_wav_bytes
│   ├── player.rs               # AudioPlayer: play_bytes, play_cue
│   └── devices.rs              # list_input_devices, list_output_devices
│
├── hotkeys/
│   ├── mod.rs
│   └── manager.rs              # HotkeyManager: register PTT, key-down/up events
│
├── services/
│   ├── mod.rs                  # CoachingService trait definition
│   ├── types.rs                # Screenshot, KnowledgeChunk, GameProfile, ServiceError
│   ├── local.rs                # LocalCoachingService (POC implementation)
│   └── remote.rs               # RemoteCoachingService (MVP stub — not implemented)
│
├── pipeline/
│   ├── mod.rs
│   └── orchestrator.rs         # VoicePipeline: process_query() orchestrates the full loop
│
├── rag/
│   ├── mod.rs
│   ├── database.rs             # init_db, seed_data, search
│   ├── embeddings.rs           # EmbeddingEngine: embed_text wrapper
│   └── seed_data/              # JSON files: minecraft.json, valorant.json, etc.
│
├── profiles/
│   ├── mod.rs
│   └── definitions.rs          # PROFILES HashMap, system prompt templates
│
└── commands/
    ├── mod.rs                  # All command registrations
    ├── capture.rs              # list_windows, select_window, start_capture, stop_capture
    ├── audio.rs                # list_audio_devices, set_input_device, set_output_device, test_mic
    ├── hotkeys.rs              # get_ptt_key, set_ptt_key
    ├── voice.rs                # process_voice_query (triggers full pipeline)
    ├── profiles.rs             # list_game_profiles, set_active_profile
    └── settings.rs             # get_all_settings, save_settings
```

```
src/
├── main.tsx                    # React entry point
├── App.tsx                     # Layout: sidebar + main panel
├── index.css                   # @tailwind directives
├── components/
│   ├── WindowPicker.tsx        # Dropdown: select game window
│   ├── GameSelector.tsx        # Dropdown: select game profile
│   ├── PTTIndicator.tsx        # Status circle: ready (green) / listening (yellow) / thinking (blue)
│   ├── StatusLog.tsx           # Scrolling log of queries + responses
│   ├── SettingsPanel.tsx       # Audio devices, PTT key config, voice selection
│   └── SetupWizard.tsx         # First-launch onboarding flow
├── hooks/
│   ├── useVoiceQuery.ts        # PTT event listeners, query state machine
│   ├── useCapture.ts           # Window list, capture status
│   └── useSettings.ts          # Read/write via tauri-plugin-store
├── stores/
│   └── appStore.ts             # Zustand: UI state (activePanel, captureStatus, pttState, etc.)
├── lib/
│   └── tauri.ts                # Typed invoke() wrappers for all commands
└── types/
    └── index.ts                # TypeScript interfaces matching Rust types
```

---

## Build Commands

```bash
# Development (hot reload)
cargo tauri dev

# Production build (NSIS .exe installer)
cargo tauri build

# Output location
# src-tauri/target/release/bundle/nsis/GamerClone_0.1.0_x64-setup.exe

# Run tests (when added)
cd src-tauri && cargo test
pnpm test
```

---

## Environment Variables

```env
# .env (project root — loaded by dotenv in main.rs)
OPENAI_API_KEY=sk-proj-xxxxx

# Optional overrides
TTS_VOICE=nova
TTS_MODEL=tts-1
VISION_MODEL=gpt-4o
VISION_DETAIL=low
VISION_MAX_TOKENS=200
CAPTURE_INTERVAL_MS=2000
CAPTURE_QUALITY=75
CAPTURE_MAX_FRAMES=30
```

---

## Build Order (Follow This Sequence)

Read GAMERCLONE-POC-PRD.md Section 17 for the full phased roadmap. Summary:

1. **Foundation** → Tauri app boots, tray icon, settings window shell
2. **Capture** → windows-capture integration, window picker, rolling buffer
3. **Audio + PTT** → cpal recording, rodio playback, rdev hooks
4. **Voice Pipeline** → CoachingService trait, LocalCoachingService, full STT→Vision→TTS loop
5. **RAG** → SQLite + fastembed, seed data, inject into Vision prompt
6. **Profiles + Polish** → 8 game profiles, settings UI, audio cues
7. **Test + Package** → Fullscreen game testing, NSIS installer, stability test

**Do not skip ahead.** Each phase depends on the previous one. The voice pipeline (phase 4) can't work without audio (phase 3) and capture (phase 2).

---

## What NOT to Do

- Do NOT add authentication, payments, or user accounts (POC scope)
- Do NOT use Electron or any web-based screen capture (it fails on DirectX)
- Do NOT use Tauri's global-shortcut plugin (it fails in fullscreen games)
- Do NOT write screenshots or audio to disk
- Do NOT call OpenAI directly from Tauri commands — always go through CoachingService trait
- Do NOT add a Node.js sidecar — everything runs in Rust
- Do NOT use `tokio::sync::Mutex` unless you need to hold the lock across an await — use `std::sync::Mutex`
- Do NOT make GPT-4o responses longer than 3 sentences — they'll sound terrible as TTS
- Do NOT use `detail: "high"` for screenshots unless explicitly asked — it's 9× more expensive
- Do NOT add macOS/Linux support (Windows only for POC + MVP v1)
