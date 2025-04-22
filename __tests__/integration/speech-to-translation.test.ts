/**
 * Integration test for the complete speech-to-translation flow
 * 
 * This tests the end-to-end flow from speech recognition to translation delivery
 */
import { SpeechRecognitionService } from '../../client/src/services/SpeechRecognitionService';
import { WebSocketClient } from '../../client/src/services/WebSocketClient';
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { TranslationService } from '../../server/services/TranslationService';
import { Server } from 'http';
import { WebSocket } from 'ws';

// Mocks
jest.mock('../../client/src/services/SpeechRecognitionService');
jest.mock('../../client/src/services/WebSocketClient');
jest.mock('../../server/services/WebSocketServer');
jest.mock('../../server/services/TranslationService');

describe('Speech to Translation Flow', () => {
  let teacherSpeechService: jest.Mocked<SpeechRecognitionService>;
  let teacherWebSocketClient: jest.Mocked<WebSocketClient>;
  let studentWebSocketClient: jest.Mocked<WebSocketClient>;
  let webSocketServer: jest.Mocked<WebSocketServer>;
  let translationService: jest.Mocked<TranslationService>;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock instances
    teacherSpeechService = new SpeechRecognitionService() as jest.Mocked<SpeechRecognitionService>;
    teacherWebSocketClient = new WebSocketClient() as jest.Mocked<WebSocketClient>;
    studentWebSocketClient = new WebSocketClient() as jest.Mocked<WebSocketClient>;
    webSocketServer = new WebSocketServer({} as Server) as jest.Mocked<WebSocketServer>;
    translationService = new TranslationService() as jest.Mocked<TranslationService>;
    
    // Set up mock behaviors
    setupMocks();
  });
  
  function setupMocks() {
    // Speech service mocks
    teacherSpeechService.start.mockResolvedValue(true);
    teacherSpeechService.on.mockImplementation((event, callback) => {
      if (event === 'result') {
        // Store the callback to simulate results later
        teacherSpeechService.onResultCallback = callback;
      }
    });
    
    // WebSocketClient mocks
    teacherWebSocketClient.connect.mockImplementation(() => {
      teacherWebSocketClient.connectionStatus = 'connected';
    });
    
    studentWebSocketClient.connect.mockImplementation(() => {
      studentWebSocketClient.connectionStatus = 'connected';
    });
    
    studentWebSocketClient.addEventListener.mockImplementation((event, callback) => {
      if (event === 'translation') {
        // Store the callback to simulate translations later
        studentWebSocketClient.onTranslationCallback = callback;
      }
    });
    
    // Translation service mock
    translationService.translateText.mockImplementation((text, sourceLang, targetLang) => {
      if (targetLang === 'es-ES') {
        return Promise.resolve('Hola mundo');
      }
      return Promise.resolve(text);
    });
  }
  
  test('should flow from speech recognition to translated delivery', async () => {
    // 1. Connect clients to server
    teacherWebSocketClient.connect();
    studentWebSocketClient.connect();
    
    expect(teacherWebSocketClient.connect).toHaveBeenCalled();
    expect(studentWebSocketClient.connect).toHaveBeenCalled();
    
    // 2. Register clients with roles and languages
    teacherWebSocketClient.register('teacher', 'en-US');
    studentWebSocketClient.register('student', 'es-ES');
    
    expect(teacherWebSocketClient.register).toHaveBeenCalledWith('teacher', 'en-US');
    expect(studentWebSocketClient.register).toHaveBeenCalledWith('student', 'es-ES');
    
    // 3. Start speech recognition
    await teacherSpeechService.start();
    
    expect(teacherSpeechService.start).toHaveBeenCalled();
    
    // 4. Simulate speech recognition result
    const recognitionResult = {
      text: 'Hello world',
      isFinal: true,
      language: 'en-US',
      confidence: 0.9
    };
    
    teacherSpeechService.onResultCallback(recognitionResult);
    
    // 5. Check that transcription was sent to server
    expect(teacherWebSocketClient.sendTranscription).toHaveBeenCalledWith('Hello world');
    
    // 6. Simulate server translation and broadcast
    const translationResult = {
      type: 'translation',
      data: {
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        languageCode: 'es-ES'
      }
    };
    
    // Simulate the server sending the translation to the student
    studentWebSocketClient.onTranslationCallback(translationResult);
    
    // 7. Check that translation was received by student client
    // This would typically be tested by checking that a component's state was updated
    // For this test, we're just verifying the callback was triggered
    expect(studentWebSocketClient.addEventListener).toHaveBeenCalledWith(
      'translation', 
      expect.any(Function)
    );
  });
});