## Feature Document: Two-Way Communication

### Overview
Enable structured, real-time two-way communication between teachers and students who speak different languages. Students can ask questions in their native language; teachers receive concise translated summaries and respond efficiently via text or short audio, with delivery to the student (or class) in each recipient’s preferred language.

### Problem Statement
Generic meeting tools provide live captions/translation, but they do not solve classroom-specific needs: identifying which student is asking what, triaging requests fairly, replying privately vs. publicly, and tracking comprehension over time. We aim to orchestrate multilingual interaction around pedagogy, not just provide captions.

### Goals
- Provide a low-latency, structured request/reply loop that works in noisy classrooms.
- Give teachers a clear, moderated queue of student requests with identity, language, and brief context.
- Allow teachers to reply privately (to one student) or publicly (to class) with one tap.
- Support translation both ways, with optional TTS for accessibility.
- Ship incrementally behind a feature flag (trunk-based development) to avoid disrupting current flows.

### Non-Goals (Initial)
- Full open floor, unmoderated live cross-talk.
- Advanced discourse analysis or auto-grading of answers.
- Persistent public chat histories.

### User Roles and Stories
- Teacher: “I see who needs help, in which language, and what they need. I can answer quickly, privately or to the class.”
- Student: “I can ask questions in my language and get understandable answers fast, without disrupting class.”

### UX Summary
- Student
  - Push-to-talk “Ask in my language.” Auto-detect or pre-set language.
  - Choose visibility: Ask privately vs. Ask to class.
  - Optional quick tags: Confused, Need definition, Missed step.
- Teacher
  - Request Queue: avatar, name, language badge, short translated summary.
  - One-tap canned replies auto-translated (and TTS if enabled).
  - Mode toggle: Reply to student only vs. Answer to all.
  - Throttling/rate limits to prevent spam; promote request to 1:1 side panel if needed.

### Differentiation vs. Meet/Teams/Skype
- Education-first orchestration: moderated request queue with identity and context, not just captions.
- Pedagogical layer: rephrase/simplify, vocabulary alignment, age-appropriate rewrites.
- Classroom workflows: classroom codes, in-person usage, privacy controls suitable for K–12.
- One-to-many translation with structured feedback loops and analytics.

### Phased Rollout
1) Phase 1 – Text-only requests and replies (MVP)
   - Student push-to-talk → STT → translate → teacher queue (text summary).
   - Teacher reply (text) → translate → student receives text (optional client-side TTS).
   - Feature flag: off by default; enable for pilot classrooms.
2) Phase 2 – Add TTS both ways
   - Teacher replies via quick phrases or short dictation → students hear in their language.
   - Maintain queue controls and fairness mechanisms.
3) Phase 3 – Live conversational turns
   - Short back-and-forth interactions per student tile; partial transcripts; escalate to private 1:1 when needed.

### Effort & Timeline
Assumptions
- Existing STT, translation, and TTS services are already integrated in the codebase; we will compose them into new flows.
- One backend and one frontend engineer primary, with part-time design and QA. Feature is gated behind a runtime feature flag for trunk-based development.
- Target latency: P50 ≤ 1.5s end-to-end for text requests; P95 ≤ 3.5s; classroom network conditions vary.

Phase 1 – Text-only requests and replies (MVP) – 2–3 weeks (≈ 4–5 person-weeks)
- Backend (Request Queue service, WS events, rate limiting, session mapping, translation routing, privacy controls): 5–7 days
- Student UI (push-to-talk button, language selector/preset, request visibility option, telemetry): 2–3 days
- Teacher UI (request queue panel, translated summaries, reply composer, private/public toggle): 3–4 days
- Observability/analytics (metrics, logs, dashboards, sampling): 1–2 days
- Tests (unit, component, e2e happy-path + throttling): 3–4 days
- Rollout (feature flag plumbing, pilot enablement, docs): 1–2 days

Phase 2 – Add TTS both ways – ~2 weeks (≈ 3–4 person-weeks)
- Server delivery pipeline adds TTS rendering and caching; per-language voice mapping; fallback handling: 4–5 days
- Teacher reply via quick phrases/dictation; client playback controls; accessibility options: 3–4 days
- Performance/Cost controls (length caps, batching, pre-warm voices): 2–3 days
- Tests (latency, audio correctness, degraded-mode): 2–3 days

Phase 3 – Short live conversational turns – 3–4 weeks (≈ 6–8 person-weeks)
- Turn-taking orchestration, per-student tiles, partial transcript streaming, 1:1 escalation: 7–10 days
- Advanced moderation (cool-downs, conflict resolution, batching duplicates): 3–4 days
- Performance tuning and resilience (backpressure, retries, vendor rate limits): 3–5 days
- UX polish, accessibility, and final test hardening: 3–5 days

Staffing and Calendar Notes
- With 2 engineers (1 FE, 1 BE) most work streams parallelize to the durations above. With 1 engineer, expect ~1.6× longer calendar time. With 3 engineers, expect modest compression (handoff costs still apply).
- Rollout is staged via feature flag, enabling small pilot cohorts first; collect metrics and expand.

### Success Metrics
- Time-to-first-teacher-response for student requests.
- Teacher load (requests handled/minute) and perceived workload.
- Student comprehension improvements (before/after teacher interventions).
- Translation quality feedback (thumbs up/down, rephrase rate).
- Latency and cost per utterance within targets.

### Technical Design (High-Level)
- Client
  - Student: push-to-talk capture → local VAD → send audio chunks over WebSocket → server STT → translation → request event.
  - Teacher: receive queued requests (WS events) → accept/respond → server translates → route to recipient(s); optional TTS output.
- Server
  - WebSocket broker for request/response events and presence.
  - STT service with auto-fallback; translation service; optional TTS output pipeline.
  - Request Queue service linked to session/classroom identity; rate-limiting and moderation.
  - Delivery modes: private (1:1) or broadcast (one-to-many); per-recipient language mapping.
- Data
  - Minimal retention by default; ephemeral request state; analytics events recorded with privacy controls.

### Latency, Cost, and Moderation Controls
- Stream partial transcripts first; finalize before TTS.
- Push-to-talk + VAD and classroom noise suppression.
- Rate limits per student/class; batching similar questions; canned replies to reduce tokens.
- Token/character caps and service tier fallbacks to control cost.

### Security and Privacy
- Classroom identity/authorization tied to session codes; private vs. public delivery enforced server-side.
- Default-minimum data retention; opt-in analytics aligned with FERPA/COPPA-minded constraints.
- Clear UI affordances indicating visibility (private/public) for every teacher reply.

### Feature Flag and Rollout
- Entire feature is gated behind a runtime feature flag to support trunk-based development and safe pilots.
- Pilot with select classrooms; gather metrics/feedback; gradually expand while monitoring cost/latency.

### Risks and Mitigations
- Latency: stream partials; prioritize short teacher replies; pre-warm TTS voices.
- Noise/overlap: enforce push-to-talk; queue moderation; per-student cool-downs.
- Teacher overload: batching, canned replies, promote to 1:1 when needed.
- Cost: caps, cheaper model fallbacks, on-device options where feasible.

### MVP Acceptance Criteria (Phase 1)
- Student can submit a voice question in native language; teacher sees identity, language badge, and translated summary in a queue.
- Teacher can reply with text; student receives translated text (and can play TTS locally if enabled).
- Private vs. public reply modes work and are clearly indicated in the UI.
- Basic rate limiting in place to prevent spam.
- Feature flag can enable/disable the feature per classroom.

### Open Questions
- Do we store request/response pairs for limited time to support analytics, or remain fully ephemeral by default?
- What default languages and TTS voices do we ship for Phase 2?
- Should students see anonymized peers’ public answers in their language, or only the teacher’s?


