/**
 * Tests for the SpeechRecognitionService
 * 
 * This tests the core speech recognition service that uses Web Speech API
 */
import { SpeechRecognitionService } from '../../../client/src/services/SpeechRecognitionService';

// Mock the Web Speech API
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  maxAlternatives = 1;
  
  start = jest.fn();
  stop = jest.fn();
  abort = jest.fn();
  
  // Event handlers
  onstart: Function | null = null;
  onend: Function | null = null;
  onresult: Function | null = null;
  onerror: Function | null = null;
}

// Setup the mock before tests
beforeEach(() => {
  // Store original implementation
  const originalSpeechRecognition = global.SpeechRecognition;
  const originalWebkitSpeechRecognition = global.webkitSpeechRecognition;
  
  // Mock implementation
  global.SpeechRecognition = MockSpeechRecognition as any;
  global.webkitSpeechRecognition = MockSpeechRecognition as any;
  
  // Return cleanup function
  return () => {
    global.SpeechRecognition = originalSpeechRecognition;
    global.webkitSpeechRecognition = originalWebkitSpeechRecognition;
  };
});

describe('SpeechRecognitionService', () => {
  test('should create an instance', () => {
    const service = new SpeechRecognitionService();
    expect(service).toBeDefined();
  });
  
  test('should detect support for Web Speech API', () => {
    const service = new SpeechRecognitionService();
    expect(service.isSupported()).toBe(true);
  });
  
  test('should start speech recognition', async () => {
    const service = new SpeechRecognitionService();
    const result = await service.start();
    
    expect(result).toBe(true);
    // Verify the mock was called
    const recognition = service['recognition'] as MockSpeechRecognition;
    expect(recognition.start).toHaveBeenCalled();
  });
  
  test('should stop speech recognition', async () => {
    const service = new SpeechRecognitionService();
    await service.start();
    const result = service.stop();
    
    expect(result).toBe(true);
    // Verify the mock was called
    const recognition = service['recognition'] as MockSpeechRecognition;
    expect(recognition.stop).toHaveBeenCalled();
  });
  
  test('should emit result events when speech is detected', async () => {
    const service = new SpeechRecognitionService();
    const onResultMock = jest.fn();
    
    // Register listener
    service.on('result', onResultMock);
    
    // Start recognition
    await service.start();
    
    // Simulate a speech recognition result
    const recognitionEvent = {
      resultIndex: 0,
      results: [
        {
          isFinal: true,
          [0]: {
            transcript: 'Hello world',
            confidence: 0.9
          }
        }
      ]
    };
    
    // Trigger the onresult handler
    const recognition = service['recognition'] as MockSpeechRecognition;
    recognition.onresult && recognition.onresult(recognitionEvent);
    
    // Verify that the result was emitted to the listener
    expect(onResultMock).toHaveBeenCalledWith({
      text: 'Hello world',
      isFinal: true,
      language: 'en-US',
      confidence: 0.9
    });
  });
  
  test('should allow language to be changed', () => {
    const service = new SpeechRecognitionService();
    service.setLanguage('es-ES');
    
    // Verify language was set
    expect(service.getLanguage()).toBe('es-ES');
    
    // Verify language was set on the recognition instance
    const recognition = service['recognition'] as MockSpeechRecognition;
    expect(recognition.lang).toBe('es-ES');
  });
});