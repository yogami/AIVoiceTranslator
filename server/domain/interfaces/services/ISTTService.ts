/**
 * Domain Interface: Speech-to-Text Service
 * 
 * Core domain contract for STT functionality.
 * This interface defines the domain's expectations for speech transcription
 * without any infrastructure concerns.
 */

export interface TranscriptionResult {
  text: string;
  confidence?: number;
  language?: string;
  duration?: number;
}

export interface TranscriptionOptions {
  sourceLanguage?: string;
  model?: string;
  enhanceVoice?: boolean;
}

export interface ISTTService {
  /**
   * Transcribe audio buffer to text
   * @param audioBuffer Audio data to transcribe
   * @param options Transcription options
   * @returns Promise resolving to transcription result
   */
  transcribe(audioBuffer: Buffer, options?: TranscriptionOptions): Promise<TranscriptionResult>;

  /**
   * Check if the service is available and healthy
   * @returns Promise resolving to service health status
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get the service identifier for logging/monitoring
   * @returns Service name/identifier
   */
  getServiceName(): string;
}
