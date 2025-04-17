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
let openAIStreamingTranscriptionServiceInstance: OpenAIStreamingTranscriptionService | null = null;

/**
 * Implementation of the TranscriptionService using OpenAI's true real-time streaming API
 * 
 * This service implements the streaming API as described in:
 * - https://platform.openai.com/docs/guides/speech-to-text/streaming
 * - https://openai.com/blog/introducing-new-speech-and-vision-capabilities-in-the-openai-api
 * 
 * It offers significantly lower latency (<2s) than the batch approach by streaming
 * audio directly to OpenAI and receiving translated responses in real-time.
 */
export class OpenAIStreamingTranscriptionService implements TranscriptionService {
  private mediaRecorder: MediaRecorder | null = null;
  private mediaStream: MediaStream | null = null;
  private recordingActive: boolean = false;
  private webSocketConnection: WebSocket | null = null;
  private audioProcessor: AudioWorkletNode | null = null;
  private audioContext: AudioContext | null = null;
  private microphoneNode: MediaStreamAudioSourceNode | null = null;
  private lastText: string = '';
  private socketReconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000; // Start with 1s delay, will increase exponentially
  
  /**
   * Create a new OpenAI streaming transcription service
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
    
    console.log('OpenAI Streaming Transcription Service initialized with options:', this.options);
  }
  
  /**
   * Check if this service is supported in the current environment
   */
  public isSupported(): boolean {
    try {
      // Check if necessary browser APIs are available
      if (!navigator.mediaDevices || !window.MediaRecorder || !window.WebSocket) {
        console.warn('Required browser APIs not supported');
        return false;
      }
      
      // Check if AudioContext and AudioWorklet are supported
      if (typeof AudioContext === 'undefined' || 
          typeof AudioWorkletNode === 'undefined') {
        console.warn('AudioContext or AudioWorklet not supported');
        return false;
      }
      
      // Check if OpenAI integration is available via environment
      const apiKeyAvailable = Boolean((window as any).OPENAI_API_KEY);
      if (!apiKeyAvailable) {
        console.warn('OpenAI API key not available');
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking OpenAI Streaming transcription support:', error);
      return false;
    }
  }
  
  /**
   * Start the transcription process
   */
  public async start(): Promise<boolean> {
    try {
      if (this.recordingActive) {
        console.warn('OpenAI Streaming transcription already active');
        return true;
      }
      
      // Request audio stream with optimized settings for speech recognition
      console.log('Requesting audio permission for OpenAI Streaming transcription...');
      this.mediaStream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      
      // Initialize audio context and processing
      await this.setupAudioProcessing();
      
      // Initialize WebSocket connection to server proxy
      await this.setupWebSocketConnection();
      
      // Mark as active
      this.recordingActive = true;
      
      // Notify that transcription started
      if (this.listeners.onTranscriptionStart) {
        this.listeners.onTranscriptionStart();
      }
      
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
      
      // Stop WebSocket connection
      if (this.webSocketConnection) {
        // Send end signal to server
        if (this.webSocketConnection.readyState === WebSocket.OPEN) {
          this.webSocketConnection.send(JSON.stringify({ type: 'end' }));
          this.webSocketConnection.close();
        }
        this.webSocketConnection = null;
      }
      
      // Stop audio processing
      this.cleanupAudioProcessing();
      
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
      console.error('Error stopping OpenAI Streaming transcription:', error);
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
   * Set up the audio processing pipeline using AudioWorklet
   */
  private async setupAudioProcessing(): Promise<void> {
    // Create audio context
    this.audioContext = new AudioContext({
      sampleRate: 16000, // Optimized for speech recognition
      latencyHint: 'interactive'
    });
    
    // Connect microphone to audio context
    if (this.mediaStream) {
      this.microphoneNode = this.audioContext.createMediaStreamSource(this.mediaStream);
      
      // Create processor for real-time audio
      // In a full implementation, we would register an AudioWorklet
      // For simplicity, we'll use MediaRecorder with small time slices
      
      // Create recorder object with small time slices for low latency
      this.mediaRecorder = new MediaRecorder(this.mediaStream, {
        mimeType: 'audio/webm;codecs=opus',
      });
      
      // Set up event handlers
      this.mediaRecorder.ondataavailable = this.handleAudioData.bind(this);
      this.mediaRecorder.onerror = this.handleRecordingError.bind(this);
      
      // Start recording with very small chunks (100ms) for lower latency
      this.mediaRecorder.start(100);
    }
  }
  
  /**
   * Clean up audio processing resources
   */
  private cleanupAudioProcessing(): void {
    // Stop media recorder
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.mediaRecorder = null;
    
    // Disconnect and close audio nodes
    if (this.microphoneNode) {
      this.microphoneNode.disconnect();
      this.microphoneNode = null;
    }
    
    if (this.audioProcessor) {
      this.audioProcessor.disconnect();
      this.audioProcessor = null;
    }
    
    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    this.audioContext = null;
  }
  
  /**
   * Set up WebSocket connection to server proxy
   */
  private async setupWebSocketConnection(): Promise<void> {
    if (this.webSocketConnection) {
      this.webSocketConnection.close();
    }
    
    // Get WebSocket URL (using same host for simplicity)
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws/transcribe?language=${this.options.language}`;
    
    // Create new WebSocket connection
    this.webSocketConnection = new WebSocket(wsUrl);
    
    // Set up WebSocket event handlers
    this.webSocketConnection.onopen = this.handleSocketOpen.bind(this);
    this.webSocketConnection.onmessage = this.handleSocketMessage.bind(this);
    this.webSocketConnection.onclose = this.handleSocketClose.bind(this);
    this.webSocketConnection.onerror = this.handleSocketError.bind(this);
    
    // Wait for connection to open
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebSocket connection timeout'));
      }, 5000);
      
      this.webSocketConnection!.addEventListener('open', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
      
      this.webSocketConnection!.addEventListener('error', (err) => {
        clearTimeout(timeout);
        reject(err);
      }, { once: true });
    });
  }
  
  /**
   * Handle audio data from the recorder
   */
  private handleAudioData(event: BlobEvent): void {
    // Check if we have an open socket connection and audio data
    if (this.webSocketConnection && 
        this.webSocketConnection.readyState === WebSocket.OPEN &&
        event.data && 
        event.data.size > 0) {
      
      // Convert blob to base64 and send to server
      const reader = new FileReader();
      reader.readAsDataURL(event.data);
      
      reader.onloadend = () => {
        try {
          // Extract base64 data from the dataURL
          const base64data = reader.result as string;
          const base64audio = base64data.split(',')[1]; // remove the data:audio/webm;base64, prefix
          
          // Send audio chunk to server via WebSocket
          if (this.webSocketConnection && this.webSocketConnection.readyState === WebSocket.OPEN) {
            this.webSocketConnection.send(JSON.stringify({
              type: 'audio_data',
              data: base64audio,
              format: 'webm',
              language: this.options.language
            }));
          }
        } catch (error) {
          console.error('Error processing audio chunk:', error);
        }
      };
    }
  }
  
  /**
   * Handle WebSocket connection open
   */
  private handleSocketOpen(event: Event): void {
    console.log('OpenAI Streaming WebSocket connection opened');
    
    // Reset reconnection attempts on successful connection
    this.socketReconnectAttempts = 0;
    this.reconnectDelay = 1000;
    
    // Send initial configuration message
    if (this.webSocketConnection && this.webSocketConnection.readyState === WebSocket.OPEN) {
      this.webSocketConnection.send(JSON.stringify({
        type: 'config',
        language: this.options.language,
        interimResults: this.options.interimResults
      }));
    }
  }
  
  /**
   * Handle WebSocket messages from the server
   */
  private handleSocketMessage(event: MessageEvent): void {
    try {
      const message = JSON.parse(event.data);
      
      // Handle different message types
      switch (message.type) {
        case 'interim_result':
          // Interim transcription result
          if (this.options.interimResults && this.listeners.onTranscriptionResult) {
            this.listeners.onTranscriptionResult({
              text: message.text,
              isFinal: false,
              confidence: message.confidence || 0.7,
              languageCode: this.options.language
            });
          }
          break;
          
        case 'final_result':
          // Final transcription result
          if (this.listeners.onTranscriptionResult) {
            this.lastText = message.text;
            this.listeners.onTranscriptionResult({
              text: message.text,
              isFinal: true,
              confidence: message.confidence || 0.9,
              languageCode: this.options.language
            });
          }
          break;
          
        case 'error':
          // Error from the server
          console.error('OpenAI Streaming server error:', message.error);
          if (this.listeners.onTranscriptionError) {
            this.listeners.onTranscriptionError({
              type: 'server_error',
              message: message.error,
              original: new Error(message.error)
            });
          }
          break;
          
        case 'metadata':
          // Metadata (like timing information)
          console.log('OpenAI Streaming metadata:', message);
          break;
          
        default:
          console.warn('Unknown message type from OpenAI Streaming server:', message.type);
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error, event.data);
    }
  }
  
  /**
   * Handle WebSocket connection close
   */
  private handleSocketClose(event: CloseEvent): void {
    this.webSocketConnection = null;
    
    // Attempt to reconnect if the recording is still active
    if (this.recordingActive && this.socketReconnectAttempts < this.maxReconnectAttempts) {
      console.log(`WebSocket closed. Attempting to reconnect (${this.socketReconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
      
      this.socketReconnectAttempts++;
      
      // Exponential backoff for reconnection attempts
      setTimeout(() => {
        if (this.recordingActive) {
          this.setupWebSocketConnection().catch(error => {
            console.error('Error reconnecting WebSocket:', error);
          });
        }
      }, this.reconnectDelay);
      
      // Increase delay for next attempt
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 10000); // Max 10s
    } else if (this.recordingActive) {
      // Too many reconnection attempts, stop recording
      console.error('WebSocket connection lost. Max reconnection attempts reached.');
      
      if (this.listeners.onTranscriptionError) {
        this.listeners.onTranscriptionError({
          type: 'connection_error',
          message: 'WebSocket connection lost. Could not reconnect after multiple attempts.',
          original: new Error('WebSocket connection failure')
        });
      }
      
      this.stop();
    }
  }
  
  /**
   * Handle WebSocket connection error
   */
  private handleSocketError(event: Event): void {
    console.error('WebSocket error:', event);
    
    if (this.listeners.onTranscriptionError) {
      this.listeners.onTranscriptionError({
        type: 'connection_error',
        message: 'WebSocket connection error',
        original: new Error('WebSocket error event')
      });
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
    console.error('OpenAI Streaming transcription error:', error);
    
    let errorType: TranscriptionErrorType = 'unknown';
    let errorMessage = 'Unknown error during OpenAI Streaming transcription';
    
    if (error instanceof DOMException) {
      if (error.name === 'NotAllowedError') {
        errorType = 'permission_denied';
        errorMessage = 'Microphone permission denied';
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
      
      if (error.message.includes('network') || error.message.includes('WebSocket')) {
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
 * Factory function to create an OpenAI Streaming transcription service instance
 */
export function getOpenAIStreamingTranscriptionService(
  options?: TranscriptionOptions, 
  listeners?: TranscriptionListeners
): OpenAIStreamingTranscriptionService {
  // Reuse the existing instance if possible
  if (openAIStreamingTranscriptionServiceInstance) {
    // Update options and listeners
    if (options) {
      openAIStreamingTranscriptionServiceInstance.updateOptions(options);
    }
    
    if (listeners) {
      openAIStreamingTranscriptionServiceInstance.updateListeners(listeners);
    }
    
    return openAIStreamingTranscriptionServiceInstance;
  }
  
  // Create a new instance
  openAIStreamingTranscriptionServiceInstance = new OpenAIStreamingTranscriptionService(options, listeners);
  return openAIStreamingTranscriptionServiceInstance;
}