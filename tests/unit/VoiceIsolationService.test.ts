/**
 * Voice Isolation Service Unit Tests
 * 
 * Tests the VoiceIsolationService class methods and functionality:
 * 1. Service initialization and configuration
 * 2. Audio quality analysis
 * 3. Error handling and fallback behavior
 * 4. API availability checks
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceIsolationService, VoiceIsolationOptions } from '../../server/services/audio/VoiceIsolationService.js';

// Create test audio buffer
function createTestAudioBuffer(size: number = 1024): Buffer {
  return Buffer.from(new Array(size).fill(0).map(() => Math.floor(Math.random() * 255)));
}

// Helper to create proper ArrayBuffer for mocking
function createMockArrayBuffer(size: number): ArrayBuffer {
  const buffer = Buffer.alloc(size);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe('VoiceIsolationService Unit Tests', () => {
  let originalApiKey: string | undefined;

  beforeEach(() => {
    originalApiKey = process.env.ELEVENLABS_API_KEY;
    process.env.ELEVENLABS_API_KEY = 'test-api-key';
    
    // Mock fetch for tests
    global.fetch = vi.fn();
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.ELEVENLABS_API_KEY = originalApiKey;
    } else {
      delete process.env.ELEVENLABS_API_KEY;
    }
    
    vi.restoreAllMocks();
  });

  describe('Service Initialization', () => {
    it('should initialize successfully with valid API key', () => {
      expect(() => {
        const service = new VoiceIsolationService();
        expect(service).toBeInstanceOf(VoiceIsolationService);
      }).not.toThrow();
    });

    it('should throw error when API key is missing', () => {
      delete process.env.ELEVENLABS_API_KEY;
      
      expect(() => {
        new VoiceIsolationService();
      }).toThrow('ELEVENLABS_API_KEY environment variable is required');
    });

    it('should report availability correctly', () => {
      const service = new VoiceIsolationService();
      expect(service.isAvailable()).toBe(true);
      
      delete process.env.ELEVENLABS_API_KEY;
      const serviceWithoutKey = () => new VoiceIsolationService();
      expect(serviceWithoutKey).toThrow();
    });
  });

  describe('Audio Quality Analysis', () => {
    it('should analyze audio quality metrics correctly', async () => {
      const service = new VoiceIsolationService();
      const originalBuffer = createTestAudioBuffer(2048);
      const isolatedBuffer = createTestAudioBuffer(1536); // Smaller to simulate compression
      
      const analysis = await service.analyzeAudioQuality(originalBuffer, isolatedBuffer);
      
      expect(analysis).toHaveProperty('originalSize', 2048);
      expect(analysis).toHaveProperty('isolatedSize', 1536);
      expect(analysis).toHaveProperty('compressionRatio');
      expect(analysis).toHaveProperty('estimatedNoiseReduction');
      
      expect(analysis.compressionRatio).toBeCloseTo(1536 / 2048, 3);
      expect(analysis.estimatedNoiseReduction).toBeCloseTo((2048 - 1536) / 2048, 3);
    });

    it('should handle zero noise reduction correctly', async () => {
      const service = new VoiceIsolationService();
      const originalBuffer = createTestAudioBuffer(1024);
      const isolatedBuffer = createTestAudioBuffer(1024); // Same size
      
      const analysis = await service.analyzeAudioQuality(originalBuffer, isolatedBuffer);
      
      expect(analysis.estimatedNoiseReduction).toBe(0);
      expect(analysis.compressionRatio).toBe(1);
    });

    it('should handle larger isolated buffer correctly', async () => {
      const service = new VoiceIsolationService();
      const originalBuffer = createTestAudioBuffer(1024);
      const isolatedBuffer = createTestAudioBuffer(1536); // Larger
      
      const analysis = await service.analyzeAudioQuality(originalBuffer, isolatedBuffer);
      
      expect(analysis.estimatedNoiseReduction).toBe(0); // No negative noise reduction
      expect(analysis.compressionRatio).toBeGreaterThan(1);
    });
  });

  describe('Voice Isolation Processing', () => {
    it('should process audio with default options', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      // Mock successful API response - return exactly 800 bytes
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(createMockArrayBuffer(800))
      });
      
      const result = await service.isolateVoice(audioBuffer);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(800);
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should process audio with custom options', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      const options: VoiceIsolationOptions = {
        removeBackgroundNoise: true,
        isolatePrimarySpeaker: false,
        enhancementStrength: 0.9
      };
      
      // Mock successful API response - return exactly 600 bytes
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(createMockArrayBuffer(600))
      });
      
      const result = await service.isolateVoice(audioBuffer, options);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(600);
      
      // Verify fetch was called with correct options
      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.elevenlabs.io/v1/audio-isolation',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'xi-api-key': 'test-api-key'
          }
        })
      );
    });

    it('should return original audio on API failure', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      // Mock API failure
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Internal Server Error')
      });
      
      const result = await service.isolateVoice(audioBuffer);
      
      expect(result).toBe(audioBuffer); // Should return original buffer
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should return original audio on network error', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      // Mock network error
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      const result = await service.isolateVoice(audioBuffer);
      
      expect(result).toBe(audioBuffer); // Should return original buffer
    });

    it('should handle empty audio buffer', async () => {
      const service = new VoiceIsolationService();
      const emptyBuffer = Buffer.alloc(0);
      
      const result = await service.isolateVoice(emptyBuffer);
      
      expect(result).toBe(emptyBuffer);
      expect(global.fetch).not.toHaveBeenCalled(); // Should not make API call
    });
  });

  describe('Option Validation', () => {
    it('should apply default options when none provided', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer.buffer)
      });
      
      await service.isolateVoice(audioBuffer);
      
      // Verify default options were used
      const formData = (global.fetch as any).mock.calls[0][1].body;
      expect(formData).toBeInstanceOf(FormData);
    });

    it('should validate enhancement strength bounds', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer.buffer)
      });
      
      // Test with extreme values
      await service.isolateVoice(audioBuffer, { enhancementStrength: 1.5 }); // Should be clamped
      await service.isolateVoice(audioBuffer, { enhancementStrength: -0.5 }); // Should be clamped
      
      expect(global.fetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('Error Handling', () => {
    it('should handle API rate limiting gracefully', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded')
      });
      
      const result = await service.isolateVoice(audioBuffer);
      
      expect(result).toBe(audioBuffer);
    });

    it('should handle invalid API key gracefully', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve('Unauthorized')
      });
      
      const result = await service.isolateVoice(audioBuffer);
      
      expect(result).toBe(audioBuffer);
    });

    it('should handle malformed API response', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.reject(new Error('Invalid response'))
      });
      
      const result = await service.isolateVoice(audioBuffer);
      
      expect(result).toBe(audioBuffer);
    });
  });

  describe('Performance and Edge Cases', () => {
    it('should handle large audio buffers', async () => {
      const service = new VoiceIsolationService();
      const largeBuffer = createTestAudioBuffer(10 * 1024 * 1024); // 10MB
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(largeBuffer.buffer)
      });
      
      const result = await service.isolateVoice(largeBuffer);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(largeBuffer.length);
    });

    it('should handle concurrent requests', async () => {
      const service = new VoiceIsolationService();
      const bufferSizes = [512, 1024, 768];
      const audioBuffers = bufferSizes.map(size => createTestAudioBuffer(size));
      
      // Mock responses for each request with correct buffer sizes
      bufferSizes.forEach(size => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(createMockArrayBuffer(size))
        });
      });
      
      const promises = audioBuffers.map(buffer => service.isolateVoice(buffer));
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBe(bufferSizes[index]);
      });
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
