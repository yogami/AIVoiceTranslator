/**
 * WebSocketServer Unit Tests
 * 
 * Using London School TDD approach with mocks and stubs
 */
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { speechTranslationService } from '../../server/services/TranslationService';
import { Server } from 'http';

// Mock dependencies
jest.mock('../../server/services/TranslationService', () => ({
  speechTranslationService: {
    translateSpeech: jest.fn()
  }
}));

// Mock the WS server
jest.mock('ws', () => ({
  WebSocketServer: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    handleUpgrade: jest.fn(),
    emit: jest.fn()
  }))
}));

// Mock WebSocket client type
type MockWebSocketClient = {
  isAlive: boolean;
  sessionId: string;
  on: jest.Mock;
  terminate: jest.Mock;
  ping: jest.Mock;
  send: jest.Mock;
};

// Helper to create mock clients
function createMockClient(sessionId: string = 'test-session-id'): MockWebSocketClient {
  return {
    isAlive: true,
    sessionId,
    on: jest.fn(),
    terminate: jest.fn(),
    ping: jest.fn(),
    send: jest.fn()
  };
}

describe('WebSocketServer', () => {
  let webSocketServer: WebSocketServer;
  let mockHttpServer: Server;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock HTTP server
    mockHttpServer = {} as Server;
    
    // Create WebSocketServer instance
    webSocketServer = new WebSocketServer(mockHttpServer);
  });

  describe('handleTranscriptionMessage', () => {
    // Testing the private method will require exposing it or testing through public methods
    // Let's test through the message handler
    
    // We'll test the smaller functions first - findTeacherTtsServiceType
    describe('findTeacherTtsServiceType', () => {
      it('should return the teacher preferred TTS service type when available', () => {
        // Prepare private data structures
        const mockTeacher = createMockClient('teacher-session');
        const mockStudent = createMockClient('student-session');
        
        // Use Reflection API to access and modify private properties
        const wss = webSocketServer as any;
        wss.connections = new Set([mockTeacher, mockStudent]);
        wss.roles.set(mockTeacher, 'teacher');
        wss.roles.set(mockStudent, 'student');
        wss.clientSettings.set(mockTeacher, { ttsServiceType: 'test-tts-service' });
        
        // Call the method
        const result = wss.findTeacherTtsServiceType();
        
        // Assertions
        expect(result).toBe('test-tts-service');
      });
      
      it('should return default TTS service type when no teacher preference is available', () => {
        // Prepare private data structures 
        const mockStudent = createMockClient('student-session');
        
        // Use Reflection API to access and modify private properties
        const wss = webSocketServer as any;
        wss.connections = new Set([mockStudent]);
        wss.roles.set(mockStudent, 'student');
        
        // Mock the environment variable
        const originalEnv = process.env.TTS_SERVICE_TYPE;
        process.env.TTS_SERVICE_TYPE = 'env-tts-service';
        
        // Call the method
        const result = wss.findTeacherTtsServiceType();
        
        // Assertions
        expect(result).toBe('env-tts-service');
        
        // Restore the environment
        process.env.TTS_SERVICE_TYPE = originalEnv;
      });
      
      it('should return browser as default when no teacher preference or env variable is available', () => {
        // Prepare private data structures 
        const mockStudent = createMockClient('student-session');
        
        // Use Reflection API to access and modify private properties
        const wss = webSocketServer as any;
        wss.connections = new Set([mockStudent]);
        wss.roles.set(mockStudent, 'student');
        
        // Mock the environment variable
        const originalEnv = process.env.TTS_SERVICE_TYPE;
        process.env.TTS_SERVICE_TYPE = undefined;
        
        // Call the method
        const result = wss.findTeacherTtsServiceType();
        
        // Assertions
        expect(result).toBe('browser');
        
        // Restore the environment
        process.env.TTS_SERVICE_TYPE = originalEnv;
      });
    });
    
    describe('getStudentConnections', () => {
      it('should return all student connections with their languages', () => {
        // Prepare private data structures
        const mockTeacher = createMockClient('teacher-session');
        const mockStudent1 = createMockClient('student1-session');
        const mockStudent2 = createMockClient('student2-session');
        const mockStudent3 = createMockClient('student3-session'); // Student without language
        
        // Use Reflection API to access and modify private properties
        const wss = webSocketServer as any;
        wss.connections = new Set([mockTeacher, mockStudent1, mockStudent2, mockStudent3]);
        wss.roles.set(mockTeacher, 'teacher');
        wss.roles.set(mockStudent1, 'student');
        wss.roles.set(mockStudent2, 'student');
        wss.roles.set(mockStudent3, 'student');
        wss.languages.set(mockTeacher, 'en-US');
        wss.languages.set(mockStudent1, 'es-ES');
        wss.languages.set(mockStudent2, 'fr-FR');
        // Student3 has no language set
        
        // Call the method
        const result = wss.getStudentConnections();
        
        // Assertions
        expect(result.connections).toHaveLength(2); // Only students with languages
        expect(result.languages).toHaveLength(2); // Unique languages
        expect(result.languages).toContain('es-ES');
        expect(result.languages).toContain('fr-FR');
      });
      
      it('should return empty arrays when no students are connected', () => {
        // Prepare private data structures
        const mockTeacher = createMockClient('teacher-session');
        
        // Use Reflection API to access and modify private properties
        const wss = webSocketServer as any;
        wss.connections = new Set([mockTeacher]);
        wss.roles.set(mockTeacher, 'teacher');
        wss.languages.set(mockTeacher, 'en-US');
        
        // Call the method
        const result = wss.getStudentConnections();
        
        // Assertions
        expect(result.connections).toHaveLength(0);
        expect(result.languages).toHaveLength(0);
      });
    });
    
    describe('translateToLanguages', () => {
      it('should translate text to each target language', async () => {
        // Mock the translation service
        const mockTranslationResult = {
          originalText: 'Hello',
          translatedText: 'Hola',
          audioBuffer: Buffer.from('test-audio')
        };
        
        (speechTranslationService.translateSpeech as jest.Mock).mockResolvedValue(mockTranslationResult);
        
        // Prepare parameters
        const text = 'Hello';
        const teacherLanguage = 'en-US';
        const targetLanguages = ['es-ES', 'fr-FR'];
        const ttsServiceType = 'test-tts-service';
        
        // Use Reflection API to access private method
        const wss = webSocketServer as any;
        
        // Call the method
        const result = await wss.translateToLanguages(text, teacherLanguage, targetLanguages, ttsServiceType);
        
        // Assertions
        expect(speechTranslationService.translateSpeech).toHaveBeenCalledTimes(2);
        expect(result.translations['es-ES']).toBe('Hola');
        expect(result.translations['fr-FR']).toBe('Hola');
        expect(result.translationResults['es-ES']).toEqual(mockTranslationResult);
        expect(result.translationResults['fr-FR']).toEqual(mockTranslationResult);
      });
      
      it('should handle translation errors gracefully', async () => {
        // Mock the translation service to throw for one language
        (speechTranslationService.translateSpeech as jest.Mock)
          .mockImplementation((buffer, sourceLanguage, targetLanguage) => {
            if (targetLanguage === 'fr-FR') {
              throw new Error('Translation error');
            }
            return {
              originalText: 'Hello',
              translatedText: 'Hola',
              audioBuffer: Buffer.from('test-audio')
            };
          });
        
        // Prepare parameters
        const text = 'Hello';
        const teacherLanguage = 'en-US';
        const targetLanguages = ['es-ES', 'fr-FR'];
        const ttsServiceType = 'test-tts-service';
        
        // Use Reflection API to access private method
        const wss = webSocketServer as any;
        
        // Call the method
        const result = await wss.translateToLanguages(text, teacherLanguage, targetLanguages, ttsServiceType);
        
        // Assertions
        expect(result.translations['es-ES']).toBe('Hola');
        expect(result.translations['fr-FR']).toBe('Hello'); // Fallback to original text
        expect(result.translationResults['es-ES'].translatedText).toBe('Hola');
        expect(result.translationResults['fr-FR'].translatedText).toBe('Hello'); // Fallback
      });
    });
    
    describe('createTranslationMessage', () => {
      it('should create a translation message with browser speech data', () => {
        // Prepare test data
        const originalText = 'Hello';
        const translatedText = 'Hola';
        const sourceLanguage = 'en-US';
        const targetLanguage = 'es-ES';
        const ttsServiceType = 'browser';
        const audioBuffer = Buffer.from(JSON.stringify({
          type: 'browser-speech',
          text: translatedText,
          languageCode: targetLanguage,
          autoPlay: true
        }));
        
        // Prepare translation results
        const translationResults = {
          [targetLanguage]: {
            originalText,
            translatedText,
            audioBuffer
          }
        };
        
        // Use Reflection API to access private method
        const wss = webSocketServer as any;
        
        // Call the method
        const result = wss.createTranslationMessage(
          originalText,
          translatedText,
          sourceLanguage,
          targetLanguage,
          ttsServiceType,
          translationResults
        );
        
        // Assertions
        expect(result.type).toBe('translation');
        expect(result.text).toBe(translatedText);
        expect(result.originalText).toBe(originalText);
        expect(result.useClientSpeech).toBe(true);
        expect(result.speechParams.type).toBe('browser-speech');
      });
      
      it('should create a translation message with audio data', () => {
        // Prepare test data
        const originalText = 'Hello';
        const translatedText = 'Hola';
        const sourceLanguage = 'en-US';
        const targetLanguage = 'es-ES';
        const ttsServiceType = 'openai';
        const audioBuffer = Buffer.from('test-audio-data');
        
        // Prepare translation results
        const translationResults = {
          [targetLanguage]: {
            originalText,
            translatedText,
            audioBuffer
          }
        };
        
        // Use Reflection API to access private method
        const wss = webSocketServer as any;
        
        // Call the method
        const result = wss.createTranslationMessage(
          originalText,
          translatedText,
          sourceLanguage,
          targetLanguage,
          ttsServiceType,
          translationResults
        );
        
        // Assertions
        expect(result.type).toBe('translation');
        expect(result.text).toBe(translatedText);
        expect(result.audioData).toBe(audioBuffer.toString('base64'));
        expect(result.useClientSpeech).toBe(false);
      });
    });
    
    describe('sendTranslationsToStudents', () => {
      it('should send translations to each student with the correct language', () => {
        // Prepare mock clients and data structures
        const mockStudent1 = createMockClient('student1-session');
        const mockStudent2 = createMockClient('student2-session');
        
        // Use Reflection API to access and modify private properties
        const wss = webSocketServer as any;
        wss.languages.set(mockStudent1, 'es-ES');
        wss.languages.set(mockStudent2, 'fr-FR');
        
        // Prepare translations and results
        const translations = {
          'es-ES': 'Hola',
          'fr-FR': 'Bonjour'
        };
        
        const translationResults = {
          'es-ES': {
            originalText: 'Hello',
            translatedText: 'Hola',
            audioBuffer: Buffer.from('spanish-audio')
          },
          'fr-FR': {
            originalText: 'Hello',
            translatedText: 'Bonjour',
            audioBuffer: Buffer.from('french-audio')
          }
        };
        
        // Call the method
        wss.sendTranslationsToStudents(
          [mockStudent1, mockStudent2],
          'Hello',
          'en-US',
          translations,
          translationResults,
          'browser'
        );
        
        // Assertions
        expect(mockStudent1.send).toHaveBeenCalledTimes(1);
        expect(mockStudent2.send).toHaveBeenCalledTimes(1);
        
        // Check that correct translation was sent to each student
        const messageToStudent1 = JSON.parse(mockStudent1.send.mock.calls[0][0]);
        const messageToStudent2 = JSON.parse(mockStudent2.send.mock.calls[0][0]);
        
        expect(messageToStudent1.text).toBe('Hola');
        expect(messageToStudent2.text).toBe('Bonjour');
      });
    });
  });
});
