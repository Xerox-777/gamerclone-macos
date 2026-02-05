# GamerClone — Product Requirements Document

## POC (Proof of Concept) → MVP Transition Architecture

---

**Document Version**: 2.0.0
**Date**: February 5, 2026
**Platform**: Windows 10/11 only
**Framework**: Tauri 2.0 (Rust backend + React/TypeScript frontend)
**Status**: POC Build Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision](#2-product-vision)
3. [Two-Phase Strategy: POC → MVP](#3-two-phase-strategy-poc--mvp)
4. [POC Scope — What We Are Building Now](#4-poc-scope--what-we-are-building-now)
5. [MVP Scope — What Comes Next](#5-mvp-scope--what-comes-next)
6. [System Architecture](#6-system-architecture)
7. [Technology Stack](#7-technology-stack)
8. [Detailed Technical Requirements](#8-detailed-technical-requirements)
9. [User Experience Flow](#9-user-experience-flow)
10. [Game Profile System](#10-game-profile-system)
11. [Service Abstraction Layer (The Bridge)](#11-service-abstraction-layer-the-bridge)
12. [API Cost Model](#12-api-cost-model)
13. [Performance Budget](#13-performance-budget)
14. [Risk Assessment](#14-risk-assessment)
15. [Success Criteria](#15-success-criteria)
16. [Non-Goals](#16-non-goals)
17. [Implementation Roadmap](#17-implementation-roadmap)
18. [Claude Code Project Architecture](#18-claude-code-project-architecture)

---

## 1. Executive Summary

**GamerClone** is an AI-powered voice coaching desktop application for PC gamers. The user installs a lightweight Windows app (~5 MB), selects their game window, and presses a push-to-talk key. They ask a question about their gameplay in natural language. The app silently captures the last 60 seconds of screenshots, sends them alongside the transcribed question to GPT-4o Vision, and plays back a spoken coaching response through their speakers — all while the game retains focus. No overlay. No alt-tabbing. No typing.

**Why Tauri 2.0**: Our first attempt with Electron failed because Electron's `desktopCapturer` produces black frames when games run in DirectX/Vulkan exclusive fullscreen mode. Tauri 2.0 with the `windows-capture` Rust crate uses both the Windows Graphics Capture API (WGC) and DXGI Desktop Duplication to capture virtually all modern games, including fullscreen exclusive titles. Tauri also produces 5 MB installers (vs 150+ MB for Electron) and uses 30–50 MB RAM idle (vs 150–400 MB).

**The two-phase strategy**: The POC proves the voice loop works end-to-end on a developer's machine with local test data. The MVP moves all proprietary data (RAG knowledge bases, system prompts, game profiles) to GamerClone.com's backend, gates access behind user accounts, and becomes a sellable product. The POC is architectured with a **Service Abstraction Layer** so this transition requires configuration changes — not a rewrite.

---

## 2. Product Vision

### The Problem
PC gamers who want to improve face a fragmented learning experience: alt-tab to YouTube guides, pause the game to read wikis, or rely on friends who may not be available. There's no way to get expert-level, context-aware coaching without leaving the game.

### The Solution
An AI coach that watches your screen and answers your questions by voice — like having a pro gamer friend sitting next to you. Press a button, ask a question, hear the answer. Never look away from the game.

### Core Value Proposition
> "Any gamer can have an expert AI coach watching their gameplay and answering questions in real-time via voice — no typing, no alt-tabbing."

### Target Users
- PC gamers ages 13+ playing any game on Windows
- Initial target: players of popular titles (Minecraft, Valorant, Fortnite, League of Legends, Elden Ring, Counter-Strike 2, Rocket League)
- Primary acquisition: 30M-follower Minecraft streamer partnership (Minecraft-specific personality clone version is the flagship product)

### Business Model (MVP)
- Subscription software: $9–15/month
- Desktop app is free to download, account required, free trial (7 days or 10 queries/day)
- Revenue = subscriptions. Costs = OpenAI API calls per query.
- Target gross margin: 65–72% at scale

---

## 3. Two-Phase Strategy: POC → MVP

### Phase 1: POC (Current Build)

**Goal**: Prove the entire voice loop works end-to-end on a developer's Windows PC.

| Component | POC Approach | Notes |
|-----------|-------------|-------|
| Screenshot capture | `windows-capture` crate (local) | Must work with fullscreen DX11/12/Vulkan games |
| Push-to-talk | Low-level Windows hooks via `rdev` | Must work when game has focus |
| Speech-to-Text | OpenAI Whisper API (direct) | API key in local `.env` |
| Vision Analysis | OpenAI GPT-4o Vision (direct) | API key in local `.env` |
| Text-to-Speech | OpenAI TTS API (direct) | API key in local `.env` |
| RAG Knowledge | Local SQLite + `fastembed-rs` | Test data only — throwaway |
| System Prompts | Bundled JSON files | Hardcoded per game |
| Game Profiles | Bundled Rust structs + JSON | 8 profiles |
| Authentication | None | Developer use only |
| Settings Storage | `tauri-plugin-store` (local JSON) | Persists PTT key, audio devices, etc. |
| Distribution | `cargo tauri build` → NSIS .exe | Unsigned, SmartScreen warning OK |

**POC proves**: Screenshots work on fullscreen games. PTT works during gameplay. Voice loop completes in < 5 seconds. AI coaching responses are contextually relevant. Audio playback doesn't interfere with game audio.

### Phase 2: MVP (Production Build)

**Goal**: Ship a sellable product where proprietary data is protected and access is gated.

| Component | MVP Approach | Migration from POC |
|-----------|-------------|-------------------|
| Screenshot capture | Same `windows-capture` (local) | No change |
| Push-to-talk | Same `rdev` hooks (local) | No change |
| Speech-to-Text | Via GamerClone.com API proxy | Swap service trait impl |
| Vision Analysis | Via GamerClone.com API proxy | Swap service trait impl |
| Text-to-Speech | Via GamerClone.com API proxy | Swap service trait impl |
| RAG Knowledge | **Qdrant Cloud** behind GamerClone.com API | Swap service trait impl |
| System Prompts | **Server-side**, fetched per game on demand | Swap service trait impl |
| Game Profiles | **Server-side**, synced on app launch | Swap service trait impl |
| Authentication | Supabase Auth via GamerClone.com | Add auth module |
| Subscription | LemonSqueezy → Supabase | Add subscription check |
| Settings Storage | Local + cloud sync | Extend existing store |
| Distribution | Signed NSIS installer + auto-update | Add code signing + updater plugin |

**The transition**: Every AI service call in the POC goes through a Rust `trait`. The POC has `LocalService` implementations (direct API calls). The MVP has `RemoteService` implementations (calls GamerClone.com which proxies to OpenAI/Qdrant). The frontend and capture logic don't change at all.

---

## 4. POC Scope — What We Are Building Now

### Must-Have Features (POC)

1. **System tray application** — App runs minimized to Windows system tray. Double-click opens settings window. Right-click shows context menu (Settings, About, Quit).

2. **Window selection** — User opens a dropdown listing all visible windows. Selects their game window. App begins capturing screenshots from that window every 2 seconds.

3. **Screenshot rolling buffer** — Stores the last 30 screenshots (60 seconds at 2-second intervals) as compressed JPEG in memory. When the user asks a question, the last 5–10 screenshots are sent for analysis. Screenshots never touch disk.

4. **Push-to-talk** — User holds a configurable hotkey (default: Mouse4, F13, or Tilde). Audio recording starts. User releases key. Recording stops. Works while the game window has focus. Works in fullscreen exclusive mode.

5. **Voice pipeline** — Complete loop:
   - Audio → WAV (16kHz, 16-bit, mono)
   - WAV → OpenAI Whisper → transcript text
   - Transcript + last 5 screenshots + game profile system prompt + RAG context → OpenAI GPT-4o Vision → coaching response text
   - Response text → OpenAI TTS → audio
   - Audio → play through speakers (alongside game audio, no interruption)

6. **Game profile selection** — User picks a game from a dropdown. This loads the appropriate system prompt and RAG seed data. Available profiles: Minecraft, Valorant, Counter-Strike 2, Fortnite, League of Legends, Elden Ring, Rocket League, Generic (any game).

7. **Local RAG** — SQLite database with `sqlite-vec` extension for vector search. Embeddings generated locally via `fastembed-rs` (AllMiniLM-L6-v2, 384 dimensions). Seeded with test knowledge per game. On voice query, the transcript is embedded and top-3 similar knowledge chunks are injected into the GPT-4o system prompt.

8. **Audio feedback** — Short audio cues: PTT activated (click), PTT released/processing (subtle tone), response complete (none — the voice itself signals completion), error (distinct error chime).

9. **Settings persistence** — PTT key, audio input device, audio output device, selected game profile, selected window, TTS voice — all persist across app restarts via `tauri-plugin-store`.

10. **Windows .exe installer** — NSIS installer via `cargo tauri build`. Installs to `AppData\Local`. Creates Start Menu shortcut. Unsigned (SmartScreen warning acceptable for POC).

### Won't-Have Features (POC)

- No user authentication or accounts
- No subscription/payment system
- No server-side anything (all local)
- No auto-update mechanism
- No code signing
- No usage tracking or analytics
- No pretty UI (functional only)
- No overlay or HUD
- No macOS or Linux support
- No streaming TTS (wait for full response, then play)

---

## 5. MVP Scope — What Comes Next

This section documents the MVP architecture so the POC is built with the right abstractions. **None of this is built during the POC phase.**

### Server-Side Components (GamerClone.com)

```
┌─────────────────────────────────────────────────────────────┐
│                   GamerClone.com Backend                    │
│              (Railway/Render + Supabase + Qdrant)           │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  API Gateway  │  │  Supabase    │  │  Qdrant Cloud    │  │
│  │  (Node.js/   │  │  (Auth +     │  │  (Vector DB)     │  │
│  │   Express or │  │   Users +    │  │                  │  │
│  │   Rust Axum) │  │   Subs)      │  │  Game knowledge  │  │
│  └──────┬───────┘  └──────────────┘  │  RAG vectors     │  │
│         │                            │  per game         │  │
│         │  Routes:                   └──────────────────┘  │
│         │  POST /api/v1/voice-query                        │
│         │  POST /api/v1/validate-session                   │
│         │  GET  /api/v1/game-profiles                      │
│         │  GET  /api/v1/system-prompt/:game_id             │
│         │  POST /api/v1/rag-query                          │
│         │                                                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Secrets (server-side only):                         │  │
│  │  - OPENAI_API_KEY                                    │  │
│  │  - QDRANT_API_KEY                                    │  │
│  │  - System prompts (stored in DB, not in code)        │  │
│  │  - Game profiles (stored in DB, not in code)         │  │
│  │  - RAG knowledge (stored in Qdrant, not shipped)     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### What Moves Server-Side (and Why)

| Asset | Why Server-Side | Risk if Client-Side |
|-------|----------------|-------------------|
| **RAG knowledge base** | Proprietary game knowledge (streamer's expertise, curated guides) | Users extract and redistribute your IP |
| **System prompts** | Need to update coaching behavior without app update | Users modify prompts, degrade experience |
| **Game profiles** | Add new games without app update, A/B test profiles | Stale profiles, no iteration speed |
| **OpenAI API keys** | Cost control, rate limiting per user | Keys leaked, unlimited usage, financial exposure |
| **Usage tracking** | Billing, rate limiting, analytics | No visibility into costs or usage patterns |

### What Stays Client-Side (and Why)

| Asset | Why Client-Side | Latency Impact if Server-Side |
|-------|----------------|------------------------------|
| **Screenshot capture** | Can't send raw video stream — bandwidth prohibitive | N/A — must be local |
| **Push-to-talk hooks** | OS-level keyboard/mouse hooks | N/A — must be local |
| **Audio recording** | Microphone access requires local OS permissions | N/A — must be local |
| **Audio playback** | Speaker output is local | N/A — must be local |
| **JPEG compression** | Raw screenshots are 6 MB, compressed is 150 KB | +50ms per screenshot if server-compressed |
| **Settings/preferences** | Instant UI response, no network dependency | +200ms on every settings read |
| **Embedding model** | MVP decision point — see note below | +100ms per query |

> **MVP Decision: Client-side vs server-side embeddings**
> For the MVP, the user's voice query needs to be embedded into a vector for RAG search. Two options:
> - **Client-side embedding** (fastembed-rs stays in the app): Faster (+100ms saved), but ships a 80 MB model file with the installer. The model itself is open source (MiniLM) so no IP risk. **Recommended.**
> - **Server-side embedding**: Smaller installer, but adds a network round-trip before RAG search can begin. Only choose this if installer size is a dealbreaker.

---

## 6. System Architecture

### POC Architecture (Everything Local)

```
┌─────────────────────────────────────────────────────────────────┐
│                  GAMERCLONE DESKTOP APP (Tauri 2.0)             │
│                        Windows 10/11                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              React + TypeScript Frontend                 │    │
│  │  ┌────────────┐ ┌────────────┐ ┌─────────────────────┐  │    │
│  │  │ Window     │ │ Game       │ │ PTT Indicator +     │  │    │
│  │  │ Picker     │ │ Selector   │ │ Status Log          │  │    │
│  │  └────────────┘ └────────────┘ └─────────────────────┘  │    │
│  │  ┌────────────┐ ┌────────────────────────────────────┐  │    │
│  │  │ Settings   │ │ Audio Device Selector              │  │    │
│  │  │ Panel      │ │                                    │  │    │
│  │  └────────────┘ └────────────────────────────────────┘  │    │
│  └────────────────────────┬────────────────────────────────┘    │
│                           │ Tauri IPC (invoke / emit / Channel) │
│  ┌────────────────────────▼────────────────────────────────┐    │
│  │                   Rust Backend                          │    │
│  │                                                         │    │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐  │    │
│  │  │ Capture Module  │  │ Audio Module                 │  │    │
│  │  │ windows-capture │  │ cpal (mic) + rodio (speaker) │  │    │
│  │  │ + turbojpeg     │  │ + hound (WAV encode)         │  │    │
│  │  │                 │  │ + rubato (resample)           │  │    │
│  │  │ Thread: capture │  │ Thread: audio                │  │    │
│  │  └─────────────────┘  └──────────────────────────────┘  │    │
│  │                                                         │    │
│  │  ┌─────────────────┐  ┌──────────────────────────────┐  │    │
│  │  │ Hotkey Module   │  │ Voice Pipeline Module        │  │    │
│  │  │ rdev hooks      │  │ (Orchestrator)               │  │    │
│  │  │                 │  │                              │  │    │
│  │  │ Thread: hooks   │  │ STT → RAG → Vision → TTS    │  │    │
│  │  └─────────────────┘  │                              │  │    │
│  │                       │ Uses Service Abstraction      │  │    │
│  │  ┌─────────────────┐  │ Layer (trait CoachingService) │  │    │
│  │  │ Local RAG       │  └──────────────────────────────┘  │    │
│  │  │ rusqlite +      │                                    │    │
│  │  │ sqlite-vec +    │  ┌──────────────────────────────┐  │    │
│  │  │ fastembed-rs    │  │ Settings Store               │  │    │
│  │  └─────────────────┘  │ tauri-plugin-store            │  │    │
│  │                       └──────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────┘    │
│                           │                                     │
│                           │ HTTPS (direct to OpenAI)            │
│                           ▼                                     │
│                  ┌─────────────────┐                            │
│                  │    OpenAI API   │                            │
│                  │  Whisper / GPT  │                            │
│                  │  -4o / TTS      │                            │
│                  └─────────────────┘                            │
└─────────────────────────────────────────────────────────────────┘
```

### MVP Architecture (Client + Server)

```
┌─────────────────────────────┐          ┌──────────────────────────────┐
│  GAMERCLONE DESKTOP APP     │          │  GAMERCLONE.COM BACKEND      │
│  (Tauri 2.0 — same app)    │          │  (api.gamerclone.com)        │
├─────────────────────────────┤          ├──────────────────────────────┤
│                             │          │                              │
│  Capture Module (unchanged) │          │  POST /api/v1/voice-query    │
│  Audio Module   (unchanged) │          │    → Validate JWT            │
│  Hotkey Module  (unchanged) │          │    → Check subscription      │
│  Settings Store (unchanged) │          │    → Whisper STT             │
│                             │  HTTPS   │    → RAG search (Qdrant)     │
│  Voice Pipeline Module      │ ───────► │    → Fetch system prompt     │
│  (RemoteCoachingService)    │          │    → GPT-4o Vision           │
│                             │ ◄─────── │    → TTS                     │
│  Auth Module (NEW)          │          │    → Increment usage         │
│  Subscription Check (NEW)   │          │    → Return audio + text     │
│                             │          │                              │
│  fastembed-rs (optional —   │          │  GET /api/v1/game-profiles   │
│  client-side embedding for  │          │  GET /api/v1/system-prompt   │
│  faster RAG queries)        │          │  POST /api/v1/validate       │
│                             │          │                              │
└─────────────────────────────┘          │  Supabase (Auth + Users)     │
                                         │  Qdrant Cloud (RAG vectors)  │
                                         │  OpenAI (all AI calls)       │
                                         └──────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Desktop framework | **Tauri 2.0** | 5 MB installer, 30–50 MB RAM, fullscreen game capture works |
| AI pipeline location (POC) | **Direct from Rust** | No sidecar overhead, async-openai crate handles everything |
| AI pipeline location (MVP) | **Server-side proxy** | Protects API keys, enables rate limiting, usage tracking |
| RAG storage (POC) | **Local SQLite + sqlite-vec** | Zero dependencies, fast, disposable test data |
| RAG storage (MVP) | **Qdrant Cloud** | Protects proprietary knowledge, scalable, managed |
| System prompts (POC) | **Bundled JSON** | Simple, editable, no network dependency |
| System prompts (MVP) | **Server-side DB** | Update without app release, A/B test, per-game control |
| Screen capture | **windows-capture 2.0** | WGC + DXGI DD, captures fullscreen DX11/12/Vulkan |
| Global hotkeys | **rdev (WH_KEYBOARD_LL + WH_MOUSE_LL)** | Works in fullscreen, supports mouse buttons, detects key release |
| Audio recording | **cpal** | WASAPI shared mode, 48kHz capture, no game audio interference |
| Audio playback | **rodio** | Decodes MP3/WAV, plays alongside game audio |
| JPEG compression | **turbojpeg** | SIMD-optimized, 3–5ms per 1080p frame at quality 75 |
| Local embeddings | **fastembed-rs** | AllMiniLM-L6-v2, ~5ms per sentence, no Python/Node dependency |
| Frontend | **React + TypeScript + Vite** | Familiar stack, Tauri has first-class Vite support |
| Settings persistence | **tauri-plugin-store** | Simple key-value, JSON on disk |

---

## 7. Technology Stack

### Rust Backend (src-tauri/)

| Crate | Version | Purpose |
|-------|---------|---------|
| `tauri` | 2.x | Desktop app framework |
| `tauri-plugin-store` | 2.x | Persistent settings |
| `tauri-plugin-single-instance` | 2.x | Prevent multiple instances |
| `windows-capture` | 2.0 | Game screenshot capture (WGC + DXGI) |
| `rdev` | 0.5+ | Global keyboard/mouse hooks for PTT |
| `cpal` | 0.15+ | Microphone capture (WASAPI) |
| `rodio` | 0.19+ | Audio playback |
| `hound` | 3.5 | WAV encoding |
| `rubato` | 0.15+ | Audio resampling (48kHz → 16kHz) |
| `turbojpeg` | 1.0+ | Fast JPEG compression |
| `async-openai` | 0.30+ | OpenAI API client (Whisper, GPT-4o, TTS) |
| `rusqlite` | 0.32+ | SQLite database |
| `sqlite-vec` | 0.1+ | Vector similarity search extension |
| `fastembed` | 4.0+ | Local embedding generation (AllMiniLM-L6-v2) |
| `tokio` | 1.x | Async runtime (bundled with Tauri) |
| `reqwest` | 0.12+ | HTTP client (bundled with async-openai) |
| `serde` / `serde_json` | 1.x | Serialization |
| `base64` | 0.22+ | Base64 encoding for API payloads |
| `image` | 0.25+ | Image manipulation (resize) |
| `uuid` | 1.x | Unique IDs |
| `chrono` | 0.4+ | Timestamps |
| `tracing` | 0.1+ | Structured logging |

### React Frontend (src/)

| Package | Purpose |
|---------|---------|
| `react` + `react-dom` | UI framework |
| `typescript` | Type safety |
| `@tauri-apps/api` | Tauri IPC from frontend |
| `@tauri-apps/plugin-store` | Settings access from frontend |
| `tailwindcss` | Utility-first styling |
| `zustand` | Lightweight state management |
| `lucide-react` | Icon library |

### Development Tools

| Tool | Purpose |
|------|---------|
| `cargo tauri dev` | Development mode with hot reload |
| `cargo tauri build` | Production build + NSIS installer |
| `Rust 1.77+` | Rust toolchain |
| `Node.js 20+` | Frontend build tools |
| `pnpm` | Package manager (faster than npm) |

---

## 8. Detailed Technical Requirements

### 8.1 Screenshot Capture

**Requirement**: Capture the selected game window every 2 seconds, compress to JPEG, store last 30 frames in a rolling buffer.

**Implementation**:
- Use `windows-capture` v2.0 with `Capture::start_free_threaded()`
- Run capture on a dedicated OS thread (not Tokio)
- Default to WGC backend; fall back to DXGI Desktop Duplication if WGC fails (true fullscreen exclusive DX11)
- Compress each frame to JPEG quality 75 using `turbojpeg` (target: ~100–200 KB per 1080p frame)
- Resize to 1280×720 before compression (GPT-4o Vision sweet spot — fewer tokens, sufficient detail)
- Store frames in a `VecDeque<CapturedFrame>` behind `Arc<RwLock<>>`
- `CapturedFrame` struct: `{ jpeg_bytes: Vec<u8>, timestamp: Instant, width: u32, height: u32 }`
- Buffer capacity: 30 frames = ~3–6 MB memory
- Screenshots never written to disk

**Window Discovery**:
- Enumerate visible windows via Win32 `EnumWindows`
- Filter: visible, non-zero size, has title text
- Display: window title + process name
- Allow manual refresh of window list
- Selected window ID stored in settings

**Error Handling**:
- If selected window is closed → pause capture, notify frontend via event
- If capture fails intermittently → skip frame, do not crash
- If WGC permission dialog appears → guide user to allow

### 8.2 Push-to-Talk

**Requirement**: User holds a configurable key/button. Audio records while held. On release, recording stops and voice pipeline triggers. Must work when any fullscreen game has focus.

**Implementation**:
- Use `rdev::listen()` on a dedicated thread with its own Windows message pump
- Detect `EventType::KeyPress` / `KeyRelease` and `ButtonPress` / `ButtonRelease`
- Support keyboard keys: F13–F24, Tilde, CapsLock, any non-game key
- Support mouse buttons: Mouse4 (XButton1), Mouse5 (XButton2)
- Default: Mouse4 (doesn't conflict with any standard game bindings)
- On press: emit `ptt-started` event to frontend, start audio recording
- On release: stop audio recording, emit `ptt-stopped` event, trigger voice pipeline
- Implement 100ms release delay to prevent accidental cutoff (configurable)
- Implement 200ms minimum hold time to filter accidental taps

**Key Conflict Avoidance** (never allow these as PTT):
- WASD, Space, Shift, Ctrl, Alt, Tab, Escape, Enter
- 1–5, E, F, R, Q, G, B, M, I, C, V
- F1–F12 (many games use these)

**Admin Elevation**:
- If game runs as admin and PTT doesn't work → display a one-time notice explaining the user needs to run GamerClone as admin
- Store "run as admin" preference in settings

### 8.3 Audio Recording

**Requirement**: Capture microphone audio in Whisper-compatible format when PTT is held.

**Implementation**:
- Use `cpal` to open the default or user-selected input device
- Capture at device's default rate (usually 48kHz on Windows WASAPI shared mode)
- Store samples in `Arc<Mutex<Vec<f32>>>` ring buffer while recording flag is set
- On PTT release:
  1. Clone the recorded samples
  2. Average stereo channels to mono (if stereo)
  3. Resample to 16kHz using `rubato` (SincFixedIn resampler)
  4. Convert f32 samples to i16 PCM
  5. Encode to WAV using `hound` (16kHz, 16-bit, mono)
  6. Pass WAV bytes to voice pipeline
- Maintain 300ms pre-roll buffer (always recording the last 300ms, include it when PTT activates to capture speech onset)
- Maximum recording duration: 30 seconds (prevent accidental infinite recordings)

**Audio Device Selection**:
- Enumerate input devices via `cpal::default_host().input_devices()`
- Present device names in frontend dropdown
- Store selected device ID in settings
- Handle device disconnection gracefully (fall back to default)

### 8.4 Audio Playback

**Requirement**: Play TTS audio response through speakers alongside game audio.

**Implementation**:
- Use `rodio::OutputStream` on the default or user-selected output device
- WASAPI shared mode (default) — does not interrupt game audio
- For POC: wait for full TTS response (MP3 bytes), then play entire clip
  - Create `rodio::Decoder` from cursor over MP3 bytes
  - `sink.append(decoder)`
- For MVP: stream PCM chunks as they arrive from TTS API
- Audio feedback cues:
  - PTT pressed: play a short click sound (bundled .wav, ~50ms)
  - Processing: optional subtle tone
  - Error: distinct error chime (bundled .wav)

### 8.5 Voice Pipeline (The Core Loop)

**Requirement**: Orchestrate STT → RAG → Vision → TTS with < 5 second total latency.

**Sequence**:

```
1. PTT released → WAV audio bytes ready
2. Get last 5 screenshots from buffer
3. ─── Call Whisper STT ──────────────────────────────
   │   Input: WAV bytes
   │   Output: transcript text
   │   Expected latency: 500ms–2s
   │
4. ─── PARALLEL: RAG search ──────────────────────────
   │   Input: transcript text
   │   Process: embed transcript → cosine similarity search in SQLite
   │   Output: top 3 knowledge chunks
   │   Expected latency: 50–200ms (local, overlaps with step 3 if async)
   │
5. ─── Call GPT-4o Vision ────────────────────────────
   │   Input: system prompt + RAG context + transcript + 5 screenshots (base64 JPEG)
   │   Parameters: model=gpt-4o, max_tokens=200, temperature=0.7
   │   Output: coaching response text (1–3 sentences, ~30–50 words)
   │   Expected latency: 1–3s
   │
6. ─── Call OpenAI TTS ───────────────────────────────
   │   Input: response text
   │   Parameters: model=tts-1, voice=nova, format=mp3
   │   Output: MP3 audio bytes
   │   Expected latency: 500ms–1.5s
   │
7. Play audio through speakers
```

**Latency Budget**:

| Step | Target | Acceptable |
|------|--------|------------|
| Audio encoding (WAV) | 50ms | 100ms |
| Whisper STT | 500ms | 2000ms |
| RAG search (local) | 50ms | 200ms |
| GPT-4o Vision | 1500ms | 3000ms |
| TTS generation | 500ms | 1500ms |
| Audio playback start | 50ms | 100ms |
| **Total** | **2650ms** | **6900ms** |

**Error Handling**:
- Whisper returns empty transcript → play "Sorry, I didn't catch that. Try again."
- GPT-4o API error → play "Having trouble connecting. Try again in a moment."
- TTS API error → display text response in frontend status log (fallback)
- Network timeout (10s) → cancel and play error sound
- Rate limit (429) → play "You're asking questions too fast. Give me a moment."

### 8.6 Local RAG (POC Only)

**Requirement**: Store game-specific knowledge and retrieve relevant context for each voice query.

**Implementation**:
- SQLite database via `rusqlite` at `app_data_dir/gamerclone/rag.db`
- `sqlite-vec` extension for vector similarity search
- Schema:

```sql
CREATE TABLE knowledge (
    id INTEGER PRIMARY KEY,
    game_id TEXT NOT NULL,
    category TEXT NOT NULL,       -- 'mechanics', 'strategy', 'items', 'builds', etc.
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE VIRTUAL TABLE knowledge_vec USING vec0(
    embedding float[384]
);
```

- Embedding model: `fastembed-rs` with `AllMiniLM-L6-v2` (384 dimensions)
- On app first launch: seed database from bundled JSON files (one per game)
- On voice query:
  1. Embed the transcript using fastembed
  2. Search `knowledge_vec` with `WHERE embedding MATCH ? ORDER BY distance LIMIT 3`
  3. Join back to `knowledge` table to get text content
  4. Inject top 3 results into GPT-4o system prompt under `RELEVANT KNOWLEDGE:` header

**Seed Data Format** (JSON, one file per game):

```json
{
  "game_id": "minecraft",
  "entries": [
    {
      "category": "mechanics",
      "title": "Diamond Mining Depth",
      "content": "Diamonds spawn most frequently at Y-level -59 in Minecraft 1.18+. Strip mining at this level with efficiency V pickaxe is the fastest method. Bring water buckets for lava."
    }
  ]
}
```

- POC ships with 20–50 entries per game (enough to demonstrate RAG works)
- MVP: this entire database is replaced by Qdrant Cloud queries through the API

### 8.7 Game Profiles

**Requirement**: Different games need different coaching contexts, terminology, and system prompts.

**POC Implementation**: Bundled as Rust code + JSON files.

Each profile contains:
- `game_id`: Unique identifier (e.g., "minecraft", "valorant")
- `display_name`: Human-readable name
- `system_prompt`: The full system prompt for GPT-4o Vision when coaching this game
- `rag_enabled`: Whether to include RAG context (all true for POC)
- `screenshot_count`: How many screenshots to send (3–5 depending on game pace)
- `max_response_tokens`: Max tokens for GPT-4o response (shorter for fast-paced games)

**POC Profiles**:

| Game | Screenshot Count | Max Tokens | Notes |
|------|-----------------|------------|-------|
| Minecraft | 5 | 200 | Slow-paced, benefit from more visual context |
| Valorant | 3 | 150 | Fast-paced, need quick concise answers |
| Counter-Strike 2 | 3 | 150 | Similar to Valorant |
| Fortnite | 4 | 150 | Mix of building + combat |
| League of Legends | 5 | 200 | Complex game state, needs more context |
| Elden Ring | 5 | 200 | Exploration-heavy, more visual context helps |
| Rocket League | 3 | 100 | Very fast, ultra-short responses |
| Generic | 5 | 200 | Any game, general gaming coach |

**MVP Migration**: Profiles fetched from `GET /api/v1/game-profiles` on app launch, cached locally, refreshed periodically. System prompts fetched from `GET /api/v1/system-prompt/:game_id` when a game is selected.

---

## 9. User Experience Flow

### First Launch

```
1. User double-clicks "GamerClone Setup.exe"
   → Standard Windows installer → installs to AppData\Local
   → Creates Start Menu shortcut

2. App launches → settings window opens (not just system tray)
   → Displays: "Welcome to GamerClone"
   → Step 1: "Select your microphone" (dropdown, test button)
   → Step 2: "Select your push-to-talk key" (press any key/button to bind)
   → Step 3: "Select your game" (dropdown of profiles)
   → Step 4: "Select your game window" (dropdown of open windows)
   → "Start Coaching" button

3. User clicks "Start Coaching"
   → App minimizes to system tray
   → Screenshot capture begins
   → Status: "Ready — hold [Mouse4] to ask a question"
```

### Voice Query Flow (In-Game)

```
1. User is playing Minecraft in fullscreen
2. They encounter a structure they don't recognize
3. They press and hold Mouse4 (PTT key)
   → *click* audio cue plays
   → System tray icon changes to "listening" state (yellow)
4. User says: "What is this building and should I go inside?"
5. User releases Mouse4
   → System tray icon changes to "thinking" state (blue)
   → Background: Last 5 screenshots captured (showing the structure)
   → Background: Audio → Whisper → "What is this building and should I go inside?"
   → Background: Transcript embedded → RAG search → 3 relevant knowledge chunks
   → Background: System prompt + RAG + screenshots + transcript → GPT-4o
   → Background: Response → TTS → audio
6. Through speakers: "That's a Woodland Mansion — rare and full of loot but
   guarded by Vindicators and Evokers. Go in, but bring a shield and good armor.
   Clear it room by room."
   → System tray icon returns to "ready" state (green)
7. User never looked away from the game.
```

---

## 10. Game Profile System

### System Prompt Template

Each game profile uses this template structure for the GPT-4o Vision system prompt:

```
You are GamerClone, an expert {game_name} coach providing real-time voice guidance.

PERSONALITY:
- Sound like a confident, experienced friend — not a chatbot
- Be direct and specific — tell them exactly what to do
- Use {game_name} community terminology naturally
- Keep responses to 1–3 sentences (they'll be spoken aloud)
- If you can't see clearly, give the best general advice rather than saying "I can't tell"

GAME CONTEXT:
{game_specific_context}

SCREENSHOT ANALYSIS:
- You are looking at the player's recent screenshots (last few seconds of gameplay)
- Identify: current location, health/resources, nearby threats, objectives
- Reference what you see specifically ("I see you're at..." / "That structure is...")

RELEVANT KNOWLEDGE:
{rag_context_injected_here}

Answer the player's question directly and concisely.
```

### Per-Game Context Examples

**Minecraft**:
```
You are coaching a Minecraft player. Key things to identify in screenshots:
- Biome type, time of day, weather
- Player's hotbar items, health, hunger, armor
- Nearby mobs (hostile vs passive), structures, terrain features
- Y-level (if visible in debug or inferred from surroundings)
- Current activity (mining, building, exploring, fighting)
Use terms like: Y-level, biome, mob, enchantment, Nether, End, stronghold, spawn.
```

**Valorant**:
```
You are coaching a Valorant player. Key things to identify in screenshots:
- Current map and site (A/B/C)
- Agent being played and abilities available
- Round phase (buy phase, mid-round, post-plant)
- Economy (credits visible in buy phase)
- Minimap positions, teammate count, enemy count
- Crosshair placement relative to common angles
Keep answers extremely short — this is a fast-paced tactical shooter.
Use terms like: peek, rotate, lurk, trade, eco, force buy, util, site.
```

---

## 11. Service Abstraction Layer (The Bridge)

This is the critical architectural pattern that makes the POC → MVP transition clean. Every external service call goes through a Rust trait. The POC implements the trait with direct API calls. The MVP implements it with calls to GamerClone.com.

### The Trait

```rust
// src-tauri/src/services/mod.rs

#[async_trait]
pub trait CoachingService: Send + Sync {
    /// Transcribe audio to text
    async fn transcribe(&self, wav_bytes: Vec<u8>) -> Result<String, ServiceError>;

    /// Search knowledge base for relevant context
    async fn rag_search(&self, query: &str, game_id: &str, limit: usize) -> Result<Vec<KnowledgeChunk>, ServiceError>;

    /// Analyze screenshots + transcript + context and return coaching text
    async fn analyze_gameplay(
        &self,
        transcript: &str,
        screenshots: Vec<Screenshot>,
        game_profile: &GameProfile,
        rag_context: Vec<KnowledgeChunk>,
    ) -> Result<String, ServiceError>;

    /// Convert coaching text to spoken audio
    async fn text_to_speech(&self, text: &str, voice: &str) -> Result<Vec<u8>, ServiceError>;

    /// Get available game profiles
    async fn get_game_profiles(&self) -> Result<Vec<GameProfile>, ServiceError>;

    /// Get system prompt for a specific game
    async fn get_system_prompt(&self, game_id: &str) -> Result<String, ServiceError>;
}
```

### POC Implementation

```rust
// src-tauri/src/services/local.rs

pub struct LocalCoachingService {
    openai_client: async_openai::Client<OpenAIConfig>,
    rag_db: Arc<Mutex<Connection>>,
    embedder: Arc<TextEmbedding>,
    profiles: HashMap<String, GameProfile>,
}

#[async_trait]
impl CoachingService for LocalCoachingService {
    async fn transcribe(&self, wav_bytes: Vec<u8>) -> Result<String, ServiceError> {
        // Direct call to OpenAI Whisper API via async-openai
    }

    async fn rag_search(&self, query: &str, game_id: &str, limit: usize) -> Result<Vec<KnowledgeChunk>, ServiceError> {
        // Local: embed query with fastembed → search sqlite-vec
    }

    async fn analyze_gameplay(...) -> Result<String, ServiceError> {
        // Direct call to OpenAI GPT-4o Vision via async-openai
    }

    async fn text_to_speech(&self, text: &str, voice: &str) -> Result<Vec<u8>, ServiceError> {
        // Direct call to OpenAI TTS via async-openai
    }

    async fn get_game_profiles(&self) -> Result<Vec<GameProfile>, ServiceError> {
        // Return bundled profiles from self.profiles HashMap
    }

    async fn get_system_prompt(&self, game_id: &str) -> Result<String, ServiceError> {
        // Return bundled prompt from JSON file
    }
}
```

### MVP Implementation (Future — Not Built in POC)

```rust
// src-tauri/src/services/remote.rs (MVP only)

pub struct RemoteCoachingService {
    http_client: reqwest::Client,
    base_url: String,       // https://api.gamerclone.com
    auth_token: String,     // JWT from Supabase
}

#[async_trait]
impl CoachingService for RemoteCoachingService {
    async fn transcribe(&self, wav_bytes: Vec<u8>) -> Result<String, ServiceError> {
        // POST https://api.gamerclone.com/v1/transcribe
        // Body: multipart with WAV
        // Server calls Whisper, returns transcript
    }

    async fn rag_search(&self, query: &str, game_id: &str, limit: usize) -> Result<Vec<KnowledgeChunk>, ServiceError> {
        // POST https://api.gamerclone.com/v1/rag-search
        // Server embeds query, searches Qdrant, returns chunks
    }

    // ... etc — every method becomes an HTTP call to your server
}
```

### Switching Between Implementations

```rust
// src-tauri/src/main.rs

fn main() {
    let service: Arc<dyn CoachingService> = if cfg!(feature = "local") {
        Arc::new(LocalCoachingService::new(/* ... */))
    } else {
        Arc::new(RemoteCoachingService::new(/* ... */))
    };

    tauri::Builder::default()
        .manage(service)
        // ...
}
```

Build with `--features local` for POC, default (no feature) for MVP. The frontend, capture module, audio module, and hotkey module never know or care which implementation is active.

---

## 12. API Cost Model

### Per-Query Cost (POC — Direct OpenAI)

| Step | Model | Input | Cost |
|------|-------|-------|------|
| Whisper STT | whisper-1 | ~10s audio | $0.006 |
| GPT-4o Vision | gpt-4o | 5 images (low detail) + ~500 tokens text | $0.015–0.025 |
| OpenAI TTS | tts-1 | ~50 words (~250 chars) | $0.004 |
| **Total per query** | | | **~$0.025–0.035** |

### Monthly Cost Projections (MVP)

| Usage Tier | Queries/Month | Monthly API Cost | Revenue at $9/mo | Gross Margin |
|------------|--------------|-----------------|------------------|-------------|
| Casual (10/day) | 300 | $9 | $9 | ~0% |
| Regular (20/day) | 600 | $18 | $9 | -100% |
| Heavy (50/day) | 1500 | $45 | $9 | -400% |

**The math problem**: At $9/month with 20 queries/day, you're underwater. Solutions for MVP:

1. **Rate limit free tier** aggressively (10 queries/day)
2. **Price pro tier at $15–19/month** with 30 queries/day limit
3. **Use GPT-4o-mini** for simple questions (5× cheaper), GPT-4o for complex (save ~60% on vision costs)
4. **Reduce screenshot count** to 3 for fast-paced games
5. **Cache common responses** (same screenshot + similar question = cached answer)
6. **Use `detail: low`** on all screenshots (85 tokens per image vs 765 for high)

**For POC**: Don't worry about cost. You're the only user. Budget ~$10–20 in OpenAI credits for testing.

---

## 13. Performance Budget

| Resource | Target | Hard Limit | How to Measure |
|----------|--------|------------|----------------|
| **Installer size** | 5 MB | 15 MB | `dir` on NSIS output |
| **RAM (idle)** | 50 MB | 100 MB | Task Manager working set |
| **RAM (active + model loaded)** | 200 MB | 300 MB | Task Manager after first query |
| **CPU (idle, capturing)** | < 2% | < 5% | Task Manager average |
| **CPU (during query)** | < 10% | < 20% | Task Manager peak |
| **GPU** | 0% | 0% | Task Manager — must not touch GPU |
| **Screenshot buffer** | 3 MB | 10 MB | 30 frames × 100–200 KB |
| **Voice query latency** | 3s | 6s | Timestamp from PTT release to audio start |
| **App startup** | 2s | 5s | Stopwatch from click to tray icon visible |

### Thread Architecture

| Thread | Purpose | Priority |
|--------|---------|----------|
| Main (Tokio) | Tauri runtime, IPC handlers, async API calls | Normal |
| Capture | `windows-capture` frame loop → JPEG → buffer | Below Normal |
| Hotkey | `rdev::listen()` + Windows message pump | Normal |
| Audio Record | `cpal` input stream callback | Above Normal |
| Audio Playback | `rodio` output stream (managed by rodio internally) | Above Normal |

---

## 14. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| `windows-capture` doesn't work with certain games (DX9, old titles) | Medium | Low | Document supported games. DX9 is rare in 2026. Fallback: "run in borderless windowed mode" |
| PTT hooks fail when game runs as admin | High | Medium | Detect and prompt user to run GamerClone as admin |
| PTT hooks flagged by anti-cheat (Vanguard, EAC) | Low | High | Low-level hooks are used by Discord/OBS/TeamSpeak — anti-cheats whitelist this pattern. Monitor reports. |
| Voice query latency > 5s | Medium | High | Parallel STT + RAG. Use GPT-4o-mini as fallback. Reduce screenshot count. Pre-warm API connections. |
| OpenAI API rate limits during testing | Low | Low | Implement exponential backoff. async-openai has built-in retry. |
| `fastembed-rs` model download fails on first launch | Medium | Medium | Bundle model in installer (adds ~80 MB) or download on first use with progress indicator |
| Rust compilation complexity scares off future contributors | Medium | Low | Strong CLAUDE.md, clear module boundaries, good logging |
| Audio device changes mid-game (headset unplug) | High | Medium | Listen for device change events via `cpal`. Fall back to default device. Notify user. |
| SmartScreen blocks unsigned installer | Certain | Low (POC) | Acceptable for POC. Sign for MVP ($200–400/year). |

---

## 15. Success Criteria

### POC Success (Must Pass All)

- [ ] App installs via NSIS .exe on Windows 10/11
- [ ] App runs in system tray, opens settings on double-click
- [ ] User can select a game window from dropdown
- [ ] Screenshots capture correctly from a fullscreen DirectX game (test: Minecraft fullscreen, Valorant fullscreen)
- [ ] Push-to-talk (Mouse4) works while fullscreen game has focus
- [ ] Audio records and encodes to WAV correctly
- [ ] Whisper transcribes the recording accurately
- [ ] RAG returns relevant knowledge chunks
- [ ] GPT-4o Vision produces a contextually relevant coaching response
- [ ] TTS plays the response through speakers without interrupting game audio
- [ ] End-to-end latency from PTT release to audio playback start: < 6 seconds
- [ ] App uses < 300 MB RAM during active query
- [ ] App uses < 5% CPU when idle (capturing screenshots)
- [ ] No crashes during a 30-minute test session

### POC Stretch Goals (Nice to Have)

- [ ] Latency under 4 seconds
- [ ] RAM under 200 MB
- [ ] Settings persist across restarts
- [ ] Multiple game profiles tested and working
- [ ] Audio feedback cues (PTT click, error sound)

---

## 16. Non-Goals

These are explicitly out of scope for both POC and MVP v1:

- Mobile apps (iOS/Android)
- macOS or Linux support (MVP v2 maybe)
- Browser extension or web app
- Game overlay or HUD elements
- Auto-detection of which game is running
- Multiplayer/team coaching (coaching multiple players)
- Replay analysis (analyze recorded gameplay after the fact)
- Achievement/stat tracking
- Social features (friends, leaderboards)
- Streaming integration (Twitch/YouTube)
- Custom voice cloning (using streamer's actual voice) — MVP v2
- Auto-hotkey or macro automation
- Mod/addon integration with specific games

---

## 17. Implementation Roadmap

### Phase 1: Foundation (Days 1–3)

**Goal**: Tauri app boots, shows a window, sits in system tray.

- [ ] Initialize Tauri 2.0 + React + TypeScript + Vite project
- [ ] Configure `tauri.conf.json` (single instance, system tray, window settings)
- [ ] Create basic React UI shell (placeholder panels for each feature)
- [ ] Implement system tray with context menu (Settings, Quit)
- [ ] Install and configure `tauri-plugin-store` for settings persistence
- [ ] Set up `tracing` for structured Rust-side logging
- [ ] Verify `cargo tauri dev` hot-reload works
- [ ] Verify `cargo tauri build` produces NSIS .exe

### Phase 2: Screenshot Capture (Days 4–6)

**Goal**: App captures screenshots from any game window, stores in rolling buffer.

- [ ] Integrate `windows-capture` crate
- [ ] Implement window enumeration (Win32 EnumWindows)
- [ ] Build `WindowPicker` React component (dropdown with refresh button)
- [ ] Implement `CaptureManager` Rust module:
  - Start/stop capture for selected window
  - JPEG compression via `turbojpeg`
  - Rolling buffer (`VecDeque<CapturedFrame>`, capacity 30)
- [ ] Wire up Tauri commands: `list_windows`, `start_capture`, `stop_capture`, `get_buffer_status`
- [ ] Test with Minecraft fullscreen, Valorant fullscreen, a windowed app
- [ ] Verify < 2% CPU overhead during capture

### Phase 3: Push-to-Talk + Audio (Days 7–9)

**Goal**: PTT works during fullscreen games. Audio records and plays back.

- [ ] Integrate `rdev` for global keyboard/mouse hooks
- [ ] Implement `HotkeyManager` with configurable PTT key
- [ ] Build `PTTIndicator` React component (listening/processing/ready states)
- [ ] Integrate `cpal` for microphone capture
- [ ] Implement `AudioRecorder`:
  - WASAPI shared mode
  - 300ms pre-roll buffer
  - On PTT release: resample → mono → WAV encode
- [ ] Integrate `rodio` for audio playback
- [ ] Implement `AudioPlayer`:
  - Play MP3/WAV bytes
  - Play feedback cue sounds
- [ ] Wire up Tauri commands + events: `set_ptt_key`, `ptt-started`, `ptt-stopped`
- [ ] Test: hold PTT in fullscreen Minecraft, speak, verify WAV output is clean
- [ ] Test: play a test MP3 while game audio is running (verify no interference)

### Phase 4: Voice Pipeline (Days 10–13)

**Goal**: Full voice loop works — ask a question, hear coaching response.

- [ ] Define `CoachingService` trait (the Service Abstraction Layer)
- [ ] Implement `LocalCoachingService`:
  - `transcribe()`: async-openai Whisper call
  - `analyze_gameplay()`: async-openai GPT-4o Vision call with screenshots + system prompt
  - `text_to_speech()`: async-openai TTS call
- [ ] Build `VoicePipeline` orchestrator module:
  - Wire PTT release → WAV → STT → Vision → TTS → playback
  - Add timing logs at every step
  - Handle errors at each step with appropriate user feedback
- [ ] Create system prompts for 3 games (Minecraft, Valorant, Generic)
- [ ] Wire up Tauri event flow:
  - `ptt-stopped` → `voice_pipeline::process_query()` → `query-complete` / `query-error`
- [ ] Test end-to-end: PTT → ask question → hear answer
- [ ] Measure latency, log to console

### Phase 5: Local RAG (Days 14–16)

**Goal**: RAG context improves coaching response quality.

- [ ] Integrate `rusqlite` + `sqlite-vec`
- [ ] Integrate `fastembed` with AllMiniLM-L6-v2
- [ ] Implement `RagDatabase` module:
  - Init SQLite, create tables
  - Seed from bundled JSON
  - Embed query → cosine similarity search → return top 3
- [ ] Add `rag_search()` to `LocalCoachingService`
- [ ] Create seed data for Minecraft (20 entries), Valorant (20 entries), Generic (10 entries)
- [ ] Wire RAG into voice pipeline (inject results into GPT-4o system prompt)
- [ ] Test: ask a Minecraft question → verify RAG context appears in response
- [ ] Compare response quality with/without RAG

### Phase 6: Game Profiles + UI Polish (Days 17–19)

**Goal**: Multiple game profiles work. UI is functional and clear.

- [ ] Implement all 8 game profiles with system prompts
- [ ] Create seed data for remaining games (basic — 10 entries each)
- [ ] Build `GameSelector` component
- [ ] Build `StatusLog` component (scrolling activity log with timestamps)
- [ ] Build `SettingsPanel` (audio devices, PTT key, TTS voice)
- [ ] Implement settings persistence (save/load all user preferences)
- [ ] Audio device selection (mic input + speaker output dropdowns)
- [ ] Add audio feedback cues (PTT click, error chime)
- [ ] Handle edge cases: window closed during capture, device disconnected, API timeout

### Phase 7: Testing + Packaging (Days 20–22)

**Goal**: App is stable, installable, and demonstrable.

- [ ] Test with 5+ games in fullscreen
- [ ] 30-minute stability test (no crashes, no memory leaks)
- [ ] Test PTT with Mouse4, Mouse5, Tilde, F13
- [ ] Test audio with headphones, speakers, Bluetooth
- [ ] Build NSIS installer: `cargo tauri build`
- [ ] Test fresh install on a clean Windows 10 VM
- [ ] Test fresh install on Windows 11
- [ ] Write basic README with setup instructions
- [ ] Record a demo video of the full voice loop working

---

## 18. Claude Code Project Architecture

### Project Structure

```
gamerclone/
├── src-tauri/                        # Rust backend (Tauri)
│   ├── Cargo.toml                    # Rust dependencies
│   ├── build.rs                      # Tauri build script
│   ├── tauri.conf.json               # Tauri configuration
│   ├── capabilities/                 # Tauri v2 permission capabilities
│   │   └── default.json
│   ├── icons/                        # App icons (ico, png)
│   ├── src/
│   │   ├── main.rs                   # Entry point, Tauri builder, state init
│   │   ├── lib.rs                    # Module declarations
│   │   │
│   │   ├── capture/                  # Screenshot capture module
│   │   │   ├── mod.rs
│   │   │   ├── manager.rs            # CaptureManager: start/stop/buffer
│   │   │   ├── window_list.rs        # Win32 window enumeration
│   │   │   └── frame_buffer.rs       # VecDeque<CapturedFrame> with RwLock
│   │   │
│   │   ├── audio/                    # Audio recording + playback module
│   │   │   ├── mod.rs
│   │   │   ├── recorder.rs           # Mic capture via cpal, WAV encoding
│   │   │   ├── player.rs             # Playback via rodio
│   │   │   └── devices.rs            # Audio device enumeration
│   │   │
│   │   ├── hotkeys/                  # Push-to-talk module
│   │   │   ├── mod.rs
│   │   │   └── manager.rs            # rdev hooks, PTT state machine
│   │   │
│   │   ├── services/                 # Service Abstraction Layer
│   │   │   ├── mod.rs                # CoachingService trait definition
│   │   │   ├── local.rs              # LocalCoachingService (POC: direct OpenAI)
│   │   │   ├── remote.rs             # RemoteCoachingService (MVP: via API)
│   │   │   └── types.rs              # Shared types: Screenshot, KnowledgeChunk, etc.
│   │   │
│   │   ├── pipeline/                 # Voice pipeline orchestrator
│   │   │   ├── mod.rs
│   │   │   └── orchestrator.rs       # STT → RAG → Vision → TTS flow
│   │   │
│   │   ├── rag/                      # Local RAG module (POC)
│   │   │   ├── mod.rs
│   │   │   ├── database.rs           # SQLite + sqlite-vec init, query
│   │   │   ├── embeddings.rs         # fastembed wrapper
│   │   │   └── seed_data/            # JSON seed files per game
│   │   │       ├── minecraft.json
│   │   │       ├── valorant.json
│   │   │       ├── cs2.json
│   │   │       ├── fortnite.json
│   │   │       ├── league.json
│   │   │       ├── elden_ring.json
│   │   │       ├── rocket_league.json
│   │   │       └── generic.json
│   │   │
│   │   ├── profiles/                 # Game profile definitions
│   │   │   ├── mod.rs
│   │   │   └── profiles.rs           # GameProfile structs + system prompts
│   │   │
│   │   ├── commands/                 # Tauri IPC command handlers
│   │   │   ├── mod.rs
│   │   │   ├── capture_commands.rs   # list_windows, start_capture, etc.
│   │   │   ├── audio_commands.rs     # set_audio_device, test_mic, etc.
│   │   │   ├── hotkey_commands.rs    # set_ptt_key, get_ptt_key
│   │   │   ├── voice_commands.rs     # process_voice_query (main pipeline trigger)
│   │   │   ├── profile_commands.rs   # list_profiles, set_active_profile
│   │   │   └── settings_commands.rs  # get_settings, save_settings
│   │   │
│   │   └── state.rs                  # AppState struct (managed by Tauri)
│   │
│   └── resources/                    # Bundled resources
│       ├── sounds/                   # Audio cue files
│       │   ├── ptt_on.wav
│       │   ├── ptt_off.wav
│       │   └── error.wav
│       └── models/                   # (Optional) Bundled embedding model
│
├── src/                              # React frontend
│   ├── main.tsx                      # React entry
│   ├── App.tsx                       # Root layout + routing
│   ├── index.css                     # Tailwind imports
│   ├── components/
│   │   ├── WindowPicker.tsx          # Game window selection dropdown
│   │   ├── GameSelector.tsx          # Game profile picker
│   │   ├── PTTIndicator.tsx          # Push-to-talk status (ready/listening/thinking)
│   │   ├── StatusLog.tsx             # Scrolling activity log
│   │   ├── SettingsPanel.tsx         # Audio devices, PTT key, voice selection
│   │   ├── SetupWizard.tsx           # First-launch onboarding
│   │   └── TrayTooltip.tsx           # (if Tauri supports custom tray tooltips)
│   ├── hooks/
│   │   ├── useVoiceQuery.ts          # Listen for PTT events, manage query state
│   │   ├── useCapture.ts             # Capture status, window selection
│   │   └── useSettings.ts            # Read/write settings via tauri-plugin-store
│   ├── stores/
│   │   └── appStore.ts               # Zustand store for UI state
│   ├── lib/
│   │   └── tauri.ts                  # Typed wrappers for invoke() calls
│   └── types/
│       └── index.ts                  # Shared TypeScript types
│
├── .env.example                      # Template for required env vars
├── package.json                      # Frontend dependencies
├── pnpm-lock.yaml
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── CLAUDE.md                         # Claude Code instructions
└── README.md
```

### CLAUDE.md (For Claude Code)

```markdown
# GamerClone — Claude Code Instructions

## What This Is
A Tauri 2.0 desktop app (Rust + React/TypeScript) that acts as a voice AI coach for PC gamers.
Windows only. POC phase — everything runs locally.

## The Voice Loop (Core Feature)
PTT key held → record audio → release → Whisper STT → RAG search → GPT-4o Vision (with screenshots) → TTS → play audio

## Tech Stack
- **Framework**: Tauri 2.0 (Rust backend, React frontend)
- **Screen Capture**: windows-capture 2.0 crate (WGC + DXGI)
- **Global Hotkeys**: rdev crate (low-level Windows hooks)
- **Audio**: cpal (recording) + rodio (playback) + hound (WAV) + rubato (resample)
- **AI**: async-openai crate (Whisper, GPT-4o, TTS)
- **RAG**: rusqlite + sqlite-vec + fastembed-rs
- **Image**: turbojpeg (JPEG compression) + image (resize)
- **Frontend**: React 18 + TypeScript + Tailwind + Zustand

## Critical Architecture Rules
1. All AI service calls go through the `CoachingService` trait (src-tauri/src/services/mod.rs)
2. POC uses `LocalCoachingService` (direct OpenAI calls)
3. MVP will swap to `RemoteCoachingService` (calls GamerClone.com API)
4. Screenshots NEVER touch disk — memory only
5. OpenAI API key lives in .env, NEVER hardcoded
6. Capture, hotkeys, and audio each run on dedicated OS threads
7. Async API calls use Tauri's built-in Tokio runtime
8. All Tauri commands return Result<T, String> for proper error handling

## Module Ownership
- capture/ — Screenshot capture, window enumeration, frame buffer
- audio/ — Mic recording, speaker playback, device management
- hotkeys/ — Push-to-talk hook, key binding configuration
- services/ — CoachingService trait + LocalCoachingService implementation
- pipeline/ — Voice query orchestrator (wires everything together)
- rag/ — SQLite vector database, fastembed embeddings, seed data
- profiles/ — Game profile definitions and system prompts
- commands/ — Tauri IPC command handlers (thin wrappers over modules)

## Commands
- `pnpm install` — Install frontend dependencies
- `cargo tauri dev` — Run in development mode (hot reload)
- `cargo tauri build` — Build NSIS Windows installer

## Environment Variables (.env in project root)
OPENAI_API_KEY=sk-proj-...    # Required

## Performance Rules
- JPEG quality: 75, resize to 1280x720 before compression
- Screenshot buffer: 30 frames max (~3-6 MB)
- Capture interval: 2 seconds
- Max recording: 30 seconds
- TTS voice: nova (default)
- GPT-4o max_tokens: 200 (keep responses short for voice)
- Vision detail: low (85 tokens per image)
```

### Subagents for Claude Code

**1. rust-backend** — Tauri Rust specialist
```
Owns: src-tauri/src/**
Focus: windows-capture, cpal, rodio, rdev, async-openai, rusqlite, fastembed
Rules: Never expose API keys. Use tracing for logging. All commands return Result.
```

**2. react-frontend** — React/TypeScript UI specialist
```
Owns: src/**
Focus: React components, Tailwind, Zustand, Tauri IPC (invoke/emit)
Rules: Use @tauri-apps/api for IPC. Never import Rust types directly. Minimal UI for POC.
```

**3. voice-pipeline** — AI integration specialist
```
Owns: src-tauri/src/services/**, src-tauri/src/pipeline/**, src-tauri/src/rag/**
Focus: OpenAI APIs, system prompts, RAG, latency optimization
Rules: All calls through CoachingService trait. Log timing at every step. Max 200 tokens for Vision responses.
```

**4. qa-testing** — Testing and quality
```
Owns: Tests, build verification, performance measurement
Focus: Fullscreen game capture testing, PTT testing, latency measurement, memory profiling
Rules: Test on Windows 10 + 11. Test with 3+ games. 30-min stability test required.
```

---

*End of Product Requirements Document*
