/**
 * Advanced tests for OpenAI Streaming functionality
 *
 * This test file focuses on using only the public API of openai-streaming.ts
 * without relying on access to internal implementation details
 * 
 * Converted from Jest to Vitest
 */
import { describe, it, expect, beforeEach, beforeAll, afterEach, vi } from 'vitest';
import { Buffer } from 'buffer';

// Must mock modules before imports
// Use inline values instead of references to avoid hoisting issues
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'This is a mock transcription',
        }),
      },
    },
  }))
}));

// Mock WebSocket with inline constants
vi.mock('ws', () => {
  // Create a mock WebSocket class
  class MockWebSocket {
    // Use literal values instead of references
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
        this.lastMessage = data;
      }
    });
    
    on = vi.fn();
    removeListener = vi.fn();
    close = vi.fn();
    terminate = vi.fn();
    ping = vi.fn();
    pong = vi.fn();
    
    readyState = 1; // OPEN
    lastMessage = null;
    
    // Helper for tests
    messageHandler = null;
    simulateMessage(data) {
      if (this.messageHandler) {
        this.messageHandler(data);
      }
    }
  }
  
  return {
    WebSocket: MockWebSocket,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
});

// Ensure environment is set up
beforeAll(() => {
  // Set up process.env.OPENAI_API_KEY for testing
  process.env.OPENAI_API_KEY = 'test-api-key';
});

// Import after mocks
import { WebSocket } from 'ws';
import { sessionManager, processStreamingAudio, finalizeStreamingSession, cleanupInactiveStreamingSessions } from '../../server/openai-streaming';

describe('OpenAI Streaming Advanced', () => {
  // Mock WebSocket
  let mockWebSocket;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create fresh mockWebSocket for each test
    mockWebSocket = new WebSocket();
    
    // Spy on sessionManager methods
    vi.spyOn(sessionManager, 'createSession');
    vi.spyOn(sessionManager, 'getSession');
    vi.spyOn(sessionManager, 'addAudioToSession');
    vi.spyOn(sessionManager, 'deleteSession');
    vi.spyOn(sessionManager, 'cleanupInactiveSessions');
  });
  
  afterEach(() => {
    // Reset modules between tests
    vi.restoreAllMocks();
  });
  
  describe('processStreamingAudio', () => {
    it('should create a new session when isFirstChunk is true', async () => {
      // Arrange
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const sessionId = 'test-session-123';
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Act
      await processStreamingAudio(
        mockWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Assert
      expect(sessionManager.createSession).toHaveBeenCalledWith(
        sessionId, 
        language,
        expect.any(Buffer)
      );
    });
    
    it('should add to existing session when isFirstChunk is false', async () => {
      // Arrange
      const audioBase64 = Buffer.from('more test audio data').toString('base64');
      const sessionId = 'test-session-456';
      const isFirstChunk = false;
      const language = 'en-US';
      
      // Mock that the session exists
      vi.mocked(sessionManager.getSession).mockReturnValue({
        sessionId,
        language,
        isProcessing: false,
        audioBuffer: [],
        lastChunkTime: Date.now(),
        transcriptionText: '',
        transcriptionInProgress: false
      });
      
      // Act
      await processStreamingAudio(
        mockWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Assert
      expect(sessionManager.addAudioToSession).toHaveBeenCalledWith(
        sessionId,
        expect.any(Buffer)
      );
    });
  });
  
  describe('finalizeStreamingSession', () => {
    it('should delete the session when finalizing', async () => {
      // Arrange
      const sessionId = 'test-session-789';
      
      // Mock session exists with transcription
      vi.mocked(sessionManager.getSession).mockReturnValue({
        sessionId,
        language: 'en-US',
        isProcessing: false,
        audioBuffer: [],
        lastChunkTime: Date.now(),
        transcriptionText: 'Final transcription',
        transcriptionInProgress: false
      });
      
      // Act
      await finalizeStreamingSession(mockWebSocket, sessionId);
      
      // Assert
      expect(sessionManager.deleteSession).toHaveBeenCalledWith(sessionId);
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
    
    it('should handle non-existent session gracefully', async () => {
      // Arrange
      const sessionId = 'non-existent-session';
      
      // Mock session doesn't exist
      vi.mocked(sessionManager.getSession).mockReturnValue(undefined);
      
      // Act & Assert
      await expect(finalizeStreamingSession(mockWebSocket, sessionId))
        .resolves.not.toThrow();
      
      // Should not delete a session that doesn't exist
      expect(sessionManager.deleteSession).not.toHaveBeenCalled();
    });
  });
  
  describe('cleanupInactiveStreamingSessions', () => {
    it('should cleanup inactive sessions after specified time', () => {
      // Arrange
      const maxAge = 30000; // 30 seconds
      
      // Act
      cleanupInactiveStreamingSessions(maxAge);
      
      // Assert
      expect(sessionManager.cleanupInactiveSessions).toHaveBeenCalledWith(maxAge);
    });
    
    it('should use default max age if not specified', () => {
      // Act
      cleanupInactiveStreamingSessions();
      
      // Assert - should call with default value
      expect(sessionManager.cleanupInactiveSessions).toHaveBeenCalled();
    });
  });
});