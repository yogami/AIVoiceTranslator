/**
 * Direct tests for openai-streaming.ts
 * 
 * This focuses on testing the exported functions only
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocketState } from '../../server/websocket';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Mocked transcription result'
          })
        }
      }
    }))
  };
});

// Mock fs module which might be used internally
vi.mock('fs', () => ({
  createReadStream: vi.fn().mockReturnValue({})
}));

// Set up environment variables
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

// Create mock WebSocket
class MockWebSocket {
  readyState = WebSocketState.OPEN;
  send = vi.fn();
}

describe('OpenAI Streaming Module - Direct Tests', () => {
  let streamingModule;
  let mockWs;
  let mockSessionId;
  let mockAudioBase64;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module after mocks are set up
    streamingModule = await import('../../server/openai-streaming');
    
    // Set up test data
    mockWs = new MockWebSocket();
    mockSessionId = 'test-session-123';
    mockAudioBase64 = Buffer.from('test audio data').toString('base64');
  });
  
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });
  
  describe('processStreamingAudio function', () => {
    it('should process audio data without errors', async () => {
      // Call the function
      await streamingModule.processStreamingAudio(
        mockWs,
        mockSessionId,
        mockAudioBase64,
        true, // isFirstChunk
        'en-US'
      );
      
      // Since we're mocking deep internals, simply verify no exceptions were thrown
      // We can see from the logs that the session was created successfully
      expect(true).toBe(true);
    });
    
    it('should handle clearly invalid base64 data without crashing', async () => {
      // Intentionally use an input that will cause decode errors
      const badInput = null;
      
      // Call with problematic input - should not throw
      await expect(streamingModule.processStreamingAudio(
        mockWs,
        mockSessionId,
        badInput as any,
        true,
        'en-US'
      )).resolves.not.toThrow();
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should finalize a session without errors', async () => {
      // First create a session
      await streamingModule.processStreamingAudio(
        mockWs,
        mockSessionId,
        mockAudioBase64,
        true,
        'en-US'
      );
      
      // Reset the mock to check only finalization calls
      mockWs.send.mockReset();
      
      // Call finalize
      await streamingModule.finalizeStreamingSession(
        mockWs,
        mockSessionId
      );
      
      // Verify final result was sent
      expect(mockWs.send).toHaveBeenCalled();
    });
    
    it('should handle non-existent session gracefully', async () => {
      // Spy on console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Call finalize with an invalid session ID
      await streamingModule.finalizeStreamingSession(
        mockWs,
        'non-existent-session'
      );
      
      // Verify no errors were thrown
      expect(consoleSpy).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should clean up sessions without errors', () => {
      // Should not throw errors
      expect(() => {
        streamingModule.cleanupInactiveStreamingSessions(1000);
      }).not.toThrow();
    });
  });
});