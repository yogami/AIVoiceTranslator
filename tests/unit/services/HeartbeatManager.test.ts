import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HeartbeatManager } from '../../../server/services/HeartbeatManager';

// Mock WebSocketClient for testing
const createMockWebSocketClient = () => ({
  isAlive: true,
  sessionId: 'test-session',
  on: vi.fn(),
  terminate: vi.fn(),
  ping: vi.fn(),
  send: vi.fn()
});

describe('HeartbeatManager', () => {
  let heartbeatManager: HeartbeatManager;
  let mockClient: any;
  let mockClients: Set<any>;
  
  // Mock setInterval and clearInterval
  const originalSetInterval = global.setInterval;
  const originalClearInterval = global.clearInterval;
  
  let mockSetInterval: any;
  let mockClearInterval: any;
  
  beforeEach(() => {
    // Reset mocks
    vi.resetAllMocks();
    
    // Create HeartbeatManager instance
    heartbeatManager = new HeartbeatManager(5000);
    
    // Create mock client and clients set
    mockClient = createMockWebSocketClient();
    mockClients = new Set([mockClient]);
    
    // Mock setInterval to execute callback immediately
    mockSetInterval = vi.fn((callback, ms) => {
      callback(); // Execute immediately for testing
      return 123; // Return a dummy interval ID
    });
    
    mockClearInterval = vi.fn();
    
    // Replace global timing functions with mocks
    global.setInterval = mockSetInterval as any;
    global.clearInterval = mockClearInterval as any;
  });
  
  afterEach(() => {
    // Restore original timing functions
    global.setInterval = originalSetInterval;
    global.clearInterval = originalClearInterval;
    
    // Stop any ongoing heartbeat (just to be safe)
    heartbeatManager.stopHeartbeat();
  });
  
  it('should start heartbeat and check clients', () => {
    // Set up onClose callback
    const onClose = vi.fn();
    
    // Start heartbeat
    heartbeatManager.startHeartbeat(mockClients, onClose);
    
    // Verify setInterval was called with correct interval
    expect(mockSetInterval).toHaveBeenCalledWith(expect.any(Function), 5000);
    
    // Verify client was marked as inactive
    expect(mockClient.isAlive).toBe(false);
    
    // Verify ping was called
    expect(mockClient.ping).toHaveBeenCalled();
  });
  
  it('should stop heartbeat when requested', () => {
    // Start heartbeat
    heartbeatManager.startHeartbeat(mockClients, vi.fn());
    
    // Stop heartbeat
    heartbeatManager.stopHeartbeat();
    
    // Verify clearInterval was called
    expect(mockClearInterval).toHaveBeenCalledWith(123);
  });
  
  it('should terminate inactive clients', () => {
    // Set client as inactive
    mockClient.isAlive = false;
    
    // Start heartbeat (which executes immediately due to our mock)
    heartbeatManager.startHeartbeat(mockClients, vi.fn());
    
    // Verify client was terminated
    expect(mockClient.terminate).toHaveBeenCalled();
    
    // Verify ping was not called (client was terminated instead)
    expect(mockClient.ping).not.toHaveBeenCalled();
  });
  
  it('should handle errors during ping', () => {
    // Set up client to throw error when pinged
    mockClient.ping = vi.fn(() => {
      throw new Error('Ping error');
    });
    
    // Spy on console.error
    const consoleErrorSpy = vi.spyOn(console, 'error');
    
    // Start heartbeat
    heartbeatManager.startHeartbeat(mockClients, vi.fn());
    
    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
    expect(consoleErrorSpy.mock.calls[0][0]).toBe('Error sending ping:');
    
    // Verify client was marked as inactive
    expect(mockClient.isAlive).toBe(false);
  });
});