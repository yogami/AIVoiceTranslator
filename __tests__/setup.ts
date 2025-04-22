/**
 * Jest setup file
 */

// Mock browser APIs if needed for Node environment
if (typeof window === 'undefined') {
  global.window = {} as any;
}

// Mock the SpeechRecognition API
if (!global.SpeechRecognition) {
  global.SpeechRecognition = jest.fn().mockImplementation(() => {
    return {
      start: jest.fn(),
      stop: jest.fn(),
      abort: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
  }) as any;
}

if (!global.webkitSpeechRecognition) {
  global.webkitSpeechRecognition = global.SpeechRecognition;
}

// Mock WebSocket if needed
if (!global.WebSocket) {
  global.WebSocket = jest.fn().mockImplementation(() => {
    return {
      send: jest.fn(),
      close: jest.fn(),
      addEventListener: jest.fn(),
      removeEventListener: jest.fn()
    };
  }) as any;
}

// Setup process.env for tests
process.env.OPENAI_API_KEY = 'test-api-key';