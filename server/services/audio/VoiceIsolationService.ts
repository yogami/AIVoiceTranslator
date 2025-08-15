/**
 * Voice Isolation Service using ElevenLabs Voice Isolator
 * 
 * This service cleans audio by removing background noise and isolating the primary speaker's voice,
 * significantly improving STT accuracy in classroom environments with multiple speakers and background noise.
 */

export interface VoiceIsolationOptions {
  /** Remove background noise (default: true) */
  removeBackgroundNoise?: boolean;
  /** Isolate primary speaker (default: true) */
  isolatePrimarySpeaker?: boolean;
  /** Enhancement strength 0.0-1.0 (default: 0.8) */
  enhancementStrength?: number;
}

export interface IVoiceIsolationService {
  isolateVoice(audioBuffer: Buffer, options?: VoiceIsolationOptions): Promise<Buffer>;
  isAvailable(): boolean;
  analyzeAudioQuality(originalBuffer: Buffer, isolatedBuffer: Buffer): Promise<{
    originalSize: number;
    isolatedSize: number;
    compressionRatio: number;
    estimatedNoiseReduction: number;
  }>;
}

export class VoiceIsolationService implements IVoiceIsolationService {
  constructor() {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is required');
    }
  }

  /**
   * Isolate and clean voice from audio buffer for improved STT accuracy
   */
  async isolateVoice(audioBuffer: Buffer, options: VoiceIsolationOptions = {}): Promise<Buffer> {
    const {
      removeBackgroundNoise = true,
      isolatePrimarySpeaker = true,
      enhancementStrength = 0.8
    } = options;

    // Skip processing for empty buffers
    if (!audioBuffer || audioBuffer.length === 0) {
      return audioBuffer;
    }

    try {
      console.log('[Voice Isolation] Processing audio for STT enhancement...');
      
      // Create form data for ElevenLabs Voice Isolator API
      const formData = new FormData();
      formData.append('audio', new Blob([audioBuffer], { type: 'audio/mpeg' }));
      formData.append('remove_background_noise', removeBackgroundNoise.toString());
      formData.append('isolate_primary_speaker', isolatePrimarySpeaker.toString());

      const response = await fetch('https://api.elevenlabs.io/v1/audio-isolation', {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        },
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Voice isolation failed: ${response.status} ${errorText}`);
      }

      const isolatedAudioBuffer = Buffer.from(await response.arrayBuffer());
      
      console.log(`[Voice Isolation] Successfully enhanced audio: ${audioBuffer.length} → ${isolatedAudioBuffer.length} bytes`);
      
      return isolatedAudioBuffer;
      
    } catch (error) {
      console.error('[Voice Isolation] Failed to isolate voice:', error);
      
      // Return original audio if isolation fails - don't break the STT pipeline
      console.log('[Voice Isolation] Returning original audio as fallback');
      return audioBuffer;
    }
  }

  /**
   * Check if voice isolation is available (API key present)
   */
  isAvailable(): boolean {
    return !!process.env.ELEVENLABS_API_KEY;
  }

  /**
   * Analyze audio quality metrics before/after isolation
   */
  async analyzeAudioQuality(originalBuffer: Buffer, isolatedBuffer: Buffer): Promise<{
    originalSize: number;
    isolatedSize: number;
    compressionRatio: number;
    estimatedNoiseReduction: number;
  }> {
    return {
      originalSize: originalBuffer.length,
      isolatedSize: isolatedBuffer.length,
      compressionRatio: isolatedBuffer.length / originalBuffer.length,
      estimatedNoiseReduction: Math.max(0, (originalBuffer.length - isolatedBuffer.length) / originalBuffer.length)
    };
  }
}
