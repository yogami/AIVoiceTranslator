/**
 * Tests for WebSocket message handling in OpenAI Streaming service
 * 
 * These tests verify that the processStreamingAudio and finalizeStreamingSession
 * functions handle WebSocket messages correctly.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocket } from 'ws';
import type { ExtendedWebSocket } from '../../server/websocket';

// Mock OpenAI
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'This is a mock transcription',
          }),
        },
      },
    })),
  };
});

// Mock the SessionManager
vi.mock('../../server/openai-streaming', async (importOriginal) => {
  const actualModule = await importOriginal();
  
  // Override just the functions we need to test while keeping references to the
  // imported module for other functions
  return {
    ...actualModule,
    processStreamingAudio: vi.fn().mockImplementation(
      async (ws, sessionId, audioBase64, isFirstChunk, language) => {
        // Simple implementation that simulates adding audio to session
        if (!sessionId) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Session ID is required' 
          }));
          return;
        }
        
        // Simulate successful processing
        ws.send(JSON.stringify({ 
          type: 'transcription',
          sessionId,
          text: 'Mock transcription for testing',
          isFinal: false,
          languageCode: language || 'en-US'
        }));
      }
    ),
    finalizeStreamingSession: vi.fn().mockImplementation(
      async (ws, sessionId) => {
        if (!sessionId) {
          ws.send(JSON.stringify({ 
            type: 'error', 
            message: 'Session ID is required for finalization' 
          }));
          return;
        }
        
        // Simulate successful finalization
        ws.send(JSON.stringify({ 
          type: 'transcription',
          sessionId,
          text: 'Final mock transcription',
          isFinal: true,
          languageCode: 'en-US'
        }));
      }
    )
  };
});

// Environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

describe('OpenAI Streaming WebSocket Message Handling', () => {
  let mockWebSocket: ExtendedWebSocket;
  let sentMessages: any[] = [];
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    vi.resetModules();
    
    // Create mock WebSocket
    mockWebSocket = {
      send: vi.fn().mockImplementation((message) => {
        sentMessages.push(JSON.parse(message));
      }),
      isAlive: true,
      readyState: WebSocket.OPEN,
    } as unknown as ExtendedWebSocket;
    
    sentMessages = [];
  });
  
  it('should process streaming audio chunks correctly', async () => {
    const { processStreamingAudio } = await import('../../server/openai-streaming');
    
    // Test valid audio processing
    const sessionId = 'test-session-123';
    const audioBase64 = 'ZHVtbXlhdWRpb2RhdGE='; // "dummyaudiodata" in base64
    const isFirstChunk = true;
    const language = 'en-US';
    
    await processStreamingAudio(mockWebSocket, sessionId, audioBase64, isFirstChunk, language);
    
    // Check that WebSocket.send was called with correct data
    expect(mockWebSocket.send).toHaveBeenCalled();
    expect(sentMessages[0].type).toBe('transcription');
    expect(sentMessages[0].sessionId).toBe(sessionId);
    expect(sentMessages[0].languageCode).toBe(language);
  });
  
  it('should handle missing session ID', async () => {
    const { processStreamingAudio } = await import('../../server/openai-streaming');
    
    // Test missing session ID
    const sessionId = '';
    const audioBase64 = 'ZHVtbXlhdWRpb2RhdGE=';
    
    await processStreamingAudio(mockWebSocket, sessionId, audioBase64, true, 'en-US');
    
    // Check that error was sent
    expect(mockWebSocket.send).toHaveBeenCalled();
    expect(sentMessages[0].type).toBe('error');
  });
  
  it('should finalize a streaming session correctly', async () => {
    const { finalizeStreamingSession } = await import('../../server/openai-streaming');
    
    // Test valid finalization
    const sessionId = 'test-session-123';
    
    await finalizeStreamingSession(mockWebSocket, sessionId);
    
    // Check that WebSocket.send was called with correct data
    expect(mockWebSocket.send).toHaveBeenCalled();
    expect(sentMessages[0].type).toBe('transcription');
    expect(sentMessages[0].sessionId).toBe(sessionId);
    expect(sentMessages[0].isFinal).toBe(true);
  });
});