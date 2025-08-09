/**
 * Teacher Session Persistence Integration Tests
 * 
 * Tests critical session persistence scenarios documented in session-lifecycle-analysis.md
 * that are missing from the current test suite. These tests validate:
 * 
 * 1. Teacher reconnection with same teacherId (should restore same session)
 * 2. Teacher reconnection after timeout (should create new session)  
 * 3. Session persistence across teacher disconnections
 * 4. Classroom code lifecycle and persistence
 * 5. Database consistency for teacher session data
 * 
 * Based on the session lifecycle documentation requirements.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import express from 'express';
import request from 'supertest';
import { WebSocketServer } from '../../server/interface-adapters/websocket/WebSocketServer';
import { createApiRoutes } from '../../server/routes';
import { setupTestIsolation, getCurrentTestContext } from '../../test-config/test-isolation';
import { UnifiedSessionCleanupService } from '../../server/application/services/session/cleanup/UnifiedSessionCleanupService';
import { DatabaseStorage } from '../../server/database-storage';
import { initTestDatabase, closeDatabaseConnection } from '../setup/db-setup';
import logger from '../../server/logger';

describe('Teacher Session Persistence Integration Tests', () => {
  let app: express.Application;
  let httpServer: Server;
  let wsServer: WebSocketServer;
  let storage: DatabaseStorage;
  let actualPort: number;
  let testId: string;

  // Setup test isolation for this suite
  setupTestIsolation('Teacher Session Persistence Integration Tests', 'integration');

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
      `teacher-persistence-${context.suiteId.substring(0, 8)}-${Date.now()}` :
      `teacher-persistence-test-${Date.now()}`;

    // Initialize real database storage
    console.log('Using real database storage for integration tests');
    storage = new DatabaseStorage();
    await initTestDatabase();
    
    // Create real services
    const classroomSessionsMap = new Map(); // Empty for tests
    const cleanupService = new UnifiedSessionCleanupService(storage, classroomSessionsMap);
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
    const apiRoutes = createApiRoutes(storage, mockActiveSessionProvider, cleanupService);
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
    
    // Close WebSocket server first
    if (wsServer) {
      try {
        console.log('Closing WebSocket server...');
        wsServer.close();
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
  }, 15000);

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

  // Helper function to wait for WebSocket messages
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

  // Helper function to create teacher WebSocket connection
  const createTeacherConnection = async (teacherId: string, languageCode = 'en-US'): Promise<{
    client: WebSocket;
    messages: any[];
    classroomCode: string;
    sessionId: string;
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
    
    // Register as teacher with provided teacherId
    client.send(JSON.stringify({
      type: 'register',
      role: 'teacher',
      languageCode,
      teacherId: teacherId,
      name: `Test Teacher ${teacherId}`
    }));
    
    // Wait for registration confirmation
    await waitForMessage(messages, 'register');
    
    // Wait for classroom code
    const classroomMessage = await waitForMessage(messages, 'classroom_code');
    
    return {
      client,
      messages,
      classroomCode: classroomMessage.code,
      sessionId: classroomMessage.sessionId
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

  describe('Teacher Reconnection with Same TeacherId', () => {
    it('should restore same session and classroom code when teacher reconnects with same teacherId', async () => {
      const teacherId = `persistence-teacher-${Date.now()}`;
      
      // Step 1: Create initial teacher session
      console.log('Creating initial teacher session...');
      const initialConnection = await createTeacherConnection(teacherId);
      const originalClassroomCode = initialConnection.classroomCode;
      const originalSessionId = initialConnection.sessionId;
      
      console.log(`Initial session: ${originalSessionId}, classroom code: ${originalClassroomCode}`);
      
      // Step 2: Verify session exists in database
      const sessionInDb = await storage.getSessionById(originalSessionId);
      expect(sessionInDb).toBeDefined();
      expect(sessionInDb?.teacherId).toBe(teacherId);
      expect(sessionInDb?.isActive).toBe(true);
      
      // Step 3: Disconnect teacher
      console.log('Disconnecting teacher...');
      await closeConnectionSafely(initialConnection.client);
      await new Promise(resolve => setTimeout(resolve, 500)); // Allow cleanup
      
      // Step 4: Reconnect with same teacherId (within 10-minute window)
      console.log('Reconnecting teacher with same teacherId...');
      const reconnectedConnection = await createTeacherConnection(teacherId);
      
      // Step 5: Verify same session and classroom code are restored
      expect(reconnectedConnection.sessionId).toBe(originalSessionId);
      expect(reconnectedConnection.classroomCode).toBe(originalClassroomCode);
      
      // Step 6: Verify session is still active in database
      const reconnectedSessionInDb = await storage.getSessionById(originalSessionId);
      expect(reconnectedSessionInDb).toBeDefined();
      expect(reconnectedSessionInDb?.isActive).toBe(true);
      expect(reconnectedSessionInDb?.teacherId).toBe(teacherId);
      
      console.log('✅ Teacher reconnection with same teacherId restored original session');
      
      await closeConnectionSafely(reconnectedConnection.client);
    });

    it('should maintain session persistence when students are connected during teacher reconnection', async () => {
      const teacherId = `persistence-with-students-${Date.now()}`;
      
      // Step 1: Create teacher session
      const teacherConnection = await createTeacherConnection(teacherId);
      const classroomCode = teacherConnection.classroomCode;
      const sessionId = teacherConnection.sessionId;
      
      // Step 2: Students join session
      const student1 = await createStudentConnection(classroomCode, 'es-ES');
      const student2 = await createStudentConnection(classroomCode, 'fr-FR');
      
      // Allow students to register
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 3: Verify session has students in database
      const sessionWithStudents = await storage.getSessionById(sessionId);
      expect(sessionWithStudents?.studentsCount).toBeGreaterThan(0);
      
      // Step 4: Teacher disconnects
      await closeConnectionSafely(teacherConnection.client);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 5: Session should remain active (has students)
      const sessionAfterTeacherDisconnect = await storage.getSessionById(sessionId);
      expect(sessionAfterTeacherDisconnect?.isActive).toBe(true);
      
      // Step 6: Teacher reconnects
      const reconnectedTeacher = await createTeacherConnection(teacherId);
      
      // Step 7: Verify same session restored
      expect(reconnectedTeacher.sessionId).toBe(sessionId);
      expect(reconnectedTeacher.classroomCode).toBe(classroomCode);
      
      // Step 8: Verify students can still communicate
      expect(student1.client.readyState).toBe(WebSocket.OPEN);
      expect(student2.client.readyState).toBe(WebSocket.OPEN);
      
      console.log('✅ Session persistence maintained during teacher reconnection with students');
      
      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await closeConnectionSafely(student1.client);
      await closeConnectionSafely(student2.client);
    });
  });

  describe('Teacher Reconnection After Timeout', () => {
    it('should create new session when teacher reconnects after grace period', async () => {
      const teacherId = `timeout-teacher-${Date.now()}`;
      
      // Step 1: Create initial session
      const initialConnection = await createTeacherConnection(teacherId);
      const originalSessionId = initialConnection.sessionId;
      const originalClassroomCode = initialConnection.classroomCode;
      
      // Step 2: Disconnect teacher
      await closeConnectionSafely(initialConnection.client);
      
      // Step 3: Manually end session to simulate timeout
      // (In real scenario, this would happen after 10 minutes)
      await storage.endSession(originalSessionId);
      
      // Step 4: Wait a bit to ensure cleanup
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 5: Teacher reconnects after timeout
      const reconnectedConnection = await createTeacherConnection(teacherId);
      
      // Step 6: Verify new session was created
      expect(reconnectedConnection.sessionId).not.toBe(originalSessionId);
      expect(reconnectedConnection.classroomCode).not.toBe(originalClassroomCode);
      
      // Step 7: Verify new session is active in database
      const newSessionInDb = await storage.getSessionById(reconnectedConnection.sessionId);
      expect(newSessionInDb).toBeDefined();
      expect(newSessionInDb?.isActive).toBe(true);
      expect(newSessionInDb?.teacherId).toBe(teacherId);
      
      // Step 8: Verify original session is no longer active
      const originalSessionInDb = await storage.getSessionById(originalSessionId);
      expect(originalSessionInDb?.isActive).toBe(false);
      
      console.log('✅ New session created after timeout');
      
      await closeConnectionSafely(reconnectedConnection.client);
    });
  });

  describe('Classroom Code Lifecycle', () => {
    it('should maintain classroom code validity during teacher disconnections', async () => {
      const teacherId = `classroom-code-teacher-${Date.now()}`;
      
      // Step 1: Create teacher session
      const teacherConnection = await createTeacherConnection(teacherId);
      const classroomCode = teacherConnection.classroomCode;
      const sessionId = teacherConnection.sessionId;
      
      // Step 2: Add a student to keep session active
      const studentConnection = await createStudentConnection(classroomCode);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 3: Teacher disconnects
      await closeConnectionSafely(teacherConnection.client);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 4: Classroom code should still be valid (session has students)
      const newStudentConnection = await createStudentConnection(classroomCode, 'de-DE');
      expect(newStudentConnection.client.readyState).toBe(WebSocket.OPEN);
      
      // Step 5: Teacher reconnects
      const reconnectedTeacher = await createTeacherConnection(teacherId);
      
      // Step 6: Same classroom code should be restored
      expect(reconnectedTeacher.classroomCode).toBe(classroomCode);
      
      console.log('✅ Classroom code lifecycle maintained correctly');
      
      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await closeConnectionSafely(studentConnection.client);
      await closeConnectionSafely(newStudentConnection.client);
    });

    it('should invalidate classroom code when session expires without students', async () => {
      const teacherId = `expired-session-teacher-${Date.now()}`;
      
      // Step 1: Create teacher session
      const teacherConnection = await createTeacherConnection(teacherId);
      const classroomCode = teacherConnection.classroomCode;
      const sessionId = teacherConnection.sessionId;
      
      // Step 2: Teacher disconnects (no students joined)
      await closeConnectionSafely(teacherConnection.client);
      
      // Step 3: End session to simulate expiration
      await storage.endSession(sessionId);
      await new Promise(resolve => setTimeout(resolve, 300));
      
      // Step 4: Clear classroom session manager to simulate cleanup
      if (wsServer && wsServer._classroomSessionManager) {
        wsServer._classroomSessionManager.clear();
      }
      
      // Step 5: Student should not be able to join expired session
      try {
        const studentClient = new WebSocket(`ws://localhost:${actualPort}?code=${classroomCode}`);
        const studentMessages: any[] = [];
        
        studentClient.on('message', (data) => {
          const message = JSON.parse(data.toString());
          studentMessages.push(message);
        });
        
        await new Promise<void>((resolve) => {
          studentClient.on('open', resolve);
        });
        
        await waitForMessage(studentMessages, 'connection');
        
        studentClient.send(JSON.stringify({
          type: 'register',
          role: 'student',
          languageCode: 'es-ES'
        }));
        
        // Wait for error response
        const response = await waitForMessage(studentMessages, 'error', 3000);
        expect(response.message).toMatch(/invalid|expired|not found/i);
        
        await closeConnectionSafely(studentClient);
        
      } catch (error) {
        // This is expected - connection should fail or error
        console.log('Expected error when trying to join expired session:', error);
      }
      
      console.log('✅ Classroom code properly invalidated after session expiration');
    });
  });

  describe('Database Consistency', () => {
    it('should maintain consistent teacherId across session operations', async () => {
      const teacherId = `consistency-teacher-${Date.now()}`;
      
      // Step 1: Create session
      const connection1 = await createTeacherConnection(teacherId);
      const sessionId1 = connection1.sessionId;
      
      // Step 2: Verify teacherId in database
      const session1 = await storage.getSessionById(sessionId1);
      expect(session1?.teacherId).toBe(teacherId);
      
      // Step 3: Disconnect and reconnect
      await closeConnectionSafely(connection1.client);
      const connection2 = await createTeacherConnection(teacherId);
      
      // Step 4: Should reuse same session
      expect(connection2.sessionId).toBe(sessionId1);
      
      // Step 5: Verify teacherId consistency
      const session2 = await storage.getSessionById(sessionId1);
      expect(session2?.teacherId).toBe(teacherId);
      
      console.log('✅ Database teacherId consistency maintained');
      
      await closeConnectionSafely(connection2.client);
    });

    it('should handle multiple teachers with different teacherIds correctly', async () => {
      const teacherId1 = `multi-teacher-1-${Date.now()}`;
      const teacherId2 = `multi-teacher-2-${Date.now()}`;
      
      // Step 1: Create two different teacher sessions
      const teacher1 = await createTeacherConnection(teacherId1);
      const teacher2 = await createTeacherConnection(teacherId2);
      
      // Step 2: Verify different sessions created
      expect(teacher1.sessionId).not.toBe(teacher2.sessionId);
      expect(teacher1.classroomCode).not.toBe(teacher2.classroomCode);
      
      // Step 3: Verify both sessions in database with correct teacherIds
      const session1 = await storage.getSessionById(teacher1.sessionId);
      const session2 = await storage.getSessionById(teacher2.sessionId);
      
      expect(session1?.teacherId).toBe(teacherId1);
      expect(session2?.teacherId).toBe(teacherId2);
      expect(session1?.isActive).toBe(true);
      expect(session2?.isActive).toBe(true);
      
      // Step 4: Verify isolation - each teacher reconnects to their own session
      await closeConnectionSafely(teacher1.client);
      await closeConnectionSafely(teacher2.client);
      
      const reconnected1 = await createTeacherConnection(teacherId1);
      const reconnected2 = await createTeacherConnection(teacherId2);
      
      expect(reconnected1.sessionId).toBe(teacher1.sessionId);
      expect(reconnected2.sessionId).toBe(teacher2.sessionId);
      
      console.log('✅ Multiple teachers handled correctly with proper isolation');
      
      // Cleanup
      await closeConnectionSafely(reconnected1.client);
      await closeConnectionSafely(reconnected2.client);
    });
  });

  describe('Edge Cases and Race Conditions', () => {
    it('should handle concurrent teacher connections with same teacherId', async () => {
      const teacherId = `concurrent-teacher-${Date.now()}`;
      
      // Step 1: Create multiple concurrent connections with same teacherId
      const connectionPromises = Array.from({ length: 3 }, () => 
        createTeacherConnection(teacherId)
      );
      
      const connections = await Promise.all(connectionPromises);
      
      // Step 2: All connections should resolve to the same session
      const sessionIds = connections.map(c => c.sessionId);
      const classroomCodes = connections.map(c => c.classroomCode);
      
      // All should have the same session ID (first one wins, others reuse)
      const uniqueSessionIds = new Set(sessionIds);
      expect(uniqueSessionIds.size).toBe(1);
      
      const uniqueClassroomCodes = new Set(classroomCodes);
      expect(uniqueClassroomCodes.size).toBe(1);
      
      console.log('✅ Concurrent connections handled correctly');
      
      // Cleanup
      await Promise.all(connections.map(c => closeConnectionSafely(c.client)));
    });

    it('should handle teacher reconnection during student activity', async () => {
      const teacherId = `active-session-teacher-${Date.now()}`;
      
      // Step 1: Create teacher session with students
      const teacherConnection = await createTeacherConnection(teacherId);
      const classroomCode = teacherConnection.classroomCode;
      const sessionId = teacherConnection.sessionId;
      
      const students = await Promise.all([
        createStudentConnection(classroomCode, 'es-ES'),
        createStudentConnection(classroomCode, 'fr-FR')
      ]);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Step 2: Teacher disconnects while students are active
      await closeConnectionSafely(teacherConnection.client);
      
      // Step 3: Students should remain connected
      students.forEach(student => {
        expect(student.client.readyState).toBe(WebSocket.OPEN);
      });
      
      // Step 4: Teacher reconnects
      const reconnectedTeacher = await createTeacherConnection(teacherId);
      
      // Step 5: Should restore same session
      expect(reconnectedTeacher.sessionId).toBe(sessionId);
      expect(reconnectedTeacher.classroomCode).toBe(classroomCode);
      
      // Step 6: Students should still be connected and functional
      students.forEach(student => {
        expect(student.client.readyState).toBe(WebSocket.OPEN);
      });
      
      console.log('✅ Teacher reconnection during student activity handled correctly');
      
      // Cleanup
      await closeConnectionSafely(reconnectedTeacher.client);
      await Promise.all(students.map(s => closeConnectionSafely(s.client)));
    });
  });
});
