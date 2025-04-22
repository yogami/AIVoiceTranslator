/**
 * Audio Capture Utility
 * Provides speech recognition and audio recording capabilities
 */

// Types
export interface AudioRecordingOptions {
  onStart?: () => void;
  onStop?: (audioBlob: Blob) => void;
  onDataAvailable?: (blob: Blob) => void;
  onError?: (error: Error) => void;
  timeSlice?: number;
}

export interface SpeechRecognitionOptions {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: Error) => void;
}

// Audio Recording API
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private recordedChunks: Blob[] = [];
  private options: AudioRecordingOptions;

  constructor(options: AudioRecordingOptions = {}) {
    this.options = {
      timeSlice: 1000,
      ...options,
    };
  }

  /**
   * Start recording audio
   */
  async start(): Promise<void> {
    try {
      // Get user media
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create media recorder
      this.mediaRecorder = new MediaRecorder(this.stream);
      this.recordedChunks = [];
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
          
          // Call onDataAvailable if provided
          if (this.options.onDataAvailable) {
            this.options.onDataAvailable(event.data);
          }
        }
      };
      
      this.mediaRecorder.onstop = () => {
        // Combine recorded chunks into a single blob
        const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        
        // Call onStop if provided
        if (this.options.onStop) {
          this.options.onStop(audioBlob);
        }
        
        // Stop tracks
        if (this.stream) {
          this.stream.getTracks().forEach(track => track.stop());
          this.stream = null;
        }
      };
      
      // Start recording
      this.mediaRecorder.start(this.options.timeSlice);
      
      // Call onStart if provided
      if (this.options.onStart) {
        this.options.onStart();
      }
    } catch (error) {
      console.error('Error starting audio recording:', error);
      
      // Call onError if provided
      if (this.options.onError) {
        this.options.onError(error);
      }
    }
  }

  /**
   * Stop recording audio
   */
  stop(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
  }

  /**
   * Pause recording
   */
  pause(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.pause();
    }
  }

  /**
   * Resume recording
   */
  resume(): void {
    if (this.mediaRecorder && this.mediaRecorder.state === 'paused') {
      this.mediaRecorder.resume();
    }
  }

  /**
   * Check if recording is in progress
   */
  isRecording(): boolean {
    return this.mediaRecorder !== null && this.mediaRecorder.state === 'recording';
  }

  /**
   * Get recorded audio as Blob
   */
  getRecordedBlob(): Blob | null {
    if (this.recordedChunks.length === 0) {
      return null;
    }
    
    return new Blob(this.recordedChunks, { type: 'audio/webm' });
  }

  /**
   * Convert Blob to Base64 string
   */
  static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove data URL prefix (e.g., "data:audio/webm;base64,")
          const base64Data = reader.result.split(',')[1];
          resolve(base64Data);
        } else {
          reject(new Error('Failed to convert Blob to Base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  /**
   * Convert audio to ArrayBuffer
   */
  static async blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (reader.result instanceof ArrayBuffer) {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert Blob to ArrayBuffer'));
        }
      };
      reader.onerror = reject;
      reader.readAsArrayBuffer(blob);
    });
  }
}

// Speech Recognition API
export class SpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private options: SpeechRecognitionOptions;
  private isListening: boolean = false;

  constructor(options: SpeechRecognitionOptions = {}) {
    this.options = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      ...options,
    };
    
    // Initialize speech recognition if browser supports it
    this.initSpeechRecognition();
  }

  /**
   * Initialize speech recognition
   */
  private initSpeechRecognition(): void {
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('Speech recognition not supported in this browser');
      return;
    }
    
    // Create recognition instance
    this.recognition = new SpeechRecognition();
    
    // Configure recognition
    this.recognition.lang = this.options.language || 'en-US';
    this.recognition.continuous = this.options.continuous || true;
    this.recognition.interimResults = this.options.interimResults || true;
    
    // Set up event handlers
    this.recognition.onresult = (event) => {
      const resultIndex = event.resultIndex;
      const transcript = event.results[resultIndex][0].transcript;
      const isFinal = event.results[resultIndex].isFinal;
      
      // Call onResult if provided
      if (this.options.onResult) {
        this.options.onResult(transcript, isFinal);
      }
    };
    
    this.recognition.onstart = () => {
      this.isListening = true;
      
      // Call onStart if provided
      if (this.options.onStart) {
        this.options.onStart();
      }
    };
    
    this.recognition.onend = () => {
      this.isListening = false;
      
      // Call onEnd if provided
      if (this.options.onEnd) {
        this.options.onEnd();
      }
      
      // Restart if continuous is true and we didn't manually stop
      if (this.options.continuous && this.isListening) {
        this.recognition?.start();
      }
    };
    
    this.recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      
      // Call onError if provided
      if (this.options.onError) {
        this.options.onError(new Error(event.error));
      }
    };
  }

  /**
   * Start speech recognition
   */
  start(): void {
    if (!this.recognition) {
      console.error('Speech recognition not supported or not initialized');
      return;
    }
    
    if (!this.isListening) {
      try {
        this.recognition.start();
        this.isListening = true;
      } catch (error) {
        console.error('Error starting speech recognition:', error);
        
        // Call onError if provided
        if (this.options.onError) {
          this.options.onError(error);
        }
      }
    }
  }

  /**
   * Stop speech recognition
   */
  stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
        this.isListening = false;
      } catch (error) {
        console.error('Error stopping speech recognition:', error);
      }
    }
  }

  /**
   * Check if speech recognition is listening
   */
  isRecognizing(): boolean {
    return this.isListening;
  }

  /**
   * Update recognition language
   */
  updateLanguage(language: string): void {
    if (this.recognition) {
      this.recognition.lang = language;
      this.options.language = language;
      
      // Restart recognition if currently listening
      if (this.isListening) {
        this.stop();
        this.start();
      }
    }
  }

  /**
   * Update recognition options
   */
  updateOptions(options: Partial<SpeechRecognitionOptions>): void {
    this.options = {
      ...this.options,
      ...options,
    };
    
    if (this.recognition) {
      if (options.language) {
        this.recognition.lang = options.language;
      }
      
      if (options.continuous !== undefined) {
        this.recognition.continuous = options.continuous;
      }
      
      if (options.interimResults !== undefined) {
        this.recognition.interimResults = options.interimResults;
      }
    }
  }
}

// Add global type definitions for SpeechRecognition API
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}