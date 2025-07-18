# E2E Test Scenarios

This document captures the end-to-end (E2E) testing scenarios for the AIVoiceTranslator project. It is preserved across resets for reference and future test planning.

## Core Scenarios

1. **Teacher-Student Session Flow**
   - Teacher creates a session and receives a classroom code.
   - Student joins using the classroom code.
   - Teacher sends transcriptions; students receive translations.
   - Session lifecycle: join, disconnect, reconnect, end session.

2. **Translation Persistence**
   - All transcriptions and translations are persisted in the database.
   - Multiple transcriptions in a session are stored and retrievable.

3. **Multi-User Flows**
   - Multiple students join the same session.
   - Each student receives translations in their selected language.
   - Students can join/leave at any time; session state remains consistent.

4. **Session Lifecycle Edge Cases**
   - Teacher disconnects and reconnects; session and classroom code persist.
   - Student joins immediately after teacher registers.
   - Session cleanup and expiration.

5. **Error Handling**
   - Invalid classroom code.
   - Malformed messages.
   - Student/teacher tries to join a non-existent session.

6. **Analytics and Diagnostics**
   - Analytics page loads and displays session/translation stats.
   - Diagnostics page shows session and translation health.

## Notes
- All scenarios should be tested in isolation and with concurrent users.
- Database should be reset between tests for isolation.
- Mock orchestrators may be used for deterministic flows.

---

_Last updated: 2025-07-18_
