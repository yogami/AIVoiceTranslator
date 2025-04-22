import { WebSpeechTranscriptionService } from '../../../client/src/lib/transcription/WebSpeechTranscriptionService';

// Mock SpeechRecognition
class MockSpeechRecognition {
  continuous: boolean = false;
  interimResults: boolean = false;
  lang: string = 'en-US';
  maxAlternatives: number = 1;
  start = jest.fn();
  stop = jest.fn();
  abort = jest.fn();
  
  // Event handlers
  onstart: ((event: any) => void) | null = null;
  onend: ((event: any) => void) | null = null;
  onresult: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  onspeechstart: ((event: any) => void) | null = null;
  onspeechend: ((event: any) => void) | null = null;
  onaudiostart: ((event: any) => void) | null = null;
  onaudioend: ((event: any) => void) | null = null;
  onnomatch: ((event: any) => void) | null = null;
  onsoundstart: ((event: any) => void) | null = null;
  onsoundend: ((event: any) => void) | null = null;
}

// Mock the SpeechRecognition constructor
const originalSpeechRecognition = window.SpeechRecognition;
const originalWebkitSpeechRecognition = window.webkitSpeechRecognition;

describe('WebSpeechTranscriptionService', () => {
  let service: WebSpeechTranscriptionService;
  let mockRecognition: MockSpeechRecognition;

  beforeEach(() => {
    mockRecognition = new MockSpeechRecognition();
    
    // Mock the SpeechRecognition constructor
    window.SpeechRecognition = jest.fn(() => mockRecognition) as unknown as typeof SpeechRecognition;
    window.webkitSpeechRecognition = jest.fn(() => mockRecognition) as unknown as typeof webkitSpeechRecognition;
    
    // Create a new service instance for each test
    service = new WebSpeechTranscriptionService();
  });

  afterEach(() => {
    // Restore original SpeechRecognition
    window.SpeechRecognition = originalSpeechRecognition;
    window.webkitSpeechRecognition = originalWebkitSpeechRecognition;
  });

  describe('constructor', () => {
    test('should create a new instance with default properties', () => {
      // Assert
      expect(service).toBeDefined();
      expect(service.getState()).toBe('inactive');
      expect(service.getLanguage()).toBe('en-US');
    });
  });

  describe('isSupported', () => {
    test('should return true when SpeechRecognition is available', () => {
      // Assert
      expect(service.isSupported()).toBe(true);
    });

    test('should return false when SpeechRecognition is not available', () => {
      // Arrange
      window.SpeechRecognition = undefined as any;
      window.webkitSpeechRecognition = undefined as any;
      
      // Act
      const result = service.isSupported();
      
      // Assert
      expect(result).toBe(false);
    });
  });

  describe('start', () => {
    test('should start speech recognition when supported', async () => {
      // Arrange
      const startCallback = jest.fn();
      service.on('start', startCallback);
      
      // Act
      const result = await service.start();
      
      // Simulate recognition starting
      if (mockRecognition.onstart) {
        mockRecognition.onstart({});
      }
      
      // Assert
      expect(result).toBe(true);
      expect(mockRecognition.start).toHaveBeenCalled();
      expect(startCallback).toHaveBeenCalled();
      expect(service.getState()).toBe('recording');
    });

    test('should fail to start when not supported', async () => {
      // Arrange
      jest.spyOn(service, 'isSupported').mockReturnValue(false);
      const errorCallback = jest.fn();
      service.on('error', errorCallback);
      
      // Act
      const result = await service.start();
      
      // Assert
      expect(result).toBe(false);
      expect(mockRecognition.start).not.toHaveBeenCalled();
      expect(errorCallback).toHaveBeenCalled();
      expect(service.getState()).toBe('error');
    });

    test('should handle start errors', async () => {
      // Arrange
      mockRecognition.start.mockImplementation(() => {
        throw new Error('Start error');
      });
      const errorCallback = jest.fn();
      service.on('error', errorCallback);
      
      // Act
      const result = await service.start();
      
      // Assert
      expect(result).toBe(false);
      expect(errorCallback).toHaveBeenCalled();
      expect(service.getState()).toBe('error');
    });
  });

  describe('stop', () => {
    test('should stop speech recognition when active', () => {
      // Arrange
      service.start();
      const stopCallback = jest.fn();
      service.on('stop', stopCallback);
      
      // Act
      const result = service.stop();
      
      // Simulate recognition stopping
      if (mockRecognition.onend) {
        mockRecognition.onend({});
      }
      
      // Assert
      expect(result).toBe(true);
      expect(mockRecognition.stop).toHaveBeenCalled();
      expect(stopCallback).toHaveBeenCalled();
      expect(service.getState()).toBe('inactive');
    });

    test('should do nothing when already inactive', () => {
      // Act
      const result = service.stop();
      
      // Assert
      expect(result).toBe(false);
      expect(mockRecognition.stop).not.toHaveBeenCalled();
    });
  });

  describe('abort', () => {
    test('should abort speech recognition when active', () => {
      // Arrange
      service.start();
      const stopCallback = jest.fn();
      service.on('stop', stopCallback);
      
      // Act
      service.abort();
      
      // Simulate recognition ending
      if (mockRecognition.onend) {
        mockRecognition.onend({});
      }
      
      // Assert
      expect(mockRecognition.abort).toHaveBeenCalled();
      expect(stopCallback).toHaveBeenCalled();
      expect(service.getState()).toBe('inactive');
    });
  });

  describe('result handling', () => {
    test('should process interim results', () => {
      // Arrange
      const resultCallback = jest.fn();
      service.on('result', resultCallback);
      service.start();
      
      // Act - simulate an interim result
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
          resultIndex: 0,
          results: [
            {
              0: {
                transcript: 'interim text',
                confidence: 0.9
              },
              isFinal: false,
              length: 1
            }
          ]
        });
      }
      
      // Assert
      expect(resultCallback).toHaveBeenCalledWith(expect.objectContaining({
        text: 'interim text',
        isFinal: false
      }));
    });

    test('should process final results', () => {
      // Arrange
      const resultCallback = jest.fn();
      const finalResultCallback = jest.fn();
      service.on('result', resultCallback);
      service.on('finalResult', finalResultCallback);
      service.start();
      
      // Act - simulate a final result
      if (mockRecognition.onresult) {
        mockRecognition.onresult({
          resultIndex: 0,
          results: [
            {
              0: {
                transcript: 'final text',
                confidence: 0.9
              },
              isFinal: true,
              length: 1
            }
          ]
        });
      }
      
      // Assert
      expect(resultCallback).toHaveBeenCalledWith(expect.objectContaining({
        text: 'final text',
        isFinal: true
      }));
      expect(finalResultCallback).toHaveBeenCalledWith(expect.objectContaining({
        text: 'final text',
        isFinal: true
      }));
    });
  });

  describe('error handling', () => {
    test('should handle recognition errors', () => {
      // Arrange
      const errorCallback = jest.fn();
      service.on('error', errorCallback);
      service.start();
      
      // Act - simulate an error
      if (mockRecognition.onerror) {
        mockRecognition.onerror({ error: 'not-allowed' });
      }
      
      // Assert
      expect(errorCallback).toHaveBeenCalled();
      expect(service.getState()).toBe('error');
    });

    test('should handle no-speech errors', () => {
      // Arrange
      const noMatchCallback = jest.fn();
      service.on('noMatch', noMatchCallback);
      service.start();
      
      // Act - simulate no match
      if (mockRecognition.onnomatch) {
        mockRecognition.onnomatch({});
      }
      
      // Assert
      expect(noMatchCallback).toHaveBeenCalled();
    });
  });

  describe('language handling', () => {
    test('should set the recognition language', () => {
      // Arrange
      const language = 'es-ES';
      
      // Act
      service.setLanguage(language);
      service.start();
      
      // Assert
      expect(service.getLanguage()).toBe(language);
      expect(mockRecognition.lang).toBe(language);
    });
  });

  describe('event listeners', () => {
    test('should add and call event listeners', () => {
      // Arrange
      const listener = jest.fn();
      const eventType = 'testEvent';
      const eventData = { test: 'data' };
      
      // Act
      service.on(eventType, listener);
      
      // Manually trigger the event using a private method
      // @ts-ignore - Access private method for testing
      service.emit(eventType, eventData);
      
      // Assert
      expect(listener).toHaveBeenCalledWith(eventData);
    });

    test('should remove event listeners', () => {
      // Arrange
      const listener = jest.fn();
      const eventType = 'testEvent';
      
      // Act
      service.on(eventType, listener);
      service.off(eventType, listener);
      
      // Manually trigger the event using a private method
      // @ts-ignore - Access private method for testing
      service.emit(eventType, {});
      
      // Assert
      expect(listener).not.toHaveBeenCalled();
    });
  });
});