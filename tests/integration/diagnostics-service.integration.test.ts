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
    // Clear any existing sessions/metrics before each test
    // This ensures test isolation
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
    }
    vi.restoreAllMocks(); // Restore any mocks from previous tests
  });
  
  describe('Non-Interference with Core Functionality', () => {
    it('should establish WebSocket connections for teacher and student', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const studentClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      
      teacherClient.on('message', (data: WebSocket.Data) => { // Added type for data
        teacherMessages.push(JSON.parse(data.toString()));
      });
      studentClient.on('message', (data: WebSocket.Data) => { // Added type for data
        studentMessages.push(JSON.parse(data.toString()));
      });
      
      await new Promise<void>((resolve) => {
        teacherClient.on('open', () => {
          teacherClient.send(JSON.stringify({ type: 'register', role: 'teacher' }));
        });
        studentClient.on('open', () => {
          studentClient.send(JSON.stringify({ type: 'register', role: 'student' }));
          resolve();
        });
      });
      
      // Wait for registration messages to be processed
      await new Promise(resolve => setTimeout(resolve, 500));
      
      expect(teacherMessages.length).toBeGreaterThan(0);
      expect(studentMessages.length).toBeGreaterThan(0);
      
      // Check if the messages contain the expected data
      const teacherRegistration = teacherMessages.find(m => m.type === 'register' && m.role === 'teacher');
      const studentRegistration = studentMessages.find(m => m.type === 'register' && m.role === 'student');
      
      expect(teacherRegistration).toBeDefined();
      expect(studentRegistration).toBeDefined();
    });
    
    it('should continue working even if metrics collection fails', async () => {
      // Spy on storage.addTranslation and make it throw an error
      const storageAddTranslationSpy = vi.spyOn(storage, 'addTranslation')
        .mockRejectedValue(new StorageError('Failed to save translation (simulated)', StorageErrorCode.DB_ERROR)); // Corrected StorageErrorCode

      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const studentClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      
      teacherClient.on('message', (data: WebSocket.Data) => { // Added type for data
        teacherMessages.push(JSON.parse(data.toString()));
      });
      studentClient.on('message', (data: WebSocket.Data) => { // Added type for data
        studentMessages.push(JSON.parse(data.toString()));
      });
      
      await new Promise<void>((resolve) => {
        teacherClient.on('open', () => {
          teacherClient.send(JSON.stringify({ type: 'register', role: 'teacher' }));
        });
        studentClient.on('open', () => {
          studentClient.send(JSON.stringify({ type: 'register', role: 'student' }));
          resolve();
        });
      });
      
      // Wait for registration messages to be processed
      // Using a small timeout or a more robust wait for server-side registration confirmation
      await new Promise(resolve => setTimeout(resolve, 500)); // Allow time for registration
      
      // Clear messages before translation
      studentMessages.length = 0;
      teacherMessages.length = 0; // Also clear teacher messages for cleaner assertion
      
      // Send transcription from student (acting as teacher for this test part)
      // to trigger translation and thus storage.addTranslation
      teacherClient.send(JSON.stringify({ // Assuming teacher sends transcription
        type: 'transcription',
        text: 'Bonjour, comment ça va ?',
        languageCode: 'fr-FR' // Teacher's language
      }));
      
      // Wait for a translation message on the student client
      await new Promise(resolve => {
        const checkForTranslation = () => {
          if (studentMessages.find(m => m.type === 'translation')) {
            resolve(null);
          } else {
            setTimeout(checkForTranslation, 100);
          }
        };
        setTimeout(checkForTranslation, 100); // Initial check
      });
      
      const translation = studentMessages.find(m => m.type === 'translation');
      expect(translation).toBeDefined();
      if (translation) { // Check if translation is defined
        expect(translation.text).toBeDefined();
      }
      
      // Verify that storage.addTranslation was called (and threw an error)
      expect(storageAddTranslationSpy).toHaveBeenCalled();

      // Ensure WebSocket connections are still open
      expect(teacherClient.readyState).toBe(WebSocket.OPEN);
      expect(studentClient.readyState).toBe(WebSocket.OPEN);
      
      // Clean up
      teacherClient.close();
      studentClient.close();
    });
  });
  
  describe('Real-Time Metrics Collection', () => {
    it('should collect and broadcast metrics in real-time', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const studentClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      
      teacherClient.on('message', (data: WebSocket.Data) => { // Added type for data
        teacherMessages.push(JSON.parse(data.toString()));
      });
      studentClient.on('message', (data: WebSocket.Data) => { // Added type for data
        studentMessages.push(JSON.parse(data.toString()));
      });
      
      await Promise.all([
        new Promise(resolve => teacherClient.on('open', resolve)),
        new Promise(resolve => studentClient.on('open', resolve))
      ]);
      
      // Teacher registers
      teacherClient.send(JSON.stringify({ type: 'register', role: 'teacher', language: 'en-US', name: 'Test Teacher' }));
      // Student registers
      studentClient.send(JSON.stringify({ type: 'register', role: 'student', language: 'ja-JP', name: 'Test Student', classroomCode: await extractClassroomCode(teacherMessages) }));
      
      // Wait for registration confirmation or classroom code for teacher
      await waitForMessage(teacherMessages, 'classroom_code', 2000);
      // Wait for student to be registered (e.g. by receiving a specific message or checking server state if possible)
      // For this test, we'll assume student is registered after sending the message and a short delay or a confirmation message.
      // A 'user_joined' message to the teacher would be a good indicator.
      // await waitForMessage(teacherMessages, 'user_joined', 2000); // Assuming teacher gets 'user_joined' - Removed as 'user_joined' is not a standard message.
      await waitForMessage(studentMessages, 'register', 2000); // Student should receive a 'register' confirmation.
      
      // Send a transcription from teacher to student to generate metrics
      teacherClient.send(JSON.stringify({
        type: 'transcription', // Changed from 'message' to 'transcription' to trigger translation & metrics
        text: 'Hello, how are you?',
        languageCode: 'en-US' // Assuming teacher is speaking English
        // Removed 'to: student' as transcription is broadcast or handled by server logic
      }));
      
      // Wait for the student to receive the translation (which implies metrics were processed)
      await waitForMessage(studentMessages, 'translation', 2000); // Wait for translation message
      
      expect(studentMessages.length).toBeGreaterThan(0);
      
      const receivedTranslation = studentMessages.find(m => m.type === 'translation');
      expect(receivedTranslation).toBeDefined();
      if (receivedTranslation) { // Check if receivedTranslation is defined
          expect(receivedTranslation.text).toBeDefined(); // Or check for specific translated text if known
      }
      
      // Check if metrics were collected (e.g., message count, active users)
      // This part is tricky as metrics are not directly sent as a 'metrics' type message
      // We'd typically check this by querying the DiagnosticsService or checking stored metrics
      // For now, we'll assume that if translation worked, basic session metrics were updated.
      // A more robust test would involve a DiagnosticsService.getMetrics() call.
      // const diagnosticsService = new DiagnosticsService(storage, wsServer as any); // REMOVED: Use singleton
      const currentMetrics = await diagnosticsService.getMetrics(); // Use imported singleton and correct method name
      expect(currentMetrics.sessions.activeSessions).toBeGreaterThanOrEqual(1); // At least one session (teacher-student) // Corrected path
      expect(currentMetrics.translations.total).toBeGreaterThanOrEqual(1); // At least one translation // Corrected path
      
      teacherClient.close();
      studentClient.close();
    });
  });
  
  describe('Historical Metrics Storage', () => {
    it('should persist session data for later analysis', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      teacherClient.on('message', (data: WebSocket.Data) => { // Added type for data
        teacherMessages.push(JSON.parse(data.toString()));
      });
      
      await new Promise<void>((resolve) => {
        teacherClient.on('open', () => {
          teacherClient.send(JSON.stringify({ type: 'register', role: 'teacher' }));
          resolve();
        });
      });
      
      // Wait for registration
      await waitForMessage(teacherMessages, 'classroom_code'); // Wait for classroom code as a proxy for registration
      
      const classroomCodeMessage = teacherMessages.find(m => m.type === 'classroom_code');
      expect(classroomCodeMessage).toBeDefined();
      const sessionIdToFind = classroomCodeMessage?.sessionId; // Get sessionId from the message
      
      // Get session before closing
      const activeSessionsBefore = await storage.getAllActiveSessions();
      
      // Close the WebSocket connection
      teacherClient.close();
      
      // Wait a moment to ensure disconnection is processed
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check if the session is still active (it should be, if historical data is preserved)
      const activeSessionsAfter = await storage.getAllActiveSessions();
      expect(activeSessionsAfter.length).toBe(activeSessionsBefore.length);
      
      // Optionally, check if specific data is persisted correctly
      const persistedSession = activeSessionsAfter.find(s => s.sessionId === sessionIdToFind); // Use sessionId
      expect(persistedSession).toBeDefined();
      if (persistedSession) { // Check if persistedSession is defined
        expect(persistedSession.studentsCount).toEqual(0); // Check studentsCount
      }
      
      // Clean up
      teacherClient.close();
    });
    
    it('should store translation history with language pairs', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const studentClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];

      teacherClient.on('message', (data: WebSocket.Data) => { // Added type for data
        teacherMessages.push(JSON.parse(data.toString()));
      });
      studentClient.on('message', (data: WebSocket.Data) => { // Added type for data
        studentMessages.push(JSON.parse(data.toString()));
      });

      await Promise.all([
        new Promise<void>((resolve) => {
          teacherClient.on('open', () => {
            teacherClient.send(JSON.stringify({ type: 'register', role: 'teacher' }));
            resolve();
          });
        }),
        new Promise<void>((resolve) => {
          studentClient.on('open', () => {
            studentClient.send(JSON.stringify({ type: 'register', role: 'student', languageCode: 'ja-JP' }));
            resolve();
          });
        })
      ]);
      // Wait for registrations
      await Promise.all([
        waitForMessage(teacherMessages, 'classroom_code'),
        waitForMessage(studentMessages, 'register') 
      ]);
      
      // Teacher sends transcription
      teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Historical data test',
        languageCode: 'en-US' // Teacher's language
      }));
      
      // Wait for a translation message on student client
      await waitForMessage(studentMessages, 'translation', 2000);
      
      // Check storage directly for historical data
      // Assuming student registered with 'ja-JP'
      let translations = await storage.getTranslationsByLanguage('ja-JP', 10);
      expect(translations.length).toBeGreaterThan(0);
      
      const translation = translations.find(t => t.originalText === 'Historical data test');
      expect(translation).toBeDefined();
      if (translation) { // Check if translation is defined
        // The expected translation depends on the actual translation service.
        // For a mock or predictable service, this can be exact.
        // For a real service, checking for non-empty string might be more robust.
        expect(translation.translatedText).toBeDefined(); 
        // If you have a way to know the expected translation, use it:
        // expect(translation.translatedText).toBe('履歴データテスト'); 
      }
      
      // Clean up
      teacherClient.close();
      studentClient.close();
    });
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