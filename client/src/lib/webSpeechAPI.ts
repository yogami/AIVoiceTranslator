/**
 * Web Speech API utilities for speech recognition in the browser
 * An alternative to OpenAI Whisper API for local transcription
 */

interface WebSpeechResult {
  transcript: string;
  isFinal: boolean;
}

export class WebSpeechRecognizer {
  private recognition: SpeechRecognition | null = null;
  private isListening: boolean = false;
  private onResultCallback: ((result: WebSpeechResult) => void) | null = null;
  private onErrorCallback: ((error: any) => void) | null = null;
  private onEndCallback: (() => void) | null = null;
  private interimResults: boolean = true;
  private languageCode: string = 'en-US';
  
  constructor(options?: { 
    interimResults?: boolean,
    languageCode?: string
  }) {
    if (options) {
      if (options.interimResults !== undefined) {
        this.interimResults = options.interimResults;
      }
      if (options.languageCode) {
        this.languageCode = options.languageCode;
      }
    }
    
    try {
      this.initRecognition();
    } catch (error) {
      console.error('Error initializing Web Speech API:', error);
    }
  }
  
  private initRecognition() {
    // Browser compatibility for SpeechRecognition
    const SpeechRecognition = window.SpeechRecognition || 
                             (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('SpeechRecognition is not supported in this browser');
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.lang = this.languageCode;
    this.recognition.interimResults = this.interimResults;
    this.recognition.continuous = true;
    this.recognition.maxAlternatives = 1;
    
    this.recognition.onresult = (event) => {
      if (!this.onResultCallback) return;
      
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult[0].transcript;
      const isFinal = lastResult.isFinal;
      
      this.onResultCallback({
        transcript,
        isFinal
      });
    };
    
    this.recognition.onerror = (event) => {
      if (this.onErrorCallback) {
        this.onErrorCallback(event);
      }
    };
    
    this.recognition.onend = () => {
      // Auto-restart if still listening
      if (this.isListening) {
        try {
          this.recognition?.start();
        } catch (error) {
          console.error('Error restarting speech recognition:', error);
          this.isListening = false;
          if (this.onEndCallback) this.onEndCallback();
        }
      } else if (this.onEndCallback) {
        this.onEndCallback();
      }
    };
  }
  
  public start(): boolean {
    if (!this.recognition) {
      console.error('SpeechRecognition is not supported or not initialized');
      return false;
    }
    
    if (this.isListening) {
      return true; // Already listening
    }
    
    try {
      this.recognition.start();
      this.isListening = true;
      return true;
    } catch (error) {
      console.error('Error starting speech recognition:', error);
      return false;
    }
  }
  
  public stop(): void {
    if (!this.recognition || !this.isListening) {
      return;
    }
    
    try {
      this.recognition.stop();
      this.isListening = false;
    } catch (error) {
      console.error('Error stopping speech recognition:', error);
    }
  }
  
  public setLanguage(languageCode: string): void {
    this.languageCode = languageCode;
    if (this.recognition) {
      this.recognition.lang = languageCode;
    }
  }
  
  public onResult(callback: (result: WebSpeechResult) => void): void {
    this.onResultCallback = callback;
  }
  
  public onError(callback: (error: any) => void): void {
    this.onErrorCallback = callback;
  }
  
  public onEnd(callback: () => void): void {
    this.onEndCallback = callback;
  }
  
  public isSupported(): boolean {
    return !!(window.SpeechRecognition || (window as any).webkitSpeechRecognition);
  }
}

// Web Speech API utility for sending transcribed text to the server
export function sendTranscribedText(
  text: string, 
  websocket: WebSocket,
  sourceLanguage: string
): void {
  if (!text || !websocket || websocket.readyState !== WebSocket.OPEN) {
    return;
  }
  
  // Format the transcription message
  const message = {
    type: 'transcription',
    data: {
      text,
      sourceLanguage
    }
  };
  
  // Send the message to the server
  websocket.send(JSON.stringify(message));
}