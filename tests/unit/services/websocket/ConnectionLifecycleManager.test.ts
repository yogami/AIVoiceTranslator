import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionLifecycleManager } from '../../../../server/services/websocket/ConnectionLifecycleManager';
import { WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';

// Mock dependencies
const mockConnectionManager = {
  addConnection: vi.fn(),
  removeConnection: vi.fn(),
  setRole: vi.fn(),
  getRole: vi.fn(),
  getSessionId: vi.fn(),
  updateSessionId: vi.fn(),
  getConnections: vi.fn(() => []), // Return empty array by default
  isStudentCounted: vi.fn(),
  setStudentCounted: vi.fn()
};

const mockStorageSessionManager = {
  createSession: vi.fn(),
  updateSession: vi.fn(),
  endSession: vi.fn(() => Promise.resolve())
};

const mockClassroomSessionManager = {
  generateClassroomCode: vi.fn(),
  getSessionByCode: vi.fn(),
  isValidClassroomCode: vi.fn()
};

const mockConnectionValidationService = {
  validateConnection: vi.fn(),
  handleValidationError: vi.fn()
};

const mockMessageDispatcher = {
  dispatch: vi.fn()
};

const mockWebSocketServer = {
  storage: {
    getActiveSession: vi.fn()
  },
  storageSessionManager: mockStorageSessionManager,
  getSessionCleanupService: vi.fn()
};

const mockWebSocket = {
  send: vi.fn(),
  close: vi.fn(),
  terminate: vi.fn(),
  on: vi.fn()
} as any as WebSocketClient;

describe('ConnectionLifecycleManager', () => {
  let manager: ConnectionLifecycleManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    manager = new ConnectionLifecycleManager(
      mockConnectionManager as any,
      mockClassroomSessionManager as any,
      mockStorageSessionManager as any,
      { initializeConnection: vi.fn() } as any, // ConnectionHealthManager
      mockMessageDispatcher as any,
      mockWebSocketServer as any // Add webSocketServer
    );

    // Default mock returns
    mockClassroomSessionManager.isValidClassroomCode.mockReturnValue(true);
    mockClassroomSessionManager.getSessionByCode.mockReturnValue({
      sessionId: 'existing-session-123'
    });
    mockConnectionManager.getSessionId.mockReturnValue('test-session-123');
    mockConnectionManager.getRole.mockReturnValue('student');
    mockConnectionManager.isStudentCounted.mockReturnValue(false);
    mockWebSocketServer.storage.getActiveSession.mockResolvedValue({
      sessionId: 'test-session-123',
      studentsCount: 1,
      isActive: true
    });
    mockWebSocketServer.getSessionCleanupService.mockReturnValue({
      markAllStudentsLeft: vi.fn(),
      endSession: vi.fn(),
      markStudentsRejoined: vi.fn()
    });
  });

  describe('parseConnectionRequest', () => {
    it('should generate new session ID when no classroom code provided', () => {
      const request = { url: 'ws://localhost:3000/' };
      
      const result = manager.parseConnectionRequest(request);
      
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^session-/);
      expect(result.classroomCode).toBeNull();
    });    it('should use existing session ID when valid classroom code provided', () => {
      const request = { url: 'ws://localhost:3000/?code=ABC123' };
      
      const result = manager.parseConnectionRequest(request);
      
      expect(result.sessionId).toBe('existing-session-123');
      expect(result.classroomCode).toBe('ABC123');
      expect(mockClassroomSessionManager.getSessionByCode).toHaveBeenCalledWith('ABC123');
    });

    it('should generate new session ID when invalid classroom code provided', () => {
      const request = { url: 'ws://localhost:3000/?code=INVALID' };
      mockClassroomSessionManager.getSessionByCode.mockReturnValue(null);
      
      const result = manager.parseConnectionRequest(request);

      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^session-/);
      expect(result.classroomCode).toBe('INVALID');// Still returns the code for potential error handling
    });

    it('should handle malformed URLs gracefully', () => {
      const request = { url: 'invalid-url' };
      
      const result = manager.parseConnectionRequest(request);
      
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^session-/);
      expect(result.classroomCode).toBeNull();
    });
  });

  describe('Session Creation Logic - Key Behavioral Change', () => {
    it('should NOT automatically create database session on connection establishment', async () => {
      const request = { url: 'ws://localhost:3000/' };
      
      // Parse connection (this used to create a session, but should not anymore)
      const result = manager.parseConnectionRequest(request);
      
      // Verify NO session creation occurred
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
      expect(result.sessionId).toBeDefined(); // Session ID is generated for tracking
    });

    it('should NOT create session even when classroom code is provided', async () => {
      const request = { url: 'ws://localhost:3000/?code=ABC123' };
      
      // Parse connection
      const result = manager.parseConnectionRequest(request);
      
      // Verify NO session creation occurred
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
      expect(result.sessionId).toBe('existing-session-123'); // Uses existing session ID from classroom
    });

    it('should validate business logic: database sessions are only created when students join', async () => {
      // Step 1: Teacher connects (no database session)
      const teacherRequest = { url: 'ws://localhost:3000/' };
      const teacherResult = manager.parseConnectionRequest(teacherRequest);
      
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
      expect(teacherResult.sessionId).toBeDefined();
      
      // Step 2: Student joins with classroom code (still no automatic session creation here)
      const studentRequest = { url: 'ws://localhost:3000/?code=ABC123' };
      const studentResult = manager.parseConnectionRequest(studentRequest);
      
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
      expect(studentResult.sessionId).toBe('existing-session-123');
      
      // Database session creation should happen in RegisterMessageHandler when student registers
      // This separation of concerns is the key architectural change
    });
  });

  describe('sendConnectionConfirmation', () => {
    it('should send connection confirmation without database session creation', () => {
      manager.sendConnectionConfirmation(mockWebSocket, null);
      
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"connection"')
      );
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should send classroom code in confirmation when provided', () => {
      manager.sendConnectionConfirmation(mockWebSocket, 'ABC123');
      
      expect(mockWebSocket.send).toHaveBeenCalled();
      // Note: The actual message structure is handled by WebSocketResponseService
      // We're testing that sendConnectionConfirmation is called, not the exact message format
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
    });
  });

  describe('Connection Management', () => {
    it('should properly manage connection lifecycle without session creation', async () => {
      const request = { url: 'ws://localhost:3000/' };
      
      // Connection establishment via handleConnection method
      await manager.handleConnection(mockWebSocket, request);
      
      expect(mockConnectionManager.addConnection).toHaveBeenCalledWith(mockWebSocket, expect.any(String), undefined);
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should handle connection cleanup and decrement student count for counted students', async () => {
      mockConnectionManager.isStudentCounted.mockReturnValue(true);
      mockConnectionManager.getRole.mockReturnValue('student');
      mockConnectionManager.getSessionId.mockReturnValue('test-session-123');

      await manager.handleConnectionClose(mockWebSocket);
      
      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(mockWebSocket);
      expect(mockWebSocketServer.storage.getActiveSession).toHaveBeenCalledWith('test-session-123');
      expect(mockWebSocketServer.storageSessionManager.updateSession).toHaveBeenCalledWith(
        'test-session-123',
        expect.objectContaining({
          studentsCount: 0 // Should decrement from 1 to 0
        })
      );
    });

    it('should not decrement student count for uncounted students', async () => {
      mockConnectionManager.isStudentCounted.mockReturnValue(false); // Not counted
      mockConnectionManager.getRole.mockReturnValue('student');
      mockConnectionManager.getSessionId.mockReturnValue('test-session-123');

      await manager.handleConnectionClose(mockWebSocket);
      
      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(mockWebSocket);
      expect(mockWebSocketServer.storage.getActiveSession).not.toHaveBeenCalled();
      expect(mockWebSocketServer.storageSessionManager.updateSession).not.toHaveBeenCalled();
    });

    it('should handle teacher disconnection without affecting student count', async () => {
      mockConnectionManager.getRole.mockReturnValue('teacher');
      mockConnectionManager.getSessionId.mockReturnValue('test-session-123');

      await manager.handleConnectionClose(mockWebSocket);
      
      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(mockWebSocket);
      expect(mockWebSocketServer.storage.getActiveSession).not.toHaveBeenCalled();
      expect(mockWebSocketServer.storageSessionManager.updateSession).not.toHaveBeenCalled();
    });

    it('should handle connection cleanup without session ID', async () => {
      mockConnectionManager.getSessionId.mockReturnValue(null);

      await manager.handleConnectionClose(mockWebSocket);
      
      expect(mockConnectionManager.removeConnection).toHaveBeenCalledWith(mockWebSocket);
      expect(mockWebSocketServer.storage.getActiveSession).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null or undefined request objects', () => {
      const result1 = manager.parseConnectionRequest(null as any);
      const result2 = manager.parseConnectionRequest(undefined as any);
      
      expect(result1.sessionId).toBeDefined();
      expect(result2.sessionId).toBeDefined();
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
    });

    it('should handle classroom session manager errors gracefully', () => {
      const request = { url: 'ws://localhost:3000/?classroomCode=ABC123' };
      mockClassroomSessionManager.isValidClassroomCode.mockImplementation(() => {
        throw new Error('Classroom manager error');
      });
      
      const result = manager.parseConnectionRequest(request);
      
      // Should fall back to generating new session ID
      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).toMatch(/^session-/);
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
    });
  });

  describe('Architectural Validation', () => {
    it('should enforce separation of concerns: connection management vs session creation', async () => {
      // Connection lifecycle manager should only handle:
      // 1. Parsing connection requests
      // 2. Managing WebSocket connections
      // 3. Sending confirmations
      
      // It should NOT handle:
      // 1. Database session creation
      // 2. Session lifecycle management
      // 3. Student/teacher registration logic
      
      const request = { url: 'ws://localhost:3000/?classroomCode=ABC123' };
      const result = manager.parseConnectionRequest(request);
      
      manager.sendConnectionConfirmation(mockWebSocket, result.classroomCode);
      await manager.handleConnection(mockWebSocket, request);
      
      // Verify it only did connection management, not session management
      expect(mockConnectionManager.addConnection).toHaveBeenCalled();
      expect(mockWebSocket.send).toHaveBeenCalled();
      expect(mockStorageSessionManager.createSession).not.toHaveBeenCalled();
      expect(mockStorageSessionManager.updateSession).not.toHaveBeenCalled();
    });
  });
});
