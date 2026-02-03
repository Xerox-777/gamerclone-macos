# GamerClone - AI Voice Coach for Any Game

🎮 **Voice-to-voice AI coaching for PC games** - Ask questions about your gameplay and get instant spoken advice.

## Features

- **Universal Game Support** - Works with any PC game via screenshot capture
- **Voice-to-Voice** - Push-to-talk voice input, AI speaks responses
- **Game Profiles** - Pre-built coaching knowledge for 15+ popular games
- **Zero Game Interference** - Runs alongside games, no mods or injections
- **Low Resource Usage** - Designed to minimize impact on game performance

## How It Works

1. **Screenshot Capture** - App silently captures screenshots every 2 seconds
2. **Push-to-Talk** - Press your hotkey and ask a question
3. **AI Analysis** - Claude Vision analyzes recent screenshots + your question  
4. **Voice Response** - AI coach speaks the answer through your speakers

## Supported Games (Pre-built Profiles)

| Game | Profile ID |
|------|------------|
| Minecraft | `minecraft` |
| Valheim | `valheim` |
| Terraria | `terraria` |
| Valorant | `valorant` |
| CS2 / CS:GO | `csgo` |
| Fortnite | `fortnite` |
| Apex Legends | `apex` |
| Overwatch 2 | `overwatch` |
| League of Legends | `lol` |
| Dota 2 | `dota2` |
| Elden Ring | `elden_ring` |
| World of Warcraft | `wow` |
| Rocket League | `rocket_league` |
| EA FC / FIFA | `fifa` |
| Civilization VI | `civ6` |
| Age of Empires IV | `aoe4` |

Plus a **Generic** profile that works with any game!

## Development Setup

### Prerequisites

- Node.js 18+ (LTS recommended)
- npm or yarn
- Windows 10/11 (for development)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/gamerclone.git
cd gamerclone

# Install dependencies
npm install

# Start in development mode
npm run dev
```

### Project Structure

```
gamerclone-mvp/
├── src/
│   ├── main/               # Electron main process
│   │   ├── main.js         # App entry point, system tray, IPC
│   │   ├── preload.js      # Secure bridge to renderer
│   │   ├── voice-pipeline.js   # STT → LLM → TTS pipeline
│   │   └── license-manager.js  # License validation
│   │
│   ├── renderer/           # UI (settings window)
│   │   ├── index.html
│   │   ├── styles.css
│   │   └── renderer.js
│   │
│   └── shared/
│       └── game-profiles.js    # Game-specific coaching knowledge
│
├── assets/                 # Icons, sounds
├── game-profiles/          # Additional profile data
└── package.json
```

## Configuration

### API Keys

The app requires API keys for:

1. **Deepgram** - Speech-to-text ($0.0077/minute)
2. **Anthropic Claude** - Vision analysis (~$0.02-0.03/query)
3. **ElevenLabs** - Text-to-speech (~$0.05-0.15/query)

In production, these are provided by your backend after license validation.

For development, set environment variables:
```bash
export DEEPGRAM_API_KEY=your_key
export ANTHROPIC_API_KEY=your_key
export ELEVENLABS_API_KEY=your_key
```

### License Server

The app validates licenses against your backend API:

**Endpoint**: `POST https://api.gamerclone.com/license/validate`

**Request**:
```json
{
  "license_key": "XXXX-XXXX-XXXX-XXXX",
  "machine_id": "unique-machine-identifier",
  "app_version": "1.0.0"
}
```

**Response** (success):
```json
{
  "valid": true,
  "license_type": "pro",
  "expires_at": "2025-12-31T23:59:59Z",
  "api_keys": {
    "deepgram": "...",
    "anthropic": "...",
    "eleven_labs": "..."
  }
}
```

## Building for Production

### Windows Installer

```bash
# Build Windows installer
npm run build:win
```

This creates:
- `dist/GamerClone Setup x.x.x.exe` - NSIS installer
- `dist/win-unpacked/` - Portable version

### Code Signing

For production releases, sign your executables to avoid SmartScreen warnings:

1. Obtain an OV code signing certificate (~$200-300/year)
2. Configure in `package.json`:

```json
{
  "build": {
    "win": {
      "certificateFile": "path/to/cert.pfx",
      "certificatePassword": "your-password"
    }
  }
}
```

## Backend Requirements

You'll need to build a backend API that:

1. **License Management**
   - Generate license keys
   - Validate licenses against machine IDs
   - Handle activations/deactivations
   - Manage subscription status

2. **API Key Proxy** (recommended)
   - Store API keys server-side
   - Proxy requests through your backend
   - Rate limit by license tier
   - Track usage for billing

3. **Subscription Integration**
   - LemonSqueezy or Paddle for payments
   - Webhook handlers for subscription events
   - License key generation on purchase

## Estimated Costs Per User

| Service | Usage/Query | Cost/Query | Monthly (100 queries) |
|---------|-------------|------------|----------------------|
| Deepgram STT | ~5 sec audio | $0.0006 | $0.06 |
| Claude Vision | 3-5 images | $0.02-0.03 | $2.00-3.00 |
| ElevenLabs TTS | ~500 chars | $0.02-0.05 | $2.00-5.00 |
| **Total** | | | **$4-8/month** |

Recommended pricing: **$9-15/month** for healthy margins.

## Adding New Game Profiles

1. Edit `src/shared/game-profiles.js`
2. Add a new profile object:

```javascript
newgame: {
  id: 'newgame',
  name: 'New Game Title',
  icon: '🎮',
  context: `Description of the game and its core mechanics...`,
  tips: `
- Tip 1
- Tip 2
- Tip 3
`
}
```

3. The profile will auto-detect from window title if it contains the game name.

## Troubleshooting

### "Screenshot capture shows black screen"
- Ensure Minecraft/game is running in **Borderless Windowed** mode
- True fullscreen games may require DXGI Desktop Duplication fallback

### "Push-to-talk doesn't work in game"
- Run GamerClone as Administrator if the game runs as Admin
- Try a different hotkey (Mouse4/Mouse5 recommended)

### "Voice not being recognized"
- Check microphone permissions in Windows Settings
- Verify correct audio input device is selected
- Test with the "Test Voice" button

### "License validation fails"
- Check internet connection
- Verify license key is entered correctly
- Contact support if issues persist

## Security Notes

- API keys are stored encrypted using Windows Credential Manager
- Screenshots are processed in memory only, never saved to disk
- No gameplay data is stored or transmitted except during active queries
- Machine ID is hashed for privacy

## License

Proprietary - All rights reserved by GamerClone.com

## Support

- Website: https://gamerclone.com
- Help: https://gamerclone.com/help
- Email: support@gamerclone.com
