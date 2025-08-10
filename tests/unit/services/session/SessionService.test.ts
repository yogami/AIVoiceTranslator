/**
 * Unit tests for SessionService
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SessionService, type ClassroomSession } from '../../../../server/services/session/SessionService';
import type { IStorage } from '../../../../server/storage.interface';

describe('SessionService', () => {
  let sessionService: SessionService;
  let mockStorage: IStorage;

  beforeEach(() => {
    mockStorage = {
      updateSession: vi.fn().mockResolvedValue(undefined),
      // Add other required IStorage methods as mocks
      addTranslation: vi.fn(),
      getActiveSession: vi.fn(),
      getAllActiveSessions: vi.fn(),
      createSession: vi.fn(),
      closeSession: vi.fn(),
      getTranslations: vi.fn(),
      getAnalytics: vi.fn(),
      exportData: vi.fn(),
      clearData: vi.fn()
    } as unknown as IStorage;

    sessionService = new SessionService(mockStorage);
  });

  afterEach(() => {
    sessionService.shutdown();
    vi.clearAllMocks();
  });

  describe('generateSessionId', () => {
    it('should generate unique session IDs', () => {
      const id1 = sessionService.generateSessionId();
      const id2 = sessionService.generateSessionId();
      
      expect(id1).toBeTruthy();
      expect(id2).toBeTruthy();
      expect(id1).not.toBe(id2);
      expect(id1).toMatch(/^session-\d+-\d+$/);
      expect(id2).toMatch(/^session-\d+-\d+$/);
    });

    it('should increment counter for each session', () => {
      const id1 = sessionService.generateSessionId();
      const id2 = sessionService.generateSessionId();
      
      const counter1 = parseInt(id1.split('-')[1]); // Counter is at position 1
      const counter2 = parseInt(id2.split('-')[1]); // Counter is at position 1
      
      expect(counter2).toBe(counter1 + 1);
    });
  });

  describe('generateClassroomCode', () => {
    it('should generate 6-character alphanumeric code', () => {
      const sessionId = 'test-session-1';
      const code = sessionService.generateClassroomCode(sessionId);
      
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should return same code for same session ID', () => {
      const sessionId = 'test-session-1';
      const code1 = sessionService.generateClassroomCode(sessionId);
      const code2 = sessionService.generateClassroomCode(sessionId);
      
      expect(code1).toBe(code2);
    });

    it('should generate different codes for different sessions', () => {
      const sessionId1 = 'test-session-1';
      const sessionId2 = 'test-session-2';
      const code1 = sessionService.generateClassroomCode(sessionId1);
      const code2 = sessionService.generateClassroomCode(sessionId2);
      
      expect(code1).not.toBe(code2);
    });

    it('should create classroom session with proper structure', () => {
      const sessionId = 'test-session-1';
      const code = sessionService.generateClassroomCode(sessionId);
      const session = sessionService.getClassroomSession(code);
      
      expect(session).toBeDefined();
      expect(session!.code).toBe(code);
      expect(session!.sessionId).toBe(sessionId);
      expect(session!.teacherConnected).toBe(true);
      expect(session!.createdAt).toBeGreaterThan(0);
      expect(session!.lastActivity).toBeGreaterThan(0);
      expect(session!.expiresAt).toBeGreaterThan(Date.now());
    });
  });

  describe('getClassroomSession', () => {
    it('should return undefined for non-existent code', () => {
      const session = sessionService.getClassroomSession('NONEXISTENT');
      expect(session).toBeUndefined();
    });

    it('should return session for existing code', () => {
      const sessionId = 'test-session-1';
      const code = sessionService.generateClassroomCode(sessionId);
      const session = sessionService.getClassroomSession(code);
      
      expect(session).toBeDefined();
      expect(session!.sessionId).toBe(sessionId);
    });
  });

  describe('getAllClassroomSessions', () => {
    it('should return empty map initially', () => {
      const sessions = sessionService.getAllClassroomSessions();
      expect(sessions.size).toBe(0);
    });

    it('should return all created sessions', () => {
      const sessionId1 = 'test-session-1';
      const sessionId2 = 'test-session-2';
      
      sessionService.generateClassroomCode(sessionId1);
      sessionService.generateClassroomCode(sessionId2);
      
      const sessions = sessionService.getAllClassroomSessions();
      expect(sessions.size).toBe(2);
      
      const sessionIds = Array.from(sessions.values()).map((s: ClassroomSession) => s.sessionId);
      expect(sessionIds).toContain(sessionId1);
      expect(sessionIds).toContain(sessionId2);
    });
  });

  describe('updateSessionInStorage', () => {
    it('should call storage.updateSession with correct parameters', async () => {
      const sessionId = 'test-session-1';
      const updates = { teacherLanguage: 'en-US' };
      
      await sessionService.updateSessionInStorage(sessionId, updates);
      
      expect(mockStorage.updateSession).toHaveBeenCalledWith(sessionId, updates);
    });

    it('should handle storage errors gracefully', async () => {
      const sessionId = 'test-session-1';
      const updates = { teacherLanguage: 'en-US' };
      const error = new Error('Storage error');
      
      (mockStorage.updateSession as any).mockRejectedValue(error);
      
      await expect(sessionService.updateSessionInStorage(sessionId, updates))
        .rejects.toThrow('Storage error');
    });
  });

  describe('shutdown', () => {
    it('should clear all sessions and stop cleanup', () => {
      const sessionId = 'test-session-1';
      sessionService.generateClassroomCode(sessionId);
      
      expect(sessionService.getAllClassroomSessions().size).toBe(1);
      
      sessionService.shutdown();
      
      expect(sessionService.getAllClassroomSessions().size).toBe(0);
    });
  });
});
