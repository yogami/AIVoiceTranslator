import { WebSocketService } from '../../../server/websocket';
import { Server } from 'http';
import { WebSocket } from 'ws';
import { IncomingMessage } from 'http';
import { vi, beforeEach, afterEach, afterAll, describe, it, expect } from 'vitest';

// Define interfaces for our mock objects
interface MockWebSocketClient {
  on: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
  readyState: number;
}

interface MockWebSocketServer {
  on: ReturnType<typeof vi.fn>;
  handleUpgrade: ReturnType<typeof vi.fn>;
  emit: ReturnType<typeof vi.fn>;
  clients: Set<any>;
  close: ReturnType<typeof vi.fn>;
}

// Track mock instances for cleanup
const mockServers = new Set<MockWebSocketServer>();
const mockClients = new Set<MockWebSocketClient>();
// Create a cleanup function that will be set later
let removeUpgradeListener = vi.fn();

// CORRECT: Only mock external dependencies, not the SUT
vi.mock('ws', () => {
  const mockOn = vi.fn();
  
  // Create a mock WebSocketServer that registers the upgrade handler on the HTTP server
  const mockWebSocketServer = function(options: any) {
    // This simulates the 'ws' package's behavior of adding an 'upgrade' listener
    // to the HTTP server when a new WebSocketServer is created
    if (options.server && typeof options.server.on === 'function') {
      const upgradeListener = vi.fn();
      options.server.on('upgrade', upgradeListener);
      
      // Replace the cleanup function with a specific one for this server
      removeUpgradeListener = vi.fn(() => {
        if (options.server && typeof options.server.removeListener === 'function') {
          options.server.removeListener('upgrade', upgradeListener);
        }
      });
    }
    
    const serverInstance: MockWebSocketServer = {
      on: mockOn,
      handleUpgrade: vi.fn(),
      emit: vi.fn(),
      clients: new Set(),
      close: vi.fn().mockImplementation((callback?: () => void) => {
        if (callback) callback();
        return true;
      })
    };
    
    // Track the server for cleanup
    mockServers.add(serverInstance);
    
    return serverInstance;
  };
  
  // Note the use of WebSocketServer to match the actual import
  const MockWebSocket = vi.fn().mockImplementation(() => {
    const wsInstance: MockWebSocketClient = {
      on: vi.fn(),
      send: vi.fn(),
      close: vi.fn().mockImplementation(() => true),
      readyState: 1,
      terminate: vi.fn().mockImplementation(() => true)
    };
    
    // Track client for cleanup
    mockClients.add(wsInstance);
    
    return wsInstance;
  });

  return {
    WebSocketServer: mockWebSocketServer,
    OPEN: 1,
    WebSocket: MockWebSocket
  };
});

// IMPORTANT: Create a real HTTP server mock, not a simple object
const createMockServer = () => {
  const mockServer: Partial<Server> = {
    on: vi.fn(),
    listeners: vi.fn().mockReturnValue([]),
    removeListener: vi.fn()
  };
  return mockServer as Server;
};

describe('WebSocketService', () => {
  let webSocketService: WebSocketService;
  let mockServer: Server;
  
  beforeEach(() => {
    mockServer = createMockServer();
    
    // IMPORTANT: Use the real WebSocketService, not a mock or test double
    webSocketService = new WebSocketService(mockServer);
  });
  
  afterEach(() => {
    // Clean up all mock clients
    mockClients.forEach(client => {
      client.close();
      client.terminate();
    });
    mockClients.clear();
    
    // Clean up all mock servers
    mockServers.forEach(server => {
      server.close();
    });
    mockServers.clear();
    
    // Remove any listeners
    removeUpgradeListener?.();
    
    // Reset all mocks
    vi.clearAllMocks();
  });
  
  afterAll(() => {
    // Final cleanup after all tests
    mockClients.clear();
    mockServers.clear();
    vi.restoreAllMocks();
    
    // Make absolutely sure port 5000 is released for the actual app
    process.nextTick(() => {
      // This runs after the test completes
      mockClients.clear();
      mockServers.clear();
      removeUpgradeListener?.();
    });
  });
  
  it('should initialize correctly', () => {
    // IMPORTANT: Test the actual instance, not a mock
    expect(webSocketService).toBeDefined();
    expect(webSocketService).toBeInstanceOf(WebSocketService);
  });
  
  // Test that the service sets up an event handler on the HTTP server
  it('should set up event handlers on the HTTP server', () => {
    // This test verifies that the WebSocketService correctly attaches
    // an 'upgrade' event handler to the HTTP server during initialization
    
    // Verify the integration between server and WebSocketService
    expect(mockServer.on).toHaveBeenCalledWith('upgrade', expect.any(Function));
    
    // Additional check to verify that the .on method was called only once
    expect(mockServer.on).toHaveBeenCalledTimes(1);
  });
  
  it('should register message handlers correctly', () => {
    const messageHandler = vi.fn();
    webSocketService.onMessage('test', messageHandler);
    
    // Use our knowledge of the internal structure (private property access via any)
    // This is acceptable in tests for verification
    const handlers = (webSocketService as any).messageHandlers;
    expect(handlers.get('test')).toBeDefined();
    expect(handlers.get('test')).toContain(messageHandler);
  });
  
  it('should register connection handlers correctly', () => {
    const connectionHandler = vi.fn();
    webSocketService.onConnection(connectionHandler);
    
    // Verify the connection handler was registered
    const handlers = (webSocketService as any).connectionHandlers;
    expect(handlers).toContain(connectionHandler);
  });
  
  it('should register close handlers correctly', () => {
    const closeHandler = vi.fn();
    webSocketService.onClose(closeHandler);
    
    // Verify the close handler was registered
    const handlers = (webSocketService as any).closeHandlers;
    expect(handlers).toContain(closeHandler);
  });
  
  it('should broadcast messages to all clients', () => {
    // Setup
    const mockClient1 = new (WebSocket as any)();
    const mockClient2 = new (WebSocket as any)();
    const wsServer = (webSocketService as any).wss;
    wsServer.clients.add(mockClient1);
    wsServer.clients.add(mockClient2);
    
    // Act
    webSocketService.broadcast({ type: 'test', data: 'test data' });
    
    // Assert
    expect(mockClient1.send).toHaveBeenCalled();
    expect(mockClient2.send).toHaveBeenCalled();
  });
  
  it('should broadcast messages to clients with specific role', () => {
    // Setup
    const mockTeacher = new (WebSocket as any)();
    mockTeacher.role = 'teacher';
    
    const mockStudent = new (WebSocket as any)();
    mockStudent.role = 'student';
    
    const wsServer = (webSocketService as any).wss;
    wsServer.clients.add(mockTeacher);
    wsServer.clients.add(mockStudent);
    
    // Act
    webSocketService.broadcastToRole('teacher', { type: 'test', data: 'teacher data' });
    
    // Assert
    expect(mockTeacher.send).toHaveBeenCalled();
    expect(mockStudent.send).not.toHaveBeenCalled();
  });
  
  it('should send message to a specific client', () => {
    // Setup
    const mockClient = new (WebSocket as any)();
    
    // Act
    webSocketService.sendToClient(mockClient, { type: 'test', data: 'client data' });
    
    // Assert
    expect(mockClient.send).toHaveBeenCalled();
    const sentData = JSON.parse(mockClient.send.mock.calls[0][0]);
    expect(sentData.type).toBe('test');
    expect(sentData.data).toBe('client data');
  });
});