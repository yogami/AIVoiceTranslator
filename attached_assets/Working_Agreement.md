
# Working Agreement: Replit Agent for Software Craftsmanship

## Introduction

This Working Agreement defines how the Replit agent must behave to fully embody **Software Craftsmanship principles**, **Clean Code**, **London School TDD**, and **DevOps excellence** through a highly disciplined workflow.

- **GitHub Repository:**  
  `https://github.com/yogami/AIVoiceTranslator`

- **Main branch:**  
  `main`

✅ This is the *source of truth* for code, testing, CI/CD, and project history.

---

## 0. Preparation Phase: Boot from Craftsmanship Memory

**Agent Must:**
- Connect to PostgreSQL assets database.
- Fetch and load craftsmanship guides:
  - `Clean-Code-Cheat-Sheet-V1.3.md`
  - `Clean-TDD-Cheat-Sheet-V1.2.md`
  - `code-quality-metrics-cheatsheet.md`
  - `pragmatic-principles-cheat-sheet.v1.md`
- Set internal craftsmanship principles memory based on these guides.

✅ No work allowed until memory is loaded and confirmed.

---

## 1. Problem Understanding Phase

**Agent Must:**
- Understand feature/task clearly.
- Validate against any missing business or system requirements.
- Clarify expected inputs, outputs, and boundary conditions.
- Update session notes with initial understanding.

✅ No coding without full clarity.

---

## 2. London School TDD Cycle (Behavior-Driven Development)

**Agent Must:**
- Write **mock-driven unit tests first** (focusing on **messages and interactions**).
- Use mocks, fakes, and stubs to isolate behavior.
- Discover system design through tests (interface-first thinking).
- Only write minimal code needed to pass the current test.
- Refactor immediately after passing tests.
- Use **Pair Programming Mindset**: if agent is uncertain, *ask for human assistance rather than guessing*.

✅ Test-first, behavior-driven, collaborative approach.

---

## 3. Local Testing Strategy (Replit)

| Test Type | Execution Environment |
|-----------|------------------------|
| Unit Tests (mocked) | ✅ Replit local |
| Integration Tests | ✅ Replit local |
| Selenium Headless E2E Tests | ❌ Only written locally, ✅ executed in GitHub CI/CD |

✅ Local stability before pushing.

---

## 4. Small Check-ins and Trunk-Based Development

**Agent Must:**
- **Commit every 20–60 minutes** of work.
- **Small, logical, stable commits** only.
- Push directly to `main` branch on GitHub (`https://github.com/yogami/AIVoiceTranslator`).
- **Use feature flags** to wrap incomplete features safely.
- **Always leave trunk green** (no broken builds).

✅ Continuous integration, never batch commits.

---

## 5. Mandatory Clean Code and SOLID Enforcement

**Agent Must:**
- Maintain:
  - >90% test coverage.
  - Cyclomatic complexity ≤3.
  - Function length <20 lines.
  - Strict SOLID adherence (especially ISP and DIP).
- Confirm by fetching latest cheat sheets from PostgreSQL.

✅ Systematic application of best practices.

---

## 6. CI/CD Pipeline Verification (GitHub Actions)

**Pipeline Must:**
- Trigger on push to `main`.
- Run:
  - Unit tests.
  - Integration tests.
  - Selenium headless E2E tests.
- Fail immediately if any test fails.
- No deployment allowed if pipeline is red.

✅ Full system verification every small check-in.

---

## 7. Code Review Practice

**Agent Must:**
- Request lightweight peer review (manual or assisted) before major merges if substantial changes occur.
- Focus code reviews on:
  - Behavior correctness.
  - Code clarity.
  - Test completeness.

✅ Architectural stability maintained.

---

## 8. Observability and Logging

**Agent Must:**
- Add minimal but meaningful logging for:
  - Unexpected errors.
  - Critical business flows.
- Ensure logs are parsable and actionable.

✅ Enables early failure detection.

---

## 9. Zero Bug Policy

**Agent Must:**
- Never knowingly push broken or buggy code.
- Open **explicit debt/issues** if a compromise is unavoidable (with clear documentation).

✅ Trust in the main branch is sacred.

---

## 10. Technical Debt and Test Data Management

**Agent Must:**
- Track technical debt explicitly (log shortcuts consciously).
- Manage test data separately from live or production data.
- Ensure that tests are:
  - Isolated.
  - Deterministic.
  - Fast.

✅ High test reliability.

---

## 11. Post-Commit Journaling

**Agent Must:**
- Update session journal after every commit:
  - Changes made.
  - Tests added.
  - Observations (issues faced, lessons learned).
- Update PostgreSQL memory if any architectural shifts occur.

✅ Always learning, evolving, adapting.

---

# Master Workflow Summary

```
0. Boot from Craftsmanship Memory
↓
1. Understand Problem Deeply
↓
2. Write Mock-Driven Tests (London TDD)
↓
3. Minimal Code to Pass Tests
↓
4. Immediate Refactor
↓
5. Update Metrics, Docs
↓
6. Small Commit to Main (Trunk-Based)
↓
7. GitHub CI/CD Full Pipeline Test
↓
8. Lightweight Code Review (if needed)
↓
9. Log Observability Changes
↓
10. Journal, Debt Tracking
↓
(REPEAT)
```

---

# Agent Behavioral Principles

- 🧠 Think: Test > Code > Refactor > Push (tight loops).
- 🛡️ Protect trunk at all costs (small, tested commits).
- 📚 Learn continuously from PostgreSQL memory.
- 🔍 Write observably, not opaquely.
- 🤝 Collaborate — Pair Mindset when stuck.
- 📜 Track decisions openly and honestly.

---

# Outcome

✅ Full TDD / Clean Code / SOLID pipeline  
✅ Trunk-Based Development with micro-commits  
✅ Full automation via CI/CD GitHub Actions  
✅ PostgreSQL-driven best practices memory  
✅ Agent acting like a real software craftsman, not a code monkey.
