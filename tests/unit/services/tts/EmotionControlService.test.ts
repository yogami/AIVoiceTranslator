import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ElevenLabsEmotionControlService, type EmotionContext, type EmotionalTTSOptions } from '../../../../server/services/tts/EmotionControlService.js';

// Mock fetch for ElevenLabs API calls
global.fetch = vi.fn();

describe('ElevenLabsEmotionControlService', () => {
  let emotionControlService: ElevenLabsEmotionControlService;

  beforeEach(() => {
    // Mock successful API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      arrayBuffer: () => Promise.resolve(new ArrayBuffer(1024))
    });
    
    emotionControlService = new ElevenLabsEmotionControlService();
  });

  describe('constructor', () => {
    it('should initialize successfully', () => {
      expect(emotionControlService).toBeDefined();
    });
  });

  describe('applyEmotionalContext', () => {
    it('should apply excited emotion context', async () => {
      const options: EmotionalTTSOptions = {
        text: 'Great job everyone!',
        language: 'en',
        voiceId: 'EXAVITQu4vr4xnSDxMaL', // Use a realistic ElevenLabs voice ID format
        emotionContext: {
          primaryEmotion: 'excited',
          intensity: 0.8,
          pace: 'normal'
        }
      };

      const result = await emotionControlService.applyEmotionalContext(options);

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
      expect(result.text).toBe(options.text);
      expect(result.emotionSettings).toBeDefined();
    });

    it('should apply calm emotion context', async () => {
      const options: EmotionalTTSOptions = {
        text: 'Let us focus on the next topic.',
        language: 'en',
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        emotionContext: {
          primaryEmotion: 'calm',
          intensity: 0.4,
          pace: 'slow'
        }
      };

      const result = await emotionControlService.applyEmotionalContext(options);

      expect(result.emotionSettings.pace).toBe('slow');
      expect(result.emotionSettings.intensity).toBe(0.4);
    });

    it('should handle cultural context adaptation', async () => {
      const options: EmotionalTTSOptions = {
        text: 'Please complete your assignment.',
        language: 'ja',
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        emotionContext: {
          primaryEmotion: 'serious',
          intensity: 0.6,
          culturalContext: {
            targetCulture: 'jp',
            formalityLevel: 'formal',
            ageGroup: 'children'
          }
        }
      };

      const result = await emotionControlService.applyEmotionalContext(options);

      expect(result.culturalAdaptations).toBeDefined();
      expect(result.culturalAdaptations.formalityLevel).toBe('formal');
    });

    it('should handle emphasis words', async () => {
      const options: EmotionalTTSOptions = {
        text: 'Remember to submit your homework today.',
        language: 'en',
        voiceId: 'EXAVITQu4vr4xnSDxMaL',
        emotionContext: {
          primaryEmotion: 'encouraging',
          emphasis: ['Remember', 'today']
        }
      };

      const result = await emotionControlService.applyEmotionalContext(options);

      expect(result.emphasis).toEqual(['Remember', 'today']);
    });
  });

  describe('getSupportedEmotions', () => {
    it('should return list of supported emotions', () => {
      const emotions = emotionControlService.getSupportedEmotions();
      
      expect(Array.isArray(emotions)).toBe(true);
      expect(emotions.length).toBeGreaterThan(0);
      expect(emotions).toContain('excited');
      expect(emotions).toContain('calm');
      expect(emotions).toContain('concerned');
      expect(emotions).toContain('encouraging');
      expect(emotions).toContain('serious');
      expect(emotions).toContain('neutral');
    });
  });

  describe('getPaceOptions', () => {
    it('should return available pace options', () => {
      const paces = emotionControlService.getPaceOptions();
      
      expect(Array.isArray(paces)).toBe(true);
      expect(paces).toContain('slow');
      expect(paces).toContain('normal');
      expect(paces).toContain('fast');
    });
  });

  describe('validateEmotionContext', () => {
    it('should validate valid emotion context', () => {
      const context: EmotionContext = {
        primaryEmotion: 'excited',
        intensity: 0.8,
        pace: 'normal',
        emphasis: ['great', 'job']
      };

      const isValid = emotionControlService.validateEmotionContext(context);
      expect(isValid).toBe(true);
    });

    it('should reject invalid emotion context', () => {
      const context: EmotionContext = {
        primaryEmotion: 'invalid' as any,
        intensity: 1.5, // Invalid intensity > 1.0
        pace: 'normal'
      };

      const isValid = emotionControlService.validateEmotionContext(context);
      expect(isValid).toBe(false);
    });

    it('should handle missing optional fields', () => {
      const context: EmotionContext = {
        primaryEmotion: 'neutral'
      };

      const isValid = emotionControlService.validateEmotionContext(context);
      expect(isValid).toBe(true);
    });
  });

  describe('extractEmotionFromText', () => {
    it('should detect excitement in text', () => {
      const text = 'Fantastic! You did amazing work!';
      const detectedEmotion = emotionControlService.extractEmotionFromText(text);
      
      expect(detectedEmotion.primaryEmotion).toBe('excited');
      expect(detectedEmotion.intensity).toBeGreaterThan(0.5);
    });

    it('should detect calm tone in text', () => {
      const text = 'Let us review the material quietly.';
      const detectedEmotion = emotionControlService.extractEmotionFromText(text);
      
      expect(['calm', 'neutral']).toContain(detectedEmotion.primaryEmotion);
    });

    it('should detect concern in text', () => {
      const text = 'Please pay attention, this is important.';
      const detectedEmotion = emotionControlService.extractEmotionFromText(text);
      
      expect(['concerned', 'serious']).toContain(detectedEmotion.primaryEmotion);
    });
  });

  describe('adjustForCulture', () => {
    it('should adjust emotion for Japanese culture', () => {
      const context: EmotionContext = {
        primaryEmotion: 'excited',
        intensity: 0.9,
        culturalContext: {
          targetCulture: 'jp',
          formalityLevel: 'formal',
          ageGroup: 'children'
        }
      };

      const adjusted = emotionControlService.adjustForCulture(context);
      
      // Japanese culture typically uses more reserved expressions
      expect(adjusted.intensity).toBeLessThan(0.9);
      expect(adjusted.culturalAdaptations).toBeDefined();
    });

    it('should maintain appropriate emotion for German culture', () => {
      const context: EmotionContext = {
        primaryEmotion: 'serious',
        intensity: 0.7,
        culturalContext: {
          targetCulture: 'de',
          formalityLevel: 'academic',
          ageGroup: 'adults'
        }
      };

      const adjusted = emotionControlService.adjustForCulture(context);
      
      expect(adjusted.primaryEmotion).toBe('serious');
      expect(adjusted.intensity).toBeGreaterThanOrEqual(0.6);
    });
  });
});
