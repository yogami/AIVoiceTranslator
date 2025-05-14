/**
 * Comprehensive tests for OpenAI Streaming functionality
 *
 * These tests cover the streaming audio transcription functionality
 * in openai-streaming.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import type { ExtendedWebSocket } from '../../server/websocket';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'This is a mock transcription',
          }),
        },
      },
    })),
  };
});

// Mock buffer operations
vi.mock('buffer', () => {
  return {
    Buffer: {
      from: vi.fn((data, encoding) => {
        if (encoding === 'base64') {
          // Return something with a length
          return {
            length: typeof data === 'string' ? data.length : 10,
            toString: () => 'decoded-data'
          };
        }
        return { 
          length: 10,
          toString: () => 'mock-buffer'
        };
      }),
      concat: vi.fn((buffers) => {
        return { 
          length: buffers.reduce((acc, buf) => acc + (buf.length || 10), 0),
          toString: () => 'concatenated-buffer'
        };
      })
    }
  };
});

// Environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

// Constants for tests that we can extract from config
const SESSION_MAX_AGE_MS = 300000; // 5 minutes
const CHUNK_SIZE_THRESHOLD = 32000; // 32KB

describe('OpenAI Streaming Audio Processing', () => {
  let mockWebSocket: ExtendedWebSocket;
  let sentMessages: any[] = [];
  let streamingModule: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Create mock WebSocket
    mockWebSocket = {
      send: vi.fn().mockImplementation((message) => {
        try {
          sentMessages.push(JSON.parse(message));
        } catch (e) {
          sentMessages.push(message);
        }
      }),
      isAlive: true,
      readyState: WebSocket.OPEN,
    } as unknown as ExtendedWebSocket;
    
    sentMessages = [];
    
    // Import the module
    streamingModule = await import('../../server/openai-streaming');
  });
  
  describe('processStreamingAudio function', () => {
    it('should handle first chunk of streaming audio', async () => {
      // Test setup
      const sessionId = 'test-session-123';
      const audioBase64 = 'SGVsbG8gd29ybGQ='; // "Hello world" in base64
      const isFirstChunk = true;
      const language = 'en-US';
      
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        sessionId, 
        audioBase64, 
        isFirstChunk, 
        language
      );
      
      // We should have added the session and sent an acknowledgment
      expect(mockWebSocket.send).toHaveBeenCalled();
      
      // Test with different language
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        'test-session-fr', 
        audioBase64, 
        isFirstChunk, 
        'fr-FR'
      );
      
      // We should have sent another acknowledgment
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
    });
    
    it('should handle subsequent chunks of streaming audio', async () => {
      // First create a session
      const sessionId = 'test-session-456';
      const audioBase64 = 'SGVsbG8gd29ybGQ='; // "Hello world" in base64
      const language = 'es-ES';
      
      // First chunk
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        sessionId, 
        audioBase64, 
        true, // isFirstChunk
        language
      );
      
      // Now send a subsequent chunk
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        sessionId, 
        'TW9yZSBhdWRpbw==', // "More audio" in base64
        false, // not first chunk
        language
      );
      
      // Should have sent acknowledgments
      expect(mockWebSocket.send).toHaveBeenCalledTimes(2);
    });
    
    it('should handle empty or invalid audio data', async () => {
      const sessionId = 'test-session-789';
      const language = 'de-DE';
      
      // Test with empty audio
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        sessionId, 
        '', // empty audio
        true, 
        language
      );
      
      // Should send error message
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(sentMessages[0].type).toBe('error');
      
      // Reset
      sentMessages = [];
      
      // Test with invalid base64
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        sessionId, 
        '!@#$%', // invalid base64
        true, 
        language
      );
      
      // Should handle gracefully
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
    
    it('should handle missing session ID', async () => {
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        '', // empty session ID
        'SGVsbG8=', 
        true, 
        'en-US'
      );
      
      // Should send error message
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(sentMessages[0].type).toBe('error');
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should finalize a streaming session', async () => {
      // First create a session
      const sessionId = 'test-session-finalize';
      const audioBase64 = 'SGVsbG8gd29ybGQ='; // "Hello world" in base64
      const language = 'en-US';
      
      // Create session
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        sessionId, 
        audioBase64, 
        true, 
        language
      );
      
      // Reset messages
      sentMessages = [];
      
      // Now finalize it
      await streamingModule.finalizeStreamingSession(
        mockWebSocket,
        sessionId
      );
      
      // Should have sent a message
      expect(mockWebSocket.send).toHaveBeenCalled();
    });
    
    it('should handle finalizing non-existent session', async () => {
      await streamingModule.finalizeStreamingSession(
        mockWebSocket,
        'non-existent-session'
      );
      
      // Should send error message
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(sentMessages[0].type).toBe('error');
    });
    
    it('should handle missing session ID in finalization', async () => {
      await streamingModule.finalizeStreamingSession(
        mockWebSocket,
        '' // empty session ID
      );
      
      // Should send error message
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(sentMessages[0].type).toBe('error');
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should clean up inactive sessions', async () => {
      // Create some sessions first
      const session1 = 'cleanup-test-1';
      const session2 = 'cleanup-test-2';
      
      // Create sessions
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        session1, 
        'SGVsbG8=', 
        true, 
        'en-US'
      );
      
      await streamingModule.processStreamingAudio(
        mockWebSocket, 
        session2, 
        'SGVsbG8=', 
        true, 
        'fr-FR'
      );
      
      // Call cleanup with very short max age (0ms) so all sessions are considered inactive
      streamingModule.cleanupInactiveStreamingSessions(0);
      
      // Try to finalize the cleaned-up sessions - should fail with error
      sentMessages = [];
      await streamingModule.finalizeStreamingSession(mockWebSocket, session1);
      expect(sentMessages[0].type).toBe('error');
      
      sentMessages = [];
      await streamingModule.finalizeStreamingSession(mockWebSocket, session2);
      expect(sentMessages[0].type).toBe('error');
    });
  });
});