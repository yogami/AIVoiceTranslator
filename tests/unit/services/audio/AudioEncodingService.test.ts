import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioEncodingService } from '../../../../server/services/audio/AudioEncodingService.js';

describe('AudioEncodingService', () => {
  let audioEncodingService: AudioEncodingService;

  beforeEach(() => {
    audioEncodingService = new AudioEncodingService();
  });

  describe('encodeAudio', () => {
    it('should encode audio successfully', async () => {
      // Mock audio data
      const mockAudioBuffer = Buffer.from('test audio data');
      
      // Test the encoding process
      const result = await audioEncodingService.encodeAudio(mockAudioBuffer, 'mp3');
      
      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('should handle encoding errors gracefully', async () => {
      const mockInvalidBuffer = Buffer.from('');
      
      await expect(
        audioEncodingService.encodeAudio(mockInvalidBuffer, 'invalid-format' as any)
      ).rejects.toThrow();
    });
  });

  describe('getSupportedFormats', () => {
    it('should return list of supported audio formats', () => {
      const formats = audioEncodingService.getSupportedFormats();
      
      expect(Array.isArray(formats)).toBe(true);
      expect(formats.length).toBeGreaterThan(0);
      expect(formats).toContain('mp3');
    });
  });
});
