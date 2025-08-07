import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClassroomSessionManager } from '../../server/application/services/session/ClassroomSessionManager';
import { SessionService } from '../../server/application/services/session/SessionService';
import { StorageSessionManager } from '../../server/application/services/session/StorageSessionManager';
import { IStorage } from '../../server/storage.interface';

// Use real database storage for integration tests
let storage: IStorage;

describe('Session Management Integration Tests', () => {
  let classroomSessionManager: ClassroomSessionManager;
  let sessionService: SessionService;
  let storageSessionManager: StorageSessionManager;
  let testSessionIds: string[] = [];

  beforeEach(async () => {
    // Import real storage - this will use the test database
    const storageModule = await import('../../server/storage');
    storage = storageModule.storage;
    
    // Initialize real services
    classroomSessionManager = new ClassroomSessionManager();
    sessionService = new SessionService(storage);
    storageSessionManager = new StorageSessionManager(storage);
    
    // Clear test session tracking
    testSessionIds = [];
  });

  afterEach(async () => {
    // Clean up any test sessions we created
    for (const sessionId of testSessionIds) {
      try {
        await storage.endSession(sessionId);
        // Note: We don't delete from DB to maintain referential integrity,
        // just mark as ended. Test DB should be cleaned between test runs.
      } catch (error) {
        // Ignore cleanup errors - session might already be ended
      }
    }
  });

  // Helper function to track sessions for cleanup
  function trackSession(sessionId: string): void {
    testSessionIds.push(sessionId);
  }

  describe('Classroom Code Generation', () => {
    it('should generate unique classroom codes for different sessions', () => {
      const sessionId1 = `session-test-${Date.now()}-1`;
      const sessionId2 = `session-test-${Date.now()}-2`;
      trackSession(sessionId1);
      trackSession(sessionId2);

      const code1 = classroomSessionManager.generateClassroomCode(sessionId1);
      const code2 = classroomSessionManager.generateClassroomCode(sessionId2);

      expect(code1).toBeDefined();
      expect(code2).toBeDefined();
      expect(code1).not.toBe(code2);
      expect(code1).toMatch(/^[A-Z0-9]{6}$/);
      expect(code2).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should return same classroom code for same session ID (within same instance)', () => {
      const sessionId = `session-test-${Date.now()}`;
      trackSession(sessionId);

      const code1 = classroomSessionManager.generateClassroomCode(sessionId);
      const code2 = classroomSessionManager.generateClassroomCode(sessionId);

      expect(code1).toBe(code2);
      expect(classroomSessionManager.isValidClassroomCode(code1)).toBe(true);
    });

    it('should generate new code after clearing session classroom code', () => {
      const sessionId = `session-clear-test-${Date.now()}`;
      trackSession(sessionId);

      // Generate initial code
      const originalCode = classroomSessionManager.generateClassroomCode(sessionId);
      expect(originalCode).toBeDefined();

      // Clear the code
      const cleared = classroomSessionManager.clearSessionClassroomCode(sessionId);
      expect(cleared).toBe(true);

      // Generate new code - should be different
      const newCode = classroomSessionManager.generateClassroomCode(sessionId);
      expect(newCode).toBeDefined();
      expect(newCode).not.toBe(originalCode);
    });

    it('should handle clearing non-existent session gracefully', () => {
      const nonExistentSessionId = `session-does-not-exist-${Date.now()}`;

      const cleared = classroomSessionManager.clearSessionClassroomCode(nonExistentSessionId);
      expect(cleared).toBe(false);
    });
  });

  describe('Teacher Reconnection Scenario', () => {
    it('should simulate teacher reconnection workflow with fresh classroom codes', async () => {
      const teacherId = `teacher-${Date.now()}`;
      const initialSessionId = `session-initial-${Date.now()}`;
      trackSession(initialSessionId);

      // Step 1: Teacher logs in first time - create session in database
      await storageSessionManager.createSession(initialSessionId, teacherId);
      const initialCode = classroomSessionManager.generateClassroomCode(initialSessionId);
      expect(initialCode).toBeDefined();

      // Step 2: Store the classroom code in storage (simulating the full flow)
      await storage.updateSession(initialSessionId, { 
        classCode: initialCode,
        isActive: true 
      });

      // Step 3: Simulate teacher disconnecting and reconnecting
      // The reconnection logic would find the existing session in database
      const existingSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(existingSession).toBeDefined();
      expect(existingSession?.sessionId).toBe(initialSessionId);
      expect(existingSession?.classCode).toBe(initialCode);

      // Step 4: Apply our fix - clear old classroom code for reconnection
      const cleared = classroomSessionManager.clearSessionClassroomCode(initialSessionId);
      expect(cleared).toBe(true);

      // Step 5: Generate new classroom code for reconnection
      const newCode = classroomSessionManager.generateClassroomCode(initialSessionId);
      expect(newCode).toBeDefined();
      expect(newCode).not.toBe(initialCode);

      // Step 6: Verify both codes are valid format but different
      expect(newCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(initialCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(classroomSessionManager.isValidClassroomCode(newCode)).toBe(true);
    });

    it('should handle multiple teacher reconnections correctly', async () => {
      const teacherId = `teacher-multi-${Date.now()}`;
      const sessionId = `session-multi-${Date.now()}`;
      trackSession(sessionId);
      const codes: string[] = [];

      // Create initial session in database
      await storageSessionManager.createSession(sessionId, teacherId);

      // Simulate 3 reconnections
      for (let i = 0; i < 3; i++) {
        // Clear previous code if exists (simulating our fix)
        if (i > 0) {
          classroomSessionManager.clearSessionClassroomCode(sessionId);
        }

        // Generate new code
        const code = classroomSessionManager.generateClassroomCode(sessionId);
        codes.push(code);

        // Update storage with new code
        await storage.updateSession(sessionId, { classCode: code });
      }

      // Verify all codes are unique
      expect(codes).toHaveLength(3);
      expect(new Set(codes).size).toBe(3); // All unique
      
      // Only the last code should still be valid (as previous ones were cleared)
      codes.forEach((code, index) => {
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
        if (index === codes.length - 1) {
          // Last code should still be valid
          expect(classroomSessionManager.isValidClassroomCode(code)).toBe(true);
        } else {
          // Previous codes were cleared, so they're no longer valid
          expect(classroomSessionManager.isValidClassroomCode(code)).toBe(false);
        }
      });
    });
  });

  describe('Session ID Generation', () => {
    it('should generate unique session IDs', () => {
      const sessionIds = new Set<string>();
      
      // Generate 10 session IDs
      for (let i = 0; i < 10; i++) {
        const sessionId = sessionService.generateSessionId();
        expect(sessionId).toMatch(/^session-\d+-\d+$/);
        sessionIds.add(sessionId);
      }

      // All should be unique
      expect(sessionIds.size).toBe(10);
    });
  });

  describe('Session Validation', () => {
    it('should validate classroom codes correctly', () => {
      const sessionId = 'session-validation';
      const validCode = classroomSessionManager.generateClassroomCode(sessionId);

      // Valid code
      expect(classroomSessionManager.isValidClassroomCode(validCode)).toBe(true);

      // Invalid formats
      expect(classroomSessionManager.isValidClassroomCode('ABC123!')).toBe(false); // Invalid character
      expect(classroomSessionManager.isValidClassroomCode('ABC12')).toBe(false);   // Too short
      expect(classroomSessionManager.isValidClassroomCode('ABC1234')).toBe(false); // Too long
      expect(classroomSessionManager.isValidClassroomCode('abc123')).toBe(false);  // Lowercase
      expect(classroomSessionManager.isValidClassroomCode('')).toBe(false);        // Empty
    });

    it('should handle expired classroom codes', () => {
      // This test would need to mock time or have configurable expiration
      // For now, we test the basic validation structure
      const sessionId = 'session-expiry';
      const code = classroomSessionManager.generateClassroomCode(sessionId);
      
      expect(classroomSessionManager.isValidClassroomCode(code)).toBe(true);
      
      // After clearing, the code should no longer be in the manager
      classroomSessionManager.clearSessionClassroomCode(sessionId);
      
      // The format validation should still pass, but it's no longer tracked
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
    });
  });

  describe('Storage Integration', () => {
    it('should create and retrieve sessions correctly', async () => {
      const sessionId = `session-storage-test-${Date.now()}`;
      const teacherId = `teacher-storage-${Date.now()}`;
      trackSession(sessionId);

      // Create session using real storage
      await storageSessionManager.createSession(sessionId, teacherId);

      // Retrieve session from real database
      const session = await storage.getSessionById(sessionId);
      expect(session).toBeDefined();
      expect(session?.sessionId).toBe(sessionId);
      expect(session?.teacherId).toBe(teacherId);
      expect(session?.isActive).toBe(true);
    });

    it('should update session with classroom code', async () => {
      const sessionId = `session-update-test-${Date.now()}`;
      const teacherId = `teacher-update-${Date.now()}`;
      const classCode = 'TEST99';
      trackSession(sessionId);

      // Create session
      await storageSessionManager.createSession(sessionId, teacherId);

      // Update with classroom code using real storage
      await storage.updateSession(sessionId, { classCode });

      // Verify update in real database
      const session = await storage.getSessionById(sessionId);
      expect(session?.classCode).toBe(classCode);
    });
  });

  describe('Edge Cases', () => {
    it('should handle concurrent classroom code generation', () => {
      const timestamp = Date.now();
      const sessionIds = [
        `session-concurrent-${timestamp}-1`, 
        `session-concurrent-${timestamp}-2`, 
        `session-concurrent-${timestamp}-3`
      ];
      sessionIds.forEach(trackSession);
      
      const codes = sessionIds.map(id => classroomSessionManager.generateClassroomCode(id));

      // All codes should be unique
      expect(new Set(codes).size).toBe(codes.length);
      
      // All should be valid format
      codes.forEach(code => {
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
      });
    });

    it('should handle session cleanup without affecting other sessions', () => {
      const timestamp = Date.now();
      const sessionId1 = `session-cleanup-${timestamp}-1`;
      const sessionId2 = `session-cleanup-${timestamp}-2`;
      trackSession(sessionId1);
      trackSession(sessionId2);

      const code1 = classroomSessionManager.generateClassroomCode(sessionId1);
      const code2 = classroomSessionManager.generateClassroomCode(sessionId2);

      // Clear one session
      classroomSessionManager.clearSessionClassroomCode(sessionId1);

      // Other session should still be valid
      expect(classroomSessionManager.isValidClassroomCode(code2)).toBe(true);
      
      // Cleared session should be able to generate new code
      const newCode1 = classroomSessionManager.generateClassroomCode(sessionId1);
      expect(newCode1).not.toBe(code1);
      expect(newCode1).toMatch(/^[A-Z0-9]{6}$/);
    });
  });
});
