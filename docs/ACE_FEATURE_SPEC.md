## Adaptive Comprehension Engine (ACE) – Feature Specification

### 1) Purpose and Outcomes
- Goal: Convert “translation” into “understanding” for true beginners with no shared language.
- How: Real-time simplification, pacing, and curriculum term-locking per student, within sub-2s latency and offline if needed.
- Primary outcomes:
  - −25–40% miscomprehension signals (need‑slower/confused) vs baseline.
  - −20% time‑to‑understanding (teacher utterance → student‑ready output).
  - ≥95% curriculum term fidelity (locked glossary terms used consistently).

### 2) In/Out of Scope
- In scope (MVP): term‑locking; per‑student simplification and chunking; slow‑repeat triggers; teacher HUD hint; metrics.
- Out of scope (Phase 2+): AR overlay; on‑device accent model adaptation (R&D); advanced NLU paraphrasing.

### 3) User Stories
- Student (beginner): As a student, I receive simpler sentences and slower read‑aloud automatically when I’m lost, with the right lesson words every time.
- Teacher: As a teacher, I see a nudge to simplify when many students are confused, and I can rely on consistent terms from my slides.
- Admin: As an admin, I get comprehension/latency/term‑fidelity metrics to track inclusion impact.

### 4) UX Flows
- Student
  - Joins via QR → selects language → receives translated text+audio.
  - When low‑literacy is on or ACE detects confusion spike, delivery is simplified, chunked, and slowed; optional browser TTS.
- Teacher HUD
  - Live banner shows class comprehension state (OK / Need Slower / Confused). When threshold is crossed, display a one‑line suggestion (e.g., “Try: base × height, then divide by two”).
- Glossary setup
  - Teacher uploads CSV (term, preferred translation per language) or pastes terms; preview screen highlights conflicts.

### 5) Architecture
- Placement: Extends `SpeechPipelineOrchestrator` post‑translation, pre‑delivery.
- Key modules:
  - Glossary & Term‑Locking Service
  - Simplification & Chunking Rules (per student)
  - Slow‑Repeat Orchestrator
  - Comprehension Monitor (signals windowing)
  - Teacher HUD Notifier

### 6) Feature Flags (default off)
- `FEATURE_ACE_SIMPLIFY` – enable simplification/chunking/slow‑repeat.
- `FEATURE_CURRICULUM_GLOSSARY_LOCK` – enforce glossary terms.
- `FEATURE_ACE_HUD` – send teacher hints.

### 7) Data Inputs
- Student settings: `lowLiteracyMode` (bool), language code.
- Signals: `comprehension_signal` (need_slower/confused/ok/repeat) per student.
- Glossary: per‑class map (term → target language → locked translation).
- Runtime: latency measurements, error counts.

### 8) Pipeline – Detailed Behavior (MVP)
1. Teacher speaks → STT (existing) → text.
2. Translate text to each student’s language (existing).
3. Apply term‑locking (if enabled): replace glossary terms in translated output with locked forms (exact match; fuzzy later).
4. Per‑student delivery shaping (if `lowLiteracyMode` or class confusion > threshold):
   - Simplify: shorter sentences; avoid idioms; remove parentheticals; prefer SVO order.
   - Chunk: split into 1–2 clauses; enumerations become bullet‑like sentences.
   - Pace: slow playback or send browser TTS instructions with `autoPlay=true`.
5. Slow‑repeat triggers: if class confusion ≥ threshold within window, enqueue slow repeat with micro‑example when safe.
6. Teacher HUD: when trigger fires, send one‑line prompt to teacher.

Notes: Simplification MVP is rules‑based—no new ML required.

### 9) WebSocket Messages (additions)
- New (if `FEATURE_ACE_HUD`): `ace_hint` (server → teacher): `{ type: 'ace_hint', message, level, timestamp }`.

### 10) Glossary & Term‑Locking (MVP)
- Import: CSV `term,en,es,de,...` or `source_term,target_lang,target_term`.
- Storage: scoped by `classroomCode`/`sessionId` in DB.
- Runtime: word‑boundary regex; multi‑word support; track fidelity metric.

### 11) Simplification & Chunking Rules (examples)
- Split on `, ; : —` into short sentences (max ~12–15 words).
- Replace complex connectors (however, therefore) with simpler ones (but, so, then).
- Remove fillers (“we’re going to”, “perhaps we could”) → actions.
- Numerics: add worked example for patterns like `a × b ÷ c` (small values).

### 12) Slow‑Repeat Trigger (defaults)
- Window `W = 10s` after delivery; threshold `T_confuse = 0.15`; cooldown 20s.

### 13) Metrics & Logging
- Miscomprehension rate; time‑to‑understanding; glossary fidelity; TTS delivery breakdown.
- Dashboard endpoint for last 5/15 minutes.

### 14) Performance Targets
- P50 < 2s; P95 < 3.5s end‑to‑end.
- Term‑locking ≤ 10ms; simplification ≤ 5ms per output.

### 15) Privacy & Safety
- No raw audio leaves class in offline mode.
- Aggregated signals; no student identities exposed beyond existing UI.
- Profanity/PII redaction before simplification.

### 16) Acceptance Criteria (MVP)
- Term‑locking ≥95% fidelity in tests.
- Slow‑repeat triggers at >15% confusion within 10s.
- Low‑literacy students receive simplified, chunked, slower delivery.
- Latency targets met with 10–20 concurrent students.

### 17) Rollout
- Phase 0: feature‑flagged in staging; simulate signals.
- Phase 1 (2–4 weeks): 2–3 classrooms, ACE‑off vs ACE‑on crossover.
- Phase 2: add curriculum ingestion and expand pilots.

### 18) Risks & Mitigations
- Over‑simplification → quick revert toggle; term‑locking always on.
- False taps → per‑student rate limit; median filter.
- Language idiosyncrasies → minimal rules; locale lists later.

### 19) API Sketches
- `POST /api/glossary/import` → { classroomCode } + CSV.
- `GET /api/metrics/session/:id` → { miscomprehensionRate, latencyP50, latencyP95, fidelity }.

### 20) Testing Plan (ATDD)
- Unit: term‑locking; simplification; slow‑repeat logic; HUD emission.
- Integration: end‑to‑end flow with mock signals; latency; fidelity.
- Beta: classroom crossover; ACE‑on vs ACE‑off.
