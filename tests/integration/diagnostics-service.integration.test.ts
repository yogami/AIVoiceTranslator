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
import express, { Request, Response } from 'express';
import { AddressInfo } from 'net';
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { DatabaseStorage } from '../../server/database-storage';
import { DiagnosticsService, type SessionActivity } from '../../server/services/DiagnosticsService'; // Import SessionActivity
import { clearDiagnosticData } from '../e2e/test-data-utils';
import { StorageError, StorageErrorCode } from '../../server/storage.error';
import { IStorage } from '../../server/storage.interface'; // Correct import for IStorage

describe('Diagnostics Service Integration', () => {
  let httpServer: Server;
  let wsServer: WebSocketServer;
  let actualPort: number;
  let testStorage: IStorage; // Use IStorage interface
  let diagnosticsServiceInstance: DiagnosticsService; // Renamed to avoid conflict

  beforeAll(async () => {
    // Set environment variable for testing persistence
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';

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
    
    testStorage = new DatabaseStorage(); 
    
    // Instantiate DiagnosticsService first, passing null for IActiveSessionProvider
    diagnosticsServiceInstance = new DiagnosticsService(testStorage, null); 

    // Instantiate WebSocketServer
    wsServer = new WebSocketServer(httpServer, testStorage);
   
    // Perform setter injection for IActiveSessionProvider on DiagnosticsService
    diagnosticsServiceInstance.setActiveSessionProvider(wsServer);

    (global as any).wsServer = wsServer; 

    await new Promise<void>(resolve => {
      httpServer.listen(0, () => { 
        const address = httpServer.address() as AddressInfo;
        actualPort = address.port;
        console.log(`Test server running on port ${actualPort}`);
        resolve();
      });
    });
  }, 60000); 
  
  afterAll(async () => {
    if (wsServer) {
      wsServer.shutdown(); 
    }
    if (httpServer) {
      await new Promise<void>(resolve => httpServer.close(() => resolve()));
    }
    delete (global as any).wsServer; 
    vi.restoreAllMocks();
  });
  
  beforeEach(async () => {
    // Clear data before each test
    await (testStorage as DatabaseStorage).reset(); 
    // diagnosticsServiceInstance is NOT re-created here. It uses the reset testStorage.
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
      // Spy on the existing testStorage instance's addTranslation method
      const storageAddTranslationSpy = vi.spyOn(testStorage, 'addTranslation')
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
      // Ensure spy is restored if not automatically handled by vi.restoreAllMocks() for this specific case,
      // though usually it is. If issues persist, explicit restore here or in a local afterEach.
      // storageAddTranslationSpy.mockRestore(); // Typically not needed with global restoreAllMocks

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
      const currentMetrics = await diagnosticsServiceInstance.getMetrics();
      expect(currentMetrics.sessions.activeSessions).toBeGreaterThanOrEqual(1);
      expect(currentMetrics.translations.total).toBeGreaterThanOrEqual(1);
      teacherClient.close();
      studentClient.close();
    }, 20000);
  });
  
  describe('Historical Metrics Storage', () => {
    it('should persist session data for later analysis', async () => {
      if (!(testStorage.constructor && testStorage.constructor.name === 'DatabaseStorage')) {
        console.warn('Skipping historical metrics test: not running with DatabaseStorage');
        return;
      }
      // Log all sessions before test
      const beforeSessions = await testStorage.getAllActiveSessions();
      console.log('[Historical Test] DB sessions before test:', beforeSessions);
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
      // Log all sessions after test
      const afterSessions = await testStorage.getAllActiveSessions();
      console.log('[Historical Test] DB active sessions after test:', afterSessions);
      // Query persistent storage for sessionId
      // The expect(classroomCodeMessage).toBeDefined() above ensures classroomCodeMessage is not null/undefined
      expect(classroomCodeMessage.sessionId).toBeDefined();
      expect(typeof classroomCodeMessage.sessionId).toBe('string');
      const sessionIdToFind: string = classroomCodeMessage.sessionId; // Now guaranteed to be a string

      // const persistedSession = afterSessions.find(s => s.sessionId === sessionIdToFind);
      // Fetch session by ID directly, regardless of active status
      const persistedSession = await testStorage.getSessionById(sessionIdToFind);
      console.log('[Historical Test] Looking for sessionId:', sessionIdToFind, 'Found:', persistedSession);
      expect(persistedSession).toBeDefined();
      if (persistedSession) {
        expect(persistedSession.studentsCount).toBeGreaterThanOrEqual(1);
      }
    }, 5000);

    it('should retrieve historical metrics by classroom code', async () => {
      if (!(testStorage.constructor && testStorage.constructor.name === 'DatabaseStorage')) {
        console.warn('Skipping historical metrics test: not running with DatabaseStorage');
        return;
      }
      // Step 1: Create a session (teacher + student)
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      teacherClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        teacherMessages.push(msg);
      });
      await new Promise(resolve => teacherClient.on('open', resolve));
      teacherClient.send(JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }));
      await waitForMessage(teacherMessages, 'classroom_code', 3000);
      const classroomCodeMessage = teacherMessages.find(m => m.type === 'classroom_code');
      expect(classroomCodeMessage).toBeDefined();
      const classroomCode = classroomCodeMessage?.code;
      // Student joins
      const studentClient = new WebSocket(`ws://localhost:${actualPort}/ws?code=${classroomCode}`);
      const studentMessages: any[] = [];
      studentClient.on('message', (data: WebSocket.Data) => {
        const msg = JSON.parse(data.toString());
        studentMessages.push(msg);
      });
      await new Promise(resolve => studentClient.on('open', resolve));
      studentClient.send(JSON.stringify({ type: 'register', role: 'student', classroomCode, languageCode: 'en-US' }));
      await waitForMessage(studentMessages, 'register', 3000);
      teacherClient.close();
      studentClient.close();
      await new Promise(resolve => setTimeout(resolve, 300));
      // Step 2: Query persistent storage for session by classroom code (sessionId)
      // The expect(classroomCodeMessage).toBeDefined() above ensures classroomCodeMessage is not null/undefined
      expect(classroomCodeMessage.sessionId).toBeDefined();
      expect(typeof classroomCodeMessage.sessionId).toBe('string');
      const sessionIdToFind: string = classroomCodeMessage.sessionId; // Now guaranteed to be a string

      // const allSessions = await storage.getAllActiveSessions();
      // const sessionByCode = allSessions.find(s => s.sessionId === sessionIdToFind);
      // Fetch session by ID directly, regardless of active status
      const sessionByCode = await testStorage.getSessionById(sessionIdToFind);
      console.log('[Historical Test - By Classroom Code] Looking for sessionId:', sessionIdToFind, 'Found:', sessionByCode);
      expect(sessionByCode).toBeDefined();
      if (sessionByCode) {
        expect(sessionByCode.sessionId === sessionIdToFind).toBeTruthy();
        expect(sessionByCode.studentsCount).toBeGreaterThanOrEqual(1);
      }
    }, 5000);

    it('Historical Metrics Storage: should reflect historical session activity in diagnostics aggregates and recent activity list', async () => {
      const getSessionByIdSpy = vi.spyOn(testStorage, 'getSessionById'); // This spy is for storage, not DiagnosticsService directly.
                                                                    // DiagnosticsService.getMetrics doesn't call storage.getSessionById.
                                                                    // This spy might be for other parts of the test or can be removed if not relevant to getMetrics.

      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      teacherClient.on('message', (data: WebSocket.Data) => teacherMessages.push(JSON.parse(data.toString())));
      await new Promise(resolve => teacherClient.on('open', resolve));
      const teacherRegisterPayload = { type: 'register', role: 'teacher', languageCode: 'en-US', name: 'Historical Teacher' };
      teacherClient.send(JSON.stringify(teacherRegisterPayload));
      await waitForMessage(teacherMessages, 'classroom_code', 5000);
      const classroomCodeMessage = teacherMessages.find(m => m.type === 'classroom_code');
      expect(classroomCodeMessage).toBeDefined();
      expect(classroomCodeMessage.code).toBeDefined();
      expect(classroomCodeMessage.sessionId).toBeDefined();
      const classroomCode = classroomCodeMessage.code;
      const sessionId = classroomCodeMessage.sessionId;

      const studentClient = new WebSocket(`ws://localhost:${actualPort}/ws?code=${classroomCode}`);
      const studentMessages: any[] = [];
      studentClient.on('message', (data: WebSocket.Data) => studentMessages.push(JSON.parse(data.toString())));
      await new Promise(resolve => studentClient.on('open', resolve));
      const studentRegisterPayload = { type: 'register', role: 'student', classroomCode, languageCode: 'es-ES', name: 'Historical Student' };
      studentClient.send(JSON.stringify(studentRegisterPayload));
      await waitForMessage(studentMessages, 'register', 5000);
      const studentRegisterMessage = studentMessages.find(m => m.type === 'register');
      expect(studentRegisterMessage).toBeDefined();
      expect(studentRegisterMessage.status).toBe('success');

      await waitForMessage(teacherMessages, 'student_joined', 5000);
      const studentJoinedMessage = teacherMessages.find(m => m.type === 'student_joined');
      expect(studentJoinedMessage).toBeDefined();
      expect(studentJoinedMessage.payload.name).toBe('Historical Student');

      const transcriptPayload = { text: 'Hello from historical teacher', languageCode: 'en-US', timestamp: Date.now() };
      teacherClient.send(JSON.stringify({ type: 'transcription', text: transcriptPayload.text, languageCode: transcriptPayload.languageCode, timestamp: transcriptPayload.timestamp }));
      await waitForMessage(studentMessages, 'translation', 10000);
      const studentTranslationMessage = studentMessages.find(m => m.type === 'translation');
      expect(studentTranslationMessage).toBeDefined();
      // The student receives the translated text in their language.
      // The original text is available in studentTranslationMessage.originalText.
      expect(studentTranslationMessage.text).toBe('Hola de parte de un profesor de historia'); // Expected Spanish translation
      expect(studentTranslationMessage.originalText).toBe(transcriptPayload.text); // Original English text
      expect(studentTranslationMessage.targetLanguage).toBe('es-ES'); // Student's language, changed from languageCode

      // Store initial aggregate counts to check increments if possible and makes sense
      const initialGlobalMetrics = await diagnosticsServiceInstance.getMetrics();
      const initialTotalTranslationsFromDb = initialGlobalMetrics.translations.totalFromDatabase;
      const initialTotalSessions = initialGlobalMetrics.sessions.totalSessions;


      teacherClient.close();
      studentClient.close();
      await new Promise(res => setTimeout(res, 500));

      // Call getMetrics - it returns aggregate data.
      // For specific session data, we look into metrics.sessions.recentSessionActivity
      const metrics = await diagnosticsServiceInstance.getMetrics(); // Get all-time metrics

      // The getSessionByIdSpy on storage.getSessionById is not called by diagnosticsService.getMetrics().
      // If this spy was intended to check if DiagnosticsService uses it, that's a misunderstanding.
      // We can remove this expectation or verify it wasn't called in this path if that's the intent.
      // For now, just ensure it's restored.
      getSessionByIdSpy.mockRestore();

      expect(metrics).toBeDefined();
      
      // Check sessions.recentSessionActivity for our session
      // Note: recentSessionActivity usually shows a limited number of recent sessions (e.g., last 5)
      const sessionActivity = metrics.sessions.recentSessionActivity.find((activity: SessionActivity) => activity.sessionId === sessionId);
      expect(sessionActivity).toBeDefined();

      if (sessionActivity) {
        expect(sessionActivity.sessionId).toBe(sessionId);
        expect(sessionActivity.language).toBe(teacherRegisterPayload.languageCode); // teacherLanguage
        expect(sessionActivity.transcriptCount).toBeGreaterThanOrEqual(1); // We sent one transcript
      }

      // Check aggregate counts.
      // Assuming the session and its translation are new and should be counted.
      expect(metrics.translations.totalFromDatabase).toBeGreaterThanOrEqual(initialTotalTranslationsFromDb + 1);
      expect(metrics.sessions.totalSessions).toBeGreaterThanOrEqual(initialTotalSessions + 1);
      
      // We cannot verify specific transcript/translation content or full lists via DiagnosticsService.getMetrics().
      // The original assertions for metrics.sessionDetails, metrics.transcripts, metrics.translations (as arrays) were incorrect.
    }, 15000);


    it('Historical Metrics Storage: should filter aggregate diagnostics by time range', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      teacherClient.on('message', (data: WebSocket.Data) => teacherMessages.push(JSON.parse(data.toString())));
      await new Promise(resolve => teacherClient.on('open', resolve));

      const teacherRegisterPayload = { type: 'register', role: 'teacher', languageCode: 'en-US', name: 'TimeRange Teacher' };
      teacherClient.send(JSON.stringify(teacherRegisterPayload));
      await waitForMessage(teacherMessages, 'classroom_code', 5000);
      const classroomCodeMessage = teacherMessages.find(m => m.type === 'classroom_code');
      expect(classroomCodeMessage).toBeDefined();
      const classroomCode = classroomCodeMessage.code;
      const sessionId = classroomCodeMessage.sessionId;

      const studentClient = new WebSocket(`ws://localhost:${actualPort}/ws?code=${classroomCode}`);
      const studentMessages: any[] = []; // Initialize for this scope
      studentClient.on('message', (data: WebSocket.Data) => studentMessages.push(JSON.parse(data.toString())));
      await new Promise(resolve => studentClient.on('open', resolve));
      const studentRegisterPayload = { type: 'register', role: 'student', classroomCode, languageCode: 'es-ES', name: 'TimeRange Student' };
      studentClient.send(JSON.stringify(studentRegisterPayload));
      await waitForMessage(studentMessages, 'register', 5000);
      const studentRegisterMessage_TimeRange = studentMessages.find(m => m.type === 'register');
      expect(studentRegisterMessage_TimeRange).toBeDefined();
      expect(studentRegisterMessage_TimeRange.status).toBe('success');

      await waitForMessage(teacherMessages, 'student_joined', 5000);

      const now = Date.now();
      // Ensure timestamps are distinct and allow for querying ranges around them.
      const transcript1Time = now - 5000; // 5 seconds ago
      const transcript2Time = now - 3000; // 3 seconds ago
      const transcript3Time = now - 1000; // 1 second ago

      // Send transcripts at different times
      // Important: The storage methods (getTranslationMetrics, getSessionMetrics) will determine how these are counted.
      // We assume translations are timestamped and sessions are active during these transcriptions.
      teacherClient.send(JSON.stringify({ type: 'transcription', text: 'Transcript 1 old', languageCode: 'en-US', timestamp: transcript1Time }));
      await waitForMessage(studentMessages, 'translation', 5000); studentMessages.length = 0;

      teacherClient.send(JSON.stringify({ type: 'transcription', text: 'Transcript 2 middle', languageCode: 'en-US', timestamp: transcript2Time }));
      await waitForMessage(studentMessages, 'translation', 5000); studentMessages.length = 0;

      teacherClient.send(JSON.stringify({ type: 'transcription', text: 'Transcript 3 recent', languageCode: 'en-US', timestamp: transcript3Time }));
      await waitForMessage(studentMessages, 'translation', 5000); studentMessages.length = 0;

      teacherClient.close();
      studentClient.close();
      await new Promise(res => setTimeout(res, 500)); // Ensure session is inactive and data persisted

      // Test case 1: Range including only Transcript 2's data
      const range1Start = new Date(transcript1Time + 100); // After T1
      const range1End = new Date(transcript2Time + 100);   // After T2, but before T3
      let metrics = await diagnosticsServiceInstance.getMetrics({ startDate: range1Start, endDate: range1End });
      expect(metrics).toBeDefined();
      expect(metrics.timeRange).toBeDefined();
      expect(new Date(metrics.timeRange!.startDate).getTime()).toBe(range1Start.getTime());
      expect(new Date(metrics.timeRange!.endDate).getTime()).toBe(range1End.getTime());
      // Assuming storage.getTranslationMetrics counts translations based on their timestamp.
      expect(metrics.translations.totalFromDatabase).toBe(1); // Only translation for T2

      // Test case 2: Range including Transcript 2 and 3
      const range2Start = new Date(transcript2Time - 100); // Before T2
      const range2End = new Date(transcript3Time + 100);   // After T3
      metrics = await diagnosticsServiceInstance.getMetrics({ startDate: range2Start, endDate: range2End });
      expect(metrics.translations.totalFromDatabase).toBe(2); // Translations for T2, T3

      // Test case 3: Range including all three
      const range3Start = new Date(transcript1Time - 100); // Before T1
      const range3End = new Date(transcript3Time + 100);   // After T3
      metrics = await diagnosticsServiceInstance.getMetrics({ startDate: range3Start, endDate: range3End });
      expect(metrics.translations.totalFromDatabase).toBe(3); // Translations for T1, T2, T3

      // Test case 4: Range with no data (future)
      const range4Start = new Date(now + 1000);
      const range4End = new Date(now + 2000);
      metrics = await diagnosticsServiceInstance.getMetrics({ startDate: range4Start, endDate: range4End });
      expect(metrics.translations.totalFromDatabase).toBe(0);

      // Test case 5: Only startTime (interpreted by service as start to "now" for presets, or passed as is for TimeRange object)
      // To be precise, we pass a TimeRange object. The service's parseTimeRange handles it.
      // If endDate is not provided to storage, it might default to 'now' or fetch all after startDate.
      // Let's be explicit for the test:
      const range5Start = new Date(transcript2Time - 100); // Before T2
      // Assuming "now" for the service is close to the 'now' variable in the test.
      metrics = await diagnosticsServiceInstance.getMetrics({ startDate: range5Start, endDate: new Date(now + 500) });
      expect(metrics.translations.totalFromDatabase).toBe(2); // T2, T3

      // Test case 6: Only endTime
      const range6End = new Date(transcript2Time + 100); // After T2, before T3
      metrics = await diagnosticsServiceInstance.getMetrics({ startDate: new Date(0), endDate: range6End }); // From beginning of time
      expect(metrics.translations.totalFromDatabase).toBe(2); // T1, T2

      // Note: metrics.sessions.recentSessionActivity is NOT filtered by the time range passed to getMetrics,
      // as storage.getRecentSessionActivity is called without a time range by DiagnosticsService.
      // So, no assertions on recentSessionActivity being filtered here.
    }, 20000);


    it('Historical Metrics Storage: should return all data in aggregates if no time range is provided', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const teacherMessages: any[] = [];
      teacherClient.on('message', (data: WebSocket.Data) => teacherMessages.push(JSON.parse(data.toString())));
      await new Promise(resolve => teacherClient.on('open', resolve));

      const teacherRegisterPayload = { type: 'register', role: 'teacher', languageCode: 'en-US', name: 'NoTimeRange Teacher' };
      teacherClient.send(JSON.stringify(teacherRegisterPayload));
      await waitForMessage(teacherMessages, 'classroom_code', 5000);
      const classroomCodeMessage = teacherMessages.find(m => m.type === 'classroom_code');
      expect(classroomCodeMessage).toBeDefined();
      const classroomCode = classroomCodeMessage.code;
      const sessionId = classroomCodeMessage.sessionId;

      const studentClient = new WebSocket(`ws://localhost:${actualPort}/ws?code=${classroomCode}`);
      const studentMessages: any[] = []; // Initialize for this scope
      studentClient.on('message', (data: WebSocket.Data) => studentMessages.push(JSON.parse(data.toString())));
      await new Promise(resolve => studentClient.on('open', resolve));
      const studentRegisterPayload = { type: 'register', role: 'student', classroomCode, languageCode: 'es-ES', name: 'NoTimeRange Student' };
      studentClient.send(JSON.stringify(studentRegisterPayload));
      await waitForMessage(studentMessages, 'register', 5000);
      const studentRegisterMessage_NoTimeRange = studentMessages.find(m => m.type === 'register');
      expect(studentRegisterMessage_NoTimeRange).toBeDefined();
      expect(studentRegisterMessage_NoTimeRange.status).toBe('success');

      await waitForMessage(teacherMessages, 'student_joined', 5000);

      // Store initial aggregate counts
      const initialGlobalMetrics = await diagnosticsServiceInstance.getMetrics();
      const initialTotalTranslationsFromDb = initialGlobalMetrics.translations.totalFromDatabase;
      const initialTotalSessions = initialGlobalMetrics.sessions.totalSessions;
      const initialTranscriptCountForSession = (initialGlobalMetrics.sessions.recentSessionActivity.find((act: SessionActivity) => act.sessionId === sessionId) || { transcriptCount: 0 }).transcriptCount;


      teacherClient.send(JSON.stringify({ type: 'transcription', text: 'Transcript A', languageCode: 'en-US', timestamp: Date.now() - 1000} ));
      await waitForMessage(studentMessages, 'translation', 5000); studentMessages.length = 0;

      teacherClient.send(JSON.stringify({ type: 'transcription', text: 'Transcript B', languageCode: 'en-US', timestamp: Date.now() } ));
      await waitForMessage(studentMessages, 'translation', 5000); studentMessages.length = 0;
      
      teacherClient.close();
      studentClient.close();
      await new Promise(res => setTimeout(res, 500));

      const metrics = await diagnosticsServiceInstance.getMetrics(); // No time range
      expect(metrics).toBeDefined();
      expect(metrics.timeRange).toBeUndefined(); // No specific timeRange was requested

      expect(metrics.translations.totalFromDatabase).toBeGreaterThanOrEqual(initialTotalTranslationsFromDb + 2);
      expect(metrics.sessions.totalSessions).toBeGreaterThanOrEqual(initialTotalSessions + (initialGlobalMetrics.sessions.recentSessionActivity.find((act: SessionActivity) => act.sessionId === sessionId) ? 0 : 1) ); // Session count increases if it's a new session not previously counted in total.

      const sessionActivity = metrics.sessions.recentSessionActivity.find((act: SessionActivity) => act.sessionId === sessionId);
      expect(sessionActivity).toBeDefined();
      if (sessionActivity) {
        expect(sessionActivity.transcriptCount).toBeGreaterThanOrEqual(initialTranscriptCountForSession + 2);
      }
    }, 15000);
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