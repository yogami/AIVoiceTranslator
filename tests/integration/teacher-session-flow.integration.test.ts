/**
 * Teacher Session Flow Integration Tests
 * 
 * Tests the complete teacher session flow including:
 * - Teacher authentication persistence across disconnections
 * - Classroom code generation at session creation
 * - Teacher rejoining existing sessions vs creating new ones
 * - Analytics tracking by persistent teacherId
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApiRoutes } from '../../server/routes';
import { setupIsolatedTest, cleanupIsolatedTest } from '../utils/test-database-isolation';
import { DiagnosticsService } from '../../server/services/DiagnosticsService';
import { StorageSessionManager } from '../../server/services/websocket/StorageSessionManager';
import logger from '../../server/logger';
import { DatabaseStorage } from '../../server/database-storage';

describe('Teacher Session Flow Integration Tests', () => {
  let app: express.Application;
  let storage: DatabaseStorage;
  let storageSessionManager: StorageSessionManager;
  const testId = 'teacher-session-flow-test';

  beforeEach(async () => {
    // Create isolated test storage
    storage = await setupIsolatedTest(testId);
    
    // Create StorageSessionManager
    storageSessionManager = new StorageSessionManager(storage);
    
    // Create mock services
    const diagnosticsService = new DiagnosticsService(storage, null);
    const mockActiveSessionProvider = {
      getActiveSessionCount: vi.fn().mockReturnValue(0),
      getActiveSessions: vi.fn().mockReturnValue([]),
      getActiveTeacherCount: vi.fn().mockReturnValue(0),
      getActiveStudentCount: vi.fn().mockReturnValue(0),
      getActiveSessionsCount: vi.fn().mockReturnValue(0)
    };
    
    // Create Express app with auth routes
    app = express();
    app.use(express.json());
    
    // Create API routes with test storage and mock services
    const apiRoutes = createApiRoutes(storage, diagnosticsService, mockActiveSessionProvider);
    app.use('/api', apiRoutes);
    
    // Silence logs during tests
    vi.spyOn(logger, 'info').mockImplementation(function(this: any, ...args: any[]) { 
      return this;
    });
    vi.spyOn(logger, 'error').mockImplementation(function(this: any, ...args: any[]) { 
      return this;
    });
    vi.spyOn(logger, 'warn').mockImplementation(function(this: any, ...args: any[]) { 
      return this;
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupIsolatedTest(testId);
  });

  describe('Persistent TeacherId Functionality', () => {
    it('should provide same teacherId across server restarts for authenticated teacher', async () => {
      // Register teacher
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'persistent.teacher',
          password: 'password123'
        });

      const originalTeacherId = registerResponse.body.user.id;
      expect(originalTeacherId).toBeDefined();
      expect(typeof originalTeacherId).toBe('number');

      // Login multiple times (simulating server restarts/reconnections)
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'persistent.teacher',
          password: 'password123'
        });

      const login2 = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'persistent.teacher',
          password: 'password123'
        });

      // TeacherId should be consistent (database ID persists)
      expect(login1.body.user.id).toBe(originalTeacherId);
      expect(login2.body.user.id).toBe(originalTeacherId);
    });

    it('should allow teacher to rejoin existing session after disconnection', async () => {
      // Register and login teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'reconnecting.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'reconnecting.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Create first session
      const sessionId1 = 'session-reconnect-test';
      await storageSessionManager.createSession(sessionId1, teacherId);

      // Verify session was created with teacherId
      const originalSession = await storage.getSessionById(sessionId1);
      expect(originalSession).toBeTruthy();
      expect(originalSession!.teacherId).toBe(teacherId);
      expect(originalSession!.classCode).toBeTruthy(); // Classroom code should be generated
      
      const originalClassCode = originalSession!.classCode;

      // Simulate teacher disconnection and creating another session with same sessionId
      // This should rejoin the existing session, not create a new one
      await storageSessionManager.createSession(sessionId1, teacherId);

      // Verify it's still the same session
      const rejoinedSession = await storage.getSessionById(sessionId1);
      expect(rejoinedSession!.id).toBe(originalSession!.id);
      expect(rejoinedSession!.teacherId).toBe(teacherId);
      expect(rejoinedSession!.classCode).toBe(originalClassCode); // Same classroom code
    });

    it('should prevent teacher from joining another teachers session', async () => {
      // Register two teachers
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'teacher1',
          password: 'password123'
        });

      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'teacher2',
          password: 'password123'
        });

      const login1 = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'teacher1',
          password: 'password123'
        });

      const login2 = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'teacher2',
          password: 'password123'
        });

      const teacherId1 = login1.body.user.id.toString();
      const teacherId2 = login2.body.user.id.toString();

      // Teacher1 creates a session
      const sessionId = 'shared-session-test';
      await storageSessionManager.createSession(sessionId, teacherId1);

      const teacher1Session = await storage.getSessionById(sessionId);
      expect(teacher1Session!.teacherId).toBe(teacherId1);

      // Teacher2 tries to join the same session (this should either fail or create a different session)
      // In current implementation, it will either update the existing session or ignore if already exists
      await storageSessionManager.createSession(sessionId, teacherId2);

      // The session should still belong to teacher1 (existing session wins)
      const finalSession = await storage.getSessionById(sessionId);
      expect(finalSession!.teacherId).toBe(teacherId1); // Should remain teacher1's session
    });
  });

  describe('Classroom Code Generation at Session Creation', () => {
    it('should generate classroom code immediately when session is created', async () => {
      // Register and login teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'classroomcode.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'classroomcode.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Create session
      const sessionId = 'classroomcode-test';
      await storageSessionManager.createSession(sessionId, teacherId);

      // Verify session was created with classroom code immediately
      const session = await storage.getSessionById(sessionId);
      expect(session).toBeTruthy();
      expect(session!.classCode).toBeTruthy();
      expect(session!.classCode).not.toBeNull();
      expect(typeof session!.classCode).toBe('string');
      expect(session!.classCode!.length).toBeGreaterThan(0);
    });

    it('should generate unique classroom codes for different sessions', async () => {
      // Register teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'unique.codes.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'unique.codes.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Create multiple sessions
      const sessionId1 = 'unique-codes-test-1';
      const sessionId2 = 'unique-codes-test-2';
      
      await storageSessionManager.createSession(sessionId1, teacherId);
      await storageSessionManager.createSession(sessionId2, teacherId);

      // Verify both sessions have unique classroom codes
      const session1 = await storage.getSessionById(sessionId1);
      const session2 = await storage.getSessionById(sessionId2);

      expect(session1!.classCode).toBeTruthy();
      expect(session2!.classCode).toBeTruthy();
      expect(session1!.classCode).not.toBe(session2!.classCode); // Codes should be unique
    });

    it('should maintain same classroom code when teacher rejoins existing session', async () => {
      // Register teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'maintain.code.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'maintain.code.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Create session
      const sessionId = 'maintain-code-test';
      await storageSessionManager.createSession(sessionId, teacherId);

      const originalSession = await storage.getSessionById(sessionId);
      const originalClassCode = originalSession!.classCode;

      // Teacher "rejoins" the session (simulating reconnection)
      await storageSessionManager.createSession(sessionId, teacherId);

      const rejoinedSession = await storage.getSessionById(sessionId);
      expect(rejoinedSession!.classCode).toBe(originalClassCode); // Code should remain the same
    });
  });

  describe('Teacher Analytics by Persistent TeacherId', () => {
    it('should enable analytics tracking across multiple sessions for same teacher', async () => {
      // Register teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'analytics.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'analytics.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Create multiple sessions over time
      const sessionId1 = 'analytics-session-1';
      const sessionId2 = 'analytics-session-2';
      const sessionId3 = 'analytics-session-3';

      await storageSessionManager.createSession(sessionId1, teacherId);
      await storageSessionManager.createSession(sessionId2, teacherId);
      await storageSessionManager.createSession(sessionId3, teacherId);

      // Add some translations to track activity
      await storage.addTranslation({
        sessionId: sessionId1,
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES',
        originalText: 'Hello session 1',
        translatedText: 'Hola sesión 1'
      });

      await storage.addTranslation({
        sessionId: sessionId2,
        sourceLanguage: 'en-US',
        targetLanguage: 'fr-FR',
        originalText: 'Hello session 2',
        translatedText: 'Bonjour session 2'
      });

      // Verify all sessions belong to same teacher for analytics
      const session1 = await storage.getSessionById(sessionId1);
      const session2 = await storage.getSessionById(sessionId2);
      const session3 = await storage.getSessionById(sessionId3);

      expect(session1!.teacherId).toBe(teacherId);
      expect(session2!.teacherId).toBe(teacherId);
      expect(session3!.teacherId).toBe(teacherId);

      // This enables analytics queries like:
      // - How many sessions has this teacher created?
      // - What's the average session duration for this teacher?
      // - What languages does this teacher use most often?
    });

    it('should track teacher activity across different time periods', async () => {
      // Register teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'activity.tracking.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'activity.tracking.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Create sessions with different start times (simulating usage over time)
      const sessionId1 = 'activity-session-1';
      const sessionId2 = 'activity-session-2';

      await storageSessionManager.createSession(sessionId1, teacherId);
      
      // Update first session with some activity
      await storage.updateSession(sessionId1, {
        totalTranslations: 5,
        studentsCount: 3,
        lastActivityAt: new Date()
      });

      // Create second session later
      await storageSessionManager.createSession(sessionId2, teacherId);
      await storage.updateSession(sessionId2, {
        totalTranslations: 10,
        studentsCount: 8,
        lastActivityAt: new Date()
      });

      // Verify teacher's total activity can be aggregated
      const session1 = await storage.getSessionById(sessionId1);
      const session2 = await storage.getSessionById(sessionId2);

      expect(session1).toBeTruthy();
      expect(session2).toBeTruthy();

      if (!session1 || !session2) {
        throw new Error('Sessions should exist');
      }

      const totalTranslations = (session1.totalTranslations || 0) + (session2.totalTranslations || 0);
      const totalStudents = (session1.studentsCount || 0) + (session2.studentsCount || 0);

      expect(totalTranslations).toBe(15);
      expect(totalStudents).toBe(11);
      expect(session1.teacherId).toBe(session2.teacherId); // Same teacher across all sessions
    });
  });

  describe('Authentication Flow Requirements', () => {
    it('should ensure teacherId is available at session creation when teacher is authenticated', async () => {
      // Register teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'auth.flow.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'auth.flow.teacher',
          password: 'password123'
        });

      const authToken = loginResponse.body.token;
      const expectedTeacherId = loginResponse.body.user.id.toString();

      // Verify token contains teacherId
      expect(authToken).toBeTruthy();
      expect(expectedTeacherId).toBeTruthy();

      // When creating a session with authenticated teacherId
      const sessionId = 'auth-flow-test';
      await storageSessionManager.createSession(sessionId, expectedTeacherId);

      // Verify session was created with the authenticated teacherId
      const session = await storage.getSessionById(sessionId);
      expect(session!.teacherId).toBe(expectedTeacherId);
      expect(session!.classCode).toBeTruthy(); // Classroom code generated immediately
    });

    it('should warn when session is created without authenticated teacherId', async () => {
      const sessionId = 'unauthenticated-test';
      
      // Create session without teacherId (should trigger fallback)
      await storageSessionManager.createSession(sessionId);

      const session = await storage.getSessionById(sessionId);
      expect(session!.teacherId).toBe(`teacher_${sessionId}`); // Fallback teacherId
      expect(session!.classCode).toBeTruthy(); // Still generates classroom code
    });
  });
});
