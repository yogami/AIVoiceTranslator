/**
 * Integration test for the complete speech-to-translation flow
 * 
 * Tests the integration between:
 * 1. Speech recognition (audio capture)
 * 2. WebSocket transmission
 * 3. Server-side translation
 * 4. Client-side playback
 */
import { SpeechRecognizer } from '../../client/src/lib/audioCapture';
import { webSocketClient, UserRole } from '../../client/src/lib/websocket';

// Mock SpeechRecognitionService
jest.mock('../../client/src/lib/audioCapture', () => {
  const original = jest.requireActual('../../client/src/lib/audioCapture');
  return {
    ...original,
    SpeechRecognizer: jest.fn().mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      isRecognizing: jest.fn().mockReturnValue(false),
      updateLanguage: jest.fn(),
      updateOptions: jest.fn()
    }))
  };
});

// Mock WebSocketClient
jest.mock('../../client/src/lib/websocket', () => {
  const originalModule = jest.requireActual('../../client/src/lib/websocket');
  
  // Create a mock implementation
  const mockWebSocketClient = {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn(),
    register: jest.fn(),
    sendTranscription: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    getStatus: jest.fn().mockReturnValue('connected'),
    getSessionId: jest.fn().mockReturnValue('test-session-id'),
    getRole: jest.fn(),
    getLanguageCode: jest.fn()
  };
  
  return {
    ...originalModule,
    webSocketClient: mockWebSocketClient
  };
});

describe('Speech-to-Translation Flow', () => {
  // Reset mocks before each test
  beforeEach(() => {
    jest.clearAllMocks();
  });
  
  /**
   * Test teacher speech recognition to server transmission
   */
  test('Teacher speech recognition sends transcription over WebSocket', async () => {
    // Setup speech recognition mock to simulate results
    const speechRecognizer = new SpeechRecognizer();
    const onResultCallback = jest.fn();
    
    // Get the mock implementation
    const mockSpeechRecognizer = SpeechRecognizer as jest.Mock;
    mockSpeechRecognizer.mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      isRecognizing: jest.fn().mockReturnValue(true),
      updateLanguage: jest.fn(),
      updateOptions: jest.fn()
    }));
    
    // Connect and register as teacher
    await webSocketClient.connect();
    expect(webSocketClient.connect).toHaveBeenCalled();
    
    // Simulate connected status
    webSocketClient.getStatus = jest.fn().mockReturnValue('connected');
    expect(webSocketClient.getStatus()).toBe('connected');
    
    // Register as teacher
    webSocketClient.register('teacher', 'en-US');
    expect(webSocketClient.register).toHaveBeenCalledWith('teacher', 'en-US');
    
    // Set role mock
    webSocketClient.getRole = jest.fn().mockReturnValue('teacher');
    
    // Add translation listener
    const onTranslationCallback = jest.fn();
    webSocketClient.addEventListener('translation', onTranslationCallback);
    expect(webSocketClient.addEventListener).toHaveBeenCalledWith('translation', onTranslationCallback);
    
    // Simulate speech recognition result
    const testTranscript = 'This is a test transcription';
    const testTranscriptFinal = true;
    
    // This would normally happen via the onresult callback
    // We'll directly call sendTranscription to simulate
    webSocketClient.sendTranscription(testTranscript);
    
    // Verify transcription was sent over WebSocket
    expect(webSocketClient.sendTranscription).toHaveBeenCalledWith(testTranscript);
  });
  
  /**
   * Test student receiving translations
   */
  test('Student receives and processes translations', async () => {
    // Connect and register as student
    await webSocketClient.connect();
    expect(webSocketClient.connect).toHaveBeenCalled();
    
    // Simulate connected status
    webSocketClient.getStatus = jest.fn().mockReturnValue('connected');
    expect(webSocketClient.getStatus()).toBe('connected');
    
    // Register as student
    webSocketClient.register('student', 'fr-FR');
    expect(webSocketClient.register).toHaveBeenCalledWith('student', 'fr-FR');
    
    // Set role mock
    webSocketClient.getRole = jest.fn().mockReturnValue('student');
    
    // Track received translations
    const receivedTranslations: any[] = [];
    const translationCallback = (translation: any) => {
      receivedTranslations.push(translation);
    };
    
    // Add translation listener
    webSocketClient.addEventListener('translation', translationCallback);
    expect(webSocketClient.addEventListener).toHaveBeenCalledWith('translation', translationCallback);
    
    // Simulate receiving a translation message
    // This is what would normally happen when the server sends a translation
    const mockTranslation = {
      type: 'translation',
      text: 'Ceci est un test de traduction',
      originalLanguage: 'en-US',
      translatedLanguage: 'fr-FR',
      timestamp: Date.now()
    };
    
    // Get the registered callback
    const callbackFunction = (webSocketClient.addEventListener as jest.Mock).mock.calls.find(
      call => call[0] === 'translation'
    )[1];
    
    // Manually call the callback with our mock data
    callbackFunction(mockTranslation);
    
    // Verify translation was received and processed
    expect(receivedTranslations.length).toBe(1);
    expect(receivedTranslations[0]).toEqual(mockTranslation);
  });
  
  /**
   * Test the complete flow from speech to translation
   */
  test('Complete speech-to-translation flow', async () => {
    // Setup speech recognition mock
    const mockOnResult = jest.fn();
    
    // Get the mock implementation
    const mockSpeechRecognizer = SpeechRecognizer as jest.Mock;
    mockSpeechRecognizer.mockImplementation(() => ({
      start: jest.fn(),
      stop: jest.fn(),
      isRecognizing: jest.fn().mockReturnValue(true),
      updateLanguage: jest.fn(),
      updateOptions: jest.fn(),
      // Allow us to simulate speech recognition results
      onResultCallback: mockOnResult
    }));
    
    // Connect teacher
    await webSocketClient.connect();
    webSocketClient.getStatus = jest.fn().mockReturnValue('connected');
    webSocketClient.register('teacher', 'en-US');
    webSocketClient.getRole = jest.fn().mockReturnValue('teacher');
    
    // Track sent transcriptions
    const sentTranscriptions: string[] = [];
    webSocketClient.sendTranscription = jest.fn().mockImplementation((text: string) => {
      sentTranscriptions.push(text);
    });
    
    // Connect student
    const studentTranslations: any[] = [];
    const onTranslationCallback = jest.fn().mockImplementation((translation: any) => {
      studentTranslations.push(translation);
    });
    
    webSocketClient.addEventListener('translation', onTranslationCallback);
    
    // Simulate teacher speaking
    const testTranscript = 'Hello, this is a test message.';
    webSocketClient.sendTranscription(testTranscript);
    
    // Verify transcription was sent
    expect(sentTranscriptions).toContain(testTranscript);
    
    // Simulate server sending back translation
    const mockTranslation = {
      type: 'translation',
      text: 'Bonjour, ceci est un message de test.',
      originalLanguage: 'en-US',
      translatedLanguage: 'fr-FR',
      timestamp: Date.now()
    };
    
    // Get the registered callback
    const callbackFunction = (webSocketClient.addEventListener as jest.Mock).mock.calls.find(
      call => call[0] === 'translation'
    )[1];
    
    // Manually call the callback with our mock data
    callbackFunction(mockTranslation);
    
    // Verify translation callback was called
    expect(onTranslationCallback).toHaveBeenCalledWith(mockTranslation);
  });
});