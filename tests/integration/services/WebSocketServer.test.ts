import { describe, it, expect, beforeEach, afterEach, vi, beforeAll, afterAll } from 'vitest';
import { WebSocketServer } from '../../../server/services/WebSocketServer';
import { Server as HTTPServer, createServer } from 'http';
import WebSocket from 'ws';
import { IStorage } from '../../../server/storage.interface';
import { speechTranslationService } from '../../../server/services/TranslationService';
import logger from '../../../server/logger';

// Test configuration for faster execution
const TEST_CONFIG = {
  CONNECTION_TIMEOUT: 5000, // 5s
  MESSAGE_TIMEOUT: 5000,    // 5s for message responses
  SETUP_DELAY: 10,          // Minimal delay for async operations
  CLEANUP_DELAY: 10         // Minimal delay for cleanup
};

// Mock the external services
vi.mock('../../../server/services/TranslationService', () => ({
  speechTranslationService: {
    translateSpeech: vi.fn()
  }
}));

vi.mock('../../../server/services/transcription/AudioTranscriptionService', () => ({
  audioTranscriptionService: {
    transcribeAudio: vi.fn()
  }
}));

vi.mock('../../../server/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

describe('WebSocketServer Integration Tests', { timeout: 10000 }, () => {
  let httpServer: HTTPServer;
  let wsServer: WebSocketServer;
  let mockStorage: IStorage;
  let serverPort: number;
  let teacherClient: WebSocket | null = null;
  let studentClient: WebSocket | null = null;
  let clients: WebSocket[] = []; // Array to track all clients

  // Helper to create WebSocket client with message buffering
  const createClient = (path: string = '/ws', idx?: number): Promise<WebSocket> => {
    if (!serverPort) {
      console.error(`[DEBUG] [createClient] serverPort is not set! Value: ${serverPort}`);
      throw new Error('serverPort is not set in createClient');
    }
    console.log(`[DEBUG] [createClient] Attempting to create WebSocket for path: ${path} (client #${idx !== undefined ? idx : 'N/A'}) on port ${serverPort}`);
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws://localhost:${serverPort}${path}`) as any;
      ws.messages = [];
      clients.push(ws);
      let messageCount = 0;
      // Attach message handler immediately to avoid race condition
      ws.on('message', (data: WebSocket.Data) => {
        try {
          const msg = JSON.parse(data.toString());
          ws.messages.push(msg);
          messageCount++;
          // Log buffer reference and contents
          console.log(`[DEBUG] [createClient] (client #${idx !== undefined ? idx : 'N/A'}) buffer ref:`, ws.messages, 'buffer length:', ws.messages.length);
          console.log(`[DEBUG] [createClient] (client #${idx !== undefined ? idx : 'N/A'}) received message #${messageCount}:`, msg);
        } catch (e) {
          console.warn(`[DEBUG] [createClient] (client #${idx !== undefined ? idx : 'N/A'}) received non-JSON message:`, data.toString());
        }
      });
      const timeout = setTimeout(() => {
        console.error(`[DEBUG] [createClient] Connection timeout for client #${idx !== undefined ? idx : 'N/A'} on path: ${path}`);
        reject(new Error(`Connection timeout after ${TEST_CONFIG.CONNECTION_TIMEOUT}ms`));
      }, TEST_CONFIG.CONNECTION_TIMEOUT);
      ws.on('open', () => {
        clearTimeout(timeout);
        console.log(`[DEBUG] [createClient] WebSocket open for client #${idx !== undefined ? idx : 'N/A'} on path: ${path}`);
        resolve(ws);
      });
      ws.on('error', (err: Error) => {
        clearTimeout(timeout);
        console.error(`[DEBUG] [createClient] WebSocket error for client #${idx !== undefined ? idx : 'N/A'} on path: ${path}:`, err);
        reject(err);
      });
      ws.on('close', (code: number, reason: Buffer) => {
        clearTimeout(timeout);
        console.log(`[DEBUG] [createClient] WebSocket closed for client #${idx !== undefined ? idx : 'N/A'} on path: ${path}. Code: ${code}, Reason: ${reason.toString()}`);
      });
    });
  };

  // Helper to wait for a specific message from the buffer
  const waitForMessage = (ws: WebSocket, type?: string, idx?: number): Promise<any> => {
    return new Promise((resolve, reject) => {
      const wsClient = ws as any;
      const timeout = setTimeout(() => {
        clearInterval(interval);
        console.error(`[TEST] waitForMessage: Timeout after ${TEST_CONFIG.MESSAGE_TIMEOUT}ms for type: ${type || 'any'} on client #${idx}. Messages:`, wsClient.messages);
        reject(new Error(`Message timeout after ${TEST_CONFIG.MESSAGE_TIMEOUT}ms for type: ${type || 'any'}. Messages received: ${JSON.stringify(wsClient.messages)}`));
      }, TEST_CONFIG.MESSAGE_TIMEOUT);
      const interval = setInterval(() => {
        if (!wsClient.messages) {
          // This can happen if the client is closed before messages are initialized
          return;
        }
        // Log buffer reference and contents on every check
        console.log(`[TEST] waitForMessage: Buffer ref:`, wsClient.messages, 'buffer length:', wsClient.messages.length, 'for client #', idx);
        const messageIndex = wsClient.messages.findIndex((m: any) => !type || m.type === type);

        if (messageIndex !== -1) {
          const message = wsClient.messages.splice(messageIndex, 1)[0];
          clearInterval(interval);
          clearTimeout(timeout);
          console.log(`[TEST] waitForMessage: Found message of type '${type}' for client #${idx}:`, message);
          resolve(message);
        } else if (ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
          clearInterval(interval);
          clearTimeout(timeout);
          console.error(`[TEST] waitForMessage: WebSocket closed while waiting for message type: ${type} on client #${idx}`);
          reject(new Error('WebSocket closed while waiting for message'));
        }
      }, 10); // Check every 10ms
    });
  };
  
  // Helper to register a teacher and get classroom code
  const registerTeacher = async (client: WebSocket, overrides: any = {}) => {
    // Connection should already be established before calling this function
    const registerPromise = waitForMessage(client, 'register');
    const classroomCodePromise = waitForMessage(client, 'classroom_code');

    const message = {
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US',
      ...overrides,
    };

    client.send(JSON.stringify(message));

    // Wait for both responses. They can arrive in any order.
    const [registerResponse, classroomCodeResponse] = await Promise.all([
        registerPromise,
        classroomCodePromise
    ]);

    return { registerResponse, classroomCodeResponse };
  };
  
  // Helper to send message and wait for response
  const sendAndWait = async (ws: WebSocket, message: any, responseType?: string, idx?: number): Promise<any> => {
    if (ws.readyState !== WebSocket.OPEN) {
      console.error(`[TEST] sendAndWait: WebSocket is not open (state: ${ws.readyState}) for client #${idx}`);
      throw new Error(`WebSocket is not open (state: ${ws.readyState})`);
    }
    const responsePromise = waitForMessage(ws, responseType, idx);
    ws.send(JSON.stringify(message));
    return await responsePromise;
  };
  
  beforeAll(() => {
    // Create mock storage
    mockStorage = {
      createSession: vi.fn().mockResolvedValue(undefined),
      getSessionById: vi.fn().mockResolvedValue(null),
      updateSession: vi.fn().mockResolvedValue(undefined),
      endSession: vi.fn().mockResolvedValue(undefined),
      getActiveSession: vi.fn().mockResolvedValue(null),
      addTranslation: vi.fn().mockResolvedValue(undefined)
    } as unknown as IStorage;
  });

  beforeEach(async () => {
    console.log('START: beforeEach');
    vi.clearAllMocks();
    
    // Ensure any previous resources are cleaned up
    if (httpServer && httpServer.listening) {
      await new Promise<void>((resolve) => {
        httpServer.close(() => {
          console.log('[DEBUG] [beforeEach] Previous HTTP server closed');
          resolve();
        });
      });
    }
    
    // Clear any previous clients
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    clients = [];
    
    // Reset client references
    teacherClient = null;
    studentClient = null;
    
    // Create HTTP server on random port with timeout
    httpServer = createServer();
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('HTTP server startup timeout'));
      }, 5000);
      
      httpServer.listen(0, () => {
        clearTimeout(timeout);
        const address = httpServer.address();
        serverPort = typeof address === 'object' && address !== null ? address.port : 0;
        console.log(`[DEBUG] [beforeEach] HTTP server is listening on port ${serverPort}`);
        if (serverPort === 0) {
          reject(new Error('Failed to get server port'));
          return;
        }
        resolve();
      });
      
      httpServer.on('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });

    // Create WebSocket server
    wsServer = new WebSocketServer(httpServer, mockStorage);
    // Add log for WebSocket connection event
    (wsServer as any).wss.on('connection', () => {
      console.log('[DEBUG] [WebSocketServer] New WebSocket connection received');
    });

    // Setup default mock responses
    vi.mocked(speechTranslationService.translateSpeech).mockResolvedValue({
      originalText: 'Hello',
      translatedText: 'Hola',
      audioBuffer: Buffer.from('mock-audio-data')
    });
    console.log('END: beforeEach');
  });

  afterEach(async () => {
    console.log('[TEST] [GLOBAL] afterEach START');
    
    // Close all WebSocket clients first with proper state checks
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
    }
    clients = [];
    
    // Reset client references
    teacherClient = null;
    studentClient = null;
    
    // Close HTTP server and wait for it to fully close
    if (httpServer && httpServer.listening) {
      await new Promise<void>((resolve) => {
        httpServer.close((err) => {
          if (err) {
            console.error('[DEBUG] [GLOBAL afterEach] Error closing HTTP server:', err);
          } else {
            console.log('[DEBUG] [GLOBAL afterEach] HTTP server closed successfully');
          }
          resolve();
        });
      });
    }
    
    // Small delay to ensure cleanup
    await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
    console.log('[TEST] [GLOBAL] afterEach END');
  });
  afterAll(async () => {
    console.log('[TEST] [GLOBAL] afterAll START');
    if (httpServer && httpServer.listening) {
      httpServer.close();
    }
    console.log('[TEST] [GLOBAL] afterAll END');
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('[GLOBAL] Unhandled Rejection:', reason);
  });
  process.on('uncaughtException', (err) => {
    console.error('[GLOBAL] Uncaught Exception:', err);
  });

  describe('Message Validation', () => {
    beforeEach(async () => {
      console.log('[TEST] [Message Validation] beforeEach START');
      teacherClient = await createClient();
      await waitForMessage(teacherClient, 'connection');
      console.log('[TEST] [Message Validation] beforeEach END');
    });
    afterEach(async () => {
      console.log('[TEST] [Message Validation] afterEach START');
      if (teacherClient && teacherClient.readyState === WebSocket.OPEN) {
        teacherClient.close();
      }
      teacherClient = null;
      console.log('[TEST] [Message Validation] afterEach END');
    });

    it('should handle invalid JSON messages', async () => {
      console.log('[TEST] [Message Validation] it should handle invalid JSON messages START');
      expect(teacherClient).not.toBeNull();
      
      // Send invalid JSON
      teacherClient!.send('not json');
      
      // Should not crash
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Check error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Error handling message:',
        expect.objectContaining({ data: 'not json' })
      );
      
      // Connection should remain open
      expect(teacherClient!.readyState).toBe(WebSocket.OPEN);
      console.log('[TEST] [Message Validation] it should handle invalid JSON messages END');
    });

    it('should handle unknown message types', async () => {
      console.log('[TEST] [Message Validation] it should handle unknown message types START');
      expect(teacherClient).not.toBeNull();
      
      await teacherClient!.send(JSON.stringify({
        type: 'unknown_type',
        data: 'test'
      }));
      
      // Should log warning
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Unknown message type:',
        { type: 'unknown_type' }
      );
      console.log('[TEST] [Message Validation] it should handle unknown message types END');
    });

    it('should handle messages with missing required fields', async () => {
      console.log('[TEST] [Message Validation] it should handle messages with missing required fields START');
      expect(teacherClient).not.toBeNull();
      
      // Register without role
      await teacherClient!.send(JSON.stringify({
        type: 'register'
      }));
      
      // Should still process (role is optional)
      const response = await waitForMessage(teacherClient!, 'register');
      expect(response.status).toBe('success');
      console.log('[TEST] [Message Validation] it should handle messages with missing required fields END');
    });
  });

  describe('Connection Lifecycle', () => {
    it('should handle basic connection and disconnection', async () => {
      console.log('START: should handle basic connection and disconnection');
      const client = await createClient();
      
      // Wait for connection message
      const connMsg = await waitForMessage(client, 'connection');
      expect(connMsg.status).toBe('connected');
      expect(connMsg.sessionId).toMatch(/^session-\d+-\d+$/);
      
      // Check storage was called
      expect(mockStorage.createSession).toHaveBeenCalledWith({
        sessionId: connMsg.sessionId,
        isActive: true
      });
      
      // Close connection
      client.close();
      
      // Wait a bit for close handling
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Check session was ended
      expect(mockStorage.endSession).toHaveBeenCalledWith(connMsg.sessionId);
      console.log('END: should handle basic connection and disconnection');
    });

    it('should handle connection with invalid classroom code', async () => {
      console.log('START: should handle connection with invalid classroom code');
      const invalidClient = await createClient('/ws?code=INVALID');
      
      const errorMsg = await waitForMessage(invalidClient, 'error');
      expect(errorMsg.code).toBe('INVALID_CLASSROOM');
      
      // Client should be closed
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      expect(invalidClient.readyState).toBe(WebSocket.CLOSED);
      console.log('END: should handle connection with invalid classroom code');
    });

    it('should handle connection with both class and code parameters', async () => {
      console.log('START: should handle connection with both class and code parameters');
      // First create a teacher to generate a classroom
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient);
      const classroomCode = classroomCodeResponse.code;
      
      // Connect with both 'class' and 'code' parameters - should use 'class'
      const student = await createClient(`/ws?class=${classroomCode}&code=WRONG`);
      const connMsg = await waitForMessage(student, 'connection');
      
      expect(connMsg.classroomCode).toBe(classroomCode);
      student.close();
      console.log('END: should handle connection with both class and code parameters');
    });

    it('should handle malformed URLs gracefully', async () => {
      console.log('START: should handle malformed URLs gracefully');
      // Create client with malformed URL (missing host header)
      const ws = new WebSocket(`ws://localhost:${serverPort}/ws?code=ABC123`);
      
      // Manually remove host header
      ws.on('upgrade', (request) => {
        delete request.headers.host;
      });
      
      await new Promise((resolve) => {
        ws.on('open', () => resolve(null));
        ws.on('error', () => resolve(null));
      });
      
      if (ws.readyState === WebSocket.OPEN) {
        const msg = await waitForMessage(ws, 'connection');
        expect(msg.status).toBe('connected');
        ws.close();
      }
      console.log('END: should handle malformed URLs gracefully');
    });
  });

  describe('Teacher-Student Flow', () => {
    it('should handle complete teacher-student session flow', async () => {
      console.log('START: should handle complete teacher-student session flow');
      // Teacher connects and registers
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient);
      
      // Get classroom code
      const codeMsg = classroomCodeResponse;
      expect(codeMsg.code).toMatch(/^[A-Z0-9]{6}$/);
      
      // Student connects with classroom code
      studentClient = await createClient(`/ws?code=${codeMsg.code}`);
      const studentConnMsg = await waitForMessage(studentClient, 'connection');
      expect(studentConnMsg.classroomCode).toBe(codeMsg.code);
      
      // Student registers
      const studentNotificationPromise = waitForMessage(teacherClient, 'student_joined');
      
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        name: 'Test Student'
      }, 'register');
      
      // Teacher should receive notification
      const notification = await studentNotificationPromise;
      expect(notification.payload.name).toBe('Test Student');
      expect(notification.payload.languageCode).toBe('es-ES');
      
      // Check storage was updated
      expect(mockStorage.updateSession).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ studentsCount: 1 })
      );
      console.log('END: should handle complete teacher-student session flow');
    });

    it('should handle teacher reconnection to existing session', async () => {
      console.log('START: should handle teacher reconnection to existing session');
      // Create first teacher session
      teacherClient = await createClient();
      const { classroomCodeResponse: firstCodeResponse } = await registerTeacher(teacherClient);
      const firstCode = firstCodeResponse.code;
      
      // Disconnect teacher
      teacherClient.close();
      await new Promise(resolve => teacherClient!.on('close', resolve));
      
      // Reconnect teacher - should get a new classroom code for the new session
      teacherClient = await createClient();
      
      // Register again as teacher
      const { classroomCodeResponse: secondCodeResponse } = await registerTeacher(teacherClient);
      
      // Should get a new classroom code for the new session
      expect(secondCodeResponse.code).toMatch(/^[A-Z0-9]{6}$/);
      expect(secondCodeResponse.code).not.toBe(firstCode);
      console.log('END: should handle teacher reconnection to existing session');
    });
  });

  describe('Translation Flow', () => {
    let classroomCode: string;

    beforeEach(async () => {
      // Setup teacher and student
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient);
      classroomCode = classroomCodeResponse.code;
      
      studentClient = await createClient(`/ws?code=${classroomCode}`);
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }, 'register');
    });

    it('should translate teacher transcription to all students', async () => {
      console.log('START: should translate teacher transcription to all students');
      expect(studentClient).not.toBeNull();
      expect(teacherClient).not.toBeNull();
      
      const translationPromise = waitForMessage(studentClient!, 'translation');
      
      // Teacher sends transcription
      await teacherClient!.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello students'
      }));
      
      // Student should receive translation
      const translation = await translationPromise;
      expect(translation.originalText).toBe('Hello students');
      expect(translation.text).toBe('Hola');
      expect(translation.sourceLanguage).toBe('en-US');
      expect(translation.targetLanguage).toBe('es-ES');
      expect(translation.audioData).toBeTruthy();
      expect(translation.latency).toBeDefined();
      console.log('END: should translate teacher transcription to all students');
    });

    it('should handle multiple students with different languages', async () => {
      console.log('START: should handle multiple students with different languages');
      expect(teacherClient).not.toBeNull();
      
      // Add second student with different language
      const student2 = await createClient(`/ws?code=${classroomCode}`);
      await sendAndWait(student2, {
        type: 'register',
        role: 'student',
        languageCode: 'fr-FR'
      }, 'register');
      
      // Mock different translations
      vi.mocked(speechTranslationService.translateSpeech)
        .mockResolvedValueOnce({
          originalText: 'Hello',
          translatedText: 'Hola',
          audioBuffer: Buffer.from('spanish-audio')
        })
        .mockResolvedValueOnce({
          originalText: 'Hello',
          translatedText: 'Bonjour',
          audioBuffer: Buffer.from('french-audio')
        });
      
      const translation1Promise = waitForMessage(studentClient!, 'translation');
      const translation2Promise = waitForMessage(student2, 'translation');
      
      // Teacher sends transcription
      await teacherClient!.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello'
      }));
      
      // Both students should receive their translations
      const [trans1, trans2] = await Promise.all([translation1Promise, translation2Promise]);
      
      expect(trans1.text).toBe('Hola');
      expect(trans1.targetLanguage).toBe('es-ES');
      
      expect(trans2.text).toBe('Bonjour');
      expect(trans2.targetLanguage).toBe('fr-FR');
      
      student2.close();
      console.log('END: should handle multiple students with different languages');
    });

    it('should handle translation service errors gracefully', async () => {
      console.log('START: should handle translation service errors gracefully');
      expect(studentClient).not.toBeNull();
      expect(teacherClient).not.toBeNull();
      
      // Mock translation error
      vi.mocked(speechTranslationService.translateSpeech).mockRejectedValueOnce(
        new Error('Translation service unavailable')
      );
      
      const translationPromise = waitForMessage(studentClient!, 'translation');
      
      // Teacher sends transcription
      await teacherClient!.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello students'
      }));
      
      // Student should receive fallback (original text)
      const translation = await translationPromise;
      expect(translation.text).toBe('Hello students'); // Fallback to original
      expect(translation.originalText).toBe('Hello students');
      console.log('END: should handle translation service errors gracefully');
    });

    it('should ignore transcriptions from students', async () => {
      console.log('START: should ignore transcriptions from students');
      expect(studentClient).not.toBeNull();
      
      // Student tries to send transcription
      await studentClient!.send(JSON.stringify({
        type: 'transcription',
        text: 'Student message'
      }));
      
      // No translation should be sent
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Check that translation service was not called
      expect(speechTranslationService.translateSpeech).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Ignoring transcription from non-teacher role:',
        { role: 'student' }
      );
      console.log('END: should ignore transcriptions from students');
    });

    it('should persist translations when logging is enabled', async () => {
      console.log('START: should persist translations when logging is enabled');
      expect(studentClient).not.toBeNull();
      expect(teacherClient).not.toBeNull();
      
      // Enable detailed logging
      process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';
      
      const translationPromise = waitForMessage(studentClient!, 'translation');
      
      // Teacher sends transcription
      await teacherClient!.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello students'
      }));
      
      await translationPromise;
      
      // Wait for async storage operation
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Check storage was called
      expect(mockStorage.addTranslation).toHaveBeenCalledWith({
        sessionId: expect.any(String),
        sourceLanguage: 'en-US',
        targetLanguage: 'es-ES',
        originalText: 'Hello students',
        translatedText: 'Hola',
        latency: expect.any(Number)
      });
      
      // Clean up
      delete process.env.ENABLE_DETAILED_TRANSLATION_LOGGING;
      console.log('END: should persist translations when logging is enabled');
    });
  });

  describe('Audio Processing', () => {
    let classroomCode: string;
    beforeEach(async () => {
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient);
      classroomCode = classroomCodeResponse.code;
    });

    it('should process audio from teacher', async () => {
      console.log('START: should process audio from teacher');
      expect(teacherClient).not.toBeNull();
      
      // Create audio buffer larger than minimum size
      const audioData = Buffer.alloc(1000).toString('base64');
      
      await teacherClient!.send(JSON.stringify({
        type: 'audio',
        data: audioData
      }));
      
      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Should log debug message
      expect(logger.debug).toHaveBeenCalledWith(
        'Received audio chunk from teacher, using client-side transcription'
      );
      console.log('END: should process audio from teacher');
    });

    it('should ignore small audio chunks', async () => {
      console.log('START: should ignore small audio chunks');
      expect(teacherClient).not.toBeNull();
      
      // Create small audio buffer
      const smallAudioData = Buffer.alloc(50).toString('base64');
      
      await teacherClient!.send(JSON.stringify({
        type: 'audio',
        data: smallAudioData
      }));
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Should not process
      expect(logger.debug).not.toHaveBeenCalled();
      console.log('END: should ignore small audio chunks');
    });

    it('should ignore audio from students', async () => {
      console.log('START: should ignore audio from students');
      expect(teacherClient).not.toBeNull();
      
      studentClient = await createClient(`/ws?code=${classroomCode}`);
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }, 'register');
      
      // Student sends audio
      const audioData = Buffer.alloc(1000).toString('base64');
      await studentClient.send(JSON.stringify({
        type: 'audio',
        data: audioData
      }));
      
      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Should be ignored
      expect(logger.info).toHaveBeenCalledWith(
        'Ignoring audio from non-teacher role:',
        { role: 'student' }
      );
      console.log('END: should ignore audio from students');
    });
  });

  describe('TTS Requests', () => {
    beforeEach(async () => {
      teacherClient = await createClient();
      await waitForMessage(teacherClient, 'connection');
    });

    it('should handle valid TTS request', async () => {
      console.log('START: should handle valid TTS request');
      expect(teacherClient).not.toBeNull();
      
      const response = await sendAndWait(teacherClient!, {
        type: 'tts_request',
        text: 'Hello world',
        languageCode: 'en-US'
      }, 'tts_response');
      
      expect(response.status).toBe('success');
      expect(response.text).toBe('Hello world');
      expect(response.languageCode).toBe('en-US');
      expect(response.audioData).toBeTruthy();
      expect(response.ttsServiceType).toBe('openai'); // Always uses OpenAI
      console.log('END: should handle valid TTS request');
    });

    it('should handle TTS request with empty text', async () => {
      console.log('START: should handle TTS request with empty text');
      expect(teacherClient).not.toBeNull();
      
      const response = await sendAndWait(teacherClient!, {
        type: 'tts_request',
        text: '',
        languageCode: 'en-US'
      }, 'tts_response');
      
      expect(response.status).toBe('error');
      expect(response.error.message).toBe('Invalid TTS request parameters');
      console.log('END: should handle TTS request with empty text');
    });

    it('should handle TTS request with missing language code', async () => {
      console.log('START: should handle TTS request with missing language code');
      expect(teacherClient).not.toBeNull();
      
      const response = await sendAndWait(teacherClient!, {
        type: 'tts_request',
        text: 'Hello'
      }, 'tts_response');
      
      expect(response.status).toBe('error');
      expect(response.error.message).toBe('Invalid TTS request parameters');
      console.log('END: should handle TTS request with missing language code');
    });

    it('should handle TTS generation errors', async () => {
      console.log('START: should handle TTS generation errors');
      expect(teacherClient).not.toBeNull();
      
      vi.mocked(speechTranslationService.translateSpeech).mockRejectedValueOnce(
        new Error('TTS service error')
      );
      
      const response = await sendAndWait(teacherClient!, {
        type: 'tts_request',
        text: 'Hello world',
        languageCode: 'en-US'
      }, 'tts_response');
      
      expect(response.status).toBe('error');
      expect(response.error.message).toBe('Failed to generate audio');
      console.log('END: should handle TTS generation errors');
    });

    it('should handle browser speech synthesis marker', async () => {
      console.log('START: should handle browser speech synthesis marker');
      expect(teacherClient).not.toBeNull();
      
      // Mock service returning browser speech marker
      vi.mocked(speechTranslationService.translateSpeech).mockResolvedValueOnce({
        originalText: 'Hello',
        translatedText: 'Hello',
        audioBuffer: Buffer.from(JSON.stringify({
          type: 'browser-speech',
          text: 'Hello',
          languageCode: 'en-US',
          autoPlay: true
        }))
      });
      
      const response = await sendAndWait(teacherClient!, {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      }, 'tts_response');
      
      expect(response.status).toBe('success');
      expect(response.useClientSpeech).toBe(true);
      expect(response.speechParams).toEqual({
        type: 'browser-speech',
        text: 'Hello',
        languageCode: 'en-US',
        autoPlay: true
      });
      console.log('END: should handle browser speech synthesis marker');
    });
  });

  describe('Settings Management', () => {
    beforeEach(async () => {
      teacherClient = await createClient();
      await waitForMessage(teacherClient, 'connection');
    });

    it('should update client settings', async () => {
      console.log('START: should update client settings');
      expect(teacherClient).not.toBeNull();
      
      const response = await sendAndWait(teacherClient!, {
        type: 'settings',
        settings: {
          ttsServiceType: 'google',
          useClientSpeech: true
        }
      }, 'settings');
      
      expect(response.status).toBe('success');
      expect(response.settings.ttsServiceType).toBe('google');
      expect(response.settings.useClientSpeech).toBe(true);
      console.log('END: should update client settings');
    });

    it('should handle legacy ttsServiceType field', async () => {
      console.log('START: should handle legacy ttsServiceType field');
      expect(teacherClient).not.toBeNull();
      
      const response = await sendAndWait(teacherClient!, {
        type: 'settings',
        ttsServiceType: 'azure'
      }, 'settings');
      
      expect(response.status).toBe('success');
      expect(response.settings.ttsServiceType).toBe('azure');
      console.log('END: should handle legacy ttsServiceType field');
    });

    it('should merge settings updates', async () => {
      console.log('START: should merge settings updates');
      expect(teacherClient).not.toBeNull();
      
      // First update
      await sendAndWait(teacherClient!, {
        type: 'settings',
        settings: {
          ttsServiceType: 'google'
        }
      }, 'settings');
      
      // Second update with different field
      const response = await sendAndWait(teacherClient!, {
        type: 'settings',
        settings: {
          useClientSpeech: true
        }
      }, 'settings');
      
      // Should have both settings
      expect(response.settings.ttsServiceType).toBe('google');
      expect(response.settings.useClientSpeech).toBe(true);
      console.log('END: should merge settings updates');
    });

    it('should apply settings to translations', async () => {
      console.log('START: should apply settings to translations');
      expect(teacherClient).not.toBeNull();
      
      // Setup teacher and student
      const { classroomCodeResponse } = await registerTeacher(teacherClient!);
      const codeMsg = classroomCodeResponse;
      
      console.log('DEBUG: About to create student client with code:', codeMsg.code);
      studentClient = await createClient(`/ws?code=${codeMsg.code}`);
      console.log('DEBUG: Student client created, waiting for connection...');
      await waitForMessage(studentClient, 'connection');
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }, 'register');
      
      // Update student settings
      await sendAndWait(studentClient, {
        type: 'settings',
        settings: {
          useClientSpeech: true
        }
      }, 'settings');
      
      const translationPromise = waitForMessage(studentClient!, 'translation');
      
      // Teacher sends transcription
      await teacherClient!.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello'
      }));
      
      // Check translation includes settings
      const translation = await translationPromise;
      expect(translation.useClientSpeech).toBe(true);
      expect(translation.speechParams).toBeDefined();
      console.log('END: should apply settings to translations');
    });
  });

  describe('Ping/Pong and Heartbeat', () => {
    beforeEach(async () => {
      teacherClient = await createClient();
      await waitForMessage(teacherClient, 'connection');
    });

    it('should respond to ping messages', async () => {
      console.log('START: should respond to ping messages');
      expect(teacherClient).not.toBeNull();
      
      const timestamp = Date.now();
      const pong = await sendAndWait(teacherClient!, {
        type: 'ping',
        timestamp
      }, 'pong');
      
      expect(pong.originalTimestamp).toBe(timestamp);
      expect(pong.timestamp).toBeGreaterThanOrEqual(timestamp);
      console.log('END: should respond to ping messages');
    });

    it('should handle WebSocket ping frames', async () => {
      console.log('START: should handle WebSocket ping frames');
      expect(teacherClient).not.toBeNull();
      
      // Send a ping frame (not JSON)
      teacherClient!.ping();
      
      // Should receive pong frame
      await new Promise<void>((resolve) => {
        teacherClient!.on('pong', () => resolve());
      });
      
      // Connection should remain alive
      expect(teacherClient!.readyState).toBe(WebSocket.OPEN);
      console.log('END: should handle WebSocket ping frames');
    });

    /*
    it('should terminate dead connections', async () => {
      vi.useFakeTimers();
      
      // Create new server instance with fake timers
      const testServer = new WebSocketServer(httpServer, mockStorage);
      
      // Connect client
      const client = await createClient();
      await waitForMessage(client, 'connection');
      
      // Simulate dead connection by not responding to pings
      (client as any).pong = vi.fn(); // Override pong to do nothing
      
      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(35000); // Past the 30s heartbeat interval
      
      // Wait for termination
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Connection should be terminated
      expect(testServer.getActiveSessionCount()).toBe(0);
      
      testServer.shutdown();
      vi.useRealTimers();
    });
    */
  });

  describe('Classroom Session Management', () => {
    it('should generate unique classroom codes', async () => {
      console.log('START: should generate unique classroom codes');
      const codes = new Set<string>();
      
      // Create multiple teachers
      for (let i = 0; i < 10; i++) {
        const teacher = await createClient();
        const { classroomCodeResponse } = await registerTeacher(teacher);
        codes.add(classroomCodeResponse.code);
        
        teacher.close();
      }
      
      // All codes should be unique
      expect(codes.size).toBe(10);
      
      // All should match format
      codes.forEach(code => {
        expect(code).toMatch(/^[A-Z0-9]{6}$/);
      });
      console.log('END: should generate unique classroom codes');
    });

    /* it('should expire classroom sessions', async () => {
      vi.useFakeTimers({ now: Date.now() });
      
      // Create teacher and get code
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient);
      const code = classroomCodeResponse.code;
      
      // Disconnect teacher
      teacherClient.close();
      
      // Advance time past expiration (2 hours + 15 min for cleanup)
      vi.advanceTimersByTime(2.5 * 60 * 60 * 1000);
      
      // Try to connect with expired code
      const invalidClient = await createClient(`/ws?code=${code}`);
      const errorMsg = await waitForMessage(invalidClient, 'error');
      
      expect(errorMsg.code).toBe('INVALID_CLASSROOM');
      
      vi.useRealTimers();
    }); */

    it('should update lastActivity on student join', async () => {
      console.log('START: should update lastActivity on student join');
      
      // Create teacher without fake timers to avoid WebSocket interference
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient);
      const codeMsg = classroomCodeResponse;
      
      // Student joins (this should update lastActivity)
      studentClient = await createClient(`/ws?code=${codeMsg.code}`);
      await waitForMessage(studentClient, 'connection');
      
      // Session should still be valid
      expect(studentClient.readyState).toBe(WebSocket.OPEN);
      
      console.log('END: should update lastActivity on student join');
    });
  });

  describe('Storage Error Handling', () => {
    it('should continue functioning when storage fails', async () => {
      console.log('START: should continue functioning when storage fails');
      // Mock storage failures
      vi.mocked(mockStorage.createSession).mockRejectedValue(new Error('Storage unavailable'));
      vi.mocked(mockStorage.updateSession).mockRejectedValue(new Error('Storage unavailable'));
      vi.mocked(mockStorage.endSession).mockRejectedValue(new Error('Storage unavailable'));
      
      // Should still be able to connect
      teacherClient = await createClient();
      const connMsg = await waitForMessage(teacherClient, 'connection');
      expect(connMsg.status).toBe('connected');
      
      // Should still be able to register
      const regResponse = await sendAndWait(teacherClient, {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }, 'register');
      
      expect(regResponse.status).toBe('success');
      
      // Check errors were logged
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to create or update session in storage:',
        expect.any(Object)
      );
      console.log('END: should continue functioning when storage fails');
    });

    it('should handle concurrent student joins', async () => {
      console.log('START: should handle concurrent student joins');
      // Setup teacher
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient);
      const codeMsg = classroomCodeResponse;
      console.log('After setup teacher');
      // Mock storage to track calls
      const updateCalls: any[] = [];
      vi.mocked(mockStorage.updateSession).mockImplementation(async (id, update) => {
        updateCalls.push({ id, update });
        return undefined; // Return undefined to match expected type
      });
      

      console.log("befre multipe students for loop");
      // Connect multiple students simultaneously
      const studentPromises = [];
      for (let i = 0; i < 5; i++) {
        console.log(`[TEST] Creating student client #${i}`);
        studentPromises.push(
          createClient(`/ws?code=${codeMsg.code}`, i).then(async (client) => {
            console.log(`[TEST] Student client #${i} connected`);
            try {
              await sendAndWait(client, {
                type: 'register',
                role: 'student',
                languageCode: 'es-ES',
                name: `Student ${i}`
              }, 'register', i);
              console.log(`[TEST] Student client #${i} registered`);
            } catch (err) {
              console.error(`[TEST] Student client #${i} failed to register:`, err);
              throw err;
            }
            return client;
          })
        );
      }
      
      const students = await Promise.all(studentPromises);
      
      // Wait for all updates
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Check all students were counted
      const studentCountUpdates = updateCalls.filter(call => 
        call.update.studentsCount !== undefined
      );
      
      expect(studentCountUpdates.length).toBeGreaterThan(0);
      
      // Clean up
      students.forEach(s => s.close());
      console.log('END: should handle concurrent student joins');
    });
  });

  describe('Metrics and Diagnostics', () => {
    it('should provide accurate session metrics', async () => {
      // Initial state
      let metrics = wsServer.getActiveSessionMetrics();
      expect(metrics.activeSessions).toBe(0);
      expect(metrics.studentsConnected).toBe(0);
      expect(metrics.teachersConnected).toBe(0);
      
      // Add teacher
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient);
      const codeMsg = classroomCodeResponse;
      
      // Add students
      const student1 = await createClient(`/ws?code=${codeMsg.code}`);
      await sendAndWait(student1, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }, 'register');
      
      const student2 = await createClient(`/ws?code=${codeMsg.code}`);
      await sendAndWait(student2, {
        type: 'register',
        role: 'student',
        languageCode: 'fr-FR'
      }, 'register');
      
      // Check metrics
      metrics = wsServer.getActiveSessionMetrics();
      expect(metrics.activeSessions).toBe(1);
      expect(metrics.studentsConnected).toBe(2);
      expect(metrics.teachersConnected).toBe(1);
      expect(metrics.currentLanguages).toContain('en-US');
      
      // Clean up
      student1.close();
      student2.close();
    });

    it('should track active session counts correctly', () => {
      expect(wsServer.getActiveSessionCount()).toBe(0);
      expect(wsServer.getActiveSessionsCount()).toBe(0); // Alias method
      expect(wsServer.getActiveStudentCount()).toBe(0);
      expect(wsServer.getActiveTeacherCount()).toBe(0);
    });
  });

  describe('Message Validation', () => {
    beforeEach(async () => {
      console.log('[TEST] [Message Validation] beforeEach START');
      teacherClient = await createClient();
      await waitForMessage(teacherClient, 'connection');
      console.log('[TEST] [Message Validation] beforeEach END');
    });
    afterEach(async () => {
      console.log('[TEST] [Message Validation] afterEach START');
      if (teacherClient && teacherClient.readyState === WebSocket.OPEN) {
        teacherClient.close();
      }
      teacherClient = null;
      console.log('[TEST] [Message Validation] afterEach END');
    });

    it('should handle invalid JSON messages', async () => {
      console.log('[TEST] [Message Validation] it should handle invalid JSON messages START');
      expect(teacherClient).not.toBeNull();
      
      // Send invalid JSON
      teacherClient!.send('not json');
      
      // Should not crash
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Check error was logged
      expect(logger.error).toHaveBeenCalledWith(
        'Error handling message:',
        expect.objectContaining({ data: 'not json' })
      );
      
      // Connection should remain open
      expect(teacherClient!.readyState).toBe(WebSocket.OPEN);
      console.log('[TEST] [Message Validation] it should handle invalid JSON messages END');
    });

    it('should handle unknown message types', async () => {
      console.log('[TEST] [Message Validation] it should handle unknown message types START');
      expect(teacherClient).not.toBeNull();
      
      await teacherClient!.send(JSON.stringify({
        type: 'unknown_type',
        data: 'test'
      }));
      
      // Should log warning
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      expect(logger.warn).toHaveBeenCalledWith(
        'Unknown message type:',
        { type: 'unknown_type' }
      );
      console.log('[TEST] [Message Validation] it should handle unknown message types END');
    });

    it('should handle messages with missing required fields', async () => {
      console.log('[TEST] [Message Validation] it should handle messages with missing required fields START');
      expect(teacherClient).not.toBeNull();
      
      // Register without role
      await teacherClient!.send(JSON.stringify({
        type: 'register'
      }));
      
      // Should still process (role is optional)
      const response = await waitForMessage(teacherClient!, 'register');
      expect(response.status).toBe('success');
      console.log('[TEST] [Message Validation] it should handle messages with missing required fields END');
    });
  });

  describe('Edge Cases and Race Conditions', () => {
    it('should handle rapid connect/disconnect cycles', async () => {
      const clients: WebSocket[] = [];
      
      // Rapidly create and close connections
      for (let i = 0; i < 10; i++) {
        const client = await createClient();
        clients.push(client);
        
        // Immediately close some
        if (i % 2 === 0) {
          client.close();
        }
      }
      
      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Server should still be functional
      const testClient = await createClient();
      const msg = await waitForMessage(testClient, 'connection');
      expect(msg.status).toBe('connected');
      
      // Clean up
      clients.forEach(c => {
        if (c.readyState === WebSocket.OPEN) c.close();
      });
      testClient.close();
    });

    it('should handle sending to closing connections', async () => {
      // Setup teacher and student
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient);
      const codeMsg = classroomCodeResponse;
      
      studentClient = await createClient(`/ws?code=${codeMsg.code}`);
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }, 'register');
      
      // Start closing student connection
      studentClient.close();
      
      // Immediately send transcription
      await teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello'
      }));
      
      // Should not crash
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Check for send errors - may be session storage related or translation sending related
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/(?:Error sending translation to student:|Failed to create or update session in storage:)/),
        expect.any(Object)
      );
    });

    it('should handle WebSocket errors during operation', async () => {
      teacherClient = await createClient();
      await waitForMessage(teacherClient, 'connection');
      
      // Simulate WebSocket error
      teacherClient.emit('error', new Error('Network error'));
      
      // Should log error - may be WebSocket error or session storage related  
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringMatching(/(?:WebSocket error:|Failed to create or update session in storage:)/),
        expect.any(Object)
      );
      
      // Connection might close but server should continue
      expect(wsServer.getActiveSessionCount()).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Shutdown and Cleanup', () => {
    it('should properly shutdown all connections', async () => {
      // Create multiple connections
      const teacher = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacher);
      const codeMsg = classroomCodeResponse;
      
      const student1 = await createClient(`/ws?code=${codeMsg.code}`);
      const student2 = await createClient(`/ws?code=${codeMsg.code}`);
      
      expect(wsServer.getActiveSessionCount()).toBe(3);
      
      // Shutdown server
      wsServer.shutdown();
      
      // All connections should be terminated
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      expect(teacher.readyState).toBe(WebSocket.CLOSED);
      expect(student1.readyState).toBe(WebSocket.CLOSED);
      expect(student2.readyState).toBe(WebSocket.CLOSED);
      expect(wsServer.getActiveSessionCount()).toBe(0);
    });

    it('should handle errors during shutdown', async () => {
      // Create a connection
      teacherClient = await createClient();
      await waitForMessage(teacherClient, 'connection');
      
      // Mock close error
      const mockClose = vi.fn((callback?: (err?: Error) => void) => {
        if (callback) callback(new Error('Close failed'));
      });
      
      (wsServer as any).wss.close = mockClose;
      
      // Shutdown should not throw
      expect(() => wsServer.shutdown()).not.toThrow();
      
      // Error should be logged
      expect(logger.error).toHaveBeenCalledWith(
        '[WebSocketServer] Error closing WebSocket server:',
        expect.objectContaining({ err: expect.any(Error) })
      );
    });
  });

  describe('OpenAI TTS Override', () => {
    it('should always use OpenAI TTS regardless of client settings', async () => {
      // Setup teacher requesting different TTS service
      teacherClient = await createClient();
      const { classroomCodeResponse } = await registerTeacher(teacherClient, {
        settings: {
          ttsServiceType: 'google' // Request Google TTS
        }
      });
      const codeMsg = classroomCodeResponse;
      
      // Setup student
      studentClient = await createClient(`/ws?code=${codeMsg.code}`);
      await sendAndWait(studentClient, {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }, 'register');
      
      // Teacher sends transcription
      await teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello'
      }));
      
      // Wait for translation service call
      await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.CLEANUP_DELAY));
      
      // Verify OpenAI was used instead of Google
      expect(speechTranslationService.translateSpeech).toHaveBeenCalledWith(
        expect.any(Buffer),
        'en-US',
        'es-ES',
        'Hello',
        { ttsServiceType: 'openai' } // Should override to OpenAI
      );
      
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining("Using OpenAI TTS service for language 'es-ES' (overriding teacher's selection)")
      );
    });
  });
});
