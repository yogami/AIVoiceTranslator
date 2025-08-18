## Feature: On‑Demand Elaboration (Real‑Time Micro‑Tutoring)

### 1) Summary
- Students can tap “Elaborate” on the last spoken/translated line to receive a brief, simpler explanation and a concrete example in their own language. Optional picture hint if provided by teacher notes. Auto read‑aloud for low‑literacy.

### 2) Goals & Outcomes
- Move from “I heard it” to “I get it”.
- Reduce miscomprehension signals after an elaboration within the same segment.
- Keep latency budget: offline elaboration <1.5s; online <3s.

### 3) Scope (MVP)
- Student UI: button “Elaborate” bound to last `translation` message.
- Server: rate‑limited elaboration service with two tiers:
  - Tier 1 (offline): glossary lookup + templated simplification + one worked example.
  - Tier 2 (optional): online LLM explanation (2–3 sentences) if enabled.
- Delivery: `elaboration` message to the student; teacher can “Pin to all”.

### 4) Flags
- `FEATURE_ELABORATE=1` (enable)
- `FEATURE_ELABORATE_ONLINE=0|1` (optional online fallback)
- `FEATURE_ELABORATE_PIN_TO_ALL=1` (teacher control)

### 5) UX Details
- Student: shows a small info card under the last line; includes an example and a picture (if note available), with a Play button (or auto for low‑literacy).
- Teacher: sees aggregate count of elaboration requests by segment; can “Pin to all” to broadcast the elaboration to the class.

### 6) API & Messages
- Client → Server (student): `student_elaborate_request` { segmentId }
- Server → Client (student): `elaboration` { segmentId, text, example?, imageUrl?, autoPlay?, languageCode }
- Server → Client (teacher): `elaboration_stats` { segmentId, count }
- Client → Server (teacher): `pin_elaboration` { segmentId }

### 7) Data Sources (Tier 1 offline)
- Class glossary (locked terms → simple definitions)
- Teacher notes (short explanations; optional image links)
- Rule templates: simplify sentence; add single worked example if numerics present; avoid idioms; keep ≤ 250 chars.

### 8) Algorithm (Tier 1)
1. Fetch last segment text (student language) + source (teacher lang).
2. Identify key term(s) in the sentence from glossary → include brief definition.
3. Simplify sentence via rules (shorten; basic connectors; remove parentheticals).
4. If numeric pattern present (×, ÷, %, units), synthesize a tiny example.
5. Compose card: definition + simplified line + example; ensure ≤ 2–3 sentences.

### 9) Latency & Rate Limits
- Per student: 1 request per 10 seconds (configurable)
- Per segment: cap at 3 elaborations per student; teacher “Pin” bypasses rate limit
- Budget: offline < 1500 ms; online < 3000 ms

### 10) Privacy & Safety
- No student free‑form text required; purely derived from delivered segment.
- No off‑device calls when `FEATURE_ELABORATE_ONLINE=0`.
- Profanity/PII redaction applied prior to elaboration.

### 11) Metrics
- Post‑elaboration miscomprehension rate delta (same segment, 30s window)
- Use rate per class; % pinned by teacher
- Latency per elaboration tier

### 12) Acceptance Criteria (MVP)
- Elaborate request returns a concise card in correct language within budget.
- “Pin to all” delivers the same card to all students in session.
- Post‑elaboration miscomprehension decreases for that segment.

### 13) Rollout
- Stage behind `FEATURE_ELABORATE`; pilot in 1–2 classes; collect metrics.

---
Owner: Engineering • Version: 1.0 • Flags: `FEATURE_ELABORATE`, `FEATURE_ELABORATE_ONLINE`, `FEATURE_ELABORATE_PIN_TO_ALL`
