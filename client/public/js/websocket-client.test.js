/**
 * Unit tests for WebSocketClient
 * Following TDD approach from the Working Agreement
 */

// Define WebSocket states for testing
const WebSocketState = {
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3
};

// WebSocket event types
const WebSocketEventTypes = {
  OPEN: 'open',
  CLOSE: 'close',
  ERROR: 'error',
  MESSAGE: 'message',
  STATUS: 'status',
  TRANSLATION: 'translation'
};

// Connection status enum
const ConnectionStatus = {
  DISCONNECTED: 'disconnected',
  CONNECTING: 'connecting',
  CONNECTED: 'connected',
  ERROR: 'error'
};

// WebSocketClient definition for testing
class WebSocketClient {
  constructor(webSocketFactory) {
    this.webSocketFactory = webSocketFactory;
    this.wsPath = '/ws';
    
    // Connection state
    this.ws = null;
    this.sessionId = null;
    this.role = null;
    this.status = ConnectionStatus.DISCONNECTED;
    
    // Event handling
    this.eventListeners = new Map();
    
    // Reconnection settings
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }
  
  connect() {
    return new Promise((resolve, reject) => {
      if (this.status === ConnectionStatus.CONNECTED || this.status === ConnectionStatus.CONNECTING) {
        resolve();
        return;
      }
      
      this.status = ConnectionStatus.CONNECTING;
      this.notifyListeners(WebSocketEventTypes.STATUS, this.status);
      
      try {
        this.ws = this.webSocketFactory.createWebSocket('ws://localhost:3000/ws');
        
        this.ws.onopen = () => {
          this.status = ConnectionStatus.CONNECTED;
          this.notifyListeners(WebSocketEventTypes.STATUS, this.status);
          this.notifyListeners(WebSocketEventTypes.OPEN);
          resolve();
        };
        
        this.ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            if (message.type === 'connection' && message.sessionId) {
              this.sessionId = message.sessionId;
              this.notifyListeners('sessionId', this.sessionId);
            }
            this.notifyListeners(WebSocketEventTypes.MESSAGE, message);
          } catch (error) {
            console.error(error);
          }
        };
        
        this.ws.onclose = (event) => {
          this.status = ConnectionStatus.DISCONNECTED;
          this.notifyListeners(WebSocketEventTypes.STATUS, this.status);
          this.notifyListeners(WebSocketEventTypes.CLOSE, event);
        };
        
        this.ws.onerror = (error) => {
          this.status = ConnectionStatus.ERROR;
          this.notifyListeners(WebSocketEventTypes.STATUS, this.status);
          this.notifyListeners(WebSocketEventTypes.ERROR, error);
          reject(error);
        };
      } catch (error) {
        this.status = ConnectionStatus.ERROR;
        this.notifyListeners(WebSocketEventTypes.STATUS, this.status);
        this.notifyListeners(WebSocketEventTypes.ERROR, error);
        reject(error);
      }
    });
  }
  
  notifyListeners(type, data) {
    if (this.eventListeners.has(type)) {
      this.eventListeners.get(type).forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          console.error(error);
        }
      });
    }
  }
  
  addEventListener(type, callback) {
    if (!this.eventListeners.has(type)) {
      this.eventListeners.set(type, new Set());
    }
    this.eventListeners.get(type).add(callback);
  }
  
  removeEventListener(type, callback) {
    if (this.eventListeners.has(type)) {
      this.eventListeners.get(type).delete(callback);
    }
  }
  
  getStatus() {
    return this.status;
  }
  
  getSessionId() {
    return this.sessionId;
  }
  
  send(message) {
    if (this.ws && this.ws.readyState === WebSocketState.OPEN) {
      this.ws.send(JSON.stringify(message));
      return true;
    }
    return false;
  }
}

// Mock WebSocket implementation for testing
class MockWebSocket {
  constructor(url) {
    this.url = url;
    this.readyState = WebSocketState.CONNECTING;
    this.sent = [];
    this.closed = false;
    
    // Event handlers
    this.onopen = null;
    this.onclose = null;
    this.onerror = null;
    this.onmessage = null;
    
    // Log creation for test verification
    console.log('[MockWebSocket] Created with URL:', url);
  }
  
  // Simulate successful connection
  simulateConnection() {
    if (this.onopen) {
      console.log('[MockWebSocket] Simulating connection');
      this.readyState = WebSocketState.OPEN;
      this.onopen();
      return true;
    }
    return false;
  }
  
  // Simulate incoming message
  simulateMessage(data) {
    if (this.onmessage) {
      console.log('[MockWebSocket] Simulating message:', data);
      this.onmessage({ data: JSON.stringify(data) });
      return true;
    }
    return false;
  }
  
  // Simulate connection close
  simulateClose(code = 1000, reason = 'Normal closure') {
    if (this.onclose) {
      console.log('[MockWebSocket] Simulating close:', code, reason);
      this.readyState = WebSocketState.CLOSED;
      this.onclose({ code, reason });
      return true;
    }
    return false;
  }
  
  // Simulate connection error
  simulateError(error = 'Connection error') {
    if (this.onerror) {
      console.log('[MockWebSocket] Simulating error:', error);
      this.onerror(error);
      return true;
    }
    return false;
  }
  
  // WebSocket API methods
  send(message) {
    if (this.readyState !== WebSocketState.OPEN) {
      throw new Error('WebSocket is not open');
    }
    
    console.log('[MockWebSocket] Sending message:', message);
    this.sent.push(message);
  }
  
  close(code, reason) {
    console.log('[MockWebSocket] Closing connection:', code, reason);
    this.closed = true;
    this.readyState = WebSocketState.CLOSED;
    
    if (this.onclose) {
      this.onclose({ code, reason });
    }
  }
  
  ping() {
    console.log('[MockWebSocket] Ping');
  }
}

// Mock WebSocket Factory for testing
class MockWebSocketFactory {
  constructor() {
    this.lastCreatedSocket = null;
  }
  
  createWebSocket(url) {
    this.lastCreatedSocket = new MockWebSocket(url);
    return this.lastCreatedSocket;
  }
}

// Test assertions
function expect(actual) {
  return {
    toBe: (expected) => {
      if (actual !== expected) {
        throw new Error(`Expected ${expected} but got ${actual}`);
      }
      return true;
    },
    toContain: (expected) => {
      if (!actual.includes(expected)) {
        throw new Error(`Expected ${actual} to contain ${expected}`);
      }
      return true;
    },
    toBeTruthy: () => {
      if (!actual) {
        throw new Error(`Expected ${actual} to be truthy`);
      }
      return true;
    },
    toBeFalsy: () => {
      if (actual) {
        throw new Error(`Expected ${actual} to be falsy`);
      }
      return true;
    },
    toEqual: (expected) => {
      const stringify = (obj) => JSON.stringify(obj, null, 2);
      if (stringify(actual) !== stringify(expected)) {
        throw new Error(`Expected ${stringify(expected)} but got ${stringify(actual)}`);
      }
      return true;
    }
  };
}

// Test runner
class TestRunner {
  constructor() {
    this.tests = [];
    this.passCount = 0;
    this.failCount = 0;
    this.currentTest = '';
  }
  
  test(name, fn) {
    this.tests.push({ name, fn });
  }
  
  async runTests() {
    for (const { name, fn } of this.tests) {
      this.currentTest = name;
      try {
        console.log(`Running test: ${name}`);
        await fn();
        console.log(`✓ ${name}`);
        this.passCount++;
      } catch (error) {
        console.error(`✗ ${name}`);
        console.error(`  Error: ${error.message}`);
        this.failCount++;
      }
    }
    
    this.printSummary();
  }
  
  printSummary() {
    console.log('\nTest Summary:');
    console.log(`✓ ${this.passCount} passing`);
    console.log(`✗ ${this.failCount} failing`);
    console.log('Total:', this.passCount + this.failCount);
  }
}

// Run tests
async function runAllTests() {
  const runner = new TestRunner();
  
  // Test WebSocketClient connect method
  runner.test('should connect successfully', async () => {
    // Arrange
    const factory = new MockWebSocketFactory();
    const client = new WebSocketClient(factory);
    let openEventFired = false;
    
    client.addEventListener('open', () => {
      openEventFired = true;
    });
    
    // Act
    const connectPromise = client.connect();
    factory.lastCreatedSocket.simulateConnection();
    await connectPromise;
    
    // Assert
    expect(client.getStatus()).toBe('connected');
    expect(openEventFired).toBeTruthy();
  });
  
  runner.test('should handle connection message with session ID', async () => {
    // Arrange
    const factory = new MockWebSocketFactory();
    const client = new WebSocketClient(factory);
    const sessionId = 'test-session-123';
    
    // Act
    const connectPromise = client.connect();
    factory.lastCreatedSocket.simulateConnection();
    factory.lastCreatedSocket.simulateMessage({
      type: 'connection',
      sessionId: sessionId
    });
    await connectPromise;
    
    // Assert
    expect(client.getSessionId()).toBe(sessionId);
  });
  
  runner.test('should handle connection error', async () => {
    // Arrange
    const factory = new MockWebSocketFactory();
    const client = new WebSocketClient(factory);
    let errorEventFired = false;
    
    client.addEventListener('error', () => {
      errorEventFired = true;
    });
    
    // Act
    const connectPromise = client.connect().catch(() => {});
    factory.lastCreatedSocket.simulateError('Connection error');
    await connectPromise;
    
    // Assert
    expect(client.getStatus()).toBe('error');
    expect(errorEventFired).toBeTruthy();
  });
  
  runner.test('should handle connection close', async () => {
    // Arrange
    const factory = new MockWebSocketFactory();
    const client = new WebSocketClient(factory);
    let closeEventFired = false;
    
    client.addEventListener('close', () => {
      closeEventFired = true;
    });
    
    // Act
    const connectPromise = client.connect();
    factory.lastCreatedSocket.simulateConnection();
    await connectPromise;
    
    factory.lastCreatedSocket.simulateClose(1000, 'Normal closure');
    
    // Assert
    expect(client.getStatus()).toBe('disconnected');
    expect(closeEventFired).toBeTruthy();
  });
  
  runner.test('should notify listeners of messages', async () => {
    // Arrange
    const factory = new MockWebSocketFactory();
    const client = new WebSocketClient(factory);
    let messageReceived = null;
    
    client.addEventListener('message', (message) => {
      messageReceived = message;
    });
    
    // Act
    const connectPromise = client.connect();
    factory.lastCreatedSocket.simulateConnection();
    await connectPromise;
    
    const testMessage = { type: 'test', data: 'Hello, World!' };
    factory.lastCreatedSocket.simulateMessage(testMessage);
    
    // Assert
    expect(messageReceived).toEqual(testMessage);
  });
  
  // Run all tests
  await runner.runTests();
  
  return runner.failCount === 0;
}

// Execute tests when the script is loaded
(async function() {
  console.log('Starting WebSocketClient tests...');
  const success = await runAllTests();
  
  if (success) {
    console.log('All tests passed!');
  } else {
    console.error('Some tests failed.');
  }
})();
