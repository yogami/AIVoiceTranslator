/**
 * Unit Tests for StreamingAudioProcessor
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Updated import path to match where these functions are actually implemented with parameters
import { processStreamingAudio, finalizeStreamingSession, cleanupInactiveStreamingSessions } from '../../../server/services/processors/StreamingAudioProcessor';
import { sessionManager } from '../../../server/services/managers/AudioSessionManager';
import { audioTranscriptionService, WebSocketCommunicator } from '../../../server/services/transcription/AudioTranscriptionService';
import WebSocket from 'ws';
import { WebSocketState } from '../../../server/websocket';
import { createMockWebSocketClient, createMockAudioBuffer } from '../utils/test-helpers';

describe('StreamingAudioProcessor', () => {
  let mockWs: WebSocket;
  let mockSession: any;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a mock WebSocket using our helper
    mockWs = createMockWebSocketClient({
      readyState: WebSocketState.OPEN
    }) as unknown as WebSocket;
    
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
      await processStreamingAudio(mockWs, 'test-session-1', 'dGVzdCBhdWRpbw==', true, 'en-US');
      
      // Should create a new session
      expect(sessionManager.createSession).toHaveBeenCalledWith(
        'test-session-1',
        'en-US',
        expect.any(Buffer)
      );
    });
    
    it('should add to existing session for subsequent chunks', async () => {
      await processStreamingAudio(mockWs, 'test-session-1', 'dGVzdCBhdWRpbw==', false, 'en-US');
      
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
      
      await processStreamingAudio(mockWs, 'test-session-1', 'invalid-base64', true, 'en-US');
      
      // Should send error message
      expect(WebSocketCommunicator.sendErrorMessage).toHaveBeenCalled();
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
      const combinedBuffer = createMockAudioBuffer(3000); // Create a buffer large enough to process
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
    
    it('should handle missing session gracefully', async () => {
      // Mock getSession to return undefined (no session found)
      vi.spyOn(sessionManager, 'getSession').mockReturnValueOnce(undefined);
      
      // Call finalize - should not throw
      await finalizeStreamingSession(mockWs, 'test-session-1');
      
      // Should not try to process or delete a non-existent session
      expect(audioTranscriptionService.transcribeAudio).not.toHaveBeenCalled();
      expect(sessionManager.deleteSession).not.toHaveBeenCalled();
    });
    
    it('should log errors during session finalization', async () => {
      // Force an error during session deletion
      vi.spyOn(sessionManager, 'deleteSession').mockImplementationOnce(() => {
        throw new Error('Delete session error');
      });
      
      // Make sure console.error is called
      const consoleErrorSpy = vi.spyOn(console, 'error');
      
      // Finalize session - should handle the error
      await finalizeStreamingSession(mockWs, 'test-session-1');
      
      // Should log the error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Error finalizing session'),
        expect.any(Error)
      );
    });
  });
  
  describe('cleanupInactiveStreamingSessions', () => {
    it('should call sessionManager.cleanupInactiveSessions', () => {
      cleanupInactiveStreamingSessions();
      
      // Should call cleanup
      expect(sessionManager.cleanupInactiveSessions).toHaveBeenCalledWith(30000);
    });
  });
});