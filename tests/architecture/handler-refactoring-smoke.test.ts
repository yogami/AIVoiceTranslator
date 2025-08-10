/**
 * Handler Refactoring Smoke Tests
 * 
 * High-level integration tests that verify end-to-end functionality
 * remains intact during architectural refactoring.
 * 
 * These tests focus on user-facing functionality rather than implementation details,
 * making them resilient to internal architectural changes.
 * 
 * PURPOSE: Ensure refactoring doesn't break user workflows
 */

import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { TestWebSocketServer } from '../utils/TestWebSocketServer';
import { Server as HTTPServer, createServer } from 'http';
import WebSocket from 'ws';
import { IStorage } from '../../server/storage.interface';
import { setupIsolatedTest } from '../utils/test-database-isolation';
import { initTestDatabase, closeDatabaseConnection } from '../setup/db-setup';

// Test configuration for smoke tests
const SMOKE_TEST_CONFIG = {
  CONNECTION_TIMEOUT: 10000,
  MESSAGE_TIMEOUT: 15000,
  TTS_TIMEOUT: 20000,
  TRANSCRIPTION_TIMEOUT: 25000,
  CLEANUP_DELAY: 100
};

describe('Handler Refactoring Smoke Tests', { timeout: 60000 }, () => {
  // Use unique port range for smoke tests
  const PORT_RANGE_START = 60000;
  const PORT_RANGE_END = 65000;

  let httpServer: HTTPServer;
  let wsServer: TestWebSocketServer;
  let realStorage: IStorage;
  let serverPort: number;
  let teacherClient: WebSocket | null = null;
  let studentClient: WebSocket | null = null;
  let clients: WebSocket[] = [];

  // Database setup
  beforeAll(async () => {
    await initTestDatabase();
  });

  afterAll(async () => {
    await closeDatabaseConnection();
  });

  beforeEach(async () => {
    // Set up isolated test environment
    const testIsolation = await setupIsolatedTest();
    realStorage = testIsolation.storage;

    // Find available port
    serverPort = await findAvailablePort(PORT_RANGE_START, PORT_RANGE_END);
    
    // Create HTTP server
    httpServer = createServer();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`HTTP server failed to start on port ${serverPort}`));
      }, 5000);
      
      httpServer.listen(serverPort, () => {
        clearTimeout(timeout);
        console.log(`[SMOKE] HTTP server started on port ${serverPort}`);
        resolve();
      });
      
      httpServer.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Create WebSocket server
    wsServer = new TestWebSocketServer(httpServer, realStorage);
    console.log('[SMOKE] WebSocketServer created for smoke tests');
  });

  afterEach(async () => {
    console.log('[SMOKE] Starting cleanup...');
    
    // Close all WebSocket clients
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate();
      }
    }
    clients = [];
    
    teacherClient = null;
    studentClient = null;
    
    // Stop WebSocket server
    if (wsServer) {
      await wsServer.shutdown();
      wsServer = undefined as any;
    }
    
    // Close HTTP server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          console.log('[SMOKE] HTTP server closed');
          resolve();
        });
      });
    }
    
    await new Promise(resolve => setTimeout(resolve, SMOKE_TEST_CONFIG.CLEANUP_DELAY));
  });

  describe('End-to-End TTS Flow', () => {
    it('should maintain complete TTS workflow functionality', async () => {
      // ARRANGE: Set up teacher-student session
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      
      studentClient = await createClient(`/ws?code=${teacherReg.classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      await registerStudent(studentClient, 2);
      
      // Wait for student notification
      await waitForMessage(teacherClient, 'student_joined', 1);

      // ACT: Request TTS generation
      const ttsRequest = {
        type: 'tts_request',
        text: 'Hello, this is a test message',
        languageCode: 'en-US',
        voice: 'alloy'
      };
      
      console.log('[SMOKE] Sending TTS request...');
      studentClient.send(JSON.stringify(ttsRequest));
      
      // ASSERT: Should receive TTS response
      const ttsResponse = await waitForMessage(studentClient, 'tts_response', 2);
      
      expect(ttsResponse.type).toBe('tts_response');
      expect(ttsResponse.status).toBe('success');
      expect(ttsResponse.audioData).toBeDefined();
      expect(typeof ttsResponse.audioData).toBe('string');
      
      console.log('[SMOKE] ✅ TTS workflow completed successfully');
    });

    it('should handle TTS request errors gracefully', async () => {
      // ARRANGE: Set up teacher-student session  
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      
      studentClient = await createClient(`/ws?code=${teacherReg.classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      await registerStudent(studentClient, 2);

      // ACT: Send invalid TTS request
      const invalidTtsRequest = {
        type: 'tts_request',
        text: '', // Empty text should cause error
        languageCode: 'invalid-language'
      };
      
      studentClient.send(JSON.stringify(invalidTtsRequest));
      
      // ASSERT: Should receive error response
      const errorResponse = await waitForMessage(studentClient, 'tts_response', 2);
      
      expect(errorResponse.type).toBe('tts_response');
      expect(errorResponse.status).toBe('error');
      expect(errorResponse.message).toBeDefined();
      
      console.log('[SMOKE] ✅ TTS error handling works correctly');
    });
  });

  describe('End-to-End Transcription Flow', () => {
    it('should maintain complete transcription workflow functionality', async () => {
      // ARRANGE: Set up teacher-student session
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      
      studentClient = await createClient(`/ws?code=${teacherReg.classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      await registerStudent(studentClient, 2);
      
      // Wait for student notification
      await waitForMessage(teacherClient, 'student_joined', 1);

      // ACT: Send transcription from teacher
      const transcriptionMessage = {
        type: 'transcription',
        text: 'Hello students, this is your teacher speaking'
      };
      
      console.log('[SMOKE] Sending transcription message...');
      teacherClient.send(JSON.stringify(transcriptionMessage));
      
      // ASSERT: Student should receive translation
      const translationResponse = await waitForMessage(studentClient, 'translation', 2);
      
      expect(translationResponse.type).toBe('translation');
      expect(translationResponse.originalText).toBe('Hello students, this is your teacher speaking');
      expect(translationResponse.translatedText).toBeDefined();
      expect(translationResponse.sourceLanguage).toBeDefined();
      expect(translationResponse.targetLanguage).toBeDefined();
      
      console.log('[SMOKE] ✅ Transcription workflow completed successfully');
    });

    it('should handle transcription from non-teacher gracefully', async () => {
      // ARRANGE: Set up teacher-student session
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      
      studentClient = await createClient(`/ws?code=${teacherReg.classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      await registerStudent(studentClient, 2);

      // ACT: Student tries to send transcription (should be ignored/rejected)
      const transcriptionMessage = {
        type: 'transcription',
        text: 'Student attempting to send transcription'
      };
      
      studentClient.send(JSON.stringify(transcriptionMessage));
      
      // ASSERT: Should not crash the system, teacher should not receive anything
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for potential response
      
      const teacherMessages = (teacherClient as any).messages || [];
      const transcriptionMessages = teacherMessages.filter((msg: any) => msg.type === 'transcription');
      
      expect(transcriptionMessages.length).toBe(0);
      
      console.log('[SMOKE] ✅ Non-teacher transcription handling works correctly');
    });
  });

  describe('End-to-End Audio Processing Flow', () => {
    it('should maintain complete audio processing workflow functionality', async () => {
      // ARRANGE: Set up teacher session
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      
      studentClient = await createClient(`/ws?code=${teacherReg.classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      await registerStudent(studentClient, 2);

      // ACT: Send audio data from teacher
      const audioMessage = {
        type: 'audio',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==' // Base64 test data
      };
      
      console.log('[SMOKE] Sending audio message...');
      teacherClient.send(JSON.stringify(audioMessage));
      
      // ASSERT: Should not crash the system (audio processing is complex, just verify no errors)
      await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for processing
      
      // System should still be responsive
      const pingMessage = { type: 'ping', timestamp: Date.now() };
      teacherClient.send(JSON.stringify(pingMessage));
      
      const pongResponse = await waitForMessage(teacherClient, 'pong', 1);
      expect(pongResponse.type).toBe('pong');
      
      console.log('[SMOKE] ✅ Audio processing workflow completed without errors');
    });

    it('should handle audio from non-teacher gracefully', async () => {
      // ARRANGE: Set up teacher-student session
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      
      studentClient = await createClient(`/ws?code=${teacherReg.classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      await registerStudent(studentClient, 2);

      // ACT: Student tries to send audio (should be ignored)
      const audioMessage = {
        type: 'audio',
        data: 'student-audio-data'
      };
      
      studentClient.send(JSON.stringify(audioMessage));
      
      // ASSERT: Should not crash, system should remain responsive
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const pingMessage = { type: 'ping', timestamp: Date.now() };
      studentClient.send(JSON.stringify(pingMessage));
      
      const pongResponse = await waitForMessage(studentClient, 'pong', 2);
      expect(pongResponse.type).toBe('pong');
      
      console.log('[SMOKE] ✅ Non-teacher audio handling works correctly');
    });
  });

  describe('Registration Flow Integrity', () => {
    it('should maintain teacher-student registration workflow', async () => {
      // ARRANGE & ACT: Complete registration flow
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      
      // ASSERT: Teacher registration worked
      expect(teacherReg.registerResponse.status).toBe('success');
      expect(teacherReg.registerResponse.data.role).toBe('teacher');
      expect(teacherReg.classroomCodeResponse.code).toBeDefined();
      
      // ACT: Student registration
      studentClient = await createClient(`/ws?code=${teacherReg.classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      const studentReg = await registerStudent(studentClient, 2);
      
      // ASSERT: Student registration worked
      expect(studentReg.status).toBe('success');
      expect(studentReg.data.role).toBe('student');
      
      // ASSERT: Teacher received student notification
      const studentJoinedMsg = await waitForMessage(teacherClient, 'student_joined', 1);
      expect(studentJoinedMsg.type).toBe('student_joined');
      expect(studentJoinedMsg.payload.name).toBeDefined();
      
      console.log('[SMOKE] ✅ Registration workflow integrity maintained');
    });
  });

  // Helper functions
  async function createClient(path: string = '/ws', idx?: number): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}${path}`) as any;
      ws.messages = [];
      clients.push(ws);
      
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          ws.messages.push(msg);
        } catch (e) {
          console.warn(`[SMOKE] Client #${idx} received non-JSON:`, data.toString());
        }
      });
      
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${SMOKE_TEST_CONFIG.CONNECTION_TIMEOUT}ms`));
      }, SMOKE_TEST_CONFIG.CONNECTION_TIMEOUT);
      
      ws.on('open', () => {
        clearTimeout(timeout);
        setTimeout(() => resolve(ws), 100);
      });
      
      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  async function waitForMessage(ws: WebSocket, type?: string, idx?: number): Promise<any> {
    return new Promise((resolve, reject) => {
      const wsClient = ws as any;
      const timeout = setTimeout(() => {
        clearInterval(interval);
        reject(new Error(`Message timeout after ${SMOKE_TEST_CONFIG.MESSAGE_TIMEOUT}ms for type: ${type || 'any'}`));
      }, SMOKE_TEST_CONFIG.MESSAGE_TIMEOUT);
      
      const interval = setInterval(() => {
        if (!wsClient.messages) return;
        
        for (let i = wsClient.messages.length - 1; i >= 0; i--) {
          if (!type || wsClient.messages[i].type === type) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve(wsClient.messages[i]);
            return;
          }
        }
      }, 100);
    });
  }

  async function registerTeacher(ws: WebSocket, idx: number) {
    const registerMessage = {
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US',
      name: 'Test Teacher'
    };
    
    ws.send(JSON.stringify(registerMessage));
    const registerResponse = await waitForMessage(ws, 'register', idx);
    const classroomCodeResponse = await waitForMessage(ws, 'classroom_code', idx);
    
    return { registerResponse, classroomCodeResponse };
  }

  async function registerStudent(ws: WebSocket, idx: number) {
    const registerMessage = {
      type: 'register',
      role: 'student',
      languageCode: 'es-ES',
      name: 'Test Student'
    };
    
    ws.send(JSON.stringify(registerMessage));
    return await waitForMessage(ws, 'register', idx);
  }

  async function findAvailablePort(startPort: number, endPort: number): Promise<number> {
    const net = await import('net');
    
    for (let port = startPort; port <= endPort; port++) {
      try {
        await new Promise((resolve, reject) => {
          const server = net.createServer();
          server.listen(port, () => {
            server.close(() => resolve(port));
          });
          server.on('error', reject);
        });
        return port;
      } catch {
        continue;
      }
    }
    throw new Error(`No available ports in range ${startPort}-${endPort}`);
  }
});
