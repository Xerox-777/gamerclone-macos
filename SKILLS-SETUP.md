# GamerClone - Recommended Skills Setup

## Overview

This document outlines the Claude Code skills optimized for building the GamerClone MVP. Skills provide domain-specific expertise and best practices that enhance Claude's ability to complete tasks effectively.

## Recommended Skills Configuration

### Built-in Skills to Use

The following built-in skills are relevant to this project:

| Skill | Use Case |
|-------|----------|
| `frontend-design` | Creating the React settings UI with professional styling |
| `skill-creator` | Creating custom project-specific skills if needed |

### Custom Skills to Create

Create these skills in `.claude/skills/` for project-specific guidance:

---

### Skill 1: Electron Best Practices (`electron-development/SKILL.md`)

```markdown
---
name: Electron Development
description: Best practices for Electron main/renderer process architecture, IPC security, and desktop app patterns. Use when working on Electron main process, preload scripts, or IPC handlers.
---

# Electron Development Skill

## Architecture Principles

### Process Separation
- Main process: Node.js environment, system access
- Renderer process: Browser environment, React/UI
- Preload: Bridge between main and renderer (contextIsolation)

### IPC Security Rules

1. **Always use contextIsolation: true**
2. **Never enable nodeIntegration in renderer**
3. **Validate all IPC inputs in main process**
4. **Use invoke/handle pattern over send/on**

### Preload Script Pattern

\`\`\`typescript
// preload.ts
import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('api', {
  // Expose only specific, validated methods
  doSomething: (arg: string) => ipcRenderer.invoke('channel', arg)
})
\`\`\`

### IPC Handler Pattern

\`\`\`typescript
// main process
ipcMain.handle('channel', async (event, arg: unknown) => {
  // 1. Validate input type
  if (typeof arg !== 'string') throw new Error('Invalid arg')
  
  // 2. Perform operation
  const result = await operation(arg)
  
  // 3. Return serializable result
  return result
})
\`\`\`

## Window Management

- Use single instance lock to prevent multiple instances
- Hide on close instead of quit (system tray app)
- Remember window position/size with electron-store

## System Tray

- Provide context menu for quick actions
- Show status in tray icon tooltip
- Double-click to show main window

## Native APIs

### Screenshot Capture
Use `desktopCapturer.getSources()` with type 'window'

### Global Hotkeys
Use `globalShortcut.register()` - remember to unregister on quit

### Audio
Use Web Audio API in renderer, not native Node.js audio
```

---

### Skill 2: Supabase Patterns (`supabase-patterns/SKILL.md`)

```markdown
---
name: Supabase Patterns
description: Best practices for Supabase database design, RLS policies, Edge Functions, and authentication. Use when working with Supabase backend services.
---

# Supabase Patterns Skill

## Database Design

### Table Naming
- Use snake_case
- Plural table names (users, subscriptions)
- Foreign keys named `{table}_id`

### Standard Columns
Every table should have:
\`\`\`sql
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
created_at TIMESTAMPTZ DEFAULT NOW(),
updated_at TIMESTAMPTZ DEFAULT NOW()
\`\`\`

### Indexes
- Always index foreign keys
- Index columns used in WHERE clauses
- Use partial indexes for filtered queries

## Row Level Security (RLS)

### Always Enable RLS
\`\`\`sql
ALTER TABLE public.my_table ENABLE ROW LEVEL SECURITY;
\`\`\`

### Common Policy Patterns

**User owns row:**
\`\`\`sql
CREATE POLICY "Users can CRUD own rows"
ON public.my_table
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
\`\`\`

**Read-only for authenticated:**
\`\`\`sql
CREATE POLICY "Authenticated can read"
ON public.my_table
FOR SELECT
USING (auth.role() = 'authenticated');
\`\`\`

## Edge Functions

### Structure
\`\`\`typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type'
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create authenticated client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Validate user
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Your logic here...

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
\`\`\`

## Authentication

### Session Management
- Store refresh token securely (electron-store)
- Auto-refresh before expiry
- Handle token refresh errors gracefully
```

---

### Skill 3: OpenAI Integration (`openai-integration/SKILL.md`)

```markdown
---
name: OpenAI Integration
description: Best practices for OpenAI API integration including Whisper STT, GPT-4 Vision, and TTS. Use when implementing voice pipeline or AI features.
---

# OpenAI Integration Skill

## API Keys
- NEVER expose in client code
- Always use server-side (Edge Functions)
- Rotate keys regularly

## Whisper (Speech-to-Text)

### Optimal Audio Format
- Format: WAV or MP3
- Sample rate: 16kHz
- Channels: Mono
- Bit depth: 16-bit PCM

### API Call
\`\`\`typescript
const formData = new FormData()
formData.append('file', audioBlob, 'audio.wav')
formData.append('model', 'whisper-1')
formData.append('language', 'en') // Optional but faster

const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
  method: 'POST',
  headers: { 'Authorization': \`Bearer \${apiKey}\` },
  body: formData
})
\`\`\`

## GPT-4 Vision

### Image Guidelines
- Max 20 images per request
- Use 'low' detail for faster processing
- JPEG preferred over PNG for screenshots
- Resize to 1280x720 or smaller

### Vision Request
\`\`\`typescript
const response = await fetch('https://api.openai.com/v1/chat/completions', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'gpt-4o',
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: \`data:image/jpeg;base64,\${base64}\`,
            detail: 'low' // 'low', 'high', or 'auto'
          }
        },
        { type: 'text', text: 'Your prompt here' }
      ]
    }],
    max_tokens: 300
  })
})
\`\`\`

## TTS (Text-to-Speech)

### Voices
- alloy: neutral
- echo: male
- fable: british male
- onyx: deep male
- nova: female
- shimmer: soft female

### TTS Request
\`\`\`typescript
const response = await fetch('https://api.openai.com/v1/audio/speech', {
  method: 'POST',
  headers: {
    'Authorization': \`Bearer \${apiKey}\`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    model: 'tts-1', // or 'tts-1-hd' for higher quality
    input: 'Text to speak',
    voice: 'alloy',
    response_format: 'mp3' // mp3, opus, aac, flac
  })
})

const audioBuffer = await response.arrayBuffer()
\`\`\`

## Cost Optimization

- Use gpt-4o-mini for simple tasks
- Use 'low' detail for vision
- Keep responses concise (max_tokens)
- Cache common responses if appropriate
```

---

## Skill Directory Structure

```
.claude/
├── agents/
│   ├── frontend-engineer.md
│   ├── backend-engineer.md
│   ├── voice-engineer.md
│   └── qa-engineer.md
└── skills/
    ├── electron-development/
    │   └── SKILL.md
    ├── supabase-patterns/
    │   └── SKILL.md
    └── openai-integration/
        └── SKILL.md
```

## Usage Notes

1. **Subagents** are automatically invoked based on task matching
2. **Skills** are loaded on-demand when Claude determines they're relevant
3. Place subagent files in `.claude/agents/`
4. Place skill files in `.claude/skills/{skill-name}/SKILL.md`
5. Subagents reference skills automatically when needed

## Recommended Workflow

1. Start with the main training file (`GAMERCLONE-MVP-BUILD.md`)
2. Let Claude route to appropriate subagents based on task type
3. Skills provide context-specific best practices
4. QA agent validates all work before completion
