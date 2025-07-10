/**
 * Teacher Authentication Flow End-to-End Tests
 * 
 * Tests the complete teacher authentication flow from login to teacher page:
 * - Teacher must login before accessing teacher page
 * - Teacher page displays classroom code immediately after session creation
 * - Teacher page URL includes classroom code for students
 * - Authentication prevents access without valid token
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

describe('Teacher Authentication Flow E2E Tests', () => {
  let app: express.Application;
  let storage: DatabaseStorage;
  let storageSessionManager: StorageSessionManager;
  const testId = 'teacher-auth-flow-e2e-test';

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

  describe('Authentication Requirements for Teacher Page Access', () => {
    it('should verify teacher token before allowing session creation', async () => {
      // Register and login teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'auth.required.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'auth.required.teacher',
          password: 'password123'
        });

      const token = loginResponse.body.token;
      const teacherId = loginResponse.body.user.id.toString();

      // Verify token is valid
      const verifyResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(verifyResponse.body.user.id).toBe(loginResponse.body.user.id);

      // Now create session with authenticated teacherId
      const sessionId = 'auth-required-session';
      await storageSessionManager.createSession(sessionId, teacherId);

      // Verify session was created correctly
      const session = await storage.getSessionById(sessionId);
      expect(session!.teacherId).toBe(teacherId);
      expect(session!.classCode).toBeTruthy();
    });

    it('should reject token verification with invalid token', async () => {
      const invalidToken = 'invalid.jwt.token';

      await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${invalidToken}`)
        .expect(401);
    });

    it('should reject token verification with no token', async () => {
      await request(app)
        .get('/api/auth/me')
        .expect(401);
    });
  });

  describe('Classroom Code Availability at Teacher Page Load', () => {
    it('should have classroom code immediately available when teacher creates session', async () => {
      // Register and login teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'immediate.code.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'immediate.code.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Create session (simulating teacher page initialization)
      const sessionId = 'immediate-code-session';
      await storageSessionManager.createSession(sessionId, teacherId);

      // Verify classroom code is immediately available (NOT NULL)
      const session = await storage.getSessionById(sessionId);
      expect(session).toBeTruthy();
      expect(session!.classCode).toBeTruthy();
      expect(session!.classCode).not.toBeNull();
      expect(session!.classCode).not.toBeUndefined();
      expect(typeof session!.classCode).toBe('string');
      expect(session!.classCode!.length).toBeGreaterThan(0);

      // Verify classroom code follows expected format (6 alphanumeric characters)
      expect(session!.classCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should generate student URL with classroom code for teacher page display', async () => {
      // Register and login teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'student.url.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'student.url.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Create session
      const sessionId = 'student-url-session';
      await storageSessionManager.createSession(sessionId, teacherId);

      // Get session data for teacher page
      const session = await storage.getSessionById(sessionId);
      const classCode = session!.classCode;

      // Simulate teacher page generating student URL
      const baseUrl = 'http://localhost:5000'; // In real app, this would be from environment
      const studentUrl = `${baseUrl}/student?code=${classCode}`;

      // Verify student URL format
      expect(studentUrl).toMatch(/^http:\/\/localhost:5000\/student\?code=[A-Z0-9]{6}$/);
      expect(studentUrl).toContain(classCode!);

      // This URL should be immediately available for QR code generation and display
      console.log('Generated student URL:', studentUrl);
    });

    it('should maintain same classroom code across teacher reconnections', async () => {
      // Register and login teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'reconnect.code.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'reconnect.code.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Teacher creates session first time
      const sessionId = 'reconnect-code-session';
      await storageSessionManager.createSession(sessionId, teacherId);

      const originalSession = await storage.getSessionById(sessionId);
      const originalClassCode = originalSession!.classCode;

      // Teacher reconnects (simulating browser refresh, network disconnect, etc.)
      // Session creation should find existing session and preserve classroom code
      await storageSessionManager.createSession(sessionId, teacherId);

      const reconnectedSession = await storage.getSessionById(sessionId);
      expect(reconnectedSession!.classCode).toBe(originalClassCode);
      expect(reconnectedSession!.teacherId).toBe(teacherId);

      // Student URL should remain the same
      const baseUrl = 'http://localhost:5000';
      const studentUrl = `${baseUrl}/student?code=${originalClassCode}`;
      console.log('Persistent student URL after reconnection:', studentUrl);
    });
  });

  describe('Complete Authentication to Teacher Page Flow', () => {
    it('should demonstrate complete flow: register -> login -> create session -> get classroom code', async () => {
      // Step 1: Teacher registers
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'complete.flow.teacher',
          password: 'password123'
        })
        .expect(201);

      expect(registerResponse.body.message).toBe('Teacher registered successfully');
      const registeredTeacherId = registerResponse.body.user.id;

      // Step 2: Teacher logs in
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'complete.flow.teacher',
          password: 'password123'
        })
        .expect(200);

      expect(loginResponse.body.message).toBe('Login successful');
      expect(loginResponse.body.user.id).toBe(registeredTeacherId); // Same ID persists
      expect(loginResponse.body.token).toBeTruthy();

      const authToken = loginResponse.body.token;
      const authenticatedTeacherId = loginResponse.body.user.id.toString();

      // Step 3: Verify teacher is authenticated
      const verifyResponse = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(verifyResponse.body.user.id).toBe(registeredTeacherId);

      // Step 4: Teacher accesses teacher page and creates session
      // (In real app, this would happen when teacher page loads)
      const sessionId = 'complete-flow-session';
      await storageSessionManager.createSession(sessionId, authenticatedTeacherId);

      // Step 5: Verify session has everything needed for teacher page
      const session = await storage.getSessionById(sessionId);
      expect(session!.teacherId).toBe(authenticatedTeacherId);
      expect(session!.classCode).toBeTruthy();
      expect(session!.isActive).toBe(true);

      // Step 6: Teacher page can immediately display classroom info
      const classCode = session!.classCode;
      const baseUrl = 'http://localhost:5000';
      const studentUrl = `${baseUrl}/student?code=${classCode}`;

      // This data is immediately available for the teacher page UI
      const teacherPageData = {
        teacherId: session!.teacherId,
        sessionId: session!.sessionId,
        classCode: session!.classCode,
        studentUrl: studentUrl,
        isActive: session!.isActive,
        startTime: session!.startTime,
        studentsCount: session!.studentsCount || 0,
        totalTranslations: session!.totalTranslations || 0
      };

      expect(teacherPageData.classCode).toMatch(/^[A-Z0-9]{6}$/);
      expect(teacherPageData.studentUrl).toContain(classCode!);
      expect(teacherPageData.isActive).toBe(true);

      console.log('Complete teacher page data:', teacherPageData);
    });

    it('should demonstrate analytics capability with persistent teacherId', async () => {
      // Register teacher once
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'analytics.demo.teacher',
          password: 'password123'
        });

      // Teacher can login multiple times and create multiple sessions
      const session1LoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'analytics.demo.teacher',
          password: 'password123'
        });

      const session2LoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'analytics.demo.teacher',
          password: 'password123'
        });

      // Same teacherId across all logins
      expect(session1LoginResponse.body.user.id).toBe(session2LoginResponse.body.user.id);

      const persistentTeacherId = session1LoginResponse.body.user.id.toString();

      // Create multiple sessions (different days, different classrooms, etc.)
      await storageSessionManager.createSession('analytics-session-monday', persistentTeacherId);
      await storageSessionManager.createSession('analytics-session-tuesday', persistentTeacherId);
      await storageSessionManager.createSession('analytics-session-wednesday', persistentTeacherId);

      // All sessions have same teacherId for analytics
      const mondaySession = await storage.getSessionById('analytics-session-monday');
      const tuesdaySession = await storage.getSessionById('analytics-session-tuesday');
      const wednesdaySession = await storage.getSessionById('analytics-session-wednesday');

      expect(mondaySession!.teacherId).toBe(persistentTeacherId);
      expect(tuesdaySession!.teacherId).toBe(persistentTeacherId);
      expect(wednesdaySession!.teacherId).toBe(persistentTeacherId);

      // Each session has unique classroom code
      expect(mondaySession!.classCode).not.toBe(tuesdaySession!.classCode);
      expect(tuesdaySession!.classCode).not.toBe(wednesdaySession!.classCode);
      expect(mondaySession!.classCode).not.toBe(wednesdaySession!.classCode);

      // This enables analytics queries like:
      // - How many sessions has this teacher created?
      // - What's this teacher's average session duration?
      // - What languages does this teacher use most often?
      console.log('Analytics-ready teacher sessions:', {
        teacherId: persistentTeacherId,
        sessions: [
          { sessionId: mondaySession!.sessionId, classCode: mondaySession!.classCode },
          { sessionId: tuesdaySession!.sessionId, classCode: tuesdaySession!.classCode },
          { sessionId: wednesdaySession!.sessionId, classCode: wednesdaySession!.classCode }
        ]
      });
    });
  });

  describe('Security and Edge Cases', () => {
    it('should handle concurrent session creation gracefully', async () => {
      // Register teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'concurrent.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'concurrent.teacher',
          password: 'password123'
        });

      const teacherId = loginResponse.body.user.id.toString();

      // Simulate concurrent session creation (multiple browser tabs, network retries, etc.)
      const sessionId = 'concurrent-session';
      
      await Promise.all([
        storageSessionManager.createSession(sessionId, teacherId),
        storageSessionManager.createSession(sessionId, teacherId),
        storageSessionManager.createSession(sessionId, teacherId)
      ]);

      // Should result in only one session
      const session = await storage.getSessionById(sessionId);
      expect(session).toBeTruthy();
      expect(session!.teacherId).toBe(teacherId);
      expect(session!.classCode).toBeTruthy();
    });

    it('should handle fallback teacherId generation for backward compatibility', async () => {
      // Create session without authenticated teacherId (backward compatibility)
      const sessionId = 'fallback-teacher-session';
      await storageSessionManager.createSession(sessionId);

      const session = await storage.getSessionById(sessionId);
      expect(session!.teacherId).toBe(`teacher_${sessionId}`);
      expect(session!.classCode).toBeTruthy(); // Still generates classroom code
    });
  });
});
