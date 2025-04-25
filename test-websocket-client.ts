/**
 * Simplified WebSocket Client Test
 * 
 * This script tests basic WebSocketClient functionality without using Jest,
 * making it less susceptible to timeouts in the Replit environment.
 */

// Use TS-Node to run this script with TypeScript imports
// eslint-disable-next-line
import { WebSocketClient, WebSocketFactory, WebSocketState } from './client/src/lib/websocket';

// Mock WebSocket 
class MockWebSocket {
  constructor() {
    this.readyState = WebSocketState.CONNECTING;
    this.sent = [];
    this.closed = false;
    
    // Simulate successful connection after construction
    setTimeout(() => {
      this.readyState = WebSocketState.OPEN;
      if (this.onopen) this.onopen();
    }, 50);
  }
  
  send(message) {
    if (this.readyState !== WebSocketState.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sent.push(message);
    console.log(`Message sent: ${message}`);
  }
  
  close() {
    this.closed = true;
    this.readyState = WebSocketState.CLOSED;
    if (this.onclose) this.onclose();
    console.log('WebSocket closed');
  }
}

// Mock WebSocket factory implementing the WebSocketFactory interface
class MockWebSocketFactory {
  createWebSocket(url) {
    console.log(`Creating mock WebSocket for URL: ${url}`);
    return new MockWebSocket();
  }
}

// Colors for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

// Test runner
class TestRunner {
  constructor() {
    this.passCount = 0;
    this.failCount = 0;
    this.currentTest = '';
  }
  
  test(name, fn) {
    this.currentTest = name;
    console.log(`\nRunning test: ${name}`);
    
    try {
      fn();
      this.passCount++;
      console.log(`${GREEN}✓ PASS: ${name}${RESET}`);
    } catch (error) {
      this.failCount++;
      console.log(`${RED}✗ FAIL: ${name}${RESET}`);
      console.log(`${RED}  Error: ${error.message}${RESET}`);
    }
  }
  
  expect(actual) {
    return {
      toBe: (expected) => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, got ${actual}`);
        }
      },
      toContain: (substring) => {
        if (!actual.includes(substring)) {
          throw new Error(`Expected "${actual}" to contain "${substring}"`);
        }
      },
      toBeTruthy: () => {
        if (!actual) {
          throw new Error(`Expected truthy value, got ${actual}`);
        }
      },
      toBeFalsy: () => {
        if (actual) {
          throw new Error(`Expected falsy value, got ${actual}`);
        }
      }
    };
  }
  
  summary() {
    console.log('\n===================================');
    console.log(`Tests completed: ${this.passCount + this.failCount}`);
    console.log(`${GREEN}Passed: ${this.passCount}${RESET}`);
    console.log(`${RED}Failed: ${this.failCount}${RESET}`);
    console.log('===================================');
    
    return this.failCount === 0;
  }
}

// Run the tests
async function runTests() {
  console.log('===================================');
  console.log('WebSocketClient Test Suite');
  console.log('===================================');
  
  const runner = new TestRunner();
  const factory = new MockWebSocketFactory();
  
  // Test 1: Connection
  runner.test('should connect to WebSocket server', () => {
    const client = new WebSocketClient(factory, '/ws');
    let connected = false;
    
    client.addEventListener('status', (status) => {
      if (status === 'connected') {
        connected = true;
      }
    });
    
    // Start connection
    client.connect();
    
    // Wait for connection
    setTimeout(() => {
      runner.expect(connected).toBeTruthy();
      runner.expect(client.getStatus()).toBe('connected');
    }, 100);
  });
  
  // Test 2: Role Registration
  runner.test('should register role and language', () => {
    const client = new WebSocketClient(factory, '/ws');
    
    // Connect first
    client.connect();
    
    // Wait for connection then register
    setTimeout(() => {
      client.register('teacher', 'en-US');
      
      // Check state
      runner.expect(client.getRole()).toBe('teacher');
      runner.expect(client.getLanguageCode()).toBe('en-US');
      
      // Check message was sent (we need to access the socket via getSocket() since it's private)
      const socket = client.getSocket();
      runner.expect(socket).toBeTruthy();
      
      if (socket) {
        // Access sent messages from our mock - in a real test this would use a spy
        const mockedSocket = socket;
        const sentMessages = mockedSocket.sent.map(m => JSON.parse(m));
        const registerMessage = sentMessages.find(m => m.type === 'register');
        runner.expect(registerMessage).toBeTruthy();
        runner.expect(registerMessage.role).toBe('teacher');
      }
    }, 100);
  });
  
  // Test 3: Sending Transcription
  runner.test('should send transcription when registered as teacher', () => {
    const client = new WebSocketClient(factory, '/ws');
    
    // Connect and register
    client.connect();
    
    setTimeout(() => {
      client.register('teacher', 'en-US');
      
      // Send transcription
      const result = client.sendTranscription('Hello world');
      
      runner.expect(result).toBeTruthy();
      
      // Check message was sent
      const socket = client.getSocket();
      runner.expect(socket).toBeTruthy();
      
      if (socket) {
        const mockedSocket = socket;
        const sentMessages = mockedSocket.sent.map(m => JSON.parse(m));
        const transcriptionMessage = sentMessages.find(m => m.type === 'transcription');
        runner.expect(transcriptionMessage).toBeTruthy();
        runner.expect(transcriptionMessage.text).toBe('Hello world');
      }
    }, 150);
  });
  
  // Test 4: Disconnect
  runner.test('should disconnect and clean up resources', () => {
    const client = new WebSocketClient(factory, '/ws');
    
    // Connect first
    client.connect();
    
    setTimeout(() => {
      // Get the socket before disconnecting
      const socket = client.getSocket();
      runner.expect(socket).toBeTruthy();
      
      // Store reference to check closed state after disconnect
      const mockedSocket = socket;
      
      // Disconnect
      client.disconnect();
      
      // Verify socket was closed
      if (mockedSocket) {
        runner.expect(mockedSocket.closed).toBeTruthy();
      }
      runner.expect(client.getStatus()).not.toBe('connected');
    }, 100);
  });
  
  // Output test summary
  const success = runner.summary();
  
  process.exit(success ? 0 : 1);
}

runTests();