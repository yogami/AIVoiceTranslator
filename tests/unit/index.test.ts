/**
 * Server Entry Point Tests
 */

// Ensure required env vars for strict config at the very top
process.env.PORT = process.env.PORT || '5001';
process.env.HOST = process.env.HOST || '127.0.0.1';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgres://user:pass@localhost:5432/testdb';
process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'sk-test-key';
process.env.VITE_API_URL = process.env.VITE_API_URL || 'http://127.0.0.1:5001';
process.env.VITE_WS_URL = process.env.VITE_WS_URL || 'ws://127.0.0.1:5001';
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.TEST_DB_URL = process.env.TEST_DB_URL || 'postgres://user:pass@localhost:5432/testdb';

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import logger from '../../server/logger'; // Import the logger

// Set required env vars for config strictness
beforeAll(() => {
  process.env.PORT = '1234';
  process.env.HOST = 'localhost';
  process.env.NODE_ENV = 'test';
  process.env.LOG_LEVEL = 'info';
  process.env.STORAGE_TYPE = 'memory'; // Added this line
  process.env.TEST_DB_URL = 'postgres://user:pass@localhost:5432/testdb';
  process.env.TEST_REDIS_URL = 'redis://localhost:6379';
  process.env.TEST_PORT = '1234';
  process.env.TEST_HOST = 'localhost';
});

describe('server/index.ts (entry point)', () => {
  let startServerMock: any;
  let loggerErrorSpy: any; // Changed from consoleErrorSpy
  let processExitSpy: any;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Mock logger.error to return the logger instance for chaining
    loggerErrorSpy = vi.spyOn(logger, 'error').mockImplementation(function(this: any, ...args: any[]) { 
      // Actual log call is mocked, just return the instance
      return this;
    });
    
    // Mock process.exit with correct type signature
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      // Don't throw an error, just record the call
      return undefined as never;
    });
    
    // Mock the server module BEFORE importing
    startServerMock = vi.fn().mockResolvedValue({ 
      app: {}, 
      httpServer: {}, 
      wss: {} 
    });
    
    vi.doMock('../../server/server', () => ({
      startServer: startServerMock
    }));
  });

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  it('calls startServer on import', async () => {
    // This test uses mocks from beforeEach: startServerMock, loggerErrorSpy, processExitSpy
    const originalArgv = process.argv;
    process.argv = ['/path/to/node', '/Users/yamijala/gitprojects/AIVoiceTranslator/server/index.ts'];
    
    try {
      // Dynamic import to trigger the module execution, using only Date.now() for an integer cache-bust value
      await import('../../server/index.ts?testCacheBust=' + Date.now());
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(startServerMock).toHaveBeenCalledTimes(1);
      expect(loggerErrorSpy).not.toHaveBeenCalled(); 
      expect(processExitSpy).not.toHaveBeenCalled();
    } finally {
      process.argv = originalArgv;
    }
  });

  it('logs error and exits if startServer rejects', async () => {
    const fakeError = new Error('Failed to start');
    // Ensure fakeError has a stack for consistent testing, as error.stack can sometimes be undefined
    if (!fakeError.stack) {
      fakeError.stack = 'mocked stack trace for testing';
    }
    
    vi.resetModules(); // Reset module cache first

    // --- Mocks specific to this test case, applied after resetModules ---
    // Mock for logger.error, in case other parts of server/index.ts (e.g., validateConfig) use it.
    // Not directly asserted for the main catch block of startServer rejection.
    const specificTestLoggerErrorMock = vi.fn();
    vi.doMock('../../server/logger', () => ({
      default: { 
        info: vi.fn(),
        warn: vi.fn(),
        error: specificTestLoggerErrorMock, 
        debug: vi.fn(),
      }
    }));

    const isolatedStartServerMock = vi.fn().mockImplementation(() => { throw fakeError; });
    vi.doMock('../../server/server', () => ({ 
      startServer: isolatedStartServerMock
    }));

    // Spy on console.error for this test, as server/index.ts uses it in the catch block
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Spy on the global process.exit for this test
    const localProcessExitSpy = vi.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
      return undefined as never; // Prevents test from actually exiting
    });
    // --- End of mocks specific to this test case ---

    const originalArgv = process.argv;
    // Ensure process.argv[1] is a clean path that will match import.meta.url (without query)
    const scriptPath = '/Users/yamijala/gitprojects/AIVoiceTranslator/server/index.ts';
    process.argv = ['node', scriptPath]; 
    
    try {
      // Import server/index without the .ts extension
      await import('../../server/index');
      
      // Allow time for async operations (promise rejection and .catch block) to complete
      await new Promise(resolve => process.nextTick(resolve));
      await new Promise(resolve => setTimeout(resolve, 100)); 
    } catch (e) {
      // This catch is for potential errors during the import itself, not the handled rejection.
      // console.error("Error during test import for 'logs error and exits':", e); // For debugging
    } finally {
      process.argv = originalArgv;
    }
    
    // Assert against the mocks and spies created specifically for this test
    expect(isolatedStartServerMock).toHaveBeenCalledTimes(1);
    
    // Assert console.error calls based on server/index.ts's catch block
    expect(consoleErrorSpy).toHaveBeenCalledTimes(2); 
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(1, 
      expect.stringContaining('CRITICAL ERROR during initialization:'), 
      fakeError
    );
    // The second call in server/index.ts logs a string: `...Error stack: ${error.stack}`
    expect(consoleErrorSpy).toHaveBeenNthCalledWith(2, 
      expect.stringContaining('Error stack: ' + fakeError.stack)
    );
    
    expect(localProcessExitSpy).toHaveBeenCalledWith(1);
    
    // consoleErrorSpy and localProcessExitSpy will be restored by afterEach's vi.restoreAllMocks()
    // The vi.doMock for logger and server will be cleared by afterEach's vi.resetModules()
  });
});