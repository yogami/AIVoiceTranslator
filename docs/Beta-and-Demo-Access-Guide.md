### Beta and Demo Access Guide

This document explains how to run the prototype in open demo mode and how to enable guardrails for private beta/pilots with schools.

### Overview

- **Open demo (default)**: No restrictions unless you set specific environment variables.
- **Pilot/beta mode**: Turn on IP allowlisting, registration gating, and optional global beta token.

### Open Demo Mode (default)

Set the minimum variables and leave restriction flags unset:

```bash
NODE_ENV=development
PORT=5000
HOST=localhost
LOG_LEVEL=info

DATABASE_URL=postgres://username:password@host:port/database
OPENAI_API_KEY=your_openai_api_key

BETA_ENFORCE_REGISTRATION=0
# Leave these unset for no restrictions:
# ALLOWED_IPS=
# BETA_ENABLED=
# BETA_ACCESS_TOKEN=
```

- Anyone can register and use the tool (costs apply).
- JWT expiry defaults to 24 hours.
- Classroom codes default to 2 hours.

### Turn On Restrictions for Pilots/School Deployments

- IP allowlist (restrict access to school premises):
  - env: `ALLOWED_IPS="203.0.113.10,203.0.113.11,203.0.113.*"`
  - Supports exact IPs and simple wildcard prefixes like `192.168.*`.
  - Applied to both HTTP and WebSocket connections.

- Registration gate (beta code):
  - env: `BETA_ENFORCE_REGISTRATION=1` and `BETA_REGISTRATION_CODE=<your_code>`
  - Blocks new accounts unless the correct beta code is provided during registration.

- Restrict teacher signup to school email domain(s):
  - env: `ALLOWED_EMAIL_DOMAINS=school.edu,schooldistrict.org`
  - Registration is rejected if email domain isn’t on the list.

- Global beta gate (optional, for private demos):
  - env: `BETA_ENABLED=1` and `BETA_ACCESS_TOKEN=<strong_token>`
  - All API and WebSocket access require the beta token.
  - HTTP: add header `Authorization: Bearer <BETA_ACCESS_TOKEN>`
  - WebSocket: use `wss://host/path?beta=<BETA_ACCESS_TOKEN>` or send as `Sec-WebSocket-Protocol`

- JWT session lifetime:
  - env: `JWT_EXPIRY=8h` (default is `24h`)

- Classroom code lifetime:
  - env: `CLASSROOM_CODE_EXPIRATION_MS=5400000` (example: 90 minutes)

### Quick Recipes

- Private on-prem demo (school network only):
```bash
ALLOWED_IPS=203.0.113.*
BETA_ENABLED=1
BETA_ACCESS_TOKEN=ChangeMeStrong
BETA_ENFORCE_REGISTRATION=1
BETA_REGISTRATION_CODE=InviteOnly
JWT_EXPIRY=8h
CLASSROOM_CODE_EXPIRATION_MS=5400000
```

- School pilot with domain-restricted signup:
```bash
ALLOWED_IPS=203.0.113.*,198.51.100.*
ALLOWED_EMAIL_DOMAINS=school.edu
BETA_ENFORCE_REGISTRATION=1
BETA_REGISTRATION_CODE=SchoolPilot2025
JWT_EXPIRY=12h
CLASSROOM_CODE_EXPIRATION_MS=7200000
```

### Defaults and Timing Reference

- Classroom code expiration: 2 hours (configurable via `CLASSROOM_CODE_EXPIRATION_MS`).
- Stale session timeout: 90 minutes (separate from classroom codes).
- JWT expiry: 24 hours by default (override with `JWT_EXPIRY`).

### Cost and Abuse Mitigation (recommended during open demos)

- Prefer free tiers where possible and only enable premium features you need.
- Shorten JWT and classroom code lifetimes when demoing publicly.
- Consider rate-limiting endpoints and/or throttling per WebSocket connection if abuse is likely.

### Protecting Your Demo/Idea (operational)

- Use a short ToS or NDA for demos.
- For closed demos, enable `BETA_ENABLED` and `ALLOWED_IPS`.
- Rotate `BETA_ACCESS_TOKEN` after demos and invalidate old classroom codes by restarting the server or waiting for expiration.


