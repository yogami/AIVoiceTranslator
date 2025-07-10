/**
 * Authentication Integration Tests
 * 
 * Tests the complete teacher authentication flow including:
 * - Teacher registration
 * - Teacher login  
 * - Token verification
 * - Teacher ID persistence across sessions
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApiRoutes } from '../../../server/routes';
import { setupIsolatedTest, cleanupIsolatedTest } from '../../utils/test-database-isolation';
import { DiagnosticsService } from '../../../server/services/DiagnosticsService';
import logger from '../../../server/logger';
import jwt from 'jsonwebtoken';
import { DatabaseStorage } from '../../../server/database-storage';

describe('Authentication Integration Tests', () => {
  let app: express.Application;
  let storage: DatabaseStorage;
  const testId = 'auth-integration-test';

  beforeEach(async () => {
    // Create isolated test storage
    storage = await setupIsolatedTest(testId);
    
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
    
    // Create API routes with test storage and mock services (no cleanup service needed for auth tests)
    const apiRoutes = createApiRoutes(storage, diagnosticsService, mockActiveSessionProvider);
    app.use('/api', apiRoutes);
    
    // Silence logs during tests
    vi.spyOn(logger, 'info').mockImplementation(function(this: any, ...args: any[]) { 
      return this;
    });
    vi.spyOn(logger, 'error').mockImplementation(function(this: any, ...args: any[]) { 
      return this;
    });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await cleanupIsolatedTest(testId);
  });

  describe('Teacher Registration', () => {
    it('should register a new teacher successfully', async () => {
      const teacherData = {
        username: 'john.doe',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(teacherData)
        .expect(201);

      expect(response.body).toMatchObject({
        message: 'Teacher registered successfully',
        user: {
          id: expect.any(Number),
          username: 'john.doe'
        }
      });

      // Verify teacher was created in storage
      const createdUser = await storage.getUserByUsername('john.doe');
      expect(createdUser).toBeTruthy();
      expect(createdUser!.username).toBe('john.doe');
      expect(createdUser!.id).toBe(response.body.user.id);
    });

    it('should reject registration with duplicate username', async () => {
      const teacherData = {
        username: 'john.doe',
        password: 'password123'
      };

      // Register first teacher
      await request(app)
        .post('/api/auth/register')
        .send(teacherData)
        .expect(201);

      // Try to register with same username
      const response = await request(app)
        .post('/api/auth/register')
        .send(teacherData)
        .expect(409);

      expect(response.body.error).toBe('Username already exists');
    });

    it('should reject registration with weak password', async () => {
      const teacherData = {
        username: 'john.doe',
        password: '123' // Too short
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(teacherData)
        .expect(400);

      expect(response.body.error).toBe('Password must be at least 6 characters long');
    });

    it('should reject registration with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ username: 'john.doe' }) // Missing password
        .expect(400);

      expect(response.body.error).toBe('Username and password are required');
    });
  });

  describe('Teacher Login', () => {
    beforeEach(async () => {
      // Register a test teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'john.doe',
          password: 'password123'
        });
    });

    it('should login teacher successfully', async () => {
      const loginData = {
        username: 'john.doe',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'Login successful',
        user: {
          id: expect.any(Number),
          username: 'john.doe'
        },
        token: expect.any(String)
      });

      // Verify JWT token is valid
      const decoded = jwt.decode(response.body.token) as any;
      expect(decoded.userId).toBe(response.body.user.id);
      expect(decoded.username).toBe('john.doe');
    });

    it('should reject login with wrong password', async () => {
      const loginData = {
        username: 'john.doe',
        password: 'wrongpassword'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid username or password');
    });

    it('should reject login with non-existent username', async () => {
      const loginData = {
        username: 'nonexistent',
        password: 'password123'
      };

      const response = await request(app)
        .post('/api/auth/login')
        .send(loginData)
        .expect(401);

      expect(response.body.error).toBe('Invalid username or password');
    });

    it('should reject login with missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ username: 'john.doe' }) // Missing password
        .expect(400);

      expect(response.body.error).toBe('Username and password are required');
    });
  });

  describe('Teacher ID Persistence', () => {
    it('should return consistent teacher ID across multiple logins', async () => {
      // Register teacher
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'persistent.teacher',
          password: 'password123'
        });

      const originalTeacherId = registerResponse.body.user.id;

      // Login multiple times
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

      // Teacher ID should be consistent
      expect(login1.body.user.id).toBe(originalTeacherId);
      expect(login2.body.user.id).toBe(originalTeacherId);
    });

    it('should allow teacher analytics by persistent ID', async () => {
      // Register teacher
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'analytics.teacher',
          password: 'password123'
        });

      const teacherId = registerResponse.body.user.id.toString();

      // Create multiple sessions for this teacher
      await storage.createSession({
        sessionId: 'session-1',
        teacherId: teacherId,
        classCode: 'ABC123',
        teacherLanguage: 'en-US',
        totalTranslations: 10
      });

      await storage.createSession({
        sessionId: 'session-2', 
        teacherId: teacherId,
        classCode: 'DEF456',
        teacherLanguage: 'en-US',
        totalTranslations: 15
      });

      // Verify we can query sessions by teacher ID
      // Note: This test assumes future implementation of getSessionsByTeacherId
      // For now, we'll test that the sessions exist with correct teacherId
      const session1 = await storage.getSessionById('session-1');
      const session2 = await storage.getSessionById('session-2');
      
      expect(session1).toBeTruthy();
      expect(session2).toBeTruthy();
      expect(session1!.teacherId).toBe(teacherId);
      expect(session2!.teacherId).toBe(teacherId);
    });
  });

  describe('Authentication Integration with WebSocket Flow', () => {
    it('should work with authenticated teacher ID from login', async () => {
      // Register and login teacher
      await request(app)
        .post('/api/auth/register')
        .send({
          username: 'websocket.teacher',
          password: 'password123'
        });

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'websocket.teacher',
          password: 'password123'
        });

      const authenticatedTeacherId = loginResponse.body.user.id.toString();

      // Simulate session creation with authenticated teacher ID
      await storage.createSession({
        sessionId: 'ws-test-session',
        teacherId: authenticatedTeacherId,
        classCode: 'WS1234',
        teacherLanguage: 'en-US'
      });

      // Verify session was created with correct teacher ID
      const session = await storage.getSessionById('ws-test-session');
      expect(session).toBeTruthy();
      expect(session!.teacherId).toBe(authenticatedTeacherId);
      expect(session!.classCode).toBe('WS1234');
    });
  });
});
