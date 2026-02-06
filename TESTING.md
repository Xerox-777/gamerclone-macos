# GamerClone Manual Testing Checklist

Use this checklist when testing before a release. Check off each item as you verify it.

---

## 1. Fullscreen Game Capture

Test screen capture with each game in fullscreen/borderless mode.

| Game | Capture Works | FPS Impact < 5% | Notes |
|------|:---:|:---:|-------|
| Minecraft (Fullscreen) | [ ] | [ ] | |
| Valorant (Fullscreen) | [ ] | [ ] | Vanguard anti-cheat may interfere |
| Counter-Strike 2 (Fullscreen) | [ ] | [ ] | |
| Fortnite (Fullscreen) | [ ] | [ ] | EAC may interfere |
| League of Legends (Borderless) | [ ] | [ ] | |
| Elden Ring (Fullscreen) | [ ] | [ ] | EAC may interfere |
| Rocket League (Fullscreen) | [ ] | [ ] | |

### Capture Verification Steps
- [ ] Window picker shows the game in the dropdown
- [ ] "Start Capture" begins without error
- [ ] Status shows "Capturing" with frame count incrementing
- [ ] "Stop Capture" cleanly stops (no hanging threads)
- [ ] Re-starting capture after stop works correctly

---

## 2. 30-Minute Stability Test

Run the app with capture active for 30 minutes (game running in background).

- [ ] No crash or hang during 30-minute window
- [ ] Memory usage stays under 200 MB (check Task Manager)
- [ ] CPU usage under 5% when idle (not processing queries)
- [ ] No error spam in the tracing log output
- [ ] Frame buffer stays at configured capacity (30 frames)

---

## 3. PTT Key Testing

Test each supported PTT binding. For each key:

| PTT Key | Press Detected | Release Detected | Works in Fullscreen |
|---------|:---:|:---:|:---:|
| Mouse Button 4 (default) | [ ] | [ ] | [ ] |
| Mouse Button 5 | [ ] | [ ] | [ ] |
| Tilde (~) | [ ] | [ ] | [ ] |
| F5 | [ ] | [ ] | [ ] |
| CapsLock | [ ] | [ ] | [ ] |

### PTT Verification Steps
- [ ] PTT indicator shows "Listening" (yellow) when key is held
- [ ] PTT indicator returns to "Ready" (green) on release
- [ ] Short taps (< 200ms) are filtered out (no processing triggered)
- [ ] 30-second max recording limit works (auto-stops)
- [ ] Audio cue plays on press and release
- [ ] PTT key rebinding in Settings works (enter rebind mode, press new key, saves)
- [ ] Blocked keys (WASD, Space, Shift, etc.) are rejected during rebinding

---

## 4. Audio Device Testing

Test with different audio hardware configurations.

| Device Type | Recording Works | Playback Works | Notes |
|-------------|:---:|:---:|-------|
| Default headset mic + headphones | [ ] | [ ] | |
| USB microphone | [ ] | [ ] | |
| Bluetooth headset | [ ] | [ ] | May have latency |
| HDMI audio (speakers) | N/A | [ ] | Output only |
| Built-in laptop speakers | N/A | [ ] | Output only |

### Audio Verification Steps
- [ ] Device dropdown lists all available input devices
- [ ] Device dropdown lists all available output devices
- [ ] Selecting a different input device works immediately
- [ ] Selecting a different output device works immediately
- [ ] "Test Microphone" shows signal level / confirms recording
- [ ] Device selection persists after app restart
- [ ] Unplugging active device shows error (not a crash)

---

## 5. Voice Pipeline End-to-End

For each game profile, perform one full voice query cycle.

| Profile | Transcribing | Searching | Analyzing | Speaking | Latency < 5s |
|---------|:---:|:---:|:---:|:---:|:---:|
| Minecraft | [ ] | [ ] | [ ] | [ ] | [ ] |
| Valorant | [ ] | [ ] | [ ] | [ ] | [ ] |
| CS2 | [ ] | [ ] | [ ] | [ ] | [ ] |
| Fortnite | [ ] | [ ] | [ ] | [ ] | [ ] |
| League of Legends | [ ] | [ ] | [ ] | [ ] | [ ] |
| Elden Ring | [ ] | [ ] | [ ] | [ ] | [ ] |
| Rocket League | [ ] | [ ] | [ ] | [ ] | [ ] |
| Generic | [ ] | [ ] | [ ] | [ ] | [ ] |

### Pipeline Verification Steps
- [ ] Status log shows each stage: Transcribing -> Searching -> Analyzing -> Speaking
- [ ] Response is relevant to the question and game context
- [ ] TTS audio plays clearly through selected output device
- [ ] Response is 1-3 sentences (not too long)
- [ ] Consecutive queries work without issues
- [ ] Rapid PTT press/release doesn't cause race conditions

---

## 6. Error Handling

Simulate common error conditions and verify graceful behavior.

- [ ] **No capture active**: Voice query works but mentions no screenshots available
- [ ] **No microphone**: App shows error in status log (not a crash)
- [ ] **Very short PTT** (< 200ms): Filtered, no API call made
- [ ] **Missing API key**: App starts but shows clear error when query attempted
- [ ] **Invalid API key**: Error message displayed in status log
- [ ] **Network disconnected**: Timeout error displayed (not infinite hang)
- [ ] **TTS failure**: Text response displayed in status log (graceful fallback)
- [ ] **Long question** (30s recording): Whisper handles it, response still < 5s total

---

## 7. Fresh Install Testing

Test the NSIS installer on clean systems.

### Windows 11
- [ ] Installer runs (SmartScreen: "More info" -> "Run anyway")
- [ ] App installs to default location
- [ ] App launches from Start Menu shortcut
- [ ] First-launch setup wizard appears
- [ ] Embedding model downloads successfully
- [ ] RAG database seeds on first launch
- [ ] Full voice query works after setup
- [ ] Uninstaller removes all files cleanly

### Windows 10
- [ ] Same checks as Windows 11 above
- [ ] No compatibility issues with older Win32 APIs

### First Launch Verification
- [ ] Setup wizard Step 1: Microphone selection works
- [ ] Setup wizard Step 2: PTT key binding works
- [ ] Setup wizard Step 3: Game profile selection works
- [ ] Setup wizard Step 4: Window selection works
- [ ] Setup wizard completes and main UI appears
- [ ] Setup wizard doesn't appear on subsequent launches

---

## 8. Settings Persistence

Verify all user settings survive an app restart.

- [ ] PTT key binding persists
- [ ] Selected input device persists
- [ ] Selected output device persists
- [ ] Active game profile persists
- [ ] TTS voice selection persists
- [ ] Setup wizard "completed" state persists (doesn't re-show)
- [ ] Selected capture window persists (or gracefully handles if window is gone)

---

## Test Environment Notes

| Item | Value |
|------|-------|
| Windows Version | |
| GPU | |
| CPU | |
| RAM | |
| App Version | 0.1.0 |
| Test Date | |
| Tester | |
