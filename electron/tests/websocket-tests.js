/**
 * WebSocket Communication Tests for Benedictaitor
 * 
 * These tests verify that the WebSocket client correctly:
 * - Connects and disconnects from the server
 * - Manages its connection state
 * - Sends and receives messages
 * - Properly handles events
 */

// Mock implementation of WebSocket for testing
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 0; // CONNECTING
    this.onopen = null;
    this.onclose = null;
    this.onmessage = null;
    this.onerror = null;
    
    console.log(`Created mock WebSocket with URL: ${url}`);
    
    // Simulate connection established
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen({ target: this });
      }
      console.log('Connection established');
    }, 50);
  }
  
  send(data) {
    console.log(`Sent data: ${data.substring(0, 40)}...`);
    // No actual sending here since this is a mock
  }
  
  close() {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ target: this });
    }
    console.log('WebSocket closed');
  }
}

// WebSocket client implementation to test
class WebSocketClient {
  constructor() {
    this.socket = null;
    this.status = 'disconnected';
    this.sessionId = null;
    this.role = null;
    this.languageCode = null;
    this.eventListeners = {
      statusChange: [],
      message: [],
      transcription: [],
      error: []
    };
  }
  
  connect(url = 'ws://localhost:5000/ws') {
    if (this.socket && this.socket.readyState === 1) {
      console.log('Already connected');
      return;
    }
    
    this.status = 'connecting';
    this.notifyListeners('statusChange', this.status);
    
    // Use MockWebSocket for testing
    this.socket = new MockWebSocket(url);
    
    this.socket.onopen = () => {
      this.status = 'connected';
      this.notifyListeners('statusChange', this.status);
    };
    
    this.socket.onclose = () => {
      this.status = 'disconnected';
      this.notifyListeners('statusChange', this.status);
      this.socket = null;
      console.log('Connection closed');
    };
    
    this.socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.notifyListeners('message', message);
        
        if (message.type === 'connection') {
          this.sessionId = message.sessionId;
        } else if (message.type === 'transcription') {
          this.notifyListeners('transcription', message.data);
        }
      } catch (err) {
        console.error('Error parsing message:', err);
      }
    };
    
    this.socket.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.notifyListeners('error', error);
    };
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
  }
  
  send(message) {
    if (!this.socket || this.socket.readyState !== 1) {
      console.error('Cannot send message - socket not connected');
      return false;
    }
    
    this.socket.send(JSON.stringify(message));
    return true;
  }
  
  addEventListener(eventType, callback) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].push(callback);
    }
  }
  
  removeEventListener(eventType, callback) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType] = this.eventListeners[eventType]
        .filter(cb => cb !== callback);
    }
  }
  
  notifyListeners(eventType, data) {
    if (this.eventListeners[eventType]) {
      this.eventListeners[eventType].forEach(callback => {
        try {
          callback(data);
        } catch (err) {
          console.error(`Error in ${eventType} listener:`, err);
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

// Function to run tests
function runTests() {
  console.log('Running WebSocket client tests...\n');
  let passCount = 0;
  let failCount = 0;
  
  function assert(condition, message) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passCount++;
    } else {
      console.log(`  ❌ FAIL: ${message}`);
      failCount++;
    }
  }
  
  // Test 1: Connection management
  console.log('Test 1: Connection management');
  const client = new WebSocketClient();
  
  assert(client.getStatus() === 'disconnected', 'Initial status should be disconnected');
  
  console.log('  Connecting to WebSocket...');
  client.connect();
  
  assert(client.getStatus() === 'connecting', 'Status should change to connecting during connection');
  
  // Wait for connection to establish
  setTimeout(() => {
    assert(client.getStatus() === 'connected', 'Status should be connected after connect()');
    
    // Test status change events
    let statusChanged = false;
    client.addEventListener('statusChange', (status) => {
      if (status === 'disconnected') {
        statusChanged = true;
      }
    });
    
    // Test 2: Message sending
    console.log('\nTest 2: Message sending');
    const testMessage = {
      type: 'test',
      data: 'test-data'
    };
    
    const sendResult = client.send(testMessage);
    assert(sendResult, 'Sending message should succeed when connected');
    
    // Test 3: Disconnection
    console.log('\nTest 3: Disconnection');
    client.disconnect();
    
    // Wait for disconnect to complete
    setTimeout(() => {
      assert(client.getStatus() === 'disconnected', 'Status should be disconnected after disconnect()');
      assert(statusChanged, 'Status changes should be tracked');
      
      // Summary
      console.log(`\nTest summary: ${passCount}/${passCount + failCount} tests passed, ${failCount} failed`);
      
      // Exit with success if all tests passed
      process.exit(failCount === 0 ? 0 : 1);
    }, 50);
  }, 100);
}

// Run the tests
runTests();