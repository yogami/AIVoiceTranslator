/**
 * Unit tests for OpenAI Streaming functionality
 */
import { describe, it, expect, beforeEach, jest, afterEach } from '@jest/globals';
import { WebSocket } from 'ws';
import { processStreamingAudio, sessionManager, WebSocketCommunicator } from '../../server/openai-streaming';

// Mock dependencies
jest.mock('ws');
jest.mock('../../server/openai-streaming', () => {
  // Explicitly return our mocked implementations
  return {  
    processStreamingAudio: jest.fn(),
    sessionManager: {
      getSession: jest.fn(),
      createSession: jest.fn(),
      addAudioToSession: jest.fn(),
    },
    WebSocketCommunicator: {
      sendErrorMessage: jest.fn(),
    },
    audioProcessor: {
      transcribeAudio: jest.fn(),
    }
  };
});

describe('processStreamingAudio', () => {
  const mockWs = {} as WebSocket;
  const mockSessionId = 'test-session-123';
  const mockLanguage = 'en-US';
  const mockAudioBase64 = 'YXVkaW9kYXRh';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new session if it is the first chunk', async () => {
    // Setup
    const isFirstChunk = true;
    
    // Execute
    await processStreamingAudio(mockWs, mockSessionId, mockAudioBase64, isFirstChunk, mockLanguage);
    
    // Verify
    expect(sessionManager.createSession).toHaveBeenCalledWith(
      mockSessionId, 
      mockLanguage, 
      expect.any(Buffer)
    );
  });

  it('should add to existing session if not the first chunk', async () => {
    // Setup
    const isFirstChunk = false;
    const mockSession = { 
      audioBuffer: [],
      language: mockLanguage,
      transcriptionInProgress: false
    };
    
    (sessionManager.getSession as jest.Mock).mockReturnValue(mockSession);
    
    // Execute
    await processStreamingAudio(mockWs, mockSessionId, mockAudioBase64, isFirstChunk, mockLanguage);
    
    // Verify
    expect(sessionManager.addAudioToSession).toHaveBeenCalledWith(
      mockSessionId, 
      expect.any(Buffer)
    );
  });

  it('should handle errors gracefully', async () => {
    // Setup
    const isFirstChunk = true;
    (sessionManager.createSession as jest.Mock).mockImplementation(() => {
      throw new Error('Test error');
    });
    
    // Execute
    await processStreamingAudio(mockWs, mockSessionId, mockAudioBase64, isFirstChunk, mockLanguage);
    
    // Verify
    expect(WebSocketCommunicator.sendErrorMessage).toHaveBeenCalledWith(
      mockWs, 
      'Failed to process audio data', 
      'server_error'
    );
  });
});
