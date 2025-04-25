import { MockWebSocketService } from '../mocks/webSocketService.mock';
import { MockTranscriptionService } from '../mocks/transcriptionService.mock';
import { waitForTime } from '../setup';

// Mock implementations
jest.mock('../../client/src/lib/websocket', () => {
  const originalModule = jest.requireActual('../../client/src/lib/websocket');
  
  return {
    ...originalModule,
    wsClient: MockWebSocketService.getInstance(),
  };
});

describe('Transcription and Translation Flow Integration Test', () => {
  let mockWebSocketService: MockWebSocketService;
  let mockTranscriptionService: MockTranscriptionService;
  
  beforeEach(() => {
    mockWebSocketService = MockWebSocketService.getInstance();
    mockWebSocketService.reset();
    
    mockTranscriptionService = new MockTranscriptionService();
    
    // Connect and set role to teacher
    mockWebSocketService.connect();
    mockWebSocketService.setRoleAndLock('teacher');
  });
  
  test('should properly transcribe speech and send to WebSocket service', async () => {
    // Arrange
    const transcriptionText = 'This is a test transcription';
    const transcriptionListener = jest.fn();
    
    mockWebSocketService.addEventListener('transcription', transcriptionListener);
    
    // Act - simulate transcription service generating a final result
    await mockTranscriptionService.start();
    mockTranscriptionService.simulateTranscriptionResult(transcriptionText, true);
    
    // Now simulate the sending of this transcription via WebSocket
    mockWebSocketService.sendTranscription(transcriptionText);
    
    // Assert - webSpeechTranscription and transcription messages should be sent
    const messageHistory = mockWebSocketService.getMessageHistory();
    
    // Should have a webSpeechTranscription message with the text
    const webSpeechMessage = messageHistory.find(m => m.type === 'webSpeechTranscription');
    expect(webSpeechMessage).toBeTruthy();
    expect(webSpeechMessage?.payload?.text).toBe(transcriptionText);
    
    // Should have a transcription message with the text
    const transcriptionMessage = messageHistory.find(m => m.type === 'transcription');
    expect(transcriptionMessage).toBeTruthy();
    expect(transcriptionMessage?.payload?.text).toBe(transcriptionText);
  });
  
  test('should send transcribed text to multiple language targets', async () => {
    // Arrange - create multiple student clients with different languages
    const studentEnglish = new MockWebSocketService();
    const studentSpanish = new MockWebSocketService();
    const studentFrench = new MockWebSocketService();
    
    await studentEnglish.connect();
    await studentSpanish.connect();
    await studentFrench.connect();
    
    studentEnglish.register('student', 'en-US');
    studentSpanish.register('student', 'es-ES');
    studentFrench.register('student', 'fr-FR');
    
    // Create listeners for translation events
    const englishListener = jest.fn();
    const spanishListener = jest.fn();
    const frenchListener = jest.fn();
    
    studentEnglish.addEventListener('translation', englishListener);
    studentSpanish.addEventListener('translation', spanishListener);
    studentFrench.addEventListener('translation', frenchListener);
    
    // Act - teacher sends a transcription
    const transcriptionText = 'This is a message in English';
    mockWebSocketService.sendTranscription(transcriptionText);
    
    // Simulate the server processing and sending translations to students
    // Note: In a real server, this would happen automatically after receiving the transcription
    
    // Simulate English translation (same as original)
    mockWebSocketService.simulateTranslation(
      'en-US', 'en-US', 
      transcriptionText, transcriptionText
    );
    
    // Simulate Spanish translation
    mockWebSocketService.simulateTranslation(
      'en-US', 'es-ES',
      transcriptionText, 'Este es un mensaje en inglés'
    );
    
    // Simulate French translation
    mockWebSocketService.simulateTranslation(
      'en-US', 'fr-FR',
      transcriptionText, 'Ceci est un message en anglais'
    );
    
    // Broadcast these translations to the appropriate students
    studentEnglish.simulateTranslation(
      'en-US', 'en-US', 
      transcriptionText, transcriptionText
    );
    
    studentSpanish.simulateTranslation(
      'en-US', 'es-ES',
      transcriptionText, 'Este es un mensaje en inglés'
    );
    
    studentFrench.simulateTranslation(
      'en-US', 'fr-FR',
      transcriptionText, 'Ceci est un message en anglais'
    );
    
    // Wait for all events to be processed
    await waitForTime(100);
    
    // Assert - each student should receive a translation in their language
    expect(englishListener).toHaveBeenCalled();
    expect(spanishListener).toHaveBeenCalled();
    expect(frenchListener).toHaveBeenCalled();
    
    // Check the translation content
    const englishTranslation = englishListener.mock.calls[0][0];
    const spanishTranslation = spanishListener.mock.calls[0][0];
    const frenchTranslation = frenchListener.mock.calls[0][0];
    
    expect(englishTranslation.payload.translatedText).toBe(transcriptionText);
    expect(spanishTranslation.payload.translatedText).toBe('Este es un mensaje en inglés');
    expect(frenchTranslation.payload.translatedText).toBe('Ceci est un message en anglais');
  });
  
  test('should handle continuous speech with interim and final results', async () => {
    // Arrange
    await mockTranscriptionService.start();
    
    // Create a listener for monitoring transcript messages
    const transcriptMessages: string[] = [];
    mockWebSocketService.addEventListener('transcription', (msg) => {
      if (msg?.payload?.text) {
        transcriptMessages.push(msg.payload.text);
      }
    });
    
    // Act - simulate a sequence of interim and final results
    // First interim result
    mockTranscriptionService.simulateTranscriptionResult('This is', false);
    mockWebSocketService.sendTranscription('This is');
    
    // Second interim result
    mockTranscriptionService.simulateTranscriptionResult('This is a test', false);
    mockWebSocketService.sendTranscription('This is a test');
    
    // Final result
    mockTranscriptionService.simulateTranscriptionResult('This is a test of continuous speech', true);
    mockWebSocketService.sendTranscription('This is a test of continuous speech');
    
    // Another speech segment starts
    mockTranscriptionService.simulateTranscriptionResult('It works', false);
    mockWebSocketService.sendTranscription('It works');
    
    // Final result of second segment
    mockTranscriptionService.simulateTranscriptionResult('It works with multiple segments', true);
    mockWebSocketService.sendTranscription('It works with multiple segments');
    
    // Assert
    expect(transcriptMessages).toHaveLength(5);
    expect(transcriptMessages[0]).toBe('This is');
    expect(transcriptMessages[1]).toBe('This is a test');
    expect(transcriptMessages[2]).toBe('This is a test of continuous speech');
    expect(transcriptMessages[3]).toBe('It works');
    expect(transcriptMessages[4]).toBe('It works with multiple segments');
    
    // Check if the WebSocket client sent the correct messages
    const messageHistory = mockWebSocketService.getMessageHistory();
    const transcriptionMessages = messageHistory.filter(m => m.type === 'transcription');
    expect(transcriptionMessages).toHaveLength(5);
  });
  
  test('should handle error scenarios gracefully', async () => {
    // Arrange
    mockTranscriptionService.setFailNextStart(true);
    
    // Create listeners for error events
    const transcriptionErrorListener = jest.fn();
    const wsErrorListener = jest.fn();
    
    mockTranscriptionService.on('error', transcriptionErrorListener);
    mockWebSocketService.addEventListener('error', wsErrorListener);
    
    // Act
    try {
      await mockTranscriptionService.start();
    } catch (err) {
      // Expected error
    }
    
    // Simulate WebSocket error
    mockWebSocketService.simulateError('Connection lost');
    
    // Assert
    expect(transcriptionErrorListener).toHaveBeenCalled();
    expect(wsErrorListener).toHaveBeenCalled();
    expect(mockTranscriptionService.getState()).toBe('error');
  });
  
  test('should recover from errors and continue operation', async () => {
    // Arrange - create an error scenario
    mockTranscriptionService.setFailNextStart(true);
    
    // Act - try to start and fail
    try {
      await mockTranscriptionService.start();
    } catch (err) {
      // Expected error
    }
    
    // Reset the failure flag and try again
    mockTranscriptionService.setFailNextStart(false);
    const success = await mockTranscriptionService.start();
    
    // Now simulate a WebSocket disconnect and reconnect
    mockWebSocketService.simulateDisconnect();
    await waitForTime(100);
    mockWebSocketService.simulateReconnect();
    
    // Assert
    expect(success).toBe(true);
    expect(mockTranscriptionService.getState()).toBe('recording');
    expect(mockWebSocketService.getStatus()).toBe('connected');
    
    // Check we can still send messages after recovery
    const testText = 'Recovered from error';
    mockTranscriptionService.simulateTranscriptionResult(testText, true);
    mockWebSocketService.sendTranscription(testText);
    
    const messageHistory = mockWebSocketService.getMessageHistory();
    const lastTranscription = messageHistory.reverse().find(m => m.type === 'transcription');
    expect(lastTranscription?.payload?.text).toBe(testText);
  });
});