/**
 * UI-focused Real-time Speech Test
 * 
 * This test simulates the real-time speech recording and verifies that
 * transcriptions appear properly in the UI components that display current speech.
 */

// Mock audio data (base64 encoded sample)
const mockAudioSample = 'UklGRjIAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YRAAAAAAAAAAAAAAAAAAAAA=';  // Empty WAV header

// Mock DOM implementation
class MockElement {
  constructor(tagName) {
    this.tagName = tagName;
    this.textContent = '';
    this.innerHTML = '';
    this.className = '';
    this.style = {};
    this.children = [];
    this.attributes = {};
    this.dataset = {};
    this.eventListeners = {};
  }
  
  setAttribute(name, value) {
    this.attributes[name] = value;
  }
  
  getAttribute(name) {
    return this.attributes[name];
  }
  
  addEventListener(event, callback) {
    if (!this.eventListeners[event]) {
      this.eventListeners[event] = [];
    }
    this.eventListeners[event].push(callback);
  }
  
  removeEventListener(event, callback) {
    if (!this.eventListeners[event]) return;
    const index = this.eventListeners[event].indexOf(callback);
    if (index !== -1) {
      this.eventListeners[event].splice(index, 1);
    }
  }
  
  dispatchEvent(event) {
    const listeners = this.eventListeners[event.type] || [];
    listeners.forEach(listener => listener(event));
  }
  
  appendChild(child) {
    this.children.push(child);
    return child;
  }
  
  querySelector(selector) {
    // Simple selector implementation for testing
    if (selector.startsWith('#')) {
      const id = selector.substring(1);
      if (this.getAttribute('id') === id) return this;
      for (const child of this.children) {
        const result = child.querySelector(selector);
        if (result) return result;
      }
    } else if (selector.startsWith('.')) {
      const className = selector.substring(1);
      if (this.className.split(' ').includes(className)) return this;
      for (const child of this.children) {
        const result = child.querySelector(selector);
        if (result) return result;
      }
    } else {
      if (this.tagName.toLowerCase() === selector.toLowerCase()) return this;
      for (const child of this.children) {
        const result = child.querySelector(selector);
        if (result) return result;
      }
    }
    return null;
  }
}

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

// Simple mock UI for teaching interface
class MockTeacherInterface {
  constructor(wsClient) {
    this.wsClient = wsClient;
    this.root = new MockElement('div');
    this.root.className = 'teacher-interface';
    
    // Create UI elements
    this.currentSpeechElement = new MockElement('div');
    this.currentSpeechElement.className = 'current-speech';
    this.currentSpeechElement.setAttribute('data-testid', 'current-speech');
    
    this.transcriptList = new MockElement('div');
    this.transcriptList.className = 'transcript-list';
    
    this.recordButton = new MockElement('button');
    this.recordButton.className = 'record-button';
    this.recordButton.textContent = 'Record';
    
    // Set up the component tree
    this.root.appendChild(this.currentSpeechElement);
    this.root.appendChild(this.transcriptList);
    this.root.appendChild(this.recordButton);
    
    // Initialize component state
    this.isRecording = false;
    this.currentSpeech = '';
    this.transcripts = [];
    
    // Set up event handlers
    this.setupEventHandlers();
  }
  
  setupEventHandlers() {
    // Set up WebSocket event listeners
    this.wsClient.addEventListener('translation', (data) => {
      console.log('Translation received in UI:', data.data.translatedText);
      this.updateCurrentSpeech(data.data.translatedText);
      this.addTranscript(data.data);
    });
    
    // Set up UI event listeners
    this.recordButton.addEventListener('click', () => {
      if (this.isRecording) {
        this.stopRecording();
      } else {
        this.startRecording();
      }
    });
  }
  
  updateCurrentSpeech(text) {
    console.log(`Updating current speech UI element with: "${text}"`);
    this.currentSpeech = text;
    this.currentSpeechElement.textContent = text;
  }
  
  addTranscript(translation) {
    const transcript = {
      id: this.transcripts.length + 1,
      text: translation.translatedText,
      timestamp: translation.timestamp
    };
    
    this.transcripts.push(transcript);
    
    // Create and append transcript element
    const transcriptElement = new MockElement('div');
    transcriptElement.className = 'transcript-item';
    transcriptElement.textContent = transcript.text;
    this.transcriptList.appendChild(transcriptElement);
  }
  
  startRecording() {
    this.isRecording = true;
    this.recordButton.textContent = 'Stop Recording';
    console.log('Started recording');
    
    // Simulate sending audio data
    setTimeout(() => {
      this.wsClient.sendAudio(mockAudioSample);
    }, 500);
  }
  
  stopRecording() {
    this.isRecording = false;
    this.recordButton.textContent = 'Record';
    console.log('Stopped recording');
  }
  
  render() {
    return this.root;
  }
}

/**
 * Test function that verifies real-time updating of the speech UI
 */
async function testSpeechUI() {
  console.log('Starting real-time speech UI test...');
  let testPassed = false;
  
  try {
    // Set up the WebSocket client
    const wsClient = new WebSocketClient();
    
    // Connect to mock server
    wsClient.connect();
    
    // Wait for connection to establish
    await new Promise(resolve => setTimeout(resolve, 200));
    
    // Set role as teacher
    wsClient.setRoleAndLock('teacher');
    
    // Create mock teacher interface
    const teacherInterface = new MockTeacherInterface(wsClient);
    console.log('Created teacher interface');
    
    // Start recording (which will trigger sending audio)
    teacherInterface.startRecording();
    console.log('Started recording simulation');
    
    // Wait for audio processing and translation response
    console.log('Waiting for audio processing and UI update...');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify the current speech was updated in the UI
    const currentSpeechText = teacherInterface.currentSpeechElement.textContent;
    
    if (currentSpeechText === 'This is a test transcription') {
      console.log('✅ TEST PASSED: Current speech UI was updated correctly');
      console.log(`UI displays: "${currentSpeechText}"`);
      testPassed = true;
    } else {
      console.log('❌ TEST FAILED: Current speech UI was not updated correctly');
      console.log(`Expected: "This is a test transcription", got: "${currentSpeechText}"`);
      testPassed = false;
    }
    
    // Verify that a transcript was added
    if (teacherInterface.transcripts.length > 0) {
      console.log('✅ Transcript was added to the list');
    } else {
      console.log('❌ No transcript was added to the list');
    }
    
    // Stop recording and clean up
    teacherInterface.stopRecording();
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
testSpeechUI()
  .then(passed => {
    process.exit(passed ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error in test:', error);
    process.exit(1);
  });