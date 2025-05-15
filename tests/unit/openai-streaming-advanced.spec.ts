/**
 * Advanced tests for OpenAI Streaming functionality
 *
 * This test file focuses on using only the public API of openai-streaming.ts
 * without relying on access to internal implementation details
 */
import { jest, describe, it, expect, beforeEach, beforeAll, afterEach } from '@jest/globals';
import { WebSocket } from 'ws';
import type { ExtendedWebSocket } from '../../server/websocket';
import { sessionManager, processStreamingAudio, finalizeStreamingSession, cleanupInactiveStreamingSessions } from '../../server/openai-streaming';

// Ensure environment is set up
beforeAll(() => {
  // Set up process.env.OPENAI_API_KEY for testing
  process.env.OPENAI_API_KEY = 'test-api-key';
});

// Mock OpenAI
jest.mock('openai', () => {
  const mockOpenAI = jest.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: jest.fn().mockResolvedValue({
          text: 'This is a mock transcription',
        }),
      },
    },
  }));
  
  // In ESM, OpenAI is the default export
  mockOpenAI.default = mockOpenAI;
  return mockOpenAI;
});

// Mock WebSocket
jest.mock('ws', () => {
  // Create a mock WebSocket class with necessary implementation
  class MockWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSING = 2;
    static CLOSED = 3;
    
    send = jest.fn(function(data) {
      // Auto-parse the data to help with testing
      try {
        const parsed = JSON.parse(data);
        this.lastMessage = parsed;
      } catch (e) {
        // Ignore parsing errors
      }
      return true;
    });
    
    on = jest.fn();
    removeListener = jest.fn();
    close = jest.fn();
    terminate = jest.fn();
    ping = jest.fn();
    pong = jest.fn();
    
    readyState = MockWebSocket.OPEN;
    lastMessage = null;
    
    constructor() {
      // Set up default behavior for on() method to capture event handlers
      this.on.mockImplementation((event, handler) => {
        if (event === 'message') {
          this.messageHandler = handler;
        }
        return this;
      });
    }
    
    // Helper to simulate incoming messages
    simulateMessage(data) {
      if (this.messageHandler) {
        this.messageHandler({
          data: typeof data === 'string' ? data : JSON.stringify(data),
        });
      }
    }
  }
  
  return {
    WebSocket: MockWebSocket
  };
});

describe('OpenAI Streaming Advanced Tests', () => {
  // Mock setInterval globally to avoid Jest warnings about timers
  beforeAll(() => {
    // Create a mock implementation of setInterval that returns a typical timer ID
    const origSetInterval = global.setInterval;
    jest.spyOn(global, 'setInterval').mockImplementation((callback, ms) => {
      // Call the original but add the __promisify__ property that Node.js adds
      const intervalId = origSetInterval(callback, ms);
      Object.defineProperty(intervalId, '__promisify__', { value: jest.fn() });
      return intervalId;
    });
    
    // Ensure OPENAI_API_KEY is set for testing
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-api-key';
  });
  
  afterAll(() => {
    // Clean up all mocks
    jest.restoreAllMocks();
    
    // Clean up any sessions that might remain
    cleanupInactiveStreamingSessions(0);
  });
  let mockWebSocket;
  
  beforeEach(() => {
    mockWebSocket = new WebSocket();
    mockWebSocket.readyState = WebSocket.OPEN;
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Clean up any sessions after each test
    cleanupInactiveStreamingSessions(0); // Force clean all sessions
  });

  /**
   * Test for edge cases in the processStreamingAudio function
   */
  describe('processStreamingAudio edge cases', () => {
    it('should handle WebSocket in CLOSED state', async () => {
      // Set up a closed WebSocket
      mockWebSocket.readyState = WebSocket.CLOSED;
      
      // Test data
      const sessionId = 'closed-socket-test';
      const audioBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Call function with closed WebSocket
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Function should early return due to closed socket
      expect(mockWebSocket.send).not.toHaveBeenCalled();
      
      // Reset WebSocket state for other tests
      mockWebSocket.readyState = WebSocket.OPEN;
    });
    
    it('should handle extremely large audio chunks gracefully', async () => {
      // Create a large audio chunk (100KB of random data)
      const largeBuffer = Buffer.alloc(100 * 1024); // 100KB buffer
      for (let i = 0; i < largeBuffer.length; i++) {
        largeBuffer[i] = Math.floor(Math.random() * 256);
      }
      const largeAudioBase64 = largeBuffer.toString('base64');
      
      // Test data
      const sessionId = 'large-chunk-test';
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Spy on console.error to catch any errors
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Process the large chunk
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        largeAudioBase64,
        isFirstChunk,
        language
      );
      
      // This should not throw an error - verify no errors were logged
      const errorCalls = consoleErrorSpy.mock.calls.filter(
        call => call[0] && typeof call[0] === 'string' && call[0].includes('Error processing streaming audio')
      );
      expect(errorCalls.length).toBe(0);
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle malformed language codes gracefully', async () => {
      // Test data with malformed language code
      const sessionId = 'malformed-language-test';
      const audioBase64 = 'SGVsbG8gV29ybGQ=';
      const isFirstChunk = true;
      const language = 'not-a-real-language-code';
      
      // Process audio with invalid language
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify session was created with the language code anyway
      // This tests that the code doesn't try to validate language codes
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      if (session) {
        expect(session.language).toBe(language);
      }
    });
  });

  /**
   * Test indirect testing of audio processing via session manipulation
   */
  describe('Indirect testing of audio processing', () => {
    it('should process accumulated audio for the same session ID', async () => {
      // Test data
      const sessionId = 'accumulated-audio-test';
      const audioBase64 = 'SGVsbG8gV29ybGQ='; // Small chunk
      const language = 'en-US';
      
      // Send multiple chunks to the same session
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        true, // First chunk
        language
      );
      
      // Clear send mock to track only new messages
      mockWebSocket.send.mockClear();
      
      // Send a second chunk
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        false, // Not first chunk
        language
      );
      
      // Send a third chunk
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        false, // Not first chunk
        language
      );
      
      // Finalize to trigger processing of all chunks
      await finalizeStreamingSession(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId
      );
      
      // We should have received a transcription message that is marked as final
      const messages = mockWebSocket.send.mock.calls
        .map(call => {
          try {
            return JSON.parse(call[0]);
          } catch (e) {
            return null;
          }
        })
        .filter(msg => msg !== null);
      
      // Find the final transcription message
      const finalMessage = messages.find(msg => msg.type === 'transcription' && msg.isFinal === true);
      expect(finalMessage).toBeDefined();
      expect(finalMessage.text).toBeDefined();
    });
    
    it('should handle parallel sessions without interference', async () => {
      // Create two separate sessions
      const sessionId1 = 'parallel-session-1';
      const sessionId2 = 'parallel-session-2';
      const audioBase64 = 'SGVsbG8gV29ybGQ=';
      
      // Initialize both sessions
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId1,
        audioBase64,
        true,
        'en-US'
      );
      
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId2,
        audioBase64,
        true,
        'fr-FR' // Different language
      );
      
      // Verify both sessions exist with correct languages
      const session1 = sessionManager.getSession(sessionId1);
      const session2 = sessionManager.getSession(sessionId2);
      
      expect(session1).toBeDefined();
      expect(session2).toBeDefined();
      
      if (session1 && session2) {
        expect(session1.language).toBe('en-US');
        expect(session2.language).toBe('fr-FR');
      }
      
      // Finalize one session but not the other
      await finalizeStreamingSession(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId1
      );
      
      // Session 1 should be gone, but session 2 should still exist
      expect(sessionManager.getSession(sessionId1)).toBeUndefined();
      expect(sessionManager.getSession(sessionId2)).toBeDefined();
    });
  });

  /**
   * Test cleanup of sessions to cover inactive session handling
   */
  describe('Session cleanup and management', () => {
    it('should track last chunk time to determine inactivity', async () => {
      // Create a session
      const sessionId = 'last-chunk-time-test';
      const audioBase64 = 'SGVsbG8gV29ybGQ=';
      
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        true,
        'en-US'
      );
      
      // Get initial last chunk time
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      
      if (session) {
        const initialLastChunkTime = session.lastChunkTime;
        
        // Wait a small amount of time
        await new Promise(resolve => setTimeout(resolve, 10));
        
        // Send another chunk and verify time is updated
        await processStreamingAudio(
          mockWebSocket as unknown as ExtendedWebSocket,
          sessionId,
          audioBase64,
          false,
          'en-US'
        );
        
        // Time should be updated
        expect(session.lastChunkTime).toBeGreaterThan(initialLastChunkTime);
      }
    });
    
    it('should clean up only truly inactive sessions', async () => {
      // Create multiple sessions with different activity times
      const sessionIds = ['cleanup-test-1', 'cleanup-test-2', 'cleanup-test-3'];
      const audioBase64 = 'SGVsbG8gV29ybGQ=';
      
      // Initialize all sessions
      for (const sessionId of sessionIds) {
        await processStreamingAudio(
          mockWebSocket as unknown as ExtendedWebSocket,
          sessionId,
          audioBase64,
          true,
          'en-US'
        );
      }
      
      // Manipulate lastChunkTime to simulate different inactivity periods
      const sessions = sessionIds.map(id => sessionManager.getSession(id));
      sessions.forEach((session, index) => {
        if (session) {
          // Set different inactive times
          // First session: 5 seconds old
          // Second session: 10 seconds old
          // Third session: 15 seconds old
          const offset = (index + 1) * 5000;
          session.lastChunkTime = Date.now() - offset;
        }
      });
      
      // Run cleanup with 7 seconds threshold - should only clean the second and third sessions
      cleanupInactiveStreamingSessions(7000);
      
      // Verify first session still exists, but others are gone
      expect(sessionManager.getSession(sessionIds[0])).toBeDefined();
      expect(sessionManager.getSession(sessionIds[1])).toBeUndefined();
      expect(sessionManager.getSession(sessionIds[2])).toBeUndefined();
    });
  });

  /**
   * Test session management under error conditions
   */
  describe('Error handling in session management', () => {
    it('should handle concurrent attempts to finalize the same session', async () => {
      // Create a session
      const sessionId = 'concurrent-finalize-test';
      const audioBase64 = 'SGVsbG8gV29ybGQ=';
      
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        true,
        'en-US'
      );
      
      // Start two finalizeStreamingSession calls at almost the same time
      const promise1 = finalizeStreamingSession(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId
      );
      
      const promise2 = finalizeStreamingSession(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId
      );
      
      // Both should complete without errors
      await Promise.all([promise1, promise2]);
      
      // The session should be deleted
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should handle errors in WebSocket message sending', async () => {
      // Create a session
      const sessionId = 'send-error-test';
      const audioBase64 = 'SGVsbG8gV29ybGQ=';
      
      // In this test, we need to specifically trigger WebSocketCommunicator.sendMessage error
      // We need to create a real error situation when processing audio
      
      // First create a mock OpenAI transcription error
      const openAIMock = jest.requireMock('openai');
      openAIMock().audio.transcriptions.create.mockRejectedValueOnce(
        new Error('API Error during transcription')
      );
      
      // Make WebSocket.send throw an error when trying to send the error response
      mockWebSocket.send.mockImplementationOnce(() => {
        throw new Error('Simulated WebSocket send error');
      });
      
      // Spy on console.error to capture both the API error and the WebSocket send error
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Process audio which will trigger both errors
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        true,
        'en-US'
      );
      
      // Add a small delay to ensure all async operations complete
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Verify error was logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // The session should still have been created despite the send error
      expect(sessionManager.getSession(sessionId)).toBeDefined();
      
      // Restore console.error
      consoleErrorSpy.mockRestore();
    });
  });
});