# GamerClone

Real-time AI voice coach for PC gamers. Select a game window, press push-to-talk, ask a question, and hear a spoken coaching response — all while the game stays in focus. No overlay, no alt-tabbing. Powered by GPT-4o Vision, Whisper STT, and TTS with game-specific RAG knowledge bases.

## How It Works

1. **Push-to-Talk** — Hold a hotkey (default: Mouse4) to record your question via microphone
2. **Speech-to-Text** — Audio is sent to OpenAI Whisper for transcription
3. **RAG Search** — The question is matched against a game-specific knowledge base using local vector embeddings
4. **Vision Analysis** — Recent screenshots + transcription + RAG context are sent to GPT-4o Vision for analysis
5. **Text-to-Speech** — The coaching response is converted to speech and played through your speakers

Target latency: under 5 seconds from PTT release to hearing the response.

## Requirements

- **Windows 10 or 11** (64-bit)
- **OpenAI API key** with access to GPT-4o, Whisper, and TTS
- **Rust** 1.70+ (`rustup` recommended)
- **Node.js** 18+ and **pnpm** 8+
- **CMake** (for turbojpeg SIMD compilation)
- **NASM** (for turbojpeg assembly)

Install build tools on Windows:
```powershell
winget install Kitware.CMake
winget install NASM.NASM
```

## Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/gamerclone.git
cd gamerclone

# Install frontend dependencies
pnpm install

# Create .env file with your OpenAI API key
echo "OPENAI_API_KEY=sk-proj-your-key-here" > .env

# Run in development mode (hot reload)
cargo tauri dev
```

On first launch, the app downloads the AllMiniLM-L6-v2 embedding model (~38MB) and seeds the RAG database. This is a one-time operation.

## Building the Installer

```bash
cargo tauri build
```

Output: `src-tauri/target/release/bundle/nsis/GamerClone_0.1.0_x64-setup.exe`

The installer is unsigned, so Windows SmartScreen will show a warning on first run. Click "More info" then "Run anyway" to proceed.

## Running Tests

```bash
# Run all unit tests (fast, no external dependencies)
cd src-tauri && cargo test

# Run RAG integration tests (slow, downloads ~38MB embedding model)
cd src-tauri && cargo test -- --ignored

# TypeScript type checking
npx tsc --noEmit
```

## Configuration

Environment variables in `.env` (project root):

| Variable | Default | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | *(required)* | OpenAI API key |
| `TTS_VOICE` | `nova` | TTS voice: alloy, echo, fable, onyx, nova, shimmer |
| `TTS_MODEL` | `tts-1` | TTS model |
| `VISION_MODEL` | `gpt-4o` | Vision model for gameplay analysis |
| `VISION_DETAIL` | `low` | Image detail level (low = 85 tokens/image) |
| `VISION_MAX_TOKENS` | `200` | Max response tokens from Vision API |
| `CAPTURE_INTERVAL_MS` | `2000` | Screenshot capture interval in ms |
| `CAPTURE_QUALITY` | `75` | JPEG quality (1-100) |
| `CAPTURE_MAX_FRAMES` | `30` | Rolling screenshot buffer size |

## Supported Games

| Game | Profile ID | Screenshots | Max Tokens | Genre |
|------|-----------|-------------|------------|-------|
| Minecraft | `minecraft` | 5 | 200 | Sandbox / Survival |
| Valorant | `valorant` | 3 | 150 | Tactical FPS |
| Counter-Strike 2 | `cs2` | 3 | 150 | Tactical FPS |
| Fortnite | `fortnite` | 4 | 150 | Battle Royale |
| League of Legends | `league` | 5 | 200 | MOBA |
| Elden Ring | `elden_ring` | 5 | 200 | Action RPG |
| Rocket League | `rocket_league` | 3 | 100 | Sports / Vehicular |
| Generic | `generic` | 5 | 200 | Any game |

Each profile has a tailored system prompt, RAG knowledge base, and tuned parameters for that game's pace.

## Architecture

- **Desktop Framework**: Tauri 2.0 (Rust backend + React frontend)
- **Screen Capture**: windows-capture 2.0 (WGC + DXGI Desktop Duplication)
- **Audio**: cpal (WASAPI recording), rodio (playback), hound (WAV), rubato (resampling)
- **Global Hotkeys**: rdev (low-level Windows hooks, works in fullscreen)
- **AI**: async-openai (Whisper STT, GPT-4o Vision, TTS-1)
- **RAG**: rusqlite + sqlite-vec + fastembed (AllMiniLM-L6-v2, 384 dims)
- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Zustand

## Project Structure

```
src-tauri/src/
  main.rs              Tauri entry point
  lib.rs               Module declarations
  state.rs             AppState (owns all managers)
  capture/             Screen capture (windows-capture)
  audio/               Recording, playback, encoding, cues
  hotkeys/             Global PTT hotkey (rdev)
  services/            CoachingService trait + LocalCoachingService
  pipeline/            Voice pipeline orchestrator
  rag/                 SQLite vector DB + embeddings + seed data
  profiles/            8 game profile definitions
  commands/            Tauri IPC command handlers

src/
  App.tsx              Main layout
  components/          WindowPicker, GameSelector, PTTIndicator, StatusLog, SettingsPanel, SetupWizard
  hooks/               useCapture, usePTT, useAudio
  stores/              Zustand app store
  lib/                 Typed Tauri invoke wrappers
  types/               TypeScript interfaces
```

## Known Limitations

- **Windows only** — macOS and Linux are not supported
- **Unsigned installer** — SmartScreen warning on first run
- **First-launch delay** — Embedding model download takes 30-60 seconds
- **API costs** — Each voice query costs ~$0.01-0.03 (Whisper + GPT-4o Vision + TTS)
- **Anti-cheat** — Some games with kernel-level anti-cheat (Vanguard, EAC) may block screen capture
- **No overlay** — Responses are audio-only; the text log is in the app window
- **POC scope** — No auth, no server, no payments; runs entirely on the developer's machine

## License

Proprietary. All rights reserved.
