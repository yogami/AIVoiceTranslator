# AIVoiceTranslator: Real-time Multilingual Voice Translation Platform

## 🚀 Quick Start for Developers

### Prerequisites
- **Node.js 18+** and npm
- **Modern web browser** with WebRTC support (Chrome/Firefox recommended)
- **OpenAI API key** for translation services

### 1. Clone and Install

   ```bash
# Clone the repository
   git clone https://github.com/yourusername/AIVoiceTranslator.git
   cd AIVoiceTranslator

# Install dependencies
   npm install
   ```

### 2. Environment Setup

Create a `.env` file in the root directory:

```bash
# Copy the example environment file
cp .env.example .env
```

Edit `.env` with your configuration for the **development environment**:

   ```bash
# Required for translation features
OPENAI_API_KEY=sk-your-openai-api-key-here

# Server Configuration (optional - defaults shown)
PORT=5000
NODE_ENV=development
SESSION_SECRET=your-session-secret-here

# Storage Configuration (optional)
STORAGE_TYPE=memory          # Options: 'memory' or 'database'
DATABASE_URL=postgresql://user:password@dev-db-host:5432/dev_db_name  # For development database

# Test Configuration (automatically set by test scripts)
E2E_TEST_MODE=true          # Forces memory storage for tests
```

**Test Environment:**
- Create a `.env.test` file in the root directory for the **test database**:
  ```bash
  # Example .env.test
  OPENAI_API_KEY=sk-your-openai-api-key-for-tests
  DATABASE_URL=postgresql://user:password@test-db-host:5432/test_db_name # For test database
  NODE_ENV=test
  PORT=5001 # Optional: if test server needs a different port
  ```
- When running tests with Vitest, or specific database scripts, `.env.test` is loaded.
- Make sure your `.env.test` contains a valid `OPENAI_API_KEY` if you want integration tests to use the real OpenAI API, and a `DATABASE_URL` for your test database.

**Important Notes:**
- `OPENAI_API_KEY` is **required** for the application to function.
- Default storage is `memory` (no database needed for local development if `STORAGE_TYPE=memory`).
- For database storage, ensure `DATABASE_URL` is set in `.env` (for development) and `.env.test` (for testing).
- Test scripts automatically configure the environment - no manual setup needed beyond the `.env` files.

### 3. Running the Application

   ```bash
# Development mode with hot reload
   npm run dev

# The application will be available at:
# - Teacher Interface: http://localhost:5000/teacher (Current - HTML/JS)
# - Student Interface: http://localhost:5000/student (Current - HTML/JS)
# - Diagnostics Dashboard: http://localhost:5000/diagnostics.html (Current - HTML/JS)
# - React App: http://localhost:5000/ (In Progress - Gradual Migration)

# Production build and run
npm run build
npm start

# Frontend development only (Vite dev server)
npm run dev:client
```

**Setting up Databases (Development & Test):**
If you intend to use `STORAGE_TYPE=database`, you'll need to set up your development and test databases.
1.  **Ensure `.env` and `.env.test` have correct `DATABASE_URL`s.**
2.  **Initial Setup (or if you change `shared/schema.ts`):**
    ```bash
    # 1. Generate migration files based on schema changes
    npm run db:migrations:generate

    # 2. Apply migrations to the development database (from .env)
    npm run db:migrations:apply

    # 3. Apply migrations to the test database (from .env.test)
    npm run db:migrations:apply:test
    ```
    See the "Database Management (Versioned Migrations)" section for more details.

## ⚠️ Important: React Migration Status

**The application currently uses static HTML/JS pages in `client/public/`**. The React SPA in `client/src/` is under development and requires gradual migration. Components are built but not yet integrated with the production application.

## 🧪 Running Tests

### 🎯 Quick Test Commands (Just Copy & Paste!)

```bash
# Unit Tests (fast - 20 seconds) ✅ 241 passing
STORAGE_TYPE=memory npm run test:unit

# Integration Tests (slower - 40 seconds) ✅ 60 passing
STORAGE_TYPE=memory npm run test:integration

# E2E Tests (2 minutes) ⚠️ STOP THE DEV SERVER FIRST!
npx kill-port 5000 && npm run test:e2e
```

### ⚠️ IMPORTANT: E2E Test Requirements

**E2E tests will FAIL if the dev server is running!** The tests start their own server.

```bash
# BEFORE running E2E tests, stop the dev server:
npx kill-port 5000

# THEN run E2E tests:
npm run test:e2e
```

### 📊 Current Test Status
- **Unit Tests**: ✅ 241 tests pass (4 non-critical fs errors - tests still pass)
- **Integration Tests**: ✅ 60 pass, 12 skipped (database tests), 1 fails (DatabaseStorage - expected)
- **E2E Tests**: ✅ 36 tests pass (when server is stopped first)

### 🔍 Why Use STORAGE_TYPE=memory?
The app supports both memory and database storage. Tests should use memory storage to:
- Avoid database setup requirements
- Run faster
- Work on any machine without configuration

### 📝 Using npx Commands (Like Before)

```bash
# Run specific test file with Vitest
npx vitest tests/unit/storage.test.ts

# Run tests in watch mode (auto-rerun on changes)
npx vitest --watch

# Run with UI (great for debugging)
npx vitest --ui

# Run E2E with Playwright UI (see browser)
npx playwright test --ui

# Run specific E2E test
npx playwright test tests/e2e/teacher.spec.ts
```

### 🛠️ Troubleshooting Common Issues

1.  **E2E Tests Fail: "Error: listen EADDRINUSE"**
    -   **Cause**: Dev server is still running on port 5000
    -   **Fix**: `npx kill-port 5000` then run E2E tests

2.  **Tests Hang or Run Forever / Test Timeouts (Especially API & Integration Tests)**
    -   **Symptom**: Tests (especially those involving external APIs or stateful services) pass individually but fail (often with timeouts) when run as part of a larger suite.
    -   **Core Principle: Test Independence**: Each test should run as if it's the only test in the world. It should set up its own required state and clean up after itself, without relying on or affecting other tests.
    -   **Fix 1: Ensure Sequential Execution via Vitest Configuration**: This is crucial for API-heavy tests to avoid client-side concurrency issues overwhelming external services. Modify your `vitest.config.ts` (or `vite.config.ts` under the `test` property):
        ```typescript
        // In vitest.config.ts or vite.config.ts:
        import { defineConfig } from 'vitest/config'; // or 'vite'

        export default defineConfig({
          test: {
            threads: false, // Forces all tests to run sequentially in a single thread
            // ... other test configurations ...
          },
          // ... other configurations ...
        });
        ```
        This makes your overall test suite run slower but significantly improves stability for tests relying on external services.
    -   **Fix 2: Isolate Test State with `beforeEach`**: For integration tests within the same file, ensure each `it` block gets fresh instances of its dependencies.
        -   In your test file (e.g., `tests/integration/services/your-service.test.ts`):
            ```typescript
            describe('My Integrated Service Tests', () => {
              let myService: MyService;
              let mockDependency: MockDependency;

              beforeEach(() => {
                // Re-initialize dependencies for EACH test
                mockDependency = new MockDependency(/* fresh state */);
                myService = new MyService(mockDependency);
              });

              it('should do task A', async () => {
                // myService is fresh here
                await myService.doTaskA();
                // ... assertions ...
              });

              it('should do task B', async () => {
                // myService is also fresh here, unaffected by task A's run
                await myService.doTaskB();
                // ... assertions ...
              });
            });
            ```
    -   **Fix 3: Increase Specific Test Timeouts**: If a test is inherently long even with isolation and sequential execution (e.g., a multi-step API pipeline), increase its individual timeout:
        ```javascript
        it('should perform a very long operation', async () => {
          // ... test logic ...
        }, 120000); // Example: 120-second timeout
        ```
    -   **Other Checks**:
        -   **Clear Test Cache**: `rm -rf node_modules/.vitest`
        -   **API Key Validity**: Ensure your `OPENAI_API_KEY` (especially in `.env.test`) is valid and not hitting usage limits.
        -   **Proper Teardown (`afterEach`, `afterAll`)**: Ensure any resources created by tests (files, database entries not handled by `beforeEach` clears, mock server listeners) are cleaned up.

3.  **"Cannot find module" Errors**
    -   **Fix**: `npm install` to ensure all dependencies are installed

4.  **Database Test Fails**
    - **This is expected!** DatabaseStorage tests need a real database
    - **For local testing**: Always use `STORAGE_TYPE=memory`

### 📚 Understanding Test Results

**Skipped Tests (12)**: Database-specific tests that skip when using memory storage
**Todo Test (1)**: Placeholder for future WebSocket API tests
**Unit Test Errors (4)**: File system mocking issues - non-critical, tests still pass

For detailed testing documentation, see [docs/TESTING.md](docs/TESTING.md)

## 🗄️ Database Management (Versioned Migrations)

This project uses Drizzle ORM with a versioned migration system to manage database schema changes. The scripts for this are located in the `db-migration-scripts/` directory.

### Workflow for Schema Changes:

1.  **Modify Schema:** Make your desired changes to the table definitions in `shared/schema.ts`.
2.  **Generate Migration:** Create a new SQL migration file based on your schema changes.
    ```bash
    npm run db:migrations:generate
    ```
    This will create a new file in the `migrations/` directory. Review this file.
3.  **Apply to Development Database:** Apply the generated migration(s) to your development database (configured in `.env`).
    ```bash
    npm run db:migrations:apply
    ```
4.  **Apply to Test Database:** Apply the generated migration(s) to your test database (configured in `.env.test`).
    ```bash
    npm run db:migrations:apply:test
    ```

### Resetting Databases (Caution: Deletes Data!)

If you need to completely reset a database (drop all tables defined in the schema and Drizzle's migration history), use the following scripts:

*   **Reset Development Database:**
    ```bash
    npm run db:reset
    # Followed by:
    npm run db:migrations:apply
    ```
*   **Reset Test Database:**
    ```bash
    npm run db:reset:test 
    # Or: npm run db-test:reset
    # Followed by:
    npm run db:migrations:apply:test
    ```

### Production Database Setup (TODO)

*   **TODO:** When you are ready to set up a dedicated production database instance (e.g., a new Neon database):
    1.  Create the new production database instance.
    2.  Securely configure its `DATABASE_URL` in your production environment (e.g., hosting provider's environment variables).
    3.  Ensure your migration files (from the `migrations/` directory) are deployed with your application.
    4.  As part of your deployment process, run the migration application script against the production database:
        ```bash
        # In your production environment, after setting DATABASE_URL
        npm run db:migrations:apply 
        ```
        (This assumes the `db:migrations:apply` script and its dependencies are available in the production build/environment).
    5.  **Never run `db:reset` or `db:push` commands against a production database with live data unless you intend to wipe it.**

## 🏗️ System Architecture

```
┌─────────────────┐     WebSocket      ┌─────────────────┐     OpenAI APIs    ┌─────────────────┐
│  Teacher Client │ ◄─────────────────► │                 │ ◄────────────────► │ Whisper ASR     │
│  (Browser)      │                     │                 │                     │ GPT-4 Translate │
│  - Audio Capture│                     │  Node.js Server │                     │ TTS Generation  │
│  - Speech Recog │                     │                 │                     └─────────────────┘
└─────────────────┘                     │  - WebSocket    │
                                       │  - Translation   │
┌─────────────────┐                     │  - Session Mgmt │     Storage         ┌─────────────────┐
│ Student Clients │ ◄─────────────────► │  - Metrics      │ ◄────────────────► │ Memory/Database │
│  (Browser)      │     WebSocket       │                 │                     │ - Sessions      │
│  - Audio Playback│                    └─────────────────┘                     │ - Translations  │
└─────────────────┘                                                             │ - Metrics       │
                                                                                └─────────────────┘
```



## 📁 Project Structure Overview

```
AIVoiceTranslator/
├── .env.example            # Environment variables template
├── .env                    # Your local environment variables (git ignored)
├── package.json            # Dependencies and npm scripts
├── client/                 # Frontend code
│   ├── public/            # Static HTML/JS/CSS pages (CURRENT PRODUCTION)
│   └── src/               # React SPA (IN PROGRESS - Gradual Migration)
├── server/                 # Backend Node.js/Express server
│   ├── config.ts          # Environment configuration
│   ├── storage.ts         # Storage abstraction layer
│   └── services/          # Core business logic
├── tests/                  # Test suites
│   ├── unit/              # Unit tests
│   ├── integration/       # Integration tests
│   └── e2e/               # End-to-end tests
├── test-config/           # Test configurations
│   ├── test-env.js        # Test environment setup
│   └── playwright.config.ts # Playwright configuration
├── db-migration-scripts/   # Scripts for managing database (migrations, resets)
├── migrations/             # Drizzle ORM auto-generated migration files
└── config/                # Build configurations
    └── vite.config.ts     # Vite build configuration
```

## 🔧 Key npm Scripts

```json
{
  "dev": "Run full stack in development mode",
  "dev:client": "Run only frontend with Vite",
  "build": "Build for production",
  "start": "Start production server",
  "db:migrations:generate": "Generate SQL migration files from schema changes",
  "db:migrations:apply": "Apply pending migrations to the development database",
  "db:migrations:apply:test": "Apply pending migrations to the test database",
  "db:reset": "Reset development database (drops tables)",
  "db:reset:test": "Reset test database (drops tables)",
  "db-test:reset": "Alias to reset test database (drops tables)",
  "db:push": "Directly push schema to dev DB (use with caution, prefer migrations)",
  "db:push:test": "Directly push schema to test DB (use with caution, prefer migrations)",
  "test": "Run all tests (unit & integration, typically using memory storage)",
  "test:unit": "Run unit tests with Vitest",
  "test:integration": "Run integration tests",
  "test:e2e": "Run E2E tests with Playwright",
  "test:e2e:ui": "Run E2E tests with UI mode",
  "lint": "Run ESLint",
  "format": "Format code with Prettier"
}
```

## 🛠️ Development Workflow

### 1. Basic Development Flow
```bash
# Start development server
npm run dev

# In another terminal, run tests in watch mode
npm run test:unit:watch

# Make changes, tests auto-run
# Browser auto-reloads
```

### 2. Before Committing
```bash
# Run all tests
npm test

# Check linting
npm run lint

# Format code
npm run format

# Build to ensure no errors
npm run build
```

### 3. Testing Your Changes
```bash
# Quick unit test for your service
npm run test:unit -- tests/unit/services/YourService.test.ts

# Integration test for API endpoints
npm run test:integration -- tests/integration/your-feature.test.ts

# E2E test with UI to see it in action
npm run test:e2e:ui -- tests/e2e/your-feature.spec.ts
```

## 🔍 Debugging

### Server Debugging
```bash
# Run with Node.js inspector
node --inspect -r tsx/register server/index.ts

# Or use VS Code debugger with included launch.json
```

### Client Debugging
- Use browser DevTools
- React DevTools for React components
- Network tab for WebSocket messages

### Test Debugging
```bash
# Debug E2E tests
npm run test:e2e:debug

# Debug unit tests in VS Code
# Set breakpoints and use "Debug Test" option
```

## 🌐 API Endpoints

### HTTP Endpoints
```
GET  /api/health              # Health check
GET  /api/languages           # Available languages list
POST /api/session/create      # Create classroom session
GET  /api/session/:code       # Get session details
GET  /api/diagnostics         # System metrics
GET  /api/diagnostics/export  # Export analytics data
```

### WebSocket Events
```
Client → Server:
- register: Join session with role and language
- audio: Stream audio chunks
- transcription: Send transcribed text
- ping: Heartbeat

Server → Client:
- translation: Translated text and audio
- transcription: Original transcription
- error: Error messages
- pong: Heartbeat response
```

## 🏗️ Architecture Notes

### Audio Processing Flow
1. **Teacher's Browser**: Captures audio via MediaRecorder API
2. **Client-Side**: Web Speech API transcribes for immediate display
3. **WebSocket**: Streams audio chunks to server
4. **Server**: Processes audio (future enhancement)
5. **OpenAI APIs**: Translation (GPT-4) and TTS generation
6. **Students**: Receive translated audio and text

### Storage Options
- **Memory Storage** (default): Fast, perfect for development
- **Database Storage**: PostgreSQL with Drizzle ORM for production

### Key Services
- `WebSocketServer`: Manages real-time connections
- `TranslationService`: Orchestrates translation pipeline
- `TextToSpeechService`: Generates audio from text
- `DiagnosticsService`: Tracks metrics and analytics
- `AudioSessionManager`: Manages classroom sessions

## 🐛 Common Issues & Solutions

### Port Already in Use
```bash
# Error: EADDRINUSE: address already in use :::5000
# Solution: Kill the process using the port
lsof -ti:5000 | xargs kill -9

# Or use a different port
PORT=3000 npm run dev
```

### OpenAI API Errors
```bash
# Error: OpenAI API key not found
# Solution: Ensure OPENAI_API_KEY is set in .env file
```

### E2E Test Failures
```bash
# Tests failing due to permissions
# Solution: Tests handle this automatically, but ensure you're using npm run test:e2e

# Tests hanging
# Solution: Kill any orphaned browser processes
pkill -f playwright
```

### Database Connection Issues
```bash
# Only relevant if using database storage
# Solution: Ensure DATABASE_URL is correct and database is running
# For local dev, just use memory storage (default)
```

## 📚 Additional Resources

- **WebSocket Protocol**: See `docs/websocket-architecture.md`
- **Testing Guide**: See `docs/TESTING.md`
- **E2E Test Architecture**: See `docs/E2E_TEST_SOLUTION.md`
- **API Documentation**: Run server and visit `/api-docs` (coming soon)

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Write tests for your changes
4. Ensure all tests pass (`npm test`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**Need Help?** 
- Check existing issues on GitHub
- Review test files for usage examples
- WebSocket implementation: `server/services/WebSocketServer.ts`
- Frontend examples: `client/public/js/teacher.js`