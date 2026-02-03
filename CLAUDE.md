# GamerClone - Claude Code Project Instructions

## Project Overview

GamerClone is an AI-powered voice coaching application for PC gamers. The app runs in the system tray, captures screenshots of any selected game window, and provides real-time voice coaching via push-to-talk interaction.

**Tech Stack**: Electron + React + TypeScript + Supabase + OpenAI APIs

## Quick Start

```bash
# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY

# Start development
npm run dev
```

## Project Structure

```
gamerclone/
├── src/
│   ├── main/           # Electron main process
│   ├── renderer/       # React UI
│   └── shared/         # Shared types & utilities
├── supabase/
│   ├── functions/      # Edge Functions
│   └── migrations/     # Database migrations
└── tests/              # Test files
```

## Subagent Routing

| Task Type | Subagent |
|-----------|----------|
| React components, Tailwind, Zustand | `frontend-engineer` |
| Electron main process, Supabase, Edge Functions | `backend-engineer` |
| Audio capture, STT, Vision, TTS, prompts | `voice-engineer` |
| Tests, debugging, code review | `qa-engineer` |

## Critical Rules

1. **NEVER hardcode API keys** - All secrets go in `.env` or Supabase
2. **ALWAYS use IPC** - Renderer cannot access Node.js APIs directly
3. **ALWAYS validate inputs** - IPC handlers must validate all data
4. **NEVER store media to disk** - Screenshots and audio stay in memory
5. **Route all API calls through Edge Functions** - No direct OpenAI calls from client

## Code Style

- TypeScript strict mode enabled
- Functional components with hooks
- Tailwind for all styling
- Zustand for state management
- Vitest for testing

## Common Commands

```bash
# Development
npm run dev              # Start dev server
npm run lint             # Run ESLint
npm run type-check       # TypeScript check

# Testing
npm run test             # Run unit tests
npm run test:e2e         # Run E2E tests
npm run test:coverage    # Coverage report

# Supabase
npm run db:migrate       # Run migrations
npm run db:reset         # Reset database
npm run functions:serve  # Local Edge Functions
npm run functions:deploy # Deploy Edge Functions

# Build
npm run build            # Build for production
npm run build:win        # Windows installer
npm run build:mac        # macOS DMG
```

## Environment Variables

```env
# Required for client
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=xxx

# Required for Edge Functions (set in Supabase dashboard)
OPENAI_API_KEY=sk-xxx
```

## Database Schema

Key tables:
- `profiles` - User profile data
- `subscriptions` - License/subscription status
- `activations` - Machine registration
- `usage` - Daily query counts
- `user_settings` - User preferences

All tables have RLS enabled. See `supabase/migrations/` for full schema.

## Voice Pipeline Flow

```
PTT Press → Record Audio → PTT Release
                ↓
        Encode to WAV → Base64
                ↓
        Edge Function: voice-query
                ↓
        ┌───────────────────────┐
        │ 1. Whisper STT        │
        │ 2. GPT-4 Vision       │
        │ 3. OpenAI TTS         │
        └───────────────────────┘
                ↓
        Audio Response → Play
```

## Game Profiles

16 pre-built profiles in `src/shared/game-profiles.ts`:
- Minecraft, Valheim, Terraria
- Valorant, CS2, Fortnite, Apex, Overwatch
- League of Legends, Dota 2
- Elden Ring, WoW
- Rocket League, EA FC
- Civ 6, Age of Empires 4
- Generic (fallback)

## Testing Requirements

- Unit tests for all Zustand stores
- Integration tests for IPC handlers
- E2E tests for critical user flows
- Minimum 80% coverage on business logic

## Before Committing

1. Run `npm run lint`
2. Run `npm run type-check`
3. Run `npm run test`
4. Update tests if adding features
5. Document any new environment variables
