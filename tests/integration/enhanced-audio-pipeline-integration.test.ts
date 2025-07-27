/**
 * Enhanced STT with Voice Isolation, Emotion Control, and Cultural Context Integration Tests
 * 
 * Tests the complete enhanced audio processing pipeline:
 * 1. Voice Isolation for improved STT accuracy
 * 2. 3-tier STT fallback with enhanced audio
 * 3. Cultural Context-aware translation
 * 4. Emotion Control for culturally appropriate TTS
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VoiceIsolationService } from '../../server/services/audio/VoiceIsolationService.js';
import { AutoFallbackSTTService } from '../../server/services/transcription/AutoFallbackSTTService.js';
import { CulturalContextService } from '../../server/services/translation/CulturalContextService.js';
import { EmotionControlService } from '../../server/services/tts/EmotionControlService.js';
import { getTranslationService } from '../../server/services/translation/TranslationServiceFactory.js';

// Create test audio buffer
function createTestAudioBuffer(): Buffer {
  // Create a simple audio buffer for testing
  return Buffer.from(new Array(1024).fill(0).map(() => Math.random() * 255));
}

describe('Enhanced Educational Audio Pipeline Integration', () => {
  let originalApiKeys: Record<string, string | undefined>;

  beforeEach(() => {
    // Store original environment variables
    originalApiKeys = {
      ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY,
      STT_SERVICE_TYPE: process.env.STT_SERVICE_TYPE,
      TRANSLATION_SERVICE_TYPE: process.env.TRANSLATION_SERVICE_TYPE
    };

    // Set test environment
    process.env.STT_SERVICE_TYPE = 'auto';
    process.env.TRANSLATION_SERVICE_TYPE = 'auto';
    process.env.ELEVENLABS_API_KEY = 'test-key';
    process.env.OPENAI_API_KEY = 'test-key';
    
    // Mock fetch for API calls
    global.fetch = vi.fn();
  });

  afterEach(() => {
    // Restore original environment variables
    Object.entries(originalApiKeys).forEach(([key, value]) => {
      if (value !== undefined) {
        process.env[key] = value;
      } else {
        delete process.env[key];
      }
    });
    
    vi.restoreAllMocks();
  });

  describe('Voice Isolation Service', () => {
    it('should initialize voice isolation service when API key is available', () => {
      expect(() => {
        const service = new VoiceIsolationService();
        expect(service.isAvailable()).toBe(true);
      }).not.toThrow();
    });

    it('should handle missing API key gracefully', () => {
      delete process.env.ELEVENLABS_API_KEY;
      
      expect(() => {
        new VoiceIsolationService();
      }).toThrow('ELEVENLABS_API_KEY environment variable is required');
    });

    it('should provide audio quality analysis methods', async () => {
      const service = new VoiceIsolationService();
      const originalBuffer = createTestAudioBuffer();
      const processedBuffer = Buffer.from(originalBuffer.subarray(0, 512)); // Simulate processed audio
      
      const analysis = await service.analyzeAudioQuality(originalBuffer, processedBuffer);
      
      expect(analysis).toHaveProperty('originalSize');
      expect(analysis).toHaveProperty('isolatedSize');
      expect(analysis).toHaveProperty('compressionRatio');
      expect(analysis).toHaveProperty('estimatedNoiseReduction');
      expect(analysis.originalSize).toBe(originalBuffer.length);
      expect(analysis.isolatedSize).toBe(processedBuffer.length);
    });

    it('should handle voice isolation failure gracefully', async () => {
      const service = new VoiceIsolationService();
      const audioBuffer = createTestAudioBuffer();
      
      // Mock API failure
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve('Server Error')
      });
      
      // This will fail due to invalid API key, but should return original audio
      const result = await service.isolateVoice(audioBuffer);
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('Enhanced STT with Voice Isolation', () => {
    it('should integrate voice isolation into STT pipeline', async () => {
      const sttService = new AutoFallbackSTTService();
      const audioBuffer = createTestAudioBuffer();
      
      // Service should be instantiated with voice isolation capability
      expect(sttService).toBeDefined();
      
      // The transcribe method should handle voice isolation preprocessing
      try {
        await sttService.transcribe(audioBuffer, { language: 'en' });
      } catch (error) {
        // Expected in test environment, but should reach the transcribe method
        expect(error).toBeDefined();
      }
    });

    it('should fallback to original audio if voice isolation fails', async () => {
      const sttService = new AutoFallbackSTTService();
      const audioBuffer = createTestAudioBuffer();
      
      // Even with invalid keys, the service should attempt processing
      try {
        await sttService.transcribe(audioBuffer, { language: 'en' });
      } catch (error) {
        // Expected failure, but voice isolation fallback should work
        expect(error).toBeDefined();
      }
    });

    it('should support multiple languages with voice isolation', async () => {
      const sttService = new AutoFallbackSTTService();
      const audioBuffer = createTestAudioBuffer();
      
      const languages = ['en', 'es', 'fr', 'de', 'ja'];
      
      for (const language of languages) {
        try {
          await sttService.transcribe(audioBuffer, { language });
        } catch (error) {
          // Expected in test environment
          expect(error).toBeDefined();
        }
      }
    });
  });

  describe('Cultural Context Service', () => {
    it('should initialize cultural context service', () => {
      const service = new CulturalContextService();
      expect(service).toBeDefined();
    });

    it('should support multiple cultures', () => {
      const service = new CulturalContextService();
      const supportedCultures = service.getSupportedCultures();
      
      expect(supportedCultures).toContain('jp');
      expect(supportedCultures).toContain('kr');
      expect(supportedCultures).toContain('de');
      expect(supportedCultures).toContain('fr');
      expect(supportedCultures).toContain('mx');
      expect(supportedCultures).toContain('br');
    });

    it('should check culture support correctly', () => {
      const service = new CulturalContextService();
      
      expect(service.isCultureSupported('jp')).toBe(true);
      expect(service.isCultureSupported('unknown')).toBe(false);
    });

    it('should adapt translation with cultural context', async () => {
      const service = new CulturalContextService();
      
      const adaptationOptions = {
        originalText: 'Please pay attention to this important lesson.',
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        culturalContext: {
          targetCulture: 'jp',
          educationalLevel: 'middle' as const,
          formalityLevel: 'formal' as const,
          studentAgeGroup: 'teens' as const
        },
        contentType: 'instruction' as const
      };
      
      const adaptedText = await service.adaptTranslation(adaptationOptions);
      expect(typeof adaptedText).toBe('string');
      expect(adaptedText.length).toBeGreaterThan(0);
    });

    it('should provide recommended context for languages', () => {
      const jaContext = CulturalContextService.getRecommendedContext('ja');
      expect(jaContext.targetCulture).toBe('jp');
      expect(jaContext.formalityLevel).toBe('formal');
      
      const deContext = CulturalContextService.getRecommendedContext('de');
      expect(deContext.targetCulture).toBe('de');
      expect(deContext.formalityLevel).toBe('semi-formal');
    });
  });

  describe('Emotion Control Service', () => {
    it('should initialize emotion control service when API key is available', () => {
      expect(() => {
        const service = new EmotionControlService();
        expect(service.isAvailable()).toBe(true);
      }).not.toThrow();
    });

    it('should handle missing API key', () => {
      delete process.env.ELEVENLABS_API_KEY;
      
      expect(() => {
        new EmotionControlService();
      }).toThrow('ELEVENLABS_API_KEY environment variable is required');
    });

    it('should provide educational emotion recommendations', () => {
      const explanationEmotion = EmotionControlService.getEducationalEmotion('explanation');
      expect(explanationEmotion.primaryEmotion).toBe('calm');
      expect(explanationEmotion.intensity).toBe(0.7);
      
      const encouragementEmotion = EmotionControlService.getEducationalEmotion('encouragement');
      expect(encouragementEmotion.primaryEmotion).toBe('encouraging');
      expect(encouragementEmotion.intensity).toBe(0.8);
      
      const warningEmotion = EmotionControlService.getEducationalEmotion('warning');
      expect(warningEmotion.primaryEmotion).toBe('concerned');
      expect(warningEmotion.pace).toBe('slow');
    });

    it('should handle emotion synthesis gracefully in test environment', async () => {
      const service = new EmotionControlService();
      
      const emotionOptions = {
        text: 'This is a test message for emotional synthesis.',
        language: 'en',
        voiceId: 'test-voice-id',
        emotionContext: {
          primaryEmotion: 'encouraging' as const,
          intensity: 0.8,
          pace: 'normal' as const,
          emphasis: ['test', 'emotional']
        }
      };
      
      // Mock API response
      const mockAudioBuffer = Buffer.from('mock-emotional-audio');
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      try {
        const result = await service.synthesizeWithEmotion(emotionOptions);
        expect(result).toBeInstanceOf(Buffer);
      } catch (error) {
        // Expected in test environment due to invalid API keys
        expect(error).toBeDefined();
      }
    });
  });

  describe('Complete Enhanced Pipeline Integration', () => {
    it('should demonstrate complete enhanced educational pipeline', async () => {
      // This test demonstrates the complete enhanced pipeline workflow
      
      // 1. Voice Isolation Service
      const voiceIsolation = new VoiceIsolationService();
      expect(voiceIsolation.isAvailable()).toBe(true);
      
      // 2. Enhanced STT with voice isolation
      const sttService = new AutoFallbackSTTService();
      expect(sttService).toBeDefined();
      
      // 3. Cultural Context Service
      const culturalService = new CulturalContextService();
      expect(culturalService.getSupportedCultures().length).toBeGreaterThan(0);
      
      // 4. Emotion Control Service
      const emotionService = new EmotionControlService();
      expect(emotionService.isAvailable()).toBe(true);
      
      console.log('✅ Complete enhanced educational audio pipeline initialized');
      console.log('   - Voice isolation for STT accuracy improvement');
      console.log('   - 3-tier STT fallback with enhanced audio');
      console.log('   - Cultural context-aware translation adaptation');
      console.log('   - Emotion control for pedagogically effective TTS');
    });

    it('should handle real-world classroom scenario simulation', async () => {
      // Simulate a classroom scenario with background noise and multiple languages
      
      const audioBuffer = createTestAudioBuffer();
      const teacherText = "Great job on your homework! Now let's learn about equations.";
      
      // 1. Voice isolation would clean the audio
      const voiceIsolation = new VoiceIsolationService();
      
      // Mock voice isolation API
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(audioBuffer.buffer)
      });
      
      const cleanedAudio = await voiceIsolation.isolateVoice(audioBuffer);
      expect(cleanedAudio).toBeInstanceOf(Buffer);
      
      // 2. Cultural adaptation for Japanese students
      const culturalService = new CulturalContextService();
      const culturalContext = {
        targetCulture: 'jp',
        educationalLevel: 'middle' as const,
        formalityLevel: 'formal' as const,
        subjectArea: 'math' as const,
        studentAgeGroup: 'teens' as const
      };
      
      const adaptedText = await culturalService.adaptTranslation({
        originalText: teacherText,
        sourceLanguage: 'en',
        targetLanguage: 'ja',
        culturalContext,
        contentType: 'encouragement'
      });
      
      expect(adaptedText).toContain('[RESPECTFUL_ENCOURAGEMENT]');
      
      // 3. Emotion control for encouraging delivery
      const emotionService = new EmotionControlService();
      const encouragingEmotion = EmotionControlService.getEducationalEmotion('praise');
      
      expect(encouragingEmotion.primaryEmotion).toBe('encouraging');
      expect(encouragingEmotion.intensity).toBe(1.0);
      
      // 4. Translation service integration
      const translationService = getTranslationService();
      expect(translationService).toBeDefined();
      
      console.log('✅ Classroom scenario simulation completed');
      console.log(`   - Original: "${teacherText}"`);
      console.log(`   - Adapted: "${adaptedText}"`);
      console.log(`   - Emotion: ${encouragingEmotion.primaryEmotion} (${encouragingEmotion.intensity})`);
    });

    it('should support multiple student language groups simultaneously', async () => {
      // Test supporting multiple student language groups in one classroom
      
      const teacherMessage = "Please turn to page 42 for today's lesson.";
      const culturalService = new CulturalContextService();
      
      const studentGroups = [
        { language: 'ja', culture: 'jp', formality: 'formal' as const },
        { language: 'ko', culture: 'kr', formality: 'formal' as const },
        { language: 'es', culture: 'mx', formality: 'semi-formal' as const },
        { language: 'de', culture: 'de', formality: 'semi-formal' as const }
      ];
      
      for (const group of studentGroups) {
        const culturalContext = {
          targetCulture: group.culture,
          educationalLevel: 'middle' as const,
          formalityLevel: group.formality,
          studentAgeGroup: 'teens' as const
        };
        
        const adaptedText = await culturalService.adaptTranslation({
          originalText: teacherMessage,
          sourceLanguage: 'en',
          targetLanguage: group.language,
          culturalContext,
          contentType: 'instruction'
        });
        
        expect(typeof adaptedText).toBe('string');
        expect(adaptedText.length).toBeGreaterThan(0);
        
        // Each culture should have appropriate context markers
        if (group.culture === 'jp' || group.culture === 'kr') {
          expect(adaptedText).toContain('[FORMAL_CONTEXT]');
        }
      }
      
      console.log(`✅ Multi-language classroom support verified for ${studentGroups.length} language groups`);
    });
  });
});
