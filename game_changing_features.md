## Game‑Changing Features (Defensible Moats, Not Just Features)

### Adaptive Comprehension Engine (ACE)
- **What**: Real‑time, per‑student reading‑level control, pacing, and simplification of translations; automatic slow‑repeat and icon hints; teacher gets live “simplify this” prompts.
- **Moat**: Continuous in‑class feedback + outcomes → models tuned to beginner ELL comprehension. Hard to copy without weeks of classroom data and UX tuning.
- **MVP**:
  - Use existing low‑literacy mode and student signals to dynamically shorten sentences, reduce vocab level, slow playback, and insert icon hints.
  - Teacher HUD: “Simplify” nudge when comprehension signals spike.
- **Why hard to copy**: Requires instrumentation, pedagogy‑aligned UX, and model tuning on real lessons; not just a translation API.
- **KPIs**: −25–40% “confused/need slower” signals; −20% time‑to‑understanding; improved attendance/participation.

### Federated Accent & Dialect Personalization (on the gateway)
- **What**: On‑prem/edge adaptation for teacher and student accents/dialects to boost ASR + translation, without sending audio off device.
- **Moat**: Privacy‑preserving adaptation + accumulated classroom‑tuned profiles; each school gets better over time.
- **MVP**:
  - Capture per‑speaker embeddings on the gateway.
  - Periodic local fine‑tuning/adaptation; cache per‑speaker profiles.
- **Why hard to copy**: Infra + privacy + training workflow; consented local data creates non‑portable advantage.
- **KPIs**: −30% WER for adapted speakers; lower translation edit rate; stable latency.

### Curriculum‑Aware Translation (Term‑locking + prelearned class packs)
- **What**: Ingest slides/docs; auto‑extract glossary; lock key terms; bias translation to the week’s vocabulary targets.
- **Moat**: Tight coupling with lesson content and assessments; higher accuracy where it matters pedagogically.
- **MVP**:
  - Upload PDF/slide; generate glossary; enforce preferred translations at runtime.
  - One‑tap teacher corrections update session memory.
- **KPIs**: ↓ term errors; ↑ alignment to syllabus; fewer teacher corrections.

### Guaranteed‑Offline m:n Gateway Appliance (deterministic classroom SLA)
- **What**: A plug‑and‑play gateway (Pi/NUC) guarantees sub‑2s m:n voice+captions across mixed devices; voice pack caching, bandwidth shaping, admin controls.
- **Moat**: Deterministic performance + ops playbook for schools with poor/blocked internet.
- **MVP**:
  - Package local STT/MT/TTS tiers + caching; ship a configured image; collect reliability metrics.
- **KPIs**: ≥99.5% offline reliability; P50 < 2s, P95 < 3.5s latency.

### AR Classroom Overlay (as a channel, not the core)
- **What**: Glasses show per‑student captions at tuned reading levels; teacher HUD shows live comprehension/pace indicators.
- **Moat (only with above)**: Becomes defensible when combined with ACE + gateway + curriculum packs; otherwise easily cloned.
- **MVP**: Web overlay to supported AR browser; start with teacher HUD.

---

## Flagship Wedge to Own
- **ACE + Federated Accent Personalization on the Offline Gateway**.
- Offline, privacy‑preserving, outcome‑driven; improves every class; directly tied to school equity goals.

---

## 4‑Week Fast Build Plan (leveraging existing code)
- **Week 1 – Instrumentation + Controls**
  - Add reading‑level/pace knobs; use low‑literacy mode to simplify phrasing and slow TTS when signals spike.
  - Log comprehension signals + delivery metrics per student.
- **Week 2 – Curriculum Bias**
  - Upload class docs → glossary extraction → term locking in translation pipeline.
- **Week 3 – Edge Adaptation Pilot**
  - Store per‑speaker embeddings on gateway; run local adaptation; A/B accuracy vs baseline.
- **Week 4 – Teacher Guidance + Reporting**
  - Live “simplify this” prompts; export weekly equity/comprehension report (grant‑ready).

---

## Success Metrics (to prove a moat)
- −25–40% miscomprehension signals; −20% time‑to‑understanding vs Microsoft in live pilot.
- Offline reliability ≥99.5% with sub‑2s median latency; reproducible across classrooms.
- Fewer teacher corrections and higher syllabus term fidelity.

---

## Dependencies & Risks
- Consent + privacy for edge adaptation; clear opt‑in and retention windows.
- Glossary extraction quality on messy slides; provide teacher review UI.
- AR varies by device/browser; start with teacher HUD (lower risk).

---

## Feature Flag Map (for incremental rollout)
- `FEATURE_ACE` – master flag enabling simplification/chunking, term‑locking, slow‑repeat triggers, and teacher HUD hints.
- `FEATURE_EDGE_ADAPTATION` – enable on‑gateway per‑speaker adaptation.
- `FEATURE_AR_HUD` – enable teacher HUD overlay channel.

---

## Privacy/Compliance Notes
- Default to on‑prem processing with federated adaptation; no raw audio leaves the gateway without consent.
- FERPA/GDPR friendly defaults; per‑session consent + retention controls; audit logs.
