/**
 * OpenAI Streaming Module Coverage Tests
 * 
 * Using test doubles and targeted testing techniques to maximize coverage
 * while avoiding modification of source code.
 * 
 * Converted from Jest to Vitest
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Buffer } from 'buffer';

// Mock dependencies first - with inline values to avoid hoisting issues
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Transcription test result',
            duration: 2.5
          })
        }
      }
    }))
  };
});

// Import the module under test AFTER mocking
import { 
  processStreamingAudio, 
  finalizeStreamingSession, 
  cleanupInactiveStreamingSessions,
  sessionManager
} from '../../server/openai-streaming';

describe('OpenAI Streaming Coverage Tests', () => {
  // WebSocket test double
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    
    readyState = MockWebSocket.OPEN;
    sentMessages = [];
    
    constructor(readyState = MockWebSocket.OPEN) {
      this.readyState = readyState;
    }
    
    send(message) {
      try {
        this.sentMessages.push(JSON.parse(message));
        return true;
      } catch (e) {
        this.sentMessages.push(message);
        return false;
      }
    }
  }

  // Test variables
  let ws;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a fresh mock WebSocket
    ws = new MockWebSocket();
    
    // Spy on sessionManager methods
    vi.spyOn(sessionManager, 'createSession');
    vi.spyOn(sessionManager, 'getSession');
    vi.spyOn(sessionManager, 'addAudioToSession'); 
    vi.spyOn(sessionManager, 'deleteSession');
    vi.spyOn(sessionManager, 'cleanupInactiveSessions');
  });
  
  describe('processStreamingAudio function', () => {
    it('should create a new session with first chunk', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Act
      await processStreamingAudio(ws, sessionId, audioBase64, isFirstChunk, language);
      
      // Assert
      expect(sessionManager.createSession).toHaveBeenCalledWith(
        sessionId, 
        language, 
        expect.any(Buffer)
      );
    });
    
    it('should add to existing session with subsequent chunks', async () => {
      // Arrange
      const sessionId = 'test-session-456';
      const audioBase64 = Buffer.from('more test audio').toString('base64');
      const isFirstChunk = false;
      const language = 'es-ES';
      
      // Mock session exists
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
      await processStreamingAudio(ws, sessionId, audioBase64, isFirstChunk, language);
      
      // Assert
      expect(sessionManager.addAudioToSession).toHaveBeenCalledWith(
        sessionId,
        expect.any(Buffer)
      );
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should finalize and delete a session', async () => {
      // Arrange
      const sessionId = 'test-session-789';
      
      // Mock session exists
      vi.mocked(sessionManager.getSession).mockReturnValue({
        sessionId,
        language: 'en-US',
        isProcessing: false,
        audioBuffer: [],
        lastChunkTime: Date.now(),
        transcriptionText: 'Finalized transcription',
        transcriptionInProgress: false
      });
      
      // Act
      await finalizeStreamingSession(ws, sessionId);
      
      // Assert
      expect(sessionManager.deleteSession).toHaveBeenCalledWith(sessionId);
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should call session manager cleanup method', () => {
      // Act
      cleanupInactiveStreamingSessions(60000);
      
      // Assert
      expect(sessionManager.cleanupInactiveSessions).toHaveBeenCalledWith(60000);
    });
  });
});