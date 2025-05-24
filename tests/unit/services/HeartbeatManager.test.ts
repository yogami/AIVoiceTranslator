/**
 * Unit tests for HeartbeatManager
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HeartbeatManager, HeartbeatWebSocket } from '../../../server/services/managers/HeartbeatManager';
import { WebSocket } from 'ws';

// Create a mock WebSocket client
function createMockWebSocketClient(isAlive: boolean = true): HeartbeatWebSocket {
  return {
    on: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    terminate: vi.fn(),
    ping: vi.fn(),
    isAlive,
    sessionId: 'test-session',
    readyState: WebSocket.OPEN, // OPEN state
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    onerror: null,
    onmessage: null,
    onclose: null,
    onopen: null,
    binaryType: 'arraybuffer',
    bufferedAmount: 0,
    extensions: '',
    protocol: '',
    url: '',
    CLOSED: WebSocket.CLOSED,
    CLOSING: WebSocket.CLOSING,
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN
  } as unknown as HeartbeatWebSocket;
}

describe('HeartbeatManager', () => {
  let heartbeatManager: HeartbeatManager;
  let connections: Set<HeartbeatWebSocket>;
  let mockActiveClient: HeartbeatWebSocket;
  let mockInactiveClient: HeartbeatWebSocket;
  
  // Spy on console methods
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  
  beforeEach(() => {
    // Mock console methods
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    // Create HeartbeatManager with a short interval for testing
    heartbeatManager = new HeartbeatManager(1000);
    
    // Set up test WebSocket clients
    mockActiveClient = createMockWebSocketClient(true);
    mockInactiveClient = createMockWebSocketClient(false);
    
    // Create connections set
    connections = new Set<HeartbeatWebSocket>();
    connections.add(mockActiveClient);
    connections.add(mockInactiveClient);
    
    // Use fake timers
    vi.useFakeTimers();
  });
  
  afterEach(() => {
    // Reset all mocks and restore original behavior
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
  });
  
  it('should create a HeartbeatManager instance', () => {
    expect(heartbeatManager).toBeInstanceOf(HeartbeatManager);
  });
  
  it('should terminate inactive connections', () => {
    // Set up an inactive client
    const mockWS = createMockWebSocketClient(false);
    
    // Test direct connection check
    heartbeatManager.checkConnection(mockWS);
    
    // Verify the client was terminated
    expect(mockWS.terminate).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Terminating inactive WebSocket connection');
  });
  
  it('should ping active connections', () => {
    // Set up an active client
    const mockWS = createMockWebSocketClient(true);
    
    // Test direct connection check
    heartbeatManager.checkConnection(mockWS);
    
    // Verify the client was pinged and marked inactive
    expect(mockWS.isAlive).toBe(false);
    expect(mockWS.ping).toHaveBeenCalled();
  });
  
  it('should start heartbeat mechanism', () => {
    // Spy on setInterval instead of mocking it
    const setIntervalSpy = vi.spyOn(global, 'setInterval');
    
    // Start heartbeat
    const interval = heartbeatManager.start(connections);
    
    // Verify setInterval was called with correct parameters
    expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(interval).toBeDefined();
  });
  
  it('should call heartbeat function on all connections', () => {
    // Create test spies
    const checkConnectionSpy = vi.spyOn(heartbeatManager, 'checkConnection');
    
    // Start heartbeat
    heartbeatManager.start(connections);
    
    // Advance timers to trigger the interval callback
    vi.advanceTimersByTime(1000);
    
    // Verify the checkConnection method was called for each connection
    expect(checkConnectionSpy).toHaveBeenCalledTimes(2);
    expect(checkConnectionSpy).toHaveBeenCalledWith(mockActiveClient, undefined);
    expect(checkConnectionSpy).toHaveBeenCalledWith(mockInactiveClient, undefined);
  });
  
  it('should call onTerminate callback when terminating a connection', () => {
    // Set up callback
    const onTerminate = vi.fn();
    
    // Check inactive connection with callback
    heartbeatManager.checkConnection(mockInactiveClient, onTerminate);
    
    // Verify callback was called with correct parameters
    expect(onTerminate).toHaveBeenCalledWith(mockInactiveClient);
  });
  
  it('should handle ping errors gracefully', () => {
    // Set up client that throws error on ping
    const errorClient = createMockWebSocketClient(true);
    errorClient.ping = vi.fn().mockImplementation(() => {
      throw new Error('Ping error');
    });
    
    // Test error handling
    heartbeatManager.checkConnection(errorClient);
    
    // Verify error was handled
    expect(errorClient.isAlive).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending ping:', expect.any(Error));
  });
  
  it('should stop heartbeat mechanism', () => {
    // Spy on clearInterval
    const clearIntervalSpy = vi.spyOn(global, 'clearInterval');
    
    // Start and then stop the heartbeat
    const interval = heartbeatManager.start(connections);
    heartbeatManager.stop();
    
    // Verify clearInterval was called
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
  
  it('should mark a connection as alive', () => {
    // Set up an inactive client
    const client = createMockWebSocketClient(false);
    
    // Mark as alive
    heartbeatManager.markAlive(client);
    
    // Verify client was marked alive
    expect(client.isAlive).toBe(true);
  });
});