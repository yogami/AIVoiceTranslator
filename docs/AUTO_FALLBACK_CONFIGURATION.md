# Auto-Fallback Service Tiers and Environment Variables

## Overview

This project implements automatic fallback across all audio processing components with consistent tiers. You can pin a specific tier via environment variables or use `auto` to enable fallback.

Environment variables:

```bash
STT_SERVICE_TYPE=auto|premium-openai|premium-labs|free-hq|free-enhanced|free-basic
TRANSLATION_SERVICE_TYPE=auto|auto-deepseek-first|premium|free-hq|free-basic|offline
TTS_SERVICE_TYPE=auto|premium-openai|premium-labs|free-hq|free-basic|silent
OPENAI_API_KEY=sk-your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key
WHISPER_MODEL=base  # e.g., tiny, base, small, medium, large
```

## Cross-Component Tier Matrix

| Tier | STT (Speech-to-Text) | Translation | TTS (Text-to-Speech) | Env value(s) | Requirements |
|------|-----------------------|-------------|----------------------|--------------|--------------|
| 1a (Premium) | OpenAI Whisper API | OpenAI Translation | ElevenLabs TTS | `premium-openai` (STT), `premium` (Translation), `premium-labs` (TTS) | `OPENAI_API_KEY` (OpenAI), `ELEVENLABS_API_KEY` (ElevenLabs) |
| 1b (Premium) | ElevenLabs STT | — | OpenAI TTS | `premium-labs` (STT), —, `premium-openai` (TTS) | `ELEVENLABS_API_KEY` (STT), `OPENAI_API_KEY` (TTS) |
| 2 (High‑Quality Free) | Deepgram Nova‑2 | DeepSeek | Local eSpeak‑NG | `free-hq` | None |
| 3 (Free) | Whisper.cpp + Voice Isolation (enhanced) | MyMemory | Browser TTS | `free-enhanced` (STT), `free-basic` (Translation/TTS) | None |
| 4 (Free/Offline) | Whisper.cpp (basic) | Offline/Local | Silent Mode | `free-basic` (STT), `offline` (Translation), `silent` (TTS) | None |
| Auto | Auto-fallback (see below) | Auto-fallback (see below) | Auto-fallback (see below) | `auto` | Optional keys used if present |

Notes:
- STT supports 4 selectable tiers; current auto chain is 3-tier (see below).
- Translation exposes an additional `auto-deepseek-first` mode.
- TTS supports 4-tier auto chain.

## Auto-Fallback Order by Component

- STT (default `auto`): OpenAI (PAID) → ElevenLabs (PAID) → Whisper.cpp (FREE)
  - Deepgram (`free-hq`) is available when explicitly selected, but not in the current auto chain.

- Translation (default `auto` in factory): MyMemory (FREE) → OpenAI (PAID, if key) → DeepSeek (FREE)
  - Alternative `auto-deepseek-first`: DeepSeek (FREE) → OpenAI (PAID, if key) → MyMemory (FREE)
  - Implementation currently uses a 2-tier orchestrator internally, choosing the best available primary and a single fallback from the above order.

- TTS (default `auto`): OpenAI (PAID) → ElevenLabs (PAID) → Local eSpeak‑NG (FREE) → Browser (FREE)

## Safe Example Configurations

### Development / Local
```bash
STT_SERVICE_TYPE=auto
TRANSLATION_SERVICE_TYPE=auto
TTS_SERVICE_TYPE=auto
# API keys optional; free tiers will be used as needed
```

### Production with Premium Quality
```bash
STT_SERVICE_TYPE=auto
TRANSLATION_SERVICE_TYPE=auto
TTS_SERVICE_TYPE=auto
OPENAI_API_KEY=sk-your-openai-key
ELEVENLABS_API_KEY=your-elevenlabs-key
WHISPER_MODEL=base
```

### Free-Only (No Keys)
```bash
STT_SERVICE_TYPE=free-hq           # Deepgram STT
TRANSLATION_SERVICE_TYPE=free-hq   # DeepSeek Translation
TTS_SERVICE_TYPE=free-hq           # Local eSpeak‑NG
```

## Verification (Logs)

You can confirm active tiers from logs at startup/first use:

```text
[STTFactory] Creating 4-tier auto-fallback: Premium → Deepgram → Enhanced Whisper → Basic Whisper
[AutoFallback STT] 3-tier service initialized: OpenAI (PAID) → ElevenLabs (PAID) → Whisper.cpp (FREE)

[TranslationFactory] Creating 4-tier auto-fallback: OpenAI → DeepSeek → MyMemory → Offline
[AutoFallbackTranslation] Attempting primary service...

[TTSFactory] Creating 4-tier auto-fallback: OpenAI (PAID) → ElevenLabs (PAID) → Local (FREE) → Browser (FREE)
[AutoFallback TTS] 4-tier service initialized: Local (FREE) → Browser (FREE) → OpenAI (PAID) → ElevenLabs (EXPENSIVE)
```

This configuration enables graceful degradation, circuit breakers, and caching while prioritizing quality when credentials are available.
