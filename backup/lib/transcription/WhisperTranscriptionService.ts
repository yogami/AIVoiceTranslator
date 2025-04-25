import { 
  TranscriptionService, 
  TranscriptionOptions, 
  TranscriptionListeners,
  TranscriptionResult,
  TranscriptionError,
  TranscriptionErrorType
} from './TranscriptionService';
import { wsClient } from '../websocket';

/**
 * Implementation of TranscriptionService using OpenAI Whisper API via WebSockets
 */
export class WhisperTranscriptionService implements TranscriptionService {
  private isListening: boolean = false;
  private options: TranscriptionOptions = {
    language: 'en-US',
    continuous: true,
    interimResults: true
  };
  private listeners: TranscriptionListeners = {};
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private sendInterval: number | null = null;
  private microphonePermission: boolean = false;

  constructor(options?: TranscriptionOptions, listeners?: TranscriptionListeners) {
    // Set initial options
    if (options) {
      this.options = { ...this.options, ...options };
    }
    
    // Set initial listeners
    if (listeners) {
      this.listeners = { ...this.listeners, ...listeners };
    }
    
    // Setup WebSocket listeners
    this.setupWebSocketListeners();
  }

  private setupWebSocketListeners(): void {
    // Listen for transcription results from the WebSocket
    wsClient.addEventListener('transcription', (data) => {
      if (this.listeners.onTranscriptionResult && data.text) {
        this.listeners.onTranscriptionResult({
          text: data.text,
          isFinal: true,
          languageCode: this.options.language
        });
      }
    });
    
    // Listen for errors from the WebSocket
    wsClient.addEventListener('error', (error) => {
      this.handleError({
        type: 'network_error',
        message: 'Error in WebSocket connection',
        original: error
      });
    });
  }

  private handleError(error: TranscriptionError): void {
    if (this.listeners.onTranscriptionError) {
      this.listeners.onTranscriptionError(error);
    }
  }

  public isSupported(): boolean {
    // Check if browser supports required Web APIs for capturing audio
    return !!(
      typeof window !== 'undefined' && 
      window.MediaRecorder && 
      window.AudioContext && 
      navigator.mediaDevices && 
      navigator.mediaDevices.getUserMedia
    );
  }

  private async setupAudioCapture(): Promise<boolean> {
    if (!this.isSupported()) {
      this.handleError({
        type: 'not_supported',
        message: 'Your browser does not support the required audio APIs'
      });
      return false;
    }

    try {
      // Request microphone permission
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: { 
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      this.microphonePermission = true;
      
      // Create audio context
      this.audioContext = new AudioContext();
      
      // Setup MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') 
          ? 'audio/webm' 
          : 'audio/mp4'
      });
      
      // Set up event handlers for MediaRecorder
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.chunks.push(event.data);
        }
      };
      
      this.mediaRecorder.onstop = async () => {
        // Create a blob from all chunks
        if (this.chunks.length > 0) {
          await this.sendAudioChunks();
        }
        
        // Reset chunks
        this.chunks = [];
        
        // Notify listeners that recording has ended
        if (this.listeners.onTranscriptionEnd) {
          this.listeners.onTranscriptionEnd();
        }
      };
      
      return true;
    } catch (error) {
      let errorType: TranscriptionErrorType = 'unknown';
      let errorMessage = 'Failed to access microphone';
      
      if ((error as Error).name === 'NotAllowedError' || 
          (error as Error).name === 'PermissionDeniedError') {
        errorType = 'permission_denied';
        errorMessage = 'Microphone permission denied';
      }
      
      this.handleError({
        type: errorType,
        message: errorMessage,
        original: error as Error
      });
      
      return false;
    }
  }

  private async sendAudioChunks(): Promise<void> {
    if (this.chunks.length === 0) return;
    
    try {
      // Create blob from chunks
      const blob = new Blob(this.chunks, { 
        type: this.mediaRecorder?.mimeType || 'audio/webm' 
      });
      
      // Convert to base64
      const base64Audio = await this.blobToBase64(blob);
      
      // Send to server via WebSocket
      wsClient.sendAudio(base64Audio);
    } catch (error) {
      console.error('Error sending audio chunks:', error);
      this.handleError({
        type: 'network_error',
        message: 'Failed to send audio data',
        original: error as Error
      });
    }
  }

  private blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          // Extract the base64 part from the data URL
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

  public async start(): Promise<boolean> {
    if (this.isListening) {
      console.warn('Whisper transcription: Already listening');
      return true;
    }
    
    // Ensure WebSocket is connected
    if (wsClient.getStatus() !== 'connected') {
      wsClient.connect();
      
      // Wait for connection to establish
      const maxWaitMs = 3000;
      const startTime = Date.now();
      
      while (wsClient.getStatus() !== 'connected' && Date.now() - startTime < maxWaitMs) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (wsClient.getStatus() !== 'connected') {
        this.handleError({
          type: 'network_error',
          message: 'Failed to connect to WebSocket server'
        });
        return false;
      }
    }
    
    // Register with the correct language
    wsClient.register('teacher', this.options.language || 'en-US');
    
    // Setup audio capture if not already set up
    if (!this.mediaRecorder) {
      const success = await this.setupAudioCapture();
      if (!success) return false;
    }
    
    try {
      // Start recording
      if (this.mediaRecorder && this.mediaRecorder.state !== 'recording') {
        this.mediaRecorder.start(500); // Collect data every 500ms
        this.isListening = true;
        
        // Set up an interval to send audio chunks periodically
        if (this.sendInterval === null) {
          this.sendInterval = window.setInterval(async () => {
            if (this.chunks.length > 0) {
              const currentChunks = [...this.chunks];
              this.chunks = [];
              
              // Create blob from current chunks
              const blob = new Blob(currentChunks, { 
                type: this.mediaRecorder?.mimeType || 'audio/webm' 
              });
              
              // Convert to base64 and send
              try {
                const base64Audio = await this.blobToBase64(blob);
                wsClient.sendAudio(base64Audio);
              } catch (error) {
                console.error('Error sending periodic audio chunks:', error);
              }
            }
          }, 2000); // Send chunks every 2 seconds
        }
        
        // Notify that transcription has started
        if (this.listeners.onTranscriptionStart) {
          this.listeners.onTranscriptionStart();
        }
        
        return true;
      } else {
        console.warn('MediaRecorder is already recording or not initialized');
        return false;
      }
    } catch (error) {
      console.error('Error starting Whisper transcription:', error);
      this.handleError({
        type: 'unknown',
        message: 'Failed to start audio recording',
        original: error as Error
      });
      return false;
    }
  }

  public stop(): boolean {
    if (!this.isListening) {
      console.warn('Whisper transcription: Not currently listening');
      return true;
    }
    
    try {
      // Stop the recording
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      
      // Clear the send interval
      if (this.sendInterval !== null) {
        clearInterval(this.sendInterval);
        this.sendInterval = null;
      }
      
      this.isListening = false;
      return true;
    } catch (error) {
      console.error('Error stopping Whisper transcription:', error);
      this.handleError({
        type: 'unknown',
        message: 'Failed to stop audio recording',
        original: error as Error
      });
      return false;
    }
  }

  public abort(): boolean {
    // Clear all resources
    try {
      // Stop MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
        this.mediaRecorder.stop();
      }
      
      // Clear the send interval
      if (this.sendInterval !== null) {
        clearInterval(this.sendInterval);
        this.sendInterval = null;
      }
      
      // Stop all audio tracks
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach(track => track.stop());
      }
      
      // Close audio context
      if (this.audioContext) {
        this.audioContext.close();
      }
      
      // Reset state
      this.mediaRecorder = null;
      this.mediaStream = null;
      this.audioContext = null;
      this.chunks = [];
      this.isListening = false;
      
      return true;
    } catch (error) {
      console.error('Error aborting Whisper transcription:', error);
      this.handleError({
        type: 'unknown',
        message: 'Failed to abort audio recording',
        original: error as Error
      });
      return false;
    }
  }

  public isActive(): boolean {
    return this.isListening;
  }

  public updateOptions(options: TranscriptionOptions): void {
    const prevOptions = { ...this.options };
    this.options = { ...this.options, ...options };
    
    // If language changed and we're listening, update registration
    if (prevOptions.language !== this.options.language && this.isListening) {
      wsClient.register('teacher', this.options.language || 'en-US');
    }
  }

  public updateListeners(listeners: TranscriptionListeners): void {
    this.listeners = { ...this.listeners, ...listeners };
  }
}

// Singleton instance for easy access
let instance: WhisperTranscriptionService | null = null;

export function getWhisperTranscriptionService(
  options?: TranscriptionOptions, 
  listeners?: TranscriptionListeners
): WhisperTranscriptionService {
  if (!instance) {
    instance = new WhisperTranscriptionService(options, listeners);
  } else {
    if (options) {
      instance.updateOptions(options);
    }
    if (listeners) {
      instance.updateListeners(listeners);
    }
  }
  
  return instance;
}