/**
 * OpenAI Streaming Functionality Tests
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockWebSocketClient } from './utils/test-helpers';
import { Buffer } from 'node:buffer';

// Mock dependencies of StreamingAudioProcessor
const mockCreateSession = vi.fn();
const mockAddAudioToSession = vi.fn();
const mockGetSession = vi.fn();
const mockUpdateSessionTranscription = vi.fn();
const mockDeleteSession = vi.fn();

vi.mock('../../server/services/managers/AudioSessionManager', () => ({
  sessionManager: {
    createSession: mockCreateSession,
    addAudioToSession: mockAddAudioToSession,
    getSession: mockGetSession,
    updateSessionTranscription: mockUpdateSessionTranscription,
    deleteSession: mockDeleteSession,
    // cleanupInactiveSessions: vi.fn() // if needed for other tests
  }
}));

const mockTranscribeAudio = vi.fn();
vi.mock('../../server/services/transcription/AudioTranscriptionService', () => ({
  audioTranscriptionService: {
    transcribeAudio: mockTranscribeAudio,
  },
  WebSocketCommunicator: {
    sendTranscriptionResult: vi.fn(),
    sendErrorMessage: vi.fn(),
  }
}));

// OpenAI library mock (if StreamingAudioProcessor or its deep dependencies make direct calls)
// For now, let's assume dependencies like audioTranscriptionService handle OpenAI calls and are mocked.
vi.mock('openai', () => ({ default: vi.fn() })); // Basic mock if not directly used by SUT

describe('StreamingAudioProcessor', () => {
  let streamingModule: typeof import('../../server/services/processors/StreamingAudioProcessor');
  
  beforeEach(async () => {
    vi.clearAllMocks();
    // Dynamically import SUT to get fresh mocks applied
    streamingModule = await import('../../server/services/processors/StreamingAudioProcessor');
  });
  
  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('processStreamingAudio', () => {
    it('should create a new session for the first audio chunk', async () => {
      const mockWs = createMockWebSocketClient({ readyState: 1 });
      const sessionId = 'session-1';
      const audioBase64 = Buffer.from('first chunk').toString('base64');
      const language = 'en-US';

      // Mock getSession to indicate no existing session initially
      mockGetSession.mockReturnValue(undefined);

      await streamingModule.processStreamingAudio(mockWs as any, sessionId, audioBase64, true, language);

      expect(mockGetSession).toHaveBeenCalledWith(sessionId);
      expect(mockCreateSession).toHaveBeenCalledTimes(1);
      expect(mockCreateSession).toHaveBeenCalledWith(sessionId, language, expect.any(Buffer));
      expect(mockAddAudioToSession).not.toHaveBeenCalled();
      // ws.send should not be called directly by processStreamingAudio for first chunk in current SUT logic
      const { WebSocketCommunicator } = await import('../../server/services/transcription/AudioTranscriptionService');
      expect(WebSocketCommunicator.sendErrorMessage).not.toHaveBeenCalled();
      expect(WebSocketCommunicator.sendTranscriptionResult).not.toHaveBeenCalled();
    });

    it('should add audio to an existing session for subsequent chunks', async () => {
      const mockWs = createMockWebSocketClient({ readyState: 1 });
      const sessionId = 'session-1';
      const audioBase64 = Buffer.from('next chunk').toString('base64');
      const language = 'en-US';
      const mockExistingSession = { 
        id: sessionId, language, audioBuffer: [], 
        transcriptionInProgress: false, transcriptionText: '' 
      };
      mockGetSession.mockReturnValue(mockExistingSession);

      await streamingModule.processStreamingAudio(mockWs as any, sessionId, audioBase64, false, language);

      expect(mockGetSession).toHaveBeenCalledWith(sessionId);
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockAddAudioToSession).toHaveBeenCalledTimes(1);
      expect(mockAddAudioToSession).toHaveBeenCalledWith(sessionId, expect.any(Buffer));
    });

    // TODO: Add test for the case where !session.transcriptionInProgress && session.audioBuffer.length > 1
    // This would require mocking sessionManager.getSession to return a session that meets these criteria
    // and then verifying if an interim transcription/send process is triggered (if that logic is implemented).
  });

  describe('finalizeStreamingSession', () => {
    it('should transcribe remaining audio and send final result if session exists', async () => {
      const mockWs = createMockWebSocketClient({ readyState: 1 });
      const sessionId = 'session-to-finalize';
      const language = 'en-US';
      const mockAudioChunk = Buffer.from('final audio data');
      const mockSession = {
        id: sessionId,
        language,
        audioBuffer: [mockAudioChunk, mockAudioChunk],
        transcriptionText: '', 
        transcriptionInProgress: false
      };
      mockGetSession.mockReturnValue(mockSession);
      mockTranscribeAudio.mockResolvedValue('Final transcription text');
      
      // Make mockUpdateSessionTranscription modify the mockSession object for this test
      mockUpdateSessionTranscription.mockImplementation((sId, text) => {
        if (sId === mockSession.id) {
          mockSession.transcriptionText = text; 
        }
      });
      
      const { WebSocketCommunicator } = await import('../../server/services/transcription/AudioTranscriptionService');

      await streamingModule.finalizeStreamingSession(mockWs as any, sessionId);

      expect(mockGetSession).toHaveBeenCalledWith(sessionId);
      expect(mockTranscribeAudio).toHaveBeenCalledWith(Buffer.concat(mockSession.audioBuffer), language);
      expect(mockUpdateSessionTranscription).toHaveBeenCalledWith(sessionId, 'Final transcription text');
      expect(WebSocketCommunicator.sendTranscriptionResult).toHaveBeenCalledWith(mockWs, {
        text: 'Final transcription text', // Expectation should now pass
        isFinal: true,
        languageCode: language
      });
      expect(mockDeleteSession).toHaveBeenCalledWith(sessionId);
    });

    it('should do nothing if session to finalize does not exist', async () => {
      const mockWs = createMockWebSocketClient({ readyState: 1 });
      const sessionId = 'non-existent-session';
      mockGetSession.mockReturnValue(undefined);

      await streamingModule.finalizeStreamingSession(mockWs as any, sessionId);

      expect(mockTranscribeAudio).not.toHaveBeenCalled();
      const { WebSocketCommunicator } = await import('../../server/services/transcription/AudioTranscriptionService');
      expect(WebSocketCommunicator.sendTranscriptionResult).not.toHaveBeenCalled();
      expect(mockDeleteSession).not.toHaveBeenCalled();
    });
  });

  // TODO: Add tests for cleanupInactiveStreamingSessions
});
