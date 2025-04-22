import '@testing-library/jest-dom';

// Mock the WebSocket implementation
global.WebSocket = class MockWebSocket {
  url: string;
  readyState: number = 0;
  onopen: ((event: any) => void) | null = null;
  onclose: ((event: any) => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  constructor(url: string) {
    this.url = url;
    // Simulate connection open
    setTimeout(() => {
      this.readyState = 1; // OPEN
      if (this.onopen) {
        this.onopen({ target: this });
      }
    }, 0);
  }

  send(data: string): void {
    // No implementation needed for mock
  }

  close(): void {
    this.readyState = 3; // CLOSED
    if (this.onclose) {
      this.onclose({ target: this });
    }
  }
};

// Mock the MediaRecorder API
class MockMediaRecorder {
  stream: MediaStream;
  state: string = 'inactive';
  ondataavailable: ((event: any) => void) | null = null;
  onstop: ((event: any) => void) | null = null;
  onstart: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  mimeType: string = 'audio/webm';

  constructor(stream: MediaStream) {
    this.stream = stream;
  }

  start(): void {
    this.state = 'recording';
    if (this.onstart) {
      this.onstart({});
    }
  }

  stop(): void {
    this.state = 'inactive';
    if (this.ondataavailable) {
      // Mock data availability event
      this.ondataavailable({
        data: new Blob([], { type: this.mimeType })
      });
    }
    if (this.onstop) {
      this.onstop({});
    }
  }

  pause(): void {
    this.state = 'paused';
  }

  resume(): void {
    this.state = 'recording';
  }

  requestData(): void {
    if (this.ondataavailable) {
      this.ondataavailable({
        data: new Blob([], { type: this.mimeType })
      });
    }
  }
}

// Mock navigator.mediaDevices
Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: MockMediaRecorder
});

// Mock navigator.mediaDevices
Object.defineProperty(window.navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: jest.fn().mockImplementation(async () => {
      return new MediaStream();
    })
  }
});

// Mock the SpeechRecognition API
class MockSpeechRecognition {
  continuous: boolean = false;
  interimResults: boolean = false;
  lang: string = 'en-US';
  maxAlternatives: number = 1;
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

  start(): void {
    if (this.onstart) {
      this.onstart({});
    }
  }

  stop(): void {
    if (this.onend) {
      this.onend({});
    }
  }

  abort(): void {
    if (this.onend) {
      this.onend({});
    }
  }

  // Helper method to simulate speech recognition results
  simulateResult(text: string, isFinal: boolean = true): void {
    if (this.onresult) {
      this.onresult({
        resultIndex: 0,
        results: [
          {
            0: {
              transcript: text,
              confidence: 0.9
            },
            isFinal: isFinal,
            length: 1
          }
        ]
      });
    }
  }
}

// Mock the SpeechRecognition global
window.SpeechRecognition = MockSpeechRecognition;
window.webkitSpeechRecognition = MockSpeechRecognition;

// Add missing Web APIs to the global namespace
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock fetch
global.fetch = jest.fn();

// Create a helper for waiting
export const waitForTime = (ms: number): Promise<void> => 
  new Promise(resolve => setTimeout(resolve, ms));