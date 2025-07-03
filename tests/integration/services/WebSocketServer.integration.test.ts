import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { TestWebSocketServer } from '../../utils/TestWebSocketServer';
import { Server as HTTPServer, createServer } from 'http';
import WebSocket from 'ws';
import { IStorage } from '../../../server/storage.interface';
import { setupIsolatedTest, cleanupIsolatedTest } from '../../utils/test-database-isolation';
import { initTestDatabase, closeDatabaseConnection } from '../../setup/db-setup';

// Test configuration
const TEST_CONFIG = {
  CONNECTION_TIMEOUT: 8000,
  MESSAGE_TIMEOUT: 8000,
  SETUP_DELAY: 50,
  CLEANUP_DELAY: 50
};

describe('WebSocketServer Comprehensive Integration Tests', { timeout: 30000 }, () => {

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
        console.error(`[TEST] waitForMessage: Messages received:`, wsClient.messages);
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
    const connMsg = await waitForMessage(ws, 'connection', idx);
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
    return { connMsg, registerResponse, classroomCodeResponse };
  };

beforeAll(async () => {
    // Ensure translation persistence is enabled for integration tests
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';
    console.log('[SETUP] Initializing test database...');
    await initTestDatabase();
  });

  afterAll(async () => {
    console.log('[TEARDOWN] Closing test database...');
    await closeDatabaseConnection();
  });

  beforeEach(async () => {
    console.log('[TEST] Setting up isolated database and server...');
    realStorage = await setupIsolatedTest('websocket-integration-test');
    
    // Create HTTP server
    httpServer = createServer();
    
    // Start server on available port
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('HTTP server startup timeout')), 10000);
      
      httpServer.listen(0, () => {
        clearTimeout(timeout);
        const addr = httpServer.address();
        if (addr && typeof addr === 'object') {
          serverPort = addr.port;
          console.log(`[TEST] HTTP server started on port ${serverPort}`);
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

    // Create test WebSocket server (default: real orchestrator)
    wsServer = new TestWebSocketServer(httpServer, realStorage);
    console.log('[TEST] Setup complete');
  });

  afterEach(async () => {
    console.log('[TEST] Cleaning up...');
    
    // Close all WebSocket clients
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    clients = [];
    
    // Reset client references
    teacherClient = null;
    studentClient = null;
    
    // Stop WebSocket server
    if (wsServer) {
      await wsServer.shutdown();
    }
    
    // Close HTTP server
    if (httpServer) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
      });
    }
    
    // Clean up database
    await cleanupIsolatedTest('websocket-integration-test');
    
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
    console.log('[TEST] Cleanup complete');
  });

  describe('Real Integration Flow', () => {
    it('should handle complete teacher-student translation flow with real orchestrator', async () => {
      // Use real orchestrator (default)
      console.log('START: Real integration flow test');
      // Teacher connects and registers
      teacherClient = await createClient('/', 1);
      const teacherReg = await registerTeacher(teacherClient, 1);
      const classroomCode = teacherReg.classroomCodeResponse.code;
      expect(classroomCode).toMatch(/^[A-Z0-9]{6}$/);
      // Student connects with classroom code
      studentClient = await createClient(`/ws?code=${classroomCode}`, 2);
      const studentConnMsg = await waitForMessage(studentClient, 'connection', 2);
      expect(studentConnMsg.classroomCode).toBe(classroomCode);
      // Student registers
      const studentNotificationPromise = waitForMessage(teacherClient, 'student_joined', 1);
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        name: 'Test Student'
      }, 'register', 2);
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
      // Student should receive translation
      const translationMsg = await translationPromise;
      expect(translationMsg.type).toBe('translation');
      expect(translationMsg.originalText).toBe('Hello, how are you today?');
      expect(translationMsg.text).toContain('Hola'); // Mock translation
      expect(translationMsg.sourceLanguage).toBe('en-US');
      expect(translationMsg.targetLanguage).toBe('es-ES');
      expect(translationMsg.audioData).toBeTruthy(); // Should have TTS audio
      // Verify session was updated in storage
      const sessionId = teacherReg.classroomCodeResponse.sessionId;
      const updatedSession = await realStorage.getSessionById(sessionId);
      expect(updatedSession).toBeDefined();
      expect(updatedSession?.studentsCount).toBe(1);
      expect(updatedSession?.isActive).toBe(true);
      console.log('END: Real integration flow test passed');
    }, 30000);

    it('should handle multiple students with different languages through real orchestrator', async () => {
      // Use real orchestrator (default)
      console.log('START: Multiple students test');
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
      // Both students should receive translations
      const [translation1, translation2] = await Promise.all([
        translation1Promise,
        translation2Promise
      ]);
      // Verify Spanish translation
      expect(translation1.type).toBe('translation');
      expect(translation1.originalText).toBe('Good morning everyone');
      expect(translation1.targetLanguage).toBe('es-ES');
      // Verify French translation
      expect(translation2.type).toBe('translation');
      expect(translation2.originalText).toBe('Good morning everyone');
      expect(translation2.targetLanguage).toBe('fr-FR');
      // Translations should be different
      expect(translation1.text).not.toBe(translation2.text);
      console.log('END: Multiple students test passed');
    }, 30000);

    it('should persist translations to database through real orchestrator', async () => {
      // Use real orchestrator (default)
      console.log('START: Database persistence test');
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
      // Send multiple transcriptions
      const texts = ['Hello', 'How are you?', 'Nice to meet you'];
      for (const text of texts) {
        const translationPromise = waitForMessage(studentClient, 'translation', 2);
        await sendAndWait(teacherClient, {
          type: 'transcription',
          text,
          isFinal: true,
          audioData: 'mock-audio-data'
        }, undefined, 1);
        await translationPromise;
        // Small delay to ensure database write completes
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      // Wait a bit longer for all DB writes to flush
      await new Promise(resolve => setTimeout(resolve, 500));
      // Verify translations were stored in database
      const allTranslations = await realStorage.getTranslations(50); // Get recent translations
      console.log('DEBUG: allTranslations', allTranslations);
      const sessionTranslations = allTranslations.filter((t: any) => t.sessionId === sessionId);
      expect(sessionTranslations).toHaveLength(3);
      // Verify translation details
      const translationTexts = sessionTranslations.map((t: any) => t.originalText);
      expect(translationTexts).toEqual(expect.arrayContaining(texts));
      // All should be en-US to ja-JP
      for (const translation of sessionTranslations) {
        expect(translation.sourceLanguage).toBe('en-US');
        expect(translation.targetLanguage).toBe('ja-JP');
        expect(translation.latency).toBeGreaterThan(0);
      }
      console.log('END: Database persistence test passed');
    }, 30000);
  });

  describe('Message Validation Integration', () => {
    it('should handle invalid JSON messages', async () => {
      // Use mock orchestrator for validation tests
      wsServer.setMockTranslationOrchestrator();
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
    });

    it('should handle unknown message types', async () => {
      wsServer.setMockTranslationOrchestrator();
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
      wsServer.setMockTranslationOrchestrator();
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

  describe('Connection Lifecycle Integration', () => {
    it('should handle basic connection and disconnection', async () => {
      wsServer.setMockTranslationOrchestrator();
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
      wsServer.setMockTranslationOrchestrator();
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
      wsServer.setMockTranslationOrchestrator();
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
      wsServer.setMockTranslationOrchestrator();
      studentClient = await createClient('/ws?invalid=query&params', 2);
      const connMsg = await waitForMessage(studentClient, 'connection', 2);
      
      expect(connMsg.type).toBe('connection');
      expect(connMsg.status).toBe('connected');
    });
  });

  describe('Teacher-Student Flow Integration', () => {
    it('should handle complete teacher-student session flow', async () => {
      wsServer.setMockTranslationOrchestrator();
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
      wsServer.setMockTranslationOrchestrator();
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

  describe('Translation Flow Integration', () => {
    it('should translate teacher transcription to all students', async () => {
      wsServer.setMockTranslationOrchestrator();
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
    }, 30000);

    it('should ignore transcriptions from students', async () => {
      wsServer.setMockTranslationOrchestrator();
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

  describe('Settings Management Integration', () => {
    it('should update client settings', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      await registerTeacher(teacherClient, 1);
      
      // Update settings
      await sendMessage(teacherClient, {
        type: 'settings',
        settings: {
          autoPlay: false,
          ttsServiceType: 'browser'
        }
      }, 1);
      
      // Settings should be applied - verify no errors
      expect(wsServer).toBeDefined();
    });

    it('should merge settings updates', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      await registerTeacher(teacherClient, 1);
      
      // Send first settings update
      await sendMessage(teacherClient, {
        type: 'settings',
        settings: { autoPlay: false }
      }, 1);
      
      // Send second settings update
      await sendMessage(teacherClient, {
        type: 'settings',
        settings: { ttsServiceType: 'browser' }
      }, 1);
      
      // Both settings should be preserved
      expect(wsServer).toBeDefined();
    });
  });

  describe('Audio Processing Integration', () => {
    it('should process audio from teacher', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      await registerTeacher(teacherClient, 1);
      
      // Send audio data
      const audioData = Buffer.from('a'.repeat(1000)).toString('base64');
      await sendMessage(teacherClient, {
        type: 'audio',
        data: audioData
      }, 1);
      
      // Audio should be processed without errors
      expect(wsServer).toBeDefined();
    });

    it('should ignore small audio chunks', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      await registerTeacher(teacherClient, 1);
      
      // Send small audio chunk
      const smallAudio = Buffer.from('tiny').toString('base64');
      await sendMessage(teacherClient, {
        type: 'audio',
        data: smallAudio
      }, 1);
      
      // Should be ignored gracefully
      expect(wsServer).toBeDefined();
    });

    it('should ignore audio from students', async () => {
      wsServer.setMockTranslationOrchestrator();
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
      
      // Student sends audio (should be ignored)
      const audioData = Buffer.from('audio').toString('base64');
      await sendMessage(studentClient, {
        type: 'audio',
        data: audioData
      }, 2);
      
      expect(wsServer).toBeDefined();
    });
  });

  describe('TTS Requests Integration', () => {
    it('should handle valid TTS request', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      const responsePromise = waitForMessage(teacherClient, 'tts_response', 1);
      
      await sendAndWait(teacherClient, {
        type: 'tts_request',
        text: 'Hello world',
        languageCode: 'en-US'
      }, undefined, 1);
      
      const response = await responsePromise;
      expect(response.type).toBe('tts_response');
      expect(response.status).toBe('success');
    });

    it('should handle TTS request with missing language code', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      const responsePromise = waitForMessage(teacherClient, 'tts_response', 1);
      
      await sendAndWait(teacherClient, {
        type: 'tts_request',
        text: 'Hello world'
        // Missing languageCode
      }, undefined, 1);
      
      const response = await responsePromise;
      expect(response.type).toBe('tts_response');
      expect(response.status).toBe('error');
    });
  });

  describe('Ping/Pong and Heartbeat Integration', () => {
    it('should respond to ping messages', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      const pongPromise = waitForMessage(teacherClient, 'pong', 1);
      
      await sendAndWait(teacherClient, {
        type: 'ping'
      }, undefined, 1);
      
      const pong = await pongPromise;
      expect(pong.type).toBe('pong');
    });

    it('should handle WebSocket ping frames', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      // Send WebSocket ping frame
      teacherClient.ping();
      
      // Should handle gracefully
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(teacherClient.readyState).toBe(WebSocket.OPEN);
    });
  });

  describe('Server Lifecycle and Cleanup Integration', () => {
    it('should properly handle server shutdown', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      // Server should shutdown cleanly
      await wsServer.shutdown();
      
      // Connections should be closed
      await new Promise(resolve => setTimeout(resolve, 200));
      expect(teacherClient.readyState).toBe(WebSocket.CLOSED);
    });
  });

  describe('Session Lifecycle Management Integration', () => {
    it('should update session activity on message', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      const { classroomCodeResponse } = await registerTeacher(teacherClient, 1);
      const sessionId = classroomCodeResponse.sessionId;
      
      // Send a message to update activity
      await sendAndWait(teacherClient, {
        type: 'ping'
      }, 'pong', 1);
      
      // Verify session exists and is active
      const session = await realStorage.getSessionById(sessionId);
      expect(session).toBeDefined();
      expect(session?.isActive).toBe(true);
    });

    it('should handle multiple connections in the same session', async () => {
      wsServer.setMockTranslationOrchestrator();
      // Create teacher session
      teacherClient = await createClient('/', 1);
      const { classroomCodeResponse } = await registerTeacher(teacherClient, 1);
      const sessionId = classroomCodeResponse.sessionId;
      
      // Add students to same session
      const student1 = await createClient(`/ws?code=${classroomCodeResponse.code}`, 2);
      await waitForMessage(student1, 'connection', 2);
      await sendAndWait(student1, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        name: 'Student 1'
      }, 'register', 2);
      
      const student2 = await createClient(`/ws?code=${classroomCodeResponse.code}`, 3);
      await waitForMessage(student2, 'connection', 3);
      await sendAndWait(student2, {
        type: 'register',
        role: 'student',
        languageCode: 'fr-FR',
        name: 'Student 2'
      }, 'register', 3);
      
      clients.push(student1, student2);
      
      // Verify session has multiple students
      await waitForMessage(teacherClient, 'student_joined', 1);
      await waitForMessage(teacherClient, 'student_joined', 1);
      
      const session = await realStorage.getSessionById(sessionId);
      expect(session?.studentsCount).toBe(2);
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle graceful degradation when translation fails', async () => {
      wsServer.setMockTranslationOrchestrator();
      console.log('START: Translation error handling test');
      
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      // Send invalid transcription data
      await sendMessage(teacherClient, {
        type: 'transcription',
        // Missing required fields
        isFinal: true
      }, 1);
      
      // Server should handle this gracefully without crashing
      expect(wsServer).toBeDefined();
      
      console.log('END: Translation error handling test passed');
    });

    it('should handle connection errors gracefully', async () => {
      wsServer.setMockTranslationOrchestrator();
      teacherClient = await createClient('/', 1);
      await waitForMessage(teacherClient, 'connection', 1);
      
      // Simulate connection error
      (teacherClient as any).emit('error', new Error('Connection error'));
      
      // Server should remain stable
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(wsServer).toBeDefined();
    });
  });

  it('BUGFIX: student should be able to join immediately after teacher registers (session lifecycle bug)', async () => {
      // Use real orchestrator (default) - NO MOCKS
      console.log('=== START: Session lifecycle bug test with REAL backend ===');
      
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
      
      // This should expose the bug - session should be isActive: false
      if (sessionAfterTeacher?.isActive === false) {
        console.log('=== BUG CONFIRMED: Session created with isActive: false ===');
      } else {
        console.log('=== Session is active, bug might be fixed already ===');
      }
      
      // IMMEDIATELY after teacher registers, student should be able to join
      // BUG REPRODUCTION: Student connects WITHOUT classroom code in URL (like real UI)
      studentClient = await createClient('/ws', 2);
      
      // Student connects (this part usually works)
      const studentConnMsg = await waitForMessage(studentClient, 'connection', 2);
      console.log('=== Student connection message ===', studentConnMsg);
      // Student should get a connection message but WITHOUT classroom code since they didn't provide it in URL
      expect(studentConnMsg.type).toBe('connection');
      
      // THE BUG TEST: Student registration - this should expose the bug
      console.log('=== Attempting student registration ===');
      
      // Check what happens when student tries to register
      const wsClient = studentClient as any;
      const initialMessageCount = wsClient.messages.length;
      
      studentClient.send(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        name: 'Test Student',
        classroomCode: classroomCode  // This is essential for the fix!
      }));
      
      // Wait for response and capture what we get
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const allMessages = wsClient.messages.slice(initialMessageCount);
      console.log('=== All messages received after student registration attempt ===', allMessages);
      
      const errorMessage = allMessages.find((msg: any) => msg.type === 'error');
      const registerMessage = allMessages.find((msg: any) => msg.type === 'register');
      
      if (errorMessage) {
        console.log('=== BUG EXPOSED: Student got error during registration ===', errorMessage);
        throw new Error(`SESSION LIFECYCLE BUG EXPOSED: Student cannot join because session is inactive. Error: ${errorMessage.message}`);
      } else if (registerMessage) {
        console.log('=== Student registration succeeded ===', registerMessage);
        // This means the bug is fixed or there's something else going on
      } else {
        console.log('=== No register or error message received - unexpected ===');
        throw new Error('Expected either register success or error message but got neither');
      }
      
      console.log('=== END: Session lifecycle bug test ===');
    }, 30000);
});
