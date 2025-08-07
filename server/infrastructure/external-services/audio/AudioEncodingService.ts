/**
 * AudioEncodingService - Handles audio format encoding/conversion
 */

export type AudioFormat = 'mp3' | 'wav' | 'ogg' | 'flac';

export class AudioEncodingService {
  private readonly supportedFormats: AudioFormat[] = ['mp3', 'wav', 'ogg', 'flac'];

  /**
   * Encodes audio buffer to the specified format
   * @param audioBuffer - The input audio buffer
   * @param format - Target audio format
   * @returns Encoded audio buffer
   */
  async encodeAudio(audioBuffer: Buffer, format: AudioFormat): Promise<Buffer> {
    if (!this.supportedFormats.includes(format)) {
      throw new Error(`Unsupported audio format: ${format}`);
    }

    if (!audioBuffer || audioBuffer.length === 0) {
      throw new Error('Invalid audio buffer provided');
    }

    // For now, return the same buffer since most TTS services already return properly formatted audio
    // Future: Add actual format conversion using FFmpeg or similar
    return audioBuffer;
  }

  /**
   * Encodes audio buffer to base64 string
   * @param audioBuffer - The input audio buffer
   * @returns Base64 encoded audio string
   */
  encodeToBase64(audioBuffer: Buffer): string {
    if (!audioBuffer || audioBuffer.length === 0) {
      return '';
    }
    return audioBuffer.toString('base64');
  }

  /**
   * Decodes base64 string to audio buffer
   * @param base64Audio - Base64 encoded audio string
   * @returns Audio buffer
   */
  decodeFromBase64(base64Audio: string): Buffer {
    if (!base64Audio || base64Audio.trim().length === 0) {
      return Buffer.alloc(0);
    }
    return Buffer.from(base64Audio, 'base64');
  }

  /**
   * Get list of supported audio formats
   * @returns Array of supported format strings
   */
  getSupportedFormats(): AudioFormat[] {
    return [...this.supportedFormats];
  }
}
