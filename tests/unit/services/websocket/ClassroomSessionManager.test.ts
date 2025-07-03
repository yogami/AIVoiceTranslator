import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ClassroomSessionManager } from '../../../../server/services/websocket/ClassroomSessionManager';

describe('ClassroomSessionManager', () => {
  let classroomSessionManager: ClassroomSessionManager;

  beforeEach(() => {
    vi.clearAllMocks();
    classroomSessionManager = new ClassroomSessionManager();
  });

  afterEach(() => {
    classroomSessionManager.shutdown();
  });

  describe('constructor', () => {
    it('should initialize with empty sessions', () => {
      expect(classroomSessionManager.getActiveSessionCount()).toBe(0);
      expect(classroomSessionManager.getActiveSessions()).toEqual([]);
    });
  });

  describe('generateClassroomCode', () => {
    it('should generate unique 6-character codes', () => {
      const code1 = classroomSessionManager.generateClassroomCode('session1');
      const code2 = classroomSessionManager.generateClassroomCode('session2');
      
      expect(code1).toHaveLength(6);
      expect(code2).toHaveLength(6);
      expect(code1).not.toBe(code2);
      expect(code1).toMatch(/^[A-Z0-9]+$/);
      expect(code2).toMatch(/^[A-Z0-9]+$/);
    });

    it('should return existing code for same sessionId', () => {
      const sessionId = 'test-session-1';
      const code1 = classroomSessionManager.generateClassroomCode(sessionId);
      const code2 = classroomSessionManager.generateClassroomCode(sessionId);
      
      expect(code1).toBe(code2);
    });

    it('should update activity when returning existing code', async () => {
      const sessionId = 'test-session-1';
      const code = classroomSessionManager.generateClassroomCode(sessionId);
      
      const session1 = classroomSessionManager.getSessionByCode(code);
      const firstActivity = session1?.lastActivity;
      
      // Wait a bit and generate again
      await new Promise(resolve => setTimeout(resolve, 10));
      
      classroomSessionManager.generateClassroomCode(sessionId);
      const session2 = classroomSessionManager.getSessionByCode(code);
      
      expect(session2).toBeDefined();
      expect(session2?.lastActivity).toBeDefined();
      expect(session2?.lastActivity).toBeGreaterThanOrEqual(firstActivity || 0);
    });
  });

  describe('isValidClassroomCode', () => {
    it('should return true for valid codes', () => {
      const code = classroomSessionManager.generateClassroomCode('session1');
      expect(classroomSessionManager.isValidClassroomCode(code)).toBe(true);
    });

    it('should return false for invalid codes', () => {
      expect(classroomSessionManager.isValidClassroomCode('INVALID')).toBe(false);
      expect(classroomSessionManager.isValidClassroomCode('')).toBe(false);
    });

    it('should return false for expired codes', () => {
      const code = classroomSessionManager.generateClassroomCode('session1');
      
      // Manually expire the session
      const session = classroomSessionManager.getSessionByCode(code);
      if (session) {
        session.expiresAt = Date.now() - 1000; // Expired 1 second ago
      }
      
      expect(classroomSessionManager.isValidClassroomCode(code)).toBe(false);
    });
  });

  describe('getSessionByCode', () => {
    it('should return session for valid code', () => {
      const sessionId = 'test-session-1';
      const code = classroomSessionManager.generateClassroomCode(sessionId);
      const session = classroomSessionManager.getSessionByCode(code);
      
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.code).toBe(code);
    });

    it('should return undefined for invalid code', () => {
      const session = classroomSessionManager.getSessionByCode('INVALID');
      expect(session).toBeUndefined();
    });
  });

  describe('getActiveSessionCount', () => {
    it('should return 0 for no sessions', () => {
      expect(classroomSessionManager.getActiveSessionCount()).toBe(0);
    });

    it('should return correct count for active sessions', () => {
      classroomSessionManager.generateClassroomCode('session1');
      classroomSessionManager.generateClassroomCode('session2');
      classroomSessionManager.generateClassroomCode('session3');
      
      expect(classroomSessionManager.getActiveSessionCount()).toBe(3);
    });

    it('should not count expired sessions', () => {
      const code1 = classroomSessionManager.generateClassroomCode('session1');
      classroomSessionManager.generateClassroomCode('session2');
      
      // Expire first session
      const session1 = classroomSessionManager.getSessionByCode(code1);
      if (session1) {
        session1.expiresAt = Date.now() - 1000; // Expired 1 second ago
      }
      
      expect(classroomSessionManager.getActiveSessionCount()).toBe(1);
    });
  });

  describe('getActiveSessions', () => {
    it('should return empty array for no sessions', () => {
      expect(classroomSessionManager.getActiveSessions()).toEqual([]);
    });

    it('should return all active sessions', () => {
      classroomSessionManager.generateClassroomCode('session1');
      classroomSessionManager.generateClassroomCode('session2');
      
      const activeSessions = classroomSessionManager.getActiveSessions();
      
      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.find(s => s.sessionId === 'session1')).toBeDefined();
      expect(activeSessions.find(s => s.sessionId === 'session2')).toBeDefined();
    });

    it('should not return expired sessions', () => {
      const code1 = classroomSessionManager.generateClassroomCode('session1');
      classroomSessionManager.generateClassroomCode('session2');
      
      // Expire first session
      const session1 = classroomSessionManager.getSessionByCode(code1);
      if (session1) {
        session1.expiresAt = Date.now() - 1000; // Expired 1 second ago
      }
      
      const activeSessions = classroomSessionManager.getActiveSessions();
      
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].sessionId).toBe('session2');
    });
  });

  describe('updateActivity', () => {
    it('should update last activity time', async () => {
      const code = classroomSessionManager.generateClassroomCode('session1');
      const session1 = classroomSessionManager.getSessionByCode(code);
      const originalActivity = session1?.lastActivity;
      
      // Wait a bit and update activity
      await new Promise(resolve => setTimeout(resolve, 10));
      
      classroomSessionManager.updateActivity(code);
      const session2 = classroomSessionManager.getSessionByCode(code);
      expect(session2?.lastActivity).toBeDefined();
      expect(session2?.lastActivity).toBeGreaterThanOrEqual(originalActivity || 0);
    });

    it('should handle invalid codes gracefully', () => {
      expect(() => {
        classroomSessionManager.updateActivity('INVALID');
      }).not.toThrow();
    });
  });

  describe('getClassroomCodeBySessionId', () => {
    it('should return code for existing session', () => {
      const sessionId = 'test-session-1';
      const code = classroomSessionManager.generateClassroomCode(sessionId);
      
      expect(classroomSessionManager.getClassroomCodeBySessionId(sessionId)).toBe(code);
    });

    it('should return undefined for non-existent session', () => {
      expect(classroomSessionManager.getClassroomCodeBySessionId('non-existent')).toBeUndefined();
    });
  });

  describe('clearAll', () => {
    it('should clear all sessions', () => {
      classroomSessionManager.generateClassroomCode('session1');
      classroomSessionManager.generateClassroomCode('session2');
      
      expect(classroomSessionManager.getActiveSessionCount()).toBe(2);
      
      classroomSessionManager.clearAll();
      
      expect(classroomSessionManager.getActiveSessionCount()).toBe(0);
      expect(classroomSessionManager.getActiveSessions()).toEqual([]);
    });
  });

  describe('getAllSessions', () => {
    it('should return all sessions map', () => {
      classroomSessionManager.generateClassroomCode('session1');
      classroomSessionManager.generateClassroomCode('session2');
      
      const allSessions = classroomSessionManager.getAllSessions();
      
      expect(allSessions.size).toBe(2);
      expect(allSessions instanceof Map).toBe(true);
    });

    it('should return empty map when no sessions', () => {
      const allSessions = classroomSessionManager.getAllSessions();
      expect(allSessions.size).toBe(0);
    });
  });

  describe('addSession', () => {
    it('should add session manually', () => {
      const code = 'TEST123';
      const session = {
        code,
        sessionId: 'manual-session',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        teacherConnected: true,
        expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
      };
      
      classroomSessionManager.addSession(code, session);
      
      expect(classroomSessionManager.hasSession(code)).toBe(true);
      expect(classroomSessionManager.getSessionByCode(code)).toEqual(session);
    });
  });

  describe('hasSession', () => {
    it('should return true for existing session', () => {
      const code = classroomSessionManager.generateClassroomCode('session1');
      expect(classroomSessionManager.hasSession(code)).toBe(true);
    });

    it('should return false for non-existing session', () => {
      expect(classroomSessionManager.hasSession('INVALID')).toBe(false);
    });
  });

  describe('getSessionMetrics', () => {
    it('should return correct metrics', () => {
      classroomSessionManager.generateClassroomCode('session1');
      classroomSessionManager.generateClassroomCode('session2');
      
      const metrics = classroomSessionManager.getSessionMetrics();
      
      expect(metrics.totalSessions).toBe(2);
      expect(metrics.activeSessions).toHaveLength(2);
      expect(Array.isArray(metrics.activeSessions)).toBe(true);
    });

    it('should return zero metrics when no sessions', () => {
      const metrics = classroomSessionManager.getSessionMetrics();
      
      expect(metrics.totalSessions).toBe(0);
      expect(metrics.activeSessions).toHaveLength(0);
      expect(Array.isArray(metrics.activeSessions)).toBe(true);
    });
  });

  describe('triggerCleanup', () => {
    it('should remove expired sessions', () => {
      const code1 = classroomSessionManager.generateClassroomCode('session1');
      classroomSessionManager.generateClassroomCode('session2');
      
      // Expire first session
      const session1 = classroomSessionManager.getSessionByCode(code1);
      if (session1) {
        session1.expiresAt = Date.now() - 1000; // Expired 1 second ago
      }
      
      const cleanedCount = classroomSessionManager.triggerCleanup();
      
      expect(cleanedCount).toBe(1);
      expect(classroomSessionManager.getActiveSessionCount()).toBe(1);
    });

    it('should return 0 when no sessions to clean', () => {
      classroomSessionManager.generateClassroomCode('session1');
      
      const cleanedCount = classroomSessionManager.triggerCleanup();
      
      expect(cleanedCount).toBe(0);
      expect(classroomSessionManager.getActiveSessionCount()).toBe(1);
    });
  });

  describe('edge cases', () => {
    it('should handle empty sessionId', () => {
      const code = classroomSessionManager.generateClassroomCode('');
      expect(code).toHaveLength(6);
      
      const session = classroomSessionManager.getSessionByCode(code);
      expect(session?.sessionId).toBe('');
    });

    it('should handle multiple calls to shutdown', () => {
      expect(() => {
        classroomSessionManager.shutdown();
        classroomSessionManager.shutdown();
      }).not.toThrow();
    });
  });
});
