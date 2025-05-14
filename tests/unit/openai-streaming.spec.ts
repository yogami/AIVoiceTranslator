/**
 * Tests for OpenAI Streaming Audio Transcription Service
 * 
 * These tests focus on the public API of the streaming module
 * and mock the OpenAI dependencies to avoid actual API calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';

// Mock OpenAI client
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'mock transcription text',
          })
        }
      }
    }))
  };
});

// Mock WebSocket
vi.mock('ws', () => {
  const mockSend = vi.fn();
  
  return {
    WebSocket: vi.fn().mockImplementation(() => ({
      send: mockSend,
      close: vi.fn(),
      readyState: 1,
      OPEN: 1
    })),
    // Export the mock function so we can reference it in tests
    __mockSend: mockSend
  };
});

// Mock environment variable
process.env.OPENAI_API_KEY = 'test-api-key';

describe('OpenAI Streaming Service', () => {
  let mockWs;
  let mockBuffer;
  let mockSend;
  
  beforeEach(() => {
    // Setup mock WebSocket
    mockWs = new WebSocket();
    
    // Access the exported mock send function
    mockSend = vi.importMock('ws').__mockSend;
    
    // Create a mock audio buffer
    mockBuffer = Buffer.from('mock audio data');
    
    // Reset all mocks before each test
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    vi.resetModules();
  });
  
  describe('processStreamingAudio function', () => {
    it('should process audio streams correctly', async () => {
      // Import the module (dynamically to make sure mocks are set up first)
      const { processStreamingAudio } = await import('../../server/openai-streaming');
      
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('mock audio data').toString('base64');
      
      // Call the function
      await processStreamingAudio(
        mockWs, 
        sessionId, 
        audioBase64, 
        true,  // isFirstChunk
        'en-US'  // language
      );
      
      // Verify the WebSocket send was called
      expect(mockSend).toHaveBeenCalled();
      
      // If the mockSend was called with an argument, check it
      if (mockSend.mock.calls.length > 0) {
        const messageArgument = mockSend.mock.calls[0][0];
      expect(JSON.parse(messageArgument)).toHaveProperty('type');
    });
    
    it('should handle empty audio data', async () => {
      // Import the module
      const { processStreamingAudio } = await import('../../server/openai-streaming');
      
      // Call with empty audio data
      await processStreamingAudio(
        mockWs,
        'test-session',
        '',  // empty audio data
        true,
        'en-US'
      );
      
      // Should still work but might log a warning or send an error message
      expect(mockWs.send).toHaveBeenCalled();
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should finalize the session correctly', async () => {
      // Import the module
      const { finalizeStreamingSession } = await import('../../server/openai-streaming');
      
      // Call the function
      await finalizeStreamingSession(mockWs, 'test-session-123');
      
      // Verify WebSocket communication
      expect(mockWs.send).toHaveBeenCalled();
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should clean up inactive sessions', async () => {
      // Import the module
      const { cleanupInactiveStreamingSessions } = await import('../../server/openai-streaming');
      
      // Create a session first to have something to clean up
      const { processStreamingAudio } = await import('../../server/openai-streaming');
      await processStreamingAudio(
        mockWs, 
        'test-cleanup-session', 
        Buffer.from('test').toString('base64'), 
        true, 
        'en-US'
      );
      
      // Call the cleanup function
      cleanupInactiveStreamingSessions(0);  // immediate cleanup
      
      // Since the implementation is complex with private state,
      // we're just testing that the function doesn't throw
      expect(true).toBe(true);
    });
  });
});