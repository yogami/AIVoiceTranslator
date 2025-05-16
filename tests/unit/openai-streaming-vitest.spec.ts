/**
 * OpenAI Streaming Module Tests
 * 
 * This file contains unit tests for the OpenAI Streaming module.
 * It tests the real-time audio transcription and session management functionality.
 * 
 * Converted from Jest to Vitest
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Buffer } from 'buffer';

// Mock OpenAI first since it must be hoisted
vi.mock('openai', () => ({
  default: vi.fn(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'Mocked transcription text',
          duration: 2.5
        })
      }
    }
  }))
}));

// Mock necessary modules
vi.mock('../../server/config', () => ({
  CONFIG: {
    OPENAI_API_KEY: 'mocked-api-key',
    SESSION_MAX_AGE_MS: 60000,
    MIN_AUDIO_SIZE_BYTES: 100,
    PROCESSING_INTERVAL_MS: 100,
    WHISPER_MODEL: 'whisper-1',
    LOG_PREFIX: '[OpenAI Streaming]'
  }
}));

// Import after mocks
import {
  processStreamingAudio,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions,
  sessionManager
} from '../../server/openai-streaming';

describe('OpenAI Streaming Module', () => {
  // Mock WebSocket
  let mockWebSocket;
  
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create mock WebSocket
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1, // WebSocket.OPEN
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    };
    
    // Spy on sessionManager methods
    vi.spyOn(sessionManager, 'createSession');
    vi.spyOn(sessionManager, 'getSession');
    vi.spyOn(sessionManager, 'addAudioToSession');
    vi.spyOn(sessionManager, 'deleteSession');
    vi.spyOn(sessionManager, 'cleanupInactiveSessions');
  });
  
  describe('processStreamingAudio', () => {
    it('should create a new session when processing first chunk', async () => {
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
      
      // Assert
      expect(sessionManager.createSession).toHaveBeenCalledWith(
        sessionId,
        language,
        expect.any(Buffer)
      );
    });
    
    it('should add to existing session when processing additional chunks', async () => {
      // Arrange - Mock an existing session
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const isFirstChunk = false;
      const language = 'en-US';
      
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
        mockWebSocket as any,
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
    it('should delete session when finalizing', async () => {
      // Arrange
      const sessionId = 'test-session-456';
      
      // Mock getSession to return a session
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
      await finalizeStreamingSession(mockWebSocket as any, sessionId);
      
      // Assert
      expect(sessionManager.deleteSession).toHaveBeenCalledWith(sessionId);
    });
    
    it('should handle non-existent session gracefully', async () => {
      // Arrange
      const sessionId = 'non-existent-session';
      
      // Mock getSession to return undefined
      vi.mocked(sessionManager.getSession).mockReturnValue(undefined);
      
      // Act
      await finalizeStreamingSession(mockWebSocket as any, sessionId);
      
      // Assert - Should not throw an error
      expect(sessionManager.deleteSession).not.toHaveBeenCalled();
    });
  });
  
  describe('cleanupInactiveStreamingSessions', () => {
    it('should call sessionManager.cleanupInactiveSessions', () => {
      // Arrange
      const maxAge = 30000;
      
      // Act
      cleanupInactiveStreamingSessions(maxAge);
      
      // Assert
      expect(sessionManager.cleanupInactiveSessions).toHaveBeenCalledWith(maxAge);
    });
  });
});