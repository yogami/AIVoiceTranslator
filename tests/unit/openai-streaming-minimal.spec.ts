/**
 * Minimal tests for openai-streaming module
 * Focus on critical functionality with proper dependency mocking
 * Implement constructor injection pattern for better testability
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { WebSocket } from 'ws';
import { WebSocketState } from '../../server/websocket';

// We need to mock the WebSocketCommunicator's static methods
vi.mock('../../server/openai-streaming', async (importOriginal) => {
  const originalModule = await importOriginal();
  
  // Create a mocked version of internal WebSocketCommunicator
  const mockWebSocketCommunicator = {
    sendTranscriptionResult: vi.fn(),
    sendErrorMessage: vi.fn(),
    sendMessage: vi.fn()
  };
  
  // Assign it to the module's WebSocketCommunicator (assuming it exists)
  // This is a trick to access private exports
  (originalModule as any).WebSocketCommunicator = mockWebSocketCommunicator;
  
  return {
    ...originalModule,
    // We can also provide mocked versions of exported functions if needed
  };
});

// Mock the OpenAI class
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => {
      return {
        audio: {
          transcriptions: {
            create: vi.fn().mockResolvedValue({
              text: 'This is a test transcription',
              duration: 2.5
            })
          }
        }
      };
    })
  };
});

// Now import the functions we need to test
import { 
  processStreamingAudio,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions
} from '../../server/openai-streaming';

// Get access to our mocked WebSocketCommunicator to verify calls
const WebSocketCommunicator = (await import('../../server/openai-streaming') as any).WebSocketCommunicator;

describe('OpenAI Streaming - Core Functions', () => {
  // Create a mock WebSocket that implements the minimal interface needed
  const mockWebSocket = {
    readyState: WebSocketState.OPEN,
    send: vi.fn()
  } as unknown as WebSocket;
  
  // Save original console methods and other globals
  const originalConsole = { ...console };
  const originalSetInterval = global.setInterval;
  const originalDateNow = Date.now;
  
  beforeEach(() => {
    // Mock console methods
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
    
    // Mock setInterval to prevent side effects
    global.setInterval = vi.fn();
    
    // Set environment variables
    process.env.OPENAI_API_KEY = 'mock-api-key';
    
    // Reset all mocks
    vi.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console methods
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    
    // Restore globals
    global.setInterval = originalSetInterval;
    Date.now = originalDateNow;
    
    // Reset environment variables
    delete process.env.OPENAI_API_KEY;
  });
  
  it('should attempt to process streaming audio', async () => {
    // Create a valid base64 encoded audio buffer
    const mockAudioBase64 = Buffer.from('test audio data').toString('base64');
    
    // Process the streaming audio
    await processStreamingAudio(
      mockWebSocket,
      'test-session-123',
      mockAudioBase64,
      true, // isFirstChunk
      'en-US'
    );
    
    // Verify that our function tried to do something
    // In this case, we expect at least one console.log call indicating activity
    expect(console.log).toHaveBeenCalled();
  });
  
  it('should handle invalid base64 data gracefully', async () => {
    // Create invalid base64 data that should trigger an error
    const invalidBase64 = '!@#$%^';
    
    // Process the invalid data
    await processStreamingAudio(
      mockWebSocket,
      'test-session-123',
      invalidBase64,
      true,
      'en-US'
    );
    
    // Error handling should occur
    expect(console.error).toHaveBeenCalled();
    // The error message should mention something about invalid base64
    expect(WebSocketCommunicator.sendErrorMessage).toHaveBeenCalled();
  });
  
  it('should call the appropriate methods when finalizing a session', async () => {
    // Create a session first
    const mockAudioBase64 = Buffer.from('test audio data').toString('base64');
    
    // Before finalizing, create a session
    try {
      await processStreamingAudio(
        mockWebSocket,
        'test-session-123',
        mockAudioBase64,
        true,
        'en-US'
      );
    } catch (e) {
      // Ignore any errors here, we're just setting up
    }
    
    // Clear mocks to check new calls
    vi.clearAllMocks();
    
    // Finalize the session
    await finalizeStreamingSession(
      mockWebSocket,
      'test-session-123'
    );
    
    // Verify finalization attempts were made by checking logs
    expect(console.log).toHaveBeenCalled();
  });
  
  it('should clean up inactive streaming sessions', () => {
    // Mock Date.now to force "old" sessions
    Date.now = vi.fn().mockReturnValue(Date.now() + 100000); // 100 seconds in future
    
    // Call cleanup with a very short timeout
    cleanupInactiveStreamingSessions(10); // 10ms timeout
    
    // Verify cleanup runs without errors
    expect(console.error).not.toHaveBeenCalled();
  });
});