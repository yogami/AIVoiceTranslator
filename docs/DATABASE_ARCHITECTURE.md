/**
 * DATABASE & STORAGE ARCHITECTURE OVERVIEW
 * ========================================
 * 
 * This document explains the database and storage system organization
 * to help you understand "what's what" in this project.
 */

## CORE STORAGE SYSTEM

### 1. Main Storage Implementation (`server/storage.ts`)
- **IStorage Interface**: Contract defining all storage operations
- **MemStorage Class**: In-memory storage (currently active, no database needed)
- **DatabaseStorage Class**: PostgreSQL implementation (available but not used)
- **Export**: `storage = new MemStorage()` - this is what the app uses

### 2. Database Connection (`server/db.ts`)
- Sets up PostgreSQL connection using Drizzle ORM + Neon
- Exports `db` (database client) and `pool` (connection pool)
- Only needed if you switch to DatabaseStorage

### 3. Database Schema (`shared/schema.ts`)
- Defines table structures: users, languages, translations, transcripts
- Uses Drizzle ORM with PostgreSQL types
- Shared between client and server

## CURRENT STATE
- **Active Storage**: MemStorage (in-memory, no database required)
- **Database Ready**: DatabaseStorage implemented but not used
- **Switch Method**: Change `export const storage = new MemStorage()` to `new DatabaseStorage()`

## TESTING STRUCTURE

### Unit Tests
- `tests/unit/storage.test.ts` - Main comprehensive test suite
- Tests both MemStorage and DatabaseStorage (DatabaseStorage tests mocked)

### Integration Tests  
- `tests/integration/storage/DatabaseStorage-integration.test.ts`
- Tests DatabaseStorage with real database (currently skipped)
- Requires DATABASE_URL environment variable

### Test Utilities
- `tests/setup/db-setup.ts` - Database setup/teardown for integration tests
- `test-scripts/db-test.ts` - Standalone script to test database operations
- `server/test-db.ts` - [Obsolete] This file is no longer used. All database testing and integration flows now use the Neon cloud database and the main db.ts connection. This file can be deleted after confirming no manual or legacy workflows depend on it.

## CONFIGURATION FILES
- `config/drizzle.config.ts` - Drizzle ORM configuration for migrations
- Database migrations would go in `migrations/` folder (auto-generated)

## HOW TO USE

### Current Setup (No Database)
```javascript
// Already working - uses MemStorage
import { storage } from './server/storage';
await storage.getLanguages(); // Works immediately
```

### Switch to Database
1. Set DATABASE_URL environment variable
2. Run database migrations: `npm run db:push`
3. Change storage.ts: `export const storage = new DatabaseStorage();`
4. Restart application

### Run Tests
```bash
npm test                    # Unit tests (fast, no database needed)
npm run test:integration   # Integration tests (requires database)
```

## CLEANUP COMPLETED
- Removed duplicate test files
- Consolidated into single comprehensive test suite
- Clear separation between unit and integration tests