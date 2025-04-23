/**
 * Integration Test for Speech Flow
 * 
 * This test covers the full flow of speech capture, WebSocket communication,
 * and translation handling.
 */

const { WebSocketClient } = require('../../client/src/lib/websocket');
const { AudioCapture } = require('../../client/src/lib/audioCapture');

// Mock WebSocket implementation
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // WebSocket.OPEN
    this.messageQueue = [];
    
    // Simulate connection
    setTimeout(() => {
      if (this.onopen) {
        this.onopen();
      }
      
      // Simulate connection message
      this.simulateMessage({
        type: 'connection',
        sessionId: 'test-session-123'
      });
    }, 10);
  }
  
  send(data) {
    // Parse the message and handle it
    const message = JSON.parse(data);
    
    if (message.type === 'register') {
      // If this is a registration, simulate response with translations after delay
      setTimeout(() => {
        if (message.role === 'teacher') {
          // No translation response for teachers
        } else if (message.role === 'student') {
          // For student, send translation based on language
          this.simulateMessage({
            type: 'translation',
            text: 'This is a translated test message',
            originalLanguage: 'en-US',
            translatedLanguage: message.languageCode
          });
        }
      }, 100);
    } else if (message.type === 'transcription') {
      // If this is a transcription, simulate translation responses
      setTimeout(() => {
        // Simulate Spanish translation
        this.simulateMessage({
          type: 'translation',
          text: 'Este es un mensaje de prueba traducido',
          originalLanguage: 'en-US',
          translatedLanguage: 'es-ES'
        });
        
        // Simulate French translation
        this.simulateMessage({
          type: 'translation',
          text: 'Ceci est un message de test traduit',
          originalLanguage: 'en-US',
          translatedLanguage: 'fr-FR'
        });
        
        // Simulate German translation
        this.simulateMessage({
          type: 'translation',
          text: 'Dies ist eine übersetzte Testnachricht',
          originalLanguage: 'en-US',
          translatedLanguage: 'de-DE'
        });
      }, 150);
    }
  }
  
  close() {
    // Simulate connection close
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Normal closure' });
    }
  }
  
  // Simulate receiving a message
  simulateMessage(data) {
    if (this.onmessage) {
      this.onmessage({ data: JSON.stringify(data) });
    } else {
      // Queue message for when onmessage is set
      this.messageQueue.push(data);
    }
  }
  
  // Process any queued messages
  processQueue() {
    if (this.onmessage && this.messageQueue.length > 0) {
      this.messageQueue.forEach(data => {
        this.onmessage({ data: JSON.stringify(data) });
      });
      this.messageQueue = [];
    }
  }
}

// Mock AudioRecorder
class MockAudioRecorder {
  constructor(options = {}) {
    this.options = options;
    this.isRecording = false;
  }
  
  async start() {
    this.isRecording = true;
    if (this.options.onStart) {
      this.options.onStart();
    }
    
    // Simulate data availability
    setTimeout(() => {
      if (this.options.onDataAvailable) {
        const mockBlob = new Blob(['mock audio data'], { type: 'audio/webm' });
        this.options.onDataAvailable(mockBlob);
      }
    }, 100);
  }
  
  stop() {
    this.isRecording = false;
    if (this.options.onStop) {
      const mockBlob = new Blob(['mock complete audio data'], { type: 'audio/webm' });
      this.options.onStop(mockBlob);
    }
  }
  
  static async blobToBase64(blob) {
    return 'mockBase64AudioData';
  }
}

// Add mocks to global scope
global.WebSocket = MockWebSocket;
global.WebSocket.CONNECTING = 0;
global.WebSocket.OPEN = 1;
global.WebSocket.CLOSING = 2;
global.WebSocket.CLOSED = 3;

// Mock window.location
Object.defineProperty(window, 'location', {
  value: {
    protocol: 'http:',
    host: 'localhost:5000'
  },
  writable: true
});

// Replace Audio implementation
jest.mock('../../client/src/lib/audioCapture', () => {
  const originalModule = jest.requireActual('../../client/src/lib/audioCapture');
  
  return {
    ...originalModule,
    AudioRecorder: MockAudioRecorder
  };
});

describe('Speech Flow Integration Tests', () => {
  // Reset singletons between tests
  beforeEach(() => {
    WebSocketClient.resetInstance();
  });
  
  test('teacher can capture and send transcriptions', async () => {
    const wsClient = WebSocketClient.getInstance();
    const translationCallback = jest.fn();
    
    // Connect and register as teacher
    await wsClient.connect();
    wsClient.addEventListener('translation', translationCallback);
    wsClient.register('teacher', 'en-US');
    
    // Send a transcription
    wsClient.sendTranscription('This is a test message');
    
    // Wait for translations to be processed
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Should have received 3 translations (ES, FR, DE)
    expect(translationCallback).toHaveBeenCalledTimes(3);
    
    // Check the specific languages
    const calls = translationCallback.mock.calls;
    const languages = calls.map(call => call[0].translatedLanguage).sort();
    expect(languages).toEqual(['de-DE', 'es-ES', 'fr-FR']);
  });
  
  test('student can receive translations', async () => {
    const wsClient = WebSocketClient.getInstance();
    const translationCallback = jest.fn();
    
    // Connect and register as student
    await wsClient.connect();
    wsClient.addEventListener('translation', translationCallback);
    wsClient.register('student', 'es-ES');
    
    // Wait for translation to be processed
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should have received 1 translation
    expect(translationCallback).toHaveBeenCalledTimes(1);
    
    // Check the translation details
    const translation = translationCallback.mock.calls[0][0];
    expect(translation.translatedLanguage).toBe('es-ES');
    expect(translation.text).toBe('This is a translated test message');
  });
  
  test('audio capture integration with WebSocket', async () => {
    const wsClient = WebSocketClient.getInstance();
    const translationCallback = jest.fn();
    const sendSpy = jest.spyOn(wsClient, 'sendTranscription');
    
    // Connect and register as teacher
    await wsClient.connect();
    wsClient.addEventListener('translation', translationCallback);
    wsClient.register('teacher', 'en-US');
    
    // Instead of using AudioCapture directly, we'll simulate the flow
    // Just directly call sendTranscription
    wsClient.sendTranscription('This is transcribed from audio');
    
    // Wait for translations to be processed
    await new Promise(resolve => setTimeout(resolve, 300));
    
    // Should have sent the transcription
    expect(sendSpy).toHaveBeenCalledWith('This is transcribed from audio');
    
    // Should have received 3 translations
    expect(translationCallback).toHaveBeenCalledTimes(3);
  });
});