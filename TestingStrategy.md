# AIVoiceTranslator Test Strategy Document

## Overview

This document outlines a comprehensive testing strategy for the AIVoiceTranslator real-time classroom translation system. It provides explicit guidance for AI agents (specifically Replit) on implementing tests properly without common pitfalls.

## Test Pyramid Structure

                /\
               /  \
              /E2E \
             /------\
            /  Int.  \
           /----------\
          / Unit Tests \
         /--------------\
        / Static Analysis \

## Important Implementation Notes for AI Agents

### Critical Requirements for Test Implementation

1. **DO NOT MOCK THE SYSTEM UNDER TEST (SUT)**
   - The actual implementation of components being tested must be used
   - Only mock external dependencies (APIs, databases, etc.)
   - Explicitly use the real implementation of the component being tested

2. **AVOID TEST DOUBLES FOR SYSTEM UNDER TEST**
   - Do not replace the SUT with fakes or test doubles
   - Mocks should only be created for dependencies, not for the subject of the test
   - Always import and use the actual implementation of the component being tested

3. **TypeScript Testing Requirements**
   - Use `ts-jest` for proper TypeScript support
   - Configure proper source mapping to ensure error reports point to TypeScript files
   - Use `tsconfig.json` paths specifically for tests

4. **TypeScript Testing Solution**
   - Option 1 (Preferred): Use `ts-jest` with proper configuration
   - Option 2 (If issues persist): Set up a compilation step in your test script that generates JavaScript before running tests
   - The compiled code should be stored in a separate directory (e.g., `dist-tests`) to avoid interference with production builds

## Phase 1: Foundation Setup (Week 1)

### 1.1 Testing Framework Setup

```typescript
// Install dependencies
// npm install --save-dev jest ts-jest @types/jest eslint typescript @typescript-eslint/parser @typescript-eslint/eslint-plugin

// Create jest.config.js
export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/server', '<rootDir>/tests'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json', // Use a specific tsconfig for tests
    }],
  },
  testRegex: '(/__tests__/.*|(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  // Important: Do not auto-mock anything
  automock: false,
  // Clear all mocks between tests
  clearMocks: true,
  // Important: Enable sourcemaps for proper stack traces
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/server/$1' // Path alias for cleaner imports
  }
};
// tsconfig.test.json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "module": "commonjs",
    "types": ["jest", "node"],
    "sourceMap": true,
    "inlineSources": true,
    "esModuleInterop": true
  },
  "include": [
    "server/**/*.ts",
    "tests/**/*.ts"
  ]
}

Important for AI agents: This configuration ensures proper TypeScript support for tests. Do not skip these steps or create simplified configurations.

# Create test directory structure with proper separation
mkdir -p tests/unit/services tests/unit/utils tests/integration/api tests/e2e

1.3 Package.json Scripts
Add these scripts to your package.json:

"scripts": {
  "test": "jest --testPathPattern=tests/unit",
  "test:integration": "jest --testPathPattern=tests/integration",
  "test:e2e": "playwright test",
  "test:all": "npm run test && npm run test:integration && npm run test:e2e",
  "test:coverage": "jest --coverage",
  // TypeScript-specific test compilation (optional fallback approach)
  "pretest": "tsc -p tsconfig.test.json --outDir dist-tests",
  "clean:tests": "rimraf dist-tests"
}

Phase 2: Critical Path Unit Tests (Week 2)
2.1 WebSocket Server Tests

// tests/unit/services/WebSocketServer.test.ts
import { WebSocketServer } from '../../../server/services/WebSocketServer';
import { Server } from 'http';
import WebSocket from 'ws';

// CORRECT: Only mock external dependencies, not the SUT
jest.mock('ws', () => {
  return {
    Server: jest.fn().mockImplementation(() => ({
      on: jest.fn(),
      handleUpgrade: jest.fn(),
      emit: jest.fn()
    }))
  };
});

// IMPORTANT: Create a real HTTP server mock, not a simple object
const createMockServer = () => {
  const mockServer: Partial<Server> = {
    on: jest.fn(),
    listeners: jest.fn().mockReturnValue([]),
    removeListener: jest.fn()
  };
  return mockServer as Server;
};

describe('WebSocketServer', () => {
  let webSocketServer: WebSocketServer;
  let mockServer: Server;
  
  beforeEach(() => {
    mockServer = createMockServer();
    
    // IMPORTANT: Use the real WebSocketServer, not a mock or test double
    webSocketServer = new WebSocketServer(mockServer);
  });
  
  it('should initialize correctly', () => {
    // IMPORTANT: Test the actual instance, not a mock
    expect(webSocketServer).toBeDefined();
    expect(webSocketServer).toBeInstanceOf(WebSocketServer);
  });
  
  it('should set up upgrade handler on the HTTP server', () => {
    // Verify the integration between server and WebSocketServer
    expect(mockServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
  });
  
  // Add more tests for WebSocket message handling
  // IMPORTANT: Test real behavior, not mocked functionality
});

2.2 Translation Service Tests

// tests/unit/services/TranslationService.test.ts
import { OpenAITranscriptionService, OpenAITranslationService } from '../../../server/services/TranslationService';
import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// CORRECT: Mock external dependencies only, not the SUT
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({
          text: 'This is a test transcription'
        })
      }
    },
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: 'This is a test translation' } }]
        })
      }
    }
  }));
});

// CORRECT: Mock file system operations that might have side effects
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  createReadStream: jest.fn().mockReturnValue({}),
  writeFile: jest.fn().mockImplementation((_path, _data, callback) => callback(null)),
  unlink: jest.fn().mockImplementation((_path, callback) => callback(null)),
  stat: jest.fn().mockImplementation((_path, callback) => callback(null, { size: 1000, mtime: new Date() }))
}));

describe('TranslationService', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  let transcriptionService: OpenAITranscriptionService;
  let translationService: OpenAITranslationService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI = new (OpenAI as any)();
    
    // IMPORTANT: Use the real services, not mocks or test doubles
    transcriptionService = new OpenAITranscriptionService(mockOpenAI);
    translationService = new OpenAITranslationService(mockOpenAI);
  });
  
  it('should transcribe audio', async () => {
    // Create a sample audio buffer
    const audioBuffer = Buffer.from('test audio');
    
    // Call the real method with test data
    const result = await transcriptionService.transcribe(audioBuffer, 'en-US');
    
    // Verify integration with OpenAI API
    expect(mockOpenAI.audio.transcriptions.create).toHaveBeenCalled();
    expect(result).toBe('This is a test transcription');
  });
  
  it('should translate text correctly', async () => {
    const result = await translationService.translate('Hello world', 'en-US', 'es-ES');
    
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledWith(expect.objectContaining({
      messages: expect.arrayContaining([
        expect.objectContaining({ role: 'system' }),
        expect.objectContaining({ role: 'user', content: expect.stringContaining('Hello world') })
      ])
    }));
    expect(result).toBe('This is a test translation');
  });
  
  it('should handle empty input appropriately', async () => {
    const result = await translationService.translate('', 'en-US', 'es-ES');
    expect(result).toBe('');
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });
  
  // Test error handling
  it('should handle API errors gracefully', async () => {
    // Setup mock to throw an error
    mockOpenAI.chat.completions.create.mockRejectedValueOnce(new Error('API Error'));
    
    // Call real method and ensure it handles the error
    const result = await translationService.translate('Hello', 'en-US', 'es-ES');
    expect(result).toBe('');
  });
});

2.3 Text-to-Speech Service Tests
// tests/unit/services/TextToSpeechService.test.ts
import { TextToSpeechService, ttsFactory } from '../../../server/services/TextToSpeechService';
import OpenAI from 'openai';

// CORRECT: Mock external APIs, not the service itself
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    audio: {
      speech: {
        create: jest.fn().mockImplementation(async () => {
          return {
            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(1000))
          };
        })
      }
    }
  }));
});

describe('TextToSpeechService', () => {
  let mockOpenAI: jest.Mocked<OpenAI>;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockOpenAI = new (OpenAI as any)();
  });
  
  describe('TTSFactory', () => {
    it('should return the correct TTS service implementation', () => {
      // IMPORTANT: Test the actual factory, not a mock
      const openAIService = ttsFactory.getService('openai');
      expect(openAIService).toBeDefined();
      expect(openAIService).toBeInstanceOf(TextToSpeechService);
      
      const browserService = ttsFactory.getService('browser');
      expect(browserService).toBeDefined();
      
      // Test fallback behavior
      const defaultService = ttsFactory.getService('nonexistent');
      expect(defaultService).toBeDefined();
    });
  });
  
  describe('OpenAI TTS Service', () => {
    let ttsService: TextToSpeechService;
    
    beforeEach(() => {
      // IMPORTANT: Use the real service with mocked dependencies
      ttsService = ttsFactory.getService('openai');
      // Inject the mock OpenAI instance
      (ttsService as any).openai = mockOpenAI;
    });
    
    it('should synthesize speech correctly', async () => {
      const result = await ttsService.synthesizeSpeech({
        text: 'Hello world',
        languageCode: 'en-US'
      });
      
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(expect.objectContaining({
        input: 'Hello world',
        voice: expect.any(String)
      }));
      expect(Buffer.isBuffer(result)).toBeTruthy();
    });
    
    it('should handle empty text input', async () => {
      const result = await ttsService.synthesizeSpeech({
        text: '',
        languageCode: 'en-US'
      });
      
      expect(mockOpenAI.audio.speech.create).not.toHaveBeenCalled();
      expect(Buffer.isBuffer(result)).toBeTruthy();
      expect(result.length).toBe(0);
    });
    
    it('should map language codes to appropriate voices', async () => {
      await ttsService.synthesizeSpeech({
        text: 'Bonjour',
        languageCode: 'fr-FR'
      });
      
      expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
        expect.objectContaining({
          voice: expect.stringContaining('french') // Assuming voice mapping contains 'french'
        })
      );
    });
  });
});

Phase 3: API Integration Tests (Week 3)
3.1 API Routes Tests

// tests/integration/api/routes.test.ts
import request from 'supertest';
import express from 'express';
import { apiRoutes } from '../../../server/routes';

describe('API Routes', () => {
  let app: express.Express;
  
  beforeEach(() => {
    // IMPORTANT: Use the actual Express app and routes
    app = express();
    app.use(express.json());
    app.use('/api', apiRoutes);
  });
  
  it('should handle health check endpoint', async () => {
    const response = await request(app)
      .get('/api/health')
      .expect('Content-Type', /json/)
      .expect(200);
      
    expect(response.body).toHaveProperty('status', 'ok');
  });
  
  it('should handle translation endpoint', async () => {
    // Mock the translation service that routes might use
    jest.mock('../../../server/services/TranslationService', () => ({
      speechTranslationService: {
        translateSpeech: jest.fn().mockResolvedValue({
          originalText: 'Hello',
          translatedText: 'Hola',
          audioBuffer: Buffer.from('test')
        })
      }
    }));
    
    const response = await request(app)
      .post('/api/translate')
      .send({
        text: 'Hello world',
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES'
      })
      .expect('Content-Type', /json/)
      .expect(200);
    
    expect(response.body).toHaveProperty('translatedText');
  });
  
  // Add more tests for each API endpoint
});

3.2 WebSocket Integration Tests

// tests/integration/api/websocket.test.ts
import WebSocket from 'ws';
import { createServer } from 'http';
import express from 'express';
import { WebSocketServer } from '../../../server/services/WebSocketServer';
import { AddressInfo } from 'net';

// IMPORTANT: Don't mock the WebSocketServer here - we're testing integration
describe('WebSocket Integration', () => {
  let server: ReturnType<typeof createServer>;
  let app: express.Express;
  let wsServer: WebSocketServer;
  let port: number;
  
  beforeAll((done) => {
    // Create real Express app and HTTP server
    app = express();
    server = createServer(app);
    
    // Create real WebSocketServer
    wsServer = new WebSocketServer(server);
    
    // Start server on a random port
    server.listen(0, () => {
      const address = server.address() as AddressInfo;
      port = address.port;
      done();
    });
  });
  
  afterAll((done) => {
    server.close(done);
  });
  
  it('should establish WebSocket connection', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    
    ws.on('open', () => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
    
    ws.on('close', () => {
      done();
    });
    
    ws.on('error', (error) => {
      done(error);
    });
  });
  
  it('should handle client registration message', (done) => {
    const ws = new WebSocket(`ws://localhost:${port}/ws`);
    
    ws.on('open', () => {
      // Send registration message
      ws.send(JSON.stringify({
        type: 'register',
        role: 'student',
        language: 'es-ES'
      }));
      
      // Mock a timeout in case no response is received
      setTimeout(() => {
        ws.close();
        done(new Error('No response received'));
      }, 5000);
    });
    
    ws.on('message', (data) => {
      const message = JSON.parse(data.toString());
      expect(message.type).toBe('registration');
      expect(message.success).toBe(true);
      ws.close();
      done();
    });
    
    ws.on('error', (error) => {
      done(error);
    });
  });
  
  // Test additional WebSocket message types
});

Phase 4: Database Integration Tests (Week 4)
4.1 Database Schema and Operations Tests

// tests/integration/db/storage.test.ts
import { storage } from '../../../server/storage';
import { db } from '../../../server/db';
import { sql } from 'drizzle-orm';

// IMPORTANT: For DB tests, either:
// 1. Use a test database (preferred)
// 2. Mock the DB queries, but test integration with real storage methods

describe('Storage Integration', () => {
  // Setup a test database or mock
  beforeAll(async () => {
    // Either connect to a test DB or set up mocks
    // For this example, we'll mock Drizzle ORM
    jest.mock('../../../server/db', () => {
      return {
        db: {
          insert: jest.fn().mockResolvedValue([{ id: 1 }]),
          select: jest.fn().mockResolvedValue([
            { 
              id: 1, 
              originalText: 'Hello', 
              translatedText: 'Hola',
              sourceLanguage: 'en-US',
              targetLanguage: 'es-ES',
              createdAt: new Date()
            }
          ]),
          update: jest.fn().mockResolvedValue([{ id: 1 }]),
          delete: jest.fn().mockResolvedValue([{ id: 1 }]),
          query: {
            select: jest.fn().mockReturnThis(),
            from: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            execute: jest.fn().mockResolvedValue([])
          }
        },
        eq: jest.fn().mockImplementation(value => value),
        and: jest.fn().mockImplementation((...conditions) => conditions),
        translations: {
          id: 'id',
          originalText: 'originalText',
          translatedText: 'translatedText',
          sourceLanguage: 'sourceLanguage',
          targetLanguage: 'targetLanguage',
          createdAt: 'createdAt'
        }
      };
    });
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  it('should save translation to database', async () => {
    const translationData = {
      originalText: 'Hello',
      translatedText: 'Hola',
      sourceLanguage: 'en-US',
      targetLanguage: 'es-ES'
    };
    
    // Call the actual storage method (not a mock)
    await storage.saveTranslation(translationData);
    
    // Verify the database was called correctly
    expect(db.insert).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        originalText: 'Hello',
        translatedText: 'Hola'
      })
    );
  });
  
  it('should retrieve translations by language pair', async () => {
    // Call the actual method
    const translations = await storage.getTranslationsByLanguage('en-US', 'es-ES');
    
    // Verify the database was queried correctly
    expect(db.select).toHaveBeenCalled();
    expect(translations).toHaveLength(1);
    expect(translations[0]).toHaveProperty('originalText', 'Hello');
  });
  
  // Add more tests for all storage operations
});


Phase 5: End-to-End Testing (Week 5-6)
5.1 Playwright Configuration
Typescript

// playwright.config.ts
import { PlaywrightTestConfig, devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests/e2e',
  timeout: 30000,
  expect: {
    timeout: 5000
  },
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/test-results.json' }]
  ],
  use: {
    actionTimeout: 10000,
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'mobile chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'mobile safari',
      use: { ...devices['iPhone 12'] },
    }
  ],
};

export default config;

5.2 Teacher Interface E2E Test

// tests/e2e/teacher.spec.ts
import { test, expect } from '@playwright/test';

// IMPORTANT: E2E tests should use the real application
// Start the application server before running tests
test.beforeAll(async () => {
  // You may want to start the server programmatically
  // or ensure it's already running
  console.log('Making sure server is running on port 5000');
});

test('Teacher interface should load and function correctly', async ({ page }) => {
  // Navigate to teacher page
  await page.goto('http://localhost:5000/teacher');
  
  // Check if key elements are present
  await expect(page.locator('button#startRecording')).toBeVisible();
  await expect(page.locator('select#sourceLanguage')).toBeVisible();
  
  // Test language selection
  await page.selectOption('select#sourceLanguage', 'en-US');
  
  // Wait for WebSocket connection to establish
  await expect(page.locator('#connectionStatus')).toHaveText(/Connected/i, { timeout: 5000 });
  
  // Test recording button functionality
  await page.click('button#startRecording');
  await expect(page.locator('button#stopRecording')).toBeVisible();
  
  // Test stopping recording
  await page.click('button#stopRecording');
  await expect(page.locator('button#startRecording')).toBeVisible();
  
  // Check that transcription area exists
  await expect(page.locator('#transcriptionArea')).toBeVisible();
});

test('Teacher interface should show active connections', async ({ page }) => {
  // Open teacher interface
  await page.goto('http://localhost:5000/teacher');
  
  // Wait for page to load fully
  await page.waitForLoadState('networkidle');
  
  // Check for active connections panel
  await expect(page.locator('#activeConnections')).toBeVisible();
  
  // NOTE: To fully test this, we would need to:
  // 1. Open a second browser context
  // 2. Connect a student in that context
  // 3. Verify the teacher UI updates
  // This is complex to set up in a single test
});

5.3 Student Interface E2E Test

// tests/e2e/student.spec.ts
import { test, expect } from '@playwright/test';

test('Student interface should load and function correctly', async ({ page }) => {
  // Navigate to student page
  await page.goto('http://localhost:5000/student');
  
  // Check if key elements are present
  await expect(page.locator('select#targetLanguage')).toBeVisible();
  
  // Test language selection
  await page.selectOption('select#targetLanguage', 'es-ES');
  
  // Wait for WebSocket connection to establish
  await expect(page.locator('#connectionStatus')).toHaveText(/Connected/i, { timeout: 5000 });
  
  // Verify translation display area is present
  await expect(page.locator('#translationDisplay')).toBeVisible();
  
  // Check audio controls are present
  await expect(page.locator('#audioControls')).toBeVisible();
});

test('Student should receive translations (simulated)', async ({ page }) => {
  // This test requires either:
  // 1. A mock server that sends predetermined messages
  // 2. A programmatic way to inject messages into the WebSocket
  
  await page.goto('http://localhost:5000/student');
  
  // Select language
  await page.selectOption('select#targetLanguage', 'es-ES');
  
  // Wait for connection
  await expect(page.locator('#connectionStatus')).toHaveText(/Connected/i, { timeout: 5000 });
  
  // Inject a fake translation message using page.evaluate
  await page.evaluate(() => {
    // Access the WebSocket instance from the window object
    // This assumes your app stores the WebSocket instance on window
    // You may need to adjust this based on your implementation
    const fakeEvent = new MessageEvent('message', {
      data: JSON.stringify({
        type: 'translation',
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES',
        audioBase64: 'base64EncodedAudioPlaceholder'
      })
    });
    window.dispatchEvent(new CustomEvent('websocketMessage', { detail: fakeEvent }));
  });
  
  // Check that the translation is displayed
  await expect(page.locator('#translationDisplay')).toContainText('Hola mundo');
});

Phase 6: Performance and Load Testing (Week 7)
6.1 k6 Load Testing Script

// tests/load/websocket-load.js
import { check, sleep } from 'k6';
import ws from 'k6/ws';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.1.0/index.js';

export const options = {
  stages: [
    { duration: '30s', target: 10 }, // Ramp up to 10 users
    { duration: '1m', target: 10 },  // Stay at 10 users
    { duration: '30s', target: 25 }, // Ramp up to 25 users
    { duration: '1m', target: 25 },  // Stay at 25 users
    { duration: '30s', target: 0 },  // Ramp down to 0 users
  ],
};

const LANGUAGES = ['es-ES', 'fr-FR', 'de-DE', 'ja-JP', 'zh-CN'];

export default function() {
  const url = 'ws://localhost:5000/ws';
  const params = { tags: { my_tag: 'websocket test' } };

  const res = ws.connect(url, params, function(socket) {
    socket.on('open', () => {
      console.log('WebSocket connection established');
      
      // Register as a student with random language
      const language = LANGUAGES[randomIntBetween(0, LANGUAGES.length - 1)];
      socket.send(JSON.stringify({
        type: 'register',
        role: 'student',
        language: language
      }));
    });

    socket.on('message', (data) => {
      const message = JSON.parse(data);
      console.log(`Received message type: ${message.type}`);
      
      // Request a translation every 5-10 seconds
      if (message.type === 'registration') {
        setInterval(() => {
          socket.send(JSON.stringify({
            type: 'getTranslation',
            text: 'This is a test message for load testing',
            sourceLanguage: 'en-US',
            targetLanguage: LANGUAGES[randomIntBetween(0, LANGUAGES.length - 1)]
          }));
        }, randomIntBetween(5000, 10000));
      }
    });

    socket.on('close', () => console.log('WebSocket connection closed'));
    socket.on('error', (e) => console.log('WebSocket error: ', e));

    // Keep the connection open for the test duration
    socket.setTimeout(function() {
      socket.close();
    }, 60000);
  });

  check(res, { 'Connected successfully': (r) => r && r.status === 101 });
  sleep(1);
}

Phase 7: CI/CD Integration (Week 8)
7.1 GitHub Actions Workflow

# .github/workflows/test.yml
name: Test AIVoiceTranslator

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:13
        env:
          POSTGRES_USER: postgres
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: aivoicetranslator_test
        ports:
          - 5432:5432
        options: --health-cmd pg_isready --health-interval 10s --health-timeout 5s --health-retries 5
    
    steps:
      - uses: actions/checkout@v2
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: TypeScript Check
        run: npx tsc --noEmit
      
      - name: Lint
        run: npm run lint
      
      - name: Unit Tests
        run: npm test
        env:
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/aivoicetranslator_test


          