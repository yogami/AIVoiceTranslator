# AIVoiceTranslator: Real-time Classroom Translation System

AIVoiceTranslator is an intelligent multilingual communication platform designed specifically for educational environments. It captures a teacher's speech, translates it to multiple languages in real-time, and delivers translations as audio streams to students in their preferred languages.

## Project Overview

This project aims to break down language barriers in educational settings by providing real-time voice translation. A teacher speaks in their native language, and students can hear the content in their preferred language with minimal latency, preserving both semantic meaning and emotional tone.

### Core Features

- **Real-time Speech Processing**: Capture, process, and translate speech with minimal latency
- **Multilingual Support**: Currently supports English, Spanish, German, French, Chinese, Japanese, and more
- **Low-Latency Translation**: End-to-end latency under 2 seconds from speech to translated audio
- **WebSocket Architecture**: Fast, bidirectional communication for real-time updates
- **Intelligent Caching**: Optimizes performance by caching frequently used translations and audio
- **Persistent Translation Memory**: Stores translation history in PostgreSQL database
- **Adaptive Voice Technology**: Uses OpenAI's TTS for natural-sounding translations

## Technical Architecture

### Frontend
- **Main Interface**: HTML/CSS/JavaScript for teacher and student interfaces
- **Real-time Communication**: WebSocket client for bidirectional updates
- **Audio Processing**: Web Audio API for speech capture and playback
- **Mobile Support**: Responsive design with QR code access for students

### Backend
- **Server**: Node.js with Express
- **Real-time Communication**: WebSocket server for bidirectional messaging
- **Speech Processing**: OpenAI Whisper API for accurate transcription
- **Translation Engine**: OpenAI GPT-4 for high-quality contextual translations
- **Text-to-Speech**: OpenAI TTS for natural-sounding synthesized speech
- **Data Persistence**: PostgreSQL database for storing translation history

## Project Structure

```
AIVoiceTranslator/
├── client/                  # Client-side code
│   ├── index.html           # Main landing page
│   └── public/              # Static assets and HTML interfaces
│       ├── js/              # JavaScript libraries and utilities
│       ├── teacher.html     # Simplified teacher interface
│       └── student.html     # Simplified student interface
│
├── server/                  # Server-side code
│   ├── config.ts            # Server configuration
│   ├── index.ts             # Main server entry point
│   ├── openai.ts            # OpenAI API integration
│   ├── openai-streaming.ts  # OpenAI streaming functionality
│   ├── routes.ts            # HTTP API routes
│   ├── storage.ts           # Database interface
│   ├── vite.ts              # Vite server configuration
│   ├── websocket.ts         # WebSocket server implementation
│   └── services/            # Core service implementations
│       ├── TextToSpeechService.ts  # TTS service
│       ├── TranslationService.ts   # Translation service
│       └── WebSocketServer.ts      # WebSocket server
│
├── shared/                  # Shared code between client and server
│   └── schema.ts            # Database schema definitions
│
├── audio-cache/             # Cached audio files
├── temp/                    # Temporary audio files
│
├── drizzle.config.ts        # Drizzle ORM configuration
├── package.json             # Project dependencies
├── tsconfig.json            # TypeScript configuration
└── vite.config.ts           # Vite configuration
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database (if using persistent storage)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/AIVoiceTranslator.git
   cd AIVoiceTranslator
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   Create a `.env` file in the root directory with:
   ```
   OPENAI_API_KEY=your_openai_api_key
   DATABASE_URL=postgresql://username:password@localhost:5432/aivoicetranslator
   ```

4. Initialize the database:
   ```bash
   npm run db:push
   ```

5. Start the application:
   ```bash
   npm run dev
   ```

6. Open your browser and navigate to `http://localhost:5000`

## Database Schema

The application uses PostgreSQL with Drizzle ORM. The database schema includes:

- **Users**: Authentication information for admin access
- **Languages**: Supported languages and their settings
- **Translations**: Record of all translations performed
- **Transcripts**: Historical records of speech transcriptions

## Database & Storage Architecture

### Overview

The application implements a flexible storage architecture that supports both in-memory and persistent database storage through a unified interface. This design allows for easy development (using in-memory storage) and production deployment (using PostgreSQL).

### Core Storage Components

#### 1. Storage Interface (`server/storage.ts`)
- **`IStorage` Interface**: Defines the contract for all storage operations
  - User management (create, retrieve)
  - Language management (get, update status, create)
  - Translation history (add, retrieve by language)
  - Transcript management (add, retrieve by session)

#### 2. Storage Implementations

**MemStorage Class** (Currently Active)
- In-memory storage using JavaScript Maps
- No database required - perfect for development and testing
- Automatically initializes with default languages (English, Spanish, German, French)
- Data persists only while the application is running

**DatabaseStorage Class** (Available but Not Used)
- PostgreSQL implementation using Drizzle ORM
- Persistent storage across application restarts
- Requires DATABASE_URL environment variable
- Full ACID compliance for data integrity

#### 3. Database Connection (`server/db.ts`)
- Sets up PostgreSQL connection using Drizzle ORM + Neon
- Exports `db` (database client) and `pool` (connection pool)
- Only needed when using DatabaseStorage

#### 4. Database Schema (`shared/schema.ts`)
- Defines table structures using Drizzle ORM
- Tables: `users`, `languages`, `translations`, `transcripts`
- Shared between client and server for type safety

### Current Configuration

```typescript
// In server/storage.ts
export const storage = new MemStorage(); // Currently using in-memory storage
```

**Active Storage**: MemStorage (no database required)
**Database Ready**: DatabaseStorage implemented but not active

### Switching Between Storage Types

To switch from MemStorage to DatabaseStorage:

1. **Set up environment variables**:
   ```bash
   DATABASE_URL=postgresql://username:password@localhost:5432/aivoicetranslator
   ```

2. **Run database migrations**:
   ```bash
   npm run db:push
   ```

3. **Update storage configuration**:
   ```typescript
   // Change this line in server/storage.ts:
   export const storage = new DatabaseStorage();
   ```

4. **Restart the application**

### Testing Architecture

#### Unit Tests
- **`tests/unit/storage.test.ts`** - Comprehensive test suite for both implementations
- Tests MemStorage with real operations
- Tests DatabaseStorage with mocked database calls
- Fast execution, no external dependencies

#### Integration Tests
- **`tests/integration/storage/DatabaseStorage-integration.test.ts`** - Real database tests
- Currently skipped (requires actual database connection)
- Tests DatabaseStorage with real PostgreSQL database
- Requires DATABASE_URL environment variable

#### Test Utilities
- **`tests/setup/db-setup.ts`** - Database setup/teardown utilities
- **`test-scripts/db-test.ts`** - Standalone database testing script
- **`server/test-db.ts`** - Express server for manual database testing

### Usage Examples

#### Current Usage (MemStorage)
```javascript
import { storage } from './server/storage';

// These work immediately with MemStorage
const languages = await storage.getLanguages();
const user = await storage.createUser({ username: 'teacher1', password: 'pass123' });
const translation = await storage.addTranslation({
  sourceLanguage: 'en-US',
  targetLanguage: 'es',
  originalText: 'Hello class',
  translatedText: 'Hola clase',
  latency: 150
});
```

#### Database Usage (DatabaseStorage)
```javascript
// Same interface, but data persists to PostgreSQL
const storage = new DatabaseStorage();
const languages = await storage.getLanguages(); // Loads from database
```

### Development Workflow

#### For Development
1. Use MemStorage (default) - no database setup required
2. Run `npm test` for fast unit tests
3. Data resets on each application restart

#### For Production
1. Set up PostgreSQL database
2. Configure DATABASE_URL environment variable
3. Switch to DatabaseStorage in `server/storage.ts`
4. Run database migrations with `npm run db:push`

### File Organization

```
├── server/
│   ├── storage.ts           # Main storage implementations
│   ├── db.ts               # Database connection setup
│   └── test-db.ts          # Manual database testing server
├── shared/
│   └── schema.ts           # Database schema definitions
├── tests/
│   ├── unit/
│   │   └── storage.test.ts # Comprehensive storage tests
│   ├── integration/storage/
│   │   └── DatabaseStorage-integration.test.ts # Database integration tests
│   └── setup/
│       └── db-setup.ts     # Test database utilities
├── test-scripts/
│   └── db-test.ts          # Standalone database test script
└── config/
    └── drizzle.config.ts   # Drizzle ORM configuration
```

### Benefits of This Architecture

1. **Development Speed**: Start coding immediately without database setup
2. **Testing**: Fast unit tests with MemStorage, thorough integration tests with DatabaseStorage
3. **Flexibility**: Easy to switch between storage types
4. **Type Safety**: Shared schema ensures consistent data types
5. **Scalability**: Database implementation ready for production use

### Performance Considerations

#### MemStorage
- **Pros**: Extremely fast, no network latency, simple setup
- **Cons**: Data lost on restart, limited by system memory
- **Best for**: Development, testing, demos

#### DatabaseStorage  
- **Pros**: Persistent data, ACID compliance, scalable
- **Cons**: Network latency, requires database setup
- **Best for**: Production, data persistence requirements
## Interface Guide

### Teacher Interface

The Teacher Interface allows instructors to:

1. Select their source language
2. Begin speaking with the "Start Recording" button
3. View real-time transcription of their speech
4. Monitor active student connections and their language selections
5. See performance metrics including latency and processing times

**Location:** `client/public/simple-speech-test.html`  
**Access URL:** `/teacher`

### Student Interface

The Student Interface allows students to:

1. Select their preferred target language
2. Connect to the active teacher session
3. Receive real-time translations as both text and audio
4. Adjust volume and playback settings
5. Access translation history

Two versions are available:
- Standard: **Location:** `client/public/simple-student.html`, **Access URL:** `/student`
- Simplified: **Location:** `client/public/simple-student.html`, **Access URL:** `/simple-student.html` (optimized for mobile devices)

### WebSocket Connection Page

The primary interface for establishing WebSocket connections, with additional diagnostic capabilities:

- Create and manage WebSocket connections to the server
- Configure connection parameters and preferences
- Monitor connection status and performance metrics
- Test different TTS voices and settings
- View detailed diagnostics for troubleshooting

**Location:** `client/public/websocket-diagnostics.html`  
**Access URL:** `/websocket-diagnostics.html`

## WebSocket Protocol

The application uses a custom WebSocket protocol with these message types:

### Client to Server

- **Register**: `{ type: "register", role: "teacher|student", language: "en-US" }`
- **Audio**: `{ type: "audio", audio: "base64EncodedAudio", isFirstChunk: boolean }`
- **GetTranslation**: `{ type: "getTranslation", text: "Text to translate", sourceLanguage: "en-US", targetLanguage: "es-ES" }`
- **TranscriptRequest**: `{ type: "transcriptRequest", sessionId: "session-id" }`

### Server to Client

- **Translation**: `{ type: "translation", originalText: "Original", translatedText: "Translated", sourceLanguage: "en-US", targetLanguage: "es-ES", audioBase64: "base64EncodedAudio" }`
- **Transcription**: `{ type: "transcription", text: "Transcribed text", isFinal: boolean, languageCode: "en-US" }`
- **Error**: `{ type: "error", message: "Error message" }`
- **Transcript**: `{ type: "transcript", entries: [...] }`

## Performance Considerations

### Latency Optimization

The system is optimized for low latency with these features:

- Audio streaming for real-time processing
- Intelligent caching of translations and TTS audio
- Concurrent processing of multiple translation requests
- Optimized WebSocket communication

Current end-to-end latency metrics:
- Speech to text: ~0.5-1.0 seconds
- Translation: ~0.3-0.5 seconds
- Text to speech: ~0.5-1.5 seconds
- Total latency: ~1.5-3.0 seconds (depending on phrase complexity)

### Scaling Considerations

The system has been load tested and can handle:
- Up to 25 simultaneous student connections per server instance
- Multiple language pairs simultaneously
- Continuous translation for 60+ minutes

## Environment Variables

- `OPENAI_API_KEY`: Required for OpenAI API access
- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port (default: 5000)
- `NODE_ENV`: Environment setting (development/production)

## Development Guidelines

### Adding New Languages

1. Update the language support in `client/public/js/language-support.js`
2. Test transcription accuracy with sample audio
3. Verify TTS voice quality for the new language

### Adding Database Support

If you need to modify the database schema:

1. Update the schema definitions in `shared/schema.ts`
2. Run `npm run db:push` to apply changes to the database

### Mobile Device Support

The application includes QR code generation for easy mobile access:
- QR codes are automatically generated for the student interface
- Mobile-optimized interface adapts to smaller screens

## Testing

The project includes comprehensive test coverage organized into logical modules:

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── core/               # Core functionality tests
│   │   ├── websocket.test.ts        # WebSocket integration tests
│   │   ├── translation.test.ts      # Translation service tests  
│   │   └── audio-processing.test.ts # Audio processing tests
│   ├── api/                # API endpoint tests
│   │   └── routes.test.ts          # HTTP route tests
│   ├── utils/              # Test utilities
│   │   └── test-helpers.ts         # Shared test helpers
│   ├── storage.spec.ts     # Database and storage tests
│   ├── server.spec.ts      # Server configuration tests
│   ├── config.spec.ts      # Configuration loading tests
│   └── languages.spec.ts   # Language utilities tests
├── integration/            # Integration tests (separate from unit tests)
│   ├── services/           # Service integration tests
│   └── workflows/          # End-to-end workflow tests
```

### Running Tests

```bash
# Run unit tests only
npm test

# Run integration tests (requires valid API keys)
npm run test:integration

# Run all tests
npm run test:all

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm test tests/unit/core/websocket.test.ts
```

### Integration Test Configuration

Integration tests require longer timeouts and may need real API keys:

1. Create a `.env.test` file for test-specific configuration:
   ```
   OPENAI_API_KEY=your_test_api_key
   DATABASE_URL=postgresql://test_user:test_pass@localhost:5432/aivoicetranslator_test
   ```

2. Integration tests have a 30-second timeout by default
3. Tests will skip if no valid API key is provided
4. WebSocket tests use the `/ws` path for connections

### Test Philosophy

- Tests should be deterministic, running the same way every time
- Prefer small, focused tests over large, complex ones
- Use mocks and stubs to isolate code under test
- Integration tests should cover critical end-to-end scenarios