/**
 * Server Entry Point Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('server/index.ts (entry point)', () => {
  let startServerMock: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    
    // Mock console.error
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
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
    // Mock import.meta.url to simulate running the file directly
    const originalArgv = process.argv;
    process.argv = ['/path/to/node', '/Users/yamijala/gitprojects/AIVoiceTranslator/server/index.ts'];
    
    try {
      // Dynamic import to trigger the module execution
      await import('../../server/index.ts?t=' + Date.now());
      
      // Give async operations time to complete
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(startServerMock).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      expect(processExitSpy).not.toHaveBeenCalled();
    } finally {
      process.argv = originalArgv;
    }
  });

  it('logs error and exits if startServer rejects', async () => {
    const fakeError = new Error('Failed to start');
    
    // Mock the server module to make startServer reject
    startServerMock.mockRejectedValue(fakeError);
    
    vi.doMock('../../server/server', () => ({
      startServer: startServerMock
    }));
    
    // Mock import.meta.url to simulate running the file directly
    const originalArgv = process.argv;
    process.argv = ['/path/to/node', '/Users/yamijala/gitprojects/AIVoiceTranslator/server/index.ts'];
    
    try {
      // Import dynamically after mocking
      await import('../../server/index.ts?t=' + Date.now());
      // Give time for the promise to reject and be caught
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      // Expected - process.exit throws in our mock
    } finally {
      process.argv = originalArgv;
    }
    
    expect(startServerMock).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error starting server:', fakeError);
    expect(processExitSpy).toHaveBeenCalledWith(1);
  });
});