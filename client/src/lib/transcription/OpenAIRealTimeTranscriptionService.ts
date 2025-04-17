import { 
  TranscriptionService, 
  TranscriptionOptions, 
  TranscriptionListeners,
  TranscriptionResult,
  TranscriptionError,
  TranscriptionErrorType
} from './TranscriptionService';
import { createOpenAIClient } from '../openai';

// Singleton instance (for reuse to avoid duplicate instances)
let openAIRealTimeTranscriptionServiceInstance: OpenAIRealTimeTranscriptionService | null = null;

/**
 * Implementation of the TranscriptionService using OpenAI real-time API
 * This provides more real-time speech recognition than the Whisper API
 */
export class OpenAIRealTimeTranscriptionService implements TranscriptionService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordingActive: boolean = false;
  private openAIClient = createOpenAIClient();
  private recordingInterval: ReturnType<typeof setInterval> | null = null;
  private audioChunks: Blob[] = [];
  private lastText: string = '';
  private sendingChunks: boolean = false;
  private pendingChunkRequests: number = 0;
  private lastChunkTime: number = 0;
  private chunkDuration: number = 1000; // Send audio chunks every 1 second
  private successiveEmptyChunks: number = 0;
  private maxEmptyChunks: number = 3; // Stop after 3 empty chunks in a row
  
  /**
   * Create a new OpenAI real-time transcription service
   */
  constructor(
    public options: TranscriptionOptions = {},
    public listeners: TranscriptionListeners = {}
  ) {
    // Default options
    this.options = {
      language: 'en-US',
      continuous: true,
      interimResults: true,
      ...options
    };
    
    // Set up event listeners
    this.listeners = listeners;
    
    console.log('OpenAI Real-Time Transcription Service initialized with options:', this.options);
  }
  
  /**
   * Check if this service is supported in the current environment
   */
  public isSupported(): boolean {
    try {
      // Check if necessary APIs are available
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        console.warn('MediaDevices or MediaRecorder not supported in this browser');
        return false;
      }
      
      // Check if OpenAI integration is available
      if (!this.openAIClient) {
        console.warn('OpenAI client could not be initialized');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking OpenAI Real-Time transcription support:', error);
      return false;
    }
  }
  
  /**
   * Start the transcription process
   */
  public async start(): Promise<boolean> {
    try {
      if (this.recordingActive) {
        console.warn('OpenAI Real-Time transcription already active');
        return true;
      }
      
      // Request audio stream
      console.log('Requesting audio permission for OpenAI Real-Time transcription...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Create recorder object
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = this.handleAudioData.bind(this);
      this.mediaRecorder.onstart = this.handleRecordingStart.bind(this);
      this.mediaRecorder.onstop = this.handleRecordingStop.bind(this);
      this.mediaRecorder.onerror = this.handleRecordingError.bind(this);
      
      // Start recording and process in chunks
      this.audioChunks = [];
      this.lastText = '';
      this.recordingActive = true;
      this.mediaRecorder.start(200); // Collect data every 200ms
      
      // Schedule periodic sending of chunks
      this.lastChunkTime = Date.now();
      this.recordingInterval = setInterval(() => {
        this.processAvailableChunks();
      }, this.chunkDuration);
      
      return true;
    } catch (error) {
      this.handleError(error);
      return false;
    }
  }
  
  /**
   * Stop the transcription process
   */
  public stop(): boolean {
    try {
      if (!this.recordingActive) {
        return true;
      }
      
      // Stop the recording interval
      if (this.recordingInterval) {
        clearInterval(this.recordingInterval);
        this.recordingInterval = null;
      }
      
      // Process any pending chunks before stopping
      if (this.mediaRecorder && this.recordingActive) {
        this.mediaRecorder.stop();
      }
      
      // Clean up media stream
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
        this.mediaStream = null;
      }
      
      this.recordingActive = false;
      
      // Notify that transcription ended
      if (this.listeners.onTranscriptionEnd) {
        this.listeners.onTranscriptionEnd();
      }
      
      return true;
    } catch (error) {
      console.error('Error stopping OpenAI Real-Time transcription:', error);
      return false;
    }
  }
  
  /**
   * Abort transcription and clean up all resources
   */
  public abort(): boolean {
    return this.stop();
  }
  
  /**
   * Check if transcription is active
   */
  public isActive(): boolean {
    return this.recordingActive;
  }
  
  /**
   * Update transcription options
   */
  public updateOptions(options: TranscriptionOptions): void {
    const wasActive = this.recordingActive;
    
    // Stop current transcription if active
    if (wasActive) {
      this.stop();
    }
    
    // Update options
    this.options = {
      ...this.options,
      ...options
    };
    
    // Restart if it was active
    if (wasActive) {
      this.start();
    }
  }
  
  /**
   * Update event listeners
   */
  public updateListeners(listeners: TranscriptionListeners): void {
    this.listeners = {
      ...this.listeners,
      ...listeners
    };
  }
  
  // Private methods
  
  /**
   * Handle audio data from the recorder
   */
  private handleAudioData(event: BlobEvent): void {
    if (event.data && event.data.size > 0) {
      this.audioChunks.push(event.data);
    }
  }
  
  /**
   * Process available audio chunks and send to OpenAI
   */
  private async processAvailableChunks(): Promise<void> {
    if (!this.recordingActive || this.sendingChunks || this.audioChunks.length === 0) {
      return;
    }
    
    const timeSinceLastChunk = Date.now() - this.lastChunkTime;
    if (timeSinceLastChunk < this.chunkDuration) {
      return;
    }
    
    try {
      this.sendingChunks = true;
      this.pendingChunkRequests++;
      
      // Create a new blob with all accumulated chunks
      const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
      this.audioChunks = []; // Clear chunks for next interval
      
      // Skip empty chunks
      if (audioBlob.size < 100) {
        console.log('OpenAI Real-Time: Empty audio chunk, skipping');
        this.sendingChunks = false;
        this.pendingChunkRequests--;
        return;
      }
      
      this.lastChunkTime = Date.now();
      
      // Convert blob to base64 for API
      const reader = new FileReader();
      reader.readAsDataURL(audioBlob);
      
      reader.onloadend = async () => {
        try {
          // Extract base64 data from the dataURL
          const base64data = reader.result as string;
          const base64audio = base64data.split(',')[1]; // remove the data:audio/webm;base64, prefix
          
          // Call OpenAI API for real-time transcription
          if (!this.openAIClient) {
            console.error('OpenAI client is not available');
            return;
          }
          
          const transcription = await this.openAIClient.audio.transcriptions.create({
            file: new File([audioBlob], 'audio.webm', { type: 'audio/webm' }),
            model: 'whisper-1',
            language: this.options.language?.split('-')[0], // Just the language code part
            response_format: 'json',
            temperature: 0.2,
            prompt: 'This is speech from a classroom setting. Transcribe accurately.'
          });
          
          // Check if we got any text
          const text = transcription.text?.trim();
          
          if (text && text !== this.lastText) {
            // Reset empty chunks counter
            this.successiveEmptyChunks = 0;
            
            // Notify about result
            if (this.listeners.onTranscriptionResult) {
              this.listeners.onTranscriptionResult({
                text: text,
                isFinal: true, // We treat each chunk as final in this implementation
                confidence: 0.9, // OpenAI doesn't return confidence, so use a high default
                languageCode: this.options.language
              });
            }
            
            // Update last text
            this.lastText = text;
          } else {
            // No new text
            this.successiveEmptyChunks++;
            
            if (this.successiveEmptyChunks >= this.maxEmptyChunks && !this.options.continuous) {
              // Too many empty chunks in a row, stop recording if not in continuous mode
              console.log('OpenAI Real-Time: Too many empty chunks, stopping');
              this.stop();
            }
          }
        } catch (error) {
          console.error('OpenAI Real-Time transcription error:', error);
        } finally {
          this.pendingChunkRequests--;
          this.sendingChunks = this.pendingChunkRequests > 0;
        }
      };
      
      reader.onerror = (error) => {
        console.error('Error reading audio blob:', error);
        this.pendingChunkRequests--;
        this.sendingChunks = this.pendingChunkRequests > 0;
      };
    } catch (error) {
      console.error('Error processing audio chunks:', error);
      this.sendingChunks = false;
    }
  }
  
  /**
   * Handle recording start event
   */
  private handleRecordingStart(): void {
    console.log('OpenAI Real-Time transcription started');
    
    if (this.listeners.onTranscriptionStart) {
      this.listeners.onTranscriptionStart();
    }
  }
  
  /**
   * Handle recording stop event
   */
  private handleRecordingStop(): void {
    console.log('OpenAI Real-Time transcription stopped');
    this.recordingActive = false;
    
    // Process any final chunks
    this.processAvailableChunks();
    
    if (this.listeners.onTranscriptionEnd) {
      this.listeners.onTranscriptionEnd();
    }
  }
  
  /**
   * Handle recording error event
   */
  private handleRecordingError(event: Event): void {
    const errorEvent = event as unknown as { error: Error };
    this.handleError(errorEvent.error);
  }
  
  /**
   * Handle and report errors
   */
  private handleError(error: unknown): void {
    console.error('OpenAI Real-Time transcription error:', error);
    
    let errorType: TranscriptionErrorType = 'unknown';
    let errorMessage = 'Unknown error during OpenAI Real-Time transcription';
    
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        errorType = 'permission_denied';
        errorMessage = 'Microphone permission denied';
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('network')) {
        errorType = 'network_error';
      }
    }
    
    const transcriptionError: TranscriptionError = {
      type: errorType,
      message: errorMessage,
      original: error instanceof Error ? error : new Error(String(error))
    };
    
    if (this.listeners.onTranscriptionError) {
      this.listeners.onTranscriptionError(transcriptionError);
    }
    
    // Stop recording
    this.stop();
  }
}

/**
 * Factory function to create an OpenAI Real-Time transcription service instance
 */
export function getOpenAIRealTimeTranscriptionService(
  options?: TranscriptionOptions, 
  listeners?: TranscriptionListeners
): OpenAIRealTimeTranscriptionService {
  // Reuse the existing instance if possible
  if (openAIRealTimeTranscriptionServiceInstance) {
    // Update options and listeners
    if (options) {
      openAIRealTimeTranscriptionServiceInstance.updateOptions(options);
    }
    
    if (listeners) {
      openAIRealTimeTranscriptionServiceInstance.updateListeners(listeners);
    }
    
    return openAIRealTimeTranscriptionServiceInstance;
  }
  
  // Create a new instance
  openAIRealTimeTranscriptionServiceInstance = new OpenAIRealTimeTranscriptionService(options, listeners);
  return openAIRealTimeTranscriptionServiceInstance;
}