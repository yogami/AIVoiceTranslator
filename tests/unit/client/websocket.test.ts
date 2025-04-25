/**
 * Unit tests for WebSocketClient
 * 
 * Following principles from Clean Code and the Testing Pyramid:
 * - Tests should be independent and isolated
 * - Each test should focus on a single concept
 * - Test names should clearly describe what they're testing
 * - Mock dependencies to isolate the unit being tested
 */

import { WebSocketClient, WebSocketFactory, UserRole, ConnectionStatus, WebSocketState } from '../../../client/src/lib/websocket';

// Mock WebSocket factory for testing
class MockWebSocketFactory implements WebSocketFactory {
  public mockWebSocket: any = {
    readyState: WebSocketState.OPEN,
    send: jest.fn(),
    close: jest.fn(),
  };
  
  createWebSocket(_url: string): WebSocket {
    return this.mockWebSocket as unknown as WebSocket;
  }
}

describe('WebSocketClient', () => {
  let mockFactory: MockWebSocketFactory;
  let wsClient: WebSocketClient;

  // Extend the test timeout to account for slow WebSocket operations in Replit
  jest.setTimeout(10000); // 10 seconds is reasonable for unit tests

  // Set up before each test
  beforeEach(() => {
    // Reset mocks and create a fresh client for each test
    mockFactory = new MockWebSocketFactory();
    
    // Create client with the mock factory
    wsClient = new WebSocketClient(mockFactory, '/ws');
    
    // Mock global objects
    global.window = {
      location: {
        protocol: 'https:',
        host: 'test.example.com'
      }
    } as any;
    
    // Spy on console methods
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  // Clean up after each test
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Connection Handling', () => {
    test('should connect to WebSocket server with correct URL', async () => {
      // Arrange - Setup onopen callback to be called immediately
      mockFactory.mockWebSocket.onopen = null;
      
      // Create a timeout promise using Promise.race() to prevent test from hanging
      const connectWithTimeout = Promise.race([
        wsClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 5000)
        )
      ]);
      
      // Act - Start connection and immediately simulate success
      setTimeout(() => mockFactory.mockWebSocket.onopen?.(), 10);
      
      // Assert - Verify connection completes successfully
      await connectWithTimeout;
      
      // Verify that the client is in the connected state
      expect(wsClient.getStatus()).toBe('connected');
    });

    test('should update status to error when connection fails', async () => {
      // Arrange - Set up error handler
      mockFactory.mockWebSocket.onerror = null;
      
      // Create a promise that will be resolved when the error occurs
      let errorResolveFn: () => void;
      const errorOccurred = new Promise<void>(resolve => {
        errorResolveFn = resolve;
      });
      
      // Set up our connection with a timeout to prevent hanging
      const connectWithTimeout = Promise.race([
        wsClient.connect().catch(() => {
          // Error expected - resolve our tracking promise
          errorResolveFn();
          return Promise.resolve(); // Convert to resolved promise for race
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Test timeout waiting for error')), 5000)
        )
      ]);
      
      // Act - Start connection and simulate failure
      setTimeout(() => mockFactory.mockWebSocket.onerror?.(new Error('Connection refused')), 10);
      
      // Wait for the promise to resolve
      await connectWithTimeout;
      await errorOccurred; // Make sure the error handler completed
      
      // Assert - Verify we're in error state
      expect(wsClient.getStatus()).toBe('error');
    });

    test('should disconnect and clean up resources', (done) => {
      // Arrange - Connect first with timeout protection
      const connectWithTimeout = Promise.race([
        wsClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 1000)
        )
      ]);
      
      // Simulate successful connection after small delay
      setTimeout(() => mockFactory.mockWebSocket.onopen?.(), 10);
      
      // After connection
      connectWithTimeout.then(() => {
        // Act - Disconnect
        wsClient.disconnect();
        
        // Assert - Verify close was called on the socket
        expect(mockFactory.mockWebSocket.close).toHaveBeenCalled();
        
        // Verify internal state is cleaned up
        expect(wsClient.getStatus()).not.toBe('connected');
        
        // Complete the test
        done();
      }).catch(error => {
        done(error); // Signal test failure if connection fails
      });
    });
  });

  describe('Role and Language Registration', () => {
    test('should register role and language when connected', (done) => {
      // Arrange - Connect first with timeout protection
      const connectWithTimeout = Promise.race([
        wsClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 1000)
        )
      ]);
      
      // Simulate successful connection
      setTimeout(() => mockFactory.mockWebSocket.onopen?.(), 10);
      
      // After connection
      connectWithTimeout.then(() => {
        // Act - Register as teacher with English language
        wsClient.register('teacher', 'en-US');
        
        // Wait a moment for processing
        setTimeout(() => {
          // Assert - Verify message was sent
          expect(mockFactory.mockWebSocket.send).toHaveBeenCalledWith(
            expect.stringContaining('"type":"register"')
          );
          expect(mockFactory.mockWebSocket.send).toHaveBeenCalledWith(
            expect.stringContaining('"role":"teacher"')
          );
          
          // Verify client state is updated
          expect(wsClient.getRole()).toBe('teacher');
          expect(wsClient.getLanguageCode()).toBe('en-US');
          
          done();
        }, 10);
      }).catch(error => {
        done(error);
      });
    });

    test('should not change role when role is locked', (done) => {
      // Arrange - Connect first with timeout protection
      const connectWithTimeout = Promise.race([
        wsClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 1000)
        )
      ]);
      
      // Simulate successful connection
      setTimeout(() => mockFactory.mockWebSocket.onopen?.(), 10);
      
      // After connection
      connectWithTimeout.then(() => {
        // Lock the role as teacher
        wsClient.setRoleAndLock('teacher');
        
        // Act - Try to register as student
        wsClient.register('student', 'es');
        
        // Wait a moment for processing
        setTimeout(() => {
          // Assert - Role should still be teacher
          expect(wsClient.getRole()).toBe('teacher');
          // But language should be updated
          expect(wsClient.getLanguageCode()).toBe('es');
          
          done();
        }, 10);
      }).catch(error => {
        done(error);
      });
    });
  });

  describe('Sending Transcriptions', () => {
    test('should send transcription when connected as teacher', (done) => {
      // Arrange - Connect with timeout protection
      const connectWithTimeout = Promise.race([
        wsClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 1000)
        )
      ]);
      
      // Simulate successful connection
      setTimeout(() => mockFactory.mockWebSocket.onopen?.(), 10);
      
      // After connection
      connectWithTimeout.then(() => {
        // Register as teacher
        wsClient.register('teacher', 'en-US');
        
        // Small delay for registration to complete
        setTimeout(() => {
          // Act - Send transcription
          const result = wsClient.sendTranscription('Hello world');
          
          // Assert - Verify success and message sent
          expect(result).toBe(true);
          expect(mockFactory.mockWebSocket.send).toHaveBeenCalledWith(
            expect.stringContaining('"type":"transcription"')
          );
          expect(mockFactory.mockWebSocket.send).toHaveBeenCalledWith(
            expect.stringContaining('"text":"Hello world"')
          );
          
          done();
        }, 10);
      }).catch(error => {
        done(error);
      });
    });

    test('should not send transcription when not connected', () => {
      // This test doesn't involve WebSocket connection, so no timeout needed
      
      // Arrange - Not connecting
      
      // Act - Try to send transcription
      const result = wsClient.sendTranscription('Hello world');
      
      // Assert - Verify failure
      expect(result).toBe(false);
      expect(mockFactory.mockWebSocket.send).not.toHaveBeenCalled();
    });

    test('should not send transcription when not registered as student', (done) => {
      // Arrange - Connect with timeout protection
      const connectWithTimeout = Promise.race([
        wsClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 1000)
        )
      ]);
      
      // Simulate successful connection
      setTimeout(() => mockFactory.mockWebSocket.onopen?.(), 10);
      
      // After connection
      connectWithTimeout.then(() => {
        // Register as student (not teacher)
        wsClient.register('student', 'en-US');
        
        // Small delay for registration to complete
        setTimeout(() => {
          // Act - Try to send transcription
          const result = wsClient.sendTranscription('Hello world');
          
          // Assert - Verify failure
          expect(result).toBe(false);
          expect(mockFactory.mockWebSocket.send).not.toHaveBeenCalledWith(
            expect.stringContaining('"type":"transcription"')
          );
          
          done();
        }, 10);
      }).catch(error => {
        done(error);
      });
    });
  });

  describe('Event Handling', () => {
    test('should notify listeners when events occur', (done) => {
      // Arrange - Set up listeners
      const statusListener = jest.fn(() => {
        // First assertion - status listener called
        expect(statusListener).toHaveBeenCalledWith('connected');
        
        // Now simulate message event after status is verified
        const mockMessage = {
          type: 'translation',
          text: 'Hello',
          translatedText: 'Hola'
        };
        
        setTimeout(() => {
          mockFactory.mockWebSocket.onmessage?.({ 
            data: JSON.stringify(mockMessage) 
          });
        }, 10);
      });
      
      const messageListener = jest.fn(() => {
        // Second assertion - message listener called with correct data
        expect(messageListener).toHaveBeenCalledWith(expect.objectContaining({
          type: 'translation',
          text: 'Hello',
          translatedText: 'Hola'
        }));
        
        // Complete the test
        done();
      });
      
      wsClient.addEventListener('status', statusListener);
      wsClient.addEventListener('message', messageListener);
      
      // Act - Connect to trigger status event
      wsClient.connect();
      
      // Simulate successful connection after small delay
      setTimeout(() => {
        mockFactory.mockWebSocket.onopen?.();
      }, 10);
    });

    test('should handle connection message with session ID', (done) => {
      // Wrap with timeout to prevent hanging
      const testTimeout = setTimeout(() => {
        done(new Error('Test timed out'));
      }, 5000);
      
      // Arrange - Connect
      const connectWithTimeout = Promise.race([
        wsClient.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 1000)
        )
      ]);
      
      // Set up for success
      setTimeout(() => mockFactory.mockWebSocket.onopen?.(), 10);
      
      // After connection
      connectWithTimeout.then(() => {
        // Act - Simulate receiving a connection message with session ID
        mockFactory.mockWebSocket.onmessage?.({ 
          data: JSON.stringify({
            type: 'connection',
            sessionId: 'test-session-123'
          }) 
        });
        
        // Need a small delay for processing
        setTimeout(() => {
          // Assert - Verify session ID is stored
          expect(wsClient.getSessionId()).toBe('test-session-123');
          clearTimeout(testTimeout); // Clear the timeout since we're done
          done(); // Signal test completion
        }, 10);
      });
    });
  });
});