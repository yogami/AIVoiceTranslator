/**
 * Fixed tests for OpenAI Streaming Audio Transcription Service
 *
 * Using a better approach for mocking with Vitest
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the WebSocket constants
vi.mock('ws', () => ({
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock the OpenAI module - use inline function instead of a separate variable
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'Test transcription result', 
          duration: 2.5
        })
      }
    }
  }))
}));

// Mock configuration
vi.mock('../../server/config', () => ({
  CONFIG: {
    OPENAI_API_KEY: 'test-api-key',
    SESSION_MAX_AGE_MS: 60000,
    MIN_AUDIO_SIZE_BYTES: 100,
    PROCESSING_INTERVAL_MS: 100
  }
}));

// Import SUT after mocks
import { 
  processStreamingAudio, 
  finalizeStreamingSession, 
  cleanupInactiveStreamingSessions 
} from '../../server/openai-streaming';

describe('OpenAI Streaming Audio Service - Final Tests', () => {
  // Test variables
  let mockWebSocket;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Create a fresh mock WebSocket for each test
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1 // OPEN
    };
  });

  describe('processStreamingAudio', () => {
    it('should handle first chunk of audio', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const isFirstChunk = true;
      const language = 'en-US';
  
      // Act
      await processStreamingAudio(
        mockWebSocket as any, 
        sessionId, 
        audioBase64, 
        isFirstChunk, 
        language
      );
  
      // Assert - Check that WebSocket.send was called with session creation message
      expect(mockWebSocket.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWebSocket.send.mock.calls[0][0]);
      expect(sentMessage).toHaveProperty('type');
    });
  });

  describe('finalizeStreamingSession', () => {
    it('should properly finalize a session', async () => {
      // Arrange - Create a session first
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const language = 'en-US';
  
      await processStreamingAudio(
        mockWebSocket as any, 
        sessionId, 
        audioBase64, 
        true, 
        language
      );
      mockWebSocket.send.mockClear();
  
      // Act - Finalize it
      await finalizeStreamingSession(mockWebSocket as any, sessionId);
  
      // Assert
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });

  describe('cleanupInactiveStreamingSessions', () => {
    it('should not affect active sessions', async () => {
      // Arrange - Create a session
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('data1').toString('base64');
      await processStreamingAudio(
        mockWebSocket as any, 
        sessionId, 
        audioBase64, 
        true, 
        'en-US'
      );
  
      // Act - Clean up (it's active, so should remain)
      cleanupInactiveStreamingSessions();
  
      // Verify session still exists
      mockWebSocket.send.mockClear();
      await finalizeStreamingSession(mockWebSocket as any, sessionId);
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });
});