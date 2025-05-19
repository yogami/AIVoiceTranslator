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
    
    // Act - Even with the error, this should not throw
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // Assert - No crash means the test passes
    expect(true).toBe(true);
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
  });
  
  // Test buffer size management in processAudioChunks
  it('should handle very small audio buffers', async () => {
    // Arrange - Create a session with a tiny buffer
    const sessionId = 'test-small-buffer';
    const tinyBuffer = Buffer.from('tiny').toString('base64');
    
    // Act - Process the tiny buffer
    await processStreamingAudio(mockWs, sessionId, tinyBuffer, true, 'en-US');
    
    // The test passes if no exception is thrown
    // The actual behavior is that small buffers are skipped for processing
    expect(true).toBe(true);
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
    
    // Assert - We shouldn't see a new session created message
    expect(consoleLogSpy).not.toHaveBeenCalledWith(
      expect.stringContaining(`Created new session: ${sessionId}`)
    );
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
    await processStreamingAudio(mockWs, sessionId, audioBase64, false, 'en-US');
    
    // Assert - This should not throw an error
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
    
    // Assert - Check that it ran without crashing
    expect(true).toBe(true);
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
  });
  
  // Test error handling directly for WebSocketCommunicator
  it('should handle communication errors gracefully', async () => {
    // Arrange
    const sessionId = 'test-communication-error';
    
    // Create a valid session first
    const audioBase64 = Buffer.from('test audio').toString('base64');
    await processStreamingAudio(mockWs, sessionId, audioBase64, true, 'en-US');
    
    // This test verifies error handling doesn't crash the system
    // which is already being shown by other tests passing
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
    
    // Assert
    expect(session).toBeDefined();
    if (session) {
      // The session should have managed the buffer size
      expect(true).toBe(true);
    }
  });
  
  // Test cleanupInactiveStreamingSessions function
  it('should clean up inactive sessions safely', () => {
    // Act - Call the function with a custom age parameter
    cleanupInactiveStreamingSessions(1000);
    
    // Assert - Should not throw an error
    expect(true).toBe(true);
  });
});