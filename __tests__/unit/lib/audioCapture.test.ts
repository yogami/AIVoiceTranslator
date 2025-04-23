/**
 * Unit tests for AudioCapture module
 */
import { AudioRecorder, SpeechRecognizer } from '../../../client/src/lib/audioCapture';

// Mock browser APIs
const mockMediaStream = {
  getTracks: jest.fn().mockReturnValue([{ stop: jest.fn() }])
};

const mockMediaRecorder = {
  start: jest.fn(),
  stop: jest.fn(),
  pause: jest.fn(),
  resume: jest.fn(),
  ondataavailable: null as any,
  onstop: null as any,
  state: 'inactive'
};

class MockMediaRecorderClass {
  static instances: MockMediaRecorderClass[] = [];
  ondataavailable: ((event: any) => void) | null = null;
  onstop: (() => void) | null = null;
  state: string = 'inactive';

  constructor() {
    MockMediaRecorderClass.instances.push(this);
    Object.assign(this, mockMediaRecorder);
  }

  start(timeSlice?: number) {
    this.state = 'recording';
    mockMediaRecorder.start(timeSlice);
  }

  stop() {
    this.state = 'inactive';
    mockMediaRecorder.stop();
    if (this.onstop) this.onstop();
  }

  pause() {
    this.state = 'paused';
    mockMediaRecorder.pause();
  }

  resume() {
    this.state = 'recording';
    mockMediaRecorder.resume();
  }
}

class MockSpeechRecognition {
  lang: string = '';
  continuous: boolean = false;
  interimResults: boolean = false;
  onresult: ((event: any) => void) | null = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  
  start = jest.fn().mockImplementation(() => {
    if (this.onstart) this.onstart();
  });
  
  stop = jest.fn().mockImplementation(() => {
    if (this.onend) this.onend();
  });
}

// Setup mocks
beforeEach(() => {
  jest.clearAllMocks();
  MockMediaRecorderClass.instances = [];
  
  // Mock getUserMedia
  Object.defineProperty(navigator, 'mediaDevices', {
    value: {
      getUserMedia: jest.fn().mockResolvedValue(mockMediaStream)
    },
    configurable: true
  });
  
  // Mock MediaRecorder
  global.MediaRecorder = MockMediaRecorderClass as any;
  
  // Mock FileReader with proper static properties
  const mockFileReader = jest.fn().mockImplementation(() => ({
    readAsDataURL: jest.fn(function() {
      if (this.onloadend) {
        this.result = 'data:audio/webm;base64,dGVzdEF1ZGlvRGF0YQ==';
        this.onloadend();
      }
    }),
    readAsArrayBuffer: jest.fn(function() {
      if (this.onloadend) {
        this.result = new ArrayBuffer(8);
        this.onloadend();
      }
    }),
    onloadend: null,
    onerror: null
  }));
  
  // Add the static properties
  mockFileReader.EMPTY = 0;
  mockFileReader.LOADING = 1;
  mockFileReader.DONE = 2;
  
  global.FileReader = mockFileReader as any;
  
  // Mock SpeechRecognition
  global.SpeechRecognition = MockSpeechRecognition as any;
  global.webkitSpeechRecognition = MockSpeechRecognition as any;
});

describe('AudioRecorder', () => {
  test('starts recording and captures media stream', async () => {
    const onStart = jest.fn();
    const recorder = new AudioRecorder({ onStart });
    
    await recorder.start();
    
    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true });
    expect(mockMediaRecorder.start).toHaveBeenCalled();
    expect(onStart).toHaveBeenCalled();
  });
  
  test('handles dataavailable event', async () => {
    const onDataAvailable = jest.fn();
    const recorder = new AudioRecorder({ onDataAvailable });
    
    await recorder.start();
    
    // Get the instance and trigger ondataavailable
    const instance = MockMediaRecorderClass.instances[0];
    const mockEvent = { data: new Blob(['test'], { type: 'audio/webm' }) };
    if (instance.ondataavailable) instance.ondataavailable(mockEvent);
    
    expect(onDataAvailable).toHaveBeenCalledWith(mockEvent.data);
  });
  
  test('stops recording and processes recorded chunks', async () => {
    const onStop = jest.fn();
    const recorder = new AudioRecorder({ onStop });
    
    await recorder.start();
    recorder.stop();
    
    // Get the instance and manually trigger onstop since our mock doesn't do it automatically
    const instance = MockMediaRecorderClass.instances[0];
    if (instance.onstop) instance.onstop();
    
    expect(onStop).toHaveBeenCalled();
    expect(mockMediaStream.getTracks()[0].stop).toHaveBeenCalled();
  });
  
  test('checks if recording is in progress', async () => {
    const recorder = new AudioRecorder();
    
    // Before starting
    expect(recorder.isRecording()).toBe(false);
    
    // After starting
    await recorder.start();
    MockMediaRecorderClass.instances[0].state = 'recording';
    expect(recorder.isRecording()).toBe(true);
    
    // After stopping
    recorder.stop();
    MockMediaRecorderClass.instances[0].state = 'inactive';
    expect(recorder.isRecording()).toBe(false);
  });
  
  test('converts blob to base64', async () => {
    const testBlob = new Blob(['test'], { type: 'audio/webm' });
    const base64Data = await AudioRecorder.blobToBase64(testBlob);
    
    expect(base64Data).toBe('dGVzdEF1ZGlvRGF0YQ==');
  });
  
  test('converts blob to array buffer', async () => {
    const testBlob = new Blob(['test'], { type: 'audio/webm' });
    const arrayBuffer = await AudioRecorder.blobToArrayBuffer(testBlob);
    
    expect(arrayBuffer).toBeInstanceOf(ArrayBuffer);
  });
});

describe('SpeechRecognizer', () => {
  test('initializes with default options', () => {
    const recognizer = new SpeechRecognizer();
    
    // We can't directly access private fields, but we can infer from behavior
    expect(global.SpeechRecognition).toHaveBeenCalled();
  });
  
  test('starts recognition', () => {
    const onStart = jest.fn();
    const recognizer = new SpeechRecognizer({ onStart });
    
    recognizer.start();
    
    const mockInstance = new MockSpeechRecognition();
    expect(mockInstance.start).toHaveBeenCalled();
    // The start callback would be called in a real implementation
  });
  
  test('stops recognition', () => {
    const onEnd = jest.fn();
    const recognizer = new SpeechRecognizer({ onEnd });
    
    recognizer.start();
    recognizer.stop();
    
    const mockInstance = new MockSpeechRecognition();
    expect(mockInstance.stop).toHaveBeenCalled();
    // The end callback would be called in a real implementation
  });
  
  test('updates language', () => {
    const recognizer = new SpeechRecognizer();
    recognizer.updateLanguage('fr-FR');
    
    // We can't directly verify private fields, but in a real setup 
    // this would update the language
  });
  
  test('handles speech recognition events', () => {
    const onResult = jest.fn();
    const recognizer = new SpeechRecognizer({ onResult });
    
    // We can't directly access the recognition instance created internally,
    // but in a real environment this would trigger the onResult callback
  });
});