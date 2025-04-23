/**
 * Jest setup file
 */
import '@testing-library/jest-dom';

// Mock browser APIs if needed for Node environment
if (typeof window === 'undefined') {
  global.window = {} as any;
}

// Mock the SpeechRecognition API
const mockStart = jest.fn();
const mockStop = jest.fn();
const mockAbort = jest.fn();
const mockAddEventListener = jest.fn();
const mockRemoveEventListener = jest.fn();

class MockSpeechRecognition {
  start = mockStart;
  stop = mockStop;
  abort = mockAbort;
  addEventListener = mockAddEventListener;
  removeEventListener = mockRemoveEventListener;
  continuous = false;
  lang = '';
  interimResults = false;
  maxAlternatives = 1;
}

// Create proper jest mocks
const SpeechRecognitionMock = jest.fn().mockImplementation(() => {
  return new MockSpeechRecognition();
});

global.SpeechRecognition = SpeechRecognitionMock;
global.webkitSpeechRecognition = SpeechRecognitionMock;

// Make mock methods accessible in tests
global.mockSpeechRecognitionMethods = {
  start: mockStart,
  stop: mockStop,
  abort: mockAbort,
  addEventListener: mockAddEventListener,
  removeEventListener: mockRemoveEventListener
};

// Mock WebSocket
class MockWebSocket {
  constructor(public url: string) {}
  send = jest.fn();
  close = jest.fn();
  addEventListener = jest.fn();
  removeEventListener = jest.fn();
  readyState = 1; // WebSocket.OPEN
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: ((error: any) => void) | null = null;
}

const WebSocketMock = jest.fn().mockImplementation((url: string) => {
  return new MockWebSocket(url);
});

global.WebSocket = WebSocketMock;
global.mockWebSocketMethods = {
  constructor: WebSocketMock,
  instance: new MockWebSocket('ws://test')
};

// Setup process.env for tests
process.env.OPENAI_API_KEY = 'test-api-key';