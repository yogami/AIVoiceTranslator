import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';
import { SessionMetricsService, type SessionMetrics } from '../../../../server/services/session/SessionMetricsService';
import { ConnectionManager, type WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import { ClassroomSessionManager } from '../../../../server/services/session/ClassroomSessionManager';

// Mock the dependencies
vi.mock('../../../../server/services/websocket/ConnectionManager');
vi.mock('../../../../server/services/session/ClassroomSessionManager');

describe('SessionMetricsService', () => {
  let sessionMetricsService: SessionMetricsService;
  let mockConnectionManager: ConnectionManager;
  let mockClassroomSessionManager: ClassroomSessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConnectionManager = new ConnectionManager();
    mockClassroomSessionManager = new ClassroomSessionManager();
    sessionMetricsService = new SessionMetricsService(mockConnectionManager, mockClassroomSessionManager);
  });

  describe('calculateActiveSessionMetrics', () => {
    it('should calculate metrics with no active connections', () => {
      const mockConnections = new Set<WebSocketClient>();
      (mockConnectionManager.getConnections as MockedFunction<any>).mockReturnValue(mockConnections);

      const metrics = sessionMetricsService.calculateActiveSessionMetrics();

      expect(metrics).toEqual({
        activeSessions: 0,
        studentsConnected: 0,
        teachersConnected: 0,
        currentLanguages: []
      });
    });

    it('should calculate metrics with mixed connections', () => {
      const mockClient1 = { sessionId: 'session1' } as WebSocketClient;
      const mockClient2 = { sessionId: 'session1' } as WebSocketClient;
      const mockClient3 = { sessionId: 'session2' } as WebSocketClient;
      
      const mockConnections = new Set([mockClient1, mockClient2, mockClient3]);
      
      (mockConnectionManager.getConnections as MockedFunction<any>).mockReturnValue(mockConnections);
      (mockConnectionManager.getSessionId as MockedFunction<any>)
        .mockReturnValueOnce('session1')
        .mockReturnValueOnce('session1')
        .mockReturnValueOnce('session2');
      (mockConnectionManager.getRole as MockedFunction<any>)
        .mockReturnValueOnce('teacher')
        .mockReturnValueOnce('student')
        .mockReturnValueOnce('teacher');
      (mockConnectionManager.getLanguage as MockedFunction<any>)
        .mockReturnValueOnce('en')
        .mockReturnValueOnce(undefined)
        .mockReturnValueOnce('es');
      (mockClassroomSessionManager.getClassroomCodeBySessionId as MockedFunction<any>)
        .mockReturnValueOnce('ABC123')
        .mockReturnValueOnce('ABC123')
        .mockReturnValueOnce('XYZ789');

      const metrics = sessionMetricsService.calculateActiveSessionMetrics();

      expect(metrics.activeSessions).toBe(2);
      expect(metrics.studentsConnected).toBe(1);
      expect(metrics.teachersConnected).toBe(2);
      expect(metrics.currentLanguages).toContain('en');
      expect(metrics.currentLanguages).toContain('es');
    });

    it('should handle connections without session IDs', () => {
      const mockClient1 = {} as WebSocketClient;
      const mockConnections = new Set([mockClient1]);
      
      (mockConnectionManager.getConnections as MockedFunction<any>).mockReturnValue(mockConnections);
      (mockConnectionManager.getSessionId as MockedFunction<any>).mockReturnValue(undefined);
      (mockConnectionManager.getRole as MockedFunction<any>).mockReturnValue('student');

      const metrics = sessionMetricsService.calculateActiveSessionMetrics();

      expect(metrics.activeSessions).toBe(0);
      expect(metrics.studentsConnected).toBe(1);
      expect(metrics.teachersConnected).toBe(0);
    });

    it('should handle connections without classroom codes', () => {
      const mockClient1 = {} as WebSocketClient;
      const mockConnections = new Set([mockClient1]);
      
      (mockConnectionManager.getConnections as MockedFunction<any>).mockReturnValue(mockConnections);
      (mockConnectionManager.getSessionId as MockedFunction<any>).mockReturnValue('session1');
      (mockConnectionManager.getRole as MockedFunction<any>).mockReturnValue('teacher');
      (mockConnectionManager.getLanguage as MockedFunction<any>).mockReturnValue('en');
      (mockClassroomSessionManager.getClassroomCodeBySessionId as MockedFunction<any>).mockReturnValue(undefined);

      const metrics = sessionMetricsService.calculateActiveSessionMetrics();

      expect(metrics.activeSessions).toBe(0);
      expect(metrics.teachersConnected).toBe(1);
      expect(metrics.currentLanguages).toContain('en');
    });

    it('should deduplicate languages correctly', () => {
      const mockClient1 = {} as WebSocketClient;
      const mockClient2 = {} as WebSocketClient;
      const mockConnections = new Set([mockClient1, mockClient2]);
      
      (mockConnectionManager.getConnections as MockedFunction<any>).mockReturnValue(mockConnections);
      (mockConnectionManager.getSessionId as MockedFunction<any>)
        .mockReturnValueOnce('session1')
        .mockReturnValueOnce('session2');
      (mockConnectionManager.getRole as MockedFunction<any>)
        .mockReturnValue('teacher');
      (mockConnectionManager.getLanguage as MockedFunction<any>)
        .mockReturnValue('en'); // Same language for both
      (mockClassroomSessionManager.getClassroomCodeBySessionId as MockedFunction<any>)
        .mockReturnValueOnce('ABC123')
        .mockReturnValueOnce('XYZ789');

      const metrics = sessionMetricsService.calculateActiveSessionMetrics();

      expect(metrics.currentLanguages).toEqual(['en']);
      expect(metrics.currentLanguages.length).toBe(1); // No duplicates
    });
  });
});
