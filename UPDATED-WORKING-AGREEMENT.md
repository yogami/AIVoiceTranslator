# Updated Working Agreement: Selenium Testing Changes

This document details the changes made to the Working Agreement regarding Selenium testing. The following sections have been modified to reflect our decision to move away from Selenium testing due to its unreliability in CI/CD environments.

## 3. Local Testing Strategy (Replit) - UPDATED

| Test Type | Execution Environment |
|-----------|------------------------|
| Unit Tests (mocked) | ✅ Replit local |
| Integration Tests | ✅ Replit local |
| Direct WebSocket Tests | ✅ Replit local and GitHub CI/CD |
| Puppeteer/Jest Headless Tests | ✅ GitHub CI/CD |

✅ Local stability before pushing.

### 3.1 UI and User Interface Testing - UPDATED

**Agent Must:**
- Verify UI and user interface issues using a combination of these more reliable methods:
  1. Direct WebSocket Tests (like `direct-websocket-test.html` and `bare-websocket-test.html`) 
  2. Puppeteer for headless browser testing when visual UI elements need verification
  3. Jest with JSDOM for component testing
- For manual verification of UI fixes, create automated tests first using the above methods, then implement the fix
- Define assertions that explicitly verify the UI behavior being fixed
- Include test cases for all identified edge cases

### 3.2 Verification and Fix Validation Policy - UPDATED

**Agent Must:**
- **ONLY claim that an issue has been fixed AFTER appropriate automated tests have passed in both local and CI/CD environments**
- Consider an issue as NOT fixed if the corresponding test fails in CI/CD
- Create appropriate tests for every UI or user interaction fix before implementing the fix
- Avoid manual testing except for initial issue diagnosis
- For each fix, add a specific test that would have failed before the fix and passes after
- Document the specific test that verifies each fix in the commit message and session journal

✅ Zero to minimal need for manual testing; all fixes are validated by automated tests in CI/CD.

## 6. CI/CD Pipeline Verification (GitHub Actions) - UPDATED

**Pipeline Must:**
- Trigger on push to `main`.
- Run:
  - Unit tests.
  - Integration tests.
  - Direct WebSocket tests.
  - Puppeteer headless tests (when UI needs verification).
- Fail immediately if any test fails.
- No deployment allowed if pipeline is red.

✅ Full system verification every small check-in.

## Master Workflow Summary - UPDATED

```
0. Boot from Craftsmanship Memory
↓
1. Understand Problem Deeply
↓
2. Write Mock-Driven Tests (London TDD)
↓
3. Write Direct API/WebSocket Tests or Puppeteer Tests for UI Fixes
↓
4. Minimal Code to Pass Tests
↓
5. Immediate Refactor
↓
6. Update Metrics, Docs
↓
7. Small Commit to Main (Trunk-Based)
↓
8. GitHub CI/CD Full Pipeline Test
↓
9. Verify Fix via Tests in CI/CD
↓
10. Lightweight Code Review (if needed)
↓
11. Log Observability Changes
↓
12. Journal, Debt Tracking
↓
(REPEAT)
```

## Rationale for Change

Selenium tests have proven unreliable in GitHub Actions CI/CD environments, leading to false negatives and unnecessary troubleshooting. The proposed alternative testing methods provide more reliable verification while maintaining the spirit of test-driven development and automated verification.

This change significantly improves:

1. **Build stability** - Fewer random failures in CI/CD
2. **Developer productivity** - Less time spent debugging flaky tests
3. **Confidence in fixes** - More reliable test results

The direct WebSocket testing approach has already demonstrated better reliability in verifying connection and communication functionality.
