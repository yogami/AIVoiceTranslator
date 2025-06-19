import { describe, it, expect, beforeEach, vi, type Mock, afterEach } from 'vitest';
import type { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';
import type { IStorage } from '../../../server/storage.interface';

// Mock the ws module before importing WebSocketServer
vi.mock('ws', () => {
  const mockWebSocketServer = vi.fn();
  const mockWebSocket = vi.fn();
  
  return {
    WebSocketServer: mockWebSocketServer,
    WebSocket: mockWebSocket
  };
});

// Mock other dependencies
vi.mock('../../../server/logger', () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('../../../server/services/TranslationService', () => ({
  speechTranslationService: {
    translateSpeech: vi.fn().mockResolvedValue({
      originalText: 'test',
      translatedText: 'translated test',
      audioBuffer: Buffer.from('mock audio')
    })
  }
}));

vi.mock('../../../server/services/transcription/AudioTranscriptionService', () => ({
  audioTranscriptionService: {
    transcribeAudio: vi.fn().mockResolvedValue('transcribed text')
  }
}));

vi.mock('../../../server/config', () => ({
  config: {
    server: {
      host: 'localhost',
      port: 3000
    }
  }
}));

// Now import the WebSocketServer after mocks are set up
import { WebSocketServer } from '../../../server/services/WebSocketServer';
import { WebSocketServer as WSServer } from 'ws';
import logger from '../../../server/logger';
import { speechTranslationService } from '../../../server/services/TranslationService';

describe('WebSocketServer', () => {
  let webSocketServer: WebSocketServer;
  let mockHttpServer: HTTPServer;
  let mockWss: any;
  let mockWs: any;
  let mockStorage: IStorage;
  let mockWebSocketServer: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    // Get the mocked constructor
    mockWebSocketServer = WSServer as unknown as Mock;

    // Create mock HTTP server
    mockHttpServer = {
      on: vi.fn(),
      listen: vi.fn(),
      close: vi.fn()
    } as unknown as HTTPServer;

    // Create mock WebSocket instance
    mockWs = {
      send: vi.fn(),
      close: vi.fn(),
      on: vi.fn(),
      terminate: vi.fn(),
      ping: vi.fn(),
      readyState: 1, // OPEN
      isAlive: true
    };

    // Create mock WebSocket Server instance
    const emitter = new EventEmitter();
    mockWss = Object.assign(emitter, {
      clients: new Set([mockWs]),
      close: vi.fn((callback?: (err?: Error) => void) => {
        if (callback) callback();
      }),
      on: emitter.on.bind(emitter)
    });

    // Setup WebSocketServer constructor mock
    mockWebSocketServer.mockImplementation(() => mockWss);

    // Create mock storage
    mockStorage = {
      createSession: vi.fn().mockResolvedValue(undefined),
      getSessionById: vi.fn().mockResolvedValue(null),
      updateSession: vi.fn().mockResolvedValue(undefined),
      endSession: vi.fn().mockResolvedValue(undefined),
      getActiveSession: vi.fn().mockResolvedValue(null),
      addTranslation: vi.fn().mockResolvedValue(undefined)
    } as unknown as IStorage;

    // Create WebSocketServer instance
    webSocketServer = new WebSocketServer(mockHttpServer, mockStorage);
  });

  afterEach(() => {
    // Clean up any intervals
    webSocketServer.shutdown();
  });

  describe('constructor and initialization', () => {
    it('should create WebSocketServer with server parameter', () => {
      expect(mockWebSocketServer).toHaveBeenCalledWith({ server: mockHttpServer });
    });

    it('should setup connection event handler', () => {
      const connectionListeners = mockWss.listeners('connection');
      expect(connectionListeners.length).toBeGreaterThan(0);
    });

    it('should setup heartbeat interval', () => {
      // Fast-forward time to trigger heartbeat
      vi.useFakeTimers();
      
      // Need to create a new WebSocketServer instance after setting up fake timers
      const newWss = new WebSocketServer(mockHttpServer, mockStorage);
      
      const deadClient = {
        isAlive: false,
        terminate: vi.fn(),
        ping: vi.fn(),
        send: vi.fn()
      };
      
      // Add the dead client to the WebSocket server's clients
      (newWss as any).wss.clients = new Set([deadClient]);
      
      // Fast-forward 30 seconds to trigger heartbeat
      vi.advanceTimersByTime(30000);
      
      expect(deadClient.terminate).toHaveBeenCalled();
      
      // Clean up
      newWss.shutdown();
      vi.useRealTimers();
    });

    it('should handle heartbeat ping with alive client', () => {
      vi.useFakeTimers();
      
      const newWss = new WebSocketServer(mockHttpServer, mockStorage);
      
      const aliveClient = {
        isAlive: true,
        terminate: vi.fn(),
        ping: vi.fn(),
        send: vi.fn()
      };
      
      (newWss as any).wss.clients = new Set([aliveClient]);
      
      // Fast-forward 30 seconds to trigger heartbeat
      vi.advanceTimersByTime(30000);
      
      expect(aliveClient.ping).toHaveBeenCalled();
      expect(aliveClient.isAlive).toBe(false); // Should be set to false to check for pong
      expect(aliveClient.terminate).not.toHaveBeenCalled();
      
      newWss.shutdown();
      vi.useRealTimers();
    });

    it('should handle heartbeat ping send errors gracefully', () => {
      vi.useFakeTimers();
      
      const newWss = new WebSocketServer(mockHttpServer, mockStorage);
      
      const errorClient = {
        isAlive: true,
        terminate: vi.fn(),
        ping: vi.fn(),
        send: vi.fn().mockImplementation(() => {
          throw new Error('Send failed');
        })
      };
      
      (newWss as any).wss.clients = new Set([errorClient]);
      
      // Fast-forward 30 seconds to trigger heartbeat
      vi.advanceTimersByTime(30000);
      
      expect(errorClient.ping).toHaveBeenCalled();
      expect(errorClient.send).toHaveBeenCalled();
      // Should not throw despite send error
      
      newWss.shutdown();
      vi.useRealTimers();
    });
  });

  describe('connection handling', () => {
    it('should handle new WebSocket connections without classroom code', async () => {
      const mockRequest = {
        url: '/ws',
        headers: { host: 'localhost:3000' }
      };

      mockWss.emit('connection', mockWs, mockRequest);

      await vi.waitFor(() => {
        expect(mockWs.send).toHaveBeenCalled();
        const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
        expect(sentMessage.type).toBe('connection');
        expect(sentMessage.status).toBe('connected');
        expect(sentMessage.sessionId).toMatch(/^session-\d+-\d+$/);
      });

      expect(mockWs.on).toHaveBeenCalledWith('message', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('pong', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));
      expect(mockWs.on).toHaveBeenCalledWith('error', expect.any(Function));
    });

    it('should handle classroom code in connection URL', async () => {
      const mockRequest = {
        url: '/ws?code=ABC123',
        headers: { host: 'localhost:3000' }
      };

      mockWss.emit('connection', mockWs, mockRequest);

      await vi.waitFor(() => {
        expect(mockWs.send).toHaveBeenCalledWith(
          expect.stringContaining('"code":"INVALID_CLASSROOM"')
        );
        expect(mockWs.close).toHaveBeenCalledWith(1008, 'Invalid classroom session');
      });
    });

    it('should accept valid classroom code', async () => {
      // First create a teacher session to generate classroom code
      const teacherWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      mockWss.emit('connection', teacherWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      
      const onCalls = (teacherWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      const messageHandler = messageCall?.[1];

      // Register as teacher to get classroom code
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      // Wait for the classroom code to be sent
      await vi.waitFor(() => {
        const sendCalls = (teacherWs.send as any).mock.calls;
        const hasClassroomCode = sendCalls.some((call: any[]) => 
          call[0].includes('classroom_code')
        );
        expect(hasClassroomCode).toBe(true);
      });

      // Extract classroom code from response
      const classroomCodeCall = (teacherWs.send as any).mock.calls.find(
        (call: any[]) => call[0].includes('classroom_code')
      );
      
      if (!classroomCodeCall) {
        throw new Error('Classroom code not found in teacher responses');
      }
      
      const classroomCodeMsg = JSON.parse(classroomCodeCall[0]);
      const classroomCode = classroomCodeMsg.code;

      // Now connect student with valid classroom code
      const studentWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      mockWss.emit('connection', studentWs, { 
        url: `/ws?code=${classroomCode}`, 
        headers: { host: 'localhost:3000' } 
      });

      await vi.waitFor(() => {
        const sentMessage = JSON.parse((studentWs.send as any).mock.calls[0][0]);
        expect(sentMessage.type).toBe('connection');
        expect(sentMessage.classroomCode).toBe(classroomCode);
      });
    });

    it('should create session in storage on connection', async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });

      await vi.waitFor(() => {
        expect(mockStorage.createSession).toHaveBeenCalledWith({
          sessionId: expect.stringMatching(/^session-\d+-\d+$/),
          isActive: true
        });
      });
    });

    it('should handle storage errors gracefully', async () => {
      mockStorage.createSession = vi.fn().mockRejectedValue(new Error('Storage error'));
      
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Failed to create or update session in storage:',
          expect.objectContaining({ error: expect.any(Error) })
        );
      });

      // Connection should still work
      expect(mockWs.send).toHaveBeenCalled();
    });
  });

  describe('message handling - register', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should handle teacher registration', async () => {
      const registerMessage = {
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      };

      await messageHandler(JSON.stringify(registerMessage));

      await vi.waitFor(() => {
        const calls = mockWs.send.mock.calls;
        
        // Check for register response
        const registerResponse = calls.find((call: any[]) => 
          call[0].includes('"type":"register"') && call[0].includes('"status":"success"')
        );
        expect(registerResponse).toBeDefined();
        
        // Check for classroom code
        const classroomCode = calls.find((call: any[]) => 
          call[0].includes('"type":"classroom_code"')
        );
        expect(classroomCode).toBeDefined();
        const codeMsg = JSON.parse(classroomCode[0]);
        expect(codeMsg.code).toMatch(/^[A-Z0-9]{6}$/);
      });
    });

    it('should handle student registration and notify teacher', async () => {
      // First register a teacher
      const teacherWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      mockWss.emit('connection', teacherWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      
      const teacherOnCalls = (teacherWs.on as any).mock.calls;
      const teacherMessageCall = teacherOnCalls.find((call: any[]) => call[0] === 'message');
      const teacherMessageHandler = teacherMessageCall?.[1];

      await teacherMessageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      // Wait for classroom code to be sent
      await vi.waitFor(() => {
        const sendCalls = (teacherWs.send as any).mock.calls;
        const hasClassroomCode = sendCalls.some((call: any[]) => 
          call[0].includes('classroom_code')
        );
        expect(hasClassroomCode).toBe(true);
      });

      // Get classroom code
      const classroomCodeCall = (teacherWs.send as any).mock.calls.find(
        (call: any[]) => call[0].includes('classroom_code')
      );
      
      if (!classroomCodeCall) {
        throw new Error('Classroom code not found');
      }
      
      const classroomCodeMsg = JSON.parse(classroomCodeCall[0]);
      const sessionId = classroomCodeMsg.sessionId;

      // Mock the connections to include both teacher and student with same session
      const connectionsMap = new Map();
      connectionsMap.set(teacherWs, sessionId);
      connectionsMap.set(mockWs, sessionId);
      
      // Override the internal connections tracking
      (webSocketServer as any).sessionIds = connectionsMap;
      (webSocketServer as any).connections = new Set([teacherWs, mockWs]);
      (webSocketServer as any).roles = new Map([[teacherWs, 'teacher'], [mockWs, 'student']]);

      // Register student
      const registerMessage = {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        name: 'Test Student'
      };

      await messageHandler(JSON.stringify(registerMessage));

      await vi.waitFor(() => {
        // Check student got confirmation
        const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
        const response = JSON.parse(lastCall[0]);
        expect(response.type).toBe('register');
        expect(response.status).toBe('success');

        // Check teacher got notification
        const teacherCalls = (teacherWs.send as any).mock.calls;
        const studentJoinedCall = teacherCalls.find((call: any[]) => 
          call[0].includes('"type":"student_joined"')
        );
        expect(studentJoinedCall).toBeDefined();
        const notification = JSON.parse(studentJoinedCall[0]);
        expect(notification.payload.name).toBe('Test Student');
        expect(notification.payload.languageCode).toBe('es-ES');
      });
    });

    it('should update TTS service type from register message', async () => {
      const registerMessage = {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        settings: {
          ttsServiceType: 'google'
        }
      };

      await messageHandler(JSON.stringify(registerMessage));

      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const response = JSON.parse(lastCall[0]);
      expect(response.data.settings.ttsServiceType).toBe('google');
    });
  });

  describe('message handling - transcription', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should ignore transcriptions from non-teachers', async () => {
      // Register as student
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }));

      vi.clearAllMocks();

      // Send transcription
      await messageHandler(JSON.stringify({
        type: 'transcription',
        text: 'Hello world'
      }));

      expect(logger.warn).toHaveBeenCalledWith(
        'Ignoring transcription from non-teacher role:', 
        { role: 'student' }
      );
      expect(speechTranslationService.translateSpeech).not.toHaveBeenCalled();
    });

    it('should process teacher transcriptions and send to students', async () => {
      // Setup teacher and student connections
      const teacherWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      const studentWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      
      // Override connections
      (webSocketServer as any).connections = new Set([teacherWs, studentWs]);
      (webSocketServer as any).roles = new Map([
        [teacherWs, 'teacher'],
        [studentWs, 'student']
      ]);
      (webSocketServer as any).languages = new Map([
        [teacherWs, 'en-US'],
        [studentWs, 'es-ES']
      ]);
      (webSocketServer as any).sessionIds = new Map([
        [teacherWs, 'session-1'],
        [studentWs, 'session-1']
      ]);

      // Get teacher message handler
      mockWss.emit('connection', teacherWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      const teacherOnCalls = (teacherWs.on as any).mock.calls;
      const teacherMessageCall = teacherOnCalls.find((call: any[]) => call[0] === 'message');
      const teacherMessageHandler = teacherMessageCall?.[1];

      // Send transcription from teacher
      await teacherMessageHandler(JSON.stringify({
        type: 'transcription',
        text: 'Hello students'
      }));

      await vi.waitFor(() => {
        expect(speechTranslationService.translateSpeech).toHaveBeenCalledWith(
          Buffer.from(''),
          'en-US',
          'es-ES',
          'Hello students',
          { ttsServiceType: 'openai' }
        );

        const studentCalls = (studentWs.send as any).mock.calls;
        const translationCall = studentCalls.find((call: any[]) => 
          call[0].includes('"type":"translation"')
        );
        expect(translationCall).toBeDefined();
        const translation = JSON.parse(translationCall[0]);
        expect(translation.originalText).toBe('Hello students');
        expect(translation.text).toBe('translated test');
        expect(translation.audioData).toBeDefined();
      });
    });

    it('should handle translation errors gracefully', async () => {
      // Mock translation error
      vi.mocked(speechTranslationService.translateSpeech).mockRejectedValueOnce(
        new Error('Translation failed')
      );

      // Setup teacher and student
      const teacherWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      const studentWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      
      (webSocketServer as any).connections = new Set([teacherWs, studentWs]);
      (webSocketServer as any).roles = new Map([
        [teacherWs, 'teacher'],
        [studentWs, 'student']
      ]);
      (webSocketServer as any).languages = new Map([
        [teacherWs, 'en-US'],
        [studentWs, 'es-ES']
      ]);

      mockWss.emit('connection', teacherWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      const teacherOnCalls = (teacherWs.on as any).mock.calls;
      const teacherMessageCall = teacherOnCalls.find((call: any[]) => call[0] === 'message');
      const teacherMessageHandler = teacherMessageCall?.[1];

      await teacherMessageHandler(JSON.stringify({
        type: 'transcription',
        text: 'Hello students'
      }));

      await vi.waitFor(() => {
        const studentCalls = (studentWs.send as any).mock.calls;
        const translationCall = studentCalls.find((call: any[]) => 
          call[0].includes('"type":"translation"')
        );
        expect(translationCall).toBeDefined();
        const translation = JSON.parse(translationCall[0]);
        // Should fallback to original text
        expect(translation.text).toBe('Hello students');
      });
    });
  });

  describe('message handling - TTS request', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should handle valid TTS request', async () => {
      await messageHandler(JSON.stringify({
        type: 'tts_request',
        text: 'Hello world',
        languageCode: 'en-US'
      }));

      await vi.waitFor(() => {
        expect(speechTranslationService.translateSpeech).toHaveBeenCalledWith(
          Buffer.from(''),
          'en-US',
          'en-US',
          'Hello world',
          { ttsServiceType: 'openai' }
        );

        const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
        const response = JSON.parse(lastCall[0]);
        expect(response.type).toBe('tts_response');
        expect(response.status).toBe('success');
        expect(response.audioData).toBeDefined();
      });
    });

    it('should handle invalid TTS request - empty text', async () => {
      await messageHandler(JSON.stringify({
        type: 'tts_request',
        text: '',
        languageCode: 'en-US'
      }));

      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const response = JSON.parse(lastCall[0]);
      expect(response.type).toBe('tts_response');
      expect(response.status).toBe('error');
      expect(response.error.message).toBe('Invalid TTS request parameters');
    });

    it('should handle invalid TTS request - missing language code', async () => {
      await messageHandler(JSON.stringify({
        type: 'tts_request',
        text: 'Hello'
      }));

      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const response = JSON.parse(lastCall[0]);
      expect(response.type).toBe('tts_response');
      expect(response.status).toBe('error');
    });

    it('should handle TTS generation errors', async () => {
      vi.mocked(speechTranslationService.translateSpeech).mockRejectedValueOnce(
        new Error('TTS failed')
      );

      await messageHandler(JSON.stringify({
        type: 'tts_request',
        text: 'Hello world',
        languageCode: 'en-US'
      }));

      await vi.waitFor(() => {
        const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
        const response = JSON.parse(lastCall[0]);
        expect(response.type).toBe('tts_response');
        expect(response.status).toBe('error');
        // The actual implementation sends 'Failed to generate audio' not 'TTS generation error'
        expect(response.error.message).toBe('Failed to generate audio');
      });
    });
  });

  describe('message handling - audio', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should ignore audio from non-teachers', async () => {
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }));

      await messageHandler(JSON.stringify({
        type: 'audio',
        data: Buffer.from('audio data').toString('base64')
      }));

      expect(logger.info).toHaveBeenCalledWith(
        'Ignoring audio from non-teacher role:', 
        { role: 'student' }
      );
    });

    it('should process audio from teacher', async () => {
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      const audioData = Buffer.from('a'.repeat(200)).toString('base64');
      await messageHandler(JSON.stringify({
        type: 'audio',
        data: audioData
      }));

      expect(logger.debug).toHaveBeenCalledWith(
        'Received audio chunk from teacher, using client-side transcription'
      );
    });

    it('should ignore small audio chunks', async () => {
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      const smallAudio = Buffer.from('small').toString('base64');
      await messageHandler(JSON.stringify({
        type: 'audio',
        data: smallAudio
      }));

      expect(logger.debug).not.toHaveBeenCalled();
    });
  });

  describe('message handling - settings', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should update client settings', async () => {
      await messageHandler(JSON.stringify({
        type: 'settings',
        settings: {
          ttsServiceType: 'google',
          useClientSpeech: true
        }
      }));

      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const response = JSON.parse(lastCall[0]);
      expect(response.type).toBe('settings');
      expect(response.status).toBe('success');
      expect(response.settings.ttsServiceType).toBe('google');
      expect(response.settings.useClientSpeech).toBe(true);
    });

    it('should handle legacy ttsServiceType field', async () => {
      await messageHandler(JSON.stringify({
        type: 'settings',
        ttsServiceType: 'azure'
      }));

      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const response = JSON.parse(lastCall[0]);
      expect(response.settings.ttsServiceType).toBe('azure');
    });
  });

  describe('message handling - ping/pong', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should respond to ping with pong', async () => {
      await messageHandler(JSON.stringify({
        type: 'ping',
        timestamp: 123456
      }));

      const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
      const response = JSON.parse(lastCall[0]);
      expect(response.type).toBe('pong');
      expect(response.originalTimestamp).toBe(123456);
      expect(response.timestamp).toBeDefined();
    });

    it('should mark connection as alive on ping', async () => {
      mockWs.isAlive = false;
      
      await messageHandler(JSON.stringify({
        type: 'ping',
        timestamp: 123456
      }));

      expect(mockWs.isAlive).toBe(true);
    });
  });

  describe('error handling', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should handle invalid JSON messages', async () => {
      await messageHandler('invalid json');

      expect(logger.error).toHaveBeenCalledWith(
        'Error handling message:', 
        expect.objectContaining({ data: 'invalid json' })
      );
    });

    it('should handle unknown message types', async () => {
      await messageHandler(JSON.stringify({
        type: 'unknown_type'
      }));

      expect(logger.warn).toHaveBeenCalledWith(
        'Unknown message type:', 
        { type: 'unknown_type' }
      );
    });

    it('should handle WebSocket errors', async () => {
      const onCalls = (mockWs.on as any).mock.calls;
      const errorCall = onCalls.find((call: any[]) => call[0] === 'error');
      const errorHandler = errorCall?.[1];

      const testError = new Error('WebSocket error');
      errorHandler(testError);

      expect(logger.error).toHaveBeenCalledWith(
        'WebSocket error:', 
        { error: testError }
      );
    });
  });

  describe('close handling', () => {
    it('should clean up connection on close', async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });

      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });

      const onCalls = (mockWs.on as any).mock.calls;
      const closeCall = onCalls.find((call: any[]) => call[0] === 'close');
      const closeHandler = closeCall?.[1];

      const initialCount = webSocketServer.getActiveSessionCount();
      expect(initialCount).toBe(1);

      closeHandler();

      expect(webSocketServer.getActiveSessionCount()).toBe(0);
      expect(mockStorage.endSession).toHaveBeenCalled();
    });

    it('should not end session if other connections exist', async () => {
      // Create two connections with same session
      const ws1 = { ...mockWs, send: vi.fn(), on: vi.fn() };
      const ws2 = { ...mockWs, send: vi.fn(), on: vi.fn() };
      
      mockWss.emit('connection', ws1, { url: '/ws', headers: { host: 'localhost:3000' } });
      
      // Manually set up the second connection with same session ID
      const sessionId = 'session-1-1234';
      (webSocketServer as any).connections.add(ws2);
      (webSocketServer as any).sessionIds.set(ws1, sessionId);
      (webSocketServer as any).sessionIds.set(ws2, sessionId);

      const onCalls = (ws1.on as any).mock.calls;
      const closeCall = onCalls.find((call: any[]) => call[0] === 'close');
      const closeHandler = closeCall?.[1];

      vi.clearAllMocks();
      
      closeHandler();

      expect(mockStorage.endSession).not.toHaveBeenCalled();
    });
  });

  describe('public methods', () => {
    it('should return correct active session counts', () => {
      expect(webSocketServer.getActiveSessionCount()).toBe(0);
      expect(webSocketServer.getActiveSessionsCount()).toBe(0);

      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });

      expect(webSocketServer.getActiveSessionCount()).toBe(1);
      expect(webSocketServer.getActiveSessionsCount()).toBe(1);
    });

    it('should return active student count', async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });

      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });

      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      const messageHandler = messageCall?.[1];

      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }));

      expect(webSocketServer.getActiveStudentCount()).toBe(1);
    });

    it('should return active teacher count', async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });

      await vi.waitFor(() => {
        expect(mockWs.on).toHaveBeenCalled();
      });

      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      const messageHandler = messageCall?.[1];

      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      expect(webSocketServer.getActiveTeacherCount()).toBe(1);
    });

    it('should return active session metrics', async () => {
      const teacherWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      const studentWs = { ...mockWs, send: vi.fn(), on: vi.fn() };

      // Set up connections
      (webSocketServer as any).connections = new Set([teacherWs, studentWs]);
      (webSocketServer as any).roles = new Map([
        [teacherWs, 'teacher'],
        [studentWs, 'student']
      ]);
      (webSocketServer as any).languages = new Map([
        [teacherWs, 'en-US'],
        [studentWs, 'es-ES']
      ]);
      (webSocketServer as any).sessionIds = new Map([
        [teacherWs, 'session-1'],
        [studentWs, 'session-1']
      ]);
      
      // Set up classroom session
      (webSocketServer as any).classroomSessions.set('ABC123', {
        code: 'ABC123',
        sessionId: 'session-1',
        createdAt: Date.now(),
        lastActivity: Date.now(),
        teacherConnected: true,
        expiresAt: Date.now() + 1000000
      });

      const metrics = webSocketServer.getActiveSessionMetrics();
      
      expect(metrics.activeSessions).toBe(1);
      expect(metrics.studentsConnected).toBe(1);
      expect(metrics.teachersConnected).toBe(1);
      expect(metrics.currentLanguages).toContain('en-US');
    });
  });

  describe('classroom session management', () => {
    it('should generate unique 6-character classroom codes', async () => {
      const codes = new Set<string>();
      
      // Generate multiple codes
      for (let i = 0; i < 10; i++) {
        const ws = { ...mockWs, send: vi.fn(), on: vi.fn() };
        mockWss.emit('connection', ws, { url: '/ws', headers: { host: 'localhost:3000' } });
        
        const onCalls = (ws.on as any).mock.calls;
        const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
        const messageHandler = messageCall?.[1];

        await messageHandler(JSON.stringify({
          type: 'register',
          role: 'teacher',
          languageCode: 'en-US'
        }));

        // Wait for classroom code to be sent
        await vi.waitFor(() => {
          const sendCalls = (ws.send as any).mock.calls;
          const hasClassroomCode = sendCalls.some((call: any[]) => 
            call[0].includes('classroom_code')
          );
          expect(hasClassroomCode).toBe(true);
        });

        const codeCall = (ws.send as any).mock.calls.find(
          (call: any[]) => call[0].includes('classroom_code')
        );
        
        if (!codeCall) {
          throw new Error('Classroom code not found');
        }
        
        const codeMsg = JSON.parse(codeCall[0]);
        
        expect(codeMsg.code).toMatch(/^[A-Z0-9]{6}$/);
        codes.add(codeMsg.code);
      }

      // All codes should be unique
      expect(codes.size).toBe(10);
    });

    it('should reuse classroom code for same session', async () => {
      const ws = { ...mockWs, send: vi.fn(), on: vi.fn() };
      mockWss.emit('connection', ws, { url: '/ws', headers: { host: 'localhost:3000' } });
      
      // Force a specific session ID
      const sessionId = 'test-session-123';
      (webSocketServer as any).sessionIds.set(ws, sessionId);
      
      const onCalls = (ws.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      const messageHandler = messageCall?.[1];

      // Register as teacher twice
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      // Wait for first classroom code
      await vi.waitFor(() => {
        const sendCalls = (ws.send as any).mock.calls;
        const hasClassroomCode = sendCalls.some((call: any[]) => 
          call[0].includes('classroom_code')
        );
        expect(hasClassroomCode).toBe(true);
      });

      const firstCodeCall = (ws.send as any).mock.calls.find(
        (call: any[]) => call[0].includes('classroom_code')
      );
      
      if (!firstCodeCall) {
        throw new Error('First classroom code not found');
      }
      
      const firstCode = JSON.parse(firstCodeCall[0]).code;

      // Register again
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      const secondCodeCall = (ws.send as any).mock.calls.slice().reverse().find(
        (call: any[]) => call[0].includes('classroom_code')
      );
      
      if (!secondCodeCall) {
        throw new Error('Second classroom code not found');
      }
      
      const secondCode = JSON.parse(secondCodeCall[0]).code;

      expect(firstCode).toBe(secondCode);
    });

    it('should clean up expired classroom sessions', () => {
      vi.useFakeTimers();
      
      // Create a new WebSocketServer instance after setting up fake timers
      // This ensures the cleanup interval is registered with fake timers
      const testWss = new WebSocketServer(mockHttpServer, mockStorage);
      
      // Create an expired session
      const expiredSession = {
        code: 'EXPIRED',
        sessionId: 'session-expired',
        createdAt: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
        lastActivity: Date.now() - 3 * 60 * 60 * 1000,
        teacherConnected: false,
        expiresAt: Date.now() - 60 * 60 * 1000 // Expired 1 hour ago
      };
      
      (testWss as any).classroomSessions.set('EXPIRED', expiredSession);
      
      // Fast-forward 15 minutes to trigger cleanup
      vi.advanceTimersByTime(15 * 60 * 1000);
      
      expect((testWss as any).classroomSessions.has('EXPIRED')).toBe(false);
      expect(logger.info).toHaveBeenCalledWith('Cleaned up 1 expired classroom sessions');
      
      // Clean up
      testWss.shutdown();
      vi.useRealTimers();
    });
  });

  describe('shutdown', () => {
    it('should properly shutdown the server', () => {
      // Add some connections
      const ws1 = { ...mockWs, terminate: vi.fn() };
      const ws2 = { ...mockWs, terminate: vi.fn() };
      (webSocketServer as any).connections = new Set([ws1, ws2]);

      webSocketServer.shutdown();

      expect(ws1.terminate).toHaveBeenCalled();
      expect(ws2.terminate).toHaveBeenCalled();
      expect(mockWss.close).toHaveBeenCalled();
      expect(webSocketServer.getActiveSessionCount()).toBe(0);
    });

    it('should handle shutdown errors gracefully', () => {
      mockWss.close = vi.fn((callback) => {
        callback(new Error('Close failed'));
      });

      webSocketServer.shutdown();

      expect(logger.error).toHaveBeenCalledWith(
        '[WebSocketServer] Error closing WebSocket server:', 
        expect.objectContaining({ err: expect.any(Error) })
      );
    });
  });

  describe('translation persistence', () => {
    it('should persist translations when logging is enabled', async () => {
      // Enable detailed logging
      process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';

      // Setup teacher and student
      const teacherWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      const studentWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      
      (webSocketServer as any).connections = new Set([teacherWs, studentWs]);
      (webSocketServer as any).roles = new Map([
        [teacherWs, 'teacher'],
        [studentWs, 'student']
      ]);
      (webSocketServer as any).languages = new Map([
        [teacherWs, 'en-US'],
        [studentWs, 'es-ES']
      ]);
      (webSocketServer as any).sessionIds = new Map([
        [teacherWs, 'session-1'],
        [studentWs, 'session-1']
      ]);

      mockWss.emit('connection', teacherWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      const teacherOnCalls = (teacherWs.on as any).mock.calls;
      const teacherMessageCall = teacherOnCalls.find((call: any[]) => call[0] === 'message');
      const teacherMessageHandler = teacherMessageCall?.[1];

      await teacherMessageHandler(JSON.stringify({
        type: 'transcription',
        text: 'Hello students'
      }));

      await vi.waitFor(() => {
        expect(mockStorage.addTranslation).toHaveBeenCalledWith({
          sessionId: 'session-1',
          sourceLanguage: 'en-US',
          targetLanguage: 'es-ES',
          originalText: 'Hello students',
          translatedText: 'translated test',
          latency: expect.any(Number)
        });
      });

      // Clean up
      delete process.env.ENABLE_DETAILED_TRANSLATION_LOGGING;
    });

    it('should skip translation persistence when logging is disabled', async () => {
      // Ensure logging is disabled
      process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'false';

      // Setup teacher and student (same as above)
      const teacherWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      const studentWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      
      (webSocketServer as any).connections = new Set([teacherWs, studentWs]);
      (webSocketServer as any).roles = new Map([
        [teacherWs, 'teacher'],
        [studentWs, 'student']
      ]);
      (webSocketServer as any).languages = new Map([
        [teacherWs, 'en-US'],
        [studentWs, 'es-ES']
      ]);

      mockWss.emit('connection', teacherWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      const teacherOnCalls = (teacherWs.on as any).mock.calls;
      const teacherMessageCall = teacherOnCalls.find((call: any[]) => call[0] === 'message');
      const teacherMessageHandler = teacherMessageCall?.[1];

      vi.clearAllMocks();

      await teacherMessageHandler(JSON.stringify({
        type: 'transcription',
        text: 'Hello students'
      }));

      await vi.waitFor(() => {
        expect(logger.info).toHaveBeenCalledWith(
          'WebSocketServer: Detailed translation logging is disabled via environment variable ENABLE_DETAILED_TRANSLATION_LOGGING, skipping storage.addTranslation'
        );
      });

      expect(mockStorage.addTranslation).not.toHaveBeenCalled();

      // Clean up
      delete process.env.ENABLE_DETAILED_TRANSLATION_LOGGING;
    });
  });

  describe('connection confirmation errors', () => {
    it('should handle send connection confirmation errors gracefully', async () => {
      const errorWs = { 
        ...mockWs, 
        send: vi.fn().mockImplementation(() => {
          throw new Error('Send failed');
        }),
        on: vi.fn()
      };

      mockWss.emit('connection', errorWs, { url: '/ws', headers: { host: 'localhost:3000' } });

      // Should not throw despite send error
      expect(logger.error).toHaveBeenCalledWith(
        'Error sending connection confirmation:', 
        { error: expect.any(Error) }
      );
    });
  });

  describe('session storage edge cases', () => {
    it('should handle existing active session in storage', async () => {
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
        sessionId: 'existing-session',
        isActive: true
      });

      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });

      await vi.waitFor(() => {
        expect(mockStorage.getSessionById).toHaveBeenCalled();
        expect(mockStorage.updateSession).not.toHaveBeenCalled();
        expect(mockStorage.createSession).not.toHaveBeenCalled();
      });
    });

    it('should activate existing inactive session in storage', async () => {
      mockStorage.getSessionById = vi.fn().mockResolvedValue({
        sessionId: 'existing-session',
        isActive: false
      });

      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });

      await vi.waitFor(() => {
        expect(mockStorage.getSessionById).toHaveBeenCalled();
        expect(mockStorage.updateSession).toHaveBeenCalledWith(
          expect.any(String),
          { isActive: true }
        );
        expect(mockStorage.createSession).not.toHaveBeenCalled();
      });
    });
  });

  describe('message handling - pong', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.send).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should handle pong message type', async () => {
      await messageHandler(JSON.stringify({
        type: 'pong'
      }));

      // Pong messages should be handled without error but no specific response
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  describe('role change handling', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.send).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should log role change when registering with different role', async () => {
      // First register as student
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }));

      vi.clearAllMocks();

      // Then register as teacher
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      expect(logger.info).toHaveBeenCalledWith(
        'Changing connection role from student to teacher'
      );
    });
  });

  describe('TTS response edge cases', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.send).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should handle browser speech synthesis marker', async () => {
      vi.mocked(speechTranslationService.translateSpeech).mockResolvedValueOnce({
        originalText: 'Hello',
        translatedText: 'Hello',
        audioBuffer: Buffer.from('{"type":"browser-speech","text":"Hello","language":"en-US"}')
      });

      await messageHandler(JSON.stringify({
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      }));

      await vi.waitFor(() => {
        const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
        const response = JSON.parse(lastCall[0]);
        expect(response.type).toBe('tts_response');
        expect(response.useClientSpeech).toBe(true);
        expect(response.audioData).toBeUndefined();
      });
    });

    it('should handle TTS response send error gracefully', async () => {
      // First setup the connection as teacher
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        language: 'en-US'
      }));

      // Clear mock calls from registration
      vi.clearAllMocks();
      
      // Mock send to fail when sending TTS response
      mockWs.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      vi.mocked(speechTranslationService.translateSpeech).mockResolvedValueOnce({
        originalText: 'Hello',
        translatedText: 'Hello',
        audioBuffer: Buffer.from('audio data')
      });

      await messageHandler(JSON.stringify({
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      }));

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Error sending TTS response:', 
          { error: expect.any(Error) }
        );
      });
    });

    it('should handle TTS error response send failure', async () => {
      // First setup the connection as any role
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        language: 'en-US'
      }));

      // Clear mock calls from registration
      vi.clearAllMocks();
      
      // Mock send to fail on any call (including error response)
      mockWs.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      await messageHandler(JSON.stringify({
        type: 'tts_request',
        text: '',
        languageCode: 'en-US'
      }));

      await vi.waitFor(() => {
        expect(logger.error).toHaveBeenCalledWith(
          'Error sending TTS error response:', 
          { error: expect.any(Error) }
        );
      });
    });
  });

  describe('audio validation edge cases', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.send).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];

      // Register as teacher
      await messageHandler(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
    });

    it('should ignore audio with small buffer after base64 decode', async () => {
      // Send audio that decodes to small buffer
      const smallBase64Audio = Buffer.from('tiny').toString('base64');
      
      await messageHandler(JSON.stringify({
        type: 'audio',
        data: smallBase64Audio
      }));

      expect(logger.debug).not.toHaveBeenCalledWith(
        'Received audio chunk from teacher, using client-side transcription'
      );
    });

    it('should handle missing sessionId gracefully', async () => {
      // Clear the sessionId
      (webSocketServer as any).sessionIds.delete(mockWs);

      const audioData = Buffer.from('a'.repeat(200)).toString('base64');
      await messageHandler(JSON.stringify({
        type: 'audio',
        data: audioData
      }));

      expect(logger.error).toHaveBeenCalledWith(
        'No session ID found for teacher'
      );
    });
  });

  describe('empty TTS generation', () => {
    let messageHandler: (data: any) => void;

    beforeEach(async () => {
      mockWss.emit('connection', mockWs, { url: '/ws', headers: { host: 'localhost:3000' } });
      await vi.waitFor(() => {
        expect(mockWs.send).toHaveBeenCalled();
      });
      
      const onCalls = (mockWs.on as any).mock.calls;
      const messageCall = onCalls.find((call: any[]) => call[0] === 'message');
      messageHandler = messageCall?.[1];
    });

    it('should handle empty TTS audio buffer', async () => {
      vi.mocked(speechTranslationService.translateSpeech).mockResolvedValueOnce({
        originalText: 'Hello',
        translatedText: 'Hello',
        audioBuffer: Buffer.from('')
      });

      await messageHandler(JSON.stringify({
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      }));

      await vi.waitFor(() => {
        const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
        const response = JSON.parse(lastCall[0]);
        expect(response.type).toBe('tts_response');
        expect(response.status).toBe('error');
        expect(response.error.message).toBe('Failed to generate audio');
      });
    });
  });

  describe('getActiveSessionMetrics edge cases', () => {
    it('should handle connection without sessionId', () => {
      const testWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      
      // Add connection without sessionId
      (webSocketServer as any).connections.add(testWs);
      (webSocketServer as any).roles.set(testWs, 'student');
      (webSocketServer as any).languages.set(testWs, 'es-ES');
      // Intentionally don't set sessionId

      const metrics = webSocketServer.getActiveSessionMetrics();
      
      expect(metrics.studentsConnected).toBe(1);
      expect(metrics.activeSessions).toBe(0); // No sessions since no sessionId
    });

    it('should handle teacher language in metrics', () => {
      const teacherWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      const studentWs = { ...mockWs, send: vi.fn(), on: vi.fn() };
      
      (webSocketServer as any).connections = new Set([teacherWs, studentWs]);
      (webSocketServer as any).roles = new Map([
        [teacherWs, 'teacher'],
        [studentWs, 'student']
      ]);
      (webSocketServer as any).languages = new Map([
        [teacherWs, 'en-US'],
        [studentWs, 'es-ES']
      ]);
      (webSocketServer as any).sessionIds = new Map([
        [teacherWs, 'session-1'],
        [studentWs, 'session-1']
      ]);

      const metrics = webSocketServer.getActiveSessionMetrics();
      
      expect(metrics.currentLanguages).toContain('en-US');
      expect(metrics.teachersConnected).toBe(1);
      expect(metrics.studentsConnected).toBe(1);
    });
  });
});