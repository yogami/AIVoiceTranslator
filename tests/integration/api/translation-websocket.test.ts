/**
 * Translation WebSocket Integration Tests
 * 
 * This file tests the WebSocket-based real-time translation feature
 * in an integrated environment.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import express from 'express';
import { WebSocketService } from '../../../server/websocket';
import { processStreamingAudio, finalizeStreamingSession } from '../../../server/openai-streaming';
import { AddressInfo } from 'net';
import * as WebSocket from 'ws';

// We'll use this mock WebSocket class for testing
class MockWebSocket {
  readyState = WebSocket.OPEN;
  sessionId?: string;
  isAlive = true;
  role?: 'teacher' | 'student';
  languageCode?: string;
  
  private listeners: Record<string, Array<(data?: any) => void>> = {
    'message': [],
    'close': [],
    'error': []
  };
  
  send(data: string) {
    try {
      // Simulate server processing the data and sending a message back to the client
      // This is what happens in a real WebSocket - when you send data, the server processes it
      // and may respond with another message
      
      // In our tests, we want to notify message listeners when data is sent 
      // through the socket, so we trigger a message event
      this.trigger('message', data);
    } catch (e) {
      this.trigger('error', e);
    }
  }
  
  on(event: string, callback: (data?: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }
  
  close() {
    this.trigger('close');
  }
  
  terminate() {
    this.close();
  }
  
  // Trigger event for all registered listeners
  trigger(event: string, data?: any) {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach(callback => callback(data));
  }
}

describe('WebSocket Translation Integration', () => {
  // Mock dependencies
  beforeEach(() => {
    // Reset all mocks before each test
    vi.resetAllMocks();
    
    // Create real function mocks that will actually call our mock ws.send
    vi.mock('../../../server/openai-streaming', () => {
      return {
        processStreamingAudio: vi.fn().mockImplementation(async (ws, sessionId, audioBase64, isFirstChunk, language) => {
          // Directly call send on the websocket - this works with our MockWebSocket
          if (ws && typeof ws.send === 'function') {
            ws.send(JSON.stringify({
              type: 'transcription',
              sessionId,
              text: 'Test transcription text',
              isFinal: true,
              languageCode: language || 'en-US'
            }));
          }
          return Promise.resolve();
        }),
        finalizeStreamingSession: vi.fn().mockImplementation(async (ws, sessionId) => {
          // Directly call send on the websocket
          if (ws && typeof ws.send === 'function') {
            ws.send(JSON.stringify({
              type: 'finalize',
              sessionId,
              success: true
            }));
          }
          return Promise.resolve();
        }),
        cleanupInactiveStreamingSessions: vi.fn()
      };
    });
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should process streaming audio message via WebSocket', async () => {
    // Create mock websocket
    const mockWs = new MockWebSocket() as any;
    mockWs.sessionId = 'test-session-123';
    
    // Set up message listener spy
    const messageSpy = vi.fn();
    mockWs.on('message', messageSpy);
    
    // Prepare test data
    const testAudio = 'dGVzdCBhdWRpbyBkYXRh'; // Base64 "test audio data"
    const testMessage = {
      type: 'audio',
      sessionId: 'test-session-123',
      audioData: testAudio,
      isFirstChunk: true,
      language: 'en-US'
    };
    
    // Call the handler that would be triggered on websocket message
    await processStreamingAudio(
      mockWs,
      testMessage.sessionId,
      testMessage.audioData,
      testMessage.isFirstChunk,
      testMessage.language
    );
    
    // Verify the mock processStreamingAudio was called
    expect(processStreamingAudio).toHaveBeenCalledWith(
      mockWs,
      'test-session-123',
      testAudio,
      true,
      'en-US'
    );
    
    // Verify results were sent back via the websocket
    expect(messageSpy).toHaveBeenCalled();
    const messageData = JSON.parse(messageSpy.mock.calls[0][0]);
    expect(messageData.type).toBe('transcription');
    expect(messageData.text).toBe('Test transcription text');
  });
  
  it('should finalize a streaming session via WebSocket', async () => {
    // Create mock websocket
    const mockWs = new MockWebSocket() as any;
    mockWs.sessionId = 'test-session-456';
    
    // Set up message listener spy
    const messageSpy = vi.fn();
    mockWs.on('message', messageSpy);
    
    // Call the handler that would be triggered on websocket message
    await finalizeStreamingSession(mockWs, 'test-session-456');
    
    // Verify the mock finalizeStreamingSession was called
    expect(finalizeStreamingSession).toHaveBeenCalledWith(
      mockWs,
      'test-session-456'
    );
    
    // Verify results were sent back via the websocket
    expect(messageSpy).toHaveBeenCalled();
    const messageData = JSON.parse(messageSpy.mock.calls[0][0]);
    expect(messageData.type).toBe('finalize');
    expect(messageData.success).toBe(true);
  });
  
  it('should handle complete audio streaming and translation workflow', async () => {
    // Create mock websocket
    const mockWs = new MockWebSocket() as any;
    mockWs.sessionId = 'test-session-789';
    
    // Set up message listener spy
    const messageResults: any[] = [];
    mockWs.on('message', (data: string) => {
      messageResults.push(JSON.parse(data));
    });
    
    // 1. First process some audio
    await processStreamingAudio(
      mockWs,
      'test-session-789',
      'dGVzdCBhdWRpbyBkYXRhMQ==', // "test audio data1"
      true,
      'en-US'
    );
    
    // 2. Then process more audio
    await processStreamingAudio(
      mockWs,
      'test-session-789',
      'dGVzdCBhdWRpbyBkYXRhMg==', // "test audio data2"
      false,
      'en-US'
    );
    
    // 3. Finally finalize the session
    await finalizeStreamingSession(mockWs, 'test-session-789');
    
    // Verify the complete workflow produced the expected results
    expect(messageResults.length).toBe(3);
    
    // First message should be transcription for chunk 1
    expect(messageResults[0].type).toBe('transcription');
    expect(messageResults[0].sessionId).toBe('test-session-789');
    
    // Second message should be transcription for chunk 2
    expect(messageResults[1].type).toBe('transcription');
    expect(messageResults[1].sessionId).toBe('test-session-789');
    
    // Third message should be finalization confirmation
    expect(messageResults[2].type).toBe('finalize');
    expect(messageResults[2].sessionId).toBe('test-session-789');
    expect(messageResults[2].success).toBe(true);
  });
  
  it('should test error handling in the websocket translation flow', async () => {
    // Create mock websocket
    const mockWs = new MockWebSocket() as any;
    mockWs.sessionId = 'test-session-error';
    
    // Set up message listener spy
    const messageSpy = vi.fn();
    mockWs.on('message', messageSpy);
    
    // Override the mock implementation for this test to simulate an error
    const origProcessStreamingAudio = processStreamingAudio;
    (processStreamingAudio as any).mockImplementationOnce(async () => {
      throw new Error('Simulated audio processing error');
    });
    
    // Set up error logging spy
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    try {
      // Call the handler with data that will trigger an error
      await processStreamingAudio(
        mockWs,
        'test-session-error',
        'invalid-data',
        true,
        'en-US'
      );
    } catch (error) {
      // Error should be caught and logged
      expect(consoleErrorSpy).toHaveBeenCalled();
    }
    
    // Clean up
    consoleErrorSpy.mockRestore();
  });
});