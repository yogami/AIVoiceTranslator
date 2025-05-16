/**
 * Minimal tests for OpenAI Streaming Audio Transcription Service
 *
 * Using only dependency mocking without modifying source code
 * Converted from Jest to Vitest
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Buffer } from 'buffer';

// Mock WebSocket first - this needs to be at the top
vi.mock('ws', () => {
  return {
    WebSocketServer: vi.fn(() => ({
      on: vi.fn(),
      clients: new Set()
    })),
    // Standardize WebSocket constants for the module
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
});

// Manual mock for OpenAI - we need to define the mock function INLINE
// since Vitest hoists mocks and can't reference variables defined after the vi.mock call
vi.mock('openai', () => {
  // Return the constructor
  return {
    default: vi.fn().mockImplementation(() => {
      // Return object with audio.transcriptions.create method
      return {
        audio: {
          transcriptions: {
            create: vi.fn().mockResolvedValue({
              text: 'Test transcription result', 
              duration: 2.5
            })
          }
        }
      };
    })
  };
});

// Import the module under test after mocking
import { processStreamingAudio, finalizeStreamingSession } from '../../server/openai-streaming';

describe('Minimal OpenAI Streaming Tests', () => {
  // Mock WebSocket implementation
  class MockWebSocket {
    sentMessages = [];
    readyState = 1; // OPEN
    
    send(message) {
      this.sentMessages.push(JSON.parse(message));
    }
  }

  let mockWs;
  const testSessionId = 'test-session-123';
  const testLanguage = 'en-US';

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Create a fresh WebSocket for each test
    mockWs = new MockWebSocket();
  });

  it('should process streaming audio and create a session', async () => {
    // Arrange
    const testAudioBase64 = Buffer.from('test audio data').toString('base64');
    const isFirstChunk = true;
    
    // Act
    await processStreamingAudio(mockWs, testSessionId, testAudioBase64, isFirstChunk, testLanguage);
    
    // Assert - We should have at least one message sent
    expect(mockWs.sentMessages.length).toBeGreaterThan(0);
  });

  it('should finalize a streaming session', async () => {
    // Arrange
    // First create a session so we have something to finalize
    const testAudioBase64 = Buffer.from('test audio data').toString('base64');
    await processStreamingAudio(mockWs, testSessionId, testAudioBase64, true, testLanguage);
    
    // Reset messages to check only finalization messages
    mockWs.sentMessages = [];
    
    // Act
    await finalizeStreamingSession(mockWs, testSessionId);
    
    // Assert
    // We should have a final message
    expect(mockWs.sentMessages.length).toBeGreaterThan(0);
    // The last message should have isFinal = true
    const lastMessage = mockWs.sentMessages[mockWs.sentMessages.length - 1];
    expect(lastMessage.isFinal).toBe(true);
  });
});