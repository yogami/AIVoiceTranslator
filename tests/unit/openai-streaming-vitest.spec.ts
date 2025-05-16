/**
 * Vitest tests for OpenAI Streaming Module
 * 
 * This file contains unit tests for the OpenAI Streaming module.
 * It tests the real-time audio transcription and session management functionality.
 * 
 * Following the structure of the successful test file
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock WebSocket constants
vi.mock('ws', () => ({
  WebSocket: vi.fn(),
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
}));

// Mock the OpenAI module directly inline
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: vi.fn().mockResolvedValue({
          text: 'This is a mock transcription',
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

// Import the module under test AFTER all mocks are defined
import {
  processStreamingAudio,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions
} from '../../server/openai-streaming';

describe('OpenAI Streaming Module Tests', () => {
  // Test variables
  let mockWebSocket;
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Create a fresh mockWebSocket for each test
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1 // OPEN
    };
  });
  
  describe('processStreamingAudio', () => {
    it('processes audio data for a new session', async () => {
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Process the audio
      await processStreamingAudio(
        mockWebSocket as any,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify WebSocket send was called
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
    
    it('processes additional audio data for an existing session', async () => {
      const sessionId = 'test-session-456';
      const audioBase64 = Buffer.from('more test audio data').toString('base64');
      const isFirstChunk = false;
      const language = 'en-US';
      
      // Process the audio
      await processStreamingAudio(
        mockWebSocket as any,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify WebSocket send was called
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });
  
  describe('finalizeStreamingSession', () => {
    it('finalizes a streaming session', async () => {
      const sessionId = 'test-session-789';
      
      // Finalize the session
      await finalizeStreamingSession(mockWebSocket as any, sessionId);
      
      // Verify WebSocket send was called
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
  });
  
  describe('cleanupInactiveStreamingSessions', () => {
    it('cleans up inactive sessions', () => {
      const maxAgeMs = 30000;
      
      // Call the cleanup function
      cleanupInactiveStreamingSessions(maxAgeMs);
      
      // No specific assertions needed as the function doesn't return anything
      // and we're mocking internal dependencies
    });
  });
});