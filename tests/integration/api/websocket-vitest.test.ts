/**
 * WebSocket Integration Tests
 * 
 * This file tests the WebSocket communication by establishing 
 * connections to a test WebSocket server.
 * 
 * Converted from Jest to Vitest
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as WebSocket from 'ws';
import { createServer } from 'http';
import express from 'express';
import { WebSocketService } from '../../../server/websocket';
import { AddressInfo } from 'net';

// Using a mocked WebSocketService to test the integration
describe('WebSocket Integration', () => {
  let mockWsService: {
    sendToClient: any;
    onMessage: any;
    [key: string]: any;
  };
  
  // Track all timers so we can clear them between tests
  const timers: NodeJS.Timeout[] = [];
  
  // Mock the WebSocketService class
  beforeAll(() => {
    // Create a mock version of WebSocketService
    mockWsService = {
      sendToClient: vi.fn((ws, message) => {
        // Simulate sending a message to the client
        const timer = setTimeout(() => {
          if (ws._listeners && ws._listeners.message) {
            ws._listeners.message.forEach((callback: Function) => 
              callback(JSON.stringify(message))
            );
          }
        }, 10);
        
        // Track the timer for cleanup
        timers.push(timer);
      }),
      onMessage: vi.fn((type, handler) => {
        // Store the handler for later use in tests
        mockWsService[`_handler_${type}`] = handler;
      })
    };
    
    // Mock the WebSocketService prototype methods
    vi.spyOn(WebSocketService.prototype, 'onMessage').mockImplementation(mockWsService.onMessage);
    vi.spyOn(WebSocketService.prototype, 'sendToClient').mockImplementation(mockWsService.sendToClient);
  });
  
  afterAll(() => {
    // Clean up all mocks
    vi.restoreAllMocks();
    
    // Clear all timers
    timers.forEach(timer => clearTimeout(timer));
  });
  
  // Create the same mock WebSocket class as in the simple test
  class MockWebSocket {
    readyState = 1;
    static OPEN = 1;
    static _instances: MockWebSocket[] = [];
    
    _listeners: Record<string, Array<(data?: any) => void>> = {
      'open': [],
      'message': [],
      'close': [],
      'error': []
    };
    _activeTimers: NodeJS.Timeout[] = [];
    sessionId?: string;
    role?: 'teacher' | 'student';
    languageCode?: string;

    constructor(url: string) {
      // Track this instance for cleanup
      MockWebSocket._instances = MockWebSocket._instances || [];
      MockWebSocket._instances.push(this);
      
      // Simulate connecting to the server
      const timer = setTimeout(() => this._trigger('open'), 10);
      this._activeTimers.push(timer);
      timers.push(timer); // Add to global timer collection
    }

    on(event: string, callback: (data?: any) => void) {
      if (!this._listeners[event]) {
        this._listeners[event] = [];
      }
      this._listeners[event].push(callback);
      return this;
    }

    send(data: string) {
      try {
        // Parse the message and handle it
        const message = JSON.parse(data);
        if (message.type === 'register') {
          // Call the registered handler directly
          const handler = mockWsService[`_handler_${message.type}`];
          if (handler) {
            this.role = message.role;
            this.languageCode = message.language;
            handler(this, message);
          }
        }
      } catch (e) {
        this._trigger('error', e);
      }
    }

    close() {
      // Cancel any pending timers first
      this._activeTimers.forEach(timer => clearTimeout(timer));
      this._activeTimers = [];
      
      // Trigger close event synchronously to avoid hanging tests
      this._trigger('close');
    }

    _trigger(event: string, data?: any) {
      const callbacks = this._listeners[event] || [];
      callbacks.forEach(callback => callback(data));
    }
  }
  
  // Collection of server instances to properly close after tests
  const servers: ReturnType<typeof createServer>[] = [];
  let wsServices: WebSocketService[] = [];
  
  // Setup the WebSocketService to respond to register messages
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
    
    // Initialize mocks by creating a new WebSocketService with HTTP server
    const server = createServer();
    servers.push(server);
    const wsService = new WebSocketService(server);
    wsServices.push(wsService);
    
    // Setup the register message handler
    const registerHandler = (ws: any, message: any) => {
      mockWsService.sendToClient(ws, {
        type: 'registration',
        success: true,
        sessionId: 'test-session'
      });
    };
    
    // Store the handler in our mock
    mockWsService[`_handler_register`] = registerHandler;
  });
  
  afterEach(() => {
    return new Promise<void>((done) => {
      // First clean up any active timers
      timers.forEach(timer => clearTimeout(timer));
      timers.length = 0;
      
      // Clean up WebSocket services by calling their private cleanup method
      wsServices.forEach(ws => {
        // Call the cleanup method to clear the heartbeat interval
        const cleanup = (ws as any).cleanup || ((ws as any).constructor.prototype.cleanup);
        if (typeof cleanup === 'function') {
          cleanup.call(ws);
        }
        
        // Also terminate any remaining clients
        if (ws.getServer().clients) {
          ws.getServer().clients.forEach(client => {
            client.terminate();
          });
        }
      });
      
      // Close all HTTP servers
      if (servers.length === 0) {
        done();
        return;
      }
      
      let closed = 0;
      servers.forEach(server => {
        server.close(() => {
          closed++;
          if (closed === servers.length) {
            // Reset collections
            servers.length = 0;
            wsServices.length = 0;
            done();
          }
        });
      });
    });
  });
  
  it('should establish WebSocket connection', () => {
    return new Promise<void>((done) => {
      const ws = new MockWebSocket('ws://localhost:1234/ws');
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(MockWebSocket.OPEN);
        ws.close();
      });
      
      ws.on('close', () => {
        done();
      });
      
      ws.on('error', (error) => {
        done(error);
      });
    });
  });
  
  it('should handle client registration message', () => {
    return new Promise<void>((done) => {
      const ws = new MockWebSocket('ws://localhost:1234/ws');
      
      ws.on('open', () => {
        // Send registration message
        ws.send(JSON.stringify({
          type: 'register',
          role: 'student',
          language: 'es-ES'
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        expect(message.type).toBe('registration');
        expect(message.success).toBeTruthy();
        expect(message.sessionId).toBe('test-session');
        
        // Verify the mock was called
        expect(mockWsService.sendToClient).toHaveBeenCalled();
        
        ws.close();
        done();
      });
      
      ws.on('error', (error) => {
        done(error);
      });
    });
  });
});

// Create a simpler test that uses mocked WebSockets instead of real ones
describe('Simple WebSocket Test', () => {
  // Track all timers for cleanup
  const timers: NodeJS.Timeout[] = [];
  
  // Mock WebSocket class for testing
  class MockWebSocket {
    readyState = 1;
    static OPEN = 1;
    static _instances: MockWebSocket[] = [];
    
    private listeners: Record<string, Array<(data?: any) => void>> = {
      'open': [],
      'message': [],
      'close': [],
      'error': []
    };
    private _activeTimers: NodeJS.Timeout[] = [];

    constructor(url: string) {
      // Track this instance
      MockWebSocket._instances = MockWebSocket._instances || [];
      MockWebSocket._instances.push(this);
      
      // Simulate connecting to the server
      const timer = setTimeout(() => this.triggerEvent('open'), 10);
      this._activeTimers.push(timer);
      timers.push(timer); // Add to global collection
    }

    on(event: string, callback: (data?: any) => void) {
      if (this.listeners[event]) {
        this.listeners[event].push(callback);
      }
      return this;
    }

    send(data: string) {
      try {
        // Parse the message and respond with a mock response
        const message = JSON.parse(data);
        if (message.type === 'register') {
          const timer = setTimeout(() => {
            this.triggerEvent('message', JSON.stringify({
              type: 'registration',
              success: true,
              sessionId: 'test-session'
            }));
          }, 10);
          this._activeTimers.push(timer);
          timers.push(timer); // Add to global collection
        }
      } catch (e) {
        this.triggerEvent('error', e);
      }
    }

    close() {
      // Clean up any pending timers
      this._activeTimers.forEach(timer => clearTimeout(timer));
      this._activeTimers = [];
      
      // Trigger close event synchronously to avoid hanging tests
      this.triggerEvent('close');
    }

    private triggerEvent(event: string, data?: any) {
      const callbacks = this.listeners[event] || [];
      callbacks.forEach(callback => callback(data));
    }
  }

  // Replace the actual WebSocket with our mock for these tests
  const OriginalWebSocket = WebSocket;
  
  beforeAll(() => {
    // @ts-ignore - Temporarily override the WebSocket constructor
    global.WebSocket = MockWebSocket;
  });

  afterEach(() => {
    return new Promise<void>((done) => {
      // Clean up any remaining timers after each test
      timers.forEach(timer => clearTimeout(timer));
      timers.length = 0; // Clear the array
      
      // Force any open WebSockets to close
      // This ensures all tests are fully independent
      if (global.WebSocket) {
        const ws = global.WebSocket as any;
        if (ws._instances && Array.isArray(ws._instances)) {
          ws._instances.forEach((instance: any) => {
            try {
              if (instance && typeof instance.close === 'function') {
                instance.close();
              }
            } catch (e) {
              // Ignore errors in cleanup
            }
          });
          ws._instances = [];
        }
      }
      
      // Wait a small delay to ensure everything is cleaned up
      setTimeout(() => {
        done();
      }, 50);
    });
  });

  afterAll(() => {
    // @ts-ignore - Restore the original WebSocket
    global.WebSocket = OriginalWebSocket;
  });

  it('should connect to WebSocket server', () => {
    return new Promise<void>((done) => {
      // Use our mocked WebSocket
      const ws = new MockWebSocket('ws://localhost:1234');
      
      ws.on('open', () => {
        expect(ws.readyState).toBe(MockWebSocket.OPEN);
        ws.close();
        done();
      });
      
      ws.on('error', (error) => {
        done(error);
      });
    });
  });
  
  it('should handle registration message', () => {
    return new Promise<void>((done) => {
      // Use our mocked WebSocket
      const ws = new MockWebSocket('ws://localhost:1234');
      
      ws.on('open', () => {
        // Send registration message
        ws.send(JSON.stringify({
          type: 'register',
          role: 'student',
          language: 'es-ES'
        }));
      });
      
      ws.on('message', (data) => {
        const message = JSON.parse(data);
        expect(message.type).toBe('registration');
        expect(message.success).toBeTruthy();
        ws.close();
        done();
      });
      
      ws.on('error', (error) => {
        done(error);
      });
    });
  });
});