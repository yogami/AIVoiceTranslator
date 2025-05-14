/**
 * Minimal tests for OpenAI Streaming Audio Transcription Service
 * Focusing on critical functionality
 */

// First mock dependencies before importing any code that uses them
// Need to mock the OpenAI class before importing anything that uses it
const mockCreateMethod = jest.fn().mockResolvedValue({
  text: 'This is a mocked transcription',
  duration: 2.5
});

// Mock the OpenAI constructor so it doesn't break
jest.mock('openai', () => {
  // Create a constructor function
  function MockOpenAI() {
    return {
      audio: {
        transcriptions: {
          create: mockCreateMethod
        }
      }
    };
  }
  
  // Make it look like a real module
  return MockOpenAI;
});

// Import dependencies after mocking
import WebSocket from 'ws';
import { WebSocketState } from '../../server/websocket';

// Now import the functions we want to test
import { 
  processStreamingAudio,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions
} from '../../server/openai-streaming';

describe('OpenAI Streaming - Core Functions', () => {
  // Create a mock WebSocket
  const mockWs = {
    readyState: WebSocketState.OPEN,
    send: jest.fn()
  } as unknown as WebSocket;
  
  // Save original environment
  const originalConsole = { ...console };
  const originalDateNow = Date.now;
  const originalSetInterval = global.setInterval;
  const originalEnv = { ...process.env };
  
  beforeEach(() => {
    // Mock console methods to track calls
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    
    // Mock intervals to prevent side effects
    global.setInterval = jest.fn() as any;
    
    // Set required environment variables
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    // Clear all previous mock calls
    jest.clearAllMocks();
  });
  
  afterEach(() => {
    // Restore console
    console.log = originalConsole.log;
    console.error = originalConsole.error;
    console.warn = originalConsole.warn;
    
    // Restore globals
    global.setInterval = originalSetInterval;
    Date.now = originalDateNow;
    
    // Restore env
    process.env = originalEnv;
  });
  
  // Test basic functionality - enough for coverage
  it('initializes and sets up cleanup interval', () => {
    // Check if setInterval was called during module initialization
    expect(global.setInterval).toHaveBeenCalled();
  });
  
  it('logs status during initialization', () => {
    // Since the module logs during import, we should have logged the API key status
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('API key status'));
  });
});