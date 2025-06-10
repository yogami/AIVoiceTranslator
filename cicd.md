# Project CI/CD and Deployment Spec

## Project Overview
- Plain vanilla JavaScript, HTML, CSS frontend served locally.
- Node.js backend with no special Node version requirement (use standard LTS).
- Uses Drizzle ORM with Neon-hosted PostgreSQL databases.
- Two environment files: `.env` (production) and `.env.test` (testing).
- `.env` contains keys: `OPENAPI_KEY`, `DATABASE_URL`, and `PORT`.
- `.env.test` contains similar keys but points to the test database.
- Local dev command: `npm run dev`.
- Need to add production commands: `npm run build` (if build needed) and `npm run start`.
- Drizzle migration sync command: `npm run push` which runs `drizzle-kit push`.
- Logs are stored in a local `logs` folder inside the project.
- No branches, trunk-based development: only `main` branch is deployed.
- Need full CI testing on push to `main`.
- Tests are run with `npm run test` which should cover all unit and E2E tests.
- Test failures must block deployment, but deployment can be bypassed with a flag.
- Email notifications on CI success and failure, sent to Gmail via SMTP.
- Use GitHub Secrets to store sensitive environment variables (do NOT commit `.env` files).
- Runtime caching in app (details unknown) — cache dependencies in CI to speed installs.
- Deployment target unspecified (assume simple `npm start` on a VPS or container).
- Want logs easily accessible after deployment or on failure.
- Need a switch/flag in CI to bypass test blocking for emergency deployments.

---

## Required `package.json` Scripts
- `dev`: starts the app locally for development (already exists).
- `build`: build step if any (can be a placeholder if none).
- `start`: starts the app in production mode.
- `push`: runs `drizzle-kit push` to sync DB schema.
- `test`: runs all unit and E2E tests and exits with proper status.

Example scripts:
```json
"scripts": {
  "dev": "node server.js",
  "build": "echo 'No build step, placeholder'",
  "start": "node server.js",
  "push": "drizzle-kit push",
  "test": "vitest run && playwright test"
}

