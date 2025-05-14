/**
 * Simplified OpenAI Streaming module tests
 * This focuses on core functionality with a simpler mocking approach
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';

// Mock transcription create function
const mockTranscribe = vi.fn().mockResolvedValue({
  text: 'Mock transcription'
});

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: mockTranscribe
        }
      }
    }))
  };
});

// Mock WebSocket
class MockWebSocket {
  readyState = WebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();
}

// Track sent messages
let sentMessages: any[] = [];

// Create simple file system mock
vi.mock('fs/promises', () => {
  return {
    writeFile: vi.fn().mockResolvedValue(undefined),
    readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
    access: vi.fn().mockRejectedValue(new Error('File not found')),
    mkdir: vi.fn().mockResolvedValue(undefined)
  };
});

// Set API key
vi.stubEnv('OPENAI_API_KEY', 'mock-api-key');

describe('OpenAI Streaming Module', () => {
  let streamingModule: any;
  let mockWs: MockWebSocket;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    sentMessages = [];
    
    // Import the module
    streamingModule = await import('../../server/openai-streaming');
    
    // Create mock WebSocket
    mockWs = new MockWebSocket();
    mockWs.send.mockImplementation((data) => {
      sentMessages.push(JSON.parse(data));
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  describe('Session Management', () => {
    it('should create and manage streaming sessions', () => {
      const sessionManager = streamingModule.sessionManager;
      
      // Create a session
      const sessionId = 'test-session-1';
      const language = 'en-US';
      const buffer = Buffer.from('test audio');
      
      const session = sessionManager.createSession(sessionId, language, buffer);
      
      // Verify session properties
      expect(session.sessionId).toBe(sessionId);
      expect(session.language).toBe(language);
      expect(session.audioBuffer[0]).toEqual(buffer);
      
      // Retrieve the session
      const retrievedSession = sessionManager.getSession(sessionId);
      expect(retrievedSession).toBe(session);
      
      // Add audio to session
      const additionalBuffer = Buffer.from('more audio');
      sessionManager.addAudioToSession(sessionId, additionalBuffer);
      
      // Verify audio was added
      expect(session.audioBuffer.length).toBe(2);
      expect(session.audioBuffer[1]).toEqual(additionalBuffer);
      
      // Delete the session
      const deleteResult = sessionManager.deleteSession(sessionId);
      expect(deleteResult).toBe(true);
      
      // Verify session is gone
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should clean up inactive sessions', () => {
      const sessionManager = streamingModule.sessionManager;
      
      // Create two sessions with different activity times
      const session1 = sessionManager.createSession('old-session', 'en-US', Buffer.from('old'));
      const session2 = sessionManager.createSession('new-session', 'fr-FR', Buffer.from('new'));
      
      // Make first session older
      session1.lastChunkTime = Date.now() - 30000; // 30 seconds ago
      
      // Clean up sessions older than 20 seconds
      sessionManager.cleanupInactiveSessions(20000);
      
      // Verify old session was removed
      expect(sessionManager.getSession('old-session')).toBeUndefined();
      
      // Verify new session remains
      expect(sessionManager.getSession('new-session')).toBeDefined();
    });
  });
  
  describe('WebSocket Communication', () => {
    it('should send transcription results', () => {
      const result = {
        text: 'Test transcription',
        isFinal: true,
        languageCode: 'en-US',
        confidence: 0.9
      };
      
      // Send the result
      streamingModule.WebSocketCommunicator.sendTranscriptionResult(
        mockWs, 
        result,
        'test-session'
      );
      
      // Verify message was sent
      expect(mockWs.send).toHaveBeenCalled();
      
      // Check message content
      expect(sentMessages[0].type).toBe('transcription');
      expect(sentMessages[0].sessionId).toBe('test-session');
      expect(sentMessages[0].text).toBe(result.text);
      expect(sentMessages[0].isFinal).toBe(result.isFinal);
    });
    
    it('should send error messages', () => {
      const error = new Error('Test error');
      
      // Send the error
      streamingModule.WebSocketCommunicator.sendErrorMessage(
        mockWs,
        error,
        'test-session'
      );
      
      // Verify message was sent
      expect(mockWs.send).toHaveBeenCalled();
      
      // Check message content
      expect(sentMessages[0].type).toBe('error');
      expect(sentMessages[0].sessionId).toBe('test-session');
      expect(sentMessages[0].error).toBe('Test error');
    });
  });
  
  describe('Audio Processing', () => {
    it('should process streaming audio chunks', async () => {
      // Call processStreamingAudio
      const sessionId = 'test-session-process';
      const audioBase64 = Buffer.from('test audio').toString('base64');
      const isFirstChunk = true;
      const language = 'en-US';
      
      await streamingModule.processStreamingAudio(
        mockWs,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify session was created
      const session = streamingModule.sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session.language).toBe(language);
      
      // Add another chunk and set isFirstChunk to false
      const moreAudioBase64 = Buffer.from('more audio').toString('base64');
      
      // Create a spy for the private function
      const processSpy = vi.spyOn(streamingModule, 'processAudioChunks' as any);
      
      await streamingModule.processStreamingAudio(
        mockWs,
        sessionId,
        moreAudioBase64,
        false, // Not first chunk, so processing should happen
        language
      );
      
      // Verify processing was attempted
      expect(processSpy).toHaveBeenCalled();
    });
    
    it('should finalize streaming sessions', async () => {
      // Create a session
      const sessionId = 'test-session-finalize';
      const language = 'en-US';
      const buffer = Buffer.from('test audio');
      
      const sessionManager = streamingModule.sessionManager;
      const session = sessionManager.createSession(sessionId, language, buffer);
      
      // Mock the transcription result
      mockTranscribe.mockResolvedValueOnce({
        text: 'Final transcription'
      });
      
      // Finalize the session
      await streamingModule.finalizeStreamingSession(mockWs, sessionId);
      
      // Verify transcription was sent
      expect(sentMessages.length).toBeGreaterThan(0);
      expect(sentMessages[0].type).toBe('transcription');
      expect(sentMessages[0].isFinal).toBe(true);
      
      // Verify session was deleted
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should handle errors when finalizing non-existent sessions', async () => {
      // Try to finalize a non-existent session
      const nonExistentSessionId = 'non-existent-session';
      
      // Set up spy on error message sending
      const errorSpy = vi.spyOn(streamingModule.WebSocketCommunicator, 'sendErrorMessage');
      
      // Finalize the non-existent session
      await streamingModule.finalizeStreamingSession(mockWs, nonExistentSessionId);
      
      // Verify error was sent
      expect(errorSpy).toHaveBeenCalled();
      expect(errorSpy.mock.calls[0][1].message).toContain('Session not found');
    });
  });
  
  describe('Cleanup', () => {
    it('should clean up inactive sessions', () => {
      // Create a session
      const sessionId = 'test-session-cleanup';
      const language = 'en-US';
      const buffer = Buffer.from('test audio');
      
      const sessionManager = streamingModule.sessionManager;
      const session = sessionManager.createSession(sessionId, language, buffer);
      
      // Set the session to be old
      session.lastChunkTime = Date.now() - 60000; // 60 seconds ago
      
      // Run cleanup with 30 second threshold
      streamingModule.cleanupInactiveStreamingSessions(30000);
      
      // Verify session was deleted
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
  });
});