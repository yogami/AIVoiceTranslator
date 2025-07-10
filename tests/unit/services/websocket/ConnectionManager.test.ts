import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ConnectionManager, type WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import { type ClientSettings } from '../../../../server/services/WebSocketTypes';

// Mock WebSocket client
function createMockWebSocketClient(sessionId: string = 'test-session'): WebSocketClient {
  return {
    isAlive: true,
    sessionId,
    on: vi.fn().mockReturnThis(),
    terminate: vi.fn(),
    ping: vi.fn(),
    send: vi.fn(),
    close: vi.fn(),
    readyState: 1, // WebSocket.OPEN
  } as any;
}

describe('ConnectionManager', () => {
  let connectionManager: ConnectionManager;
  let mockClient1: WebSocketClient;
  let mockClient2: WebSocketClient;
  let mockClient3: WebSocketClient;

  beforeEach(() => {
    connectionManager = new ConnectionManager();
    mockClient1 = createMockWebSocketClient('session-1');
    mockClient2 = createMockWebSocketClient('session-2');
    mockClient3 = createMockWebSocketClient('session-3');
  });

  describe('addConnection', () => {
    it('should add a connection with session ID', () => {
      connectionManager.addConnection(mockClient1, 'session-1');

      expect(connectionManager.getConnectionCount()).toBe(1);
      expect(connectionManager.getSessionId(mockClient1)).toBe('session-1');
      expect(mockClient1.sessionId).toBe('session-1');
    });

    it('should add multiple connections', () => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-2');

      expect(connectionManager.getConnectionCount()).toBe(2);
      expect(connectionManager.getSessionId(mockClient1)).toBe('session-1');
      expect(connectionManager.getSessionId(mockClient2)).toBe('session-2');
    });
  });

  describe('removeConnection', () => {
    it('should remove a connection and all associated metadata', () => {
      // Add connection with metadata
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.setRole(mockClient1, 'teacher');
      connectionManager.setLanguage(mockClient1, 'en');
      connectionManager.setClientSettings(mockClient1, { volume: 0.8 } as ClientSettings);

      // Remove connection
      connectionManager.removeConnection(mockClient1);

      expect(connectionManager.getConnectionCount()).toBe(0);
      expect(connectionManager.getRole(mockClient1)).toBeUndefined();
      expect(connectionManager.getLanguage(mockClient1)).toBeUndefined();
      expect(connectionManager.getSessionId(mockClient1)).toBeUndefined();
      expect(connectionManager.getClientSettings(mockClient1)).toBeUndefined();
    });

    it('should only remove the specified connection', () => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-2');

      connectionManager.removeConnection(mockClient1);

      expect(connectionManager.getConnectionCount()).toBe(1);
      expect(connectionManager.getSessionId(mockClient2)).toBe('session-2');
    });
  });

  describe('role management', () => {
    beforeEach(() => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-2');
      connectionManager.addConnection(mockClient3, 'session-3');
    });

    it('should set and get roles', () => {
      connectionManager.setRole(mockClient1, 'teacher');
      connectionManager.setRole(mockClient2, 'student');

      expect(connectionManager.getRole(mockClient1)).toBe('teacher');
      expect(connectionManager.getRole(mockClient2)).toBe('student');
      expect(connectionManager.getRole(mockClient3)).toBeUndefined();
    });

    it('should count students correctly', () => {
      connectionManager.setRole(mockClient1, 'teacher');
      connectionManager.setRole(mockClient2, 'student');
      connectionManager.setRole(mockClient3, 'student');

      expect(connectionManager.getStudentCount()).toBe(2);
    });

    it('should count teachers correctly', () => {
      connectionManager.setRole(mockClient1, 'teacher');
      connectionManager.setRole(mockClient2, 'student');
      connectionManager.setRole(mockClient3, 'teacher');

      expect(connectionManager.getTeacherCount()).toBe(2);
    });
  });

  describe('language management', () => {
    beforeEach(() => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-2');
    });

    it('should set and get languages', () => {
      connectionManager.setLanguage(mockClient1, 'en');
      connectionManager.setLanguage(mockClient2, 'es');

      expect(connectionManager.getLanguage(mockClient1)).toBe('en');
      expect(connectionManager.getLanguage(mockClient2)).toBe('es');
    });
  });

  describe('client settings management', () => {
    beforeEach(() => {
      connectionManager.addConnection(mockClient1, 'session-1');
    });

    it('should set and get client settings', () => {
      const settings: ClientSettings = { volume: 0.5 } as ClientSettings;
      connectionManager.setClientSettings(mockClient1, settings);

      expect(connectionManager.getClientSettings(mockClient1)).toEqual(settings);
    });
  });

  describe('getStudentConnectionsAndLanguages', () => {
    beforeEach(() => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-2');
      connectionManager.addConnection(mockClient3, 'session-3');
    });

    it('should return student connections and their languages', () => {
      connectionManager.setRole(mockClient1, 'teacher');
      connectionManager.setRole(mockClient2, 'student');
      connectionManager.setRole(mockClient3, 'student');
      
      connectionManager.setLanguage(mockClient2, 'es');
      connectionManager.setLanguage(mockClient3, 'fr');

      const result = connectionManager.getStudentConnectionsAndLanguages();

      expect(result.connections).toHaveLength(2);
      expect(result.connections).toContain(mockClient2);
      expect(result.connections).toContain(mockClient3);
      expect(result.languages).toEqual(['es', 'fr']);
    });

    it('should default to "en" for students without language', () => {
      connectionManager.setRole(mockClient1, 'student');
      // No language set for mockClient1

      const result = connectionManager.getStudentConnectionsAndLanguages();

      expect(result.connections).toHaveLength(1);
      expect(result.languages).toEqual(['en']);
    });

    it('should return empty arrays when no students', () => {
      connectionManager.setRole(mockClient1, 'teacher');

      const result = connectionManager.getStudentConnectionsAndLanguages();

      expect(result.connections).toHaveLength(0);
      expect(result.languages).toHaveLength(0);
    });
  });

  describe('getStudentConnectionsAndLanguagesForSession', () => {
    beforeEach(() => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-1'); 
      connectionManager.addConnection(mockClient3, 'session-2');
    });

    it('should return only student connections from specified session', () => {
      connectionManager.setRole(mockClient1, 'teacher');
      connectionManager.setRole(mockClient2, 'student');
      connectionManager.setRole(mockClient3, 'student');
      
      connectionManager.setLanguage(mockClient2, 'es');
      connectionManager.setLanguage(mockClient3, 'fr');

      const result = connectionManager.getStudentConnectionsAndLanguagesForSession('session-1');

      expect(result.connections).toHaveLength(1);
      expect(result.connections).toContain(mockClient2);
      expect(result.connections).not.toContain(mockClient3);
      expect(result.languages).toEqual(['es']);
    });

    it('should return empty arrays when no students in session', () => {
      connectionManager.setRole(mockClient1, 'teacher');
      connectionManager.setRole(mockClient2, 'teacher');
      connectionManager.setRole(mockClient3, 'student');

      const result = connectionManager.getStudentConnectionsAndLanguagesForSession('session-1');

      expect(result.connections).toHaveLength(0);
      expect(result.languages).toHaveLength(0);
    });

    it('should default to "en" for students without language in session', () => {
      connectionManager.setRole(mockClient2, 'student');
      // No language set for mockClient2

      const result = connectionManager.getStudentConnectionsAndLanguagesForSession('session-1');

      expect(result.connections).toHaveLength(1);
      expect(result.languages).toEqual(['en']);
    });

    it('should return empty arrays for non-existent session', () => {
      connectionManager.setRole(mockClient1, 'student');
      connectionManager.setRole(mockClient2, 'student');

      const result = connectionManager.getStudentConnectionsAndLanguagesForSession('non-existent-session');

      expect(result.connections).toHaveLength(0);
      expect(result.languages).toHaveLength(0);
    });
  });

  describe('student counting', () => {
    it('should check if student is not counted by default', () => {
      connectionManager.addConnection(mockClient1, 'session-1');
      expect(connectionManager.isStudentCounted(mockClient1)).toBe(false);
    });

    it('should set and check student counted status', () => {
      connectionManager.addConnection(mockClient1, 'session-1');
      
      connectionManager.setStudentCounted(mockClient1, true);
      expect(connectionManager.isStudentCounted(mockClient1)).toBe(true);
      
      connectionManager.setStudentCounted(mockClient1, false);
      expect(connectionManager.isStudentCounted(mockClient1)).toBe(false);
    });

    it('should handle student counted status for multiple connections', () => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-2');
      
      connectionManager.setStudentCounted(mockClient1, true);
      connectionManager.setStudentCounted(mockClient2, false);
      
      expect(connectionManager.isStudentCounted(mockClient1)).toBe(true);
      expect(connectionManager.isStudentCounted(mockClient2)).toBe(false);
    });

    it('should clear student counted status when connection is removed', () => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.setStudentCounted(mockClient1, true);
      
      expect(connectionManager.isStudentCounted(mockClient1)).toBe(true);
      
      connectionManager.removeConnection(mockClient1);
      connectionManager.addConnection(mockClient1, 'session-1'); // Re-add same client
      
      expect(connectionManager.isStudentCounted(mockClient1)).toBe(false);
    });

    it('should clear all student counted status when clearAll is called', () => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-2');
      connectionManager.setStudentCounted(mockClient1, true);
      connectionManager.setStudentCounted(mockClient2, true);
      
      expect(connectionManager.isStudentCounted(mockClient1)).toBe(true);
      expect(connectionManager.isStudentCounted(mockClient2)).toBe(true);
      
      connectionManager.clearAll();
      
      // Re-add connections to test they are no longer counted
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-2');
      
      expect(connectionManager.isStudentCounted(mockClient1)).toBe(false);
      expect(connectionManager.isStudentCounted(mockClient2)).toBe(false);
    });
  });

  describe('utility methods', () => {
    it('should check if connections exist', () => {
      expect(connectionManager.hasConnections()).toBe(false);

      connectionManager.addConnection(mockClient1, 'session-1');
      expect(connectionManager.hasConnections()).toBe(true);

      connectionManager.removeConnection(mockClient1);
      expect(connectionManager.hasConnections()).toBe(false);
    });

    it('should get active session IDs', () => {
      connectionManager.addConnection(mockClient1, 'session-1');
      connectionManager.addConnection(mockClient2, 'session-1'); // Same session
      connectionManager.addConnection(mockClient3, 'session-2'); // Different session

      const sessionIds = connectionManager.getActiveSessionIds();
      expect(sessionIds).toHaveLength(2);
      expect(sessionIds).toContain('session-1');
      expect(sessionIds).toContain('session-2');
    });

    it('should return copy of connections for safety', () => {
      connectionManager.addConnection(mockClient1, 'session-1');
      
      const connections1 = connectionManager.getConnections();
      const connections2 = connectionManager.getConnections();

      expect(connections1).not.toBe(connections2); // Different objects
      expect(connections1).toEqual(connections2); // Same content
    });
  });
});
