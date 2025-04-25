// Simple WebSocket client tests

console.log('Running WebSocket client tests...');

// Mock WebSocket for testing
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = 1; // WebSocket.OPEN
    console.log(`  Created mock WebSocket with URL: ${url}`);
    
    // Call onopen after a small delay to simulate connection
    setTimeout(() => {
      if (this.onopen) this.onopen();
    }, 10);
  }
  
  send(data) {
    console.log(`  Sent data: ${data.substring(0, 30)}...`);
    return true;
  }
  
  close() {
    console.log('  WebSocket closed');
    if (this.onclose) this.onclose();
  }
}

// Add the WebSocket as a global
globalThis.WebSocket = MockWebSocket;

// Simplified WebSocket client for testing
class WebSocketClient {
  constructor() {
    this.ws = null;
    this.status = 'disconnected';
    this.listeners = new Map();
  }
  
  connect() {
    console.log('  Connecting to WebSocket...');
    if (this.ws && this.ws.readyState === 1) {
      console.log('  Already connected');
      return;
    }
    
    this.status = 'connecting';
    this.notifyListeners('status', this.status);
    
    const wsUrl = 'ws://localhost:5000/ws';
    this.ws = new WebSocket(wsUrl);
    
    this.ws.onopen = () => {
      console.log('  Connection established');
      this.status = 'connected';
      this.notifyListeners('status', this.status);
    };
    
    this.ws.onclose = () => {
      console.log('  Connection closed');
      this.status = 'disconnected';
      this.notifyListeners('status', this.status);
    };
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
    if (this.ws && this.ws.readyState === 1) {
      return this.ws.send(JSON.stringify(message));
    }
    return false;
  }
  
  addEventListener(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }
  
  removeEventListener(event, callback) {
    const callbacks = this.listeners.get(event);
    if (!callbacks) return;
    
    const index = callbacks.indexOf(callback);
    if (index !== -1) {
      callbacks.splice(index, 1);
    }
  }
  
  notifyListeners(event, data) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(cb => cb(data));
    }
  }
  
  getStatus() {
    return this.status;
  }
}

// Tests
function runTests() {
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
  
  try {
    console.log('\nTest 1: Connection management');
    const client = new WebSocketClient();
    let statusChanges = [];
    
    client.addEventListener('status', (status) => {
      statusChanges.push(status);
    });
    
    // Test initial state
    assert(client.getStatus() === 'disconnected', 'Initial status should be disconnected');
    
    // Connect
    client.connect();
    
    // Need to wait for async operations
    setTimeout(() => {
      assert(client.getStatus() === 'connected', 'Status should be connected after connect()');
      
      // Test event listener
      assert(statusChanges.length >= 2, 'Status changes should be tracked');
      assert(statusChanges.includes('connecting'), 'Status should change to connecting during connection');
      assert(statusChanges.includes('connected'), 'Status should change to connected after connection');
      
      console.log('\nTest 2: Message sending');
      const sendResult = client.send({ type: 'test', data: 'test-data' });
      assert(sendResult, 'Sending message should succeed when connected');
      
      console.log('\nTest 3: Disconnection');
      client.disconnect();
      assert(client.getStatus() === 'disconnected', 'Status should be disconnected after disconnect()');
      
      // Final results
      const totalTests = passCount + failCount;
      console.log(`\nTest summary: ${passCount}/${totalTests} tests passed, ${failCount} failed`);
      
      if (failCount > 0) {
        process.exit(1);
      }
    }, 100);
    
  } catch (error) {
    console.error('Test error:', error);
    process.exit(1);
  }
}

// Run tests after a short delay to let the mocks initialize
setTimeout(runTests, 10);