/**
 * Shared test helper functions and utilities
 */

import { vi } from 'vitest';

/**
 * Creates a mock WebSocket client for testing
 */
export function createMockWebSocket(): any {
  const mockWs = {
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
    readyState: 1, // OPEN state
    isAlive: true,
    sessionId: 'test-session-123',
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