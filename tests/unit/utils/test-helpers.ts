/**
 * Test Utilities for AIVoiceTranslator Tests
 * 
 * This file contains helper functions and utilities that can be reused across tests
 * to avoid code duplication and improve test maintainability.
 */

import { Server } from 'http';
import { vi, beforeAll, afterAll, beforeEach } from 'vitest';
import OpenAI from 'openai';

/**
 * Creates a mock WebSocket client object for testing
 * @param options Optional properties to override default mock values
 * @returns A mock WebSocket client object
 */
export function createMockWebSocketClient(options: Partial<any> = {}) {
  return {
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    isAlive: true,
    sessionId: '',
    readyState: 1, // OPEN state
    ...options
  };
}

/**
 * Creates a mock HTTP server for testing WebSocket integration
 * @returns A mock HTTP server
 */
export function createMockServer() {
  return {
    on: vi.fn(),
    listeners: vi.fn().mockReturnValue([]),
    removeListener: vi.fn()
  } as unknown as Server;
}

/**
 * Creates a properly structured OpenAI mock for testing services
 * that use OpenAI APIs
 * @param options Optional properties to override default mock values
 * @returns A mock OpenAI client
 */
export function createMockOpenAI(options: Partial<any> = {}) {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ message: { content: 'Mock response' } }]
        })
      }
    },
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'Mock transcription' })
      },
      speech: {
        create: vi.fn().mockResolvedValue(Buffer.from('mock audio data'))
      }
    },
    apiKey: 'test-api-key',
    organization: 'test-org',
    _options: {},
    ...options
  } as unknown as OpenAI;
}

/**
 * Creates a mock Buffer object for audio testing
 * @param size Size in bytes of the buffer
 * @param content Optional content for the buffer
 * @returns A mock Buffer with the specified size
 */
export function createMockAudioBuffer(size: number, content: string = 'test-audio-data') {
  return Buffer.alloc(size, content);
}

/**
 * Setup common test environment for services that work with file system
 * @param testDir The directory to use for temporary test files
 */
export function setupFileSystemTestEnvironment(testDir: string) {
  const fs = require('fs');
  const path = require('path');

  beforeAll(() => {
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (fs.existsSync(testDir)) {
      fs.rmdirSync(testDir, { recursive: true });
    }
  });

  beforeEach(() => {
    // Ensure the directory is clean before each test
    if (!fs.existsSync(testDir)) {
      fs.mkdirSync(testDir, { recursive: true });
    } else {
      fs.readdirSync(testDir).forEach((file: string) => {
        fs.unlinkSync(path.join(testDir, file));
      });
    }
  });
}