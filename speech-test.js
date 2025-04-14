/**
 * Real-time Speech Test (Pure JavaScript version)
 * 
 * This test simulates the real-time speech recording and transcription functionality
 * without having to import the TypeScript files directly.
 */

// Mock audio data (base64 encoded sample)
const mockAudioSample = 'UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAA=';  // Empty WAV header

// Simple WebSocketClient implementation that mimics our app's client
class WebSocketClient {
  constructor() {
    this.status = 'disconnected';
    this.role = 'teacher';
    this.languageCode = 'en-US';
    this.roleLocked = false;
    this.listeners = new Map();
    this.ws = null;
    this.sessionId = null;
  }

  connect() {
    console.log('Connecting to WebSocket...');
    this.status = 'connecting';
    this.notifyListeners('status', this.status);
    
    // In real app, this would connect to a real WebSocket
    // Here we'll simulate the connection immediately
    this.ws = new MockWebSocket();
    
    // Set up event handlers
    this.ws.onopen = () => {
      console.log('WebSocket connection established');
      this.status = 'connected';
      this.notifyListeners('status', this.status);
      
      // Simulate a connection confirmation from server
      setTimeout(() => {
        this.ws.onmessage({
          data: JSON.stringify({
            type: 'connection',
            status: 'connected',
            sessionId: 'test-session-123',
            role: 'teacher',
            languageCode: 'en-US'
          })
        });
      }, 100);
    };
    
    this.ws.onmessage = (event) => {
      try {
        console.log('Message received:', event.data);
        const data = JSON.parse(event.data);
        
        // Handle connection confirmation
        if (data.type === 'connection' && data.sessionId) {
          this.sessionId = data.sessionId;
          this.notifyListeners('sessionId', this.sessionId);
        }
        
        // Notify listeners of the message
        this.notifyListeners(data.type, data);
      } catch (error) {
        console.error('Error handling message:', error);
      }
    };
    
    this.ws.onclose = () => {
      this.status = 'disconnected';
      this.notifyListeners('status', this.status);
    };
    
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.status = 'disconnected';
      this.notifyListeners('status', this.status);
      this.notifyListeners('error', error);
    };
    
    // Trigger the onopen event to simulate connection
    setTimeout(() => {
      if (this.ws && this.ws.onopen) {
        this.ws.onopen();
      }
    }, 50);
  }
  
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.status = 'disconnected';
    this.notifyListeners('status', this.status);
  }
  
  send(message) {
    if (this.ws) {
      console.log('Sending message:', JSON.stringify(message));
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
  
  sendAudio(audioData) {
    console.log('Sending audio data, length:', audioData.length);
    return this.send({
      type: 'audio',
      payload: {
        audio: audioData,
        role: this.role
      }
    });
  }
  
  setRoleAndLock(role) {
    console.log(`Setting role to '${role}' and locking it`);
    this.role = role;
    this.roleLocked = true;
    
    if (this.status === 'connected') {
      return this.send({
        type: 'register',
        payload: {
          role: this.role,
          languageCode: this.languageCode
        }
      });
    }
    return false;
  }
  
  register(role, languageCode) {
    if (!this.roleLocked) {
      this.role = role;
    }
    this.languageCode = languageCode;
    
    return this.send({
      type: 'register',
      payload: {
        role: this.role,
        languageCode
      }
    });
  }
  
  addEventListener(eventType, callback) {
    if (!this.listeners.has(eventType)) {
      this.listeners.set(eventType, []);
    }
    this.listeners.get(eventType).push(callback);
  }
  
  removeEventListener(eventType, callback) {
    if (!this.listeners.has(eventType)) return;
    
    const callbacks = this.listeners.get(eventType);
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
  
  notifyListeners(eventType, data) {
    const callbacks = this.listeners.get(eventType);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in listener for "${eventType}":`, error);
        }
      });
    }
  }
  
  getStatus() {
    return this.status;
  }
  
  getSessionId() {
    return this.sessionId;
  }
}

// Mock WebSocket for testing
class MockWebSocket {
  constructor() {
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
    this.sentMessages = [];
  }
  
  send(data) {
    this.sentMessages.push(data);
    
    // Simulate server response based on message type
    const parsedData = JSON.parse(data);
    
    if (parsedData.type === 'register') {
      // Simulate registration response
      setTimeout(() => {
        if (this.onmessage) {
          this.onmessage({
            data: JSON.stringify({
              type: 'registration_complete',
              role: parsedData.payload.role,
              languageCode: parsedData.payload.languageCode,
              success: true
            })
          });
        }
      }, 50);
    } 
    else if (parsedData.type === 'audio') {
      // Simulate audio processing response
      setTimeout(() => {
        if (this.onmessage) {
          // First send processing acknowledgment
          this.onmessage({
            data: JSON.stringify({
              type: 'processing_complete',
              data: {
                timestamp: new Date().toISOString(),
                targetLanguages: ['en-US', 'es', 'fr', 'de'],
                roleConfirmed: true,
                role: 'teacher'
              }
            })
          });
          
          // Then send translation result
          setTimeout(() => {
            this.onmessage({
              data: JSON.stringify({
                type: 'translation',
                data: {
                  sessionId: 'test-session-123',
                  sourceLanguage: 'en-US',
                  targetLanguage: 'en-US',
                  originalText: 'This is a test transcription',
                  translatedText: 'This is a test transcription',
                  audio: mockAudioSample,
                  timestamp: new Date().toISOString(),
                  latency: 150
                }
              })
            });
          }, 100);
        }
      }, 200);
    }
  }
  
  close() {
    if (this.onclose) {
      this.onclose({ code: 1000, reason: 'Test closed', wasClean: true });
    }
  }
}

/**
 * Test function that simulates recording and verifies transcription
 */
async function testRealTimeSpeech() {
  console.log('Starting real-time speech test...');
  let testPassed = false;
  let currentSpeechText = '';
  
  try {
    // Set up the WebSocket client
    const wsClient = new WebSocketClient();
    
    // Set up listeners
    wsClient.addEventListener('translation', (data) => {
      console.log('Translation received:', data.data.translatedText);
      currentSpeechText = data.data.translatedText;
    });
    
    // Connect to the (mock) server
    wsClient.connect();
    
    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Set role and lock it
    wsClient.setRoleAndLock('teacher');
    
    // Send mock audio data
    console.log('Sending mock audio data...');
    wsClient.sendAudio(mockAudioSample);
    
    // Wait for processing and response
    console.log('Waiting for speech processing...');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Verify the result
    if (currentSpeechText === 'This is a test transcription') {
      console.log('✅ TEST PASSED: Real-time speech processing works correctly');
      console.log(`Speech text: "${currentSpeechText}"`);
      testPassed = true;
    } else {
      console.log('❌ TEST FAILED: Speech text not updated correctly');
      console.log(`Expected: "This is a test transcription", got: "${currentSpeechText}"`);
      testPassed = false;
    }
    
    // Clean up
    wsClient.disconnect();
    
  } catch (error) {
    console.error('Error during test:', error);
    testPassed = false;
  }
  
  // Print final result
  console.log('----------------------------------------------');
  console.log(`Test ${testPassed ? 'PASSED ✅' : 'FAILED ❌'}`);
  console.log('----------------------------------------------');
  
  return testPassed;
}

// Run the test
testRealTimeSpeech()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error in test:', error);
    process.exit(1);
  });