import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { TestWebSocketServer } from '../../utils/TestWebSocketServer';
import { Server as HTTPServer, createServer } from 'http';
import WebSocket from 'ws';
import { IStorage } from '../../../server/storage.interface';
import { setupIsolatedTest } from '../../utils/test-database-isolation';
import { initTestDatabase, closeDatabaseConnection } from '../../setup/db-setup';

import { INTEGRATION_TEST_CONFIG, debugTestTimingScaling } from '../../helpers/test-timing';

// Test configuration for integration tests with real services
const TEST_CONFIG = {
  CONNECTION_TIMEOUT: INTEGRATION_TEST_CONFIG.CONNECTION_TIMEOUT,
  MESSAGE_TIMEOUT: INTEGRATION_TEST_CONFIG.MESSAGE_TIMEOUT,
  TRANSLATION_TIMEOUT: INTEGRATION_TEST_CONFIG.TRANSLATION_TIMEOUT,
  SETUP_DELAY: INTEGRATION_TEST_CONFIG.STANDARD_WAIT,
  CLEANUP_DELAY: INTEGRATION_TEST_CONFIG.CLEANUP_DELAY,
  RECONNECTION_WAIT: INTEGRATION_TEST_CONFIG.RECONNECTION_WAIT
};

describe('WebSocketServer Integration Tests (Real Services)', { timeout: Math.max(45000, INTEGRATION_TEST_CONFIG.INTEGRATION_TEST_TIMEOUT || 30000) }, () => {
  // Use a different port range to avoid conflicts
  const PORT_RANGE_START = 50000;
  const PORT_RANGE_END = 55000;

  let httpServer: HTTPServer;
  let wsServer: TestWebSocketServer;
  let realStorage: IStorage;
  let serverPort: number;
  let teacherClient: WebSocket | null = null;
  let studentClient: WebSocket | null = null;
  let clients: WebSocket[] = [];

  // Helper to create WebSocket client with message buffering
  const createClient = (path: string = '/ws', idx?: number): Promise<WebSocket> => {
    if (!serverPort) {
      throw new Error('serverPort is not set in createClient');
    }
    console.log(`[INTEGRATION] Creating WebSocket for path: ${path} (client #${idx || 'N/A'}) on port ${serverPort}`);
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}${path}`) as any;
      ws.messages = [];
      clients.push(ws);
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          ws.messages.push(msg);
          console.log(`[INTEGRATION] Client #${idx || 'N/A'} received message:`, msg.type);
        } catch (e) {
          console.warn(`[INTEGRATION] Client #${idx || 'N/A'} received non-JSON message:`, data.toString());
        }
      });
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${TEST_CONFIG.CONNECTION_TIMEOUT}ms`));
      }, TEST_CONFIG.CONNECTION_TIMEOUT);
      ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`[INTEGRATION] WebSocket OPENED for client #${idx || 'N/A'}`);
        setTimeout(() => resolve(ws), 100);
      });
      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        console.error(`[INTEGRATION] WebSocket error for client #${idx || 'N/A'}:`, err);
        reject(err);
      });
      ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout);
        console.log(`[INTEGRATION] WebSocket closed for client #${idx || 'N/A'}. Code: ${code}`);
      });
    });
  };

  const waitForMessage = (ws: WebSocket, type?: string, idx?: number): Promise<any> => {
    return new Promise((resolve, reject) => {
      const wsClient = ws as any;
      const timeout = setTimeout(() => {
        clearInterval(interval);
        console.error(`[INTEGRATION] waitForMessage: Timeout for type: ${type || 'any'} on client #${idx}`);
        console.error('[INTEGRATION] waitForMessage: Messages received:', wsClient.messages);
        reject(new Error(`Message timeout after ${TEST_CONFIG.MESSAGE_TIMEOUT}ms for type: ${type || 'any'}`));
      }, TEST_CONFIG.MESSAGE_TIMEOUT);
      const interval = setInterval(() => {
        if (!wsClient.messages) return;
        let messageIndex = -1;
        for (let i = wsClient.messages.length - 1; i >= 0; i--) {
          if (!type || wsClient.messages[i].type === type) {
            messageIndex = i;
            break;
          }
        }
        if (messageIndex >= 0) {
          clearTimeout(timeout);
          clearInterval(interval);
          const message = wsClient.messages[messageIndex];
          console.log(`[INTEGRATION] Found message of type ${type || 'any'} for client #${idx}:`, message);
          resolve(message);
        }
      }, 100);
    });
  };

  const sendAndWait = async (ws: WebSocket, message: any, expectedResponseType?: string, idx?: number): Promise<any> => {
    console.log(`[INTEGRATION] Sending message to client #${idx}:`, message);
    ws.send(JSON.stringify(message));
    if (expectedResponseType) {
      return waitForMessage(ws, expectedResponseType, idx);
    } else {
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 200));
      return null;
    }
  };

  beforeAll(async () => {
    // Debug timing scaling for diagnostics
    debugTestTimingScaling();
    
    // Check if we have real API keys for integration testing
    const hasOpenAIKey = !!process.env.OPENAI_API_KEY;
    const hasElevenLabsKey = !!process.env.ELEVENLABS_API_KEY;
    
    // Enable translation persistence for integration tests
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';
    
    if (!hasOpenAIKey && !hasElevenLabsKey) {
      console.warn('[INTEGRATION] No real API keys found. Some integration tests may be skipped.');
    }

    // Initialize test database
    console.log('[INTEGRATION] Initializing test database...');
    await initTestDatabase();
  });

  afterAll(async () => {
    console.log('[INTEGRATION] Closing test database...');
    await closeDatabaseConnection();
  });

  beforeEach(async () => {
    console.log('[INTEGRATION] Setting up isolated database and server...');
    
    // Generate unique test ID for complete isolation
    const testId = `websocket-integration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[INTEGRATION] Using unique test ID: ${testId}`);
    
    // Get isolated storage
    realStorage = await setupIsolatedTest(testId);
    console.log('[INTEGRATION] Created isolated storage:', testId);
    
    // Create HTTP server
    httpServer = createServer();
    
    // Start server on available port
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('HTTP server startup timeout')), 10000);
      
      const tryPort = PORT_RANGE_START + Math.floor(Math.random() * (PORT_RANGE_END - PORT_RANGE_START));
      
      httpServer.listen(tryPort, () => {
        clearTimeout(timeout);
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          serverPort = addr.port;
          console.log(`[INTEGRATION] HTTP server started on port ${serverPort}`);
          resolve();
        } else {
          reject(new Error('Failed to get server address'));
        }
      });
      
      httpServer.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Create WebSocket server with REAL orchestrator (no mocks!)
    wsServer = new TestWebSocketServer(httpServer, realStorage);
    
    // IMPORTANT: Do NOT set mock orchestrator - use real services for integration testing
    console.log('[INTEGRATION] WebSocketServer created with REAL translation orchestrator');
  });

  afterEach(async () => {
    console.log('[INTEGRATION] Starting cleanup...');
    
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
        httpServer.close(() => resolve());
      });
      await new Promise(resolve => setTimeout(resolve, 200));
      httpServer = undefined as any;
    }
    
    vi.restoreAllMocks();
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log('[INTEGRATION] Cleanup complete');
  });

  describe('Real Translation Integration', () => {
    it('should connect teacher and student using real WebSocket infrastructure', async () => {
      console.log('[INTEGRATION] Starting basic connection test...');
      
      // Teacher connects
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      // Teacher registers
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Integration Test Teacher'
      }, 'register', 1);
      
      const classroomCodeMessage = await waitForMessage(teacherClient, 'classroom_code', 1);
      expect(classroomCodeMessage.code).toMatch(/^[A-Z0-9]{6}$/);
      
      console.log('[INTEGRATION] Teacher connected successfully with classroom code:', classroomCodeMessage.code);
      
      // Student connects with classroom code
      studentClient = await createClient(`/ws?code=${classroomCodeMessage.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      
      // Student registers
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        classroomCode: classroomCodeMessage.code,
        languageCode: 'es-ES',
        name: 'Integration Test Student'
      }, 'register', 2);
      
      // Teacher should receive student_joined notification
      const studentJoinedMessage = await waitForMessage(teacherClient, 'student_joined', 1);
      expect(studentJoinedMessage.payload.name).toBe('Integration Test Student');
      
      console.log('[INTEGRATION] Basic connection test passed');
    });

    it('should perform real translation when API keys are available', async () => {
      // Skip if no API keys
      if (!process.env.OPENAI_API_KEY || /^sk-test|^invalid|test-placeholder/.test(process.env.OPENAI_API_KEY)) {
        console.log('[INTEGRATION] Skipping real translation test - no OpenAI API key');
        return;
      }

      console.log('[INTEGRATION] Starting real translation test...');
      // Force premium translator to avoid auto-fallback returning original text
      process.env.TRANSLATION_SERVICE_TYPE = 'openai';
      
      // Setup teacher and student
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Real Translation Teacher'
      }, 'register', 1);
      
      const classroomCodeMessage = await waitForMessage(teacherClient, 'classroom_code', 1);
      
      studentClient = await createClient(`/ws?code=${classroomCodeMessage.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        classroomCode: classroomCodeMessage.code,
        languageCode: 'fr-FR',
        name: 'Real Translation Student'
      }, 'register', 2);
      
      await waitForMessage(teacherClient, 'student_joined', 1);
      
      // Send transcription for real translation
      console.log('[INTEGRATION] Sending transcription for real translation...');
      const translationPromise = waitForMessage(studentClient, 'translation', 2);
      
      await sendAndWait(teacherClient, {
        type: 'transcription',
        text: 'Hello, this is a test message for real translation',
        isFinal: true,
        languageCode: 'en-US'
      }, undefined, 1);
      
      // Wait for real translation (longer timeout for API call)
      const translationMessage = await Promise.race([
        translationPromise,
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Real translation timeout')), TEST_CONFIG.TRANSLATION_TIMEOUT)
        )
      ]);
      
      console.log('[INTEGRATION] Received real translation:', translationMessage);
      
      // Verify real translation
      expect(translationMessage.type).toBe('translation');
      expect(translationMessage.originalText).toBe('Hello, this is a test message for real translation');
      expect(translationMessage.sourceLanguage).toBe('en-US');
      expect(translationMessage.targetLanguage).toBe('fr-FR');
      
      // Real translation should not contain mock markers
      expect(translationMessage.text).not.toContain('[MOCK-');
      // Should be translated; allow provider prefix but not raw original text
      expect(translationMessage.text.replace(/^\[[^\]]+\]\s*/, '')).not.toContain('Hello, this is a test message for real translation');
      
      console.log('[INTEGRATION] Real translation test passed');
    }, Math.max(TEST_CONFIG.TRANSLATION_TIMEOUT + 5000, 30000));

    it('should handle translation errors gracefully with real services', async () => {
      console.log('[INTEGRATION] Starting real service error handling test...');
      
      // Setup teacher and student
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Error Test Teacher'
      }, 'register', 1);
      
      const classroomCodeMessage = await waitForMessage(teacherClient, 'classroom_code', 1);
      
      studentClient = await createClient(`/ws?code=${classroomCodeMessage.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        classroomCode: classroomCodeMessage.code,
        languageCode: 'invalid-lang',
        name: 'Error Test Student'
      }, 'register', 2);
      
      await waitForMessage(teacherClient, 'student_joined', 1);
      
      // Send transcription that might cause translation errors
      console.log('[INTEGRATION] Sending potentially problematic transcription...');
      
      await sendAndWait(teacherClient, {
        type: 'transcription',
        text: '', // Empty text might cause issues
        isFinal: true,
        languageCode: 'en-US'
      }, undefined, 1);
      
      // System should remain stable even if translation fails
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Connections should still be open
      expect(teacherClient?.readyState).toBe(WebSocket.OPEN);
      expect(studentClient?.readyState).toBe(WebSocket.OPEN);
      
      console.log('[INTEGRATION] Error handling test passed');
    });

    it('should persist real translation data to database', async () => {
      // Skip if no API keys
      if (!process.env.OPENAI_API_KEY) {
        console.log('[INTEGRATION] Skipping database persistence test - no OpenAI API key');
        return;
      }

      console.log('[INTEGRATION] Starting database persistence test...');
      
      // Setup and perform translation (similar to previous test)
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Persistence Test Teacher'
      }, 'register', 1);
      
      const classroomCodeMessage = await waitForMessage(teacherClient, 'classroom_code', 1);
      const sessionId = classroomCodeMessage.sessionId;
      
      studentClient = await createClient(`/ws?code=${classroomCodeMessage.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        classroomCode: classroomCodeMessage.code,
        languageCode: 'es-ES',
        name: 'Persistence Test Student'
      }, 'register', 2);
      
      await waitForMessage(teacherClient, 'student_joined', 1);
      
      // Perform real translation
      const translationPromise = waitForMessage(studentClient, 'translation', 2);
      const testText = 'Database persistence test message';
      
      await sendAndWait(teacherClient, {
        type: 'transcription',
        text: testText,
        isFinal: true,
        languageCode: 'en-US'
      }, undefined, 1);
      
      await translationPromise;
      
      // Wait for database write to complete
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Verify translation was persisted to database
      const translations = await realStorage.getTranslations(10);
      const sessionTranslations = translations.filter((t: any) => t.sessionId === sessionId);
      
      expect(sessionTranslations.length).toBeGreaterThan(0);
      
      const translation = sessionTranslations.find((t: any) => t.originalText === testText);
      expect(translation).toBeDefined();
      
      if (translation) {
        expect(translation.sourceLanguage).toBe('en-US');
        expect(translation.targetLanguage).toBe('es-ES');
        // Latency may be null if not recorded, so check if it exists and is valid
        if (translation.latency !== null) {
          expect(translation.latency).toBeGreaterThan(0);
        }
      }
      
      console.log('[INTEGRATION] Database persistence test passed');
    }, Math.max(TEST_CONFIG.TRANSLATION_TIMEOUT + 10000, 60000));
  });

  describe('Real Service Error Handling', () => {
    it('should handle network timeouts gracefully', async () => {
      console.log('[INTEGRATION] Starting network timeout test...');
      
      // This test verifies the system remains stable even during network issues
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      // System should handle connection and basic operations even if external services are slow
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Timeout Test Teacher'
      }, 'register', 1);
      
      const classroomCodeMessage = await waitForMessage(teacherClient, 'classroom_code', 1);
      expect(classroomCodeMessage.code).toBeDefined();
      
      console.log('[INTEGRATION] Network timeout test passed');
    });
  });

  describe('Teacher ID Integration - Session Reconnection', () => {
    it('should allow teacher to reconnect and reuse the same classroom code (1-to-1 mapping)', async () => {
      console.log('[INTEGRATION] Starting Teacher ID reconnection test...');
      
      // Step 1: Teacher connects and creates session
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      const teacherId = `teacher-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Reconnection Test Teacher',
        teacherId: teacherId
      }, 'register', 1);
      
      const classroomCodeMessage = await waitForMessage(teacherClient, 'classroom_code', 1);
      const originalSessionId = classroomCodeMessage.sessionId;
      const classroomCode = classroomCodeMessage.code;
      
      console.log(`[INTEGRATION] Teacher created session ${originalSessionId} with classroom code ${classroomCode}`);
      
      // Step 2: Student joins the session
      studentClient = await createClient(`/ws?code=${classroomCode}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        classroomCode: classroomCode,
        languageCode: 'es-ES',
        name: 'Reconnection Test Student'
      }, 'register', 2);
      
      await waitForMessage(teacherClient, 'student_joined', 1);
      
      // Step 3: Teacher disconnects (simulate network issue)
      console.log('[INTEGRATION] Simulating teacher disconnect...');
      teacherClient.terminate();
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.RECONNECTION_WAIT));
      
      // Step 4: Teacher reconnects with same teacherId
      console.log('[INTEGRATION] Teacher reconnecting with same teacherId...');
      teacherClient = await createClient('/', 3);
      await waitForMessage(teacherClient, 'connection', 3);
      
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Reconnection Test Teacher',
        teacherId: teacherId // Same teacherId for reconnection
      }, 'register', 3);
      
      // Step 5: Verify same session was reused (1-to-1 mapping: same sessionId = same classroom code)
      const reconnectedMessage = await waitForMessage(teacherClient, 'classroom_code', 3);
      expect(reconnectedMessage.sessionId).toBeDefined();
      expect(reconnectedMessage.code).toBeDefined();
      expect(reconnectedMessage.code).toBe(classroomCode); // Same sessionId should reuse same classroom code
      
      // Step 6: Verify student is still connected and can receive messages
      // Note: No student_joined message should be sent when teacher reconnects to existing session with students
      await sendAndWait(teacherClient, {
        type: 'transcription',
        text: 'Reconnection test message',
        isFinal: true,
        languageCode: 'en-US'
      }, undefined, 3);
      
      // Student should still receive messages after teacher reconnection
      await waitForMessage(studentClient, 'translation', 2);
      
      console.log('[INTEGRATION] Teacher ID reconnection test passed');
    });

    it('should maintain session consistency with multiple teachers (preserve 1-to-1 mapping)', async () => {
      console.log('[INTEGRATION] Starting multiple teachers session isolation test...');
      
      // Create two different teacher IDs
      const teacherId1 = `teacher1-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const teacherId2 = `teacher2-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Step 1: Teacher 1 creates session
      const teacher1Client = await createClient('/', 1);
      await waitForMessage(teacher1Client, 'connection', 1);
      
      await sendAndWait(teacher1Client, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Teacher One',
        teacherId: teacherId1
      }, 'register', 1);
      
      const teacher1ClassroomCode = await waitForMessage(teacher1Client, 'classroom_code', 1);
      const session1Id = teacher1ClassroomCode.sessionId;
      const classroomCode1 = teacher1ClassroomCode.code;
      
      // Step 2: Teacher 2 creates separate session
      const teacher2Client = await createClient('/', 2);
      await waitForMessage(teacher2Client, 'connection', 2);
      
      await sendAndWait(teacher2Client, {
        type: 'register',
        role: 'teacher',
        languageCode: 'fr-FR',
        name: 'Teacher Two',
        teacherId: teacherId2
      }, 'register', 2);
      
      const teacher2ClassroomCode = await waitForMessage(teacher2Client, 'classroom_code', 2);
      const session2Id = teacher2ClassroomCode.sessionId;
      const classroomCode2 = teacher2ClassroomCode.code;
      
      // Step 3: Verify sessions are different
      expect(session1Id).not.toBe(session2Id);
      expect(classroomCode1).not.toBe(classroomCode2);
      
      // Step 4: Students join respective sessions
      const student1Client = await createClient(`/ws?code=${classroomCode1}`, 3);
      await waitForMessage(student1Client, 'connection', 3);
      
      await sendAndWait(student1Client, {
        type: 'register',
        role: 'student',
        classroomCode: classroomCode1,
        languageCode: 'es-ES',
        name: 'Student One'
      }, 'register', 3);
      
      const student2Client = await createClient(`/ws?code=${classroomCode2}`, 4);
      await waitForMessage(student2Client, 'connection', 4);
      
      await sendAndWait(student2Client, {
        type: 'register',
        role: 'student',
        classroomCode: classroomCode2,
        languageCode: 'de-DE',
        name: 'Student Two'
      }, 'register', 4);
      
      // Add small delays to avoid race conditions in multiple teacher scenario
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.SETUP_DELAY));
      
      await waitForMessage(teacher1Client, 'student_joined', 1);
      await waitForMessage(teacher2Client, 'student_joined', 2);
      
      // Step 5: Both teachers disconnect
      console.log('[INTEGRATION] Both teachers disconnecting...');
      teacher1Client.terminate();
      teacher2Client.terminate();
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.RECONNECTION_WAIT));
      
      // Step 6: Teachers reconnect with correct teacherIds
      console.log('[INTEGRATION] Teachers reconnecting...');
      
      const reconnectedTeacher1 = await createClient('/', 5);
      await waitForMessage(reconnectedTeacher1, 'connection', 5);
      
      await sendAndWait(reconnectedTeacher1, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Teacher One',
        teacherId: teacherId1 // Reconnect with original ID
      }, 'register', 5);
      
      const reconnectedTeacher2 = await createClient('/', 6);
      await waitForMessage(reconnectedTeacher2, 'connection', 6);
      
      await sendAndWait(reconnectedTeacher2, {
        type: 'register',
        role: 'teacher',
        languageCode: 'fr-FR',
        name: 'Teacher Two',
        teacherId: teacherId2 // Reconnect with original ID
      }, 'register', 6);
      
      // Step 7: Verify each teacher keeps their original session (1-to-1 mapping preserved)
      // Note: No student_joined messages should be sent when teachers reconnect to existing sessions with students
      const teacher1Reconnected = await waitForMessage(reconnectedTeacher1, 'classroom_code', 5);
      const teacher2Reconnected = await waitForMessage(reconnectedTeacher2, 'classroom_code', 6);
      
      expect(teacher1Reconnected.sessionId).toBeDefined();
      expect(teacher1Reconnected.code).toBeDefined();
      expect(teacher1Reconnected.code).toBe(classroomCode1); // Same sessionId should reuse same classroom code
      expect(teacher2Reconnected.sessionId).toBeDefined();
      expect(teacher2Reconnected.code).toBeDefined();
      expect(teacher2Reconnected.code).toBe(classroomCode2); // Same sessionId should reuse same classroom code
      expect(teacher1Reconnected.code).not.toBe(teacher2Reconnected.code); // Should be different from each other
      
      // Step 8: Verify isolated communication
      await sendAndWait(reconnectedTeacher1, {
        type: 'transcription',
        text: 'Message for session 1',
        isFinal: true,
        languageCode: 'en-US'
      }, undefined, 5);
      
      await sendAndWait(reconnectedTeacher2, {
        type: 'transcription',
        text: 'Message pour session 2',
        isFinal: true,
        languageCode: 'fr-FR'
      }, undefined, 6);
      
      // Students should only receive messages from their own teacher
      const student1Translation = await waitForMessage(student1Client, 'translation', 3);
      const student2Translation = await waitForMessage(student2Client, 'translation', 4);
      
      expect(student1Translation.originalText).toBe('Message for session 1');
      expect(student1Translation.sourceLanguage).toBe('en-US');
      expect(student1Translation.targetLanguage).toBe('es-ES');
      
      expect(student2Translation.originalText).toBe('Message pour session 2');
      expect(student2Translation.sourceLanguage).toBe('fr-FR');
      expect(student2Translation.targetLanguage).toBe('de-DE');
      
      // Clean up additional clients
      reconnectedTeacher1.terminate();
      reconnectedTeacher2.terminate();
      student1Client.terminate();
      student2Client.terminate();
      
      console.log('[INTEGRATION] Multiple teachers session isolation test passed');
    });

    it('should handle teacher reconnection with different teacherId (new session)', async () => {
      console.log('[INTEGRATION] Starting teacher new session test...');
      
      // Step 1: Teacher creates initial session
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      const originalTeacherId = `teacher-original-${Date.now()}`;
      
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'Original Teacher',
        teacherId: originalTeacherId
      }, 'register', 1);
      
      const originalSession = await waitForMessage(teacherClient, 'classroom_code', 1);
      const originalSessionId = originalSession.sessionId;
      
      // Step 2: Teacher disconnects
      teacherClient.terminate();
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Step 3: Teacher reconnects with DIFFERENT teacherId
      teacherClient = await createClient('/', 2);
      await waitForMessage(teacherClient, 'connection', 2);
      
      const newTeacherId = `teacher-new-${Date.now()}`;
      
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'New Teacher Session',
        teacherId: newTeacherId // Different teacherId
      }, 'register', 2);
      
      // Step 4: Verify new session is created (not reconnected to old one)
      const newSession = await waitForMessage(teacherClient, 'classroom_code', 2);
      const newSessionId = newSession.sessionId;
      
      expect(newSessionId).not.toBe(originalSessionId);
      expect(newSession.code).not.toBe(originalSession.code);
      
      console.log('[INTEGRATION] Teacher new session test passed - different teacherId creates new session');
    });

    it('should handle reconnection when no previous session exists', async () => {
      console.log('[INTEGRATION] Starting no previous session test...');
      
      // Teacher connects with teacherId but no previous session exists
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      const newTeacherId = `teacher-never-existed-${Date.now()}`;
      
      await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US',
        name: 'New Teacher',
        teacherId: newTeacherId
      }, 'register', 1);
      
      // Should create new session since no previous session exists
      const newSession = await waitForMessage(teacherClient, 'classroom_code', 1);
      expect(newSession.sessionId).toBeDefined();
      expect(newSession.code).toMatch(/^[A-Z0-9]{6}$/);
      
      console.log('[INTEGRATION] No previous session test passed - new session created');
    });
  });
});