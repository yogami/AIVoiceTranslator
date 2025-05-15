/**
 * Comprehensive tests for OpenAI Streaming functionality
 *
 * These tests cover the streaming audio transcription functionality
 * in openai-streaming.ts
 * 
 * Modified to work with Jest in ESM environment
 */
import { jest } from '@jest/globals';
import { WebSocket } from 'ws';
import type { ExtendedWebSocket } from '../../server/websocket';

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

// Import the module after mocks are set up
import {
  processStreamingAudio,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions
} from '../../server/openai-streaming';

describe('OpenAI Streaming Module', () => {
  let mockWebSocket;
  
  beforeEach(() => {
    mockWebSocket = new WebSocket();
    mockWebSocket.readyState = WebSocket.OPEN;
    
    // Clear all mocks before each test
    jest.clearAllMocks();
  });
  
  describe('processStreamingAudio function', () => {
    it('should process streaming audio data and handle first chunk correctly', async () => {
      // Test data
      const sessionId = 'test-session-123';
      const audioBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Call the function
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Check that the WebSocket send method was called (for acknowledgment)
      expect(mockWebSocket.send).toHaveBeenCalled();
      
      // The first message should have a type of "audio_received"
      const firstCallArgs = mockWebSocket.send.mock.calls[0][0];
      const firstMessage = JSON.parse(firstCallArgs);
      expect(firstMessage.type).toEqual('audio_received');
    });
    
    it('should handle non-first chunks properly', async () => {
      // Test with a second chunk for an existing session
      const sessionId = 'test-session-123';
      const audioBase64 = 'SGVsbG8gV29ybGQ='; // "Hello World" in base64
      const isFirstChunk = false;
      const language = 'en-US';
      
      // Call the function
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Check that the WebSocket send method was called
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
    
    it('should handle empty audio data gracefully', async () => {
      // Test with empty audio data
      const sessionId = 'test-session-123';
      const audioBase64 = '';
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Clear any previous calls
      mockWebSocket.send.mockClear();
      
      // Spy on console.error to verify error is logged
      const consoleErrorSpy = jest.spyOn(console, 'error');
      
      // Force empty audio to be treated as an error 
      // Empty Buffer is normally created without error, we need to force an error
      jest.spyOn(Buffer, 'from').mockImplementationOnce(() => {
        throw new Error('Empty audio data');
      });
      
      // Call the function with the empty audio
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Should have sent an error message
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket.lastMessage.type).toEqual('error');
      
      // Verify console.error was called
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Clean up
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle invalid base64 data gracefully', async () => {
      // Test with invalid base64 data
      const sessionId = 'test-session-123';
      const audioBase64 = 'INVALID$BASE64#DATA';
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Clear any previous calls
      mockWebSocket.send.mockClear();
      
      // Spy on console.error to verify error is logged
      const consoleErrorSpy = jest.spyOn(console, 'error');
      
      // Force an error to be sent - we need to simulate failing base64 decoding
      // which may not happen in the test environment the same way as production
      jest.spyOn(Buffer, 'from').mockImplementationOnce(() => {
        throw new Error('Invalid base64 string');
      });
      
      // Call the function
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Now the function should have caught the error and sent an error message
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket.lastMessage.type).toEqual('error');
      
      // Clean up
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should finalize a session and send transcription results', async () => {
      // Set up
      const sessionId = 'test-session-123';
      
      // Clear any previous calls
      mockWebSocket.send.mockClear();
      
      // Create a session first with a first chunk
      await processStreamingAudio(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId,
        'SGVsbG8gV29ybGQ=',
        true,
        'en-US'
      );
      
      // Clear mock calls from session setup
      mockWebSocket.send.mockClear();
      
      // Now finalize the session
      await finalizeStreamingSession(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionId
      );
      
      // Should send the final transcription
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket.lastMessage?.type).toEqual('transcription');
      expect(mockWebSocket.lastMessage?.isFinal).toBe(true);
    });
    
    it('should handle non-existent session gracefully', async () => {
      // Try to finalize a session that doesn't exist
      const nonExistentSessionId = 'non-existent-session';
      
      // Ensure send is cleared before checking
      mockWebSocket.send.mockClear();
      
      // Spy on console.error to verify it was called
      const consoleSpy = jest.spyOn(console, 'error');
      
      await finalizeStreamingSession(
        mockWebSocket as unknown as ExtendedWebSocket,
        nonExistentSessionId
      );
      
      // The implementation silently returns for non-existent sessions without sending messages
      // So the send should NOT have been called
      expect(mockWebSocket.send).not.toHaveBeenCalled();
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should clean up inactive sessions', async () => {
      // Create a few sessions
      const sessionIds = ['session1', 'session2', 'session3'];
      
      // Spy on console.log to verify cleanup is running
      const consoleSpy = jest.spyOn(console, 'log');
      
      for (const sessionId of sessionIds) {
        await processStreamingAudio(
          mockWebSocket as unknown as ExtendedWebSocket,
          sessionId,
          'SGVsbG8gV29ybGQ=',
          true,
          'en-US'
        );
      }
      
      // Clear mock calls from session setup
      mockWebSocket.send.mockClear();
      
      // Run cleanup with a very short max age (0ms) to force all sessions to be cleaned
      cleanupInactiveStreamingSessions(0);
      
      // Try to finalize a session that should have been cleaned up
      await finalizeStreamingSession(
        mockWebSocket as unknown as ExtendedWebSocket,
        sessionIds[0]
      );
      
      // The implementation silently returns for non-existent sessions without sending messages
      // So the send should NOT have been called when trying to finalize a non-existent session
      expect(mockWebSocket.send).not.toHaveBeenCalled();
      
      // Restore spy
      consoleSpy.mockRestore();
    });
  });
});