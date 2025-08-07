import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StorageSessionManager } from '../../../../server/services/session/StorageSessionManager.js';
import type { IStorage } from '../../../../server/storage.interface.js';

// Mock the logger
vi.mock('../../../../server/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('StorageSessionManager', () => {
  let storageSessionManager: StorageSessionManager;
  let mockStorage: IStorage;

  beforeEach(() => {
    mockStorage = {
      createSession: vi.fn(),
      updateSession: vi.fn(),
      getSessionById: vi.fn(),
      endSession: vi.fn(),
      getActiveSession: vi.fn(),
      getAllActiveSessions: vi.fn()
    } as any;

    storageSessionManager = new StorageSessionManager(mockStorage);
  });

  describe('constructor', () => {
    it('should initialize with storage dependency', () => {
      expect(storageSessionManager).toBeDefined();
    });
  });

  describe('setClassroomSessionManager', () => {
    it('should set the classroom session manager', () => {
      const mockClassroomManager = { someMethod: vi.fn() };
      
      storageSessionManager.setClassroomSessionManager(mockClassroomManager);
      
      // We can't directly access private properties, but we can test the method exists
      expect(() => {
        storageSessionManager.setClassroomSessionManager(mockClassroomManager);
      }).not.toThrow();
    });
  });

  describe('createSession', () => {
    it('should create session successfully', async () => {
      const sessionId = 'test-session-id';
      const teacherId = 'teacher-123';
      
      mockStorage.createSession = vi.fn().mockResolvedValue(undefined);
      
      await storageSessionManager.createSession(sessionId, teacherId);
      
      expect(mockStorage.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          teacherId
        })
      );
    });

    it('should create session without teacherId', async () => {
      const sessionId = 'test-session-id';
      
      mockStorage.createSession = vi.fn().mockResolvedValue(undefined);
      
      await storageSessionManager.createSession(sessionId);
      
      expect(mockStorage.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          teacherId: undefined
        })
      );
    });

    it('should handle storage errors when creating session', async () => {
      const sessionId = 'test-session-id';
      const error = new Error('Storage error');
      
      mockStorage.createSession = vi.fn().mockRejectedValue(error);
      
      await expect(
        storageSessionManager.createSession(sessionId)
      ).rejects.toThrow('Storage error');
    });
  });

  describe('updateSession', () => {
    it('should update session successfully', async () => {
      const sessionId = 'test-session-id';
      const updates: Partial<{ sessionId: string; teacherId: string; isActive: boolean }> = { 
        isActive: true,
        teacherId: 'teacher-123'
      };
      
      mockStorage.updateSession = vi.fn().mockResolvedValue({ sessionId, ...updates });
      
      const result = await storageSessionManager.updateSession(sessionId, updates);
      
      expect(result).toBe(true);
      expect(mockStorage.updateSession).toHaveBeenCalledWith(sessionId, updates);
    });

    it('should handle storage errors when updating session', async () => {
      const sessionId = 'test-session-id';
      const updates = { isActive: false };
      const error = new Error('Update failed');
      
      mockStorage.updateSession = vi.fn().mockRejectedValue(error);
      
      await expect(
        storageSessionManager.updateSession(sessionId, updates)
      ).rejects.toThrow('Update failed');
    });
  });

  describe('getSession', () => {
    it('should retrieve session successfully', async () => {
      const sessionId = 'test-session-id';
      const mockSession = { id: sessionId, isActive: true };
      
      mockStorage.getSessionById = vi.fn().mockResolvedValue(mockSession);
      
      const result = await storageSessionManager.getSession(sessionId);
      
      expect(result).toEqual(mockSession);
      expect(mockStorage.getSessionById).toHaveBeenCalledWith(sessionId);
    });

    it('should handle errors when retrieving session', async () => {
      const sessionId = 'test-session-id';
      const error = new Error('Database error');
      
      mockStorage.getSessionById = vi.fn().mockRejectedValue(error);
      
      const result = await storageSessionManager.getSession(sessionId);
      
      expect(result).toBeNull();
    });
  });

  describe('endSession', () => {
    it('should end session successfully', async () => {
      const sessionId = 'test-session-id';
      
      mockStorage.endSession = vi.fn().mockResolvedValue(undefined);
      
      await storageSessionManager.endSession(sessionId);
      
      expect(mockStorage.endSession).toHaveBeenCalledWith(sessionId);
    });

    it('should handle errors when ending session', async () => {
      const sessionId = 'test-session-id';
      const error = new Error('End session failed');
      
      mockStorage.endSession = vi.fn().mockRejectedValue(error);
      
      // Method doesn't throw, just logs error
      await expect(
        storageSessionManager.endSession(sessionId)
      ).resolves.not.toThrow();
    });
  });

  describe('isSessionActive', () => {
    it('should return true for active session', async () => {
      const sessionId = 'test-session-id';
      const mockSession = { id: sessionId, isActive: true };
      
      mockStorage.getSessionById = vi.fn().mockResolvedValue(mockSession);
      
      const result = await storageSessionManager.isSessionActive(sessionId);
      
      expect(result).toBe(true);
    });

    it('should return false for inactive session', async () => {
      const sessionId = 'test-session-id';
      const mockSession = { id: sessionId, isActive: false };
      
      mockStorage.getSessionById = vi.fn().mockResolvedValue(mockSession);
      
      const result = await storageSessionManager.isSessionActive(sessionId);
      
      expect(result).toBe(false);
    });

    it('should return false when session not found', async () => {
      const sessionId = 'test-session-id';
      
      mockStorage.getSessionById = vi.fn().mockResolvedValue(undefined);
      
      const result = await storageSessionManager.isSessionActive(sessionId);
      
      expect(result).toBe(false);
    });
  });

  describe('createSessionWithLanguage', () => {
    it('should create session with teacher language', async () => {
      const sessionId = 'test-session-id';
      const teacherLanguage = 'en';
      const teacherId = 'teacher-123';
      
      mockStorage.getSessionById = vi.fn().mockResolvedValue(undefined);
      mockStorage.createSession = vi.fn().mockResolvedValue(undefined);
      
      await storageSessionManager.createSessionWithLanguage(sessionId, teacherLanguage, teacherId);
      
      expect(mockStorage.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId,
          teacherId,
          teacherLanguage,
          isActive: true
        })
      );
    });

    it('should update existing session with teacher language', async () => {
      const sessionId = 'test-session-id';
      const teacherLanguage = 'en';
      const existingSession = { id: sessionId, isActive: false };
      
      mockStorage.getSessionById = vi.fn().mockResolvedValue(existingSession);
      mockStorage.updateSession = vi.fn().mockResolvedValue(undefined);
      
      await storageSessionManager.createSessionWithLanguage(sessionId, teacherLanguage);
      
      expect(mockStorage.updateSession).toHaveBeenCalledWith(sessionId, 
        expect.objectContaining({
          isActive: true,
          teacherLanguage
        })
      );
    });
  });
});
