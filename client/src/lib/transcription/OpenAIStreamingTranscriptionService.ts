import { 
  TranscriptionService, 
  TranscriptionOptions, 
  TranscriptionListeners,
  TranscriptionResult,
  TranscriptionError
} from './TranscriptionService';
import { WebSocketClient } from '../websocket';

/**
 * Implementation of TranscriptionService using OpenAI Streaming API for continuous real-time transcription
 * This is the lowest latency option using a true streaming audio API rather than batched chunks
 */
export class OpenAIStreamingTranscriptionService implements TranscriptionService {
  private options: TranscriptionOptions;
  private listeners: TranscriptionListeners;
  private active: boolean = false;
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private wsClient: WebSocketClient | null = null;
  private isFirstChunk: boolean = true;

  constructor(options?: TranscriptionOptions, listeners?: TranscriptionListeners) {
    this.options = options || {};
    this.listeners = listeners || {};
    this.wsClient = new WebSocketClient();
    this.setupWebSocketListeners();
  }

  /**
   * Set up WebSocket event listeners for handling transcription events
   */
  private setupWebSocketListeners(): void {
    if (!this.wsClient) return;

    this.wsClient.addEventListener('open', () => {
      console.log('WebSocket connection established for OpenAI Streaming transcription');
      
      // Register as a teacher with the server
      if (this.wsClient) {
        this.wsClient.setRoleAndLock('teacher');
        this.wsClient.register('teacher', this.options.language || 'en-US');
      }
    });

    this.wsClient.addEventListener('message', (event) => {
      const data = JSON.parse(event.data);
      
      if (data.type === 'transcription') {
        const result: TranscriptionResult = {
          text: data.text,
          isFinal: data.isFinal || false,
          confidence: data.confidence,
          languageCode: data.languageCode || this.options.language || 'en-US'
        };
        
        if (this.listeners.onTranscriptionResult) {
          this.listeners.onTranscriptionResult(result);
        }
      } 
      else if (data.type === 'error') {
        this.handleError({
          type: data.errorType || 'server_error',
          message: data.message || 'Server error during transcription'
        });
      }
    });

    this.wsClient.addEventListener('error', (error) => {
      this.handleError({
        type: 'connection_error',
        message: 'WebSocket connection error',
        original: error
      });
    });

    this.wsClient.addEventListener('close', (event) => {
      console.log(`WebSocket connection closed - Code: ${event.code}, Reason: ${event.reason}, Clean: ${event.wasClean}`);
      
      if (!event.wasClean) {
        this.handleError({
          type: 'connection_error',
          message: `Connection closed unexpectedly: ${event.reason || 'No reason provided'}`
        });
      }
    });
  }

  /**
   * Handle errors during transcription
   */
  private handleError(error: TranscriptionError): void {
    console.error('Transcription error:', error);
    
    if (this.listeners.onTranscriptionError) {
      this.listeners.onTranscriptionError(error);
    }
    
    // Try to recover by restarting if appropriate
    if (error.type === 'connection_error') {
      // Avoid cascading reconnection failures
      setTimeout(() => {
        if (this.active && this.wsClient) {
          console.log('Attempting to reconnect WebSocket after error');
          this.wsClient.connect();
        }
      }, 2000);
    }
  }

  /**
   * Check if this service is supported in the current environment
   */
  public isSupported(): boolean {
    // Check if environment has required MediaRecorder and WebSocket support
    if (typeof MediaRecorder === 'undefined') {
      console.warn('MediaRecorder API is not supported in this browser');
      return false;
    }
    
    if (typeof WebSocket === 'undefined') {
      console.warn('WebSocket API is not supported in this browser');
      return false;
    }
    
    // Check if OpenAI API key is available on server
    // Note: We rely on the server to validate the API key
    return true;
  }

  /**
   * Start the transcription process
   */
  public async start(): Promise<boolean> {
    if (this.active) {
      console.warn('OpenAI Streaming transcription is already active');
      return true; // Already running
    }
    
    try {
      // Notify that transcription is starting
      if (this.listeners.onTranscriptionStart) {
        this.listeners.onTranscriptionStart();
      }
      
      // Get microphone access
      this.stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      
      // Set up MediaRecorder with appropriate options for streaming audio
      const options = {
        mimeType: 'audio/webm',
        audioBitsPerSecond: 128000
      };
      
      // Create the MediaRecorder
      this.mediaRecorder = new MediaRecorder(this.stream, options);
      
      // Connect to WebSocket server
      if (this.wsClient) {
        this.wsClient.connect();
      }
      
      // Set up event handlers for the MediaRecorder
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && this.wsClient && this.wsClient.getStatus() === 'connected') {
          // Convert the audio data to base64 for sending over WebSocket
          const reader = new FileReader();
          reader.readAsDataURL(event.data);
          
          reader.onloadend = () => {
            const base64data = reader.result as string;
            // Extract just the base64 part by removing the data URL prefix
            const base64Audio = base64data.split(',')[1];
            
            // Send the audio data to the server via WebSocket
            if (this.wsClient) {
              const message = {
                type: 'streaming_audio',
                audio: base64Audio,
                isFirstChunk: this.isFirstChunk,
                languageCode: this.options.language || 'en-US'
              };
              
              this.wsClient.send(message);
              this.isFirstChunk = false;
            }
          };
        }
      };
      
      // Start recording with small timeslice for lower latency (100ms chunks)
      this.mediaRecorder.start(100);
      this.active = true;
      
      return true;
    } catch (error) {
      let errorType: TranscriptionError['type'] = 'unknown';
      let errorMessage = 'Failed to start OpenAI Streaming transcription';
      
      if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
          errorType = 'permission_denied';
          errorMessage = 'Microphone permission denied';
        } else if (error.name === 'NotFoundError') {
          errorType = 'not_supported';
          errorMessage = 'No microphone found';
        }
      }
      
      this.handleError({
        type: errorType,
        message: errorMessage,
        original: error as Error
      });
      
      return false;
    }
  }

  /**
   * Stop the transcription process
   */
  public stop(): boolean {
    if (!this.active) {
      return false;
    }
    
    try {
      // Stop the MediaRecorder
      if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
        this.mediaRecorder.stop();
      }
      
      // Send a message to the server that we're stopping transcription
      if (this.wsClient) {
        const message = {
          type: 'stop_streaming',
          finalizeTranscription: true
        };
        
        this.wsClient.send(message);
      }
      
      this.active = false;
      this.isFirstChunk = true;
      
      // Notify that transcription has ended
      if (this.listeners.onTranscriptionEnd) {
        this.listeners.onTranscriptionEnd();
      }
      
      return true;
    } catch (error) {
      this.handleError({
        type: 'unknown',
        message: 'Error stopping OpenAI Streaming transcription',
        original: error as Error
      });
      
      return false;
    }
  }

  /**
   * Abort transcription and clean up all resources
   */
  public abort(): boolean {
    try {
      // Stop transcription first
      this.stop();
      
      // Close WebSocket connection
      if (this.wsClient) {
        this.wsClient.disconnect();
      }
      
      // Stop all tracks on the stream
      if (this.stream) {
        this.stream.getTracks().forEach(track => track.stop());
        this.stream = null;
      }
      
      // Clear MediaRecorder
      this.mediaRecorder = null;
      
      return true;
    } catch (error) {
      console.error('Error aborting OpenAI Streaming transcription:', error);
      return false;
    }
  }

  /**
   * Check if transcription is active
   */
  public isActive(): boolean {
    return this.active;
  }

  /**
   * Update transcription options
   */
  public updateOptions(options: TranscriptionOptions): void {
    this.options = options;
    
    // If we're already connected, update language setting
    if (this.active && this.wsClient) {
      this.wsClient.register('teacher', options.language || 'en-US');
    }
  }

  /**
   * Update event listeners
   */
  public updateListeners(listeners: TranscriptionListeners): void {
    this.listeners = listeners;
  }
}

/**
 * Singleton instance factory
 */
let instance: OpenAIStreamingTranscriptionService | null = null;

/**
 * Get or create an instance of the OpenAI Streaming transcription service
 */
export function getOpenAIStreamingTranscriptionService(
  options?: TranscriptionOptions,
  listeners?: TranscriptionListeners
): OpenAIStreamingTranscriptionService {
  if (!instance) {
    instance = new OpenAIStreamingTranscriptionService(options, listeners);
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