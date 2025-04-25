declare global {
  const mockSpeechRecognitionMethods: {
    start: jest.Mock;
    stop: jest.Mock;
    abort: jest.Mock;
    addEventListener: jest.Mock;
    removeEventListener: jest.Mock;
  };

  const mockWebSocketMethods: {
    constructor: jest.Mock;
    instance: {
      url: string;
      send: jest.Mock;
      close: jest.Mock;
      addEventListener: jest.Mock;
      removeEventListener: jest.Mock;
      readyState: number;
      onopen: (() => void) | null;
      onmessage: ((event: any) => void) | null;
      onclose: (() => void) | null;
      onerror: ((error: any) => void) | null;
    };
  };

  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export {};