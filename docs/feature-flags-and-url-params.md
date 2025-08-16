## Feature Flags and URL Parameters

This document lists environment variables to configure new features on the server (Railway) and the URL parameters supported by the Teacher and Student UIs.

### Server environment variables (Railway)

- FEATURE_TWO_WAY_COMMUNICATION: Enable two-way teacher↔student messaging (student_request, teacher_reply). Values: 1/true/yes/on.
- FEATURE_MANUAL_TRANSLATION_CONTROL: Gate “manual mode” (teacher-controlled delivery) features. Values: 1/true/yes/on.
- FEATURE_LOW_LITERACY_MODE: Gate low-literacy experience (voice-first, simplified UI). Values: 1/true/yes/on.
- FEATURE_CLASSROOM_MODES: Gate classroom mode broadcasts from teacher (future expansion). Values: 1/true/yes/on.
- FEATURE_REDACT_PROFANITY: Redact profanity in transcripts/translations. Values: 1/true/yes/on.
- FEATURE_REDACT_PII: Redact PII in transcripts/translations. Values: 1/true/yes/on.
- FEATURE_SERVER_INTERIM_TRANSCRIPTION: Enable/disable server-side interim transcription broadcasts. Values: 1 (enable), 0 (disable).
- FEATURE_ACE: Master ACE flag enabling simplification/chunking, term‑locking, slow‑repeat triggers, and HUD hints. Values: 1/true/yes/on.
- ENABLE_DETAILED_TRANSLATION_LOGGING: Verbose logs for translation flows. Values: true/false.

Two-way controls
- TWOWAY_REQ_WINDOW_MS: Rate-limit window for student requests (default: 2000).
- TWOWAY_REQ_MAX: Max requests per window per connection (default: 3).

Core service keys (required for full pipeline)
- OPENAI_API_KEY: STT/TTS/LLM features (where applicable).
- ELEVENLABS_API_KEY: High-quality TTS (and optional STT experiments).

Runtime server
- HOST, PORT: Server bind (Railway typically injects PORT).
- LOG_LEVEL: debug|info|warn|error (default: info).

Client build-time
- VITE_API_URL: Base HTTP URL used by client (ex: https://your-app.up.railway.app).
- VITE_WS_URL: WebSocket base URL (ex: wss://your-app.up.railway.app).

Notes
- Two-way handlers are registered only when FEATURE_TWO_WAY_COMMUNICATION is enabled at server startup.
- URL parameters allow per-connection behavior changes without redeploys, but cannot register handlers after boot.

### URL parameters (Teacher UI)

| Param | Example | Purpose |
|---|---|---|
| twoWay | /teacher?twoWay=1 | Enables the Student Requests queue and propagates twoWay=1 into the student link. |
| manual | /teacher?manual=1 | Shows manual controls and sends settings to “manual” after WS connects. |
| rtc | /teacher?rtc=1 | Enables experimental WebRTC path (when available). |
| clientstt (alias stt) | /teacher?clientstt=1 | Prefer client speech recognition; coordinates with streaming flags. |
| stream | /teacher?stream=1 | Enables audio chunk streaming from teacher to server. |
| ace | /student?code=ABC123&ace=1 | Enables ACE for this connection (master flag; implies related sub‑features). |
| e2e | /teacher?e2e=true | Test mode (bypass login in E2E runs). |

### URL parameters (Student UI)

| Param | Example | Purpose |
|---|---|---|
| code | /student?code=ABC123 | Classroom code to join the teacher’s session. |
| twoWay | /student?code=ABC123&twoWay=1 | Enables “Ask the Teacher” (text + push‑to‑talk). |

Planned (UX): lowLiteracy
- Proposed /student?code=ABC123&lowLiteracy=1 to trigger a simplified, voice‑first UI when FEATURE_LOW_LITERACY_MODE or FEATURE_ACE is enabled (bigger text, auto‑play TTS, fewer controls). Current implementation emphasizes audio playback; full skinning is pending.

### Quick start (Railway)

1) Set variables and redeploy
```
FEATURE_TWO_WAY_COMMUNICATION=1
FEATURE_MANUAL_TRANSLATION_CONTROL=1
FEATURE_LOW_LITERACY_MODE=1
OPENAI_API_KEY=...
ELEVENLABS_API_KEY=...
```

2) Open Teacher, copy code, then Student
- Teacher: https://YOUR-DOMAIN/teacher?twoWay=1
- Student: https://YOUR-DOMAIN/student?code=CLASS_CODE&twoWay=1


