import { 
  TranscriptionService, 
  TranscriptionOptions, 
  TranscriptionListeners 
} from './TranscriptionService';
import { WebSpeechTranscriptionService, getWebSpeechTranscriptionService } from './WebSpeechTranscriptionService';
import { WhisperTranscriptionService, getWhisperTranscriptionService } from './WhisperTranscriptionService';
import { OpenAIRealTimeTranscriptionService, getOpenAIRealTimeTranscriptionService } from './OpenAIRealTimeTranscriptionService';
import { OpenAIStreamingTranscriptionService, getOpenAIStreamingTranscriptionService } from './OpenAIStreamingTranscriptionService';

/**
 * Available transcription service types
 */
export type TranscriptionServiceType = 'web_speech' | 'whisper' | 'openai_realtime' | 'openai_streaming';

/**
 * Factory class to create appropriate transcription service instances
 */
export class TranscriptionFactory {
  /**
   * Create a transcription service of the specified type
   */
  public static createTranscriptionService(
    type: TranscriptionServiceType,
    options?: TranscriptionOptions,
    listeners?: TranscriptionListeners
  ): TranscriptionService {
    switch (type) {
      case 'web_speech':
        return getWebSpeechTranscriptionService(options, listeners);
        
      case 'whisper':
        return getWhisperTranscriptionService(options, listeners);
      
      case 'openai_realtime':
        return getOpenAIRealTimeTranscriptionService(options, listeners);
        
      case 'openai_streaming':
        return getOpenAIStreamingTranscriptionService(options, listeners);
        
      default:
        // Default to Web Speech API as it doesn't require an API key
        console.warn(`Unknown transcription service type: ${type}, falling back to Web Speech API`);
        return getWebSpeechTranscriptionService(options, listeners);
    }
  }
  
  /**
   * Get the best available transcription service
   * This tries different services in order of preference and returns the first supported one
   */
  public static getBestAvailableService(
    preferredOrder: TranscriptionServiceType[] = ['openai_streaming', 'openai_realtime', 'whisper', 'web_speech'],
    options?: TranscriptionOptions,
    listeners?: TranscriptionListeners
  ): TranscriptionService {
    // Try each service in order
    for (const serviceType of preferredOrder) {
      const service = this.createTranscriptionService(serviceType, options, listeners);
      
      if (service.isSupported()) {
        console.log(`Using ${serviceType} transcription service`);
        return service;
      }
      
      console.warn(`Transcription service ${serviceType} is not supported in this environment`);
    }
    
    // If no preferred services are supported, try to return any supported service
    const allTypes: TranscriptionServiceType[] = ['openai_streaming', 'openai_realtime', 'whisper', 'web_speech'];
    
    for (const serviceType of allTypes) {
      // Skip if we already tried this in preferred order
      if (preferredOrder.includes(serviceType)) continue;
      
      const service = this.createTranscriptionService(serviceType, options, listeners);
      
      if (service.isSupported()) {
        console.log(`Falling back to ${serviceType} transcription service`);
        return service;
      }
    }
    
    // If we get here, nothing is supported - return Web Speech API anyway
    // (it will just report not supported when used)
    console.error('No transcription services are supported in this environment');
    return getWebSpeechTranscriptionService(options, listeners);
  }
}