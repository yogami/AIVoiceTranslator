/**
 * Unit Tests for StreamingAudioProcessor
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  processStreamingAudio,
  processAudioChunks,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions
} from '../../../server/services/StreamingAudioProcessor';
import { sessionManager } from '../../../server/services/AudioSessionManager';
import { audioTranscriptionService, WebSocketCommunicator } from '../../../server/services/AudioTranscriptionService';
import WebSocket from 'ws';
import { WebSocketState } from '../../../server/websocket';

describe('StreamingAudioProcessor', () => {
  let mockWs: WebSocket;
  let mockSession: any;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a mock WebSocket
    mockWs = {
      readyState: WebSocketState.OPEN,
      send: vi.fn()
    } as unknown as WebSocket;
    
    // Create a mock session
    mockSession = {
      sessionId: 'test-session-1',
      language: 'en-US',
      audioBuffer: [Buffer.from('test')],
      transcriptionText: '',
      transcriptionInProgress: false
    };
    
    // Mock the sessionManager methods
    vi.spyOn(sessionManager, 'createSession').mockImplementation(() => mockSession);
    vi.spyOn(sessionManager, 'getSession').mockImplementation(() => mockSession);
    vi.spyOn(sessionManager, 'addAudioToSession').mockImplementation(() => {});
    vi.spyOn(sessionManager, 'updateSessionTranscription').mockImplementation(() => {});
    vi.spyOn(sessionManager, 'setTranscriptionInProgress').mockImplementation(() => {});
    vi.spyOn(sessionManager, 'clearSessionAudioBuffer').mockImplementation(() => {});
    vi.spyOn(sessionManager, 'replaceSessionAudioBuffer').mockImplementation(() => {});
    vi.spyOn(sessionManager, 'deleteSession').mockImplementation(() => true);
    vi.spyOn(sessionManager, 'cleanupInactiveSessions').mockImplementation(() => {});
    
    // Mock the audioTranscriptionService methods
    vi.spyOn(audioTranscriptionService, 'transcribeAudio').mockResolvedValue('Test transcription');
    
    // Mock the WebSocketCommunicator methods
    vi.spyOn(WebSocketCommunicator, 'sendTranscriptionResult').mockImplementation(() => {});
    vi.spyOn(WebSocketCommunicator, 'sendErrorMessage').mockImplementation(() => {});
    
    // Spy on console logs
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock Buffer.concat
    vi.spyOn(Buffer, 'concat').mockImplementation((buffers) => {
      return Buffer.from('combined');
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('processStreamingAudio', () => {
    it('should create a new session for first chunk', async () => {
      await processStreamingAudio(
        mockWs,
        'test-session-1',
        'dGVzdA==', // "test" in base64
        true, // isFirstChunk
        'en-US'
      );
      
      // Should create a new session
      expect(sessionManager.createSession).toHaveBeenCalledWith(
        'test-session-1',
        'en-US',
        expect.any(Buffer)
      );
    });
    
    it('should add to existing session for subsequent chunks', async () => {
      await processStreamingAudio(
        mockWs,
        'test-session-1',
        'dGVzdA==', // "test" in base64
        false, // not first chunk
        'en-US'
      );
      
      // Should add to existing session
      expect(sessionManager.addAudioToSession).toHaveBeenCalledWith(
        'test-session-1',
        expect.any(Buffer)
      );
    });
    
    it('should handle errors gracefully', async () => {
      // Force an error
      vi.spyOn(Buffer, 'from').mockImplementationOnce(() => {
        throw new Error('Test error');
      });
      
      await processStreamingAudio(
        mockWs,
        'test-session-1',
        '%', // This would cause an error with invalid base64
        true,
        'en-US'
      );
      
      // Should send error message
      expect(WebSocketCommunicator.sendErrorMessage).toHaveBeenCalled();
    });
  });
  
  describe('processAudioChunks', () => {
    it('should process audio chunks and send transcription results', async () => {
      // Set up mocks for a successful test
      mockSession.audioBuffer = [Buffer.from('test')];
      const combinedBuffer = Buffer.from(new Array(3000).fill(0)); // Create a buffer large enough to process
      vi.spyOn(Buffer, 'concat').mockReturnValueOnce(combinedBuffer);
      
      // Direct call to the function
      await processAudioChunks(mockWs, 'test-session-1');
      
      // Verify transcription was attempted
      expect(audioTranscriptionService.transcribeAudio).toHaveBeenCalled();
      
      // Verify results were sent back
      expect(WebSocketCommunicator.sendTranscriptionResult).toHaveBeenCalledWith(
        mockWs,
        expect.objectContaining({
          text: 'Test transcription',
          isFinal: false,
          languageCode: 'en-US'
        })
      );
    });
    
    it('should handle transcription errors gracefully', async () => {
      // Set up mocks for an error test
      mockSession.audioBuffer = [Buffer.from('test')];
      const combinedBuffer = Buffer.from(new Array(3000).fill(0)); // Create a buffer large enough to process
      vi.spyOn(Buffer, 'concat').mockReturnValueOnce(combinedBuffer);
      
      // Force a transcription error
      vi.spyOn(audioTranscriptionService, 'transcribeAudio').mockRejectedValueOnce(new Error('Transcription error'));
      
      // Process chunks
      await processAudioChunks(mockWs, 'test-session-1');
      
      // Verify error was handled and error message sent
      expect(WebSocketCommunicator.sendErrorMessage).toHaveBeenCalledWith(
        mockWs,
        expect.any(String),
        'transcription_error'
      );
      
      // Verify processing state was reset
      expect(sessionManager.setTranscriptionInProgress).toHaveBeenCalledWith(
        'test-session-1',
        false
      );
    });
    
    it('should skip processing if buffer is too small', async () => {
      // Create a small buffer
      const smallBuffer = Buffer.alloc(100);
      
      // Mock Buffer.concat to return a small buffer
      vi.spyOn(Buffer, 'concat').mockReturnValueOnce(smallBuffer);
      
      // Process chunks
      await processAudioChunks(mockWs, 'test-session-1');
      
      // Should not call transcribeAudio
      expect(audioTranscriptionService.transcribeAudio).not.toHaveBeenCalled();
      
      // Should still reset processing state
      expect(sessionManager.setTranscriptionInProgress).toHaveBeenCalledWith(
        'test-session-1',
        false
      );
    });
  });
  
  describe('finalizeStreamingSession', () => {
    it('should finalize a session and send final transcription', async () => {
      // Set up session mock
      mockSession.transcriptionText = 'Final transcription';
      
      // Finalize session
      await finalizeStreamingSession(mockWs, 'test-session-1');
      
      // Should send final transcription
      expect(WebSocketCommunicator.sendTranscriptionResult).toHaveBeenCalledWith(
        mockWs,
        {
          text: 'Final transcription',
          isFinal: true,
          languageCode: 'en-US'
        }
      );
      
      // Should delete the session
      expect(sessionManager.deleteSession).toHaveBeenCalledWith('test-session-1');
    });
    
    it('should process remaining audio before finalizing', async () => {
      // Set up mocks for the finalization test
      mockSession.audioBuffer = [Buffer.from('test')];
      const combinedBuffer = Buffer.from(new Array(3000).fill(0)); // Create a buffer large enough to process
      vi.spyOn(Buffer, 'concat').mockReturnValueOnce(combinedBuffer);
      
      // Finalize the session
      await finalizeStreamingSession(mockWs, 'test-session-1');
      
      // Verify transcription was attempted (the finalize method calls processAudioChunks)
      expect(audioTranscriptionService.transcribeAudio).toHaveBeenCalledWith(
        expect.any(Buffer),
        mockSession.language
      );
      
      // Should delete the session after processing
      expect(sessionManager.deleteSession).toHaveBeenCalledWith('test-session-1');
    });
    
    it('should handle errors gracefully', async () => {
      // Force a processing error
      vi.spyOn(audioTranscriptionService, 'transcribeAudio').mockRejectedValueOnce(new Error('Processing error'));
      
      // Set up session mock with audio buffer
      mockSession.audioBuffer = [Buffer.from('test')];
      
      // Finalize session - should not throw
      await finalizeStreamingSession(mockWs, 'test-session-1');
      
      // Should still attempt to send transcription and delete session
      expect(WebSocketCommunicator.sendTranscriptionResult).toHaveBeenCalled();
      expect(sessionManager.deleteSession).toHaveBeenCalledWith('test-session-1');
    });
  });
  
  describe('cleanupInactiveStreamingSessions', () => {
    it('should call sessionManager.cleanupInactiveSessions', () => {
      cleanupInactiveStreamingSessions(30000);
      
      // Should call cleanup
      expect(sessionManager.cleanupInactiveSessions).toHaveBeenCalledWith(30000);
    });
  });
});