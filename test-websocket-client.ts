/**
 * Simplified WebSocket Client Test
 * 
 * This script tests basic WebSocketClient functionality without using Jest,
 * making it less susceptible to timeouts in the Replit environment.
 */

/**
 * TypeScript WebSocketClient Test
 * 
 * Uses a mock WebSocket implementation to test the WebSocketClient
 * without relying on an actual WebSocket connection.
 */

// Import WebSocketClient and related types
import { WebSocketClient, WebSocketState } from './client/src/lib/websocket';

// Mock window object for Node.js environment
// Must be done before creating any WebSocketClient instances
(global as any).window = {
  location: {
    protocol: 'http:',
    host: 'localhost:5000'
  }
};

// Use any type to avoid strict type checking issues in mock implementation
class MockWebSocket {
  // Track socket state and messages
  readyState: number = WebSocketState.CONNECTING;
  sent: string[] = [];
  closed: boolean = false;
  onopen: any = null;
  onclose: any = null;
  onerror: any = null;
  onmessage: any = null;
  
  constructor() {
    // Simulate successful connection after construction
    setTimeout(() => {
      this.readyState = WebSocketState.OPEN;
      if (this.onopen) this.onopen();
    }, 50);
  }
  
  send(message: string): void {
    if (this.readyState !== WebSocketState.OPEN) {
      throw new Error('WebSocket is not open');
    }
    this.sent.push(message);
    console.log(`Message sent: ${message}`);
  }
  
  close(): void {
    this.closed = true;
    this.readyState = WebSocketState.CLOSED;
    // Create a close event mock to prevent errors
    if (this.onclose) {
      const closeEvent = {
        code: 1000,
        reason: 'Normal closure',
        wasClean: true
      };
      this.onclose(closeEvent);
    }
    console.log('WebSocket closed');
  }
  
  addEventListener(type: string, listener: any): void {
    if (type === 'open') this.onopen = listener;
    if (type === 'close') this.onclose = listener;
    if (type === 'error') this.onerror = listener;
    if (type === 'message') this.onmessage = listener;
  }
  
  removeEventListener(type: string, listener: any): void {
    if (type === 'open') this.onopen = null;
    if (type === 'close') this.onclose = null;
    if (type === 'error') this.onerror = null;
    if (type === 'message') this.onmessage = null;
  }
  
  dispatchEvent(): boolean {
    return true; // Not needed for tests
  }
}

// Mock WebSocket factory 
class MockWebSocketFactory {
  createWebSocket(url: string): any {
    console.log(`Creating mock WebSocket for URL: ${url}`);
    return new MockWebSocket();
  }
}

// Colors for console output
const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';

// Define expectation interface
interface Expectation {
  toBe: (expected: any) => void;
  toContain: (substring: string) => void;
  toBeTruthy: () => void;
  toBeFalsy: () => void;
  not: {
    toBe: (expected: any) => void;
  };
}

// Test runner class with proper typing
class TestRunner {
  passCount: number;
  failCount: number;
  currentTest: string;
  
  constructor() {
    this.passCount = 0;
    this.failCount = 0;
    this.currentTest = '';
  }
  
  test(name: string, fn: () => void): void {
    this.currentTest = name;
    console.log(`\nRunning test: ${name}`);
    
    try {
      fn();
      this.passCount++;
      console.log(`${GREEN}✓ PASS: ${name}${RESET}`);
    } catch (error: any) {
      this.failCount++;
      console.log(`${RED}✗ FAIL: ${name}${RESET}`);
      console.log(`${RED}  Error: ${error.message}${RESET}`);
    }
  }
  
  expect(actual: any): Expectation {
    return {
      toBe: (expected: any): void => {
        if (actual !== expected) {
          throw new Error(`Expected ${expected}, got ${actual}`);
        }
      },
      toContain: (substring: string): void => {
        if (!actual.includes(substring)) {
          throw new Error(`Expected "${actual}" to contain "${substring}"`);
        }
      },
      toBeTruthy: (): void => {
        if (!actual) {
          throw new Error(`Expected truthy value, got ${actual}`);
        }
      },
      toBeFalsy: (): void => {
        if (actual) {
          throw new Error(`Expected falsy value, got ${actual}`);
        }
      },
      not: {
        toBe: (expected: any): void => {
          if (actual === expected) {
            throw new Error(`Expected ${actual} to not be ${expected}`);
          }
        }
      }
    };
  }
  
  summary(): boolean {
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
  
  // Use promises for test completion to make tests more reliable
  const testPromises: Promise<void>[] = [];
  
  const runner = new TestRunner();
  const factory = new MockWebSocketFactory();
  
  // Test 1: Connection
  runner.test('should connect to WebSocket server', () => {
    const connectionPromise = new Promise<void>((resolve, reject) => {
      try {
        const client = new WebSocketClient(factory, '/ws');
        let connected = false;
        
        const onStatusChange = (status: string) => {
          if (status === 'connected') {
            connected = true;
            
            // Verify the connection
            runner.expect(connected).toBeTruthy();
            runner.expect(client.getStatus()).toBe('connected');
            
            // Clean up and resolve
            client.removeEventListener('status', onStatusChange);
            resolve();
          }
        };
        
        client.addEventListener('status', onStatusChange);
        
        // Start connection
        client.connect().catch(reject);
        
        // Set a timeout in case the connection never happens
        setTimeout(() => {
          if (!connected) {
            reject(new Error('Connection timed out'));
          }
        }, 500);
      } catch (error) {
        reject(error);
      }
    });
    
    testPromises.push(connectionPromise);
  });
  
  // Test 2: Role Registration
  runner.test('should register role and language', () => {
    const registerPromise = new Promise<void>((resolve, reject) => {
      try {
        const client = new WebSocketClient(factory, '/ws');
        let connected = false;
        
        // Listen for connection status change
        const onStatusChange = (status: string) => {
          if (status === 'connected') {
            connected = true;
            
            // Connection established, now register
            client.register('teacher', 'en-US');
            
            // Remove listener as we don't need it anymore
            client.removeEventListener('status', onStatusChange);
            
            // Check state
            runner.expect(client.getRole()).toBe('teacher');
            runner.expect(client.getLanguageCode()).toBe('en-US');
            
            // Check message was sent (we need to access the socket via getSocket() since it's private)
            const socket = client.getSocket();
            runner.expect(socket).toBeTruthy();
            
            if (socket) {
              // Cast to any to access our mock implementation's properties
              const mockedSocket = socket as any;
              
              if (mockedSocket.sent) {
                const sentMessages = mockedSocket.sent.map((m: string) => JSON.parse(m));
                const registerMessage = sentMessages.find((m: any) => m.type === 'register');
                runner.expect(registerMessage).toBeTruthy();
                runner.expect(registerMessage.role).toBe('teacher');
              }
            }
            
            // Test passed
            resolve();
          }
        };
        
        client.addEventListener('status', onStatusChange);
        
        // Connect
        client.connect().catch(reject);
        
        // Timeout if connection doesn't happen
        setTimeout(() => {
          if (!connected) {
            reject(new Error('Connection timed out'));
          }
        }, 500);
      } catch (error) {
        reject(error);
      }
    });
    
    testPromises.push(registerPromise);
  });
  
  // Test 3: Sending Transcription
  runner.test('should send transcription when registered as teacher', () => {
    const transcriptionPromise = new Promise<void>((resolve, reject) => {
      try {
        const client = new WebSocketClient(factory, '/ws');
        let connected = false;
        
        // Listen for connection status change
        const onStatusChange = (status: string) => {
          if (status === 'connected') {
            connected = true;
            
            // Connection established, now register
            client.register('teacher', 'en-US');
            
            // Send transcription
            const result = client.sendTranscription('Hello world');
            
            runner.expect(result).toBeTruthy();
            
            // Check message was sent
            const socket = client.getSocket();
            runner.expect(socket).toBeTruthy();
            
            if (socket) {
              // Cast to any to access our mock properties
              const mockedSocket = socket as any;
              
              if (mockedSocket.sent) {
                const sentMessages = mockedSocket.sent.map((m: string) => JSON.parse(m));
                const transcriptionMessage = sentMessages.find((m: any) => m.type === 'transcription');
                runner.expect(transcriptionMessage).toBeTruthy();
                runner.expect(transcriptionMessage.text).toBe('Hello world');
              }
            }
            
            // Clean up and resolve
            client.removeEventListener('status', onStatusChange);
            resolve();
          }
        };
        
        client.addEventListener('status', onStatusChange);
        
        // Connect
        client.connect().catch(reject);
        
        // Timeout if connection doesn't happen
        setTimeout(() => {
          if (!connected) {
            reject(new Error('Connection timed out'));
          }
        }, 500);
      } catch (error) {
        reject(error);
      }
    });
    
    testPromises.push(transcriptionPromise);
  });
  
  // Test 4: Disconnect
  runner.test('should disconnect and clean up resources', () => {
    const disconnectPromise = new Promise<void>((resolve, reject) => {
      try {
        const client = new WebSocketClient(factory, '/ws');
        let connected = false;
        
        // Listen for connection status change
        const onStatusChange = (status: string) => {
          if (status === 'connected') {
            connected = true;
            
            // Get the socket before disconnecting
            const socket = client.getSocket();
            runner.expect(socket).toBeTruthy();
            
            // Store reference to check closed state after disconnect
            const mockedSocket = socket as any;
            
            // Disconnect
            client.disconnect();
            
            // Verify socket was closed if we have the mock socket available
            if (mockedSocket && mockedSocket.closed !== undefined) {
              runner.expect(mockedSocket.closed).toBeTruthy();
            }
            
            // Always verify the client status changed
            runner.expect(client.getStatus()).not.toBe('connected');
            
            // Clean up and resolve
            client.removeEventListener('status', onStatusChange);
            resolve();
          }
        };
        
        client.addEventListener('status', onStatusChange);
        
        // Connect
        client.connect().catch(reject);
        
        // Timeout if connection doesn't happen
        setTimeout(() => {
          if (!connected) {
            reject(new Error('Connection timed out'));
          }
        }, 500);
      } catch (error) {
        reject(error);
      }
    });
    
    testPromises.push(disconnectPromise);
  });
  
  // Create a timeout promise to prevent tests from hanging
  const timeoutPromise = new Promise<void>((_, reject) => {
    setTimeout(() => {
      reject(new Error('Test suite timed out after 5 seconds'));
    }, 5000);
  });
  
  // Wait for all tests to complete before exiting, with timeout
  Promise.race([
    Promise.all(testPromises),
    timeoutPromise
  ])
    .then(() => {
      // All tests completed successfully
      const success = runner.summary();
      process.exit(success ? 0 : 1);
    })
    .catch((error) => {
      // At least one test failed or timeout occurred
      console.error(`\n${RED}ERROR: ${error.message}${RESET}`);
      runner.summary();
      process.exit(1);
    });
}

runTests();