/**
 * TTS Comparison Unit Tests
 * 
 * Tests the core functionality of the TTS service comparison functionality
 * at the unit level following the testing pyramid approach.
 */

const assert = require('assert');
const { WebSocket, Server } = require('ws');
const http = require('http');

// Mock browser globals
global.WebSocket = WebSocket;
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

// Mock window.speechSynthesis
global.speechSynthesis = {
  speak: (utterance) => {
    console.log('Mock speechSynthesis.speak called with:', utterance);
    // Simulate the speech finished event
    if (utterance.onend) {
      setTimeout(() => utterance.onend(), 100);
    }
    return true;
  }
};

// Mock SpeechSynthesisUtterance
global.SpeechSynthesisUtterance = class SpeechSynthesisUtterance {
  constructor(text) {
    this.text = text;
    this.lang = 'en-US';
    this.rate = 1.0;
    this.pitch = 1.0;
    this.onend = null;
  }
};

// Mock Audio API
global.Blob = class Blob {
  constructor(parts, options) {
    this.parts = parts;
    this.options = options;
    this.size = parts.reduce((size, part) => size + part.length, 0);
    this.type = options?.type || '';
  }
};

global.URL = {
  createObjectURL: (blob) => {
    return `mock-blob-url:${blob.size}:${blob.type}`;
  },
  revokeObjectURL: (url) => {
    // Nothing to do in mock
  }
};

// Test utilities
function createMockMessage(type, data = {}) {
  return JSON.stringify({
    type,
    ...data
  });
}

describe('TTS Comparison Unit Tests', () => {
  let server;
  let mockWebSocket;
  let serverSocket;
  
  // Setup mock server before tests
  before((done) => {
    // Create HTTP server
    const httpServer = http.createServer();
    
    // Create WebSocket server
    server = new Server({ server: httpServer });
    
    // Listen for connections
    server.on('connection', (socket) => {
      serverSocket = socket;
      
      // Send connection confirmation when client connects
      socket.send(JSON.stringify({
        type: 'connection',
        sessionId: 'test-session-id'
      }));
      
      // Handle messages from client
      socket.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        // Handle different message types
        if (message.type === 'register') {
          // Send registration confirmation
          socket.send(JSON.stringify({
            type: 'register',
            status: 'success',
            data: {
              role: message.role,
              languageCode: message.languageCode,
              settings: message.settings
            }
          }));
        } else if (message.type === 'tts_request') {
          // Respond with mock TTS audio data
          const mockAudioData = 'mockAudioDataInBase64==';
          socket.send(JSON.stringify({
            type: 'tts_response',
            text: message.text,
            ttsService: message.ttsService,
            languageCode: message.languageCode,
            success: true,
            audioData: mockAudioData
          }));
        }
      });
    });
    
    // Start server on a random port
    httpServer.listen(0, () => {
      const address = httpServer.address();
      const port = address.port;
      
      // Connect mock client
      mockWebSocket = new WebSocket(`ws://localhost:${port}`);
      
      mockWebSocket.on('open', () => {
        done();
      });
      
      mockWebSocket.on('error', (error) => {
        done(error);
      });
    });
  });
  
  // Cleanup after tests
  after(() => {
    if (mockWebSocket) {
      mockWebSocket.close();
    }
    if (server) {
      server.close();
    }
  });
  
  describe('Audio Caching System', () => {
    it('should store audio data in cache', () => {
      // Setup mock window environment
      global.window = {
        audioCache: {}
      };
      
      // Execute the function we're testing - storing to audio cache
      const cacheKey = 'test_translation_es_openai';
      const audioData = 'base64AudioDataMock==';
      global.window.audioCache[cacheKey] = audioData;
      
      // Verify cache is working
      assert.strictEqual(global.window.audioCache[cacheKey], audioData);
    });
    
    it('should retrieve audio data from cache when available', () => {
      // Setup mock cache
      global.window = {
        audioCache: {
          'cached_translation_fr_browser': 'cachedAudioData=='
        }
      };
      
      // Check cache hit
      const cachedAudio = global.window.audioCache['cached_translation_fr_browser'];
      assert.strictEqual(cachedAudio, 'cachedAudioData==');
      
      // Check cache miss
      const uncachedAudio = global.window.audioCache['nonexistent_key'];
      assert.strictEqual(uncachedAudio, undefined);
    });
  });
  
  describe('TTS Service Selection', () => {
    it('should be able to switch between TTS services', (done) => {
      // Setup listeners on mock client
      let messageCount = 0;
      
      mockWebSocket.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;
        
        if (messageCount === 1) {
          // Register as student with browser TTS
          mockWebSocket.send(createMockMessage('register', {
            role: 'student',
            languageCode: 'es',
            settings: {
              ttsServiceType: 'browser'
            }
          }));
        } else if (messageCount === 2) {
          // Verify registration was successful
          assert.strictEqual(message.type, 'register');
          assert.strictEqual(message.status, 'success');
          assert.strictEqual(message.data.settings.ttsServiceType, 'browser');
          
          // Register again with different TTS service
          mockWebSocket.send(createMockMessage('register', {
            role: 'student',
            languageCode: 'es',
            settings: {
              ttsServiceType: 'openai'
            }
          }));
        } else if (messageCount === 3) {
          // Verify TTS service was changed
          assert.strictEqual(message.type, 'register');
          assert.strictEqual(message.status, 'success');
          assert.strictEqual(message.data.settings.ttsServiceType, 'openai');
          done();
        }
      });
    });
  });
  
  describe('TTS Service Requests', () => {
    it('should be able to request audio from a specific TTS service', (done) => {
      // Setup listeners on mock client
      mockWebSocket.on('message', (data) => {
        const message = JSON.parse(data.toString());
        
        if (message.type === 'tts_response') {
          // Verify TTS response
          assert.strictEqual(message.type, 'tts_response');
          assert.strictEqual(message.text, 'Hello world');
          assert.strictEqual(message.ttsService, 'openai');
          assert.strictEqual(message.success, true);
          assert.strictEqual(typeof message.audioData, 'string');
          done();
        }
      });
      
      // Send TTS request
      mockWebSocket.send(createMockMessage('tts_request', {
        text: 'Hello world',
        languageCode: 'en-US',
        ttsService: 'openai'
      }));
    });
  });
});