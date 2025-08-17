## Private Voice Lock – Classroom Speaker Enrollment & Target‑Speaker Gating (Technical Spec)

### 1) Summary & Impact
- Purpose: Reduce crosstalk and improve accuracy by recognizing enrolled speakers (teacher, optionally frequent students) and gating transcription/translation to the active, intended speaker.
- Differentiator: On‑prem, consented enrollment; offline identification/gating integrated with classroom QoS and ACE. No raw audio leaves the gateway.
- Target impact: −20–35% WER for enrolled speakers; −50% crosstalk errors; no regression in P50/P95 latency.

### 2) Primary Use Cases
- Teacher‑only gating (MVP): lock the pipeline to the teacher’s voice in noisy rooms.
- Multi‑speaker classrooms: selectively gate to enrolled student voices for Q&A or group modes.

### 3) Scope
- In scope (MVP):
  - Voice enrollment (teacher) – 30–60 s of speech; consent flow and local storage.
  - Target‑Speaker VAD/diarization/gating in real time; STT/translation only for detected target.
  - Metrics: WER delta vs baseline; crosstalk error rate; added latency.
- Phase 2:
  - Multi‑profile matching (teacher + frequent students), per‑profile thresholds.
  - ACE hooks (per‑speaker pacing/simplification).
- Phase 3:
  - Lightweight adaptation to improve ASR front‑end for enrolled speakers (local fine‑tuning).

### 4) Architecture Overview
- Placement: Pre‑STT gating inside the audio ingestion path; downstream pipeline unchanged.
- Components:
  - Enrollment Service: records enrollment audio, derives speaker embeddings, stores locally.
  - Speaker Embedding Engine: ECAPA‑TDNN/ResNet‑based embedding (CPU‑friendly) → vector.
  - Target‑Speaker VAD (TS‑VAD) / Diarization Service: decides active speaker segment and score.
  - Gating Controller: routes only target‑speaker segments into STT; drops/attenuates others.
- Data flow:
  1) Audio chunk → base VAD → window (e.g., 0.5–1.0 s)
  2) Embedding inference → cosine/probability vs profiles
  3) If match ≥ threshold (per speaker), mark as target; else suppress
  4) Forward gated audio to STT/translation/ACE

### 5) Model Options (offline)
- Speaker embeddings: SpeechBrain ECAPA‑TDNN pretrained (CPU)
  - Pros: Wide adoption, CPU‑runnable, good accuracy
  - Cons: Adds ~10–40 ms per window on NUC; higher on Pi
- TS‑VAD: lightweight CPU implementation (e.g., based on pyannote/simple thresholding over embeddings)
  - Rolling decision with hysteresis to avoid flapping
- Storage: only embeddings (float vectors) and config; no raw audio persisted beyond short rolling buffers.

### 6) Hardware & Compute
- Recommended: Intel NUC/mini‑PC, i5 (or similar), 16 GB RAM, 256 GB SSD
  - Supports teacher gating + up to ~20 students with P50 < 2s
- Minimum (teacher‑only on Pi 5): 8 GB RAM; may require larger windows and reduced model size; P95 latency risk
- Cooling required for sustained loads; prefer SSD over SD card

### 7) Privacy, Consent, and GDPR
- Voice embeddings are biometric data → require explicit, informed consent and DPIA.
- Default policies:
  - Consent per enrolled speaker; store enrollment metadata (time, purpose, signer).
  - Store embeddings encrypted at rest; retention window (e.g., 90 days) with per‑speaker deletion.
  - No cloud transmission; processing limited to the stated purpose (classroom translation).
  - Provide Right‑to‑Erasure and audit logs (who enrolled, who deleted).

### 8) Feature Flags
- `FEATURE_VOICE_LOCK=1` – enable runtime target‑speaker gating
- `FEATURE_VOICE_ENROLLMENT=1` – enable enrollment UI/API
- `FEATURE_VOICE_MULTI_PROFILE=1` – enable multiple enrolled profiles (Phase 2)
- `FEATURE_VOICE_HINTS=1` – teacher HUD hints when gating is uncertain

### 9) APIs (Gateway)
- Enrollment
  - `POST /api/voice/enroll` → { role: 'teacher'|'student', name?, consent: true }
    - Streams/accepts audio (WebRTC/WS chunked or file), returns `{ speakerId, embeddingId, qualityScore }`
  - `GET /api/voice/enrolled` → list profiles (ids, role, createdAt)
  - `DELETE /api/voice/enrolled/:id` → remove profile
- Runtime control
  - `POST /api/voice/lock` → { speakerId } (lock to teacher or a student)
  - `POST /api/voice/unlock` → clear lock (fall back to standard)
  - `GET /api/voice/status` → { activeSpeakerId, match, thresholds }

### 10) WebSocket Messages
- `voice_enroll_prompt` (server → teacher): request to capture enrollment
- `voice_lock_state` (server → teacher): { active: boolean, speakerId?, match? }
- `voice_lock_warning` (server → teacher): low confidence; suggest repeat or disable lock

### 11) Enrollment UX
- Teacher UI
  - “Enroll my voice” → read 3–5 prompts (30–60 s total). Show progress and quality indicator.
  - Confirm consent; show policy link; allow delete at any time.
- Student (optional)
  - Per‑speaker consent; enroll frequent speakers only; allow teacher to select during Q&A.

### 12) Data Storage & Security
- Store: `{ speakerId, embeddings[], role, consent, createdAt }` in local DB
- Encrypt embeddings at rest (AES‑GCM); key stored on gateway only
- Rotate keys on upgrade; support export/import for device migration with admin approval

### 13) Runtime Algorithm (MVP)
- Windowing: 0.5 s hop, 1.0 s window; base VAD to skip silence
- Embedding: compute vector per voiced window; cosine similarity to enrolled profiles
- Decision:
  - If max(similarity) ≥ θ_lock (e.g., 0.75), mark as target; else non‑target
  - Apply hysteresis: require N consecutive target windows to engage; M non‑target to disengage
- Gating:
  - Forward only target windows to STT; discard or down‑mix others
  - On lock loss, pause STT or revert to standard diarization per policy

### 14) Latency Budget
- Additional processing per window:
  - VAD + embedding CPU time: target < 40 ms (NUC), < 90 ms (Pi 5)
  - Decision + routing: < 5 ms
- Overall added E2E: target < 150 ms P50 (NUC);
  - On Pi, consider increasing window or falling back to teacher‑only longer frames

### 15) Integration with Existing Pipeline
- Insert `VoiceLockService` before STT in the audio ingestion path
- If `FEATURE_VOICE_LOCK` disabled, pass‑through
- Provide metrics hooks to TranslationOrchestrator for correlation with WER/latency

### 16) Metrics & Evaluation
- WER delta (enrolled vs baseline) on scripted phoneme/word sets and live classroom
- Crosstalk error rate: % of non‑teacher speech transcribed while lock engaged
- Added latency (P50/P95)
- Lock stability: engage/disengage counts per hour; false accept/reject rate

### 17) Admin UI (Minimum)
- Enrollment management: list, delete, consent status
- Runtime status: active lock, confidence, recent warnings
- Controls: lock/unlock, thresholds, disable voice lock temporarily

### 18) Risks & Mitigations
- Biometric compliance risk → strong consent UX; retention controls; no cloud; DPIA
- CPU constraints on Pi → limit to teacher‑only; increase windows; prefer NUC for multi‑profile
- False positives in noisy rooms → higher thresholds, hysteresis, fall back to standard diarization
- Enrollment quality variance → enforce minimum SNR/length; prompt user to re‑enroll

### 19) Testing Plan
- Unit: similarity scoring; hysteresis; encryption at rest
- Integration: end‑to‑end gating with simulated classroom noise; latency measurement harness
- Pilot: A/B with lock on vs off; collect WER, crosstalk, latency; teacher feedback

### 20) Rollout
- Phase 1 (2–3 weeks on NUC): teacher‑only lock; KPI target (WER −20%, crosstalk −50%)
- Phase 2: multi‑profile; ACE hooks; admin controls hardening
- Phase 3: optional ASR front‑end adaptation for enrolled profiles

### 21) Dependencies
- Python sidecar (optional) for embedding engine if not in Node: Torch/Torchaudio, SpeechBrain or equivalent
- Node bindings or gRPC/IPC to integrate with WebSocket server
- Local DB (PostgreSQL/SQLite) with crypto

### 22) Acceptance Criteria (MVP)
- Teacher enrollment stored with consent; delete works
- Voice lock engages on teacher speech with ≥θ_lock in classroom noise; crosstalk reduced ≥50% vs baseline
- Added latency within budget; no crash/freeze during 45‑minute session
- All processing offline; no outbound network calls in offline mode

---
Owner: Engineering • Version: 1.0 • Flags: `FEATURE_VOICE_LOCK`, `FEATURE_VOICE_ENROLLMENT`, `FEATURE_VOICE_MULTI_PROFILE`, `FEATURE_VOICE_HINTS`
