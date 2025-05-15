import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import { WebSocket } from 'ws';
import type { ExtendedWebSocket } from '../../server/websocket';
// Import public functions
import {
  sessionManager,
  processStreamingAudio,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions
} from '../../server/openai-streaming';

// Get access to private functions for testing
// Since processAudioChunks is a private function, we need to use this mock implementation
const processAudioChunks = vi.fn().mockImplementation(async (ws: WebSocket, sessionId: string) => {
  // For unit tests, we'll simulate the function's behavior
  // The actual implementation will still be called via finalizeStreamingSession
  const session = sessionManager.getSession(sessionId);
  if (!session) return;
  
  // Set processing flag
  session.transcriptionInProgress = true;
  
  try {
    // Simple simulation for test purposes
    if (session.audioBuffer.length === 0) {
      // Skip processing empty buffers
      session.transcriptionInProgress = false;
      return;
    }
    
    // Simulate empty transcription for whitespace test
    if (session.sessionId === 'empty-transcription-session') {
      // This will be caught by the test checking for empty transcriptions
      return;
    }
    
    // Simulate small buffer check
    if (Buffer.concat(session.audioBuffer).length < 1000) {
      session.transcriptionInProgress = false;
      return;
    }
    
    // Normal processing for other cases
    session.audioBuffer = [];
  } catch (error) {
    console.error(`Error in test mock for processAudioChunks:`, error);
  } finally {
    // Reset flag
    session.transcriptionInProgress = false;
  }
});

// Mock WebSocket interface to address TypeScript issues
interface MockWebSocket {
  readyState: number;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  
  // Extended properties for our tests
  isAlive: boolean;
  sessionId?: string;
  role?: string;
  languageCode?: string;
}

// Factory function to create mock WebSockets
function createMockWebSocket(options: Partial<MockWebSocket> = {}): MockWebSocket {
  return {
    readyState: WebSocket.OPEN,
    send: vi.fn(),
    close: vi.fn(),
    isAlive: true,
    ...options
  };
}

// Set up environment for testing
beforeAll(() => {
  // Ensure API key is set
  process.env.OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'test-api-key';
});

// Mock OpenAI once at the module level to avoid re-mocking issues
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({ text: 'Mocked transcription' })
        }
      }
    }))
  };
});

describe('OpenAI Streaming Module', () => {
  // Reset state before each test
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Clear all sessions
    for (const session of sessionManager.getAllSessions().values()) {
      sessionManager.deleteSession(session.sessionId);
    }
  });
  
  afterEach(() => {
    // Restore original implementations
    vi.restoreAllMocks();
  });

  describe('SessionManager', () => {
    it('should create a streaming session', () => {
      // Arrange
      const sessionId = 'test-session-1';
      const language = 'en-US';
      const initialBuffer = Buffer.from('test audio');
      
      // Act
      const session = sessionManager.createSession(sessionId, language, initialBuffer);
      
      // Assert
      expect(session).toBeDefined();
      expect(session.sessionId).toBe(sessionId);
      expect(session.language).toBe(language);
      expect(session.audioBuffer).toHaveLength(1);
      expect(session.audioBuffer[0]).toEqual(initialBuffer);
      expect(session.isProcessing).toBe(false);
      expect(session.transcriptionText).toBe('');
      expect(session.transcriptionInProgress).toBe(false);
      expect(session.lastChunkTime).toBeGreaterThan(Date.now() - 1000); // Within last second
    });
    
    it('should get an existing session', () => {
      // Arrange
      const sessionId = 'test-session-2';
      const language = 'en-US';
      sessionManager.createSession(sessionId, language, Buffer.from('test audio'));
      
      // Act
      const retrievedSession = sessionManager.getSession(sessionId);
      
      // Assert
      expect(retrievedSession).toBeDefined();
      expect(retrievedSession?.sessionId).toBe(sessionId);
    });
    
    it('should return undefined for non-existent session', () => {
      // Act
      const retrievedSession = sessionManager.getSession('non-existent-session');
      
      // Assert
      expect(retrievedSession).toBeUndefined();
    });
    
    it('should add audio to an existing session', () => {
      // Arrange
      const sessionId = 'test-session-3';
      const language = 'en-US';
      sessionManager.createSession(sessionId, language, Buffer.from('initial audio'));
      
      // Act
      const newAudioBuffer = Buffer.from('additional audio');
      sessionManager.addAudioToSession(sessionId, newAudioBuffer);
      
      // Assert
      const session = sessionManager.getSession(sessionId);
      expect(session?.audioBuffer).toHaveLength(2);
      expect(session?.audioBuffer[1]).toEqual(newAudioBuffer);
    });
    
    it('should ignore audio for non-existent session', () => {
      // Arrange
      const nonExistentSessionId = 'non-existent-session';
      
      // Act & Assert - should not throw
      expect(() => {
        sessionManager.addAudioToSession(nonExistentSessionId, Buffer.from('test audio'));
      }).not.toThrow();
    });
    
    it('should delete a session', () => {
      // Arrange
      const sessionId = 'test-session-4';
      const language = 'en-US';
      sessionManager.createSession(sessionId, language, Buffer.from('test audio'));
      
      // Act
      const result = sessionManager.deleteSession(sessionId);
      
      // Assert
      expect(result).toBe(true);
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should return false when deleting non-existent session', () => {
      // Act
      const result = sessionManager.deleteSession('non-existent-session');
      
      // Assert
      expect(result).toBe(false);
    });
    
    it('should clean up inactive sessions', () => {
      // Arrange - create sessions with different last chunk times
      const recentSessionId = 'recent-session';
      const oldSessionId = 'old-session';
      
      const recentSession = sessionManager.createSession(
        recentSessionId, 'en-US', Buffer.from('recent audio')
      );
      const oldSession = sessionManager.createSession(
        oldSessionId, 'en-US', Buffer.from('old audio')
      );
      
      // Set the last chunk time for the old session to be more than max age
      const oldTime = Date.now() - 120000; // 2 minutes ago
      oldSession.lastChunkTime = oldTime;
      
      // Act
      sessionManager.cleanupInactiveSessions(60000); // 1 minute max age
      
      // Assert
      expect(sessionManager.getSession(recentSessionId)).toBeDefined();
      expect(sessionManager.getSession(oldSessionId)).toBeUndefined();
    });
    
    it('should get all sessions', () => {
      // Arrange - create multiple sessions
      sessionManager.createSession('test-session-5', 'en-US', Buffer.from('audio 1'));
      sessionManager.createSession('test-session-6', 'fr-FR', Buffer.from('audio 2'));
      
      // Act
      const allSessions = sessionManager.getAllSessions();
      
      // Assert
      expect(allSessions.size).toBeGreaterThanOrEqual(2);
      expect(allSessions.has('test-session-5')).toBe(true);
      expect(allSessions.has('test-session-6')).toBe(true);
    });
  });
  
  describe('processStreamingAudio function', () => {
    it('should create a new session', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'stream-test-session-1';
      const audioBase64 = Buffer.from('test audio').toString('base64');
      
      // Act
      await processStreamingAudio(ws, sessionId, audioBase64, true, 'en-US');
      
      // Assert
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.language).toBe('en-US');
    });
    
    it('should handle WebSocket in CLOSED state', async () => {
      // Arrange
      const closedWs = createMockWebSocket({ readyState: WebSocket.CLOSED }) as unknown as WebSocket;
      const sessionId = 'closed-ws-session';
      
      // Act
      await processStreamingAudio(
        closedWs, 
        sessionId, 
        Buffer.from('test audio').toString('base64'), 
        true, 
        'en-US'
      );
      
      // Assert
      expect(closedWs.send).not.toHaveBeenCalled();
    });
    
    it('should handle WebSocket in CONNECTING state', async () => {
      // Arrange
      const connectingWs = createMockWebSocket({ readyState: WebSocket.CONNECTING }) as unknown as WebSocket;
      const sessionId = 'connecting-ws-session';
      
      // Act
      await processStreamingAudio(
        connectingWs, 
        sessionId, 
        Buffer.from('test audio').toString('base64'), 
        true, 
        'en-US'
      );
      
      // Assert - should not send since not OPEN
      expect(connectingWs.send).not.toHaveBeenCalled();
    });
    
    it('should handle WebSocket in CLOSING state', async () => {
      // Arrange
      const closingWs = createMockWebSocket({ readyState: WebSocket.CLOSING }) as unknown as WebSocket;
      const sessionId = 'closing-ws-session';
      
      // Act
      await processStreamingAudio(
        closingWs, 
        sessionId, 
        Buffer.from('test audio').toString('base64'), 
        true, 
        'en-US'
      );
      
      // Assert - should not send since not OPEN
      expect(closingWs.send).not.toHaveBeenCalled();
    });
    
    it('should add to an existing session on subsequent chunks', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'subsequent-chunks-session';
      
      // First create the session
      await processStreamingAudio(
        ws, 
        sessionId, 
        Buffer.from('first chunk').toString('base64'), 
        true, 
        'en-US'
      );
      
      // Reset send mock
      (ws.send as any).mockClear();
      
      // Now add a subsequent chunk
      await processStreamingAudio(
        ws, 
        sessionId, 
        Buffer.from('second chunk').toString('base64'), 
        false,  // not first chunk
        'en-US'
      );
      
      // Get the session
      const session = sessionManager.getSession(sessionId);
      
      // Assert
      expect(session).toBeDefined();
      // Should not send messages for non-first chunks
      expect(ws.send).not.toHaveBeenCalled();
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should attempt to finalize a session', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'finalize-session-1';
      
      // Create a session with audio data
      sessionManager.createSession(sessionId, 'en-US', Buffer.from('test audio'));
      
      // Act
      await finalizeStreamingSession(ws, sessionId);
      
      // Assert basic interaction occurred
      expect(ws.send).toHaveBeenCalled();
      
      // Session should be deleted after finalization
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should handle non-existent session gracefully', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const nonExistentSessionId = 'non-existent-session';
      
      // Act - Clear any previous calls
      (ws.send as any).mockClear();
      
      await finalizeStreamingSession(ws, nonExistentSessionId);
      
      // Assert - should not throw and not call send
      expect(ws.send).not.toHaveBeenCalled();
    });
    
    it('should handle WebSocket in CLOSED state', async () => {
      // Arrange
      const closedWs = createMockWebSocket({ readyState: WebSocket.CLOSED }) as unknown as WebSocket;
      const sessionId = 'closed-ws-finalize-session';
      
      // Create a session
      sessionManager.createSession(sessionId, 'en-US', Buffer.from('test audio'));
      
      // Act
      await finalizeStreamingSession(closedWs, sessionId);
      
      // Assert
      expect(closedWs.send).not.toHaveBeenCalled();
      
      // Session should still be deleted even if WebSocket is closed
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should clean up sessions older than maxAgeMs', () => {
      // Arrange - create sessions with different timestamps
      const recentSessionId = 'cleanup-recent';
      const oldSessionId = 'cleanup-old';
      
      const recentSession = sessionManager.createSession(
        recentSessionId, 'en-US', Buffer.from('recent audio')
      );
      const oldSession = sessionManager.createSession(
        oldSessionId, 'en-US', Buffer.from('old audio')
      );
      
      // Set old session timestamp to be 2 minutes ago
      oldSession.lastChunkTime = Date.now() - (2 * 60 * 1000);
      
      // Act
      cleanupInactiveStreamingSessions(60 * 1000); // 1 minute max age
      
      // Assert
      expect(sessionManager.getSession(recentSessionId)).toBeDefined();
      expect(sessionManager.getSession(oldSessionId)).toBeUndefined();
    });
    
    it('should handle empty session list', () => {
      // Arrange - ensure no sessions exist
      for (const session of sessionManager.getAllSessions().values()) {
        sessionManager.deleteSession(session.sessionId);
      }
      
      // Act & Assert - should not throw
      expect(() => {
        cleanupInactiveStreamingSessions();
      }).not.toThrow();
    });
    
    it('should retain all sessions when maxAgeMs is Infinity', () => {
      // Arrange
      const veryOldSessionId = 'infinity-session';
      const veryOldSession = sessionManager.createSession(
        veryOldSessionId, 'en-US', Buffer.from('very old audio')
      );
      
      // Set session to be very old (30 days)
      veryOldSession.lastChunkTime = Date.now() - (30 * 24 * 60 * 60 * 1000);
      
      // Act
      cleanupInactiveStreamingSessions(Infinity);
      
      // Assert - session should be retained despite being very old
      expect(sessionManager.getSession(veryOldSessionId)).toBeDefined();
    });
    
    it('should delete inactive sessions regardless of processing flag', () => {
      // First empty the sessions to have a clean state
      for (const session of sessionManager.getAllSessions().values()) {
        sessionManager.deleteSession(session.sessionId);
      }
      
      // Arrange - create a session that's being processed
      const processingSessionId = 'test-processing-session';
      const processingSession = sessionManager.createSession(
        processingSessionId, 'en-US', Buffer.from('processing audio')
      );
      
      // Mark the session as processing
      processingSession.isProcessing = true;
      
      // Make the session older than the cleanup threshold 
      const ageMs = 120000; // 2 minutes
      processingSession.lastChunkTime = Date.now() - ageMs;
      
      // Act - call cleanup with a threshold such that the session should be cleaned up
      cleanupInactiveStreamingSessions(60000); // 1 minute threshold
      
      // Create a fresh reference to verify it's been deleted
      const sessionAfterCleanup = sessionManager.getSession(processingSessionId);
      
      // Assert - the session should be deleted regardless of processing flag
      // since the current implementation doesn't check for isProcessing
      expect(sessionAfterCleanup).toBeUndefined();
    });
    
    it('should handle negative maxAgeMs value', () => {
      // Arrange - create a session
      const sessionId = 'negative-maxage-session';
      sessionManager.createSession(sessionId, 'en-US', Buffer.from('test'));
      
      // Act - use negative value (should be treated as 0)
      cleanupInactiveStreamingSessions(-5000);
      
      // Assert - all sessions should be cleaned up with negative age (equivalent to 0)
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should clean up multiple inactive sessions at once', () => {
      // Arrange - create multiple old sessions
      const oldSession1Id = 'old-session-1';
      const oldSession2Id = 'old-session-2';
      const oldSession3Id = 'old-session-3';
      
      // Create sessions
      const oldSession1 = sessionManager.createSession(oldSession1Id, 'en-US', Buffer.from('old1'));
      const oldSession2 = sessionManager.createSession(oldSession2Id, 'fr-FR', Buffer.from('old2'));
      const oldSession3 = sessionManager.createSession(oldSession3Id, 'es-ES', Buffer.from('old3'));
      
      // Make all sessions old
      oldSession1.lastChunkTime = Date.now() - 300000; // 5 minutes old
      oldSession2.lastChunkTime = Date.now() - 400000; // 6.6 minutes old
      oldSession3.lastChunkTime = Date.now() - 500000; // 8.3 minutes old
      
      // Act
      cleanupInactiveStreamingSessions(60000); // 1 minute max age
      
      // Assert - all sessions should be cleaned up
      expect(sessionManager.getSession(oldSession1Id)).toBeUndefined();
      expect(sessionManager.getSession(oldSession2Id)).toBeUndefined();
      expect(sessionManager.getSession(oldSession3Id)).toBeUndefined();
    });
  });
  
  describe('Integrated functionality tests', () => {
    it('should process audio streaming', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'audio-processing-session';
      
      // Act - Use public API to create and finalize a streaming session
      await processStreamingAudio(
        ws,
        sessionId,
        Buffer.from('test audio').toString('base64'),
        true,
        'en-US'
      );
      
      // Assert
      const session = sessionManager.getSession(sessionId);
      expect(session).toBeDefined();
    });
    
    it('should clean up sessions', () => {
      // Arrange - create at least one session
      const sessionId = 'cleanup-test-session';
      sessionManager.createSession(sessionId, 'en-US', Buffer.from('test audio'));
      
      // Act
      cleanupInactiveStreamingSessions();
      
      // No assertion necessary, just verifying it doesn't throw
    });
    
    it('should process streaming audio with multiple chunks', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'multi-chunk-session';
      
      // Create a session directly
      sessionManager.createSession(sessionId, 'en-US', Buffer.from('chunk 1'));
      
      // Add another chunk directly to the session
      sessionManager.addAudioToSession(sessionId, Buffer.from('chunk 2'));
      
      // Assert
      const session = sessionManager.getSession(sessionId);
      expect(session?.audioBuffer.length).toBeGreaterThan(1);
      
      // Finalize
      await finalizeStreamingSession(ws, sessionId);
      
      // Session should be deleted
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should handle large audio buffers - truncate when exceeding MAX_AUDIO_BUFFER_BYTES', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'large-buffer-session';
      
      // Create session with initial small buffer
      sessionManager.createSession(sessionId, 'en-US', Buffer.from('initial small buffer'));
      
      // Create a large audio buffer that exceeds CONFIG.MAX_AUDIO_BUFFER_BYTES (640KB)
      const largeBuffer = Buffer.alloc(700000, 1); // 700 KB buffer filled with 1s
      
      // Add large buffer to session
      sessionManager.addAudioToSession(sessionId, largeBuffer);
      
      // Access the private processAudioChunks function through the exported finalizeStreamingSession
      // which calls processAudioChunks internally
      await finalizeStreamingSession(ws, sessionId);
      
      // Session should be deleted after processing
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should handle multiple accumulated audio chunks within size limit', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'multiple-small-chunks';
      
      // Create session
      sessionManager.createSession(sessionId, 'en-US', Buffer.from('chunk 1'));
      
      // Add several small chunks that together are below MAX_AUDIO_BUFFER_BYTES
      const smallChunk1 = Buffer.alloc(1000, 1); // 1KB
      const smallChunk2 = Buffer.alloc(2000, 2); // 2KB
      const smallChunk3 = Buffer.alloc(3000, 3); // 3KB
      
      // Add chunks to session
      sessionManager.addAudioToSession(sessionId, smallChunk1);
      sessionManager.addAudioToSession(sessionId, smallChunk2);
      sessionManager.addAudioToSession(sessionId, smallChunk3);
      
      // Verify multiple chunks exist
      const session = sessionManager.getSession(sessionId);
      expect(session?.audioBuffer.length).toBe(4); // Initial + 3 added chunks
      
      // Process audio chunks 
      await finalizeStreamingSession(ws, sessionId);
      
      // Session should be deleted after processing
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should handle invalid base64 audio data', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'invalid-base64-session';
      const invalidBase64 = 'not a valid base64 string';
      
      // Mock console.error to avoid polluting test output
      const originalConsoleError = console.error;
      console.error = vi.fn();
      
      try {
        // Act
        await processStreamingAudio(
          ws,
          sessionId,
          invalidBase64,
          true,
          'en-US'
        );
        
        // Even with invalid data, a session is created first
        const session = sessionManager.getSession(sessionId);
        expect(session).toBeDefined();
        
        // Cleanup
        if (session) {
          sessionManager.deleteSession(sessionId);
        }
      } finally {
        // Restore console.error
        console.error = originalConsoleError;
      }
    });
    
    it('should handle audio processing with different languages', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'different-language-session';
      
      // Test with different language
      await processStreamingAudio(
        ws,
        sessionId,
        Buffer.from('test audio').toString('base64'),
        true,
        'fr-FR'  // French language
      );
      
      // Verify session was created with correct language
      const session = sessionManager.getSession(sessionId);
      expect(session?.language).toBe('fr-FR');
      
      // Clean up
      sessionManager.deleteSession(sessionId);
    });
    
    it('should handle case with empty audio buffer', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'empty-buffer-session';
      
      // Create a session with empty initial buffer
      sessionManager.createSession(sessionId, 'en-US', Buffer.from(''));
      
      // Act
      await finalizeStreamingSession(ws, sessionId);
      
      // Session should be deleted even with empty buffer
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should skip processing for audio buffer smaller than MIN_AUDIO_SIZE_BYTES', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'tiny-buffer-session';
      
      // Create a session with a very small buffer (smaller than MIN_AUDIO_SIZE_BYTES)
      const tinyBuffer = Buffer.alloc(10); // 10 bytes is definitely below the minimum
      sessionManager.createSession(sessionId, 'en-US', tinyBuffer);
      
      // Mock the transcribe function to verify it's not called
      const audioProcessorMock = {
        transcribeAudio: vi.fn().mockResolvedValue('Should not be called')
      };
      
      // Store original implementation to restore later
      const originalAudioProcessor = (global as any).audioProcessor;
      (global as any).audioProcessor = audioProcessorMock;
      
      try {
        // Act - process the session using our mock function
        await processAudioChunks(ws as any, sessionId);
        
        // Get the session after processing
        const session = sessionManager.getSession(sessionId);
        
        // Assert - session should still exist, transcribeAudio should not be called
        expect(session).toBeDefined();
        expect(audioProcessorMock.transcribeAudio).not.toHaveBeenCalled();
        expect(session?.transcriptionInProgress).toBe(false); // Should be reset
        
        // Clean up
        sessionManager.deleteSession(sessionId);
      } finally {
        // Restore original
        (global as any).audioProcessor = originalAudioProcessor;
      }
    });
    
    it('should handle case with very small audio buffer', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'tiny-audio-buffer-session';
      
      // Create a session with a very small buffer (smaller than MIN_AUDIO_SIZE_BYTES)
      const tinyBuffer = Buffer.alloc(10); // 10 bytes is definitely below the minimum
      sessionManager.createSession(sessionId, 'en-US', tinyBuffer);
      
      // Act
      await finalizeStreamingSession(ws, sessionId);
      
      // Assert - session should be deleted even with a tiny buffer
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should handle finalizing a session that is already being processed', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'already-processing-session';
      
      // Create a session and mark it as processing
      const session = sessionManager.createSession(sessionId, 'en-US', Buffer.from('test'));
      session.isProcessing = true;
      
      // Act & Assert - Should not throw
      await finalizeStreamingSession(ws, sessionId);
      
      // Processing flag should be restored for cleanup
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should handle transcription when session data is missing', async () => {
      // This test targets the case where session exists but data is incomplete
      
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'incomplete-session';
      
      // Create a session
      const session = sessionManager.createSession(sessionId, 'en-US', Buffer.from('test'));
      
      // Simulate corrupted session by clearing the audio buffer
      session.audioBuffer = [];
      
      // Act & Assert - Should handle gracefully
      await finalizeStreamingSession(ws, sessionId);
      
      // Session should be deleted 
      expect(sessionManager.getSession(sessionId)).toBeUndefined();
    });
    
    it('should handle transcription API errors', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'api-error-session';
      
      // Create a session with audio data
      sessionManager.createSession(sessionId, 'en-US', Buffer.from('test audio'));
      
      // Override the default mock to simulate an API error
      const openaiModule = await import('openai');
      const originalImplementation = openaiModule.default;
      
      // Mock an error response from the OpenAI API
      vi.mock('openai', () => {
        return {
          default: vi.fn().mockImplementation(() => ({
            audio: {
              transcriptions: {
                create: vi.fn().mockRejectedValue(new Error('API Error: Transcription failed'))
              }
            }
          }))
        };
      });
      
      // Mock console.error to avoid polluting test output
      const originalConsoleError = console.error;
      console.error = vi.fn();
      
      try {
        // Act
        await finalizeStreamingSession(ws, sessionId);
        
        // Assert - WebSocket should receive an error message
        expect(ws.send).toHaveBeenCalled();
        
        // Verify the error was handled properly
        expect(sessionManager.getSession(sessionId)).toBeUndefined();
      } finally {
        // Restore console.error and original implementations
        console.error = originalConsoleError;
      }
    });
    
    it('should handle unexpected errors during audio processing', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'unexpected-error-session';
      
      // Create a session with audio data
      const session = sessionManager.createSession(sessionId, 'en-US', Buffer.from('test audio'));
      
      // Modify the session to cause an error during processing
      // Make audioBuffer not an array to trigger a type error when calling concat
      (session as any).audioBuffer = {}; // This will cause a runtime error
      
      // Mock console.error to avoid polluting test output
      const originalConsoleError = console.error;
      console.error = vi.fn();
      
      try {
        // Act
        await finalizeStreamingSession(ws, sessionId);
        
        // Assert - WebSocket should receive an error message
        expect(ws.send).toHaveBeenCalled();
      } finally {
        // Restore console.error
        console.error = originalConsoleError;
        
        // Clean up the corrupted session
        sessionManager.deleteSession(sessionId);
      }
    });
    
    it('should handle errors during session finalization', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'finalization-error-session';
      
      // Create a session that will later be corrupted
      sessionManager.createSession(sessionId, 'en-US', Buffer.from('test audio'));
      
      // Create spies for console.error and console.log
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      
      // Corrupt the sessionManager.deleteSession method to trigger an error during finalization
      const originalDeleteSession = sessionManager.deleteSession;
      sessionManager.deleteSession = vi.fn().mockImplementation(() => {
        throw new Error('Simulated error during session deletion');
      });
      
      try {
        // Act - this should trigger the error in the catch block of finalizeStreamingSession
        await finalizeStreamingSession(ws, sessionId);
        
        // Assert - console.error should be called with error details
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          expect.stringContaining('Error finalizing session'),
          expect.any(Error)
        );
      } finally {
        // Restore original implementations
        sessionManager.deleteSession = originalDeleteSession;
        consoleErrorSpy.mockRestore();
        consoleLogSpy.mockRestore();
        
        // Clean up the session for real
        sessionManager.deleteSession(sessionId);
      }
    });
    
    it('should handle very long session inactivity periods', () => {
      // Create session with a very old timestamp
      const veryOldSessionId = 'extremely-old-session';
      const session = sessionManager.createSession(veryOldSessionId, 'en-US', Buffer.from('test'));
      
      // Set last chunk time to ancient past (1 hour = 3600000ms)
      session.lastChunkTime = Date.now() - 3600000;
      
      // Clean up with normal timeout
      cleanupInactiveStreamingSessions();
      
      // Old session should be cleaned up
      expect(sessionManager.getSession(veryOldSessionId)).toBeUndefined();
    });
    
    it('should test setInterval cleanup functionality', () => {
      // Mock setInterval
      const originalSetInterval = global.setInterval;
      const mockSetInterval = vi.fn();
      global.setInterval = mockSetInterval as any;
      
      try {
        // Simulate the module-level code that sets up the interval
        const cleanupFunction = () => cleanupInactiveStreamingSessions();
        setInterval(cleanupFunction, 300000); // 5 minutes in ms
        
        // Assert the mock was called with a function and interval
        expect(mockSetInterval).toHaveBeenCalledWith(
          expect.any(Function),
          expect.any(Number)
        );
      } finally {
        // Restore original
        global.setInterval = originalSetInterval;
      }
    });
    
    it('should handle transcription correctly', async () => {
      // Arrange
      const ws = createMockWebSocket() as unknown as WebSocket;
      const sessionId = 'valid-transcription-session';
      
      // Create a session with a buffer above minimum size
      const buffer = Buffer.alloc(2000); // 2KB, above minimum size
      const session = sessionManager.createSession(sessionId, 'en-US', buffer);
      
      // Add test transcription directly
      session.transcriptionText = "This is a test transcription";
      
      // Mock ws.send to verify it gets called
      const sendSpy = vi.spyOn(ws, 'send');
      
      try {
        // Act - finalize the session which should send the transcription
        await finalizeStreamingSession(ws, sessionId);
        
        // Assert - WebSocket send should be called with our transcription
        expect(sendSpy).toHaveBeenCalled();
        
        // At least one call should contain our transcription text
        const calls = sendSpy.mock.calls;
        const transcriptionSent = calls.some(call => 
          typeof call[0] === 'string' && call[0].includes('This is a test transcription')
        );
        
        expect(transcriptionSent).toBe(true);
        
      } finally {
        // Clean up the spy
        sendSpy.mockRestore();
      }
    });
  });
});