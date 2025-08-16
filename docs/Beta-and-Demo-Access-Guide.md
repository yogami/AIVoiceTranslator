## Beta and Demo Access Guide

This guide summarizes the minimal configuration to run AIVoiceTranslator in beta/demo environments.

### Environment

Set these variables in your platform (Railway, Render, etc.). For production-like demos:

- NODE_ENV=production
- HOST=0.0.0.0
- REALTIME_TRANSPORT=websocket
- COMMUNICATION_PROTOCOL=websocket
- DATABASE_URL=postgres://...
- VITE_API_URL=https://your-domain
- VITE_WS_URL=wss://your-domain
- STT_SERVICE_TYPE=auto
- TRANSLATION_SERVICE_TYPE=auto
- TTS_SERVICE_TYPE=auto
- FEATURE_TWO_WAY_COMMUNICATION=1
- FEATURE_ACE=1
- FEATURE_INCLUDE_ORIGINAL_TTS=0

Optional keys for premium quality:
- OPENAI_API_KEY=...
- ELEVENLABS_API_KEY=...

### ACE toggling at runtime

- Enable per-connection with `?ace=1` on student links
- Master flag via `FEATURE_ACE=1` for all connections


