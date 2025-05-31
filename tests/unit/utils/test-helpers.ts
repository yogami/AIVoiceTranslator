/**
 * Shared test helper functions and utilities
 */

import { vi } from 'vitest';

/**
 * Creates a mock WebSocket client for testing
 * @param options Optional parameters to customize the mock WebSocket
 * @param options.role The role of the WebSocket client (e.g., 'teacher', 'student')
 * @param options.languageCode The language code for the client
 * @param options.sessionId Custom session ID
 * @param options.readyState Custom readyState
 * @param options.isAlive Custom isAlive state
 */
export function createMockWebSocketClient(options?: {
  role?: string;
  languageCode?: string;
  sessionId?: string;
  readyState?: number;
  isAlive?: boolean;
}): any {
  const defaultSessionId = 'test-session-123';
  const defaultReadyState = 1; // OPEN
  const defaultIsAlive = true;

  const mockWs = {
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    readyState: options?.readyState ?? defaultReadyState,
    isAlive: options?.isAlive ?? defaultIsAlive,
    sessionId: options?.sessionId ?? defaultSessionId,
    role: options?.role,
    languageCode: options?.languageCode,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };

  // Make 'on' chainable
  mockWs.on.mockReturnValue(mockWs);
  
  return mockWs;
}

/**
 * Creates a mock audio buffer for testing.
 * @param size The size of the buffer in bytes. Defaults to 1024.
 * @param content Optional content to fill the buffer with. Defaults to 'mock-audio-data'.
 */
export function createMockAudioBuffer(size: number = 1024, content: string = 'mock-audio-data'): Buffer {
  const buffer = Buffer.alloc(size);
  buffer.write(content);
  return buffer;
}

/**
 * Creates a mock HTTP request object
 */
export function createMockRequest(url: string = '/ws'): any {
  return {
    url,
    headers: {
      'user-agent': 'test-agent'
    }
  };
}

/**
 * Wait for a condition to be true
 */
export async function waitFor(condition: () => boolean, timeout: number = 5000): Promise<void> {
  const interval = 100;
  const maxAttempts = timeout / interval;
  let attempts = 0;

  while (!condition() && attempts < maxAttempts) {
    await new Promise(resolve => setTimeout(resolve, interval));
    attempts++;
  }

  if (!condition()) {
    throw new Error(`Condition not met within ${timeout}ms`);
  }
}

/**
 * Creates a mock translation service
 */
export function createMockTranslationService() {
  return {
    translateSpeech: vi.fn().mockResolvedValue({
      originalText: 'Hello',
      translatedText: 'Hola',
      audioBuffer: Buffer.from('mock-audio-data')
    }),
    transcribeSpeech: vi.fn().mockResolvedValue({
      text: 'Hello world',
      language: 'en-US'
    })
  };
}

/**
 * Creates a mock diagnostics service
 */
export function createMockDiagnosticsService() {
  return {
    recordConnection: vi.fn(),
    recordConnectionActive: vi.fn(),
    recordConnectionClosed: vi.fn(),
    recordTranslation: vi.fn(),
    recordAudioGeneration: vi.fn(),
    getMetrics: vi.fn().mockResolvedValue({
      connections: { total: 10, active: 2 },
      translations: { total: 50, averageTime: 1500 },
      audio: { totalGenerated: 30, averageGenerationTime: 800 },
      system: { memoryUsage: 100000000, uptime: 3600 }
    })
  };
}

/**
 * Sets up console mocks for testing.
 * This is a placeholder and can be expanded if needed.
 */
export function setupConsoleMocks() {
  const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  return { consoleLogSpy, consoleErrorSpy };
}

/**
 * Sets up a mock file system environment for testing.
 * This is a placeholder and can be expanded if needed.
 * @param _ignoredPath Optional path argument that is currently ignored.
 */
export function setupFileSystemTestEnvironment(_ignoredPath?: any) {
  // Placeholder: In a real scenario, this might use mock-fs or vi.mock('fs')
  // For now, it does nothing, just satisfies the import and signature.
}

/**
 * Creates a mock OpenAI client for testing.
 * This is a placeholder and can be expanded with more specific mock behaviors as needed.
 */
export function createMockOpenAI(): any {
  return {
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({ text: 'mocked transcription' }),
      },
      speech: {
        create: vi.fn().mockResolvedValue(Buffer.from('mock audio data')), // For TTS
      }
    },
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({ choices: [{ message: { content: 'mocked completion' } }] }),
      },
    },
    // Add other OpenAI services/methods here if tests require them
  };
}