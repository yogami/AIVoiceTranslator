/**
 * Audio capture utility using MediaRecorder API
 */

export interface AudioCaptureOptions {
  sampleRate?: number;
  channels?: number;
  chunkDuration?: number; // in milliseconds
  onDataAvailable?: (data: Blob) => void;
  onStart?: () => void;
  onStop?: () => void;
  onError?: (error: Error) => void;
}

export class AudioCapture {
  private stream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private isRecording = false;
  private options: Required<AudioCaptureOptions>;
  private chunkTimer: number | null = null;

  constructor(options: AudioCaptureOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate || 44100,
      channels: options.channels || 1,
      chunkDuration: options.chunkDuration || 3000, // Default 3s chunks
      onDataAvailable: options.onDataAvailable || (() => {}),
      onStart: options.onStart || (() => {}),
      onStop: options.onStop || (() => {}),
      onError: options.onError || ((error) => console.error('AudioCapture error:', error))
    };
  }

  /**
   * Get available audio input devices
   */
  public async getAudioDevices(): Promise<MediaDeviceInfo[]> {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.filter(device => device.kind === 'audioinput');
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Start audio capture
   */
  public async start(deviceId?: string): Promise<boolean> {
    if (this.isRecording) {
      return true;
    }

    try {
      // Request microphone access
      const constraints: MediaStreamConstraints = {
        audio: deviceId 
          ? { deviceId: { exact: deviceId } }
          : true
      };
      
      this.stream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Create MediaRecorder instance with options
      const mimeType = 'audio/webm'; // Most widely supported
      const options = {
        mimeType,
        audioBitsPerSecond: 128000 // 128kbps for good quality audio
      };
      
      console.log('Creating MediaRecorder with options:', options);
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      this.chunks = [];
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = (event) => {
        console.log('MediaRecorder ondataavailable triggered, data size:', event.data.size);
        if (event.data.size > 0) {
          this.chunks.push(event.data);
          this.options.onDataAvailable(event.data);
        }
      };
      
      this.mediaRecorder.onstart = () => {
        console.log('MediaRecorder started');
        this.isRecording = true;
        this.options.onStart();
        
        // Always set up chunk timer for regular audio data
        this.setupChunkTimer();
      };
      
      this.mediaRecorder.onstop = () => {
        this.isRecording = false;
        this.clearChunkTimer();
        this.options.onStop();
      };
      
      this.mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        this.options.onError(new Error(`MediaRecorder error encountered`));
      };
      
      // Start recording with timeslice parameter to get regular data chunks
      // This ensures ondataavailable is called at regular intervals (every 1 second)
      const timeslice = 1000; // 1 second chunks
      console.log('Starting MediaRecorder with timeslice:', timeslice, 'ms');
      this.mediaRecorder.start(timeslice);
      return true;
    } catch (error) {
      this.options.onError(error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }
  
  /**
   * Stop audio capture
   */
  public stop(): boolean {
    console.log('AudioCapture: Stopping recording...');
    if (!this.isRecording) {
      console.log('AudioCapture: Not recording, nothing to stop');
      return false;
    }
    
    try {
      this.clearChunkTimer();
      
      // First pause the MediaRecorder to avoid state errors
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        console.log('AudioCapture: Stopping MediaRecorder');
        this.mediaRecorder.stop();
      } else {
        console.log('AudioCapture: MediaRecorder not in recording state, cannot stop');
      }
      
      // Stop and release all tracks
      if (this.stream) {
        console.log('AudioCapture: Stopping and releasing audio tracks');
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      
      // Reset state
      this.isRecording = false;
      this.mediaRecorder = null;
      this.chunks = [];
      
      console.log('AudioCapture: Recording stopped successfully');
      return true;
    } catch (error) {
      console.error('AudioCapture: Error stopping recording:', error);
      this.options.onError(error instanceof Error ? error : new Error(String(error)));
      
      // Force reset state even on error
      this.isRecording = false;
      this.mediaRecorder = null;
      this.stream = null;
      this.chunks = [];
      
      return false;
    }
  }
  
  /**
   * Request a data chunk (without stopping recording)
   */
  public requestData(): void {
    if (this.isRecording && this.mediaRecorder) {
      this.mediaRecorder.requestData();
    }
  }
  
  /**
   * Set up a timer to regularly request data chunks
   */
  private setupChunkTimer(): void {
    this.clearChunkTimer();
    
    console.log('Setting up chunk timer with interval:', this.options.chunkDuration, 'ms');
    
    // Make sure chunkDuration is reasonable (between 1000ms and 5000ms)
    const interval = Math.min(Math.max(this.options.chunkDuration, 1000), 5000);
    
    this.chunkTimer = window.setInterval(() => {
      console.log('Chunk timer fired, requesting data chunk');
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.requestData();
      } else {
        console.warn('Cannot request data, recorder not in recording state');
      }
    }, interval);
  }
  
  /**
   * Clear the chunk timer
   */
  private clearChunkTimer(): void {
    if (this.chunkTimer !== null) {
      clearInterval(this.chunkTimer);
      this.chunkTimer = null;
    }
  }
  
  /**
   * Check if currently recording
   */
  public isActive(): boolean {
    return this.isRecording;
  }
  
  /**
   * Get all recorded chunks
   */
  public getChunks(): Blob[] {
    return [...this.chunks];
  }
  
  /**
   * Get a single Blob with all recorded data
   */
  public getBlob(type = 'audio/wav'): Blob {
    return new Blob(this.chunks, { type });
  }
  
  /**
   * Convert a Blob to base64
   */
  public static async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Remove the data URL prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert blob to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }
  
  /**
   * Convert base64 to audio element for playback
   */
  public static base64ToAudioElement(base64: string, mimeType = 'audio/mp3'): HTMLAudioElement {
    const audio = new Audio(`data:${mimeType};base64,${base64}`);
    return audio;
  }
}
