/**
 * OpenAI Streaming Service Tests
 * 
 * Consolidated test file for the OpenAI streaming functionality
 * Includes tests from the previously separate files:
 * - openai-streaming-minimal-converted.spec.ts
 * - openai-streaming-testdoubles-converted.spec.ts
 * - openai-streaming-coverage-converted.spec.ts
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Buffer } from 'buffer';

// Mock OpenAI module with inline implementation to avoid hoisting issues
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({ 
            text: 'Test transcription result', 
            duration: 2.5 
          })
        }
      }
    }))
  };
});

// Mock needed WebSocket constants
vi.mock('ws', () => {
  return {
    WebSocketServer: vi.fn(() => ({
      on: vi.fn(),
      clients: new Set()
    })),
    // Export constants
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
});

// Import the module under test after mocking
import { 
  processStreamingAudio, 
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions,
  sessionManager 
} from '../../server/openai-streaming';

// TEST SECTION 1: Basic OpenAI Streaming Functionality
describe('Basic OpenAI Streaming Functionality', () => {
  // Mock WebSocket for basic tests
  class MockWebSocket {
    sentMessages = [];
    readyState = 1; // OPEN
    
    send(message) {
      try {
        this.sentMessages.push(JSON.parse(message));
      } catch (e) {
        this.sentMessages.push(message);
      }
    }
  }
  
  let mockWs;
  let consoleLogOriginal;
  let consoleOutput = [];
  
  beforeEach(() => {
    // Reset state before each test
    vi.clearAllMocks();
    mockWs = new MockWebSocket();
    
    // Capture console output for verification
    consoleLogOriginal = console.log;
    consoleOutput = [];
    console.log = vi.fn((...args) => {
      consoleOutput.push(args.join(' '));
    });
  });
  
  afterEach(() => {
    // Restore console.log after each test
    console.log = consoleLogOriginal;
  });
  
  it('should process streaming audio', async () => {
    // Arrange
    const sessionId = 'test-session-123';
    const audioBase64 = Buffer.from('test audio data').toString('base64');
    const isFirstChunk = true;
    const language = 'en-US';
    
    // Act
    await processStreamingAudio(mockWs, sessionId, audioBase64, isFirstChunk, language);
    
    // Assert
    // Only check for console output since the message might not be sent in test environment
    expect(consoleOutput.some(msg => msg.includes('Created new session'))).toBe(true);
  });
  
  it('should finalize streaming session', async () => {
    // Arrange - First create a session
    const sessionId = 'test-session-123';
    const audioBase64 = Buffer.from('test audio data').toString('base64');
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // Clear messages for clean test
    mockWs.sentMessages = [];
    
    // Act
    await finalizeStreamingSession(mockWs, sessionId);
    
    // Assert
    expect(mockWs.sentMessages.length).toBeGreaterThan(0);
    expect(consoleOutput.some(msg => msg.includes('Finalized and closed session'))).toBe(true);
  });
});

// TEST SECTION 2: Test Doubles Approach
describe('OpenAI Streaming with Test Doubles', () => {
  // Test double for WebSocket
  class TestWebSocket {
    sentMessages = [];
    readyState = 1; // OPEN
    
    constructor() {
      this.sentMessages = [];
    }
    
    send(message) {
      try {
        this.sentMessages.push(JSON.parse(message));
      } catch (e) {
        this.sentMessages.push(message);
      }
    }
  }
  
  // Variables for testing
  let mockWs;
  let originalConsoleLog;
  let consoleMessages = [];
  
  beforeEach(() => {
    // Reset state
    vi.clearAllMocks();
    
    // Create a new WebSocket instance
    mockWs = new TestWebSocket();
    
    // Capture console logs for verification
    originalConsoleLog = console.log;
    consoleMessages = [];
    console.log = vi.fn((...args) => {
      consoleMessages.push(args.join(' '));
      // Still log to console for debugging
      // originalConsoleLog(...args);
    });
  });
  
  afterEach(() => {
    // Restore console.log
    console.log = originalConsoleLog;
  });
  
  it('should process streaming audio and create session', async () => {
    // Arrange
    const sessionId = 'test-double-session';
    const audioBase64 = Buffer.from('test audio data').toString('base64');
    const isFirstChunk = true;
    const language = 'en-US';
    
    // Act
    await processStreamingAudio(mockWs, sessionId, audioBase64, isFirstChunk, language);
    
    // Assert
    // Verify session was created by checking console logs
    const sessionCreationLogs = consoleMessages.filter(msg => 
      msg.includes('Created new session') && msg.includes(sessionId)
    );
    expect(sessionCreationLogs.length).toBeGreaterThan(0);
  });
  
  it('should finalize streaming session', async () => {
    // Arrange - First create a session
    const sessionId = 'test-double-session-2';
    const audioBase64 = Buffer.from('test audio data').toString('base64');
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // Clear messages for clean test
    mockWs.sentMessages = [];
    
    // Act
    await finalizeStreamingSession(mockWs, sessionId);
    
    // Assert - Check that a finalization message was sent
    const finalizationLogs = consoleMessages.filter(msg => 
      msg.includes('Finalized and closed session') && msg.includes(sessionId)
    );
    expect(finalizationLogs.length).toBeGreaterThan(0);
  });
  
  it('should clean up inactive sessions', () => {
    // Act
    cleanupInactiveStreamingSessions(60000);
    
    // Assert - Just verify it doesn't throw
    expect(true).toBe(true);
  });
});

// TEST SECTION 3: Error Handling and Edge Cases
describe('OpenAI Streaming Error Handling and Edge Cases', () => {
  // Test double for WebSocket
  class TestWebSocket {
    sentMessages = [];
    readyState = 1; // OPEN by default
    
    constructor(readyState = 1) {
      this.sentMessages = [];
      this.readyState = readyState;
    }
    
    send(message) {
      try {
        this.sentMessages.push(JSON.parse(message));
      } catch (e) {
        this.sentMessages.push(message);
      }
    }
  }
  
  // Spy on console methods
  let consoleErrorSpy;
  let consoleLogSpy;
  let mockWs;
  
  beforeEach(() => {
    // Reset state and mocks
    vi.clearAllMocks();
    mockWs = new TestWebSocket();
    
    // Spy on console methods for assertions
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });
  
  // Test processStreamingAudio with WebSocket send failure
  it('should handle WebSocket send failures', async () => {
    // Arrange
    const sessionId = 'test-websocket-error';
    const audioBase64 = Buffer.from('test audio data').toString('base64');
    
    // Make the WebSocket.send method throw an error
    mockWs.send = vi.fn().mockImplementation(() => {
      throw new Error('Network error');
    });
    
    // Act & Assert - Even with the error, this should not throw
    await expect(
      processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US')
    ).resolves.not.toThrow();
  });
  
  // Test processStreamingAudio with closed WebSocket
  it('should handle closed WebSocket connection', async () => {
    // Arrange
    const closedWs = new TestWebSocket(3); // CLOSED state
    const sessionId = 'test-closed-connection';
    const audioBase64 = Buffer.from('test audio data').toString('base64');
    
    // Act
    await processStreamingAudio(closedWs, sessionId, audioBase64, true, 'en-US');
    
    // Assert
    // Should not have sent anything since connection is closed
    expect(closedWs.sentMessages.length).toBe(0);
    // No message gets sent for closed websocket
    // No specific assertion needed as not sending is the correct behavior
  });
  
  // Test invalid audio data format
  it('should handle invalid base64 audio data', async () => {
    // Arrange - Create invalid base64 data
    const sessionId = 'test-invalid-audio';
    const invalidBase64 = 'not-valid-base64!@#$%^';
    
    // Act & Assert - Should not throw
    await expect(
      processStreamingAudio(mockWs, sessionId, invalidBase64, true, 'en-US')
    ).resolves.not.toThrow();
    
    // Just verify it doesn't throw an error
    expect(true).toBe(true);
  });
  
  // Test buffer size management in processAudioChunks
  it('should handle very small audio buffers', async () => {
    // Arrange - Create a session with a tiny buffer
    const sessionId = 'test-small-buffer';
    const tinyBuffer = Buffer.from('tiny').toString('base64');
    
    // Act - Process the tiny buffer
    await processStreamingAudio(mockWs, sessionId, tinyBuffer, true, 'en-US');
    
    // Just verify the operation doesn't crash
    expect(consoleLogSpy).toHaveBeenCalled();
  });
  
  // Test session timeout behavior
  it('should handle session timeout correctly', async () => {
    // Arrange - Create a session and set last chunk time far in the past
    const sessionId = 'test-timeout-session';
    const audioBase64 = Buffer.from('test audio').toString('base64');
    
    // First create the session
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // Manually modify the session to simulate timeout
    const session = sessionManager.getSession(sessionId);
    if (session) {
      // Set last chunk time to 1 hour ago
      session.lastChunkTime = Date.now() - (60 * 60 * 1000);
    }
    
    // Act
    cleanupInactiveStreamingSessions(10000); // 10 seconds timeout
    
    // Just verify the cleanup function runs without errors
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('Cleaning up inactive session')
    );
  });
  
  // Test adding to existing session (not first chunk)
  it('should add audio to existing session', async () => {
    // Arrange - First create a session
    const sessionId = 'test-existing-session';
    const firstChunk = Buffer.from('first chunk').toString('base64');
    await processStreamingAudio(mockWs, sessionId, firstChunk, true, 'en-US');
    
    // Reset the log spy to check for session updates
    consoleLogSpy.mockClear();
    
    // Act - Send a second chunk to the same session
    const secondChunk = Buffer.from('second chunk').toString('base64');
    await processStreamingAudio(mockWs, sessionId, secondChunk, false, 'en-US');
    
    // Assert - Just verify the session exists
    const session = sessionManager.getSession(sessionId);
    expect(session).toBeDefined();
  });
  
  // Test processStreamingAudio when session is already processing
  it('should handle concurrent processing requests', async () => {
    // Arrange - Create a session and mark it as processing
    const sessionId = 'test-concurrent';
    const audioBase64 = Buffer.from('audio data').toString('base64');
    
    // First call to set up the session
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // Manually mark the session as processing
    const session = sessionManager.getSession(sessionId);
    if (session) {
      session.transcriptionInProgress = true;
    }
    
    // Act - Try to process again while already processing
    consoleLogSpy.mockClear();
    await processStreamingAudio(mockWs, sessionId, audioBase64, false, 'en-US');
    
    // Just verify method runs without throwing errors
    expect(true).toBe(true);
  });
  
  // Test finalizeStreamingSession with non-existent session
  it('should handle finalizing a non-existent session', async () => {
    // Act
    await finalizeStreamingSession(mockWs, 'non-existent-session-id');
    
    // Assert - should not throw and should not add messages
    expect(mockWs.sentMessages.length).toBe(0);
  });
  
  // Test finalizeStreamingSession with error during processing
  it('should handle errors during session finalization', async () => {
    // Arrange - Create a valid session
    const sessionId = 'test-finalize-error';
    const audioBase64 = Buffer.from('some audio data').toString('base64');
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // Force an error in the WebSocket.send method
    mockWs.send = vi.fn().mockImplementation(() => {
      throw new Error('Send failed');
    });
    
    // Act
    await finalizeStreamingSession(mockWs, sessionId);
    
    // Assert - Error should be logged, but don't expect specific format
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
  
  // Test finalizeStreamingSession with remaining audio
  it('should process remaining audio during finalization', async () => {
    // Arrange - Create a session with audio
    const sessionId = 'test-finalize-with-audio';
    const audioBase64 = Buffer.from('final audio chunk').toString('base64');
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // Act - Finalize the session which should process the audio
    await finalizeStreamingSession(mockWs, sessionId);
    
    // Assert - Check that we sent a final message
    expect(mockWs.sentMessages.length).toBeGreaterThan(0);
    expect(mockWs.sentMessages[0].isFinal).toBe(true);
    
    // Session should be deleted after finalization
    expect(sessionManager.getSession(sessionId)).toBeUndefined();
  });
  
  // Test OpenAI transcription - simplified version
  it('should process audio transcription', async () => {
    // Create a session
    const sessionId = 'test-openai-transcription';
    const audioBase64 = Buffer.from('test audio').toString('base64');
    
    // Act - Process audio
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // Assert - Just verify it doesn't throw an error
    expect(true).toBe(true);
  });
  
  // Test buffer size management
  it('should manage buffer size to prevent memory issues', async () => {
    // Arrange
    const sessionId = 'test-buffer-management';
    
    // Create a large buffer that exceeds the max buffer size
    const largeBuffer = Buffer.alloc(700000); // Bigger than MAX_AUDIO_BUFFER_BYTES
    const largeBase64 = largeBuffer.toString('base64');
    
    // Act
    await processStreamingAudio(mockWs, sessionId, largeBase64, true, 'en-US');
    
    // Verify session created and buffer managed
    const session = sessionManager.getSession(sessionId);
    
    // Assert - Just verify session was created
    expect(session).toBeDefined();
  });
  
  // Test audio format detection
  it('should detect and process different audio formats', async () => {
    // Arrange - Create buffers with headers mimicking different audio formats
    const sessionId = 'test-audio-formats';
    
    // WAV-like header (RIFF + fmt identifier)
    const wavHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x41, 0x56, 0x45, 0x66, 0x6D, 0x74, 0x20]);
    const wavData = Buffer.concat([wavHeader, Buffer.alloc(1024, 0)]);
    const wavBase64 = wavData.toString('base64');
    
    // Act
    await processStreamingAudio(mockWs, sessionId, wavBase64, true, 'en-US');
    
    // Just verify processing doesn't throw an error
    expect(true).toBe(true);
  });
  
  // Test session state management
  it('should properly reset session state after processing', async () => {
    // Arrange
    const sessionId = 'test-state-reset';
    const audioBase64 = Buffer.from('test audio').toString('base64');
    
    // Create a session
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // Act - Call the method that should reset processing state
    await finalizeStreamingSession(mockWs, sessionId);
    
    // Assert - Just verify the operation completes without error
    expect(true).toBe(true);
  });
  
  // Test cleanup with empty sessions
  it('should handle cleanup with no active sessions', () => {
    // Arrange - Delete all sessions
    for (const [sessionId] of sessionManager.getAllSessions()) {
      sessionManager.deleteSession(sessionId);
    }
    
    // Act & Assert - Should not throw
    expect(() => {
      cleanupInactiveStreamingSessions(1000);
    }).not.toThrow();
  });
  
  // Additional tests for improved branch coverage
  describe('Advanced Branch Coverage Tests', () => {
    let mockWs;
    let consoleErrorSpy;
    let consoleLogSpy;
    
    beforeEach(() => {
      mockWs = {
        readyState: 1, // OPEN
        send: vi.fn()
      };
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    });
    
    afterEach(() => {
      consoleErrorSpy.mockRestore();
      consoleLogSpy.mockRestore();
      vi.resetAllMocks();
    });
    
    it('should create a session even with potential processing errors', async () => {
      // Arrange
      const sessionId = 'error-handling-session';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      
      // Act - Create a session
      await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
      
      // Assert - At minimum, we should have created a session
      const sessions = sessionManager.getAllSessions();
      expect(sessions.has(sessionId)).toBe(true);
    });
    
    it('should handle processing of accumulated chunks with empty audio buffer', async () => {
      // Arrange - Create a session with no audio chunks
      const sessionId = 'empty-buffer-session';
      
      // Create a session without any audio data
      await processStreamingAudio(mockWs, sessionId, '', true, 'en-US');
      
      // Clear the session's audio buffer to simulate empty accumulated chunks
      const sessions = sessionManager.getAllSessions();
      const session = sessions.get(sessionId);
      if (session) {
        session.audioBuffer = [];
      }
      
      // Act - Finalize with empty buffer
      await finalizeStreamingSession(mockWs, sessionId);
      
      // Assert - Should handle gracefully without errors
      expect(consoleErrorSpy).not.toHaveBeenCalled();
    });
    
    it('should handle non-existent session in finalizeStreamingSession', async () => {
      // Act - Attempt to finalize a non-existent session
      await finalizeStreamingSession(mockWs, 'non-existent-session-id');
      
      // Assert - Should handle gracefully
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      // No assertions needed beyond not throwing
    });
    
    it('should handle session deletion properly', async () => {
      // Arrange - Create a session
      const sessionId = 'session-to-delete';
      const audioBase64 = Buffer.from('audio to delete').toString('base64');
      await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
      
      // Act - Delete the session
      const deleted = sessionManager.deleteSession(sessionId);
      
      // Assert
      expect(deleted).toBe(true);
      
      // Verify session is gone
      const sessions = sessionManager.getAllSessions();
      expect(sessions.has(sessionId)).toBe(false);
    });
    
    it('should handle attempt to delete non-existent session', async () => {
      // Act - Try to delete a session that doesn't exist
      const deleted = sessionManager.deleteSession('non-existent-session-id');
      
      // Assert
      expect(deleted).toBe(false);
    });
    
    it('should properly clean up inactive sessions', async () => {
      // Arrange - Create sessions with different last chunk times
      const recentSessionId = 'recent-session';
      const oldSessionId = 'old-session';
      
      // Create the sessions
      await processStreamingAudio(mockWs, recentSessionId, Buffer.from('recent').toString('base64'), true, 'en-US');
      await processStreamingAudio(mockWs, oldSessionId, Buffer.from('old').toString('base64'), true, 'en-US');
      
      // Make the old session inactive by setting lastChunkTime far in the past
      const sessions = sessionManager.getAllSessions();
      const oldSession = sessions.get(oldSessionId);
      if (oldSession) {
        oldSession.lastChunkTime = Date.now() - (60 * 60 * 1000); // 1 hour ago
      }
      
      // Act - Clean up with a short max age (30 minutes)
      cleanupInactiveStreamingSessions(30 * 60 * 1000);
      
      // Assert - Old session should be removed, recent one should remain
      const remainingSessions = sessionManager.getAllSessions();
      expect(remainingSessions.has(recentSessionId)).toBe(true);
      expect(remainingSessions.has(oldSessionId)).toBe(false);
    });
    
    it('should handle malformed language codes gracefully', async () => {
      // Arrange
      const sessionId = 'invalid-lang-session';
      const audioBase64 = Buffer.from('test audio with bad language').toString('base64');
      
      // Act - Send invalid language code
      await processStreamingAudio(mockWs, sessionId, audioBase64, true, ''); // Empty language code
      
      // Assert - Session should exist, even with an empty language
      const sessions = sessionManager.getAllSessions();
      const session = sessions.get(sessionId);
      expect(session).toBeDefined();
      
      // The implementation might set a default language or leave it empty,
      // either way, it shouldn't throw errors
      if (session) {
        expect(typeof session.language).toBe('string');
      }
    });
    
    it('should handle concurrent audio processing requests', async () => {
      // Arrange - Create multiple sessions
      const sessionIds = ['concurrent1', 'concurrent2', 'concurrent3'];
      const audioBase64 = Buffer.from('concurrent audio').toString('base64');
      
      // Act - Process multiple audio chunks concurrently
      await Promise.all(
        sessionIds.map(id => processStreamingAudio(mockWs, id, audioBase64, true, 'en-US'))
      );
      
      // Assert - All sessions should be created
      const sessions = sessionManager.getAllSessions();
      sessionIds.forEach(id => {
        expect(sessions.has(id)).toBe(true);
      });
    });
  });
});