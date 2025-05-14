/**
 * Comprehensive tests for OpenAI Streaming Audio Processing
 * Version 2 with improved coverage of all classes and functions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';

// Create reusable mock for audio.transcriptions.create
const mockTranscriptionCreate = vi.fn().mockResolvedValue({
  text: 'Mock transcribed text',
});

// Mock OpenAI
vi.mock('openai', async () => {
  const MockOpenAI = vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: mockTranscriptionCreate
      },
    },
  }));
  
  return {
    default: MockOpenAI
  };
});

// Mock file system
vi.mock('fs/promises', () => ({
  writeFile: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue(Buffer.from('mock file content')),
  access: vi.fn().mockImplementation(() => Promise.reject(new Error('File not found'))),
  mkdir: vi.fn().mockResolvedValue(undefined)
}));

// Mock WebSocket for easier testing
class MockWebSocket {
  readyState = WebSocket.OPEN;
  send = vi.fn();
  close = vi.fn();
}

// Set environment variable for testing
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

describe('OpenAI Streaming Audio Processing Comprehensive V2', () => {
  let streamingModule: any;
  let mockWebSocket: any;
  let sentMessages: any[] = [];
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the OpenAI streaming module
    streamingModule = await import('../../server/openai-streaming');
    
    // Create a mock WebSocket
    mockWebSocket = new MockWebSocket();
    mockWebSocket.send.mockImplementation((data) => {
      sentMessages.push(JSON.parse(data));
    });
  });
  
  afterEach(() => {
    sentMessages = [];
    vi.restoreAllMocks();
  });
  
  describe('OpenAIClientFactory', () => {
    it('should create an OpenAI client instance', async () => {
      // Get instance
      const clientFactory = streamingModule.OpenAIClientFactory;
      const client = clientFactory.getInstance();
      
      // Should return a client
      expect(client).toBeDefined();
      
      // Should be a singleton
      const client2 = clientFactory.getInstance();
      expect(client2).toBe(client);
      
      // OpenAI constructor should be called once
      const openai = await import('openai');
      expect(openai.default).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('SessionManager', () => {
    it('should create and retrieve sessions', () => {
      const sessionManager = new streamingModule.SessionManager();
      
      // Create a new session
      const sessionId = 'test-session-1';
      const language = 'en-US';
      const initialBuffer = Buffer.from('initial audio');
      
      const session = sessionManager.createSession(sessionId, language, initialBuffer);
      
      // Verify session properties
      expect(session).toHaveProperty('sessionId', sessionId);
      expect(session).toHaveProperty('language', language);
      expect(session).toHaveProperty('audioBuffer');
      expect(session.audioBuffer).toContain(initialBuffer);
      
      // Retrieve the session
      const retrievedSession = sessionManager.getSession(sessionId);
      expect(retrievedSession).toBe(session);
    });
    
    it('should add audio data to existing sessions', () => {
      const sessionManager = new streamingModule.SessionManager();
      
      // Create a new session
      const sessionId = 'test-session-2';
      const language = 'fr-FR';
      const initialBuffer = Buffer.from('initial audio');
      
      sessionManager.createSession(sessionId, language, initialBuffer);
      
      // Add audio data
      const additionalBuffer = Buffer.from('additional audio');
      sessionManager.addAudioToSession(sessionId, additionalBuffer);
      
      // Verify the audio buffer was updated
      const session = sessionManager.getSession(sessionId);
      expect(session.audioBuffer).toHaveLength(2);
      expect(session.audioBuffer[1]).toBe(additionalBuffer);
    });
    
    it('should delete sessions', () => {
      const sessionManager = new streamingModule.SessionManager();
      
      // Create a new session
      const sessionId = 'test-session-3';
      const language = 'es-ES';
      const initialBuffer = Buffer.from('initial audio');
      
      sessionManager.createSession(sessionId, language, initialBuffer);
      
      // Delete the session
      const result = sessionManager.deleteSession(sessionId);
      expect(result).toBe(true);
      
      // Verify the session was deleted
      const retrievedSession = sessionManager.getSession(sessionId);
      expect(retrievedSession).toBeUndefined();
    });
    
    it('should clean up inactive sessions', () => {
      const sessionManager = new streamingModule.SessionManager();
      
      // Create two sessions with different timestamps
      const sessionId1 = 'test-session-4';
      const sessionId2 = 'test-session-5';
      const language = 'de-DE';
      const initialBuffer = Buffer.from('initial audio');
      
      const session1 = sessionManager.createSession(sessionId1, language, initialBuffer);
      const session2 = sessionManager.createSession(sessionId2, language, initialBuffer);
      
      // Set the last chunk time for the first session to be older
      session1.lastChunkTime = Date.now() - 10000; // 10 seconds ago
      
      // Clean up sessions older than 5 seconds
      sessionManager.cleanupInactiveSessions(5000);
      
      // Verify the first session was deleted
      const retrievedSession1 = sessionManager.getSession(sessionId1);
      expect(retrievedSession1).toBeUndefined();
      
      // Verify the second session still exists
      const retrievedSession2 = sessionManager.getSession(sessionId2);
      expect(retrievedSession2).toBeDefined();
    });
    
    it('should get all sessions', () => {
      const sessionManager = new streamingModule.SessionManager();
      
      // Create multiple sessions
      sessionManager.createSession('session-1', 'en-US', Buffer.from('audio 1'));
      sessionManager.createSession('session-2', 'fr-FR', Buffer.from('audio 2'));
      sessionManager.createSession('session-3', 'es-ES', Buffer.from('audio 3'));
      
      // Get all sessions
      const sessions = sessionManager.getAllSessions();
      
      // Verify the number of sessions
      expect(sessions.size).toBe(3);
      
      // Verify the session IDs
      expect(sessions.has('session-1')).toBe(true);
      expect(sessions.has('session-2')).toBe(true);
      expect(sessions.has('session-3')).toBe(true);
    });
  });
  
  describe('WebSocketCommunicator', () => {
    it('should send transcription results over WebSocket', () => {
      const result = {
        text: 'Transcription result',
        isFinal: true,
        languageCode: 'en-US',
        confidence: 0.95
      };
      
      // Send the result
      streamingModule.WebSocketCommunicator.sendTranscriptionResult(
        mockWebSocket,
        result,
        'test-session'
      );
      
      // Verify the message was sent
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(sentMessages[0].type).toBe('transcription');
      expect(sentMessages[0].sessionId).toBe('test-session');
      expect(sentMessages[0].text).toBe(result.text);
      expect(sentMessages[0].isFinal).toBe(result.isFinal);
      expect(sentMessages[0].languageCode).toBe(result.languageCode);
      expect(sentMessages[0].confidence).toBe(result.confidence);
    });
    
    it('should send error messages over WebSocket', () => {
      const error = new Error('Test error');
      
      // Send the error
      streamingModule.WebSocketCommunicator.sendErrorMessage(
        mockWebSocket,
        error,
        'test-session'
      );
      
      // Verify the message was sent
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(sentMessages[0].type).toBe('error');
      expect(sentMessages[0].sessionId).toBe('test-session');
      expect(sentMessages[0].error).toBe('Test error');
    });
  });
  
  describe('AudioProcessingService', () => {
    it('should transcribe audio using OpenAI', async () => {
      const audioProcessingService = new streamingModule.AudioProcessingService();
      
      // Transcribe audio
      const audioBuffer = Buffer.from('test audio data');
      const language = 'en-US';
      
      const result = await audioProcessingService.transcribeAudio(audioBuffer, language);
      
      // Verify the result
      expect(result).toBe('Mock transcribed text');
      
      // Verify the mock was called
      expect(mockTranscriptionCreate).toHaveBeenCalled();
      
      // Verify the correct parameters were passed
      const callArgs = mockTranscriptionCreate.mock.calls[0][0];
      expect(callArgs).toHaveProperty('file');
      expect(callArgs.model).toBe('whisper-1');
      expect(callArgs.language).toBe('en');
    });
    
    it('should handle transcription errors gracefully', async () => {
      const audioProcessingService = new streamingModule.AudioProcessingService();
      
      // Mock OpenAI to throw an error
      mockTranscriptionCreate.mockRejectedValueOnce(new Error('API error'));
      
      // Transcribe audio
      const audioBuffer = Buffer.from('test audio data');
      const language = 'en-US';
      
      // Should return empty string on error
      const result = await audioProcessingService.transcribeAudio(audioBuffer, language);
      expect(result).toBe('');
    });
  });
  
  describe('processStreamingAudio function', () => {
    it('should handle first chunk of streaming audio', async () => {
      // Call the function
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const isFirstChunk = true;
      const language = 'en-US';
      
      await streamingModule.processStreamingAudio(
        mockWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify a session was created
      const sessionManager = streamingModule.sessionManager;
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session.language).toBe(language);
      
      // Verify no transcription was sent yet (it's processed in separate function)
      expect(sentMessages.length).toBe(0);
    });
    
    it('should handle subsequent chunks of streaming audio', async () => {
      // Set up a session first
      const sessionId = 'test-session-456';
      const language = 'es-ES';
      const initialBuffer = Buffer.from('initial audio');
      
      const sessionManager = streamingModule.sessionManager;
      sessionManager.createSession(sessionId, language, initialBuffer);
      
      // Call the function with a subsequent chunk
      const audioBase64 = Buffer.from('more audio data').toString('base64');
      const isFirstChunk = false;
      
      await streamingModule.processStreamingAudio(
        mockWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify the audio was added to the session
      const session = sessionManager.getSession(sessionId);
      expect(session.audioBuffer.length).toBeGreaterThan(1);
    });
    
    it('should handle empty or invalid audio data', async () => {
      // Call the function with empty audio
      const sessionId = 'test-session-789';
      const audioBase64 = '';
      const isFirstChunk = true;
      const language = 'de-DE';
      
      await streamingModule.processStreamingAudio(
        mockWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify a session was created but no error
      const sessionManager = streamingModule.sessionManager;
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
    });
    
    it('should handle missing session ID', async () => {
      // Call the function with empty session ID
      const sessionId = '';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const isFirstChunk = true;
      const language = 'en-US';
      
      await streamingModule.processStreamingAudio(
        mockWebSocket,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Should still create a session with empty ID
      const sessionManager = streamingModule.sessionManager;
      const session = sessionManager.getSession('');
      expect(session).toBeDefined();
    });
  });
  
  describe('processAudioChunks function', () => {
    // This is a private function, we'll expose it for testing
    let processAudioChunks: any;
    
    beforeEach(() => {
      // Get the private function from the module
      processAudioChunks = vi.spyOn(streamingModule, 'processAudioChunks' as any);
      
      // Mock the AudioProcessingService to avoid actual OpenAI calls
      vi.spyOn(streamingModule.AudioProcessingService.prototype, 'transcribeAudio')
        .mockResolvedValue('Mock transcribed text');
    });
    
    it('should be called when processing streaming audio', async () => {
      // Set up a session
      const sessionId = 'test-session-process';
      const language = 'en-US';
      const initialBuffer = Buffer.from('initial audio');
      
      const sessionManager = streamingModule.sessionManager;
      sessionManager.createSession(sessionId, language, initialBuffer);
      
      // Call processStreamingAudio which should trigger processAudioChunks
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      
      await streamingModule.processStreamingAudio(
        mockWebSocket,
        sessionId,
        audioBase64,
        false, // Not first chunk, should trigger processing
        language
      );
      
      // Verify processAudioChunks was called
      expect(processAudioChunks).toHaveBeenCalled();
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should finalize an existing session', async () => {
      // Create a session
      const sessionId = 'test-session-finalize';
      const language = 'fr-FR';
      const initialBuffer = Buffer.from('initial audio');
      
      const sessionManager = streamingModule.sessionManager;
      const session = sessionManager.createSession(sessionId, language, initialBuffer);
      
      // Mock the AudioProcessingService to avoid actual OpenAI calls
      vi.spyOn(streamingModule.AudioProcessingService.prototype, 'transcribeAudio')
        .mockResolvedValue('Final transcription');
      
      // Finalize the session
      await streamingModule.finalizeStreamingSession(mockWebSocket, sessionId);
      
      // Verify a transcription was sent
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(sentMessages[0].type).toBe('transcription');
      expect(sentMessages[0].isFinal).toBe(true);
      expect(sentMessages[0].text).toBe('Final transcription');
      
      // Verify the session was deleted
      const deletedSession = sessionManager.getSession(sessionId);
      expect(deletedSession).toBeUndefined();
    });
    
    it('should handle finalizing non-existent session', async () => {
      // Finalize a non-existent session
      const sessionId = 'non-existent-session';
      
      // Mock sendErrorMessage to verify it's called
      const sendErrorMessageSpy = vi.spyOn(streamingModule.WebSocketCommunicator, 'sendErrorMessage');
      
      await streamingModule.finalizeStreamingSession(mockWebSocket, sessionId);
      
      // Verify error message was sent
      expect(sendErrorMessageSpy).toHaveBeenCalled();
      expect(sendErrorMessageSpy.mock.calls[0][1].message).toContain('Session not found');
    });
    
    it('should handle missing session ID in finalization', async () => {
      // Finalize with empty session ID
      const sessionId = '';
      
      // Mock sendErrorMessage to verify it's called
      const sendErrorMessageSpy = vi.spyOn(streamingModule.WebSocketCommunicator, 'sendErrorMessage');
      
      await streamingModule.finalizeStreamingSession(mockWebSocket, sessionId);
      
      // Verify error message was sent
      expect(sendErrorMessageSpy).toHaveBeenCalled();
      expect(sendErrorMessageSpy.mock.calls[0][1].message).toContain('Session ID is required');
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should clean up inactive sessions', () => {
      // Create sessions with different timestamps
      const sessionManager = streamingModule.sessionManager;
      
      const session1 = sessionManager.createSession(
        'old-session',
        'en-US',
        Buffer.from('old audio')
      );
      
      const session2 = sessionManager.createSession(
        'recent-session',
        'fr-FR',
        Buffer.from('recent audio')
      );
      
      // Make the first session old
      session1.lastChunkTime = Date.now() - 30000; // 30 seconds ago
      
      // Call the cleanup function with 10 second threshold
      streamingModule.cleanupInactiveStreamingSessions(10000);
      
      // Verify old session was deleted and recent session was kept
      expect(sessionManager.getSession('old-session')).toBeUndefined();
      expect(sessionManager.getSession('recent-session')).toBeDefined();
    });
  });
});