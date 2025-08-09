import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer } from 'http';
import { AddressInfo } from 'net';
import WebSocket from 'ws';
import express from 'express';
import { createSessionRoutes } from '../../server/routes/sessions.routes';
import { WebSocketServer } from '../../server/interface-adapters/websocket/WebSocketServer';
import { DatabaseStorage } from '../../server/database-storage';
import { IStorage } from '../../server/storage.interface';

describe('Sessions API Integration Tests', () => {
  let app: express.Application;
  let server: any;
  let serverPort: number;
  let wsServer: WebSocketServer;
  let storage: IStorage;
  let sessionId: string;
  let classCode: string;

  beforeEach(async () => {
    // Create storage and Express app first
    storage = new DatabaseStorage();

    // Create Express app with sessions routes
    app = express();
    app.use(express.json());
    
    // We'll pass the real WebSocketServer as the activeSessionProvider

    // Start HTTP server
    server = createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, () => {
        serverPort = (server.address() as AddressInfo).port;
        resolve();
      });
    });

    // Create WebSocket server with the HTTP server
    wsServer = new WebSocketServer(server, storage);

    // Create a unique test session using timestamp to avoid duplicates
    sessionId = `test-session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    classCode = 'ABC123';
// TODO: This test file is skipped because the session status API is not implemented or used by the system.
// Restore and update if the feature is needed in the future.
    await storage.createSession({
      sessionId: sessionId,
      classCode: classCode,
      teacherId: 'teacher-1',
      teacherLanguage: 'en',
      isActive: true,
      startTime: new Date(),
      lastActivityAt: new Date()
    });
  });

  afterEach(async () => {
    try {
      // Clean up the session first
      if (sessionId) {
        await storage.endSession(sessionId);
      }
    } catch (error) {
      // Ignore cleanup errors
    }

    try {
      // Close WebSocket server if it has a close method
      if (wsServer && typeof wsServer.close === 'function') {
        wsServer.close();
      }
    } catch (error) {
      // Ignore WebSocket cleanup errors
    }

    // Close HTTP server with timeout
    if (server) {
      await new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 5000); // 5 second timeout
        server.close(() => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }, 10000); // 10 second timeout for the entire cleanup

  it('should return correct language breakdown when students join in different languages', async () => {
  // TODO: Session status API feature not implemented yet. These tests are skipped for now.
  // If session status API is added in the future, restore and update these tests.
    // Step 1: Connect teacher
    const teacherWs = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise((resolve) => teacherWs.on('open', resolve));

    // Register teacher
    teacherWs.send(JSON.stringify({
      type: 'register',
      role: 'teacher',
      sessionId,
      userId: 'teacher-1'
    }));

    // Wait for teacher registration
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step 2: Connect first student (Spanish)
    const student1Ws = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise((resolve) => student1Ws.on('open', resolve));

    student1Ws.send(JSON.stringify({
      type: 'register',
      role: 'student',
      sessionId,
      userId: 'student-1',
      language: 'es'
    }));

    // Wait for student registration
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step 3: Connect second student (French)
    const student2Ws = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise((resolve) => student2Ws.on('open', resolve));

    student2Ws.send(JSON.stringify({
      type: 'register',
      role: 'student',
      sessionId,
      userId: 'student-2',
      language: 'fr'
    }));

    // Wait for student registration
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Step 4: Connect third student (Spanish - same as first)
    const student3Ws = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise((resolve) => student3Ws.on('open', resolve));

    student3Ws.send(JSON.stringify({
      type: 'register',
      role: 'student',
      sessionId,
      userId: 'student-3',
      language: 'es'
    }));

    // Wait for student registration
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Step 5: Call the sessions API
    const response = await fetch(`http://localhost:${serverPort}/api/sessions/${sessionId}/status`);
    expect(response.ok).toBe(true);

    const data = await response.json();

    // Step 6: Verify the response structure
    expect(data).toMatchObject({
      success: true,
      data: {
        sessionId,
        classCode,
        connectedStudents: 3,
        languages: expect.any(Array),
        lastUpdated: expect.any(String)
      }
    });

    // Step 7: Verify language breakdown
    expect(data.data.languages).toHaveLength(2);
    
    // Find Spanish and French entries
    const spanishEntry = data.data.languages.find((lang: any) => lang.languageCode === 'es');
    const frenchEntry = data.data.languages.find((lang: any) => lang.languageCode === 'fr');

    expect(spanishEntry).toMatchObject({
      languageCode: 'es',
      languageName: 'Spanish',
      studentCount: 2,
      percentage: 66.7
    });

    expect(frenchEntry).toMatchObject({
      languageCode: 'fr',
      languageName: 'French',
      studentCount: 1,
      percentage: 33.3
    });

    // Step 8: Verify total percentages add up to 100
    const totalPercentage = data.data.languages.reduce((sum: number, lang: any) => sum + lang.percentage, 0);
    expect(Math.round(totalPercentage)).toBe(100);

    // Clean up connections
    teacherWs.close();
    student1Ws.close();
    student2Ws.close();
    student3Ws.close();
  });

  it('should return empty languages array when no students are connected', async () => {
    // Connect only teacher
    const teacherWs = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise((resolve) => teacherWs.on('open', resolve));

    teacherWs.send(JSON.stringify({
      type: 'register',
      role: 'teacher',
      sessionId,
      userId: 'teacher-1'
    }));

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Call the sessions API
    const response = await fetch(`http://localhost:${serverPort}/api/sessions/${sessionId}/status`);
    expect(response.ok).toBe(true);

    const data = await response.json();

    expect(data.data.connectedStudents).toBe(0);
    expect(data.data.languages).toEqual([]);

    teacherWs.close();
  });

  it('should update language breakdown when students disconnect', async () => {
    // Connect teacher and two students
    const teacherWs = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise((resolve) => teacherWs.on('open', resolve));

    teacherWs.send(JSON.stringify({
      type: 'register',
      role: 'teacher',
      sessionId,
      userId: 'teacher-1'
    }));

    const student1Ws = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise((resolve) => student1Ws.on('open', resolve));

    student1Ws.send(JSON.stringify({
      type: 'register',
      role: 'student',
      sessionId,
      userId: 'student-1',
      language: 'es'
    }));

    const student2Ws = new WebSocket(`ws://localhost:${serverPort}`);
    await new Promise((resolve) => student2Ws.on('open', resolve));

    student2Ws.send(JSON.stringify({
      type: 'register',
      role: 'student',
      sessionId,
      userId: 'student-2',
      language: 'fr'
    }));

    await new Promise((resolve) => setTimeout(resolve, 200));

    // Verify initial state
    let response = await fetch(`http://localhost:${serverPort}/api/sessions/${sessionId}/status`);
    let data = await response.json();
    expect(data.data.connectedStudents).toBe(2);
    expect(data.data.languages).toHaveLength(2);

    // Disconnect one student
    student2Ws.close();
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Check updated state
    response = await fetch(`http://localhost:${serverPort}/api/sessions/${sessionId}/status`);
    data = await response.json();
    
    expect(data.data.connectedStudents).toBe(1);
    expect(data.data.languages).toHaveLength(1);
    expect(data.data.languages[0]).toMatchObject({
      languageCode: 'es',
      languageName: 'Spanish',
      studentCount: 1,
      percentage: 100.0
    });

    teacherWs.close();
    student1Ws.close();
  });

  it('should return 404 for non-existent session', async () => {
    const response = await fetch(`http://localhost:${serverPort}/api/sessions/non-existent-session/status`);
    expect(response.status).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Session not found');
  });
});
