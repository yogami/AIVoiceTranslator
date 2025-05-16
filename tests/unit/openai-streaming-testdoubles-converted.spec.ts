/**
 * OpenAI Streaming Audio Transcription Service Tests
 * 
 * Using test doubles pattern (instead of full mocks) to test the streaming functionality
 * Converted from Jest to Vitest
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Buffer } from 'buffer';

// Need to mock modules before import of actual module
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
import { processStreamingAudio, finalizeStreamingSession, cleanupInactiveStreamingSessions } from '../../server/openai-streaming';

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
      originalConsoleLog(...args);
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