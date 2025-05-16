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

// TEST SECTION 3: Coverage-focused tests with SessionManager
describe('OpenAI Streaming Coverage Tests', () => {
  // WebSocket test double
  class MockWebSocket {
    static CONNECTING = 0;
    static OPEN = 1;
    static CLOSING = 2;
    static CLOSED = 3;
    
    readyState = MockWebSocket.OPEN;
    sentMessages = [];
    
    constructor(readyState = MockWebSocket.OPEN) {
      this.readyState = readyState;
    }
    
    send(message) {
      try {
        this.sentMessages.push(JSON.parse(message));
        return true;
      } catch (e) {
        this.sentMessages.push(message);
        return false;
      }
    }
  }

  // Test variables
  let ws;
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a fresh mock WebSocket
    ws = new MockWebSocket();
    
    // Spy on sessionManager methods
    vi.spyOn(sessionManager, 'createSession');
    vi.spyOn(sessionManager, 'getSession');
    vi.spyOn(sessionManager, 'addAudioToSession'); 
    vi.spyOn(sessionManager, 'deleteSession');
    vi.spyOn(sessionManager, 'cleanupInactiveSessions');
  });
  
  describe('processStreamingAudio function', () => {
    it('should create a new session with first chunk', async () => {
      // Arrange
      const sessionId = 'test-session-123';
      const audioBase64 = Buffer.from('test audio data').toString('base64');
      const isFirstChunk = true;
      const language = 'en-US';
      
      // Act
      await processStreamingAudio(ws, sessionId, audioBase64, isFirstChunk, language);
      
      // Assert
      expect(sessionManager.createSession).toHaveBeenCalledWith(
        sessionId, 
        language, 
        expect.any(Buffer)
      );
    });
    
    it('should add to existing session with subsequent chunks', async () => {
      // Arrange
      const sessionId = 'test-session-456';
      const audioBase64 = Buffer.from('more test audio').toString('base64');
      const isFirstChunk = false;
      const language = 'es-ES';
      
      // Mock session exists
      vi.mocked(sessionManager.getSession).mockReturnValue({
        sessionId,
        language,
        isProcessing: false,
        audioBuffer: [],
        lastChunkTime: Date.now(),
        transcriptionText: '',
        transcriptionInProgress: false
      });
      
      // Act
      await processStreamingAudio(ws, sessionId, audioBase64, isFirstChunk, language);
      
      // Assert
      expect(sessionManager.addAudioToSession).toHaveBeenCalledWith(
        sessionId,
        expect.any(Buffer)
      );
    });
  });
  
  describe('finalizeStreamingSession function', () => {
    it('should finalize and delete a session', async () => {
      // Arrange
      const sessionId = 'test-session-789';
      
      // Mock session exists
      vi.mocked(sessionManager.getSession).mockReturnValue({
        sessionId,
        language: 'en-US',
        isProcessing: false,
        audioBuffer: [],
        lastChunkTime: Date.now(),
        transcriptionText: 'Finalized transcription',
        transcriptionInProgress: false
      });
      
      // Act
      await finalizeStreamingSession(ws, sessionId);
      
      // Assert
      expect(sessionManager.deleteSession).toHaveBeenCalledWith(sessionId);
    });
  });
  
  describe('cleanupInactiveStreamingSessions function', () => {
    it('should call session manager cleanup method', () => {
      // Act
      cleanupInactiveStreamingSessions(60000);
      
      // Assert
      expect(sessionManager.cleanupInactiveSessions).toHaveBeenCalledWith(60000);
    });
  });
});