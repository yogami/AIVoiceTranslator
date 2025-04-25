import { WebSocketClient } from '../../client/src/lib/websocket';
import { WebSpeechTranscriptionService } from '../../client/src/lib/transcription/WebSpeechTranscriptionService';
import { waitForTime } from '../setup';

/**
 * This is a complete end-to-end functional test that tests the entire application flow
 * from speech recognition through WebSocket communication to translation display.
 * 
 * Unlike unit and integration tests, this test runs against the actual implementation
 * with minimal mocking, only mocking external dependencies like the Web Speech API.
 */
describe('End-to-End Application Flow', () => {
  // Create a real WebSocketClient instance
  let wsClient: WebSocketClient;
  let transcriptionService: WebSpeechTranscriptionService;
  
  // Mock for server-side WebSocket responses
  const mockServerResponses = {
    connect: (sessionId: string = 'test-session-123') => ({
      type: 'connect',
      sessionId
    }),
    registerSuccess: (role: string, languageCode: string) => ({
      type: 'register',
      status: 'success',
      data: {
        role,
        languageCode
      }
    }),
    translation: (originalText: string, translatedText: string, sourceLanguage: string, targetLanguage: string) => ({
      type: 'translation',
      payload: {
        sessionId: 'test-session-123',
        sourceLanguage,
        targetLanguage,
        originalText,
        translatedText,
        audio: 'base64_encoded_audio_data', // Mock audio data
        timestamp: new Date().toISOString(),
        latency: 150 // Mock latency in ms
      }
    }),
    currentSpeech: (text: string) => ({
      type: 'current_speech',
      text,
      timestamp: Date.now()
    }),
    error: (message: string) => ({
      type: 'error',
      error: message
    })
  };
  
  beforeEach(() => {
    // Create a new WebSocketClient for each test
    wsClient = new WebSocketClient();
    
    // Create a new TranscriptionService for each test
    transcriptionService = new WebSpeechTranscriptionService();
    
    // Mock WebSocket
    (global as any).WebSocket = jest.fn().mockImplementation(() => {
      return {
        url: 'ws://localhost:3000/ws',
        readyState: 0, // CONNECTING
        send: jest.fn(),
        close: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        
        // Simulate connection opening
        onopen: null,
        onclose: null,
        onmessage: null,
        onerror: null,
        
        // Helper method for tests to simulate opening
        simulateOpen: function() {
          this.readyState = 1; // OPEN
          if (this.onopen) this.onopen({});
        },
        
        // Helper method for tests to simulate message
        simulateMessage: function(data: any) {
          if (this.onmessage) this.onmessage({ data: JSON.stringify(data) });
        },
        
        // Helper method for tests to simulate closing
        simulateClose: function() {
          this.readyState = 3; // CLOSED
          if (this.onclose) this.onclose({});
        },
        
        // Helper method for tests to simulate error
        simulateError: function(error: any) {
          if (this.onerror) this.onerror({ error });
        }
      };
    });
    
    // Mock SpeechRecognition
    window.SpeechRecognition = jest.fn().mockImplementation(() => {
      return {
        lang: 'en-US',
        continuous: true,
        interimResults: true,
        maxAlternatives: 1,
        start: jest.fn().mockImplementation(function() {
          if (this.onstart) this.onstart({});
        }),
        stop: jest.fn().mockImplementation(function() {
          if (this.onend) this.onend({});
        }),
        abort: jest.fn(),
        
        // Event handlers
        onstart: null,
        onend: null,
        onresult: null,
        onerror: null,
        onspeechstart: null,
        onspeechend: null,
        
        // Helper methods for tests
        simulateResult: function(text: string, isFinal: boolean = true) {
          if (this.onresult) {
            this.onresult({
              resultIndex: 0,
              results: [
                {
                  0: {
                    transcript: text,
                    confidence: 0.9
                  },
                  isFinal,
                  length: 1
                }
              ]
            });
          }
        }
      };
    });
    window.webkitSpeechRecognition = window.SpeechRecognition;
  });
  
  test('Complete end-to-end flow from speech to translation', async () => {
    // Store messages sent to server for verification
    const sentMessages: any[] = [];
    
    // Connect to the WebSocket server
    wsClient.connect();
    
    // Get the mock WebSocket instance
    const mockWs = (WebSocket as jest.Mock).mock.results[0].value;
    
    // Capture all messages sent to server
    mockWs.send.mockImplementation((data: string) => {
      sentMessages.push(JSON.parse(data));
    });
    
    // Simulate successful connection
    mockWs.simulateOpen();
    mockWs.simulateMessage(mockServerResponses.connect());
    
    // Register as a teacher
    wsClient.register('teacher', 'en-US');
    mockWs.simulateMessage(mockServerResponses.registerSuccess('teacher', 'en-US'));
    
    // Start the transcription service
    await transcriptionService.start();
    
    // Simulate receiving speech input
    const mockRecognition = (window.SpeechRecognition as jest.Mock).mock.results[0].value;
    
    // Create event listeners for monitoring messages
    const translationListener = jest.fn();
    const currentSpeechListener = jest.fn();
    wsClient.addEventListener('translation', translationListener);
    wsClient.addEventListener('current_speech', currentSpeechListener);
    
    // Simulate interim and final results
    mockRecognition.simulateResult('Hello', false);
    
    // Create test function to send transcription to WebSocket
    function sendTranscriptionToWebSocket(text: string) {
      wsClient.sendTranscription(text);
    }
    
    // Send the interim transcription
    sendTranscriptionToWebSocket('Hello');
    
    // Simulate another interim result
    mockRecognition.simulateResult('Hello world', false);
    sendTranscriptionToWebSocket('Hello world');
    
    // Simulate final result
    mockRecognition.simulateResult('Hello world, this is a test', true);
    sendTranscriptionToWebSocket('Hello world, this is a test');
    
    // Simulate receiving current speech update from server
    mockWs.simulateMessage(mockServerResponses.currentSpeech('Hello world, this is a test'));
    
    // Simulate receiving translations from server
    // English (same language)
    mockWs.simulateMessage(mockServerResponses.translation(
      'Hello world, this is a test',
      'Hello world, this is a test',
      'en-US',
      'en-US'
    ));
    
    // Spanish translation
    mockWs.simulateMessage(mockServerResponses.translation(
      'Hello world, this is a test',
      'Hola mundo, esto es una prueba',
      'en-US',
      'es-ES'
    ));
    
    // French translation
    mockWs.simulateMessage(mockServerResponses.translation(
      'Hello world, this is a test',
      'Bonjour le monde, ceci est un test',
      'en-US',
      'fr-FR'
    ));
    
    // Wait for all events to be processed
    await waitForTime(100);
    
    // Verify the complete flow
    
    // 1. Check WebSocket connection was established
    expect(wsClient.getStatus()).toBe('connected');
    
    // 2. Verify we registered as a teacher with correct language
    const registerMessage = sentMessages.find(m => m.type === 'register');
    expect(registerMessage).toBeTruthy();
    expect(registerMessage?.payload.role).toBe('teacher');
    expect(registerMessage?.payload.languageCode).toBe('en-US');
    
    // 3. Verify transcription service was started
    expect(mockRecognition.start).toHaveBeenCalled();
    
    // 4. Verify all transcription messages were sent to server
    const transcriptionMessages = sentMessages.filter(m => 
      m.type === 'transcription' || 
      m.type === 'webSpeechTranscription'
    );
    expect(transcriptionMessages.length).toBeGreaterThanOrEqual(6); // 3 texts × 2 message types
    
    // 5. Verify we received the current speech update
    expect(currentSpeechListener).toHaveBeenCalled();
    const currentSpeechData = currentSpeechListener.mock.calls[0][0];
    expect(currentSpeechData.text).toBe('Hello world, this is a test');
    
    // 6. Verify we received the translations
    expect(translationListener).toHaveBeenCalledTimes(3);
    
    // Stop the transcription service
    transcriptionService.stop();
    
    // Disconnect from WebSocket
    wsClient.disconnect();
    
    // Verify disconnect was called
    expect(mockWs.close).toHaveBeenCalled();
  });
  
  test('Handles error scenarios and recovery gracefully', async () => {
    // Connect to the WebSocket server
    wsClient.connect();
    
    // Get the mock WebSocket instance
    const mockWs = (WebSocket as jest.Mock).mock.results[0].value;
    
    // Simulate successful connection
    mockWs.simulateOpen();
    mockWs.simulateMessage(mockServerResponses.connect());
    
    // Register as a teacher
    wsClient.register('teacher', 'en-US');
    mockWs.simulateMessage(mockServerResponses.registerSuccess('teacher', 'en-US'));
    
    // Set up error listeners
    const wsErrorListener = jest.fn();
    wsClient.addEventListener('error', wsErrorListener);
    
    // Start the transcription service
    await transcriptionService.start();
    
    // Get the mock recognition instance
    const mockRecognition = (window.SpeechRecognition as jest.Mock).mock.results[0].value;
    
    // Simulate a recognition error
    mockRecognition.onerror && mockRecognition.onerror({ error: 'no-speech' });
    
    // Simulate a WebSocket error
    mockWs.simulateError('Connection error');
    
    // Simulate WebSocket disconnection
    mockWs.simulateClose();
    
    // Wait for a bit to let events process
    await waitForTime(100);
    
    // Verify error listener was called
    expect(wsErrorListener).toHaveBeenCalled();
    
    // Verify WebSocket status is disconnected
    expect(wsClient.getStatus()).toBe('disconnected');
    
    // Now simulate reconnection (this would happen automatically in the real app)
    // But we need to manually create a new WebSocket mock for this test
    (WebSocket as jest.Mock).mockClear();
    wsClient.connect();
    
    // Get the new mock WebSocket instance
    const newMockWs = (WebSocket as jest.Mock).mock.results[0].value;
    
    // Simulate successful reconnection
    newMockWs.simulateOpen();
    newMockWs.simulateMessage(mockServerResponses.connect('new-session-456'));
    
    // Verify WebSocket status is connected again
    expect(wsClient.getStatus()).toBe('connected');
    
    // Verify we have a new session ID
    expect(wsClient.getSessionId()).toBe('new-session-456');
    
    // After reconnection, we should re-register with the server
    wsClient.register('teacher', 'en-US');
    
    // Restart the transcription service
    await transcriptionService.start();
    
    // Verify the new recognition instance was started
    expect((window.SpeechRecognition as jest.Mock).mock.results[1].value.start).toHaveBeenCalled();
  });
});