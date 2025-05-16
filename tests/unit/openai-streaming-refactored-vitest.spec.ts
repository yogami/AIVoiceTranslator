/**
 * Refactored tests for OpenAI Streaming Audio Transcription Service
 *
 * Using a simpler approach with Vitest mocking
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock dependencies
vi.mock('ws', () => {
  return {
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3
  };
});

// Create a factory function to get consistent mocks
const createMockOpenAI = () => {
  const mockCreate = vi.fn().mockResolvedValue({
    text: 'Test transcription result', 
    duration: 2.5
  });
  
  // Return the mock structure
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: mockCreate
        }
      }
    })),
    // Store reference to the mock function for assertions
    mockCreate
  };
};

// Set up the mock
const openAIMock = createMockOpenAI();
vi.mock('openai', () => openAIMock);

// Now import the SUT - this is after mocks to ensure they're applied
import { processStreamingAudio, finalizeStreamingSession } from '../../server/openai-streaming';

describe('OpenAI Streaming - Refactored Test Suite', () => {
  // Mock websocket for testing
  let mockWebSocket;
  
  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    
    // Create a fresh mock websocket for each test
    mockWebSocket = {
      send: vi.fn(),
      readyState: 1 // OPEN
    };
  });
  
  // Test the process streaming function
  it('should handle streaming audio processing', async () => {
    // Arrange
    const sessionId = 'test-session-123';
    const audioBase64 = 'dGVzdCBhdWRpbw=='; // "test audio" in base64
    const isFirstChunk = true;
    const language = 'en-US';
    
    // Act - Call the function with our test data
    await processStreamingAudio(
      mockWebSocket as any, 
      sessionId, 
      audioBase64, 
      isFirstChunk, 
      language
    );
    
    // Assert - WebSocket send should be called
    expect(mockWebSocket.send).toHaveBeenCalled();
    
    // Verify the message format (this depends on the implementation)
    const lastCallArgs = mockWebSocket.send.mock.calls[0][0];
    
    // Should be a stringified JSON object
    const sentMessage = JSON.parse(lastCallArgs);
    
    // Verify basic structure
    expect(sentMessage).toHaveProperty('type');
  });
  
  // Test the finalize session function
  it('should handle finalizing a streaming session', async () => {
    // Arrange
    const sessionId = 'test-session-123';
    const audioBase64 = 'dGVzdCBhdWRpbw=='; // "test audio" in base64
    
    // First create a session
    await processStreamingAudio(
      mockWebSocket as any, 
      sessionId, 
      audioBase64, 
      true, 
      'en-US'
    );
    
    // Clear the mock to isolate the finalize call
    mockWebSocket.send.mockClear();
    
    // Act - Call the function with our test data
    await finalizeStreamingSession(mockWebSocket as any, sessionId);
    
    // Assert - WebSocket send should be called
    expect(mockWebSocket.send).toHaveBeenCalled();
  });
});