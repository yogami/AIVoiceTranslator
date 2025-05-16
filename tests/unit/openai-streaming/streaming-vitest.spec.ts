/**
 * OpenAI Streaming Module Tests
 * 
 * This file contains comprehensive tests for the OpenAI Streaming module.
 * Converted from Jest to Vitest with proper mock handling.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { type WebSocket } from 'ws';
import { Buffer } from 'node:buffer';

// Import the module under test
import {
  processStreamingAudio,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions
} from '../../../server/openai-streaming';

// Mock the SessionManager functions
const sessionManagerMock = {
  createSession: vi.fn(),
  getSession: vi.fn(),
  addAudioToSession: vi.fn(),
  deleteSession: vi.fn(),
  getAllSessions: vi.fn(),
  cleanupInactiveSessions: vi.fn()
};

// Mock the AudioProcessingService
const audioProcessingServiceMock = {
  transcribeAudio: vi.fn()
};

// Create a processAudioChunks mock function for testing
const processAudioChunksMock = vi.fn().mockImplementation(async () => {
  // Default implementation
});

// Mock the module, preserving the exported functions but exposing test hooks
vi.mock('../../../server/openai-streaming', async (importOriginal) => {
  const originalModule = await importOriginal();
  
  return {
    ...originalModule,
    // Export our mock functions for internal components
    __TEST_HOOKS: {
      sessionManager: sessionManagerMock,
      audioProcessingService: audioProcessingServiceMock,
      processAudioChunks: processAudioChunksMock
    }
  };
});

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'Test transcription'
          })
        }
      }
    }))
  };
});

// Create our WebSocket mock interface
interface MockWebSocket extends WebSocket {
  lastMessage: any;
  messageHandler?: (data: any) => void;
  simulateMessage: (data: any) => void;
}

// Mock WebSocket
vi.mock('ws', () => {
  // Create a mock WebSocket class
  class MockWebSocket {
    static OPEN = 1;
    static CONNECTING = 0;
    static CLOSING = 2;
    static CLOSED = 3;
    
    send = vi.fn((data: string) => {
      try {
        this.lastMessage = JSON.parse(data);
      } catch (e) {
        this.lastMessage = data;
      }
    });
    
    on = vi.fn((event: string, handler: any) => {
      if (event === 'message') {
        this.messageHandler = handler;
      }
      return this;
    });
    
    removeListener = vi.fn();
    ping = vi.fn();
    terminate = vi.fn();
    close = vi.fn();
    readyState = MockWebSocket.OPEN;
    lastMessage: any = null;
    messageHandler?: (data: any) => void;
    
    // Helper method for tests to simulate WebSocket messages
    simulateMessage(data: any) {
      if (this.messageHandler) {
        const message = {
          data: typeof data === 'string' ? data : JSON.stringify(data)
        };
        this.messageHandler(message);
      }
    }
  }
  
  return {
    WebSocket: vi.fn(() => new MockWebSocket()),
    WebSocketServer: vi.fn(() => ({
      on: vi.fn(),
      clients: new Set()
    }))
  };
});

describe('OpenAI Streaming Module', () => {
  let mockWebSocket: MockWebSocket;
  
  beforeEach(() => {
    // Create a new mock WebSocket for each test
    mockWebSocket = new (vi.mocked(WebSocket))() as unknown as MockWebSocket;
    
    // Reset all mocks before each test
    vi.resetAllMocks();
  });
  
  afterEach(() => {
    // Clean up after each test
    vi.restoreAllMocks();
  });

  describe('processStreamingAudio function', () => {
    it('should handle empty audio data gracefully', async () => {
      // Test data
      const sessionId = 'test-session-123';
      const audioBase64 = '';
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Spy on console.error
      const consoleErrorSpy = vi.spyOn(console, 'error');
      
      // Force Buffer.from to throw an error for empty audio
      vi.spyOn(Buffer, 'from').mockImplementationOnce(() => {
        throw new Error('Empty audio data');
      });
      
      // Call the function
      await processStreamingAudio(
        mockWebSocket as any,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify error handling
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket.lastMessage).toBeDefined();
      expect(mockWebSocket.lastMessage.type).toBe('error');
    });
    
    it('should create a new session for first audio chunk', async () => {
      // Test data for first chunk
      const sessionId = 'new-session-1234';
      const audioBase64 = 'dGVzdCBhdWRpbw=='; // "test audio" in base64
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Mock createSession to return a valid session
      sessionManagerMock.createSession.mockReturnValue({
        sessionId,
        language,
        audioBuffer: [Buffer.from('test audio')],
        isProcessing: false,
        lastChunkTime: Date.now(),
        transcriptionText: '',
        transcriptionInProgress: false
      });
      
      // Call the function
      await processStreamingAudio(
        mockWebSocket as any,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify a new session was created
      expect(sessionManagerMock.createSession).toHaveBeenCalledWith(
        sessionId,
        language,
        expect.any(Buffer)
      );
    });
    
    it('should add to existing session for subsequent chunks', async () => {
      // Test data for subsequent chunk
      const sessionId = 'existing-session-5678';
      const audioBase64 = 'dGVzdCBhdWRpbw=='; // "test audio" in base64
      const isFirstChunk = false;
      const language = 'en-US';
      
      // Mock getSession to return a valid session
      sessionManagerMock.getSession.mockReturnValue({
        sessionId,
        language,
        audioBuffer: [Buffer.from('previous audio')],
        isProcessing: false,
        lastChunkTime: Date.now(),
        transcriptionText: '',
        transcriptionInProgress: false
      });
      
      // Call the function
      await processStreamingAudio(
        mockWebSocket as any,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify audio was added to existing session
      expect(sessionManagerMock.addAudioToSession).toHaveBeenCalledWith(
        sessionId,
        expect.any(Buffer)
      );
    });
    
    it('should handle error when no session exists for subsequent chunks', async () => {
      // Test data for subsequent chunk with no session
      const sessionId = 'nonexistent-session';
      const audioBase64 = 'dGVzdCBhdWRpbw=='; // "test audio" in base64
      const isFirstChunk = false;
      const language = 'en-US';
      
      // Mock getSession to return undefined (no session found)
      sessionManagerMock.getSession.mockReturnValue(undefined);
      
      // Call the function
      await processStreamingAudio(
        mockWebSocket as any,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify error handling
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket.lastMessage).toBeDefined();
      expect(mockWebSocket.lastMessage.type).toBe('error');
    });
    
    it('should handle invalid base64 data', async () => {
      // Test with invalid base64 data
      const sessionId = 'test-session-123';
      const audioBase64 = 'invalid-base64!@#'; // Invalid base64
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Force Buffer.from to throw an error for invalid base64
      vi.spyOn(Buffer, 'from').mockImplementationOnce(() => {
        throw new Error('Invalid base64');
      });
      
      // Call the function
      await processStreamingAudio(
        mockWebSocket as any,
        sessionId,
        audioBase64,
        isFirstChunk,
        language
      );
      
      // Verify error handling
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket.lastMessage).toBeDefined();
      expect(mockWebSocket.lastMessage.type).toBe('error');
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should finalize a session correctly', async () => {
      // Test session ID
      const sessionId = 'finalize-test-session';
      
      // Mock getSession to return a valid session
      sessionManagerMock.getSession.mockReturnValue({
        sessionId,
        language: 'en-US',
        audioBuffer: [Buffer.from('test audio')],
        isProcessing: false,
        lastChunkTime: Date.now(),
        transcriptionText: 'Existing transcription',
        transcriptionInProgress: false
      });
      
      // Call the function
      await finalizeStreamingSession(mockWebSocket as any, sessionId);
      
      // Verify the session was deleted
      expect(sessionManagerMock.deleteSession).toHaveBeenCalledWith(sessionId);
      
      // Verify the final message was sent
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket.lastMessage).toBeDefined();
      expect(mockWebSocket.lastMessage.type).toBe('transcription');
      expect(mockWebSocket.lastMessage.isFinal).toBe(true);
    });
    
    it('should handle non-existent session', async () => {
      // Test with non-existent session ID
      const sessionId = 'nonexistent-session';
      
      // Mock getSession to return undefined (no session found)
      sessionManagerMock.getSession.mockReturnValue(undefined);
      
      // Call the function
      await finalizeStreamingSession(mockWebSocket as any, sessionId);
      
      // Verify error handling
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockWebSocket.lastMessage).toBeDefined();
      expect(mockWebSocket.lastMessage.type).toBe('error');
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should clean up inactive sessions', () => {
      // Set up test timeout
      const timeout = 60000; // 1 minute
      
      // Call the function
      cleanupInactiveStreamingSessions(timeout);
      
      // Verify cleanup was called with the right timeout
      expect(sessionManagerMock.cleanupInactiveSessions).toHaveBeenCalledWith(timeout);
    });
  });
});