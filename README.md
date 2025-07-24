# AIVoiceTranslator: Real-time Multilingual Voice Translation Platform

🚀 **Production-Ready WebSocket Application** with PostgreSQL, comprehensive testing, and full CI/CD pipeline.

## ✨ Key Features

- 🎤 **Real-time Voice Translation**: WebSocket-based live translation between teachers and students
- 🗣️ **Multi-TTS Support**: Azure, OpenAI, and ElevenLabs text-to-speech integration
- 📊 **Advanced Analytics**: Clickable metrics dashboard with SQL transparency 
- 🔄 **Session Management**: Persistent classroom sessions with quality tracking
- 🌐 **Multi-language Support**: OpenAI-powered translation with context awareness
- 📱 **Cross-platform**: Works on desktop and mobile browsers
- ⚡ **High Performance**: Connection pooling, caching, and optimized WebSocket handling

## 🏗️ Current Architecture

### **Database & Storage**
- **PostgreSQL** with **DrizzleORM** (fully migrated from in-memory storage)
- **Multi-provider support**: Aiven (local/test), Supabase (dev/CI), Railway (production)
- **Schema migrations** with versioned migration system
- **Connection pooling** and health monitoring

### **Real-time Communication**
- **WebSocketServer** with modular message handlers
- **Connection management** with heartbeat monitoring
- **Session lifecycle** management with automatic cleanup
- **Translation orchestration** with multiple service providers
- **Audio streaming** with real-time transcription

### **Frontend Stack**
- **Static HTML/JS** (current production interfaces)
- **React SPA** (under development for gradual migration)
- **Vite** for development and building
- **WebSocket client** with automatic reconnection

### **Testing & Quality**
- **Comprehensive test suite**: 300+ unit, integration, and E2E tests
- **CI/CD pipeline** with GitHub Actions
- **Database testing** with real PostgreSQL instances
- **WebSocket testing** with full message flow validation

## 🚀 Quick Start for Developers

### Prerequisites
- **Node.js 18+** and npm  
- **PostgreSQL database** (required - no memory storage fallback)
- **OpenAI API key** for translation services

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/AIVoiceTranslator.git
cd AIVoiceTranslator
npm install
```

### 2. Database Setup

**You must have PostgreSQL databases for development and testing.**

Create `.env` file:
```bash
# Required - PostgreSQL database URL
DATABASE_URL=postgresql://user:password@localhost:5432/aivoicetranslator_dev

# Required - OpenAI API key
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional - Server configuration
PORT=5000
NODE_ENV=development
SESSION_SECRET=your-secure-session-secret
```

Create `.env.test` file:
```bash
# Test database (separate from development)
DATABASE_URL=postgresql://user:password@localhost:5432/aivoicetranslator_test
OPENAI_API_KEY=sk-your-openai-api-key-here
NODE_ENV=test
PORT=5001
```

### 3. Initialize Database

```bash
# Apply database migrations
npm run db:migrations:apply      # Development database
npm run db:migrations:apply:test # Test database

# Verify database integrity
npm run db:audit      # Should show "🎉 ALL TABLES ARE IN SYNC!"
npm run db:audit:test # Should show "🎉 ALL TABLES ARE IN SYNC!"
```

### 4. Start Development

```bash
npm run dev
```

**Application URLs:**
- **Teacher Interface**: http://localhost:5000/teacher.html
- **Student Interface**: http://localhost:5000/student.html  
- **Analytics Dashboard**: http://localhost:5000/analytics.html
- **API Health**: http://localhost:5000/api/health

## 🧪 Testing

### Quick Test Commands

```bash
# Unit Tests - Fast, comprehensive (300+ tests)
npm run test:unit

# Integration Tests - Database and WebSocket integration  
npm run test:integration

# E2E Tests - Full browser automation (stop dev server first!)
npx kill-port 5000 && npm run test:e2e

# All Tests
npm run test
```

### Test Coverage
- ✅ **Unit Tests**: 241 passing - All core logic and services
- ✅ **Integration Tests**: 60 passing - Database operations and WebSocket flows
- ✅ **E2E Tests**: 36 passing - Full user workflows and UI interactions

## 📊 Database Management (Critical)

### Schema Changes (ONLY Safe Method)

```bash
# 1. Edit shared/schema.ts ONLY
# 2. Generate migration
npm run db:migrations:generate
# 3. Apply to test database first
npm run db:migrations:apply:test
# 4. Test thoroughly
# 5. Apply to development
npm run db:migrations:apply
# 6. Verify integrity
npm run db:audit
```

### ❌ NEVER DO
- Write raw SQL for schema changes
- Use database tools to modify structure directly  
- Skip migration generation
- Modify production database manually

### Database Health Checks

```bash
# Before any database work
npm run db:audit        # Development database
npm run db:audit:test   # Test database
```

Both should show: "🎉 ALL TABLES ARE IN SYNC!"

## 🏭 Production Deployment

### Railway (Recommended)

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and initialize
railway login
railway init

# Add PostgreSQL database
railway add postgresql

# Deploy
railway deploy
```

**Required Environment Variables:**
- `DATABASE_URL` (auto-generated by Railway)
- `OPENAI_API_KEY`
- `SESSION_SECRET`
- `PORT` (auto-generated by Railway)

### CI/CD Pipeline

**Automated testing and deployment** via GitHub Actions:
- ✅ Lint, security scan, and unit tests
- ✅ Integration tests with PostgreSQL service
- ✅ E2E tests with Playwright
- ✅ Automatic deployment to Railway
- ✅ Database migration automation
- ✅ Health checks and rollback on failure

## 📁 Project Structure

```
AIVoiceTranslator/
├── client/                 # Frontend applications
│   ├── public/            # Static HTML/JS (current production)
│   │   ├── teacher.html   # Teacher interface
│   │   ├── student.html   # Student interface  
│   │   └── analytics.html # Analytics dashboard
│   └── src/               # React SPA (development)
├── server/                # Backend services
│   ├── services/          # Core business logic
│   │   ├── WebSocketServer.ts        # Main WebSocket server
│   │   ├── websocket/                # WebSocket handlers
│   │   ├── TranslationService.ts     # Translation orchestration
│   │   └── SessionCleanupService.ts  # Session management
│   ├── routes/            # API endpoints
│   ├── storage/           # Database abstractions
│   ├── middleware/        # Express middleware
│   └── db.ts             # Database connection
├── shared/               # Shared code
│   └── schema.ts        # Database schema (single source of truth)
├── tests/               # Comprehensive test suite
│   ├── unit/           # Unit tests
│   ├── integration/    # Integration tests  
│   └── e2e/           # End-to-end tests
├── migrations/         # Database migration files
├── docs/              # Documentation
└── config/            # Configuration files
```

## 🔧 Development Tools

```bash
# Database operations
npm run db:migrations:generate    # Create migration from schema changes
npm run db:migrations:apply       # Apply migrations to development DB
npm run db:audit                  # Check database integrity
npm run db:reset                  # Reset development database (CAUTION)

# Development
npm run dev                       # Start development server
npm run dev:client               # Frontend development only
npm run build                    # Production build
npm start                       # Start production server

# Testing
npm run test                     # All tests
npm run test:unit               # Unit tests only
npm run test:integration        # Integration tests only
npm run test:e2e               # E2E tests only
npm run test:watch             # Watch mode for unit tests

# Code quality
npm run lint                    # ESLint
npm run type-check             # TypeScript checking
```

## 📖 Documentation

- **[Database Architecture](docs/DATABASE_ARCHITECTURE.md)** - Storage system and schema management
- **[WebSocket Architecture](docs/websocket-architecture.md)** - Real-time communication system
- **[Deployment Guide](docs/DEPLOYMENT.md)** - Production deployment instructions
- **[E2E Testing](docs/E2E_TEST_INSTRUCTIONS.md)** - End-to-end testing guide
- **[CI/CD Setup](docs/CI_CD_SETUP_SUMMARY.md)** - Continuous integration/deployment
- **[Analytics Security](docs/ANALYTICS_SECURITY.md)** - Analytics access control
- **[Feature: Manual Translation Control](docs/FEATURE_MANUAL_TRANSLATION_CONTROL.md)** - Upcoming feature spec
- **[Feature: Student Connection Status](docs/FEATURE_STUDENT_CONNECTION_STATUS.md)** - Upcoming feature spec

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Run tests**: `npm run test`
4. **Check database integrity**: `npm run db:audit`
5. **Commit changes**: `git commit -m 'Add amazing feature'`
6. **Push to branch**: `git push origin feature/amazing-feature`
7. **Open Pull Request**

### Development Guidelines

- **All database changes** must go through `shared/schema.ts` and migration system
- **Write tests** for new features (unit, integration, E2E as appropriate)
- **Follow TypeScript** strict mode practices
- **Use ESLint** for code formatting
- **Document new features** in `docs/` folder

## 📊 Current Status

### ✅ Production Ready Features
- Real-time teacher-student voice translation
- WebSocket communication with automatic reconnection
- PostgreSQL database with full schema management
- Session lifecycle management with cleanup
- Advanced analytics dashboard
- Multi-TTS service integration
- Comprehensive testing suite
- CI/CD pipeline with automated deployment

### 🚧 In Development
- React SPA migration (replacing static HTML pages)
- Manual translation control feature
- Student connection status tracking
- Performance optimizations

## 📞 Support

For questions, issues, or contributions:
- **Issues**: GitHub Issues page
- **Discussions**: GitHub Discussions
- **Documentation**: `/docs` folder
- **Tests**: Run `npm run test` for validation

---

**Made with ❤️ for real-time multilingual education**

# The application will be available at:
# - Teacher Interface: http://localhost:5000/teacher (Current - HTML/JS)
# - Student Interface: http://localhost:5000/student (Current - HTML/JS)
# - Diagnostics Dashboard: http://localhost:5000/diagnostics.html (Tracks product adoption and usage metrics)
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

### 🚨 CRITICAL: Schema.ts is the ONLY Source of Truth

**Golden Rule:** `shared/schema.ts` is the single source of truth for database structure. ALL structural changes must go through this file.

### ✅ Correct Workflow for Schema Changes:

1.  **Modify Schema:** Make your desired changes ONLY in `shared/schema.ts`.
2.  **Generate Migration:** Create a new SQL migration file based on your schema changes.
    ```bash
    npm run db:migrations:generate
    ```
    This will create a new file in the `migrations/` directory. **Review this file carefully.**
3.  **Apply to Test Database:** Apply the generated migration(s) to your test database first.
    ```bash
    npm run db:migrations:apply:test
    ```
4.  **Test Your Changes:** Run tests to ensure everything works correctly.
5.  **Apply to Development Database:** Apply to your development database.
    ```bash
    npm run db:migrations:apply
    ```
6.  **Apply to Production Database:** In production deployment:
    ```bash
    npm run db:migrations:apply
    ```

### 🔍 Database Integrity Auditing

**Run these commands regularly to ensure schema.ts matches your actual database:**

```bash
# Check production database integrity
npm run db:audit

# Check test database integrity  
npm run db:audit:test
```

Both should show: "🎉 ALL TABLES ARE IN SYNC!"

### ❌ NEVER DO THIS

- ✖️ Write raw SQL for schema changes (`ALTER TABLE`, `ADD COLUMN`, etc.)
- ✖️ Use database management tools to modify structure directly
- ✖️ Trust anyone (including AI assistants) to "quickly fix" schema issues
- ✖️ Skip migration generation
- ✖️ Directly modify production database structure

### 🚨 Emergency Schema Recovery

If schema drift is detected and you need to recover:

#### Option 1: Drizzle Introspect + Push (Safest)
```bash
# From your working environment
npx drizzle-kit introspect --config=config/drizzle.config.ts
# This generates schema from actual database

# Then push to broken environment
npx drizzle-kit push --config=config/drizzle.config.ts
```

#### Option 2: Export/Import DDL (Nuclear option)
```bash
# Export schema from working database
pg_dump --schema-only --no-owner --no-privileges $WORKING_DATABASE_URL > schema.sql

# Apply to broken database (CAREFUL!)
psql $BROKEN_DATABASE_URL < schema.sql
```

### 🛡️ Protection Strategy

1. **Always audit before changes:** `npm run db:audit`
2. **Never bypass schema.ts:** All changes go through `shared/schema.ts`
3. **Always generate migrations:** `npm run db:migrations:generate`
4. **Test before production:** Apply to test database first
5. **Regular health checks:** Run `npm run db:audit` weekly

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

### 🚀 Production Database Setup

When setting up production database:

1.  Create the production database instance
2.  Configure `DATABASE_URL` in production environment
3.  Ensure migration files are deployed with your application
4.  Run integrity check: `npm run db:audit`
5.  Apply migrations: `npm run db:migrations:apply`
6.  **Never run `db:reset` against production with live data**

### 📋 Regular Maintenance

```bash
# Weekly health check
npm run db:audit
npm run db:audit:test

# Before any deployment
npm run db:audit        # Must pass
```

### 🆘 Emergency Contacts

If production is broken due to schema issues:
1. **Immediately rollback** to last known good state
2. **Fix schema.ts** to match production reality
3. **Generate proper migrations** for any needed changes
4. **Test thoroughly** before re-deploying
5. **Never manually fix** production database

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