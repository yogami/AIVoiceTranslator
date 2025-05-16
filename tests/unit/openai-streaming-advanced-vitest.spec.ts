/**
 * Advanced tests for OpenAI Streaming Audio Transcription Service
 *
 * Using finer-grained mocking with Vitest for better test isolation
 * Converted from Jest to Vitest
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { Buffer } from 'buffer';

// Mock WebSocket constants
vi.mock('ws', () => {
  return {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
});

// Set up mock OpenAI client
const mockCreateTranscription = vi.fn();

// Create a mock OpenAI module
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        audio: {
          transcriptions: {
            create: mockCreateTranscription
          }
        }
      };
    })
  };
});

// Mock environment variables with process.env
vi.mock('../server/config', () => {
  return {
    CONFIG: {
      OPENAI_API_KEY: 'test-api-key',
      SESSION_MAX_AGE_MS: 60000,
      MIN_AUDIO_SIZE_BYTES: 100,
      PROCESSING_INTERVAL_MS: 100
    }
  };
});

// Import SUT after all mocks are defined
import { 
  processStreamingAudio, 
  finalizeStreamingSession, 
  cleanupInactiveStreamingSessions 
} from '../../server/openai-streaming';

describe('OpenAI Streaming Audio Service - Advanced Tests', () => {
  // Test variables
  let mockWebSocket;
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.resetAllMocks();
    
    // Setup default mock responses
    mockCreateTranscription.mockResolvedValue({
      text: 'This is a test transcription',
      duration: 3.5
    });
    
    // Mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1 // OPEN
    };
  });

  afterEach(() => {
    // Clean up any mocks or test data
  });

  describe('processStreamingAudio', () => {
    it('should handle first chunk of audio', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const isFirstChunk = true;
      const language = 'en-US';
  
      // Act
      await processStreamingAudio(mockWebSocket, sessionId, audioBase64, isFirstChunk, language);
  
      // Assert - Check that WebSocket.send was called with session creation message
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('session_created'));
    });
  
    it('should handle subsequent chunks of audio', async () => {
      // Arrange - First create a session
      const sessionId = 'test-session-123';
      const firstChunkBase64 = Buffer.from('first chunk').toString('base64');
      const secondChunkBase64 = Buffer.from('second chunk').toString('base64');
      const language = 'en-US';
  
      // Act - First chunk
      await processStreamingAudio(mockWebSocket, sessionId, firstChunkBase64, true, language);
      mockWebSocket.send.mockClear();
  
      // Act - Second chunk
      await processStreamingAudio(mockWebSocket, sessionId, secondChunkBase64, false, language);
  
      // Assert - Check that the new chunk was acknowledged
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('audio_chunk_received'));
    });
  
    it('should handle errors gracefully', async () => {
      // Arrange
      mockCreateTranscription.mockRejectedValue(new Error('API Error'));
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio').toString('base64');
  
      // Act
      await processStreamingAudio(mockWebSocket, sessionId, audioBase64, true, 'en-US');
  
      // Assert
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('error'));
    });
  });

  describe('finalizeStreamingSession', () => {
    it('should properly finalize a session', async () => {
      // Arrange - Create a session first
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const language = 'en-US';
  
      await processStreamingAudio(mockWebSocket, sessionId, audioBase64, true, language);
      mockWebSocket.send.mockClear();
  
      // Act - Finalize it
      await finalizeStreamingSession(mockWebSocket, sessionId);
  
      // Assert
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('session_completed'));
    });
  
    it('should handle non-existent sessions gracefully', async () => {
      // Act - Try to finalize a non-existent session
      await finalizeStreamingSession(mockWebSocket, 'nonexistent-session');
  
      // Assert
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('error'));
    });
  });

  describe('cleanupInactiveStreamingSessions', () => {
    it('should clean up inactive sessions', async () => {
      // Arrange - Create multiple sessions
      await processStreamingAudio(mockWebSocket, 'session1', Buffer.from('data1').toString('base64'), true, 'en-US');
      await processStreamingAudio(mockWebSocket, 'session2', Buffer.from('data2').toString('base64'), true, 'fr-FR');
  
      // Act - Clean up (all are active, so nothing should happen)
      cleanupInactiveStreamingSessions();
  
      // Try to finalize a session to check it still exists
      mockWebSocket.send.mockClear();
      await finalizeStreamingSession(mockWebSocket, 'session1');
      expect(mockWebSocket.send).toHaveBeenCalledWith(expect.stringContaining('session_completed'));
    });
  });
});