/**
 * Diagnostics Service Integration Tests
 * 
 * Tests that the diagnostics/analytics service:
 * 1. Collects metrics without interfering with core functionality
 * 2. Provides both real-time (in-memory) and historical (persistent) data
 * 3. Gracefully handles failures without affecting translations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'; // Added vi
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import express, { Request, Response } from 'express'; // Added express, Request, Response
import { AddressInfo } from 'net'; // Added AddressInfo
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { storage } from '../../server/storage';
import { MemStorage } from '../../server/mem-storage'; // Added import
import { StorageError, StorageErrorCode } from '../../server/storage.error'; // Changed import path
import { DiagnosticsService, diagnosticsService } from '../../server/services/DiagnosticsService'; // Import the singleton
import { clearDiagnosticData } from '../e2e/test-data-utils';
import { DatabaseStorage } from '../../server/database-storage';

describe('Diagnostics Service Integration', () => {
  let httpServer: Server;
  let wsServer: WebSocketServer;
  let actualPort: number;
  
  beforeAll(async () => {
    // Start HTTP server
    const app = express();
    // Mock the /api/languages endpoint if your WebSocketServer or other services depend on it during startup
    app.get('/api/languages', (req: Request, res: Response) => { // Typed req and res
      res.json([
        { code: 'en-US', name: 'English (US)', isActive: true },
        { code: 'es-ES', name: 'Spanish (Spain)', isActive: true },
        { code: 'ja-JP', name: 'Japanese', isActive: true },
        { code: 'fr-FR', name: 'French (France)', isActive: true },
      ]);
    });

    httpServer = createServer(app);
    
    // Initialize WebSocketServer
    wsServer = new WebSocketServer(httpServer);
    (global as any).wsServer = wsServer; // Make wsServer globally available for the diagnosticsService singleton

    await new Promise<void>(resolve => {
      httpServer.listen(0, () => {
        const address = httpServer.address() as AddressInfo;
        actualPort = address.port;
        console.log(`Test server running on port ${actualPort}`);
        resolve();
      });
    });
  }, 60000); // Increase timeout to 60s
  
  afterAll(async () => {
    // wsServer.closeAllConnections();
    // wsServer.stopHeartbeat();
    // wsServer.stopClassroomCleanup();
    if (wsServer) {
      wsServer.shutdown(); // Updated to use the new shutdown method
    }
    if (httpServer) {
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
    delete (global as any).wsServer; // Clean up global wsServer
    vi.restoreAllMocks();
  });
  
  beforeEach(async () => {
    // Dynamically override storage type for historical metrics test
    const currentTest = expect.getState().currentTestName || '';
    if (currentTest.includes('Historical Metrics Storage')) {
      // Use persistent storage for historical metrics
      if (!(storage instanceof DatabaseStorage)) {
        // @ts-ignore
        global.storage = new DatabaseStorage();
      }
      await clearDiagnosticData();
    } else {
      // Use in-memory storage for all other tests
      if (storage instanceof DatabaseStorage) {
        // @ts-ignore
        const { MemStorage } = await import('../../server/mem-storage');
        // @ts-ignore
        global.storage = new MemStorage();
      }
      if (storage instanceof MemStorage && typeof (storage as any).reset === 'function') {
        await (storage as any).reset();
      } else if (storage instanceof MemStorage) {
        // Fallback if no generic reset, try to clear individual stores
        const s = storage as any;
        if (s.sessions instanceof Map) s.sessions.clear();
        if (s.translations instanceof Map) s.translations.clear();
        if (s.transcripts instanceof Map) s.transcripts.clear();
        if (s.users instanceof Map) s.users.clear();
        // Re-initialize default languages if they are managed as an array in MemStorage
        // This part might need adjustment based on the actual MemStorage implementation
        if (s.languages && typeof s.getLanguages === 'function' && typeof s.createLanguage === 'function') {
          const currentLangs = await s.getLanguages();
          if (currentLangs.length === 0) { // Or some other logic to reset languages
              await s.createLanguage({ code: 'en', name: 'English', isActive: true });
              await s.createLanguage({ code: 'es', name: 'Spanish', isActive: true });
              await s.createLanguage({ code: 'ja-JP', name: 'Japanese', isActive: true });
          }
        }
      } else {
        // Persistent storage: clear DB for historical metrics tests
        await clearDiagnosticData();
      }
    }
    vi.restoreAllMocks(); // Restore any mocks from previous tests
  });
  
  describe('Non-Interference with Core Functionality', () => {
    it('should establish WebSocket connections for teacher and student', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      teacherClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        teacherMessages.push(msg);
        console.log('[Teacher WS] Received:', msg);
      });
      teacherClient.on('error', (err) => {
        console.error('[Teacher WS] Error:', err);
      });
      await new Promise(resolve => teacherClient.on('open', resolve));
      const teacherRegisterPayload = { type: 'register', role: 'teacher', languageCode: 'en-US', name: 'Test Teacher' };
      console.log('[Test] Sending teacher register:', teacherRegisterPayload);
      teacherClient.send(JSON.stringify(teacherRegisterPayload));
      await waitForMessage(teacherMessages, 'classroom_code', 5000);
      const classroomCodeMsg = teacherMessages.find(m => m.type === 'classroom_code');
      console.log('[Test] classroomCodeMsg:', classroomCodeMsg);
      const classroomCode = classroomCodeMsg?.code;
      expect(classroomCode).toBeDefined();
      // Student client is created only after classroomCode is available
      const studentClient = new WebSocket(`ws://localhost:${actualPort}/ws?code=${classroomCode}`);
      studentClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        studentMessages.push(msg);
        console.log('[Student WS] Received:', msg);
      });
      studentClient.on('error', (err) => {
        console.error('[Student WS] Error:', err);
      });
      await new Promise(resolve => studentClient.on('open', resolve));
      const studentRegisterPayload = { type: 'register', role: 'student', classroomCode, languageCode: 'en-US', name: 'Test Student' };
      console.log('[Test] Sending student register:', studentRegisterPayload);
      studentClient.send(JSON.stringify(studentRegisterPayload));
      await waitForMessage(studentMessages, 'register', 5000);
      const studentRegister = studentMessages.find(m => m.type === 'register');
      console.log('[Test] studentRegister:', studentRegister);
      expect(studentRegister).toBeDefined();
      teacherClient.close();
      studentClient.close();
    }, 10000);

    it('should continue working even if metrics collection fails', async () => {
      const storageAddTranslationSpy = vi.spyOn(storage, 'addTranslation')
        .mockRejectedValue(new StorageError('Failed to save translation (simulated)', StorageErrorCode.DB_ERROR));
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      teacherClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        teacherMessages.push(msg);
        console.log('[Teacher WS] Received:', msg);
      });
      teacherClient.on('error', (err) => {
        console.error('[Teacher WS] Error:', err);
      });
      await new Promise(resolve => teacherClient.on('open', resolve));
      const teacherRegisterPayload2 = { type: 'register', role: 'teacher', languageCode: 'en-US', name: 'Test Teacher' };
      console.log('[Test] Sending teacher register:', teacherRegisterPayload2);
      teacherClient.send(JSON.stringify(teacherRegisterPayload2));
      await waitForMessage(teacherMessages, 'classroom_code', 3000);
      const classroomCodeMessage = teacherMessages.find(m => m.type === 'classroom_code');
      console.log('[Test] classroomCodeMessage:', classroomCodeMessage);
      expect(classroomCodeMessage).toBeDefined();
      const classroomCode2 = classroomCodeMessage?.code;
      // Student client is created only after classroomCode2 is available
      const studentClient = new WebSocket(`ws://localhost:${actualPort}/ws?code=${classroomCode2}`);
      studentClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        studentMessages.push(msg);
        console.log('[Student WS] Received:', msg);
      });
      studentClient.on('error', (err) => {
        console.error('[Student WS] Error:', err);
      });
      await new Promise(resolve => studentClient.on('open', resolve));
      const studentRegisterPayload2 = { type: 'register', role: 'student', classroomCode: classroomCode2, languageCode: 'en-US', name: 'Test Student' };
      console.log('[Test] Sending student register:', studentRegisterPayload2);
      studentClient.send(JSON.stringify(studentRegisterPayload2));
      await waitForMessage(studentMessages, 'register', 3000);
      // Clear messages before translation
      studentMessages.length = 0;
      teacherMessages.length = 0;
      teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Bonjour, comment ça va ?',
        languageCode: 'fr-FR'
      }));
      await waitForMessage(studentMessages, 'translation', 10000);
      const translation = studentMessages.find(m => m.type === 'translation');
      expect(translation).toBeDefined();
      if (translation) {
        expect(translation.text).toBeDefined();
      }
      expect(storageAddTranslationSpy).toHaveBeenCalled();
      expect(teacherClient.readyState).toBe(WebSocket.OPEN);
      expect(studentClient.readyState).toBe(WebSocket.OPEN);
      teacherClient.close();
      studentClient.close();
    }, 20000);
  });
  
  describe('Real-Time Metrics Collection', () => {
    it('should collect and broadcast metrics in real-time', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      teacherClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        teacherMessages.push(msg);
        console.log('[Teacher WS] Received:', msg);
      });
      teacherClient.on('error', (err) => {
        console.error('[Teacher WS] Error:', err);
      });
      await new Promise(resolve => teacherClient.on('open', resolve));
      teacherClient.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US', name: 'Test Teacher' }));
      await waitForMessage(teacherMessages, 'classroom_code', 10000);
      const classroomCode = extractClassroomCode(teacherMessages);
      // Student client is created only after classroomCode is available
      const studentClient = new WebSocket(`ws://localhost:${actualPort}/ws?code=${classroomCode}`);
      studentClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        studentMessages.push(msg);
        console.log('[Student WS] Received:', msg);
      });
      studentClient.on('error', (err) => {
        console.error('[Student WS] Error:', err);
      });
      await new Promise(resolve => studentClient.on('open', resolve));
      studentClient.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'ja-JP', name: 'Test Student', classroomCode }));
      await waitForMessage(studentMessages, 'register', 10000);
      teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello, how are you?',
        languageCode: 'en-US'
      }));
      await waitForMessage(studentMessages, 'translation', 10000);
      expect(studentMessages.length).toBeGreaterThan(0);
      const receivedTranslation = studentMessages.find(m => m.type === 'translation');
      expect(receivedTranslation).toBeDefined();
      if (receivedTranslation) {
        expect(receivedTranslation.text).toBeDefined();
      }
      const currentMetrics = await diagnosticsService.getMetrics();
      expect(currentMetrics.sessions.activeSessions).toBeGreaterThanOrEqual(1);
      expect(currentMetrics.translations.total).toBeGreaterThanOrEqual(1);
      teacherClient.close();
      studentClient.close();
    }, 20000);
  });
  
  describe('Historical Metrics Storage', () => {
    it('should persist session data for later analysis', async () => {
      if (!(storage.constructor && storage.constructor.name === 'DatabaseStorage')) {
        console.warn('Skipping historical metrics test: not running with DatabaseStorage');
        return;
      }
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      teacherClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        teacherMessages.push(msg);
        console.log('[Teacher WS] Received:', msg);
      });
      teacherClient.on('error', (err) => {
        console.error('[Teacher WS] Error:', err);
      });
      await new Promise(resolve => teacherClient.on('open', resolve));
      teacherClient.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }));
      await waitForMessage(teacherMessages, 'classroom_code', 3000);
      const classroomCodeMessage = teacherMessages.find(m => m.type === 'classroom_code');
      console.log('[Test] classroomCodeMessage:', classroomCodeMessage);
      expect(classroomCodeMessage).toBeDefined();
      const classroomCode = classroomCodeMessage?.code;
      // Student client is created only after classroomCode is available
      const studentClient = new WebSocket(`ws://localhost:${actualPort}/ws?code=${classroomCode}`);
      studentClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        studentMessages.push(msg);
        console.log('[Student WS] Received:', msg);
      });
      studentClient.on('error', (err) => {
        console.error('[Student WS] Error:', err);
      });
      await new Promise(resolve => studentClient.on('open', resolve));
      studentClient.send(JSON.stringify({ type: 'register', role: 'student', classroomCode, languageCode: 'en-US' }));
      await waitForMessage(studentMessages, 'register', 3000);
      teacherClient.close();
      studentClient.close();
      await new Promise(resolve => setTimeout(resolve, 300));
      // Query persistent storage for sessionId
      const sessionIdToFind = classroomCodeMessage?.sessionId;
      const allSessions = await storage.getAllActiveSessions();
      console.log('[Historical Test] allSessions:', allSessions);
      const persistedSession = allSessions.find(s => s.sessionId === sessionIdToFind);
      console.log('[Historical Test] Looking for sessionId:', sessionIdToFind, 'Found:', persistedSession);
      expect(persistedSession).toBeDefined();
      if (persistedSession) {
        expect(persistedSession.studentsCount).toBeGreaterThanOrEqual(1);
      }
    }, 5000);
  });
});

// Helper function
async function waitForMessage(messages: any[], messageType: string, timeout = 5000): Promise<void> {
  const startTime = Date.now();
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      if (messages.find(m => m.type === messageType)) {
        clearInterval(interval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(interval);
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }
    }, 100);
  });
}

// Added helper function
function extractClassroomCode(messages: any[]): string | undefined {
  const codeMessage = messages.find(m => m.type === 'classroom_code');
  return codeMessage?.code;
}