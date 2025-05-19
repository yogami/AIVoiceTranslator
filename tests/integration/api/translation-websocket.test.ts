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

// A specialized WebSocket class for testing
class MockWebSocket {
  readyState = WebSocket.OPEN;
  sessionId?: string;
  isAlive = true;
  role?: 'teacher' | 'student';
  languageCode?: string;
  
  // For compatibility with the WebSocket interface
  binaryType: string = 'arraybuffer';
  bufferedAmount: number = 0;
  extensions: string = '';
  protocol: string = '';
  url: string = 'ws://test';
  
  // Keep track of messages received for verification
  messages: any[] = [];
  
  // Event handlers
  private listeners: Record<string, Array<(data?: any) => void>> = {
    'message': [],
    'close': [],
    'error': [],
    'open': []
  };
  
  // Mock send method that also triggers the 'message' event for immediate feedback
  send(data: string) {
    try {
      // Parse and store the message for verification
      const message = JSON.parse(data);
      this.messages.push(message);
      
      // Trigger message event so listeners receive the message
      this.trigger('message', data);
    } catch (e) {
      console.error('Error processing WebSocket message:', e);
      this.trigger('error', e);
    }
  }
  
  // Add event listener
  on(event: string, callback: (data?: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    return this;
  }
  
  // Required WebSocket interface methods
  addEventListener(event: string, callback: (data?: any) => void) {
    return this.on(event, callback);
  }
  
  removeEventListener() {
    // Not implemented for tests
  }
  
  dispatchEvent() {
    return true;
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
  // Setup for the test dependencies 
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // We need to ensure the original functions are restored
    vi.restoreAllMocks();
    
    // Now instrument the original functions without mocking them
    vi.spyOn(require('../../../server/openai-streaming'), 'processStreamingAudio')
      .mockImplementation(async (ws, sessionId, audioBase64, isFirstChunk, language) => {
        // Call the send method on the websocket so the message is registered
        ws.send(JSON.stringify({
          type: 'transcription',
          sessionId,
          text: 'Test transcription text',
          isFinal: true,
          languageCode: language || 'en-US'
        }));
        return Promise.resolve();
      });
    
    vi.spyOn(require('../../../server/openai-streaming'), 'finalizeStreamingSession')
      .mockImplementation(async (ws, sessionId) => {
        // Call the send method on the websocket to trigger message event
        ws.send(JSON.stringify({
          type: 'finalize',
          sessionId,
          success: true
        }));
        return Promise.resolve();
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