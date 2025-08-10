/**
 * Domain Interface: Text-to-Speech Service
 * 
 * Core domain contract for TTS functionality.
 * This interface defines the domain's expectations for speech synthesis
 * without any infrastructure concerns.
 */

export interface TTSResult {
  audioBuffer: Buffer;
  format: string;
  duration?: number;
  voice?: string;
}

export interface TTSOptions {
  language: string;
  voice?: string;
  speed?: number;
  pitch?: number;
  volume?: number;
  format?: string; // 'mp3', 'wav', etc.
}

export interface ITTSService {
  /**
   * Synthesize speech from text
   * @param text Text to synthesize
   * @param options TTS options
   * @returns Promise resolving to audio result
   */
  synthesize(text: string, options: TTSOptions): Promise<TTSResult>;

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

  /**
   * Get available voices for a language
   * @param language Language code
   * @returns Array of available voice identifiers
   */
  getAvailableVoices(language: string): Promise<string[]>;
}
