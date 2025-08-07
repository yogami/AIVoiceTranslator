/**
 * Emotion Control Service Unit Tests
 * 
 * Tests the EmotionControlService class methods and functionality:
 * 1. Service initialization and emotion settings
 * 2. Emotional synthesis options and parameters
 * 3. Educational emotion recommendations
 * 4. Cultural adaptations and emphasis handling
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ElevenLabsEmotionControlService as EmotionControlService, EmotionContext, EmotionalTTSOptions } from '../../server/services/tts/EmotionControlService';

// Helper to create proper ArrayBuffer for mocking
function createMockArrayBuffer(size: number): ArrayBuffer {
  const buffer = Buffer.alloc(size);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

describe('ElevenLabsEmotionControlService Unit Tests', () => {
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
        const service = new EmotionControlService();
        expect(service).toBeInstanceOf(EmotionControlService);
      }).not.toThrow();
    });

    it('should throw error when API key is missing', () => {
      delete process.env.ELEVENLABS_API_KEY;
      
      expect(() => {
        new EmotionControlService();
      }).toThrow('ELEVENLABS_API_KEY environment variable is required');
    });

    it('should report availability correctly', () => {
      const service = new EmotionControlService();
      expect(service.isAvailable()).toBe(true);
      
      delete process.env.ELEVENLABS_API_KEY;
      const serviceWithoutKey = () => new EmotionControlService();
      expect(serviceWithoutKey).toThrow();
    });
  });

  describe('Educational Emotion Recommendations', () => {
    it('should provide correct emotion for explanation content', () => {
      const emotion = EmotionControlService.getEducationalEmotion('explanation');
      
      expect(emotion.primaryEmotion).toBe('calm');
      expect(emotion.intensity).toBe(0.7);
      expect(emotion.pace).toBe('normal');
    });

    it('should provide correct emotion for encouragement content', () => {
      const emotion = EmotionControlService.getEducationalEmotion('encouragement');
      
      expect(emotion.primaryEmotion).toBe('encouraging');
      expect(emotion.intensity).toBe(0.8);
      expect(emotion.pace).toBe('normal');
    });

    it('should provide correct emotion for warning content', () => {
      const emotion = EmotionControlService.getEducationalEmotion('warning');
      
      expect(emotion.primaryEmotion).toBe('concerned');
      expect(emotion.intensity).toBe(0.6);
      expect(emotion.pace).toBe('slow');
    });

    it('should provide correct emotion for excitement content', () => {
      const emotion = EmotionControlService.getEducationalEmotion('excitement');
      
      expect(emotion.primaryEmotion).toBe('excited');
      expect(emotion.intensity).toBe(0.9);
      expect(emotion.pace).toBe('fast');
    });

    it('should provide correct emotion for instruction content', () => {
      const emotion = EmotionControlService.getEducationalEmotion('instruction');
      
      expect(emotion.primaryEmotion).toBe('serious');
      expect(emotion.intensity).toBe(0.5);
      expect(emotion.pace).toBe('normal');
    });

    it('should provide correct emotion for praise content', () => {
      const emotion = EmotionControlService.getEducationalEmotion('praise');
      
      expect(emotion.primaryEmotion).toBe('encouraging');
      expect(emotion.intensity).toBe(1.0);
      expect(emotion.pace).toBe('normal');
    });

    it('should provide correct emotion for question content', () => {
      const emotion = EmotionControlService.getEducationalEmotion('question');
      
      expect(emotion.primaryEmotion).toBe('encouraging');
      expect(emotion.intensity).toBe(0.6);
      expect(emotion.pace).toBe('normal');
    });

    it('should provide neutral emotion for unknown content types', () => {
      const emotion = EmotionControlService.getEducationalEmotion('unknown');
      
      expect(emotion.primaryEmotion).toBe('neutral');
      expect(emotion.intensity).toBe(0.6);
    });
  });

  describe('Emotional Synthesis', () => {
    it('should synthesize speech with basic emotion options', async () => {
      const service = new EmotionControlService();
      const expectedAudioSize = 15; // Size we want the result to be
      
      const options: EmotionalTTSOptions = {
        text: 'Hello students, welcome to class!',
        language: 'en',
        voiceId: 'test-voice-id',
        emotionContext: {
          primaryEmotion: 'encouraging',
          intensity: 0.8
        }
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(createMockArrayBuffer(expectedAudioSize))
      });
      
      const result = await service.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBe(expectedAudioSize);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[0]).toBe('https://api.elevenlabs.io/v1/text-to-speech/test-voice-id');
      expect(fetchCall[1].headers['xi-api-key']).toBe('test-api-key');
    });

    it('should synthesize speech with full emotion options', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('mock-audio-data');
      
      const options: EmotionalTTSOptions = {
        text: 'Please pay attention to this important concept.',
        language: 'en',
        voiceId: 'teacher-voice',
        emotionContext: {
          primaryEmotion: 'serious',
          intensity: 0.9,
          pace: 'slow',
          emphasis: ['attention', 'important'],
          culturalContext: {
            targetCulture: 'jp',
            formalityLevel: 'formal',
            ageGroup: 'teens'
          }
        },
        outputFormat: 'wav'
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await service.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['Accept']).toBe('audio/wav');
      
      // Verify request body contains emotion settings
      const requestBody = JSON.parse(fetchCall[1].body);
      expect(requestBody.voice_settings).toBeDefined();
      expect(requestBody.voice_settings.stability).toBeDefined();
      expect(requestBody.voice_settings.similarity_boost).toBeDefined();
      expect(requestBody.voice_settings.style).toBeDefined();
    });

    it('should apply emphasis markers to text', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('mock-audio-data');
      
      const options: EmotionalTTSOptions = {
        text: 'The equation has two important variables.',
        language: 'en',
        voiceId: 'test-voice',
        emotionContext: {
          primaryEmotion: 'neutral',
          emphasis: ['equation', 'important', 'variables']
        }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion(options);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const processedText = requestBody.text;
      
      expect(processedText).toContain('<emphasis level="strong">equation</emphasis>');
      expect(processedText).toContain('<emphasis level="strong">important</emphasis>');
      expect(processedText).toContain('<emphasis level="strong">variables</emphasis>');
    });

    it('should apply cultural adaptations to text', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('mock-audio-data');
      
      const options: EmotionalTTSOptions = {
        text: 'Good morning class.',
        language: 'ja',
        voiceId: 'japanese-teacher',
        emotionContext: {
          primaryEmotion: 'calm',
          culturalContext: {
            targetCulture: 'japanese',
            formalityLevel: 'formal',
            ageGroup: 'children'
          }
        }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion(options);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const processedText = requestBody.text;
      
      expect(processedText).toContain('<prosody');
      expect(processedText).toContain('pitch=');
    });

    it('should handle API errors gracefully', async () => {
      const service = new EmotionControlService();
      
      const options: EmotionalTTSOptions = {
        text: 'Test message',
        language: 'en',
        voiceId: 'test-voice',
        emotionContext: {
          primaryEmotion: 'neutral'
        }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve('Bad Request')
      });
      
      await expect(service.synthesizeWithEmotion(options)).rejects.toThrow('Emotional TTS failed: 400 Bad Request');
    });

    it('should handle network errors gracefully', async () => {
      const service = new EmotionControlService();
      
      const options: EmotionalTTSOptions = {
        text: 'Test message',
        language: 'en',
        voiceId: 'test-voice',
        emotionContext: {
          primaryEmotion: 'neutral'
        }
      };
      
      (global.fetch as any).mockRejectedValueOnce(new Error('Network error'));
      
      await expect(service.synthesizeWithEmotion(options)).rejects.toThrow('Network error');
    });
  });

  describe('Emotion Settings Configuration', () => {
    it('should apply correct settings for excited emotion', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('test');
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion({
        text: 'Great job everyone!',
        language: 'en',
        voiceId: 'test',
        emotionContext: {
          primaryEmotion: 'excited',
          intensity: 0.8
        }
      });
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const voiceSettings = requestBody.voice_settings;
      
      // Excited emotion should have low stability, high similarity boost, high style
      expect(voiceSettings.stability).toBeLessThan(0.5);
      expect(voiceSettings.similarity_boost).toBeGreaterThan(0.7);
      expect(voiceSettings.style).toBeGreaterThan(0.7);
    });

    it('should apply correct settings for calm emotion', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('test');
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion({
        text: 'Let me explain this slowly.',
        language: 'en',
        voiceId: 'test',
        emotionContext: {
          primaryEmotion: 'calm',
          intensity: 0.6
        }
      });
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      const voiceSettings = requestBody.voice_settings;
      
      // Calm emotion should have high stability, moderate similarity boost, low style
      expect(voiceSettings.stability).toBeGreaterThan(0.7);
      expect(voiceSettings.similarity_boost).toBeLessThan(0.7);
      expect(voiceSettings.style).toBeLessThan(0.5);
    });

    it('should adjust settings based on intensity', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('test');
      
      // Test high intensity
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion({
        text: 'Test high intensity',
        language: 'en',
        voiceId: 'test',
        emotionContext: {
          primaryEmotion: 'encouraging',
          intensity: 1.0
        }
      });
      
      const highIntensitySettings = JSON.parse((global.fetch as any).mock.calls[0][1].body).voice_settings;
      
      // Test low intensity
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion({
        text: 'Test low intensity',
        language: 'en',
        voiceId: 'test',
        emotionContext: {
          primaryEmotion: 'encouraging',
          intensity: 0.2
        }
      });
      
      const lowIntensitySettings = JSON.parse((global.fetch as any).mock.calls[1][1].body).voice_settings;
      
      // High intensity should result in different settings than low intensity
      expect(highIntensitySettings.style).not.toBe(lowIntensitySettings.style);
    });

    it('should adjust speaking rate based on pace', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('test');
      
      const paceTests = [
        { pace: 'slow' as const, expectedMultiplier: 0.8 },
        { pace: 'normal' as const, expectedMultiplier: 1.0 },
        { pace: 'fast' as const, expectedMultiplier: 1.2 }
      ];
      
      for (const test of paceTests) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
        });
        
        await service.synthesizeWithEmotion({
          text: `Test ${test.pace} pace`,
          language: 'en',
          voiceId: 'test',
          emotionContext: {
            primaryEmotion: 'neutral',
            pace: test.pace
          }
        });
      }
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Output Format Handling', () => {
    it('should default to mp3 format', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('test');
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion({
        text: 'Test default format',
        language: 'en',
        voiceId: 'test',
        emotionContext: { primaryEmotion: 'neutral' }
      });
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['Accept']).toBe('audio/mp3');
    });

    it('should support wav format', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('test');
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion({
        text: 'Test wav format',
        language: 'en',
        voiceId: 'test',
        emotionContext: { primaryEmotion: 'neutral' },
        outputFormat: 'wav'
      });
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['Accept']).toBe('audio/wav');
    });

    it('should support opus format', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('test');
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion({
        text: 'Test opus format',
        language: 'en',
        voiceId: 'test',
        emotionContext: { primaryEmotion: 'neutral' },
        outputFormat: 'opus'
      });
      
      const fetchCall = (global.fetch as any).mock.calls[0];
      expect(fetchCall[1].headers['Accept']).toBe('audio/opus');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle empty text gracefully', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('empty');
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await service.synthesizeWithEmotion({
        text: '',
        language: 'en',
        voiceId: 'test',
        emotionContext: { primaryEmotion: 'neutral' }
      });
      
      expect(result).toBeInstanceOf(Buffer);
    });

    it('should handle text without emphasis words', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('test');
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion({
        text: 'No emphasis words here',
        language: 'en',
        voiceId: 'test',
        emotionContext: {
          primaryEmotion: 'neutral',
          emphasis: []
        }
      });
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(requestBody.text).toBe('No emphasis words here');
    });

    it('should handle missing cultural context gracefully', async () => {
      const service = new EmotionControlService();
      const mockAudioBuffer = Buffer.from('test');
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      await service.synthesizeWithEmotion({
        text: 'No cultural context',
        language: 'en',
        voiceId: 'test',
        emotionContext: {
          primaryEmotion: 'neutral'
          // culturalContext intentionally omitted
        }
      });
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(requestBody.text).toBe('No cultural context');
    });

    it('should handle concurrent synthesis requests', async () => {
      const service = new EmotionControlService();
      const expectedAudioSize = 15; // Expected result size
      
      // Mock multiple responses
      for (let i = 0; i < 3; i++) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(createMockArrayBuffer(expectedAudioSize))
        });
      }
      
      const promises = Array(3).fill(null).map((_, index) =>
        service.synthesizeWithEmotion({
          text: `Concurrent message ${index}`,
          language: 'en',
          voiceId: 'test',
          emotionContext: { primaryEmotion: 'neutral' }
        })
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBe(expectedAudioSize);
      });
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });
  });
});
