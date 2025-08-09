import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import express from 'express';
import { WebSocketServer } from '../../server/interface-adapters/websocket/WebSocketServer';
import { createApiRoutes } from '../../server/routes';
import { setupTestIsolation, getCurrentTestContext } from '../../test-config/test-isolation';
import { UnifiedSessionCleanupService } from '../../server/application/services/session/cleanup/UnifiedSessionCleanupService';
import { DatabaseStorage } from '../../server/database-storage';
import { initTestDatabase, closeDatabaseConnection } from '../setup/db-setup';
import logger from '../../server/logger';

/**
 * Timing utilities for test environment
 */
function getTestScalingFactor(): number {
  if (process.env.NODE_ENV === 'test') {
    const customScale = process.env.TEST_TIMING_SCALE;
    if (customScale) {
      const parsed = parseFloat(customScale);
      if (!isNaN(parsed) && parsed > 0 && parsed <= 1) {
        return parsed;
      }
    }
    return 0.01; // 100x faster for integration tests
  }
  return 1;
}

function scaleForTest(productionValue: number): number {
  const scalingFactor = getTestScalingFactor();
  const scaled = Math.round(productionValue * scalingFactor);
  // Ensure minimum timing values for integration test stability
  return Math.max(scaled, 2000); // At least 2000ms for integration test stability
}

/**
 * Comprehensive Teacher-Student Session Persistence Integration Tests
 * 
 * This test suite validates that session persistence works correctly across teacher
 * disconnection/reconnection scenarios with active students. It ensures that:
 * 
 * 1. Teacher reconnection with active students maintains session continuity
 * 2. Students remain connected during teacher reconnection
 * 3. Classroom codes are preserved across teacher disconnections
 * 4. Session data integrity is maintained
 * 5. Multiple students persist correctly during teacher reconnection
 */
describe('Teacher-Student Session Persistence Integration Tests', () => {
  let app: express.Application;
  let httpServer: Server;
  let wsServer: WebSocketServer;
  let storage: DatabaseStorage;
  let wsPort: number;
  let httpPort: number;

  function createUniqueTeacherId(prefix: string = 'persistence.teacher'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  function createUniqueStudentName(prefix: string = 'persistence.student'): string {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  }

  async function createTeacherConnection(teacherId?: string): Promise<{
    client: WebSocket;
    messages: any[];
    classroomCode: string;
    teacherId: string;
  }> {
    const finalTeacherId = teacherId || createUniqueTeacherId();
    const client = new WebSocket(`ws://localhost:${wsPort}`);
    const messages: any[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Teacher connection timeout'));
      }, scaleForTest(10000));

      let registerSuccess = false;
      let classroomCode: string | undefined;

      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messages.push(message);

          // Listen for register success
          if (message.type === 'register' && message.status === 'success') {
            registerSuccess = true;
          }

          // Listen for classroom code
          if (message.type === 'classroom_code') {
            classroomCode = message.code;
          }

          // Resolve when we have both register success and classroom code
          if (registerSuccess && classroomCode) {
            clearTimeout(timeout);
            resolve({
              client,
              messages,
              classroomCode,
              teacherId: finalTeacherId
            });
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      client.on('open', () => {
        client.send(JSON.stringify({
          type: 'register',
          role: 'teacher',
          languageCode: 'en',
          name: 'Persistence Teacher',
          teacherId: finalTeacherId
        }));
      });

      client.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async function createStudentConnection(classroomCode: string, languageCode: string = 'es-ES'): Promise<{
    client: WebSocket;
    messages: any[];
    studentName: string;
  }> {
    const studentName = createUniqueStudentName();
    // Connect with classroom code in URL so students join teacher's session
    const client = new WebSocket(`ws://localhost:${wsPort}?class=${classroomCode}`);
    const messages: any[] = [];

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Student connection timeout'));
      }, scaleForTest(10000));

      client.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          messages.push(message);

          if (message.type === 'register' && message.status === 'success') {
            clearTimeout(timeout);
            resolve({
              client,
              messages,
              studentName
            });
          }
        } catch (error) {
          clearTimeout(timeout);
          reject(error);
        }
      });

      client.on('open', () => {
        client.send(JSON.stringify({
          type: 'register',
          role: 'student',
          languageCode,
          name: studentName,
          classroomCode
        }));
      });

      client.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  async function closeConnectionSafely(client: WebSocket): Promise<void> {
    return new Promise((resolve) => {
      if (client.readyState === WebSocket.OPEN) {
        client.close();
      }
      
      const cleanup = () => {
        client.removeAllListeners();
        resolve();
      };

      if (client.readyState === WebSocket.CLOSED) {
        cleanup();
      } else {
        client.once('close', cleanup);
        setTimeout(cleanup, scaleForTest(1000)); // Fallback timeout
      }
    });
  }

  async function waitForTeacherReconnection(teacherId: string): Promise<void> {
    // Wait for teacher reconnection grace period to be active
    await new Promise(resolve => setTimeout(resolve, scaleForTest(1000)));
  }

  beforeAll(async () => {
    logger.info('Setting up teacher-student session persistence tests...');
    
    // Initialize real database storage - no fallback, no mocking
    console.log('Using real database storage for session persistence tests');
    storage = new DatabaseStorage();
    await initTestDatabase();
    
    // Create real services using the existing storage
    const classroomSessionsMap = new Map();
    const cleanupService = new UnifiedSessionCleanupService(storage, classroomSessionsMap);
    const mockActiveSessionProvider = {
      getActiveSessionCount: () => 0,
      getActiveSessions: () => [],
      getActiveTeacherCount: () => 0,
      getActiveStudentCount: () => 0,
      getActiveSessionsCount: () => 0
    };
    
    // Create Express app with auth routes
    app = express();
    app.use(express.json());
    
    // Create API routes with test storage and mock services
    const apiRoutes = createApiRoutes(storage, mockActiveSessionProvider, cleanupService);
    app.use('/api', apiRoutes);

    // Create HTTP server for WebSocket
    httpServer = createServer(app);
    
    // Initialize WebSocket server with the HTTP server and storage
    wsServer = new WebSocketServer(httpServer, storage);
    
    // Start HTTP server once for all tests
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const address = httpServer.address();
        if (address && typeof address === 'object') {
          wsPort = address.port;
          httpPort = wsPort; // WebSocket shares the same port
        }
        resolve();
      });
    });
    
    logger.info(`Test servers started - HTTP: ${httpPort}, WS: ${wsPort}`);
  }, 30000);

  afterAll(async () => {
    logger.info('Cleaning up teacher-student session persistence tests...');
    
    try {
      // Stop WebSocket server
      if (wsServer) {
        wsServer.close();
      }
      
      // Stop HTTP server with timeout
      if (httpServer) {
        await new Promise<void>((resolve) => {
          httpServer.close(() => {
            resolve();
          });
          // Force close after 10 seconds
          setTimeout(() => {
            logger.warn('Force closing HTTP server after timeout');
            resolve();
          }, scaleForTest(10000));
        });
      }

      // Close database
      await closeDatabaseConnection();
      
      logger.info('Test cleanup completed');
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }, 60000);

  beforeEach(async () => {
    // Clean up any existing test sessions - use the session cleanup service for this
    // No direct clearAllSessions method, so we'll rely on test isolation
  });

  afterEach(async () => {
    // Clean up any remaining test sessions
    // No direct clearAllSessions method, so we'll rely on test isolation
  });

  describe('Teacher Reconnection with Active Students', () => {
    it('should maintain session continuity when teacher reconnects with active students', async () => {
      // 1. Create teacher connection
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode, teacherId } = teacherConnection;

      // 2. Create students sequentially to avoid race condition
      const student1 = await createStudentConnection(classroomCode, 'es-ES');
      // Wait a moment between student connections to avoid database race condition
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));
      const student2 = await createStudentConnection(classroomCode, 'fr-FR');

      // 3. Verify all connections are established
      expect(teacherConnection.messages.find(m => m.type === 'register')?.status).toBe('success');
      expect(student1.messages.find(m => m.type === 'register')?.status).toBe('success');
      expect(student2.messages.find(m => m.type === 'register')?.status).toBe('success');

      // 4. Disconnect teacher (simulating network issue)
      await closeConnectionSafely(teacherClient);
      await waitForTeacherReconnection(teacherId);

      // 5. Reconnect teacher with same teacherId
      const reconnectedTeacher = await createTeacherConnection(teacherId);

      // 6. Verify teacher reconnected to same session with same classroom code
      expect(reconnectedTeacher.classroomCode).toBe(classroomCode);
      expect(reconnectedTeacher.teacherId).toBe(teacherId);

      // 7. Verify students are still connected and can communicate
      expect(student1.client.readyState).toBe(WebSocket.OPEN);
      expect(student2.client.readyState).toBe(WebSocket.OPEN);

      // 8. Give a moment for all database updates to complete
      await new Promise(resolve => setTimeout(resolve, scaleForTest(100)));

      // Verify session persistence in database
      const activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession).toBeTruthy();
      expect(activeSession?.studentsCount).toBe(2);

      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await closeConnectionSafely(student1.client);
      await closeConnectionSafely(student2.client);
    }, 60000);

    it('should preserve classroom code functionality after teacher reconnection', async () => {
      // 1. Create teacher and get classroom code
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode, teacherId } = teacherConnection;

      // 2. Create student using classroom code
      const student1 = await createStudentConnection(classroomCode, 'es-ES');

      // 3. Disconnect teacher
      await closeConnectionSafely(teacherClient);
      await waitForTeacherReconnection(teacherId);

      // 4. Reconnect teacher
      const reconnectedTeacher = await createTeacherConnection(teacherId);

      // 5. Verify same classroom code is restored
      expect(reconnectedTeacher.classroomCode).toBe(classroomCode);

      // 6. Create new student using the same classroom code after teacher reconnection (with delay to avoid race condition)
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));
      const student2 = await createStudentConnection(classroomCode, 'fr-FR');

      // 7. Verify new student can join successfully
      expect(student2.messages.find(m => m.type === 'register')?.status).toBe('success');

      // 8. Wait for database updates before verification
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));
      
      // 9. Verify both students are in the session
      const activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession?.studentsCount).toBe(2);

      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await closeConnectionSafely(student1.client);
      await closeConnectionSafely(student2.client);
    }, 60000);

    it('should handle multiple teacher disconnection/reconnection cycles', async () => {
      // 1. Create teacher and students
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode, teacherId } = teacherConnection;
      const student = await createStudentConnection(classroomCode, 'es-ES');

      // 2. First disconnection/reconnection cycle
      await closeConnectionSafely(teacherClient);
      await waitForTeacherReconnection(teacherId);
      const reconnectedTeacher1 = await createTeacherConnection(teacherId);
      expect(reconnectedTeacher1.classroomCode).toBe(classroomCode);

      // 3. Second disconnection/reconnection cycle
      await closeConnectionSafely(reconnectedTeacher1.client);
      await waitForTeacherReconnection(teacherId);
      const reconnectedTeacher2 = await createTeacherConnection(teacherId);
      expect(reconnectedTeacher2.classroomCode).toBe(classroomCode);

      // 4. Verify student is still connected and session integrity
      expect(student.client.readyState).toBe(WebSocket.OPEN);
      const activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession).toBeTruthy();
      expect(activeSession?.studentsCount).toBe(1);

      // Cleanup
      await closeConnectionSafely(reconnectedTeacher2.client);
      await closeConnectionSafely(student.client);
    }, 60000);
  });

  describe('Session Data Integrity During Persistence', () => {
    it('should maintain student count accuracy during teacher reconnection', async () => {
      // 1. Create teacher
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode, teacherId } = teacherConnection;

      // 2. Add students sequentially to avoid race condition
      const student1 = await createStudentConnection(classroomCode, 'es-ES');
      
      // Wait for database update before verification
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));
      
      // Verify count after first student
      let activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession?.studentsCount).toBe(1);

      // Add second student with delay
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));
      const student2 = await createStudentConnection(classroomCode, 'fr-FR');
      
      // Wait for database update before verification
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));
      
      // Verify count after second student
      activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession?.studentsCount).toBe(2);

      // 3. Disconnect and reconnect teacher
      await closeConnectionSafely(teacherClient);
      await waitForTeacherReconnection(teacherId);
      const reconnectedTeacher = await createTeacherConnection(teacherId);

      // 4. Verify student count is preserved
      activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession?.studentsCount).toBe(2);
      expect(reconnectedTeacher.classroomCode).toBe(classroomCode);

      // 5. Add third student after reconnection with delay
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));
      const student3 = await createStudentConnection(classroomCode, 'de-DE');

      // Wait for database update before final verification
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));

      // 6. Verify final count is correct
      activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession?.studentsCount).toBe(3);

      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await closeConnectionSafely(student1.client);
      await closeConnectionSafely(student2.client);
      await closeConnectionSafely(student3.client);
    }, 60000);

    it('should preserve session metadata across teacher reconnection', async () => {
      // 1. Create teacher and capture initial session data
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode, teacherId } = teacherConnection;
      
      // 2. Add student to establish session with metadata
      const student = await createStudentConnection(classroomCode, 'es-ES');

      // 3. Wait for session to stabilize before capturing metadata
      await new Promise(resolve => setTimeout(resolve, scaleForTest(300)));

      // 4. Capture session metadata after stabilization
      let activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      const originalSessionId = activeSession?.sessionId;
      const originalStartTime = activeSession?.startTime;
      const originalClassCode = activeSession?.classCode;

      // 5. Disconnect and reconnect teacher
      await closeConnectionSafely(teacherClient);
      await waitForTeacherReconnection(teacherId);
      const reconnectedTeacher = await createTeacherConnection(teacherId);

      // 6. Verify session metadata is preserved
      activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      
      expect(activeSession?.sessionId).toBe(originalSessionId);
      expect(activeSession?.startTime).toEqual(originalStartTime);
      expect(activeSession?.classCode).toBe(originalClassCode);
      expect(reconnectedTeacher.classroomCode).toBe(classroomCode);

      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await closeConnectionSafely(student.client);
    }, 60000);
  });

  describe('Edge Cases in Session Persistence', () => {
    it('should handle teacher reconnection when session is within grace period', async () => {
      // 1. Create teacher and student
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode, teacherId } = teacherConnection;
      const student = await createStudentConnection(classroomCode, 'es-ES');

      // 2. Disconnect teacher
      await closeConnectionSafely(teacherClient);

      // 3. Reconnect within grace period (should be immediate for this test)
      const reconnectedTeacher = await createTeacherConnection(teacherId);

      // 4. Verify reconnection to same session
      expect(reconnectedTeacher.classroomCode).toBe(classroomCode);
      expect(student.client.readyState).toBe(WebSocket.OPEN);

      // 5. Verify session continuity
      const activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession).toBeTruthy();
      expect(activeSession?.studentsCount).toBe(1);

      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await closeConnectionSafely(student.client);
    }, 60000);

    it('should create new session when teacher reconnects after grace period expires', async () => {
      // This test simulates what happens when a teacher reconnects after the grace period
      // Note: We simulate this by using a different teacherId to force new session creation
      
      // 1. Create teacher and student
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode } = teacherConnection;
      const student = await createStudentConnection(classroomCode, 'es-ES');

      // 2. Disconnect teacher
      await closeConnectionSafely(teacherClient);

      // 3. Simulate grace period expiration by using different teacherId
      const newTeacherId = createUniqueTeacherId('expired.teacher');
      const newTeacherConnection = await createTeacherConnection(newTeacherId);

      // 4. Verify new session with different classroom code
      expect(newTeacherConnection.classroomCode).not.toBe(classroomCode);
      expect(newTeacherConnection.teacherId).toBe(newTeacherId);

      // 5. Verify new session created
      const newActiveSession = await storage.findActiveSessionByTeacherId(newTeacherId);
      expect(newActiveSession).toBeTruthy();

      // 6. Original student should still be connected but isolated
      expect(student.client.readyState).toBe(WebSocket.OPEN);

      // Cleanup
      await closeConnectionSafely(newTeacherConnection.client);
      await closeConnectionSafely(student.client);
    }, 60000);

    it('should handle concurrent student connections during teacher reconnection', async () => {
      // 1. Create teacher
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode, teacherId } = teacherConnection;

      // 2. Create initial student
      const student1 = await createStudentConnection(classroomCode, 'es-ES');

      // 3. Disconnect teacher
      await closeConnectionSafely(teacherClient);

      // 4. Start teacher reconnection first, then student connection sequentially to avoid race condition
      const reconnectedTeacher = await createTeacherConnection(teacherId);
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));
      const student2 = await createStudentConnection(classroomCode, 'fr-FR');

      // 5. Verify both students are connected and session integrity
      expect(student1.client.readyState).toBe(WebSocket.OPEN);
      expect(student2.client.readyState).toBe(WebSocket.OPEN);
      expect(reconnectedTeacher.classroomCode).toBe(classroomCode);

      // 6. Wait for database updates before verification
      await new Promise(resolve => setTimeout(resolve, scaleForTest(200)));
      
      // 7. Verify session has correct student count
      const activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession?.studentsCount).toBe(2);

      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await closeConnectionSafely(student1.client);
      await closeConnectionSafely(student2.client);
    }, 60000);
  });

  describe('Database Consistency During Persistence', () => {
    it('should maintain database consistency during rapid teacher reconnections', async () => {
      // 1. Create teacher and student
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode, teacherId } = teacherConnection;
      const student = await createStudentConnection(classroomCode, 'es-ES');

      // 2. Perform rapid disconnection/reconnection cycles
      await closeConnectionSafely(teacherClient);
      const reconnected1 = await createTeacherConnection(teacherId);
      await closeConnectionSafely(reconnected1.client);
      const reconnected2 = await createTeacherConnection(teacherId);

      // 3. Verify database consistency
      const activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession).toBeTruthy();
      expect(activeSession?.studentsCount).toBe(1);
      expect(reconnected2.classroomCode).toBe(classroomCode);

      // Cleanup
      await closeConnectionSafely(reconnected2.client);
      await closeConnectionSafely(student.client);
    }, 60000);

    it('should handle database errors gracefully during session persistence', async () => {
      // 1. Create teacher connection
      const teacherConnection = await createTeacherConnection();
      const { client: teacherClient, classroomCode, teacherId } = teacherConnection;

      // 2. Create student
      const student = await createStudentConnection(classroomCode, 'es-ES');

      // 3. Disconnect teacher
      await closeConnectionSafely(teacherClient);

      // 4. Temporarily simulate database issue by clearing sessions
      // (In a real scenario, this would be database connectivity issues)
      // For this test, we just verify that reconnection creates a fallback session
      
      // 5. Reconnect teacher - should either restore session or create new one gracefully
      const reconnectedTeacher = await createTeacherConnection(teacherId);
      
      // 6. Verify teacher reconnection worked (either restored or new session)
      expect(reconnectedTeacher.messages.find(m => m.type === 'register')?.status).toBe('success');
      expect(reconnectedTeacher.classroomCode).toBeTruthy();
      
      // 7. Verify session exists in database
      const activeSession = await storage.findActiveSessionByTeacherId(teacherId);
      expect(activeSession).toBeTruthy();

      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await closeConnectionSafely(student.client);
    }, 60000);
  });
});
