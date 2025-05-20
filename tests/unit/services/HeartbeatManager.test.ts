import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatManager, type HeartbeatWebSocket } from '../../../server/services/HeartbeatManager';

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
    readyState: 1, // OPEN state
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
    CLOSED: 3,
    CLOSING: 2,
    CONNECTING: 0,
    OPEN: 1
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
  
  // Mock setInterval and clearInterval
  let originalSetInterval: any;
  let originalClearInterval: any;
  const mockSetInterval = vi.fn().mockImplementation((cb, ms) => {
    // Execute callback immediately for testing
    cb();
    return 12345 as unknown as NodeJS.Timeout;
  });
  const mockClearInterval = vi.fn();
  
  beforeEach(() => {
    // Set up spies and mocks
    consoleLogSpy = vi.spyOn(console, 'log');
    consoleErrorSpy = vi.spyOn(console, 'error');
    global.setInterval = mockSetInterval as any;
    global.clearInterval = mockClearInterval as any;
    
    // Create HeartbeatManager with a short interval for testing
    heartbeatManager = new HeartbeatManager(1000);
    
    // Set up test WebSocket clients
    mockActiveClient = createMockWebSocketClient(true);
    mockInactiveClient = createMockWebSocketClient(false);
    
    // Create connections set
    connections = new Set<HeartbeatWebSocket>();
    connections.add(mockActiveClient);
    connections.add(mockInactiveClient);
  });
  
  afterEach(() => {
    // Restore original functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    
    // Restore console spies
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    
    // Clear mock data
    vi.clearAllMocks();
  });
  
  it('should create a HeartbeatManager instance', () => {
    expect(heartbeatManager).toBeInstanceOf(HeartbeatManager);
  });
  
  it('should start heartbeat mechanism', () => {
    const interval = heartbeatManager.start(connections);
    
    expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 1000);
    expect(interval).toBe(12345);
  });
  
  it('should check and ping active connections', () => {
    heartbeatManager.checkConnection(mockActiveClient);
    
    expect(mockActiveClient.isAlive).toBe(false);
    expect(mockActiveClient.ping).toHaveBeenCalled();
  });
  
  it('should terminate inactive connections', () => {
    heartbeatManager.checkConnection(mockInactiveClient);
    
    expect(mockInactiveClient.terminate).toHaveBeenCalled();
    expect(consoleLogSpy).toHaveBeenCalledWith('Terminating inactive WebSocket connection');
  });
  
  it('should call onTerminate callback when terminating a connection', () => {
    const onTerminate = vi.fn();
    
    heartbeatManager.checkConnection(mockInactiveClient, onTerminate);
    
    expect(onTerminate).toHaveBeenCalledWith(mockInactiveClient);
  });
  
  it('should handle ping errors gracefully', () => {
    const errorClient = createMockWebSocketClient(true);
    errorClient.ping = vi.fn().mockImplementation(() => {
      throw new Error('Ping error');
    });
    
    heartbeatManager.checkConnection(errorClient);
    
    expect(errorClient.isAlive).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith('Error sending ping:', expect.any(Error));
  });
  
  it('should stop heartbeat mechanism', () => {
    const interval = heartbeatManager.start(connections);
    heartbeatManager.stop();
    
    expect(mockClearInterval).toHaveBeenCalledWith(interval);
  });
  
  it('should mark a connection as alive', () => {
    const client = createMockWebSocketClient(false);
    
    heartbeatManager.markAlive(client);
    
    expect(client.isAlive).toBe(true);
  });
});