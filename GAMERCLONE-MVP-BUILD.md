---
title: GamerClone MVP - Full Development Build
slug: gamerclone-mvp-build
version: 1.0.0
target_environment: claude-code
project: gamerclone
created_at_utc: 2026-02-03T20:00:00Z
assumptions_made: true
risk_level: medium
internet_access: true
os_support: [windows, macos, linux]
shells: [bash, zsh, powershell]
agents_enabled: true
mcp_enabled: true
---

# GamerClone MVP - Complete Development Build

## Overview

### Problem Summary

GamerClone is an AI-powered voice coaching application for PC gamers. Players press a push-to-talk hotkey, ask a question about their gameplay, and receive spoken AI coaching based on visual analysis of their game screen. The app runs in the system tray, captures screenshots of any selected game window, and provides real-time voice guidance.

**Core Value Proposition**: Any gamer can have an expert AI coach watching their gameplay and answering questions in real-time via voice - no typing, no alt-tabbing.

### Success Criteria

- [ ] Electron desktop app runs from system tray on Windows/Mac
- [ ] User can authenticate via Supabase (email/password + social login)
- [ ] License/subscription validation gates access to AI features
- [ ] Push-to-talk captures audio and sends to OpenAI Whisper for STT
- [ ] Screenshots sent to OpenAI GPT-4 Vision for analysis
- [ ] Response spoken via OpenAI TTS or ElevenLabs
- [ ] 16+ game profiles provide game-specific coaching context
- [ ] Manual window selection for game capture
- [ ] Settings persist across sessions
- [ ] End-to-end latency under 3 seconds

### Non-Goals (MVP Scope)

- Mobile app versions
- Browser extension
- Auto-detection of games
- Overlay/HUD on game screen
- Multiplayer/team coaching
- Replay analysis
- Achievement tracking
- Social features

---

## Environment and Constraints

### Technology Stack

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| **Desktop Framework** | Electron | ^28.0.0 | Cross-platform desktop |
| **UI Framework** | React + TypeScript | ^18.2.0 | Renderer process |
| **Styling** | Tailwind CSS | ^3.4.0 | Utility-first CSS |
| **State Management** | Zustand | ^4.4.0 | Lightweight state |
| **Database/Auth** | Supabase | ^2.39.0 | PostgreSQL + Auth + Edge Functions |
| **Speech-to-Text** | OpenAI Whisper API | whisper-1 | Proof of concept |
| **Vision Analysis** | OpenAI GPT-4 Vision | gpt-4o | Screenshot analysis |
| **Text-to-Speech** | OpenAI TTS | tts-1 | Initial TTS (upgrade to ElevenLabs later) |
| **Build Tool** | Vite | ^5.0.0 | Fast bundling |
| **Packaging** | electron-builder | ^24.9.0 | Installers |

### Runtime Constraints

- Windows 10/11 and macOS 12+ supported
- Node.js 18+ LTS required for development
- Screenshots via Electron `desktopCapturer` API
- Audio capture via Web Audio API
- Global hotkeys via `electron-global-shortcut`
- Persistent storage via `electron-store`

### Security Constraints

- API keys NEVER stored client-side in production
- All API calls proxied through Supabase Edge Functions
- Supabase Row Level Security (RLS) enforced on all tables
- User sessions managed via Supabase Auth with refresh tokens
- License validation on every app launch
- Rate limiting per user tier

### Performance Targets

- App startup: < 3 seconds
- Screenshot capture interval: 2 seconds
- Voice query round-trip: < 3 seconds
- Memory usage: < 200MB idle
- CPU usage: < 5% idle

---

## Architecture and Design

### System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GAMERCLONE DESKTOP APP                      │
│                         (Electron)                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  System     │  │  Settings   │  │  Voice Pipeline         │  │
│  │  Tray       │  │  Window     │  │  (STT → LLM → TTS)      │  │
│  │             │  │  (React)    │  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│         │               │                    │                   │
│  ┌──────┴───────────────┴────────────────────┴───────────────┐  │
│  │                    IPC Bridge (Preload)                    │  │
│  └────────────────────────────────────────────────────────────┘  │
│         │               │                    │                   │
│  ┌──────┴───────┐ ┌─────┴─────┐  ┌──────────┴────────────────┐  │
│  │ Screenshot   │ │  Global   │  │  Audio Manager            │  │
│  │ Capture      │ │  Hotkeys  │  │  (Mic In / Speaker Out)   │  │
│  └──────────────┘ └───────────┘  └───────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ HTTPS
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SUPABASE BACKEND                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │  Auth       │  │  Database   │  │  Edge Functions         │  │
│  │  (Users)    │  │  (Postgres) │  │  (API Proxy)            │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
│                                              │                   │
└──────────────────────────────────────────────┼───────────────────┘
                                               │
                              ┌────────────────┼────────────────┐
                              ▼                ▼                ▼
                        ┌──────────┐    ┌──────────┐    ┌──────────┐
                        │  OpenAI  │    │  OpenAI  │    │  OpenAI  │
                        │  Whisper │    │  GPT-4o  │    │   TTS    │
                        │  (STT)   │    │ (Vision) │    │          │
                        └──────────┘    └──────────┘    └──────────┘
```

### Module Responsibilities

| Module | Responsibility |
|--------|----------------|
| `main/index.ts` | Electron main process entry, app lifecycle |
| `main/tray.ts` | System tray icon, context menu |
| `main/screenshot.ts` | Window enumeration, screenshot capture |
| `main/hotkeys.ts` | Global push-to-talk registration |
| `main/audio.ts` | Microphone capture, audio playback |
| `main/ipc-handlers.ts` | IPC communication with renderer |
| `renderer/App.tsx` | React settings UI root |
| `renderer/stores/` | Zustand state management |
| `renderer/components/` | UI components |
| `shared/types.ts` | Shared TypeScript types |
| `shared/game-profiles.ts` | Game-specific coaching data |

### Data Flow: Voice Query

```
1. User presses PTT hotkey
       │
       ▼
2. Audio capture starts (Web Audio API)
       │
       ▼
3. User releases PTT hotkey
       │
       ▼
4. Audio buffer → WAV encoding
       │
       ▼
5. Send to Supabase Edge Function: /functions/v1/voice-query
   - Audio (base64)
   - Recent screenshots (base64, last 3-5)
   - Game profile ID
   - User JWT token
       │
       ▼
6. Edge Function:
   a. Validate JWT & subscription
   b. Send audio → OpenAI Whisper → transcript
   c. Build prompt with game profile + screenshots
   d. Send → OpenAI GPT-4 Vision → response text
   e. Send response → OpenAI TTS → audio bytes
   f. Return audio to client
       │
       ▼
7. Client plays audio response
```

---

## Supabase Schema Design

### Database Tables

```sql
-- Users profile extension (extends auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  display_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subscription/license management
CREATE TABLE public.subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled', 'expired', 'trial')),
  plan TEXT NOT NULL CHECK (plan IN ('free', 'pro', 'lifetime')),
  provider TEXT NOT NULL CHECK (provider IN ('lemonsqueezy', 'manual', 'trial')),
  provider_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Machine/device activation tracking
CREATE TABLE public.activations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  machine_id TEXT NOT NULL,
  machine_name TEXT,
  platform TEXT,
  app_version TEXT,
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, machine_id)
);

-- Usage tracking for rate limiting
CREATE TABLE public.usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  query_count INTEGER DEFAULT 0,
  audio_minutes DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- User preferences/settings
CREATE TABLE public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ptt_key TEXT DEFAULT 'Mouse4',
  audio_input_device TEXT DEFAULT 'default',
  audio_output_device TEXT DEFAULT 'default',
  selected_game_profile TEXT DEFAULT 'generic',
  voice_id TEXT DEFAULT 'alloy',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_activations_user_id ON public.activations(user_id);
CREATE INDEX idx_usage_user_date ON public.usage(user_id, date);
```

### Row Level Security Policies

```sql
-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Profiles: users can only read/update their own
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- Subscriptions: users can only read their own
CREATE POLICY "Users can view own subscription" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- Activations: users can manage their own
CREATE POLICY "Users can view own activations" ON public.activations
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own activations" ON public.activations
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own activations" ON public.activations
  FOR DELETE USING (auth.uid() = user_id);

-- Usage: users can view their own
CREATE POLICY "Users can view own usage" ON public.usage
  FOR SELECT USING (auth.uid() = user_id);

-- Settings: users can manage their own
CREATE POLICY "Users can manage own settings" ON public.user_settings
  FOR ALL USING (auth.uid() = user_id);
```

### Database Functions

```sql
-- Function to create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1))
  );
  
  -- Create trial subscription
  INSERT INTO public.subscriptions (user_id, status, plan, provider, current_period_end)
  VALUES (
    NEW.id,
    'trial',
    'free',
    'trial',
    NOW() + INTERVAL '7 days'
  );
  
  -- Create default settings
  INSERT INTO public.user_settings (user_id)
  VALUES (NEW.id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to check subscription status
CREATE OR REPLACE FUNCTION public.check_subscription(p_user_id UUID)
RETURNS TABLE (
  is_active BOOLEAN,
  plan TEXT,
  queries_remaining INTEGER,
  expires_at TIMESTAMPTZ
) AS $$
DECLARE
  v_subscription RECORD;
  v_usage RECORD;
  v_daily_limit INTEGER;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription
  FROM public.subscriptions
  WHERE user_id = p_user_id;
  
  -- Get today's usage
  SELECT * INTO v_usage
  FROM public.usage
  WHERE user_id = p_user_id AND date = CURRENT_DATE;
  
  -- Determine daily limit based on plan
  CASE v_subscription.plan
    WHEN 'free' THEN v_daily_limit := 10;
    WHEN 'pro' THEN v_daily_limit := 500;
    WHEN 'lifetime' THEN v_daily_limit := 1000;
    ELSE v_daily_limit := 10;
  END CASE;
  
  RETURN QUERY SELECT
    v_subscription.status IN ('active', 'trial') 
      AND (v_subscription.current_period_end IS NULL OR v_subscription.current_period_end > NOW()),
    v_subscription.plan,
    v_daily_limit - COALESCE(v_usage.query_count, 0),
    v_subscription.current_period_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment usage
CREATE OR REPLACE FUNCTION public.increment_usage(p_user_id UUID, p_audio_minutes DECIMAL DEFAULT 0)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.usage (user_id, date, query_count, audio_minutes)
  VALUES (p_user_id, CURRENT_DATE, 1, p_audio_minutes)
  ON CONFLICT (user_id, date)
  DO UPDATE SET
    query_count = public.usage.query_count + 1,
    audio_minutes = public.usage.audio_minutes + p_audio_minutes,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Supabase Edge Functions

### voice-query Function

```typescript
// supabase/functions/voice-query/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get user from JWT
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser()
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check subscription
    const { data: subscription } = await supabaseClient
      .rpc('check_subscription', { p_user_id: user.id })
      .single()

    if (!subscription?.is_active || subscription?.queries_remaining <= 0) {
      return new Response(JSON.stringify({ 
        error: 'Subscription inactive or query limit reached',
        queries_remaining: subscription?.queries_remaining ?? 0
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Parse request body
    const { audio_base64, screenshots, game_profile, voice_id } = await req.json()

    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    
    // Step 1: Speech-to-Text with Whisper
    const audioBuffer = Uint8Array.from(atob(audio_base64), c => c.charCodeAt(0))
    const audioBlob = new Blob([audioBuffer], { type: 'audio/wav' })
    
    const whisperForm = new FormData()
    whisperForm.append('file', audioBlob, 'audio.wav')
    whisperForm.append('model', 'whisper-1')
    whisperForm.append('language', 'en')

    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_API_KEY}` },
      body: whisperForm
    })
    
    const { text: transcript } = await whisperResponse.json()

    if (!transcript || transcript.trim() === '') {
      return new Response(JSON.stringify({ error: 'Could not transcribe audio' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Step 2: Vision Analysis with GPT-4o
    const gameProfiles = await import('./game-profiles.ts')
    const profile = gameProfiles.default[game_profile] || gameProfiles.default.generic
    
    const visionMessages = [
      {
        role: 'system',
        content: buildSystemPrompt(profile)
      },
      {
        role: 'user',
        content: [
          ...screenshots.map((screenshot: string) => ({
            type: 'image_url',
            image_url: { url: `data:image/jpeg;base64,${screenshot}`, detail: 'low' }
          })),
          { type: 'text', text: transcript }
        ]
      }
    ]

    const visionResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: visionMessages,
        max_tokens: 300,
        temperature: 0.7
      })
    })

    const visionResult = await visionResponse.json()
    const responseText = visionResult.choices[0].message.content

    // Step 3: Text-to-Speech
    const ttsResponse = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: responseText,
        voice: voice_id || 'alloy',
        response_format: 'mp3'
      })
    })

    const audioResponseBuffer = await ttsResponse.arrayBuffer()
    const audioResponseBase64 = btoa(String.fromCharCode(...new Uint8Array(audioResponseBuffer)))

    // Increment usage
    await supabaseClient.rpc('increment_usage', { p_user_id: user.id, p_audio_minutes: 0.5 })

    return new Response(JSON.stringify({
      transcript,
      response_text: responseText,
      audio_base64: audioResponseBase64,
      queries_remaining: subscription.queries_remaining - 1
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function buildSystemPrompt(profile: { name: string; context: string; tips: string }) {
  return `You are GamerClone, an expert AI gaming coach providing real-time voice guidance.

CURRENT GAME: ${profile.name}
${profile.context}

RESPONSE GUIDELINES:
- Be concise - responses will be spoken aloud (aim for 1-3 sentences)
- Be specific and actionable - tell them exactly what to do
- Reference what you see in the screenshots
- Use gaming terminology appropriate for this game
- Sound confident and encouraging, like a coach
- If you can't see clearly or aren't sure, say so briefly

GAMEPLAY CONTEXT:
${profile.tips}

Analyze the screenshots and answer the player's question directly.`
}
```

### validate-session Function

```typescript
// supabase/functions/validate-session/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { data: { user }, error } = await supabaseClient.auth.getUser()
    
    if (error || !user) {
      return new Response(JSON.stringify({ valid: false, error: 'Invalid session' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Get subscription status
    const { data: subscription } = await supabaseClient
      .rpc('check_subscription', { p_user_id: user.id })
      .single()

    // Get user profile
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    // Get user settings
    const { data: settings } = await supabaseClient
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .single()

    // Register/update machine activation
    const { machine_id, machine_name, platform, app_version } = await req.json()
    
    if (machine_id) {
      await supabaseClient
        .from('activations')
        .upsert({
          user_id: user.id,
          machine_id,
          machine_name,
          platform,
          app_version,
          last_seen_at: new Date().toISOString()
        }, { onConflict: 'user_id,machine_id' })
    }

    return new Response(JSON.stringify({
      valid: true,
      user: {
        id: user.id,
        email: user.email,
        display_name: profile?.display_name
      },
      subscription: {
        is_active: subscription?.is_active ?? false,
        plan: subscription?.plan ?? 'free',
        queries_remaining: subscription?.queries_remaining ?? 0,
        expires_at: subscription?.expires_at
      },
      settings
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ valid: false, error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
```

---

## Agent Orchestration

### Subagent Definitions

Create these subagents in `.claude/agents/` for optimal task delegation:

#### 1. Frontend Agent (`frontend-engineer.md`)

```markdown
---
name: frontend-engineer
description: React/TypeScript specialist for Electron renderer. Use for UI components, React hooks, Tailwind styling, and Zustand state management.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

You are a senior frontend engineer specializing in React, TypeScript, and Electron renderer processes.

## Responsibilities
- Build React components with TypeScript
- Implement Tailwind CSS styling
- Create Zustand stores for state management
- Handle IPC communication from renderer side
- Implement responsive, accessible UI

## Conventions
- Use functional components with hooks
- TypeScript strict mode enabled
- Tailwind for all styling (no CSS files)
- shadcn/ui components where appropriate
- Use `window.electronAPI` for IPC calls
- Error boundaries for graceful failures

## File Locations
- Components: `src/renderer/components/`
- Stores: `src/renderer/stores/`
- Hooks: `src/renderer/hooks/`
- Types: `src/shared/types.ts`

## Safety
- Only modify files in `src/renderer/` and `src/shared/`
- Do not modify main process files
- Do not add new dependencies without approval
```

#### 2. Backend Agent (`backend-engineer.md`)

```markdown
---
name: backend-engineer
description: Electron main process and Supabase specialist. Use for system-level features, IPC handlers, native APIs, and Supabase Edge Functions.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

You are a senior backend engineer specializing in Electron main process and Supabase.

## Responsibilities
- Electron main process implementation
- IPC handler setup and security
- Native API integration (screenshots, audio, hotkeys)
- Supabase client integration
- Edge Function development (Deno/TypeScript)
- Database schema and RLS policies

## Conventions
- TypeScript strict mode
- Proper error handling with typed errors
- IPC handlers validate all inputs
- Edge Functions use Deno APIs
- SQL uses parameterized queries

## File Locations
- Main process: `src/main/`
- Preload: `src/main/preload.ts`
- Edge Functions: `supabase/functions/`
- SQL migrations: `supabase/migrations/`

## Safety
- Never expose API keys to renderer
- Validate JWT in all Edge Functions
- Use RLS on all database tables
- Sanitize all user inputs
```

#### 3. Voice Pipeline Agent (`voice-engineer.md`)

```markdown
---
name: voice-engineer
description: Audio and AI integration specialist. Use for speech-to-text, vision analysis, text-to-speech, and audio capture/playback.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

You are a specialist in audio processing and AI API integration.

## Responsibilities
- Audio capture via Web Audio API
- WAV encoding for STT input
- OpenAI Whisper integration
- OpenAI GPT-4 Vision prompt engineering
- OpenAI TTS or ElevenLabs integration
- Audio playback implementation

## Conventions
- Use Web Audio API for capture
- PCM 16-bit, 16kHz mono for STT
- JPEG 80% quality for screenshots
- Streaming responses where possible
- Graceful degradation on errors

## File Locations
- Audio manager: `src/main/audio.ts`
- Voice pipeline: `src/main/voice-pipeline.ts`
- Edge Function: `supabase/functions/voice-query/`

## Safety
- No audio data stored locally
- Screenshots processed in memory only
- API calls always through Edge Functions
```

#### 4. QA Agent (`qa-engineer.md`)

```markdown
---
name: qa-engineer
description: Testing and quality specialist. Use for writing tests, debugging issues, and ensuring code quality.
tools: Read, Write, Edit, Glob, Grep, Bash
model: sonnet
---

You are a QA engineer responsible for testing and code quality.

## Responsibilities
- Write unit tests with Vitest
- Write E2E tests with Playwright
- Debug reported issues
- Code review for security/quality
- Performance profiling

## Conventions
- Vitest for unit/integration tests
- Playwright for E2E desktop tests
- Test file naming: `*.test.ts` or `*.spec.ts`
- Minimum 80% coverage on business logic
- Mock external APIs in tests

## File Locations
- Tests: `src/**/*.test.ts`
- E2E tests: `tests/e2e/`
- Test utilities: `tests/utils/`

## Safety
- Only modify files in `tests/` and `*.test.ts`
- Do not modify production code unless fixing confirmed bugs
```

---

## Implementation Plan

### Phase 1: Project Setup (Days 1-2)

#### Step 1.1: Initialize Electron + React + TypeScript project

```bash
# Create project with Vite + Electron
npm create vite@latest gamerclone -- --template react-ts
cd gamerclone

# Add Electron dependencies
npm install electron electron-builder electron-store
npm install -D concurrently wait-on cross-env

# Add React dependencies
npm install zustand @tanstack/react-query
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p

# Add Supabase
npm install @supabase/supabase-js

# Add audio/utility dependencies  
npm install uuid
npm install -D @types/uuid
```

#### Step 1.2: Create project structure

```
gamerclone/
├── src/
│   ├── main/
│   │   ├── index.ts              # Main process entry
│   │   ├── preload.ts            # Preload script
│   │   ├── tray.ts               # System tray
│   │   ├── screenshot.ts         # Screenshot capture
│   │   ├── hotkeys.ts            # Global hotkeys
│   │   ├── audio.ts              # Audio manager
│   │   ├── voice-pipeline.ts     # Voice query coordination
│   │   └── ipc-handlers.ts       # IPC handler setup
│   ├── renderer/
│   │   ├── App.tsx               # React app root
│   │   ├── main.tsx              # React entry
│   │   ├── index.html            # HTML template
│   │   ├── stores/
│   │   │   ├── auth-store.ts     # Auth state
│   │   │   ├── settings-store.ts # Settings state
│   │   │   └── app-store.ts      # App state
│   │   ├── components/
│   │   │   ├── LoginForm.tsx
│   │   │   ├── SettingsPanel.tsx
│   │   │   ├── GameSelector.tsx
│   │   │   ├── WindowSelector.tsx
│   │   │   ├── PTTIndicator.tsx
│   │   │   └── StatusBar.tsx
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   └── useVoiceQuery.ts
│   │   └── lib/
│   │       └── supabase.ts       # Supabase client
│   └── shared/
│       ├── types.ts              # Shared types
│       ├── constants.ts          # Shared constants
│       └── game-profiles.ts      # Game profiles
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   └── 20240101000000_initial_schema.sql
│   └── functions/
│       ├── voice-query/
│       │   ├── index.ts
│       │   └── game-profiles.ts
│       └── validate-session/
│           └── index.ts
├── tests/
│   ├── unit/
│   └── e2e/
├── electron-builder.yml
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

### Phase 2: Authentication (Days 3-4)

#### Step 2.1: Supabase project setup

- [ ] Create Supabase project at supabase.com
- [ ] Enable Email/Password auth
- [ ] Enable Google OAuth (optional)
- [ ] Run initial migration
- [ ] Deploy Edge Functions
- [ ] Set environment variables

#### Step 2.2: Auth UI implementation

- [ ] Login form component
- [ ] Registration form component
- [ ] Password reset flow
- [ ] Session persistence with electron-store
- [ ] Auto-login on app launch

### Phase 3: Core Features (Days 5-8)

#### Step 3.1: Screenshot capture

- [ ] Window enumeration via desktopCapturer
- [ ] Window selection UI
- [ ] Periodic screenshot capture (2s interval)
- [ ] Screenshot buffer management (last 10 frames)
- [ ] JPEG compression (80% quality, 1280x720)

#### Step 3.2: Global hotkeys

- [ ] Push-to-talk key registration
- [ ] Hotkey configuration UI
- [ ] Handle app focus changes
- [ ] Support Mouse4/Mouse5 buttons

#### Step 3.3: Audio capture/playback

- [ ] Microphone permission handling
- [ ] Audio device selection
- [ ] Web Audio API recording
- [ ] WAV encoding
- [ ] Audio playback for responses

### Phase 4: Voice Pipeline (Days 9-12)

#### Step 4.1: Edge Function implementation

- [ ] voice-query function
- [ ] Whisper STT integration
- [ ] GPT-4 Vision integration
- [ ] OpenAI TTS integration
- [ ] Error handling and logging

#### Step 4.2: Client integration

- [ ] PTT event handling
- [ ] Audio → Base64 encoding
- [ ] Screenshot selection
- [ ] API call with auth
- [ ] Response audio playback
- [ ] Loading states and feedback

### Phase 5: Polish and Testing (Days 13-15)

#### Step 5.1: UI polish

- [ ] System tray icon and menu
- [ ] Status indicators
- [ ] Settings persistence
- [ ] Error notifications
- [ ] Onboarding flow

#### Step 5.2: Testing

- [ ] Unit tests for stores
- [ ] Integration tests for IPC
- [ ] E2E tests for auth flow
- [ ] Manual testing on Windows/Mac

#### Step 5.3: Build and packaging

- [ ] electron-builder configuration
- [ ] Windows installer (NSIS)
- [ ] macOS DMG
- [ ] Auto-update setup (optional)

---

## File Implementations

### Main Process Entry (`src/main/index.ts`)

```typescript
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'path'
import { createTray, updateTrayMenu } from './tray'
import { registerHotkeys } from './hotkeys'
import { setupIpcHandlers } from './ipc-handlers'
import Store from 'electron-store'

const store = new Store()
let mainWindow: BrowserWindow | null = null

// Single instance lock
const gotTheLock = app.requestSingleInstanceLock()
if (!gotTheLock) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.show()
      mainWindow.focus()
    }
  })
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 480,
    height: 720,
    resizable: false,
    show: false,
    frame: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.on('close', (e) => {
    e.preventDefault()
    mainWindow?.hide()
  })
}

app.whenReady().then(async () => {
  await createWindow()
  createTray(mainWindow!)
  registerHotkeys(mainWindow!)
  setupIpcHandlers(store, mainWindow!)
})

app.on('window-all-closed', (e) => {
  e.preventDefault() // Keep running in tray
})

app.on('before-quit', () => {
  mainWindow?.destroy()
})
```

### Preload Script (`src/main/preload.ts`)

```typescript
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // Auth
  getStoredSession: () => ipcRenderer.invoke('auth:get-session'),
  storeSession: (session: any) => ipcRenderer.invoke('auth:store-session', session),
  clearSession: () => ipcRenderer.invoke('auth:clear-session'),
  
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings: any) => ipcRenderer.invoke('settings:save', settings),
  
  // Windows
  getOpenWindows: () => ipcRenderer.invoke('windows:list'),
  selectWindow: (windowId: string) => ipcRenderer.invoke('windows:select', windowId),
  
  // Voice
  startListening: () => ipcRenderer.invoke('voice:start'),
  stopListening: () => ipcRenderer.invoke('voice:stop'),
  sendVoiceQuery: (data: any) => ipcRenderer.invoke('voice:query', data),
  
  // Events
  onPTTStatus: (callback: (status: any) => void) => {
    ipcRenderer.on('ptt-status', (_, status) => callback(status))
  },
  onQueryResult: (callback: (result: any) => void) => {
    ipcRenderer.on('query-result', (_, result) => callback(result))
  },
  
  // Utils
  getMachineId: () => ipcRenderer.invoke('utils:machine-id'),
  getPlatform: () => process.platform,
  getAppVersion: () => ipcRenderer.invoke('utils:app-version')
})
```

### Auth Store (`src/renderer/stores/auth-store.ts`)

```typescript
import { create } from 'zustand'
import { supabase } from '../lib/supabase'
import type { User, Session } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  session: Session | null
  subscription: {
    is_active: boolean
    plan: string
    queries_remaining: number
    expires_at: string | null
  } | null
  isLoading: boolean
  error: string | null
  
  // Actions
  initialize: () => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshSession: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  subscription: null,
  isLoading: true,
  error: null,

  initialize: async () => {
    try {
      // Check for stored session
      const storedSession = await window.electronAPI.getStoredSession()
      
      if (storedSession) {
        const { data, error } = await supabase.auth.setSession(storedSession)
        if (!error && data.session) {
          set({ session: data.session, user: data.user })
          await get().refreshSession()
        }
      }
    } catch (error) {
      console.error('Auth init error:', error)
    } finally {
      set({ isLoading: false })
    }
  },

  signIn: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      
      if (error) throw error
      
      await window.electronAPI.storeSession(data.session)
      set({ session: data.session, user: data.user })
      await get().refreshSession()
    } catch (error: any) {
      set({ error: error.message })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  signUp: async (email, password) => {
    set({ isLoading: true, error: null })
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password
      })
      
      if (error) throw error
      
      if (data.session) {
        await window.electronAPI.storeSession(data.session)
        set({ session: data.session, user: data.user })
      }
    } catch (error: any) {
      set({ error: error.message })
      throw error
    } finally {
      set({ isLoading: false })
    }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    await window.electronAPI.clearSession()
    set({ user: null, session: null, subscription: null })
  },

  refreshSession: async () => {
    const { session } = get()
    if (!session) return

    try {
      const machineId = await window.electronAPI.getMachineId()
      const platform = window.electronAPI.getPlatform()
      const appVersion = await window.electronAPI.getAppVersion()

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/validate-session`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            machine_id: machineId,
            machine_name: require('os').hostname(),
            platform,
            app_version: appVersion
          })
        }
      )

      const data = await response.json()
      
      if (data.valid) {
        set({ subscription: data.subscription })
      }
    } catch (error) {
      console.error('Session refresh error:', error)
    }
  }
}))
```

---

## Commands to Run

### Development Setup

```bash
# macOS/Linux
cd gamerclone
npm install
cp .env.example .env
# Edit .env with Supabase credentials

# Start Supabase locally (optional)
npx supabase start

# Run migrations
npx supabase db push

# Deploy Edge Functions
npx supabase functions deploy voice-query
npx supabase functions deploy validate-session

# Start dev server
npm run dev
```

```powershell
# Windows PowerShell
cd gamerclone
npm install
Copy-Item .env.example .env
# Edit .env with Supabase credentials

# Start dev server
npm run dev
```

### Build for Production

```bash
# Build for current platform
npm run build

# Build Windows installer
npm run build:win

# Build macOS DMG
npm run build:mac
```

---

## Test Plan

### Unit Tests

| Test | File | Requirements |
|------|------|--------------|
| Auth store initialization | `auth-store.test.ts` | REQ-001 |
| Settings persistence | `settings-store.test.ts` | REQ-003 |
| Screenshot buffer management | `screenshot.test.ts` | REQ-004 |
| Audio encoding | `audio.test.ts` | REQ-005 |
| Game profile loading | `game-profiles.test.ts` | REQ-007 |

### Integration Tests

| Test | Description |
|------|-------------|
| Auth flow | Sign up → Sign in → Session restore |
| Voice pipeline | PTT → Capture → API → Playback |
| Settings sync | Change settings → Persist → Reload |

### E2E Tests

| Test | Description |
|------|-------------|
| Onboarding | New user can sign up and use free trial |
| Voice query | User can complete a voice query |
| Window selection | User can select and capture a game window |

---

## Verification Checklist

- [ ] User can create account with email/password
- [ ] User can log in and session persists
- [ ] Free trial provides 10 queries/day
- [ ] Pro subscription unlocks 500 queries/day
- [ ] Push-to-talk hotkey works when game has focus
- [ ] Screenshots captured at 2-second intervals
- [ ] Voice query returns spoken response
- [ ] Response latency under 3 seconds
- [ ] Settings persist across app restarts
- [ ] System tray shows correct status
- [ ] App runs on Windows 10/11
- [ ] App runs on macOS 12+

---

## Appendix

### Environment Variables

```env
# .env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Supabase Edge Function secrets (set via dashboard)
OPENAI_API_KEY=sk-...
```

### Glossary

| Term | Definition |
|------|------------|
| PTT | Push-to-Talk - hotkey held to record voice |
| STT | Speech-to-Text - converting audio to text |
| TTS | Text-to-Speech - converting text to audio |
| RLS | Row Level Security - Supabase/Postgres access control |
| JWT | JSON Web Token - auth token format |

### Citations

- Electron documentation: https://www.electronjs.org/docs
- Supabase documentation: https://supabase.com/docs
- OpenAI API reference: https://platform.openai.com/docs
- Web Audio API: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API
