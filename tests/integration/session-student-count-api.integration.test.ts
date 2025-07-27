import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { TestWebSocketServer } from '../utils/TestWebSocketServer';
import { Server as HTTPServer, createServer } from 'http';
import WebSocket from 'ws';
import { IStorage } from '../../server/storage.interface';
import { setupIsolatedTest, cleanupIsolatedTest } from '../utils/test-database-isolation';
import { ConnectionManager } from '../../server/services/websocket/ConnectionManager';

describe('Session Student Count API Integration Tests', () => {
  let httpServer: HTTPServer;
  let wsServer: TestWebSocketServer;
  let storage: IStorage;
  let connectionManager: ConnectionManager;
  let serverPort: number;
  let clients: any[] = [];

  beforeEach(async () => {
    // Create isolated storage
    storage = await setupIsolatedTest('session-student-count-test');
    
    // Create HTTP server
    httpServer = createServer();
    
    // Start server on random port
    await new Promise<void>((resolve, reject) => {
      const port = 40000 + Math.floor(Math.random() * 5000);
      httpServer.listen(port, () => {
        serverPort = port;
        console.log(`Test server started on port ${serverPort}`);
        resolve();
      });
      httpServer.on('error', reject);
    });

    // Create WebSocket server
    wsServer = new TestWebSocketServer(httpServer, storage);
    
    // Get reference to the connection manager for direct API testing
    connectionManager = (wsServer as any).connectionManager;
  });

  afterEach(async () => {
    // Close all WebSocket clients
    clients.forEach(client => {
      if (client && client.close) {
        client.close();
      }
    });
    clients = [];

    // Close WebSocket server
    if (wsServer) {
      wsServer.close();
    }

    // Close HTTP server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }

    // Cleanup isolated storage
    await cleanupIsolatedTest('session-student-count-test');
  });

  // Helper function to wait for specific message types
  const waitForMessage = (client: any, type: string, timeout = 5000): Promise<any> => {
    return new Promise((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        clearInterval(interval);
        console.error(`[INTEGRATION] waitForMessage: Timeout for type: ${type}`);
        console.error('[INTEGRATION] waitForMessage: Messages received:', client.messages);
        reject(new Error(`Message timeout after ${timeout}ms for type: ${type}`));
      }, timeout);
      
      const interval = setInterval(() => {
        if (!client.messages) return;
        
        const message = client.messages.find((msg: any) => msg.type === type);
        if (message) {
          clearTimeout(timeoutHandle);
          clearInterval(interval);
          console.log(`[INTEGRATION] Found message of type ${type}:`, message);
          resolve(message);
        }
      }, 100);
    });
  };

  // Helper function to create WebSocket clients
  const createWebSocketClient = async () => {
    return new Promise<any>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}`);
      const sessionId = `session-${crypto.randomUUID()}`;
      
      const client = {
        ws,
        sessionId,
        messages: [] as any[],
        send: (data: string) => ws.send(data),
        close: () => ws.close()
      };

      ws.onopen = () => {
        console.log('WebSocket client connected');
        resolve(client);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString());
          client.messages.push(message);
          console.log('Received message:', message);
        } catch (e) {
          console.log('Received non-JSON message:', event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      };

      ws.onclose = () => {
        console.log('WebSocket client disconnected');
      };
    });
  };

  // Helper function to create WebSocket clients with classroom code
  const createWebSocketClientWithCode = async (classroomCode: string) => {
    return new Promise<any>((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws?code=${classroomCode}`);
      const sessionId = `session-${crypto.randomUUID()}`;
      
      const client = {
        ws,
        sessionId,
        messages: [] as any[],
        send: (data: string) => ws.send(data),
        close: () => ws.close()
      };

      ws.onopen = () => {
        console.log('WebSocket student client connected with classroom code');
        resolve(client);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data.toString());
          client.messages.push(message);
          console.log('Student received message:', message);
        } catch (e) {
          console.log('Student received non-JSON message:', event.data);
        }
      };

      ws.onerror = (error) => {
        console.error('Student WebSocket error:', error);
        reject(error);
      };

      ws.onclose = () => {
        console.log('Student WebSocket client disconnected');
      };
    });
  };

  it('should return correct student language breakdown through ConnectionManager API', async () => {
    console.log('=== START: Student Language Breakdown Test ===');
    
    // Step 1: Create teacher and start a session
    const teacherClient = await createWebSocketClient();
    clients.push(teacherClient);
    
    // Wait for connection confirmation to get the actual session ID
    const connectionMessage = await waitForMessage(teacherClient, 'connection');
    const actualSessionId = connectionMessage.sessionId;
    console.log('Actual session ID from server:', actualSessionId);
    
    // Register teacher
    await teacherClient.send(JSON.stringify({
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US',
      name: 'Test Teacher',
      sessionId: actualSessionId
    }));
    
    // Wait for teacher registration and get classroom code
    const classroomCodeMessage = await waitForMessage(teacherClient, 'classroom_code');
    expect(classroomCodeMessage).toBeDefined();
    expect(classroomCodeMessage.code).toMatch(/^[A-Z0-9]{6}$/);
    
    const classroomCode = classroomCodeMessage.code;
    console.log('Teacher classroom code:', classroomCode);

    // Step 2: Create students that connect using the classroom code
    const student1Client = await createWebSocketClientWithCode(classroomCode);
    const student2Client = await createWebSocketClientWithCode(classroomCode);
    const student3Client = await createWebSocketClientWithCode(classroomCode);
    
    clients.push(student1Client, student2Client, student3Client);

    // Register students with classroom code
    await student1Client.send(JSON.stringify({
      type: 'register',
      role: 'student',
      classroomCode: classroomCode,
      languageCode: 'es-ES',
      name: 'Spanish Student 1'
    }));

    await student2Client.send(JSON.stringify({
      type: 'register',
      role: 'student',
      classroomCode: classroomCode,
      languageCode: 'fr-FR',
      name: 'French Student'
    }));

    await student3Client.send(JSON.stringify({
      type: 'register',
      role: 'student',
      classroomCode: classroomCode,
      languageCode: 'es-ES',
      name: 'Spanish Student 2'
    }));

    // Wait for all students to connect and register properly
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Debug: Check what's in the connection manager
    console.log('=== DEBUG CONNECTION MANAGER STATE ===');
    console.log('Total connections:', connectionManager.getConnectionCount());
    console.log('Student connections:', connectionManager.getStudentCount());
    console.log('Teacher connections:', connectionManager.getTeacherCount());
    console.log('Active session IDs:', connectionManager.getActiveSessionIds());
    console.log('Teacher session ID we\'re querying:', teacherClient.sessionId);
    
    // Check individual connections
    const allConnections = connectionManager.getConnections();
    let connectionsDebug = [];
    for (const conn of allConnections) {
      connectionsDebug.push({
        sessionId: connectionManager.getSessionId(conn),
        role: connectionManager.getRole(conn),
        language: connectionManager.getLanguage(conn)
      });
    }
    console.log('All connections details:', connectionsDebug);

    // Step 3: Call ConnectionManager API using the actual session ID from server
    const studentConnectionsData = connectionManager.getStudentConnectionsAndLanguagesForSession(actualSessionId);
    
    console.log('ConnectionManager API response:', studentConnectionsData);

    // Step 4: Validate the API response
    expect(studentConnectionsData.connections).toHaveLength(3);
    expect(studentConnectionsData.languages).toHaveLength(3); // 3 total students
    
    // Count languages manually like the UI would
    const languageCount: Record<string, number> = {};
    studentConnectionsData.languages.forEach(lang => {
      const langCode = lang.split('-')[0]; // Convert 'es-ES' to 'es', 'fr-FR' to 'fr'
      languageCount[langCode] = (languageCount[langCode] || 0) + 1;
    });
    
    console.log('Language count breakdown:', languageCount);
    
    // Step 5: Verify the language breakdown matches expected results
    expect(languageCount['es']).toBe(2); // Two Spanish students
    expect(languageCount['fr']).toBe(1); // One French student
    expect(Object.keys(languageCount)).toHaveLength(2); // Two different languages
    
    // Step 6: Calculate percentages like the UI would
    const totalStudents = studentConnectionsData.languages.length;
    const languageStats = Object.entries(languageCount).map(([lang, count]) => {
      const percentage = ((count / totalStudents) * 100);
      return {
        languageCode: lang,
        studentCount: count,
        percentage: Math.round(percentage * 10) / 10 // Round to 1 decimal place
      };
    });
    
    console.log('Calculated language stats:', languageStats);
    
    // Step 7: Verify calculated stats
    const spanishStats = languageStats.find(stat => stat.languageCode === 'es');
    const frenchStats = languageStats.find(stat => stat.languageCode === 'fr');
    
    expect(spanishStats).toMatchObject({
      languageCode: 'es',
      studentCount: 2,
      percentage: 66.7
    });
    
    expect(frenchStats).toMatchObject({
      languageCode: 'fr', 
      studentCount: 1,
      percentage: 33.3
    });
    
    // Step 8: Verify total percentages
    const totalPercentage = languageStats.reduce((sum, stat) => sum + stat.percentage, 0);
    expect(Math.round(totalPercentage)).toBe(100);
    
    console.log('=== END: Student Language Breakdown Test PASSED ===');
  });

  it('should handle student disconnections and update counts correctly', async () => {
    console.log('=== START: Student Disconnection Test ===');
    
    // Step 1: Create teacher and start a session
    const teacherClient = await createWebSocketClient();
    clients.push(teacherClient);
    
    // Wait for connection confirmation to get the actual session ID
    const connectionMessage = await waitForMessage(teacherClient, 'connection');
    const actualSessionId = connectionMessage.sessionId;
    console.log('Actual session ID from server:', actualSessionId);
    
    // Register teacher
    await teacherClient.send(JSON.stringify({
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US',
      name: 'Test Teacher',
      sessionId: actualSessionId
    }));
    
    // Wait for teacher registration and get classroom code
    const classroomCodeMessage = await waitForMessage(teacherClient, 'classroom_code');
    expect(classroomCodeMessage).toBeDefined();
    expect(classroomCodeMessage.code).toMatch(/^[A-Z0-9]{6}$/);
    
    const classroomCode = classroomCodeMessage.code;
    console.log('Teacher classroom code:', classroomCode);

    // Step 2: Create students using classroom code
    const student1Client = await createWebSocketClientWithCode(classroomCode);
    const student2Client = await createWebSocketClientWithCode(classroomCode);
    
    clients.push(student1Client, student2Client);

    // Register students with classroom code
    await student1Client.send(JSON.stringify({
      type: 'register',
      role: 'student',
      classroomCode: classroomCode,
      languageCode: 'es-ES'
    }));

    await student2Client.send(JSON.stringify({
      type: 'register',
      role: 'student',
      classroomCode: classroomCode,
      languageCode: 'fr-FR'
    }));

    // Wait for students to connect and register
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Debug: Check connection manager state
    console.log('=== DEBUG CONNECTION MANAGER STATE (Test 2) ===');
    console.log('Total connections:', connectionManager.getConnectionCount());
    console.log('Student connections:', connectionManager.getStudentCount());
    console.log('Teacher connections:', connectionManager.getTeacherCount());
    console.log('Active session IDs:', connectionManager.getActiveSessionIds());
    console.log('Teacher session ID we\'re querying:', actualSessionId);

    // Check initial state - both students connected
    let connectionData = connectionManager.getStudentConnectionsAndLanguagesForSession(actualSessionId);
    expect(connectionData.connections).toHaveLength(2);
    expect(connectionData.languages).toHaveLength(2);

    // Disconnect one student (French student)
    student2Client.close();
    await new Promise(resolve => setTimeout(resolve, 200));

    // Check updated state - only Spanish student remains
    connectionData = connectionManager.getStudentConnectionsAndLanguagesForSession(actualSessionId);
    expect(connectionData.connections).toHaveLength(1);
    expect(connectionData.languages).toHaveLength(1);
    
    // The remaining student should be Spanish
    const remainingLang = connectionData.languages[0];
    expect(remainingLang).toBe('es-ES');
    
    console.log('=== END: Student Disconnection Test PASSED ===');
  });
});
