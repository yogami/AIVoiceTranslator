## Offline Classroom Gateway – Detailed Feature & Deployment Specification

### 1) Overview
- Purpose: Deliver many‑to‑many (m:n) voice + captions with sub‑2s latency entirely offline for beginner ELL classrooms.
- Core: Local gateway runs STT/MT/TTS, glossary locking, ACE MVP shaping, WebSocket server, metrics, and admin UI.
- No Internet required during class. All models, voices, and static assets are pre‑loaded.

### 2) Scope & Assumptions
- Class size: 1 teacher + 10–30 students (BYOD: phones/tablets/laptops with modern browsers).
- Content: short utterances (≤15 seconds per sentence) in typical classroom cadence.
- Languages: practical set supported by local TTS (eSpeak‑NG) and offline STT model (Whisper.cpp). Multilingual mix is supported; performance varies by language.
- Data residency: all audio/text stays on LAN; no cloud calls when in offline mode.

### 3) Performance Targets (SLA)
- Latency: P50 < 2.0s, P95 < 3.5s end‑to‑end (teacher speech → student audio/caption) for ≤20 concurrent students.
- Reliability: ≥99.5% session uptime over 2‑hour block without Internet.
- Degrade policy: on CPU pressure, drop to captions‑only, then 1→many sequencing if needed.

### 4) Hardware Requirements
- Option A (recommended portable):
  - Raspberry Pi 5 (8 GB RAM) or Pi 4 (8 GB; Pi 5 preferred for headroom)
  - Storage: 128 GB UHS‑I SD or USB3 SSD (better); pre‑load models/voices/cache
  - Network: Gigabit Ethernet to school LAN; optional dual‑band USB Wi‑Fi for AP mode
  - Power: 27W USB‑C PSU; optional mini‑UPS for brownouts
  - Cooling: active heatsink/fan for sustained loads
- Option B (higher capacity):
  - Intel NUC/mini‑PC (i5 class, 16 GB RAM, 256 GB SSD)
  - Same network/power guidance
- Peripherals (teacher): mic (USB or laptop), speakers in classroom, no special student hardware

### 5) Network Topologies
- Mode 1 (LAN client mode – simplest):
  - Gateway connected via Ethernet to school LAN; students/teacher join the same SSID/VLAN.
  - Static IP (e.g., 10.10.20.50) or DHCP reservation; optional mDNS `gateway.local`.
- Mode 2 (AP mode – fully isolated):
  - Gateway runs Wi‑Fi AP (`hostapd` + `dnsmasq`) with SSID “Classroom‑Translate”.
  - DHCP range e.g., 192.168.50.0/24; captive portal optional; no Internet forwarding.

### 6) Software Stack (offline)
- OS: Raspberry Pi OS 64‑bit / Ubuntu Server 22.04 LTS (NUC)
- Container runtime: Docker + Docker Compose
- Services (containers unless noted):
  - Web/API/WS server (Node.js, this repo build)
  - STT offline: Whisper.cpp (CPU), model pre‑loaded (e.g., `base` or `small` multilingual)
  - MT offline: LocalTranslationService (basic rules/phrase table); optional cached glossaries; no external API
  - TTS offline: eSpeak‑NG, voices pre‑installed; optional Piper models if available locally
  - DB: PostgreSQL (local) or SQLite (for kiosk/simple); logs to disk with rotation
  - Admin UI: simple HTTP UI for status, glossary upload, cache ops
- Static assets: pre‑built client app served from gateway; no external CDNs/fonts

### 7) Environment Configuration (100% offline)
- Required `.env` (server):
  - `STT_SERVICE_TYPE=whispercpp`
  - `TRANSLATION_SERVICE_TYPE=offline`
  - `TTS_SERVICE_TYPE=local`
  - `ENABLE_DETAILED_TRANSLATION_LOGGING=true` (optional diagnostics)
  - `COMMUNICATION_PROTOCOL=websocket`
  - `NODE_ENV=production`
  - `HOST=0.0.0.0`
- ACE/UX flags (optional):
  - `FEATURE_LOW_LITERACY_MODE=1`
  - `FEATURE_CLASSROOM_MODES=1`
  - `FEATURE_LIVE_COMPREHENSION_INDICATORS=1`
  - `FEATURE_ACE_SIMPLIFY=1`
  - `FEATURE_CURRICULUM_GLOSSARY_LOCK=1`
  - `FEATURE_ACE_HUD=1`

### 8) Model & Voice Assets (pre‑load)
- Whisper.cpp model (choose one):
  - `ggml-base` (~140 MB) good compromise; `small` (~460 MB) better accuracy; ensure disk headroom
- TTS voices:
  - eSpeak‑NG voice set for target languages (e.g., de, en, ar, tr, uk, ru, fa, ps, fr, es)
  - Optional Piper models (if licensed and pre‑installed)
- Glossaries:
  - Per‑class CSVs stored under `glossaries/<classroomCode>.csv`

### 9) Ports & Security
- Exposed: 80/443 (HTTP/HTTPS) to LAN/AP; 22 (SSH) admin only (optional)
- TLS: self‑signed cert or school CA for HTTPS; otherwise restrict to LAN/AP and use HTTP
- Admin UI: password‑protected; LAN‑only or AP‑only
- Data: no raw audio off‑device; PII/profanity redaction enabled

### 10) Installation Steps (Pi/NUC)
1. Flash OS (64‑bit), boot, set hostname `gateway`, enable SSH (optional)
2. Install Docker & Docker Compose
3. `git clone` repo to `/opt/aivoice` (or copy bundle)
4. Copy `.env` from `config/env.example`; set offline tiers and flags
5. Pre‑load models/voices:
   - Whisper.cpp model to `/opt/aivoice/models/whisper/`
   - eSpeak‑NG voices installed (`espeak-ng-data`) or volume‑mounted
6. Build client (`npm run build:client`) and server (`npm run build:server`) if building on‑device; else copy `dist/`
7. Start stack: `docker compose up -d` (compose file pins all services)
8. Verify health: hit `http://gateway.local/teacher` and `/student?code=...`

### 11) AP Mode (optional fully offline)
- Install and configure `hostapd` (SSID, WPA2/WPA3) and `dnsmasq` (DHCP 192.168.50.0/24)
- Set gateway IP 192.168.50.1; firewall blocks WAN; allow 80/443 intra‑LAN
- Option: captive portal redirect `http://gateway.local`

### 12) Caching & Persistence
- Translation cache (text → target) for recent phrases
- TTS audio cache (hash(text, lang) → MP3/WAV) with LRU eviction
- Glossary cache in memory with on‑disk backup
- Log rotation `/var/log/aivoice/*.log` (size‑based)

### 13) Capacity Planning (guidance)
- Pi 5 (8 GB): 1 teacher + up to ~20 students with P50 < 2s (base/small model)
- Pi 4 (8 GB): 1 teacher + ~12–15 students (prefer `base` model)
- NUC i5 (16 GB): 1 teacher + ~30 students comfortably
- If total CPU > 85% sustained: auto switch to captions‑only; then queue TTS per student

### 14) Admin UI – Minimum Functions
- Status: services up, CPU/RAM, latency P50/P95, connected students
- Controls: restart services, clear caches, upload glossary CSV, toggle flags
- Logs download; data retention window (e.g., 7 days)

### 15) Testing & Validation Protocol
- Soak test 2 hours with 15–25 simulated students (websocket clients)
- Inject 2–5% packet loss and ±100–300 ms jitter; confirm SLA
- Validate glossary fidelity ≥95% using scripted phrases
- Record metrics for pilot report

### 16) Maintenance & Updates
- Backup: periodic tar of `/opt/aivoice/config`, glossaries, DB
- Updates: pull new image bundle; `docker compose pull && up -d`; rollback kept
- Optional OTA: signed artifact check; deferred if budget constrained

### 17) School Environment Requirements
- Power: single outlet per classroom (gateway + speakers)
- Network:
  - Mode 1: Ethernet drop to LAN with student device Wi‑Fi to same VLAN, or
  - Mode 2: none (AP mode creates private classroom Wi‑Fi)
- Devices: student browsers (Chromium/Firefox/Safari ≥ last 2 versions); audio output available
- Policy: permit self‑signed TLS or operate HTTP on isolated AP; no outbound Internet required

### 18) Risk & Mitigation
- Thermal throttling → use active cooling
- SD wearout → prefer SSD; enable log rotation
- Browser autoplay restrictions → use user gesture to start audio, or browser TTS path
- Language gaps in eSpeak‑NG → pre‑vet supported languages per school; offer captions‑only for others

### 19) Acceptance Criteria (Gateway MVP)
- Offline tiers enforced; service runs from cold start without Internet
- Latency SLA met for target class size
- Admin UI operational; glossary upload works; caches behave
- Students/teacher complete a 45‑minute class without incident

### 20) Appendices
- Example `.env` (offline):
  - `STT_SERVICE_TYPE=whispercpp`
  - `TRANSLATION_SERVICE_TYPE=offline`
  - `TTS_SERVICE_TYPE=local`
  - `FEATURE_LOW_LITERACY_MODE=1`
  - `FEATURE_CLASSROOM_MODES=1`
  - `FEATURE_LIVE_COMPREHENSION_INDICATORS=1`
  - `FEATURE_ACE_SIMPLIFY=1`
  - `FEATURE_CURRICULUM_GLOSSARY_LOCK=1`
  - `FEATURE_ACE_HUD=1`
- Recommended models/voices list with file sizes

---
Owner: Engineering • Version: 1.0 • Target: Pilot deployments in Germany (Berlin)
