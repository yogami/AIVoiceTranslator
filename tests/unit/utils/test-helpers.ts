/**
 * Test Utilities for AIVoiceTranslator Tests
 * 
 * This file contains helper functions and utilities that can be reused across tests
 * to avoid code duplication and improve test maintainability.
 */

import { Server } from 'http';
import { vi, beforeAll, afterAll, beforeEach } from 'vitest';
import OpenAI from 'openai';
import { WebSocket } from 'ws';
import { WebSocketState } from '../../../server/websocket';

/**
 * Creates a mock WebSocket client object for testing
 * @param options Optional properties to override default mock values
 * @returns A mock WebSocket client object
 */
export function createMockWebSocketClient(options: {
  readyState?: number;
  isAlive?: boolean;
  sessionId?: string;
} = {}): Partial<WebSocket> & { sentMessages?: any[]; isAlive?: boolean; sessionId?: string } {
  const sentMessages: any[] = [];
  
  return {
    readyState: options.readyState ?? WebSocketState.OPEN,
    isAlive: options.isAlive ?? true,
    sessionId: options.sessionId ?? 'test-session',
    sentMessages,
    on: vi.fn(),
    send: vi.fn((data: any) => {
      if (typeof data === 'string') {
        try {
          sentMessages.push(JSON.parse(data));
        } catch (e) {
          sentMessages.push(data);
        }
      } else {
        sentMessages.push(data);
      }
    }),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    pong: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn().mockReturnValue(true),
    emit: vi.fn(),
    once: vi.fn(),
    off: vi.fn(),
    removeAllListeners: vi.fn(),
    setMaxListeners: vi.fn(),
    getMaxListeners: vi.fn().mockReturnValue(10),
    listeners: vi.fn().mockReturnValue([]),
    rawListeners: vi.fn().mockReturnValue([]),
    listenerCount: vi.fn().mockReturnValue(0),
    prependListener: vi.fn(),
    prependOnceListener: vi.fn(),
    eventNames: vi.fn().mockReturnValue([]),
    binaryType: 'arraybuffer',
    bufferedAmount: 0,
    extensions: '',
    protocol: '',
    url: '',
    CLOSED: WebSocket.CLOSED,
    CLOSING: WebSocket.CLOSING,
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    onerror: null,
    onmessage: null,
    onclose: null,
    onopen: null,
  } as any;
}

/**
 * Creates a properly structured OpenAI mock for testing services
 * that use OpenAI APIs
 * @param options Optional properties to override default mock values
 * @returns A mock OpenAI client
 */
export function createMockOpenAI(options: {
  transcriptionText?: string;
  completionText?: string;
} = {}): OpenAI {
  return {
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{ 
            message: { 
              content: options.completionText ?? 'Test translation' 
            } 
          }]
        })
      }
    },
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: options.transcriptionText ?? 'Test transcription'
        })
      },
      speech: {
        create: vi.fn().mockResolvedValue({
          arrayBuffer: async () => Buffer.from('mock-audio-buffer')
        })
      }
    },
    apiKey: 'test-api-key',
    organization: 'test-org',
    _options: {}
  } as unknown as OpenAI;
}

/**
 * Creates a mock Buffer object for audio testing
 * @param size Size in bytes of the buffer
 * @param content Optional content for the buffer
 * @returns A mock Buffer with the specified size
 */
export function createMockAudioBuffer(size: number = 1000, content: string = 'test-audio-data') {
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

/**
 * Sets up console spies for tests
 */
export function setupConsoleMocks() {
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  
  return {
    consoleLogSpy,
    consoleErrorSpy,
    consoleWarnSpy,
    restore: () => {
      consoleLogSpy.mockRestore();
      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    }
  };
}