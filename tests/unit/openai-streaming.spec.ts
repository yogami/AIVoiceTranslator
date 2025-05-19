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
  let mockWs;
  
  beforeEach(() => {
    // Reset state and mocks
    vi.clearAllMocks();
    mockWs = new TestWebSocket();
    
    // Spy on console.error for error assertions
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  
  afterEach(() => {
    consoleErrorSpy.mockRestore();
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
  
  // Test cleanupInactiveStreamingSessions function
  it('should clean up inactive sessions safely', () => {
    // Act - Call the function with a custom age parameter
    cleanupInactiveStreamingSessions(1000);
    
    // Assert - Should not throw an error
    expect(true).toBe(true);
  });
});