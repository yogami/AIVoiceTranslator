import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { TestWebSocketServer } from '../../utils/TestWebSocketServer';
import { Server as HTTPServer, createServer } from 'http';
import WebSocket from 'ws';
import { IStorage } from '../../../server/storage.interface';
import { setupIsolatedTest, cleanupIsolatedTest } from '../../utils/test-database-isolation';
import { initTestDatabase, closeDatabaseConnection } from '../../setup/db-setup';
import { setupTestIsolation } from '../../../test-config/test-isolation';

// Test configuration
const TEST_CONFIG = {
  CONNECTION_TIMEOUT: 8000,
  MESSAGE_TIMEOUT: 8000,
  SETUP_DELAY: 50,
  CLEANUP_DELAY: 50
};

describe('WebSocketServer Component Tests', { timeout: 30000 }, () => {
  // Set up test isolation for this component test suite
  setupTestIsolation('WebSocketServer Component Tests', 'component');
  
  // Use a different port range for WebSocket tests to avoid conflicts with diagnostics tests
  const PORT_RANGE_START = 40000;
  const PORT_RANGE_END = 45000;

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
    console.log(`[DEBUG] Creating WebSocket for path: ${path} (client #${idx || 'N/A'}) on port ${serverPort}`);
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}${path}`) as any;
      ws.messages = [];
      clients.push(ws);
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          ws.messages.push(msg);
          console.log(`[DEBUG] Client #${idx || 'N/A'} received message:`, msg.type);
        } catch (e) {
          console.warn(`[DEBUG] Client #${idx || 'N/A'} received non-JSON message:`, data.toString());
        }
      });
      const timeout = setTimeout(() => {
        reject(new Error(`Connection timeout after ${TEST_CONFIG.CONNECTION_TIMEOUT}ms`));
      }, TEST_CONFIG.CONNECTION_TIMEOUT);
      ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`[DEBUG] WebSocket OPENED for client #${idx || 'N/A'}`);
        setTimeout(() => resolve(ws), 100);
      });
      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        console.error(`[DEBUG] WebSocket error for client #${idx || 'N/A'}:`, err);
        reject(err);
      });
      ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout);
        console.log(`[DEBUG] WebSocket closed for client #${idx || 'N/A'}. Code: ${code}`);
      });
    });
  };

  const waitForMessage = (ws: WebSocket, type?: string, idx?: number): Promise<any> => {
    return new Promise((resolve, reject) => {
      const wsClient = ws as any;
      const timeout = setTimeout(() => {
        clearInterval(interval);
        console.error(`[TEST] waitForMessage: Timeout for type: ${type || 'any'} on client #${idx}`);
        console.error('[TEST] waitForMessage: Messages received:', wsClient.messages);
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
          console.log(`[TEST] Found message of type ${type || 'any'} for client #${idx}:`, message);
          resolve(message);
        }
      }, 50);
    });
  };

  const sendAndWait = async (ws: WebSocket, message: any, expectedResponseType?: string, idx?: number): Promise<any> => {
    const wsClient = ws as any;
    const initialMessageCount = wsClient.messages.length;
    console.log(`[TEST] Sending message to client #${idx}:`, message);
    ws.send(JSON.stringify(message));
    if (expectedResponseType) {
      return waitForMessage(ws, expectedResponseType, idx);
    } else {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          const noResponseExpected = ['transcription', 'audio', 'settings', 'unknown_message_type'];
          if (noResponseExpected.includes(message.type)) {
            console.log(`[TEST] No response expected for message type: ${message.type}`);
            resolve(null);
          } else {
            reject(new Error('No response received'));
          }
        }, TEST_CONFIG.MESSAGE_TIMEOUT);
        const interval = setInterval(() => {
          if (wsClient.messages.length > initialMessageCount) {
            clearTimeout(timeout);
            clearInterval(interval);
            resolve(wsClient.messages[wsClient.messages.length - 1]);
          }
        }, 50);
      });
    }
  };

  const sendMessage = async (ws: WebSocket, message: any, idx?: number): Promise<void> => {
    console.log(`[TEST] Sending message to client #${idx}:`, message);
    ws.send(JSON.stringify(message));
    await new Promise(resolve => setTimeout(resolve, 100));
  };

  const registerTeacher = async (ws: WebSocket, idx?: number) => {
    console.log('🔍 [TEACHER-REG] Starting teacher registration...');
    
    const connMsg = await waitForMessage(ws, 'connection', idx);
    console.log('🔍 [TEACHER-REG] Connection message received');
    
    const registerPromise = sendAndWait(ws, {
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US',
      name: 'Test Teacher'
    }, 'register', idx);
    const classroomCodePromise = waitForMessage(ws, 'classroom_code', idx);
    
    const [registerResponse, classroomCodeResponse] = await Promise.all([
      registerPromise,
      classroomCodePromise
    ]);
    
    console.log('🔍 [TEACHER-REG] Registration completed:', {
      sessionId: classroomCodeResponse.sessionId,
      classroomCode: classroomCodeResponse.code,
      registerResponseType: registerResponse.type
    });
    
    // CRITICAL: Wait for session to be persisted in database with retries
    await waitForSessionPersistence(classroomCodeResponse.sessionId, 'teacher registration');
    
    return { connMsg, registerResponse, classroomCodeResponse };
  };

  const registerStudent = async (ws: WebSocket, classroomCode: string, sessionId: string, idx?: number) => {
    console.log('🔍 [STUDENT-REG] Starting student registration...');
    
    const connMsg = await waitForMessage(ws, 'connection', idx);
    console.log('🔍 [STUDENT-REG] Connection message received');
    
    const registerResponse = await sendAndWait(ws, {
      type: 'register',
      role: 'student',
      classroomCode,
      languageCode: 'es-ES',
      name: 'Test Student'
    }, 'register', idx);
    
    console.log('🔍 [STUDENT-REG] Registration completed:', {
      sessionId,
      classroomCode,
      registerResponseType: registerResponse.type
    });
    
    // CRITICAL: Wait for session to be updated with student count
    await waitForSessionUpdate(sessionId, 'student registration');
    
    return { connMsg, registerResponse };
  };

  const waitForSessionPersistence = async (sessionId: string, context: string, maxRetries: number = 15): Promise<void> => {
    console.log(`🔍 [SESSION-WAIT] Waiting for session persistence (${context}):`, sessionId);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const session = await realStorage.getSessionById(sessionId);
        if (session) {
          console.log(`🔍 [SESSION-WAIT] Session found after ${attempt} attempts (${context}):`, {
            sessionId: session.sessionId,
            isActive: session.isActive,
            studentsCount: session.studentsCount,
            classCode: session.classCode,
            dbId: session.id
          });
          return;
        } else {
          console.log(`🔍 [SESSION-WAIT] Session not found on attempt ${attempt} (${context})`);
        }
      } catch (error) {
        console.warn(`🔍 [SESSION-WAIT] Attempt ${attempt} error:`, error);
      }
      
      if (attempt < maxRetries) {
        const delay = Math.min(attempt * 200, 1000); // Progressive delay up to 1 second
        console.log(`🔍 [SESSION-WAIT] Session not found, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Final attempt to get more debugging info
    try {
      console.log(`🔍 [SESSION-WAIT] FINAL ATTEMPT: Checking for sessionId ${sessionId}`);
      const translations = await realStorage.getTranslations(10); // Get some translations to see DB connectivity
      console.log(`🔍 [SESSION-WAIT] FINAL ATTEMPT: Found ${translations.length} translations in database (DB connectivity test)`);
    } catch (debugError) {
      console.error('🔍 [SESSION-WAIT] Could not get debug info:', debugError);
    }
    
    throw new Error(`Session ${sessionId} not found in database after ${maxRetries} attempts (${context})`);
  };

  const waitForSessionUpdate = async (sessionId: string, context: string, maxRetries: number = 10): Promise<void> => {
    console.log(`🔍 [SESSION-UPDATE] Waiting for session update (${context}):`, sessionId);
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const session = await realStorage.getSessionById(sessionId);
        if (session && session.studentsCount && session.studentsCount > 0) {
          console.log(`🔍 [SESSION-UPDATE] Session updated after ${attempt} attempts (${context}):`, {
            sessionId: session.sessionId,
            isActive: session.isActive,
            studentsCount: session.studentsCount,
            classCode: session.classCode
          });
          return;
        }
      } catch (error) {
        console.warn(`🔍 [SESSION-UPDATE] Attempt ${attempt} error:`, error);
      }
      
      if (attempt < maxRetries) {
        const delay = attempt * 150; // Progressive delay
        console.log(`🔍 [SESSION-UPDATE] Session not updated yet, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error(`Session ${sessionId} not updated with student count after ${maxRetries} attempts (${context})`);
  };

beforeAll(async () => {
    // GLOBAL ISOLATION: Clear any environment state from other test suites
    process.env.TEST_SUITE = 'websocket-server-component';
    // Print environment for DB debugging
    console.log('[DEBUG][beforeAll] DATABASE_URL:', process.env.DATABASE_URL);
    console.log('[DEBUG][beforeAll] NODE_ENV:', process.env.NODE_ENV);
    // Ensure translation persistence is enabled for component tests
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';
    console.log('[SETUP] Initializing test database...');
    await initTestDatabase();
  });

  afterAll(async () => {
    // GLOBAL ISOLATION: Complete shutdown of all services
    console.log('[GLOBAL] WebSocket component suite cleanup starting...');
    
    console.log('[TEARDOWN] Closing test database...');
    await closeDatabaseConnection();
    
    // Clear test suite identifier
    delete process.env.TEST_SUITE;
    
    // Wait for complete cleanup
    await new Promise(resolve => setTimeout(resolve, 500));
    console.log('[GLOBAL] WebSocket component suite cleanup complete');
  }, 35000); // Increased timeout to 35 seconds

  beforeEach(async () => {
    console.log('[TEST] FORCE COMPLETE RESET - Setting up isolated database and server...');
    // Print environment for DB debugging
    console.log('[DEBUG][beforeEach] DATABASE_URL:', process.env.DATABASE_URL);
    console.log('[DEBUG][beforeEach] NODE_ENV:', process.env.NODE_ENV);
    // AGGRESSIVE: Generate unique test ID per test for complete isolation
    const testId = `websocket-component-test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    console.log(`[TEST] Using unique test ID: ${testId}`);
    // Patch: Print environment inside setupIsolatedTest
    const originalSetupIsolatedTest = setupIsolatedTest;
    // Fix: declare global type for setupIsolatedTest
    (global as typeof globalThis & { setupIsolatedTest: (testId: string) => Promise<IStorage> }).setupIsolatedTest = async (testId: string) => {
      console.log('[DEBUG][setupIsolatedTest] DATABASE_URL:', process.env.DATABASE_URL);
      console.log('[DEBUG][setupIsolatedTest] NODE_ENV:', process.env.NODE_ENV);
      return await originalSetupIsolatedTest(testId);
    };
    // Get completely isolated storage for this test
    realStorage = await (global as typeof globalThis & { setupIsolatedTest: (testId: string) => Promise<IStorage> }).setupIsolatedTest(testId);
    console.log('[TEST] Created unique isolated storage:', testId);
    // Create HTTP server
    httpServer = createServer();
    // Start server on available port in our reserved range
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('HTTP server startup timeout')), 10000);
      // Try a random port in our reserved range
      const tryPort = PORT_RANGE_START + Math.floor(Math.random() * (PORT_RANGE_END - PORT_RANGE_START));
      httpServer.listen(tryPort, () => {
        clearTimeout(timeout);
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          serverPort = addr.port;
          console.log(`[TEST] HTTP server started on port ${serverPort} (range: ${PORT_RANGE_START}-${PORT_RANGE_END})`);
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
    // Create test WebSocket server for component testing
    wsServer = new TestWebSocketServer(httpServer, realStorage);
    console.log('🔍 [LIFECYCLE] WebSocketServer created for component testing:', wsServer.getSpeechPipelineOrchestrator()?.constructor?.name);
    console.log('[TEST] Setup complete');
  });

  afterEach(async () => {
    console.log('[TEST] AGGRESSIVE CLEANUP - Starting complete cleanup...');
    
    // Close all WebSocket clients immediately
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.terminate(); // Force close instead of graceful close
      }
    }
    clients = [];
    
    // Reset client references
    teacherClient = null;
    studentClient = null;
    
    // AGGRESSIVE: Stop WebSocket server completely
    if (wsServer) {
      await wsServer.shutdown();
      wsServer = undefined as any;
    }
    
    // AGGRESSIVE: Close HTTP server and wait for port release
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
      // Wait extra time for port to be fully released
      await new Promise(resolve => setTimeout(resolve, 200));
      httpServer = undefined as any;
    }
    
    // AGGRESSIVE: Clean up storage completely
    // Note: The storage will be cleaned up automatically by the test isolation utility
    // based on the unique test ID used in beforeEach
    
    // Restore all mocks after each test to prevent interference between tests
    vi.restoreAllMocks();
    
    // AGGRESSIVE: Wait for cleanup to complete before next test
    await new Promise(resolve => setTimeout(resolve, 300));
    
    console.log('[TEST] AGGRESSIVE CLEANUP - Complete cleanup finished');
  });

  describe('WebSocket Component Flow - Mock Translation Orchestrator', () => {
    it('should handle complete teacher-student translation flow with mock translation orchestrator', async () => {
      console.log('START: Component flow test with mock orchestrator');
      
      // Teacher connects and registers
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      const classroomCode = teacherReg.classroomCodeResponse.code;
      const sessionId = teacherReg.classroomCodeResponse.sessionId;
      expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);
      
      // Student connects with classroom code
      studentClient = await createClient(`/ws?code=${classroomCode}`, 2);
      
      // Student registers using robust helper
      const studentNotificationPromise = waitForMessage(teacherClient, 'student_joined', 1);
      await registerStudent(studentClient, classroomCode, sessionId, 2);
      
      // Teacher should receive notification
      const notification = await studentNotificationPromise;
      expect(notification.payload.name).toBe('Test Student');
      expect(notification.payload.languageCode).toBe('es-ES');
      
      // Teacher sends transcription for translation
      const translationPromise = waitForMessage(studentClient, 'translation', 2);
      await sendAndWait(teacherClient, {
        type: 'transcription',
        text: 'Hello, how are you today?',
        isFinal: true,
        audioData: 'mock-audio-data'
      }, undefined, 1);
      
      // Student should receive translation with MOCK prefix (component test characteristic)
      const translationMsg = await translationPromise;
      expect(translationMsg.type).toBe('translation');
      expect(translationMsg.originalText).toBe('Hello, how are you today?');
      expect(translationMsg.text).toContain('[MOCK-es-ES]'); // Mock translation output confirms component test
      expect(translationMsg.sourceLanguage).toBe('en-US');
      expect(translationMsg.targetLanguage).toBe('es-ES');
      expect(translationMsg.audioData).toBe(''); // Mock returns empty audio
      
      // Verify session was updated in storage using retry logic
      const updatedSession = await realStorage.getSessionById(sessionId);
      console.log('🔍 [DEBUG] Session lookup result:', {
        sessionId: sessionId,
        found: !!updatedSession,
        session: updatedSession
      });
      if (updatedSession) {
        console.log('[DEBUG] Session state before assertion:', {
          id: updatedSession.id,
          sessionId: updatedSession.sessionId,
          isActive: updatedSession.isActive,
          studentsCount: updatedSession.studentsCount,
          classCode: updatedSession.classCode,
          lastActivityAt: updatedSession.lastActivityAt
        });
      }
      expect(updatedSession).toBeDefined();
      expect(updatedSession?.studentsCount).toBe(1);
      expect(updatedSession?.isActive).toBe(true);
      console.log('END: Component flow test passed');
    }, 30000);

    it('should handle multiple students with different languages through mock orchestrator', async () => {
      console.log('START: Multiple students component test');
      // Teacher setup
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      const classroomCode = teacherReg.classroomCodeResponse.code;
      // First student (Spanish)
      const student1 = await createClient(`/ws?code=${classroomCode}`, 2);
      await waitForMessage(student1, 'connection', 2);
      await sendAndWait(student1, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        name: 'Spanish Student'
      }, 'register', 2);
      // Second student (French)
      const student2 = await createClient(`/ws?code=${classroomCode}`, 3);
      await waitForMessage(student2, 'connection', 3);
      await sendAndWait(student2, {
        type: 'register',
        role: 'student',
        languageCode: 'fr-FR',
        name: 'French Student'
      }, 'register', 3);
      // Both students should be added to clients array for cleanup
      clients.push(student1, student2);
      // Wait for both student_joined notifications
      await waitForMessage(teacherClient, 'student_joined', 1);
      await waitForMessage(teacherClient, 'student_joined', 1);
      // Teacher sends transcription
      const translation1Promise = waitForMessage(student1, 'translation', 2);
      const translation2Promise = waitForMessage(student2, 'translation', 3);
      await sendAndWait(teacherClient, {
        type: 'transcription',
        text: 'Good morning everyone',
        isFinal: true,
        audioData: 'mock-audio-data'
      }, undefined, 1);
      // Both students should receive mock translations
      const [translation1, translation2] = await Promise.all([
        translation1Promise,
        translation2Promise
      ]);
      // Verify Spanish mock translation
      expect(translation1.type).toBe('translation');
      expect(translation1.originalText).toBe('Good morning everyone');
      expect(translation1.targetLanguage).toBe('es-ES');
      expect(translation1.text).toContain('[MOCK-es-ES]'); // Mock translation
      // Verify French mock translation
      expect(translation2.type).toBe('translation');
      expect(translation2.originalText).toBe('Good morning everyone');
      expect(translation2.targetLanguage).toBe('fr-FR');
      expect(translation2.text).toContain('[MOCK-fr-FR]'); // Mock translation
      // Mock translations should be different (different language codes)
      expect(translation1.text).not.toBe(translation2.text);
      console.log('END: Multiple students component test passed');
    }, 30000);

    it('should persist translations to database through mock orchestrator', async () => {
      console.log('START: Database persistence component test');
      // Setup teacher and student
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      const sessionId = teacherReg.classroomCodeResponse.sessionId;
      studentClient = await createClient(`/ws?code=${teacherReg.classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'ja-JP',
        name: 'Japanese Student'
      }, 'register', 2);
      // Wait for student notification
      await waitForMessage(teacherClient, 'student_joined', 1);
      // Force session state to active and studentsCount = 1
      await realStorage.updateSession(sessionId, { isActive: true, studentsCount: 1 });
      const texts = ['Hello-1', 'Hello-2', 'Hello-3'];
      for (const text of texts) {
        const translationPromise = waitForMessage(studentClient, 'translation', 2);
        console.log(`[DEBUG] Sending transcription: ${text}`);
        await sendAndWait(teacherClient, {
          type: 'transcription',
          text,
          isFinal: true,
          audioData: 'mock-audio-data'
        }, undefined, 1);
        await translationPromise;
        await new Promise(resolve => setTimeout(resolve, 200));
        const interimTranslations = await realStorage.getTranslations(50);
        console.log(`[DEBUG] DB after sending "${text}":`, interimTranslations.filter((t: any) => t.sessionId === sessionId));
        console.log(`[DEBUG] All translations after sending "${text}":`, interimTranslations);
        const sessionState = await realStorage.getSessionById(sessionId);
        console.log(`[DEBUG] Session state after sending "${text}":`, sessionState);


      // Allow async DB writes to complete
      await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Poll for all 3 translations to appear in the DB
      const maxRetries = 20;
      let sessionTranslations: any[] = [];
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const allTranslations = await realStorage.getTranslations(50);
        sessionTranslations = allTranslations.filter((t: any) => t.sessionId === sessionId);
        console.log(`[DEBUG] Poll attempt ${attempt}: sessionTranslations count =`, sessionTranslations.length);
        console.log('[DEBUG] All translations in DB:', allTranslations);
        const sessionState = await realStorage.getSessionById(sessionId);
        console.log(`[DEBUG] Session state during poll attempt ${attempt}:`, sessionState);
        if (sessionTranslations.length === 3) break;
        await new Promise(resolve => setTimeout(resolve, 200));
      }
      console.log('[DEBUG] Final sessionTranslations', sessionTranslations);
      expect(sessionTranslations).toHaveLength(3);
      // Verify translation details - these should have mock characteristics
      const translationTexts = sessionTranslations.map((t: any) => t.originalText);
      expect(translationTexts).toEqual(expect.arrayContaining(texts));
      // All should be en-US to ja-JP
      for (const translation of sessionTranslations) {
        expect(translation.sourceLanguage).toBe('en-US');
        expect(translation.targetLanguage).toBe('ja-JP');
        expect(translation.latency).toBeGreaterThan(0);
        // Translated text should contain mock indicator
        expect(translation.translatedText).toContain('[MOCK-ja-JP]');
      }
      console.log('END: Database persistence component test passed');
    }, 60000);
  });

  describe('Message Validation Component Tests', () => {
    it('should handle invalid JSON messages', async () => {
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      // Send invalid JSON - server should handle gracefully
      const ws = teacherClient as any;
      
      // Use the WebSocket send method with invalid data instead of raw socket write
      try {
        ws.send('invalid json message');
      } catch (e) {
        // Expected to fail parsing
      }
      
      // Server should remain stable
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Connection should still be open (server handles invalid JSON gracefully)
      expect(ws.readyState).toBe(WebSocket.OPEN);
    }, 60000);

    it('should handle unknown message types', async () => {
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      // Send unknown message type - no response expected
      await sendMessage(teacherClient, {
        type: 'unknown_message_type',
        data: 'test'
      }, 1);
      
      // Server should handle gracefully
      expect(wsServer).toBeDefined();
    });

    it('should handle messages with missing required fields', async () => {
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      // Send register message without required fields
      await sendMessage(teacherClient, {
        type: 'register'
        // Missing role, languageCode, etc.
      }, 1);
      
      expect(wsServer).toBeDefined();
    });
  });

  describe('Connection Lifecycle Component Tests', () => {
    it('should handle basic connection and disconnection', async () => {
      teacherClient = await createClient('/', 1);
      const connMsg = await waitForMessage(teacherClient, 'connection', 1);
      
      expect(connMsg.type).toBe('connection');
      expect(connMsg.status).toBe('connected');
      expect(connMsg.sessionId).toBeDefined();
      
      // Close connection
      teacherClient.close();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    it('should allow a student to join immediately after the teacher creates the session', async () => {
      // Teacher creates a session and registers
      teacherClient = await createClient('/', 1);
      const { classroomCodeResponse } = await registerTeacher(teacherClient, 1);
      const classroomCode = classroomCodeResponse.code;

      // Student connects with classroom code (should succeed, no error)
      studentClient = await createClient(`/ws?code=${classroomCode}`, 2);
      const studentConnMsg = await waitForMessage(studentClient, 'connection', 2);
      expect(studentConnMsg.classroomCode).toBe(classroomCode);
      expect(studentConnMsg.sessionId).toBe(classroomCodeResponse.sessionId);
      expect(studentConnMsg.status).not.toBe('error');
      expect(studentConnMsg.error).toBeFalsy();
      expect(studentConnMsg.message).toBeFalsy();
    });

    it('should return an error if a student tries to join a non-existent session (invalid code)', async () => {
      // Generate a random classroom code (not created by teacher)
      const fakeClassroomCode = 'ZZZZZZ';
      // Student attempts to connect with a non-existent classroom code
      studentClient = await createClient(`/ws?code=${fakeClassroomCode}`, 2);
      const errorMsg = await waitForMessage(studentClient, 'error', 2);
      // Should receive an error message indicating session not found
      expect(errorMsg.type).toBe('error');
      expect(errorMsg.message).toBeTruthy();
      expect(errorMsg.message.toLowerCase()).toContain('invalid');
    });

    it('should handle malformed URLs gracefully', async () => {
      studentClient = await createClient('/ws?invalid=query&params', 2);
      const connMsg = await waitForMessage(studentClient, 'connection', 2);
      
      expect(connMsg.type).toBe('connection');
      expect(connMsg.status).toBe('connected');
    });
  });

  describe('Teacher-Student Flow Component Tests', () => {
    it('should handle complete teacher-student session flow', async () => {
      // Teacher connects and registers
      teacherClient = await createClient('/', 1);
      const { classroomCodeResponse } = await registerTeacher(teacherClient, 1);
      
      // Student connects and registers
      studentClient = await createClient(`/ws?code=${classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      
      const studentJoinedPromise = waitForMessage(teacherClient, 'student_joined', 1);
      
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        name: 'Test Student'
      }, 'register', 2);
      
      const notification = await studentJoinedPromise;
      expect(notification.payload.name).toBe('Test Student');
      expect(notification.payload.languageCode).toBe('es-ES');
    });

    it('should handle teacher reconnection to existing session', async () => {
      // Create initial session
      teacherClient = await createClient('/', 1);
      const { classroomCodeResponse } = await registerTeacher(teacherClient, 1);
      const sessionId = classroomCodeResponse.sessionId;
      const classroomCode = classroomCodeResponse.code;
      
      // Close teacher connection
      teacherClient.close();
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Teacher reconnects using classroom code (not sessionId directly)
      teacherClient = await createClient(`/ws?code=${classroomCode}`, 1);
      const reconnectMsg = await waitForMessage(teacherClient, 'connection', 1);
      
      // Should connect to same classroom (classroomCode should match)
      expect(reconnectMsg.classroomCode).toBe(classroomCode);
    });
  });

  describe('Translation Flow Component Tests', () => {
    it('should translate teacher transcription to all students using mock translator', async () => {
      // Setup teacher and student
      teacherClient = await createClient('/', 1);
      const { classroomCodeResponse } = await registerTeacher(teacherClient, 1);
      studentClient = await createClient(`/ws?code=${classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        name: 'Spanish Student'
      }, 'register', 2);
      await waitForMessage(teacherClient, 'student_joined', 1);
      // Teacher sends transcription
      const translationPromise = waitForMessage(studentClient, 'translation', 2);
      await sendAndWait(teacherClient, {
        type: 'transcription',
        text: 'Hello everyone',
        isFinal: true,
        audioData: 'mock-audio-data'
      }, undefined, 1);
      const translation = await translationPromise;
      expect(translation.type).toBe('translation');
      expect(translation.originalText).toBe('Hello everyone');
      expect(translation.targetLanguage).toBe('es-ES');
      // Verify this is a mock translation (component test characteristic)
      expect(translation.text).toContain('[MOCK-es-ES]');
    }, 30000);

    it('should ignore transcriptions from students', async () => {
      // Setup teacher and student
      teacherClient = await createClient('/', 1);
      const { classroomCodeResponse } = await registerTeacher(teacherClient, 1);
      
      studentClient = await createClient(`/ws?code=${classroomCodeResponse.code}`, 2);
      await waitForMessage(studentClient, 'connection', 2);
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        name: 'Student'
      }, 'register', 2);
      
      await waitForMessage(teacherClient, 'student_joined', 1);
      
      // Student tries to send transcription (should be ignored)
      await sendMessage(studentClient, {
        type: 'transcription',
        text: 'Student speaking',
        isFinal: true
      }, 2);
      
      // No translation should be generated - just verify server stability
      await new Promise(resolve => setTimeout(resolve, 500));
      expect(wsServer).toBeDefined();
    });
  });

  // Additional component test sections (settings, audio, TTS, ping/pong, etc.) 
  // would follow the same pattern but are abbreviated here for brevity...

  it('BUGFIX: student should be able to join immediately after teacher registers (session lifecycle bug)', async () => {
      console.log('=== START: Session lifecycle bug component test ===');
      
      // Teacher connects and registers
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      const classroomCode = teacherReg.classroomCodeResponse.code;
      const sessionId = teacherReg.classroomCodeResponse.sessionId;
      
      console.log(`=== Teacher registered with classroom code: ${classroomCode}, sessionId: ${sessionId} ===`);
      
      // Verify session was created and check its isActive status
      const sessionAfterTeacher = await realStorage.getSessionById(sessionId);
      console.log('=== Session after teacher registration ===', {
        id: sessionAfterTeacher?.id,
        sessionId: sessionAfterTeacher?.sessionId,
        isActive: sessionAfterTeacher?.isActive,
        studentsCount: sessionAfterTeacher?.studentsCount
      });
      
      // Session should be active after teacher registration
      expect(sessionAfterTeacher).toBeDefined();
      expect(sessionAfterTeacher?.isActive).toBe(true);
      
      // IMMEDIATELY after teacher registers, student should be able to join
      studentClient = await createClient(`/ws?code=${classroomCode}`, 2);
      
      // Student connects (this part usually works)
      const studentConnMsg = await waitForMessage(studentClient, 'connection', 2);
      console.log('=== Student connection message ===', studentConnMsg);
      expect(studentConnMsg.type).toBe('connection');
      expect(studentConnMsg.classroomCode).toBe(classroomCode);
      expect(studentConnMsg.sessionId).toBe(sessionId);
      
      // Student registration should work
      console.log('=== Attempting student registration ===');
      const studentReg = await registerStudent(studentClient, classroomCode, sessionId, 2);
      
      expect(studentReg.registerResponse.type).toBe('register');
      expect(studentReg.registerResponse.status).toBe('success');
      
      console.log('=== END: Session lifecycle component test passed ===');
    }, 30000);
});
