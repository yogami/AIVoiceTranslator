// TypeScript declarations for globals used in tests
import { Mock } from 'jest-mock';

declare global {
  const mockSpeechRecognitionMethods: {
    start: Mock;
    stop: Mock;
    abort: Mock;
    addEventListener: Mock;
    removeEventListener: Mock;
  };

  const mockWebSocketMethods: {
    constructor: Mock;
    instance: {
      url: string;
      send: Mock;
      close: Mock;
      addEventListener: Mock;
      removeEventListener: Mock;
      readyState: number;
      onopen: (() => void) | null;
      onmessage: ((event: any) => void) | null;
      onclose: (() => void) | null;
      onerror: ((error: any) => void) | null;
    };
  };

  namespace NodeJS {
    interface Global {
      SpeechRecognition: any;
      webkitSpeechRecognition: any;
      mockSpeechRecognitionMethods: typeof mockSpeechRecognitionMethods;
      mockWebSocketMethods: typeof mockWebSocketMethods;
    }
  }
}

export {};