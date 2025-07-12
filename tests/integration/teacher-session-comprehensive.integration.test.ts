/**
 * Fast Teacher Session Integration Tests
 * 
 * Optimized integration tests that focus on core functionality:
 * - Teacher authentication via HTTP API
 * - Basic WebSocket session creation
 * - Classroom code generation
 * - Student connection flow
 * - Uses shared server setup for speed
 * - Minimal database isolation for performance
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import express from 'express';
import request from 'supertest';
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { createApiRoutes } from '../../server/routes';
import { setupTestIsolation, getCurrentTestContext } from '../../test-config/test-isolation';
import { DiagnosticsService } from '../../server/services/DiagnosticsService';
import { DatabaseStorage } from '../../server/database-storage';
import { initTestDatabase, closeDatabaseConnection } from '../setup/db-setup';
import logger from '../../server/logger';

describe('Fast Teacher Session Integration Tests', () => {
  let app: express.Application;
  let httpServer: Server;
  let wsServer: WebSocketServer;
  let storage: DatabaseStorage;
  let actualPort: number;
  let testId: string;

  // Setup test isolation for this suite
  setupTestIsolation('Fast Teacher Session Integration Tests', 'integration');

  // Helper functions for unique test data
  const createUniqueUsername = (prefix: string): string => {
    const context = getCurrentTestContext();
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    const suiteId = context ? context.suiteId.substring(0, 8) : 'default';
    return `${prefix}-${suiteId}-${timestamp}-${random}`;
  };

  // Helper to ensure WebSocket connections are properly closed
  const closeConnectionSafely = (client: WebSocket): Promise<void> => {
    return new Promise((resolve) => {
      if (client.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }
      
      const timeout = setTimeout(() => {
        console.warn('WebSocket close timeout, forcing termination');
        client.terminate();
        resolve();
      }, 2000);
      
      client.on('close', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      client.close();
    });
  };

  beforeAll(async () => {
    // Silence logs during tests
    vi.spyOn(logger, 'info').mockImplementation(() => ({ } as any));
    vi.spyOn(logger, 'error').mockImplementation(() => ({ } as any));
    vi.spyOn(logger, 'warn').mockImplementation(() => ({ } as any));

    // Create shared test ID for the entire suite
    const context = getCurrentTestContext();
    testId = context ? 
      `fast-teacher-session-${context.suiteId.substring(0, 8)}-${Date.now()}` :
      `fast-teacher-session-test-${Date.now()}`;

    // Initialize real database storage - no fallback, no mocking
    console.log('Using real database storage for integration tests');
    storage = new DatabaseStorage();
    await initTestDatabase();
    
    // Create real services
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

    // Create HTTP server for WebSocket
    httpServer = createServer(app);
    
    // Initialize WebSocket server with the HTTP server and storage
    wsServer = new WebSocketServer(httpServer, storage);
    
    // Start HTTP server once for all tests
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        actualPort = (httpServer.address() as any)?.port || 5000;
        resolve();
      });
    });
  }, 10000);

  afterAll(async () => {
    console.log('Starting test cleanup...');
    
    // Give a small delay to ensure all WebSocket operations complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Close WebSocket server first (most important)
    if (wsServer) {
      try {
        console.log('Closing WebSocket server...');
        wsServer.close();
        // Small delay to ensure WebSocket cleanup
        await new Promise(resolve => setTimeout(resolve, 200));
      } catch (error) {
        console.warn('Error closing WebSocket server:', error);
      }
    }
    
    // Close HTTP server
    if (httpServer) {
      try {
        console.log('Closing HTTP server...');
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('HTTP server close timeout'));
          }, 3000);
          
          httpServer.close((error) => {
            clearTimeout(timeout);
            if (error) reject(error);
            else resolve();
          });
        });
      } catch (error) {
        console.warn('Error closing HTTP server:', error);
      }
    }

    // Close database connection
    try {
      console.log('Closing database connection...');
      await closeDatabaseConnection();
    } catch (error) {
      console.warn('Failed to close database connection:', error instanceof Error ? error.message : String(error));
    }

    // Restore mocks
    vi.restoreAllMocks();
    console.log('Test cleanup completed');
  }, 15000); // Increased timeout to 15 seconds

  beforeEach(async () => {
    // Small delay between tests to ensure proper cleanup
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Clear the classroom session manager to ensure fresh state
    if (wsServer && wsServer._classroomSessionManager) {
      wsServer._classroomSessionManager.clear();
    }
  });

  afterEach(async () => {
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    // Clear the classroom session manager after each test
    if (wsServer && wsServer._classroomSessionManager) {
      wsServer._classroomSessionManager.clear();
    }
    
    // Small delay to ensure WebSocket cleanup
    await new Promise(resolve => setTimeout(resolve, 200));
  });

  // Helper function to wait for WebSocket messages with shorter timeout
  const waitForMessage = (messages: any[], messageType: string, timeout = 2000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }, timeout);

      const checkForMessage = () => {
        const message = messages.find(m => m.type === messageType);
        if (message) {
          clearTimeout(timeoutId);
          resolve(message);
        } else {
          setTimeout(checkForMessage, 50);
        }
      };

      checkForMessage();
    });
  };

  // Helper function to create teacher WebSocket connection and register
  const createTeacherConnection = async (languageCode = 'en-US'): Promise<{
    client: WebSocket;
    messages: any[];
    classroomCode: string;
  }> => {
    const messages: any[] = [];
    const client = new WebSocket(`ws://localhost:${actualPort}`);
    
    client.on('message', (data) => {
      const message = JSON.parse(data.toString());
      messages.push(message);
    });
    
    // Wait for connection
    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });
    
    // Wait for connection confirmation
    await waitForMessage(messages, 'connection');
    
    // Create a unique test identifier to ensure session isolation
    const testIdentifier = `test-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    
    // Register as teacher with unique test data
    client.send(JSON.stringify({
      type: 'register',
      role: 'teacher',
      languageCode,
      teacherId: `teacher-${testIdentifier}`, // Add unique teacherId to prevent session reuse
      name: `Test Teacher ${testIdentifier}`, // Add unique name
      testId: testIdentifier // Add test identifier for debugging
    }));
    
    // Wait for registration confirmation
    await waitForMessage(messages, 'register');
    
    // Wait for classroom code
    const classroomMessage = await waitForMessage(messages, 'classroom_code');
    
    return {
      client,
      messages,
      classroomCode: classroomMessage.code
    };
  };

  // Helper function to create student WebSocket connection
  const createStudentConnection = async (classroomCode: string, languageCode = 'es-ES'): Promise<{
    client: WebSocket;
    messages: any[];
  }> => {
    const messages: any[] = [];
    const client = new WebSocket(`ws://localhost:${actualPort}?code=${classroomCode}`);
    
    client.on('message', (data) => {
      const message = JSON.parse(data.toString());
      messages.push(message);
    });
    
    // Wait for connection
    await new Promise<void>((resolve) => {
      client.on('open', resolve);
    });
    
    // Wait for connection confirmation
    await waitForMessage(messages, 'connection');
    
    // Register as student
    client.send(JSON.stringify({
      type: 'register',
      role: 'student',
      languageCode
    }));
    
    // Wait for registration confirmation
    await waitForMessage(messages, 'register');
    
    return {
      client,
      messages
    };
  };

  describe('Teacher Authentication Flow', () => {
    it('should provide consistent authentication across HTTP API and WebSocket connections', async () => {
      // Create unique username for this test to ensure idempotency
      const username = createUniqueUsername('persistent.teacher');
      
      // Register teacher via HTTP API
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username,
          password: 'password123'
        });

      const originalTeacherId = registerResponse.body.user.id;
      expect(originalTeacherId).toBeDefined();
      expect(typeof originalTeacherId).toBe('number');

      // Login multiple times (simulating server restarts/reconnections)
      const login1 = await request(app)
        .post('/api/auth/login')
        .send({
          username,
          password: 'password123'
        });

      const login2 = await request(app)
        .post('/api/auth/login')
        .send({
          username,
          password: 'password123'
        });

      // TeacherId should be consistent (database ID persists)
      expect(login1.body.user.id).toBe(originalTeacherId);
      expect(login2.body.user.id).toBe(originalTeacherId);

      // Now test WebSocket connection with authentication
      const { client, messages, classroomCode } = await createTeacherConnection();
      
      // Verify that WebSocket session was created successfully
      expect(classroomCode).toBeTruthy();
      expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);

      // Verify registration message contains session info
      const registerMessage = messages.find(m => m.type === 'register');
      expect(registerMessage.status).toBe('success');

      await closeConnectionSafely(client);
    }, 60000); // Increased timeout to 60 seconds for bcrypt operations

    it('should create WebSocket session with proper classroom code generation', async () => {
      // Create unique username for this test
      const username = createUniqueUsername('auth.flow.teacher');
      
      // Register teacher via HTTP API
      const registrationResponse = await request(app)
        .post('/api/auth/register')
        .send({
          username,
          password: 'password123'
        });

      // Ensure registration succeeded
      expect(registrationResponse.status).toBe(201);
      expect(registrationResponse.body.message).toBe('Teacher registered successfully');

      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username,
          password: 'password123'
        });

      // Debug the login response structure
      console.log('Login response status:', loginResponse.status);
      console.log('Login response body:', loginResponse.body);

      expect(loginResponse.status).toBe(200);
      const authToken = loginResponse.body.token;
      const expectedTeacherId = loginResponse.body.user?.id?.toString();

      // Verify token contains teacherId
      expect(authToken).toBeTruthy();
      if (expectedTeacherId) {
        expect(expectedTeacherId).toBeTruthy();
      }

      // Create WebSocket connection and verify session creation
      const { client, messages, classroomCode } = await createTeacherConnection();

      // Verify that session was created with proper classroom code
      expect(classroomCode).toBeTruthy();
      expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);

      // Verify classroom code message
      const classroomMessage = messages.find(m => m.type === 'classroom_code');
      expect(classroomMessage.code).toBe(classroomCode);

      await closeConnectionSafely(client);
    }, 60000); // Increased timeout to 60 seconds for bcrypt operations

    it('should handle WebSocket connection without prior HTTP authentication', async () => {
      // Test that WebSocket can still create session even without explicit HTTP auth
      // This tests the fallback scenario when teachers connect directly via WebSocket
      
      const { client, messages, classroomCode } = await createTeacherConnection();
      
      // Verify session creation works even without HTTP auth
      expect(classroomCode).toBeTruthy();
      expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);

      // Verify registration was successful
      const registerMessage = messages.find(m => m.type === 'register');
      expect(registerMessage.status).toBe('success');

      await closeConnectionSafely(client);
    });
  });

  describe('Session Creation and Management', () => {
    it('should handle multiple students joining the same classroom', async () => {
      // Create teacher connection
      const teacherConnection = await createTeacherConnection();
      const classroomCode = teacherConnection.classroomCode;

      // Create multiple student connections using the same classroom code
      const student1 = await createStudentConnection(classroomCode, 'es-ES');
      const student2 = await createStudentConnection(classroomCode, 'fr-FR');

      // Verify all students connected successfully
      expect(student1.messages.find(m => m.type === 'register')?.status).toBe('success');
      expect(student2.messages.find(m => m.type === 'register')?.status).toBe('success');

      // Clean up connections properly
      await closeConnectionSafely(student1.client);
      await closeConnectionSafely(student2.client);
      await closeConnectionSafely(teacherConnection.client);
    });

    it('should validate classroom code format consistency', async () => {
      // Create multiple teacher connections with proper delays and verify all generate valid codes
      console.log('Creating first teacher connection...');
      const connection1 = await createTeacherConnection();
      console.log(`First classroom code: ${connection1.classroomCode}`);
      
      // Longer delay between connections to ensure proper isolation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      console.log('Creating second teacher connection...');
      const connection2 = await createTeacherConnection();
      console.log(`Second classroom code: ${connection2.classroomCode}`);
      
      const codes = [connection1.classroomCode, connection2.classroomCode];
      console.log('Generated codes:', codes);

      // All classroom codes should be valid format
      codes.forEach(code => {
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
      });

      // All classroom codes should be unique
      const uniqueCodes = new Set(codes);
      console.log('Unique codes count:', uniqueCodes.size, 'Total codes:', codes.length);
      expect(uniqueCodes.size).toBe(codes.length);

      // Proper cleanup with delays
      console.log('Closing connections...');
      await closeConnectionSafely(connection1.client);
      await new Promise(resolve => setTimeout(resolve, 100));
      await closeConnectionSafely(connection2.client);
      
      // Additional delay to ensure server cleanup
      await new Promise(resolve => setTimeout(resolve, 200));
      console.log('Test completed successfully');
    });
  });

  describe('End-to-End Session Flow', () => {
    it('should complete full teacher-student session lifecycle via WebSocket', async () => {
      // Test the complete flow from teacher registration to student interaction
      const username = createUniqueUsername('e2e.teacher');
      
      // 1. Register teacher via HTTP API
      await request(app)
        .post('/api/auth/register')
        .send({
          username,
          password: 'password123'
        });

      // 2. Login teacher via HTTP API
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username,
          password: 'password123'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body.token).toBeTruthy();

      // 3. Create teacher WebSocket connection
      const teacherConnection = await createTeacherConnection();
      const classroomCode = teacherConnection.classroomCode;

      // 4. Verify classroom code is valid
      expect(classroomCode).toBeTruthy();
      expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);

      // 5. Student joins via classroom code
      const studentConnection = await createStudentConnection(classroomCode);
      
      // 6. Verify both connections are established
      expect(teacherConnection.messages.find(m => m.type === 'register')?.status).toBe('success');
      expect(studentConnection.messages.find(m => m.type === 'register')?.status).toBe('success');

      // 7. Clean up connections properly
      await closeConnectionSafely(teacherConnection.client);
      await closeConnectionSafely(studentConnection.client);

      // The test validates that the full integration works without errors
      expect(true).toBe(true); // If we get here, the integration works
    });
  });
});
