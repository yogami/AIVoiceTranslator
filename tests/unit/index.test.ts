/**
 * Server Entry Point Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import logger from '../../server/logger'; // Import the logger

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
    
    vi.resetModules(); // Reset module cache first

    // --- Mocks specific to this test case, applied after resetModules ---
    const mockLoggerErrorMethod = vi.fn();
    vi.doMock('../../server/logger', () => ({
      default: { // Assuming logger.ts exports the logger as default
        info: vi.fn(),
        warn: vi.fn(),
        error: mockLoggerErrorMethod, // server/index.ts will use this specific mock
        debug: vi.fn(),
      }
    }));

    const isolatedStartServerMock = vi.fn().mockRejectedValue(fakeError);
    vi.doMock('../../server/server', () => ({ // Mock the server module for this import
      startServer: isolatedStartServerMock
    }));

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
    expect(mockLoggerErrorMethod).toHaveBeenCalledTimes(1); 
    expect(mockLoggerErrorMethod).toHaveBeenCalledWith('Error starting server:', { error: fakeError }); 
    expect(localProcessExitSpy).toHaveBeenCalledWith(1);
    
    // localProcessExitSpy will be restored by afterEach's vi.restoreAllMocks()
    // The vi.doMock for logger and server will be cleared by afterEach's vi.resetModules()
  });
});