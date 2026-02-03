# GamerClone User Guide

Your AI voice coach for PC games.

## What is GamerClone?

GamerClone is a desktop application that provides real-time voice coaching while you play PC games. Ask questions about your gameplay and get instant spoken advice from an AI coach that can see your screen.

**How it works:**
1. GamerClone silently captures screenshots of your game every 2 seconds
2. Press your hotkey and ask a question (e.g., "What should I build next?" or "Where's the enemy?")
3. The AI analyzes your recent screenshots along with your question
4. You hear a spoken response through your speakers

---

## Getting Started

### System Requirements

- Windows 10 or Windows 11
- Microphone (for voice input)
- Speakers or headphones (for AI responses)
- Internet connection (required for voice processing)

### First Launch

When you first open GamerClone, you'll see the settings window. The app requires a license key to activate.

### Activating Your License

1. Enter your license key in the format `XXXX-XXXX-XXXX-XXXX`
2. Click **Activate** (or press Enter)
3. Wait for validation - you'll see "Activating..."
4. Once activated, a green checkmark appears and all features become available

Don't have a license? Visit [gamerclone.com/buy](https://gamerclone.com/buy) to get one.

---

## Setting Up Your Game

### Selecting Your Game Window

1. Launch your game first (keep it running)
2. In GamerClone, click the **Refresh** button next to the window dropdown
3. Select your game from the dropdown list
4. GamerClone will begin capturing screenshots from that window

### Game Profiles

GamerClone includes pre-built coaching profiles for popular games. These profiles give the AI specific knowledge about game mechanics, strategies, and terminology.

**Auto-detection:** When you select a game window, GamerClone automatically tries to match it to a known profile based on the window title. You'll see a notification like "Auto-detected game: Minecraft".

**Manual selection:** You can also manually select a profile from the Game Profile dropdown.

**Generic profile:** For games without a specific profile, the Generic profile provides general gaming coaching that works with any game.

---

## Configuring Voice Settings

### Setting Your Push-to-Talk Hotkey

1. Click the **Click to set hotkey** button
2. The button changes to "Press any key..."
3. Press the key or mouse button you want to use
4. Your hotkey is now set and displayed

**Recommended:** Use Mouse4 or Mouse5 (side mouse buttons) to avoid conflicts with in-game controls.

### Selecting Audio Devices

**Microphone:** Choose your preferred microphone from the dropdown. This is what GamerClone uses to hear your questions.

**Speakers:** Choose your output device. This is where you'll hear the AI coach's responses.

### Testing Your Setup

Click **Test Voice** to verify everything is working. This tests the connection to the voice services and confirms your audio devices are configured correctly.

---

## Using Voice Coaching

### The Basic Workflow

1. **Start your game** and select it in GamerClone
2. **Minimize GamerClone** or let it run in the system tray
3. **Play your game** - screenshots are captured automatically in the background
4. **Press and hold your hotkey** when you have a question
5. **Speak your question** clearly (e.g., "What's the best weapon for this situation?")
6. **Release the hotkey** when you're done speaking
7. **Listen** as the AI coach responds through your speakers

### Understanding Status Indicators

The status badge at the top of the window shows what GamerClone is doing:

| Status | Meaning |
|--------|---------|
| **Ready** | Ready to accept voice input |
| **Listening** | Recording your voice (hotkey held) |
| **Processing** | Analyzing your question and generating a response |
| **Not Licensed** | License activation required |
| **Capture Off** | Screenshot capture is disabled |

### PTT Indicator

The large circular indicator in the settings window provides visual feedback:
- **Gray border** - Ready and waiting
- **Orange border (pulsing)** - Listening to your voice
- **Blue border** - Processing your request

---

## System Tray

GamerClone runs in the system tray so it doesn't interfere with your gaming.

### Minimizing to Tray

- Close the settings window - the app continues running in the tray
- Double-click the tray icon to reopen settings
- Your hotkey works even when the window is closed

### Tray Menu Options

Right-click the tray icon to access:

- **Open Settings** - Show the settings window
- **Start/Stop Capture** - Toggle screenshot capture on or off
- **Quit GamerClone** - Completely exit the application

### Screenshot Capture Toggle

You can also toggle screenshot capture using the switch in the footer of the settings window. When capture is off, GamerClone won't analyze your screen but the app remains running.

---

## Troubleshooting

### Screenshots show a black screen

Your game may be running in exclusive fullscreen mode, which blocks screen capture.

**Solution:** Change your game's display settings to **Borderless Windowed** or **Windowed** mode.

### Push-to-talk hotkey doesn't work in game

Some games run with elevated privileges, which can block global hotkeys.

**Solution:** Right-click GamerClone and select **Run as Administrator**.

### Voice not being recognized

The AI can't understand what you're saying.

**Solutions:**
- Check that the correct microphone is selected in Voice Settings
- Verify microphone permissions in Windows Settings > Privacy > Microphone
- Click **Test Voice** to verify the connection is working
- Speak clearly and avoid background noise

### License validation fails

Can't activate or validate your license.

**Solutions:**
- Check your internet connection
- Verify your license key is entered correctly (format: XXXX-XXXX-XXXX-XXXX)
- Contact support at support@gamerclone.com if issues persist

---

## Supported Games

GamerClone includes specialized coaching profiles for these games:

| Game | Profile |
|------|---------|
| Minecraft | Sandbox/survival coaching |
| Valheim | Viking survival tips |
| Terraria | 2D sandbox guidance |
| Valorant | Tactical FPS coaching |
| CS2 / CS:GO | Counter-Strike strategies |
| Fortnite | Battle royale tactics |
| Apex Legends | Movement and combat tips |
| Overwatch 2 | Hero and team strategies |
| League of Legends | MOBA coaching |
| Dota 2 | MOBA strategies |
| Elden Ring | Soulslike combat guidance |
| World of Warcraft | MMO tips and strategies |
| Rocket League | Car soccer mechanics |
| EA FC / FIFA | Football game tactics |
| Civilization VI | 4X strategy coaching |
| Age of Empires IV | RTS strategies |
| Generic | Works with any game |

---

## Getting Help

- **Help Center:** [gamerclone.com/help](https://gamerclone.com/help)
- **Privacy Policy:** [gamerclone.com/privacy](https://gamerclone.com/privacy)
- **Email Support:** support@gamerclone.com
