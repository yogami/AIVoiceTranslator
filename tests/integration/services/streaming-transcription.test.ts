/**
 * Streaming Transcription Integration Tests
 * 
 * This file tests the real-time streaming transcription capability 
 * where audio is sent in chunks and transcribed incrementally.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebSocketService } from '../../../server/websocket';
import { processStreamingAudio, finalizeStreamingSession } from '../../../server/openai-streaming';
import { createServer } from 'http';
import express from 'express';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// Create a test-specific WebSocket-like class
class TestWebSocket {
  isAlive = true;
  sessionId?: string;
  role?: 'teacher' | 'student';
  languageCode?: string;
  readyState = 1; // WebSocket.OPEN equivalent
  
  // For compatibility with the WebSocket interface
  binaryType: string = 'arraybuffer';
  bufferedAmount: number = 0;
  extensions: string = '';
  protocol: string = '';
  url: string = 'ws://test';
  onclose: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onopen: ((event: any) => void) | null = null;
  
  constructor() {
    this.sessionId = `test-session-${Date.now()}`;
  }
  
  // Messages received
  messages: any[] = [];
  
  // Simplified send method for testing
  send(data: string): void {
    try {
      const message = JSON.parse(data);
      this.messages.push(message);
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  }
  
  // Required WebSocket interface methods
  close(): void { 
    if (this.onclose) this.onclose({ wasClean: true, code: 1000 });
  }
  
  addEventListener(): void { /* Not needed for our tests */ }
  removeEventListener(): void { /* Not needed for our tests */ }
  dispatchEvent(): boolean { return true; }
}

describe('Streaming Transcription Integration', () => {
  let tempAudioFile: string;
  let audioChunk1: Buffer;
  let audioChunk2: Buffer;
  
  // Setup test audio file
  beforeEach(async () => {
    // Create a temporary file for test audio
    const tempDir = os.tmpdir();
    tempAudioFile = path.join(tempDir, `test-audio-${Date.now()}.wav`);
    
    // Generate a simple test audio file
    // In a real test, you would use a real audio file with speech
    // Here we're just creating a minimal valid WAV file for testing
    const header = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // Chunk size
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // Subchunk1 size
      0x01, 0x00,             // Audio format (PCM)
      0x01, 0x00,             // Num channels (mono)
      0x44, 0xac, 0x00, 0x00, // Sample rate (44100 Hz)
      0x88, 0x58, 0x01, 0x00, // Byte rate
      0x02, 0x00,             // Block align
      0x10, 0x00,             // Bits per sample
      0x64, 0x61, 0x74, 0x61, // "data"
      0x10, 0x00, 0x00, 0x00  // Subchunk2 size (16 bytes of data)
    ]);
    
    // Add some audio data after header
    const audioData = Buffer.alloc(16);
    audioData.fill(1, 0, 8);  // First half full of 1s
    audioData.fill(2, 8, 16); // Second half full of 2s
    
    const completeFile = Buffer.concat([header, audioData]);
    await fs.promises.writeFile(tempAudioFile, completeFile);
    
    // Read the file and split into two chunks for streaming tests
    const fullData = await fs.promises.readFile(tempAudioFile);
    audioChunk1 = fullData.slice(0, header.length + 8); // Header + first half
    audioChunk2 = fullData.slice(header.length + 8);    // Second half
  });
  
  // Clean up test files
  afterEach(async () => {
    try {
      await fs.promises.unlink(tempAudioFile);
    } catch (err) {
      // Ignore errors if file doesn't exist
    }
  });

  it('should process streaming audio in chunks', async () => {
    // Create a test WebSocket connection
    const ws = new TestWebSocket();
    
    // Send first audio chunk (as base64)
    await processStreamingAudio(
      ws as any, 
      ws.sessionId!, 
      audioChunk1.toString('base64'),
      true, // isFirstChunk
      'en-US'
    );
    
    // The chunk may be too small for actual transcription
    // but we can verify the session was created
    
    // Send second audio chunk
    await processStreamingAudio(
      ws as any,
      ws.sessionId!,
      audioChunk2.toString('base64'),
      false, // not first chunk
      'en-US'
    );
    
    // Finalize the session
    await finalizeStreamingSession(ws as any, ws.sessionId!);
    
    // We expect at least one message to be a finalization message
    const finalizationMessages = ws.messages.filter(m => m.type === 'finalize');
    expect(finalizationMessages.length).toBeGreaterThan(0);
    
    if (finalizationMessages.length > 0) {
      expect(finalizationMessages[0].sessionId).toBe(ws.sessionId);
    }
  });

  it('should handle audio chunks with too little data gracefully', async () => {
    // Test with extremely small audio chunks
    const ws = new TestWebSocket();
    const tinyChunk = Buffer.from([0, 1, 2, 3]); // Too small for transcription
    
    // Console spy to catch logged errors
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    try {
      // Process tiny audio chunk
      await processStreamingAudio(
        ws as any,
        ws.sessionId!,
        tinyChunk.toString('base64'),
        true,
        'en-US'
      );
      
      // Finalize immediately
      await finalizeStreamingSession(ws as any, ws.sessionId!);
      
      // We expect either an error message to be sent or a finalize confirmation
      // Either way the test passes as long as it doesn't throw an exception
      expect(true).toBe(true);
    } catch (error) {
      // This should not happen - the function should handle errors gracefully
      expect(error).toBeUndefined();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it('should maintain session state across multiple audio chunks', async () => {
    // For this test, we'll verify the session ID is maintained
    const ws = new TestWebSocket();
    
    // Send multiple audio chunks
    for (let i = 0; i < 3; i++) {
      await processStreamingAudio(
        ws as any,
        ws.sessionId!,
        audioChunk1.toString('base64'), // Use the same chunk for simplicity
        i === 0, // Only first iteration is "first chunk"
        'en-US'
      );
    }
    
    // Finalize the session
    await finalizeStreamingSession(ws as any, ws.sessionId!);
    
    // If session maintenance works correctly, all messages should have same sessionId
    for (const message of ws.messages) {
      if (message.sessionId) {
        expect(message.sessionId).toBe(ws.sessionId);
      }
    }
  });
});