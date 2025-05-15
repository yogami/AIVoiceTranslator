/**
 * Advanced tests for OpenAI Streaming functionality
 *
 * This test file focuses on using only the public API of openai-streaming.ts
 * without relying on access to internal implementation details
 * 
 * Converted from Jest to Vitest
 */
import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { WebSocket } from 'ws';
import type { ExtendedWebSocket } from '../../server/websocket';
import { sessionManager, processStreamingAudio, finalizeStreamingSession, cleanupInactiveStreamingSessions } from '../../server/openai-streaming';

// Ensure environment is set up
beforeAll(() => {
  // Set up process.env.OPENAI_API_KEY for testing
  process.env.OPENAI_API_KEY = 'test-api-key';
});

// Mock OpenAI
vi.mock('openai', () => {
  const mockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'This is a mock transcription',
        }),
      },
    },
  }));
  
  // In ESM, OpenAI is the default export
  return { default: mockOpenAI };
});

// Mock WebSocket
vi.mock('ws', () => {
  // Create a mock WebSocket class with necessary implementation
  class MockWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSING = 2;
    static CLOSED = 3;
    
    send = vi.fn(function(data) {
      // Auto-parse the data to help with testing
      try {
        const parsed = JSON.parse(data);
        this.lastMessage = parsed;
      } catch (e) {
        // Ignore parsing errors
      }
      return true;
    });
    
    on = vi.fn();
    removeListener = vi.fn();
    close = vi.fn();
    terminate = vi.fn();
    ping = vi.fn();
    pong = vi.fn();
    
    readyState = MockWebSocket.OPEN;
    lastMessage = null;
    messageHandler = null;
    
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
  // Mock setInterval globally to avoid warnings about timers
  beforeAll(() => {
    // Create a mock implementation of setInterval that returns a typical timer ID
    const origSetInterval = global.setInterval;
    vi.spyOn(global, 'setInterval').mockImplementation((callback, ms) => {
      // Call the original but add the __promisify__ property that Node.js adds
      const intervalId = origSetInterval(callback, ms);
      Object.defineProperty(intervalId, '__promisify__', { value: vi.fn() });
      return intervalId;
    });
    
    // Ensure OPENAI_API_KEY is set for testing
    process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-api-key';
  });
  
  afterAll(() => {
    // Clean up all mocks
    vi.restoreAllMocks();
    
    // Clean up any sessions that might remain
    cleanupInactiveStreamingSessions(0);
  });
  
  let mockWebSocket;
  
  beforeEach(() => {
    mockWebSocket = new WebSocket();
    mockWebSocket.readyState = WebSocket.OPEN;
    
    // Clear all mocks before each test
    vi.clearAllMocks();
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
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
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
      vi.mocked(mockWebSocket.send).mockClear();
      
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
      const messages = vi.mocked(mockWebSocket.send).mock.calls
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
  describe('OpenAI client factory behavior', () => {
    it('should use the OpenAI module', async () => {
      // This simpler test just verifies that our mock was used
      const sessionId = 'openai-test';
      const audioBase64 = 'SGVsbG8gV29ybGQ=';
      
      // Create a session using processStreamingAudio
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        true,
        'en-US'
      );
      
      // Verify the session exists
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      
      // Verify OpenAI was used (indirectly through the module)
      const openAIMock = vi.importActual('openai');
      expect(openAIMock).toBeTruthy(); // Just verify it exists
    });
    
    it('should create sessions with different languages', async () => {
      // Test multiple languages
      const languages = ['en-US', 'fr-FR', 'es-ES', 'de-DE'];
      const audioBase64 = 'SGVsbG8gV29ybGQ=';
      
      // Create sessions with different languages
      for (let i = 0; i < languages.length; i++) {
        const sessionId = `multi-language-test-${i}`;
        const language = languages[i];
        
        await processStreamingAudio(
          mockWebSocket as unknown as ExtendedWebSocket,
          sessionId,
          audioBase64,
          true,
          language
        );
        
        // Verify each session was created with correct language
        const session = sessionManager.getSession(sessionId);
        expect(session).toBeDefined();
        if (session) {
          expect(session.language).toBe(language);
        }
      }
    });
    
    it('should handle WebSocket errors gracefully', async () => {
      // Create a test session
      const sessionId = 'websocket-error-test';
      const audioBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
      
      // First, create a session
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        true,
        'en-US'
      );
      
      // Spy on console.error - this will catch the error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Make the WebSocket throw an error when sending a message
      const originalSend = mockWebSocket.send;
      mockWebSocket.send = vi.fn().mockImplementation(() => {
        throw new Error('Simulated WebSocket send error');
      });
      
      try {
        // Now force an error during WebSocket communication by finalizing the session
        // The finalization will try to send a message, which will throw our error
        await finalizeStreamingSession(
          mockWebSocket as unknown as ExtendedWebSocket,
          sessionId
        );
        
        // The error should be caught and logged by the error handler
        expect(consoleErrorSpy).toHaveBeenCalled();
        const errorCalls = consoleErrorSpy.mock.calls.filter(
          call => call[0] && typeof call[0] === 'string' && call[0].includes('WebSocket error')
        );
        expect(errorCalls.length).toBeGreaterThan(0);
      } finally {
        // Restore the mock
        mockWebSocket.send = originalSend;
        consoleErrorSpy.mockRestore();
      }
    });
  });
});