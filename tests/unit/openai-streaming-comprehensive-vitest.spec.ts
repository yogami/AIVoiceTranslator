/**
 * Comprehensive OpenAI Streaming Tests - Vitest Version
 * 
 * This file contains comprehensive tests for the OpenAI streaming functionality
 * using Vitest instead of Jest for better ESM compatibility.
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { WebSocket } from 'ws';
import type { ExtendedWebSocket } from '../../server/websocket';
import { 
  sessionManager, 
  processStreamingAudio, 
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions 
} from '../../server/openai-streaming';
import OpenAI from 'openai';

// Make sure environment variables are set for testing
beforeAll(() => {
  // Set API key for testing
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-api-key';
  
  // Log API key status without revealing the key
  console.log(`OpenAI Streaming - API key status: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);
});

// Create a mock OpenAI client
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({ text: 'This is a transcription' })
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
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  
  // Allow simulating closed state
  simulateClosed() {
    this.readyState = WebSocket.CLOSED;
  }
}

describe('OpenAI Streaming Module Comprehensive Tests', () => {
  // Clean up before each test
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up sessions after each test
    for (const sessionId of sessionManager.getSessions()) {
      sessionManager.deleteSession(sessionId);
    }
  });

  describe('Session Management', () => {
    it('should create and retrieve sessions', () => {
      // Create session
      const ws = new MockWebSocket();
      const sessionId = 'test-session-123';
      const language = 'en-US';
      
      const session = sessionManager.createSession(sessionId, language, ws as unknown as ExtendedWebSocket);
      
      // Verify session creation
      expect(session).toBeDefined();
      expect(session.id).toBe(sessionId);
      expect(session.language).toBe(language);
      expect(session.ws).toBe(ws);
      
      // Verify session retrieval
      const retrievedSession = sessionManager.getSession(sessionId);
      expect(retrievedSession).toBe(session);
      
      // Verify session listing
      const sessions = sessionManager.getSessions();
      expect(sessions).toContain(sessionId);
    });
    
    it('should delete sessions', () => {
      // Create session
      const ws = new MockWebSocket();
      const sessionId = 'delete-test-session';
      const language = 'en-US';
      
      sessionManager.createSession(sessionId, language, ws as unknown as ExtendedWebSocket);
      
      // Verify session exists
      expect(sessionManager.getSession(sessionId)).toBeDefined();
      
      // Delete session
      sessionManager.deleteSession(sessionId);
      
      // Verify session is deleted
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should update session timestamps on access', () => {
      // Create session
      const ws = new MockWebSocket();
      const sessionId = 'timestamp-test-session';
      const language = 'en-US';
      
      const session = sessionManager.createSession(sessionId, language, ws as unknown as ExtendedWebSocket);
      const initialTimestamp = session.lastActive;
      
      // Short delay to ensure timestamp would change
      vi.advanceTimersByTime(100);
      
      // Access session to update timestamp
      sessionManager.getSession(sessionId);
      
      // Timestamp should be updated
      expect(session.lastActive).not.toBe(initialTimestamp);
    });
    
    it('should handle non-existent sessions', () => {
      // Try to get non-existent session
      const nonExistentSession = sessionManager.getSession('non-existent-session');
      
      // Should return undefined
      expect(nonExistentSession).toBeUndefined();
      
      // Try to delete non-existent session (should not throw)
      expect(() => {
        sessionManager.deleteSession('non-existent-session');
      }).not.toThrow();
    });
  });
  
  describe('Audio Processing', () => {
    it('should process streaming audio chunks', async () => {
      // Create session
      const ws = new MockWebSocket();
      const sessionId = 'audio-test-session';
      const language = 'en-US';
      
      sessionManager.createSession(sessionId, language, ws as unknown as ExtendedWebSocket);
      
      // Mock audio data
      const audioChunk = Buffer.from('test audio data');
      
      // Process streaming audio
      await processStreamingAudio(sessionId, audioChunk);
      
      // Verify OpenAI was called - this is indirectly checked through
      // the fact that the mock OpenAI client's transcription create function
      // is called during processing
      const openaiInstance = new OpenAI();
      expect(openaiInstance.audio.transcriptions.create).toHaveBeenCalled();
      
      // Final audio should be processed and message sent to WebSocket
      expect(ws.send).toHaveBeenCalled();
    });
    
    it('should handle errors during audio processing', async () => {
      // Create session
      const ws = new MockWebSocket();
      const sessionId = 'error-test-session';
      const language = 'en-US';
      
      sessionManager.createSession(sessionId, language, ws as unknown as ExtendedWebSocket);
      
      // Mock OpenAI to throw error for this test
      const openaiInstance = new OpenAI();
      openaiInstance.audio.transcriptions.create = vi.fn().mockRejectedValueOnce(
        new Error('Transcription failed')
      );
      
      // Mock console.error to prevent output during test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Process with invalid audio that will cause error
      await processStreamingAudio(sessionId, Buffer.from([]));
      
      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Error processing streaming audio');
      
      // Clean up
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle non-existent sessions during audio processing', async () => {
      // Mock console.error to prevent output during test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Process audio for non-existent session
      await processStreamingAudio('non-existent-session', Buffer.from('test audio'));
      
      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Session not found');
      
      // Clean up
      consoleErrorSpy.mockRestore();
    });
  });
  
  describe('Session Finalization', () => {
    it('should finalize streaming sessions', async () => {
      // Create session
      const ws = new MockWebSocket();
      const sessionId = 'finalize-test-session';
      const language = 'en-US';
      
      sessionManager.createSession(sessionId, language, ws as unknown as ExtendedWebSocket);
      
      // Finalize session
      await finalizeStreamingSession(sessionId);
      
      // WebSocket should receive final message
      expect(ws.send).toHaveBeenCalled();
      
      // Message should be JSON with type 'transcription_complete'
      const lastCall = ws.send.mock.calls[ws.send.mock.calls.length - 1][0];
      const parsedMessage = JSON.parse(lastCall);
      expect(parsedMessage.type).toBe('transcription_complete');
    });
    
    it('should handle non-existent sessions during finalization', async () => {
      // Mock console.error to prevent output during test
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Finalize non-existent session
      await finalizeStreamingSession('non-existent-session');
      
      // Error should be logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toContain('Session not found');
      
      // Clean up
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle closed WebSockets during finalization', async () => {
      // Create session
      const ws = new MockWebSocket();
      const sessionId = 'closed-ws-test-session';
      const language = 'en-US';
      
      sessionManager.createSession(sessionId, language, ws as unknown as ExtendedWebSocket);
      
      // Simulate closed WebSocket
      ws.readyState = WebSocket.CLOSED;
      
      // Finalize session
      await finalizeStreamingSession(sessionId);
      
      // WebSocket send should not be called for closed connection
      expect(ws.send).not.toHaveBeenCalled();
    });
  });
  
  describe('Session Cleanup', () => {
    it('should clean up inactive sessions', () => {
      // Create two sessions - one old, one new
      const ws1 = new MockWebSocket();
      const ws2 = new MockWebSocket();
      
      const oldSessionId = 'old-cleanup-session';
      const newSessionId = 'new-cleanup-session';
      
      // Create sessions
      const oldSession = sessionManager.createSession(oldSessionId, 'en-US', ws1 as unknown as ExtendedWebSocket);
      sessionManager.createSession(newSessionId, 'en-US', ws2 as unknown as ExtendedWebSocket);
      
      // Manually set old session timestamp to be old
      oldSession.lastActive = Date.now() - 3600000; // 1 hour ago
      
      // Run cleanup with 30-minute (1800000ms) threshold
      cleanupInactiveStreamingSessions(1800000);
      
      // Old session should be removed
      expect(sessionManager.getSession(oldSessionId)).toBeUndefined();
      
      // New session should remain
      expect(sessionManager.getSession(newSessionId)).toBeDefined();
    });
    
    it('should not clean up active sessions', () => {
      // Create an active session
      const ws = new MockWebSocket();
      const sessionId = 'active-session';
      
      sessionManager.createSession(sessionId, 'en-US', ws as unknown as ExtendedWebSocket);
      
      // Run cleanup
      cleanupInactiveStreamingSessions();
      
      // Session should still exist
      expect(sessionManager.getSession(sessionId)).toBeDefined();
    });
  });
  
  describe('WebSocket Handling', () => {
    it('should handle WebSocket errors during message sending', () => {
      // Create session with a WebSocket that throws on send
      const ws = {
        readyState: WebSocket.OPEN,
        send: vi.fn().mockImplementation(() => {
          throw new Error('WebSocket send error');
        }),
        close: vi.fn()
      };
      
      const sessionId = 'error-websocket-session';
      
      sessionManager.createSession(sessionId, 'en-US', ws as unknown as ExtendedWebSocket);
      
      // Mock console.error
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      // Attempt to finalize (which calls send)
      finalizeStreamingSession(sessionId);
      
      // Error should be caught and logged
      expect(consoleErrorSpy).toHaveBeenCalled();
      
      // Clean up
      consoleErrorSpy.mockRestore();
    });
  });
});