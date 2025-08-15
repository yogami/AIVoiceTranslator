## Features that would make my prototype unique

### Prioritized feature ranking (quick wins first, filling competitor gaps)
1. Device-agnostic join (QR/link, browser-only; no ecosystem lock-in)
2. Guest mode, minimal data (no student accounts; ephemeral IDs)
3. Teacher dashboard (basic controls: start/stop, languages, mute, lock settings)
4. Student simple UI (big language buttons, audio/captions toggle)
5. Voice-to-voice + captions (simultaneous audio and subtitles)
6. Bilingual artifacts (transcripts, summaries, vocabulary exports)
7. Readable captions accessibility basics (font size, contrast, dyslexia option)
8. Adaptive bitrate & codec (handles poor school Wi-Fi)
9. Noise suppression & diarization (reduce crosstalk in classrooms)
10. True m:n translation (multiple speakers to multiple languages simultaneously)
11. Low-latency streaming (<2s with incremental captions)
12. Low-resource language coverage (transliteration, romanization, pivoting)
13. Picture dictionary & keyword cards (tap-to-see images/definitions)
14. Low-literacy mode (icon-forward, simplified phrasing, caption TTS)
15. Live comprehension indicators (need slower/confused signals)
16. Equity dashboard (participation/comprehension trends for ELLs)
17. Profanity and PII filters (optional redaction in captions/audio)
18. Admin controls (retention, export, consent)
19. Regional hosting options (EU residency, on-prem gateway option)
20. Offline/edge mode (local inference classroom gateway)
21. LMS/LTI support (roster sync, artifact posting)
22. Open APIs & webhooks (events, transcripts, analytics export)
23. Classroom modes (lecture, pair, group; quick breakouts)
24. Cost controls (TTS caching, offline assist)
25. School-friendly pricing (class/session-based, predictable)

### Uniquely differentiating features (not covered by listed competitors)
- Low-resource language coverage (transliteration, romanization, pivoting)
- Picture dictionary & keyword cards (tap-to-see images/definitions)
- Low-literacy mode (icon-forward, simplified phrasing, caption TTS)
- Live comprehension indicators (need slower/confused signals)
- Equity dashboard (participation/comprehension trends for ELLs)
- Profanity and PII filters (optional redaction in captions/audio)
- On-prem school gateway option (distinct from general regional hosting)
- Offline/edge mode (local inference classroom gateway)
- LMS/LTI support (roster sync, artifact posting)
- Open APIs & webhooks (events, transcripts, analytics export)
- Classroom modes (lecture, pair, group; quick breakouts)
- Cost controls (TTS caching, offline assist)

### Core many-to-many engine (real-time)
- **True m:n translation**: Multiple speakers to multiple target languages simultaneously; each participant selects their language.
- **Voice-to-voice + captions**: High-quality TTS in each target language with synchronized captions; user can toggle either.
- **Device-agnostic join**: Join via QR code or short link; works in modern browsers on phones, tablets, laptops—no app required.
- **Low-latency streaming**: Sub-2s target end-to-end with partial (incremental) captions and progressive audio.
- **Accent-robust ASR**: Models tuned for diverse accents and classroom noise; per-speaker adaptive profiles that improve over time.
- **Low-resource language coverage**: Support immigrant/refugee languages using transliteration fallback, romanized captions, and language-pair pivoting.
- **Offline/edge mode (classroom gateway)**: Optional local inference for small classes; cloud-enhanced when online.

### Classroom-first experience
- **Teacher dashboard**: Start/stop sessions, set class languages, manage participants, mute/disconnect, lock captions/voice settings.
- **Student simple UI**: Big language buttons, one-tap audio/captions toggle, readable fonts, color-safe palette.
- **Classroom modes**: Lecture, pair, and group work. Fast breakout creation with per-group m:n channels.
- **Picture dictionary & keyword cards**: Tap on translated words to see images and simple definitions (per student language).
- **Scaffolded learning controls**: Repeat/slow-down, emphasize key phrases, and auto-build class phrasebook.
- **Bilingual artifacts**: Export transcripts, bilingual summaries, and key vocabulary lists for homework/parents.

### Accessibility & inclusion
- **Readable captions**: Adjustable font size, line length, dyslexia-friendly option, high-contrast themes.
- **Low-literacy mode**: Icon-forward UI, simplified phrasing, optional text-to-speech for captions.
- **Hearing support**: Live captions with per-user language; integration hook for third-party sign-language services.
- **Parent/guardian mode**: Quick language selection and passcode join for conferences.

### Reliability & performance
- **Adaptive bitrate & codec**: Auto-adjust to bandwidth; graceful degrade to 1→many or 1↔1 as needed.
- **Noise suppression & diarization**: Classroom-tailored noise filtering and speaker separation to reduce crosstalk errors.
- **Local caching**: Cache TTS voices and recent vocabulary to minimize roundtrips and cost.
- **Profanity and PII filters**: Optional redaction in captions and audio.

### Privacy, security, and compliance
- **Guest mode, minimal data**: No account required for students; per-session ephemeral identifiers.
- **Admin controls**: Data retention windows, export policies, and consent flows per session.
- **Regional hosting options**: EU data residency; on-prem school gateway option.
- **Compliance-ready**: FERPA/GDPR oriented defaults; audit logs for admins.

### Insights & social impact
- **Live comprehension indicators**: Optional per-student signals (e.g., “need slower”, “confused”) without disrupting class.
- **Equity dashboard**: Participation and comprehension trends for ELL students; exportable for grants and school reporting.
- **Vocabulary growth tracking**: Per-class and per-student phrase acquisition over time.

### Integrations & extensibility
- **No ecosystem lock-in**: Works standalone on the web; lightweight add-ons for Teams/Zoom/Meet when desired.
- **LMS/LTI support**: Simple class roster sync and artifact posting to common LMSs.
- **Open APIs & webhooks**: Session events, transcripts, analytics export, and custom voice pack loading.

### Pricing & operations
- **School-friendly pricing**: Classroom/session-based with usage caps; predictable budgeting for admins.
- **Cost controls**: Offline/edge mode reduces cloud spend; per-language TTS caching.

### Clear differentiation vs competitors
- **Lightweight, browser-first m:n**: Simultaneous multi-language audio and captions on any device, no app or ecosystem lock-in.
- **Beginner-focused scaffolding**: Picture dictionary, slowed repeats, and auto phrasebooks tailored to immigrant/refugee classes.
- **Offline option**: Local gateway for unreliable internet—rare among competitors.
- **Low-resource language strategy**: Practical transliteration/romanization fallbacks and pivoting to broaden coverage.
- **Impact analytics**: Equity dashboard and grant-ready reporting for schools.

---

### Implementation roadmap tags
- **[MVP]**: True m:n streaming, device-agnostic join, captions+TTS, teacher dashboard (basic), student simple UI, adaptive bitrate, noise suppression, guest mode, basic analytics export.
- **[NEXT]**: Breakout modes, picture dictionary, phrasebook, low-literacy mode, profanity/PII filters, EU hosting, LMS/LTI, open APIs.
- **[LATER]**: Offline/edge gateway, low-resource language transliteration packs, advanced equity dashboard, third-party sign-language integration.
