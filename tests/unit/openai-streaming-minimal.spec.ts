/**
 * Minimal tests for openai-streaming.ts
 * 
 * This focuses on testing the public API in an ESM-compatible way
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Readable } from 'stream';

// Mock OpenAI client
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      // Mock methods needed by the module
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Mocked transcription text'
          })
        }
      }
    }))
  };
});

// Mock WebSocket
class MockWebSocket {
  send = vi.fn();
  readyState = 1; // WebSocket.OPEN
  OPEN = 1;
}

// Set environment variables
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

describe('OpenAI Streaming Module', () => {
  // Create a mock for the module exports
  let streamingModule;
  let mockWs;
  let mockSessionId;
  let mockAudioBase64;
  let mockLanguage;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Setup test data
    mockWs = new MockWebSocket();
    mockSessionId = 'test-session-123';
    mockAudioBase64 = Buffer.from('test audio data').toString('base64');
    mockLanguage = 'en-US';
    
    // Import the module (this will use our mocks)
    streamingModule = await import('../../server/openai-streaming');
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('processStreamingAudio function', () => {
    it('should accept streaming audio data', async () => {
      // Create spy on sessionManager methods that will be used
      const createSessionSpy = vi.spyOn(Object.getPrototypeOf(streamingModule), 'createSession').mockImplementation(() => {
        return {
          sessionId: mockSessionId,
          language: mockLanguage,
          isProcessing: false,
          audioBuffer: [],
          lastChunkTime: Date.now(),
          transcriptionText: '',
          transcriptionInProgress: false
        };
      });
      
      const addAudioToSessionSpy = vi.spyOn(Object.getPrototypeOf(streamingModule), 'addAudioToSession').mockImplementation(() => {});
      
      // Call the function being tested
      await streamingModule.processStreamingAudio(
        mockWs,
        mockSessionId,
        mockAudioBase64,
        true, // isFirstChunk
        mockLanguage
      );
      
      // Verify a new session was created
      expect(createSessionSpy).toHaveBeenCalledWith(
        mockSessionId,
        mockLanguage,
        expect.any(Buffer)
      );
      
      // Verify the WebSocket.send method was called (ACK message)
      expect(mockWs.send).toHaveBeenCalled();
      expect(mockWs.send.mock.calls[0][0]).toContain('sessionCreated');
    });
    
    it('should handle additional audio chunks for existing sessions', async () => {
      // Mock the session manager to return an existing session
      const getSessionSpy = vi.spyOn(Object.getPrototypeOf(streamingModule), 'getSession').mockImplementation(() => {
        return {
          sessionId: mockSessionId,
          language: mockLanguage,
          isProcessing: false,
          audioBuffer: [],
          lastChunkTime: Date.now(),
          transcriptionText: '',
          transcriptionInProgress: false
        };
      });
      
      const addAudioToSessionSpy = vi.spyOn(Object.getPrototypeOf(streamingModule), 'addAudioToSession').mockImplementation(() => {});
      
      // Call the function with isFirstChunk = false (not a new session)
      await streamingModule.processStreamingAudio(
        mockWs,
        mockSessionId,
        mockAudioBase64,
        false, // isFirstChunk
        mockLanguage
      );
      
      // Verify the session was retrieved and not created
      expect(getSessionSpy).toHaveBeenCalledWith(mockSessionId);
      
      // Verify audio was added to the existing session
      expect(addAudioToSessionSpy).toHaveBeenCalledWith(
        mockSessionId,
        expect.any(Buffer)
      );
      
      // Verify WebSocket acknowledgment was sent
      expect(mockWs.send).toHaveBeenCalled();
      expect(mockWs.send.mock.calls[0][0]).toContain('audioReceived');
    });
    
    it('should handle invalid base64 data', async () => {
      // Call with invalid base64 data
      await streamingModule.processStreamingAudio(
        mockWs,
        mockSessionId,
        'not-valid-base64!',
        true,
        mockLanguage
      );
      
      // Verify error message was sent
      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.message).toContain('Invalid base64');
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should finalize a streaming session', async () => {
      // Mock the session manager
      const getSessionSpy = vi.spyOn(Object.getPrototypeOf(streamingModule), 'getSession').mockImplementation(() => {
        return {
          sessionId: mockSessionId,
          language: mockLanguage,
          isProcessing: false,
          audioBuffer: [Buffer.from('audio chunk')],
          lastChunkTime: Date.now(),
          transcriptionText: 'Partial transcription',
          transcriptionInProgress: false
        };
      });
      
      const deleteSessionSpy = vi.spyOn(Object.getPrototypeOf(streamingModule), 'deleteSession').mockImplementation(() => true);
      
      // Mock audio processing
      const transcribeAudioSpy = vi.spyOn(Object.getPrototypeOf(streamingModule), 'transcribeAudio').mockResolvedValue('Final transcription');
      
      // Call the function
      await streamingModule.finalizeStreamingSession(
        mockWs,
        mockSessionId
      );
      
      // Verify session was retrieved
      expect(getSessionSpy).toHaveBeenCalledWith(mockSessionId);
      
      // Verify transcription was performed
      expect(transcribeAudioSpy).toHaveBeenCalled();
      
      // Verify session was deleted after processing
      expect(deleteSessionSpy).toHaveBeenCalledWith(mockSessionId);
      
      // Verify final result was sent to WebSocket
      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('transcriptionResult');
      expect(sentMessage.result.text).toBe('Final transcription');
      expect(sentMessage.result.isFinal).toBe(true);
    });
    
    it('should handle non-existent sessions', async () => {
      // Mock session not found
      const getSessionSpy = vi.spyOn(Object.getPrototypeOf(streamingModule), 'getSession').mockImplementation(() => undefined);
      
      // Call the function with non-existent session ID
      await streamingModule.finalizeStreamingSession(
        mockWs,
        'non-existent-session'
      );
      
      // Verify error message was sent
      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('error');
      expect(sentMessage.message).toContain('not found');
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should clean up inactive sessions', () => {
      // Mock the cleanupInactiveSessions method
      const cleanupSpy = vi.spyOn(Object.getPrototypeOf(streamingModule), 'cleanupInactiveSessions').mockImplementation(() => {});
      
      // Call the function
      streamingModule.cleanupInactiveStreamingSessions(60000); // 1 minute
      
      // Verify cleanup was called with the correct maxAge
      expect(cleanupSpy).toHaveBeenCalledWith(60000);
    });
  });
});