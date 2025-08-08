# E2E Bug Log

- [ ] Student connection status remains Disconnected after successful connection message
  - Symptom: `#connection-status` shows Disconnected while WS connection is open and register succeeded
  - Likely Cause: UI was not setting connected state on success branch of connection message
  - Fix: Set `uiUpdater.updateConnectionStatus(true)` on successful `connection` message in `client/public/js/student.js`
  - Status: Fixed

- [ ] Analytics UI missing IDs asserted by tests
  - Symptom: `#totalSessions`, `#todaySessions`, `#totalStudents`, `#avgDuration` missing causing Playwright failures
  - Fix: Added elements and populated via `/api/analytics/*` endpoints
  - Status: Fixed

- [ ] Suggestion buttons not found
  - Symptom: Playwright selector `.suggestion-btn:has-text("👥 Avg Students")` failed
  - Fix: Add `.suggestion-buttons` block with `.suggestion-btn` labels
  - Status: Fixed

- [ ] Rate limiting affecting analytics E2E
  - Symptom: Potential 429s during repeated analytics calls in tests
  - Fix: Disable rate limit in E2E/test via env checks
  - Status: Fixed


