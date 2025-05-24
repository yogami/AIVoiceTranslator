import { Buffer } from 'buffer';

/**
 * Helper for creating development mode audio buffers
 * Extracted to reduce complexity in main service class
 */
export class DevelopmentModeHelper {
  /**
   * Create a simple WAV buffer with silence
   * Used for development mode when no real audio processing is available
   */
  static createSilentAudioBuffer(): Buffer {
    // Create a minimal PCM WAV header
    const wavHeader = Buffer.from([
      0x52, 0x49, 0x46, 0x46, // "RIFF"
      0x24, 0x00, 0x00, 0x00, // ChunkSize (36 bytes + data size)
      0x57, 0x41, 0x56, 0x45, // "WAVE"
      0x66, 0x6d, 0x74, 0x20, // "fmt "
      0x10, 0x00, 0x00, 0x00, // Subchunk1Size (16 bytes)
      0x01, 0x00,             // AudioFormat (1 = PCM)
      0x01, 0x00,             // NumChannels (1 = mono)
      0x44, 0xac, 0x00, 0x00, // SampleRate (44100 Hz)
      0x88, 0x58, 0x01, 0x00, // ByteRate (SampleRate * NumChannels * BitsPerSample/8)
      0x02, 0x00,             // BlockAlign (NumChannels * BitsPerSample/8)
      0x10, 0x00,             // BitsPerSample (16 bits)
      0x64, 0x61, 0x74, 0x61, // "data"
      0x00, 0x00, 0x00, 0x00  // Subchunk2Size (data size)
    ]);

    // Add some silence (1 second)
    const sampleCount = 44100;
    const dataSize = sampleCount * 2; // 16-bit samples
    const silenceData = Buffer.alloc(dataSize);

    // Update the data chunk size in the header
    wavHeader.writeUInt32LE(dataSize, 40);
    // Update the overall file size in the header
    wavHeader.writeUInt32LE(36 + dataSize, 4);

    // Combine header and data
    return Buffer.concat([wavHeader, silenceData]);
  }

  /**
   * Get a synthetic translation based on target language
   */
  static getLanguageSpecificTranslation(text: string, targetLanguage: string): string {
    // Simple mapping for common languages in development mode
    const devTranslations: Record<string, string> = {
      es: 'Esto es una traducción en modo de desarrollo.',
      fr: 'Ceci est une traduction en mode développement.',
      de: 'Dies ist eine Übersetzung im Entwicklungsmodus.',
    };

    // Extract language code without region (e.g., 'es' from 'es-ES')
    const langPrefix = targetLanguage.split('-')[0].toLowerCase();

    // Return mapped translation or original text if no mapping exists
    return devTranslations[langPrefix] || text;
  }
}