/**
 * Tests for WebSocketServer
 * 
 * This tests the WebSocket server that handles real-time communication
 */
import { WebSocketServer } from '../../../server/services/WebSocketServer';
import { TranslationService } from '../../../server/services/TranslationService';
import { Server } from 'http';
import { WebSocket } from 'ws';

// Mock ws library
jest.mock('ws', () => {
  const EventEmitter = require('events');
  
  // Mock WebSocket server
  class MockWebSocketServer extends EventEmitter {
    constructor(options: any) {
      super();
      this.options = options;
      this.clients = new Set();
    }
    
    clients: Set<any> = new Set();
    options: any;
    
    handleUpgrade = jest.fn();
    on = jest.spyOn(EventEmitter.prototype, 'on');
    
    // Add a client to the set
    addMockClient(client: any) {
      this.clients.add(client);
      return client;
    }
  }
  
  // Mock individual WebSocket connection
  class MockWebSocket extends EventEmitter {
    readyState: number = 1; // OPEN
    send = jest.fn();
    close = jest.fn();
    ping = jest.fn();
    
    constructor() {
      super();
    }
  }
  
  return {
    WebSocketServer: MockWebSocketServer,
    WebSocket: MockWebSocket
  };
});

// Mock TranslationService
jest.mock('../../../server/services/TranslationService', () => {
  return {
    TranslationService: jest.fn().mockImplementation(() => {
      return {
        translateText: jest.fn().mockImplementation((text, sourceLang, targetLang) => {
          // Simple mock translation for testing
          if (targetLang === 'es-ES') return Promise.resolve('Hola mundo');
          if (targetLang === 'fr-FR') return Promise.resolve('Bonjour le monde');
          return Promise.resolve(text);
        }),
        translateTextToMultipleLanguages: jest.fn().mockResolvedValue({
          'es-ES': 'Hola mundo',
          'fr-FR': 'Bonjour le monde'
        })
      };
    })
  };
});

describe('WebSocketServer', () => {
  let mockServer: Server;
  let wss: WebSocketServer;
  
  beforeEach(() => {
    // Create a mock HTTP server
    mockServer = {} as Server;
    
    // Create a WebSocketServer instance
    wss = new WebSocketServer(mockServer);
  });
  
  test('should create an instance', () => {
    expect(wss).toBeDefined();
  });
  
  test('should initialize WebSocket server with correct path', () => {
    // Get the underlying ws server
    const wsServer = wss['wss'];
    
    // Verify it was initialized with the correct path
    expect(wsServer.options.path).toBe('/ws');
    expect(wsServer.options.server).toBe(mockServer);
  });
  
  test('should handle connection events', () => {
    // Get the underlying ws server
    const wsServer = wss['wss'];
    
    // Verify connection handler was set up
    expect(wsServer.on).toHaveBeenCalledWith('connection', expect.any(Function));
  });
  
  test('should handle client registration', () => {
    // Create a mock client
    const mockClient = new WebSocket() as any;
    mockClient.send = jest.fn();
    
    // Simulate a connection
    wss['handleConnection'](mockClient, { url: '/?role=teacher&language=en-US' } as any);
    
    // Simulate client registration message
    wss['handleMessage'](mockClient, JSON.stringify({
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US'
    }));
    
    // Verify client was added to internal tracking
    expect(wss['connections'].has(mockClient)).toBe(true);
    expect(wss['roles'].get(mockClient)).toBe('teacher');
    expect(wss['languages'].get(mockClient)).toBe('en-US');
    
    // Verify response was sent
    expect(mockClient.send).toHaveBeenCalledWith(
      expect.stringContaining('"type":"register"')
    );
    expect(mockClient.send).toHaveBeenCalledWith(
      expect.stringContaining('"status":"success"')
    );
  });
  
  test('should handle transcription from teacher and broadcast to students', async () => {
    // Mock translation service
    const translationService = new TranslationService();
    wss['translationService'] = translationService;
    
    // Create mock clients
    const teacherClient = new WebSocket() as any;
    teacherClient.send = jest.fn();
    
    const studentClient1 = new WebSocket() as any;
    studentClient1.send = jest.fn();
    
    const studentClient2 = new WebSocket() as any;
    studentClient2.send = jest.fn();
    
    // Simulate connections
    wss['handleConnection'](teacherClient, { url: '/?role=teacher&language=en-US' } as any);
    wss['handleConnection'](studentClient1, { url: '/?role=student&language=es-ES' } as any);
    wss['handleConnection'](studentClient2, { url: '/?role=student&language=fr-FR' } as any);
    
    // Register clients
    wss['handleMessage'](teacherClient, JSON.stringify({
      type: 'register',
      role: 'teacher',
      languageCode: 'en-US'
    }));
    
    wss['handleMessage'](studentClient1, JSON.stringify({
      type: 'register',
      role: 'student',
      languageCode: 'es-ES'
    }));
    
    wss['handleMessage'](studentClient2, JSON.stringify({
      type: 'register',
      role: 'student',
      languageCode: 'fr-FR'
    }));
    
    // Clear mock call history to focus on translation messages
    jest.clearAllMocks();
    
    // Simulate teacher sending transcription
    await wss['handleMessage'](teacherClient, JSON.stringify({
      type: 'transcription',
      text: 'Hello world'
    }));
    
    // Verify translations were sent to students
    expect(studentClient1.send).toHaveBeenCalledWith(
      expect.stringContaining('"translatedText":"Hola mundo"')
    );
    
    expect(studentClient2.send).toHaveBeenCalledWith(
      expect.stringContaining('"translatedText":"Bonjour le monde"')
    );
  });
});