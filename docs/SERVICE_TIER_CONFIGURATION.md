# Service Tier Configuration Guide

This document explains how to configure the AI Voice Translator's multi‑tier service architecture using environment variables.

## Overview

The AI Voice Translator uses a configurable 3-tier architecture for each component:

1. **STT (Speech-to-Text)**: Converts audio to text
2. **Translation**: Translates text between languages  
3. **TTS (Text-to-Speech)**: Converts text to audio

Each component can be configured independently using environment variables.

## Environment Variables

### STT_SERVICE_TYPE
Controls the Speech-to-Text service selection.

**Available Options:**
- `auto` (default): 3-tier fallback system (OpenAI → ElevenLabs → Whisper.cpp)
- `openai`: OpenAI Whisper only (requires OPENAI_API_KEY)
- `elevenlabs`: ElevenLabs STT only (requires ELEVENLABS_API_KEY)

**Example:**
```bash
STT_SERVICE_TYPE=auto
```

### TRANSLATION_SERVICE_TYPE
Controls the Translation service selection.

**Available Options:**
- `auto` (default): 2-tier fallback system (OpenAI → MyMemory)
- `openai`: OpenAI Translation only (requires OPENAI_API_KEY)
- `mymemory`: MyMemory API only (free, but lower quality)

**Example:**
```bash
TRANSLATION_SERVICE_TYPE=auto
```

### TTS_SERVICE_TYPE
Controls the Text-to-Speech service selection.

**Available Options:**
- `auto` (default): multi‑tier fallback system
  - Order (best → worst): OpenAI → ElevenLabs → Local (eSpeak‑NG/Piper) → Kokoro‑82M (HF) → Browser
- `openai`: OpenAI TTS only (requires OPENAI_API_KEY)
- `elevenlabs`: ElevenLabs TTS only (requires ELEVENLABS_API_KEY)
- `local`: Local eSpeak‑NG/Piper
- `kokoro`: Kokoro‑82M via Hugging Face Inference endpoint (requires KOKORO_TTS_URL)
- `browser`: Browser TTS only (free, but lowest quality)

**Example:**
```bash
TTS_SERVICE_TYPE=auto
```

## Testing Different Combinations

You can test various permutations by changing the environment variables:

### High-Quality Setup (All Premium Services)
```bash
STT_SERVICE_TYPE=openai
TRANSLATION_SERVICE_TYPE=openai
TTS_SERVICE_TYPE=elevenlabs
```

### Free/Fallback Setup
```bash
STT_SERVICE_TYPE=auto  # Will fallback to Whisper.cpp if APIs fail
TRANSLATION_SERVICE_TYPE=mymemory
TTS_SERVICE_TYPE=browser
```

### Mixed Setup (Testing Specific Services)
```bash
STT_SERVICE_TYPE=elevenlabs
TRANSLATION_SERVICE_TYPE=openai
TTS_SERVICE_TYPE=openai
```

## Service Quality Tiers

### STT Services (Quality: High → Medium → Low)
1. **OpenAI Whisper** (Tier 1) - Premium cloud transcription
2. **ElevenLabs STT** (Tier 2) - Alternative cloud transcription
3. **Whisper.cpp** (Tier 3) - Local model processing

### Translation Services (Quality: High → Low)
1. **OpenAI Translation** (Tier 1) - Premium translation with context awareness
2. **MyMemory API** (Tier 2) - Free translation service

### TTS Services (Auto Fallback Order: High → Low)
1. **OpenAI TTS** (Premium) – Highest quality
2. **ElevenLabs TTS** (Premium) – High quality
3. **Local TTS** (Free) – eSpeak‑NG/Piper
4. **Kokoro‑82M (HF)** (Free, limited languages) – 9 languages supported
5. **Browser TTS** (Free) – Web Speech API, lowest fidelity

## Auto-Fallback Behavior

When using `auto` mode, services automatically fallback in case of:
- API key missing
- Network errors
- Rate limiting
- Service unavailable

The system implements circuit breaker patterns with exponential backoff for robust error handling.

## Restart Required

Changes to service type environment variables require a server restart to take effect:

```bash
# Kill existing server
npx kill-port 5000

# Start with new configuration
npm run dev
```

## Logging

Service selection and fallback behavior is logged at startup and during operation:

```
[STTFactory] Creating 3-tier auto-fallback STT service: OpenAI → ElevenLabs → Whisper.cpp
[TranslationFactory] Creating 2-tier auto-fallback translation service: OpenAI → MyMemory
[TTSFactory] Creating multi-tier auto-fallback TTS service: OpenAI → ElevenLabs → Local → Kokoro → Browser
```

## Kokoro‑82M (HF) Configuration

Kokoro‑82M is an optional free TTS tier using a Hugging Face Inference endpoint. It supports 9 languages (English US/UK, French, Japanese, Korean, Chinese, Spanish, Hindi, Italian, Brazilian Portuguese). It does not require local model download when using HF inference.

Environment variables:

```bash
# Prefer Kokoro only when URL is configured; auto mode tries it after Local and before Browser.
KOKORO_TTS_URL=https://api-inference.huggingface.co/models/<org>/<kokoro-82M-model>
# Optional HF token if the model requires auth
KOKORO_TTS_TOKEN=hf_xxx
```

Notes:
- If `KOKORO_TTS_URL` is unset, Kokoro is skipped automatically in the auto chain.
- For direct forcing, set `TTS_SERVICE_TYPE=kokoro`.

## API Keys Required

Make sure you have the necessary API keys configured:

```bash
# Required for OpenAI services
OPENAI_API_KEY=sk-...

# Required for ElevenLabs services  
ELEVENLABS_API_KEY=your_key_here
```

## Testing Matrix

Here are some useful configurations for testing:

| Test Case | STT | Translation | TTS | Purpose |
|-----------|-----|-------------|-----|---------|
| Premium All | `openai` | `openai` | `elevenlabs` | Best quality |
| Free All | `auto` | `mymemory` | `browser` | No API costs |
| Mixed 1 | `elevenlabs` | `openai` | `openai` | Test ElevenLabs STT |
| Mixed 2 | `openai` | `mymemory` | `elevenlabs` | Test free translation |
| Fallback Test | `auto` | `auto` | `auto` | Test fallback behavior | 