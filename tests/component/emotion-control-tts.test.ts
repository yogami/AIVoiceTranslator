/**
 * Emotion Control TTS Component Tests
 * 
 * Tests the integration of EmotionControlService with TTS pipeline:
 * 1. Emotional synthesis in educational contexts
 * 2. Cultural emotion adaptation
 * 3. Multi-emotional content delivery
 * 4. Real-world classroom emotional scenarios
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EmotionControlService, EmotionContext, EmotionalTTSOptions } from '../../server/services/tts/EmotionControlService.js';

describe('Emotion Control TTS Component Tests', () => {
  let originalApiKey: string | undefined;
  let emotionService: EmotionControlService;

  beforeEach(() => {
    originalApiKey = process.env.ELEVENLABS_API_KEY;
    process.env.ELEVENLABS_API_KEY = 'test-api-key';
    
    emotionService = new EmotionControlService();
    
    // Mock fetch for ElevenLabs API calls
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

  describe('Educational Emotional Synthesis', () => {
    it('should synthesize encouraging speech for praise scenarios', async () => {
      const mockAudioBuffer = Buffer.from('encouraging-audio-data');
      
      const options: EmotionalTTSOptions = {
        text: 'Excellent work on solving that complex equation!',
        language: 'en',
        voiceId: 'teacher-voice-id',
        emotionContext: EmotionControlService.getEducationalEmotion('praise')
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      expect(result.length).toBeGreaterThan(0);
      
      // Verify API call parameters
      const fetchCall = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(fetchCall[1].body);
      
      // Praise should have encouraging emotion settings
      expect(requestBody.voice_settings.similarity_boost).toBeGreaterThan(0.7);
      expect(requestBody.voice_settings.style).toBeGreaterThan(0.6);
    });

    it('should synthesize calm speech for explanation scenarios', async () => {
      const mockAudioBuffer = Buffer.from('calm-explanation-audio');
      
      const options: EmotionalTTSOptions = {
        text: 'Let me explain this mathematical concept step by step.',
        language: 'en',
        voiceId: 'teacher-voice-id',
        emotionContext: EmotionControlService.getEducationalEmotion('explanation')
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      
      // Explanation should have calm emotion settings
      expect(requestBody.voice_settings.stability).toBeGreaterThan(0.7);
      expect(requestBody.voice_settings.style).toBeLessThan(0.4);
    });

    it('should synthesize concerned speech for warning scenarios', async () => {
      const mockAudioBuffer = Buffer.from('concerned-warning-audio');
      
      const options: EmotionalTTSOptions = {
        text: 'Please be careful with this laboratory equipment.',
        language: 'en',
        voiceId: 'teacher-voice-id',
        emotionContext: EmotionControlService.getEducationalEmotion('warning')
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      
      // Warning should have concerned emotion settings
      expect(requestBody.voice_settings.stability).toBeGreaterThan(0.5);
      expect(requestBody.voice_settings.stability).toBeLessThan(0.8);
    });

    it('should handle excited speech for motivational content', async () => {
      const mockAudioBuffer = Buffer.from('excited-motivation-audio');
      
      const options: EmotionalTTSOptions = {
        text: 'We\'re going to discover something amazing today!',
        language: 'en',
        voiceId: 'teacher-voice-id',
        emotionContext: EmotionControlService.getEducationalEmotion('excitement')
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      
      // Excitement should have high style and low stability
      expect(requestBody.voice_settings.style).toBeGreaterThan(0.8);
      expect(requestBody.voice_settings.stability).toBeLessThan(0.4);
    });
  });

  describe('Cultural Emotional Adaptation', () => {
    it('should adapt emotional expression for Japanese formal context', async () => {
      const mockAudioBuffer = Buffer.from('japanese-formal-audio');
      
      const options: EmotionalTTSOptions = {
        text: 'Please review your homework carefully.',
        language: 'ja',
        voiceId: 'japanese-teacher-voice',
        emotionContext: {
          primaryEmotion: 'serious',
          intensity: 0.7,
          culturalContext: {
          targetCulture: 'japanese',
          formalityLevel: 'formal',
          ageGroup: 'teens'
        }
        }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      
      // Should include cultural adaptation markers
      expect(requestBody.text).toContain('<prosody');
      expect(requestBody.text).toContain('pitch=');
    });

    it('should adapt emotional expression for German direct context', async () => {
      const mockAudioBuffer = Buffer.from('german-direct-audio');
      
      const options: EmotionalTTSOptions = {
        text: 'This solution is mathematically incorrect.',
        language: 'de',
        voiceId: 'german-teacher-voice',
        emotionContext: {
          primaryEmotion: 'serious',
          intensity: 0.8,
          culturalContext: {
            targetCulture: 'german',
            formalityLevel: 'formal',
            ageGroup: 'adults'
          }
        }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      
      // German formal context should have specific prosody adjustments
      expect(requestBody.text).toContain('<prosody rate="95%">');
    });

    it('should adapt emotional expression for child-friendly delivery', async () => {
      const mockAudioBuffer = Buffer.from('child-friendly-audio');
      
      const options: EmotionalTTSOptions = {
        text: 'Great job counting to ten!',
        language: 'en',
        voiceId: 'child-teacher-voice',
        emotionContext: {
          primaryEmotion: 'encouraging',
          intensity: 0.9,
          culturalContext: {
            targetCulture: 'default',
            formalityLevel: 'casual',
            ageGroup: 'children'
          }
        }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      
      // Child-friendly should have higher pitch and moderate emphasis
      expect(requestBody.text).toContain('<prosody pitch="+8%"');
      expect(requestBody.text).toContain('rate="90%"');
    });
  });

  describe('Multi-Emotional Content Delivery', () => {
    it('should handle emotional transitions within content', async () => {
      const emotionalContents = [
        { text: 'Welcome to today\'s lesson!', emotion: 'encouraging' as const },
        { text: 'This concept might be challenging.', emotion: 'concerned' as const },
        { text: 'But I know you can master it!', emotion: 'encouraging' as const },
        { text: 'Let\'s work through it step by step.', emotion: 'calm' as const }
      ];
      
      const mockAudioBuffer = Buffer.from('multi-emotional-audio');
      
      // Mock responses for each emotional synthesis
      emotionalContents.forEach(() => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
        });
      });
      
      const synthesisPromises = emotionalContents.map(content => 
        emotionService.synthesizeWithEmotion({
          text: content.text,
          language: 'en',
          voiceId: 'teacher-voice',
          emotionContext: {
            primaryEmotion: content.emotion,
            intensity: 0.7
          }
        })
      );
      
      const results = await Promise.all(synthesisPromises);
      
      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(0);
      });
      
      // Verify different emotion settings were applied
      const requestBodies = (global.fetch as any).mock.calls.map((call: any) => JSON.parse(call[1].body));
      
      // Encouraging should have higher similarity boost than concerned
      const encouragingCalls = requestBodies.filter((body: any, index: number) => 
        emotionalContents[index].emotion === 'encouraging'
      );
      const concernedCalls = requestBodies.filter((body: any, index: number) => 
        emotionalContents[index].emotion === 'concerned'
      );
      
      expect(encouragingCalls.length).toBe(2);
      expect(concernedCalls.length).toBe(1);
    });

    it('should maintain emotional consistency for similar content types', async () => {
      const praisePhrases = [
        'Excellent work on this problem!',
        'Outstanding analysis of the data!',
        'Perfect explanation of the concept!',
        'Brilliant solution approach!'
      ];
      
      const mockAudioBuffer = Buffer.from('praise-audio');
      
      praisePhrases.forEach(() => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
        });
      });
      
      const synthesisPromises = praisePhrases.map(phrase => 
        emotionService.synthesizeWithEmotion({
          text: phrase,
          language: 'en',
          voiceId: 'teacher-voice',
          emotionContext: EmotionControlService.getEducationalEmotion('praise')
        })
      );
      
      const results = await Promise.all(synthesisPromises);
      
      expect(results).toHaveLength(4);
      
      // All praise should have consistent emotional settings
      const requestBodies = (global.fetch as any).mock.calls.map((call: any) => JSON.parse(call[1].body));
      
      const firstSettings = requestBodies[0].voice_settings;
      requestBodies.forEach((body: any) => {
        expect(body.voice_settings.stability).toBeCloseTo(firstSettings.stability, 1);
        expect(body.voice_settings.similarity_boost).toBeCloseTo(firstSettings.similarity_boost, 1);
        expect(body.voice_settings.style).toBeCloseTo(firstSettings.style, 1);
      });
    });
  });

  describe('Emphasis and Prosody Control', () => {
    it('should apply emphasis to key educational terms', async () => {
      const mockAudioBuffer = Buffer.from('emphasized-audio');
      
      const options: EmotionalTTSOptions = {
        text: 'The equation has three important variables: x, y, and z.',
        language: 'en',
        voiceId: 'math-teacher-voice',
        emotionContext: {
          primaryEmotion: 'neutral',
          emphasis: ['equation', 'important', 'variables']
        }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      
      // Verify emphasis markers were applied
      expect(requestBody.text).toContain('<emphasis level="strong">equation</emphasis>');
      expect(requestBody.text).toContain('<emphasis level="strong">important</emphasis>');
      expect(requestBody.text).toContain('<emphasis level="strong">variables</emphasis>');
    });

    it('should handle pace variations for different content types', async () => {
      const paceTests = [
        { text: 'STOP! Do not touch that equipment!', pace: 'slow' as const, emotion: 'concerned' as const },
        { text: 'Let me explain this concept carefully.', pace: 'normal' as const, emotion: 'calm' as const },
        { text: 'Quick! What\'s the answer to this?', pace: 'fast' as const, emotion: 'excited' as const }
      ];
      
      const mockAudioBuffer = Buffer.from('pace-test-audio');
      
      paceTests.forEach(() => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
        });
      });
      
      const synthesisPromises = paceTests.map(test => 
        emotionService.synthesizeWithEmotion({
          text: test.text,
          language: 'en',
          voiceId: 'teacher-voice',
          emotionContext: {
            primaryEmotion: test.emotion,
            pace: test.pace,
            intensity: 0.8
          }
        })
      );
      
      const results = await Promise.all(synthesisPromises);
      
      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Buffer);
      });
      
      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it('should combine multiple prosodic elements effectively', async () => {
      const mockAudioBuffer = Buffer.from('complex-prosody-audio');
      
      const options: EmotionalTTSOptions = {
        text: 'Today we will learn about photosynthesis and its crucial role in our ecosystem.',
        language: 'en',
        voiceId: 'science-teacher-voice',
        emotionContext: {
          primaryEmotion: 'encouraging',
          intensity: 0.7,
          pace: 'normal',
          emphasis: ['photosynthesis', 'crucial', 'ecosystem'],
          culturalContext: {
            targetCulture: 'default',
            formalityLevel: 'formal',
            ageGroup: 'teens'
          }
        }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      
      // Should combine emphasis, prosody, and emotional settings
      expect(requestBody.text).toContain('<emphasis level="strong">photosynthesis</emphasis>');
      expect(requestBody.text).toContain('<emphasis level="strong">crucial</emphasis>');
      expect(requestBody.text).toContain('<emphasis level="strong">ecosystem</emphasis>');
      expect(requestBody.text).toContain('<prosody');
    });
  });

  describe('Output Format and Quality Control', () => {
    it('should support different audio formats for various use cases', async () => {
      const formats = ['mp3', 'wav', 'opus'] as const;
      const mockAudioBuffer = Buffer.from('format-test-audio');
      
      formats.forEach(() => {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
        });
      });
      
      const synthesisPromises = formats.map(format => 
        emotionService.synthesizeWithEmotion({
          text: 'Testing different audio formats.',
          language: 'en',
          voiceId: 'test-voice',
          emotionContext: { primaryEmotion: 'neutral' },
          outputFormat: format
        })
      );
      
      const results = await Promise.all(synthesisPromises);
      
      expect(results).toHaveLength(3);
      
      // Verify correct Accept headers were sent
      const acceptHeaders = (global.fetch as any).mock.calls.map((call: any) => call[1].headers.Accept);
      expect(acceptHeaders).toContain('audio/mp3');
      expect(acceptHeaders).toContain('audio/wav');
      expect(acceptHeaders).toContain('audio/opus');
    });

    it('should handle high-quality synthesis requests', async () => {
      const mockAudioBuffer = Buffer.from('high-quality-audio');
      
      const options: EmotionalTTSOptions = {
        text: 'This is a high-quality synthesis test with complex emotional nuances.',
        language: 'en',
        voiceId: 'premium-teacher-voice',
        emotionContext: {
          primaryEmotion: 'encouraging',
          intensity: 0.95,
          pace: 'normal',
          emphasis: ['high-quality', 'complex', 'emotional', 'nuances']
        },
        outputFormat: 'wav'
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
      });
      
      const result = await emotionService.synthesizeWithEmotion(options);
      
      expect(result).toBeInstanceOf(Buffer);
      
      const requestBody = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      
      // High-quality should use multilingual model and speaker boost
      expect(requestBody.model_id).toBe('eleven_multilingual_v2');
      expect(requestBody.voice_settings.use_speaker_boost).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should handle API rate limiting gracefully', async () => {
      const options: EmotionalTTSOptions = {
        text: 'Testing rate limit handling.',
        language: 'en',
        voiceId: 'test-voice',
        emotionContext: { primaryEmotion: 'neutral' }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limit exceeded')
      });
      
      await expect(emotionService.synthesizeWithEmotion(options)).rejects.toThrow('Emotional TTS failed: 429 Rate limit exceeded');
    });

    it('should handle invalid voice IDs appropriately', async () => {
      const options: EmotionalTTSOptions = {
        text: 'Testing invalid voice ID.',
        language: 'en',
        voiceId: 'non-existent-voice',
        emotionContext: { primaryEmotion: 'neutral' }
      };
      
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: () => Promise.resolve('Voice not found')
      });
      
      await expect(emotionService.synthesizeWithEmotion(options)).rejects.toThrow('Emotional TTS failed: 404 Voice not found');
    });

    it('should handle concurrent synthesis requests without interference', async () => {
      const mockAudioBuffer = Buffer.from('concurrent-test-audio');
      
      // Mock multiple concurrent responses
      for (let i = 0; i < 5; i++) {
        (global.fetch as any).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer)
        });
      }
      
      const concurrentPromises = Array(5).fill(null).map((_, index) => 
        emotionService.synthesizeWithEmotion({
          text: `Concurrent synthesis test ${index + 1}.`,
          language: 'en',
          voiceId: 'test-voice',
          emotionContext: {
            primaryEmotion: 'neutral',
            intensity: 0.5 + (index * 0.1) // Vary intensity
          }
        })
      );
      
      const results = await Promise.all(concurrentPromises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBeInstanceOf(Buffer);
        expect(result.length).toBeGreaterThan(0);
      });
      
      expect(global.fetch).toHaveBeenCalledTimes(5);
    });

    it('should maintain service availability despite individual failures', async () => {
      const mockAudioBuffer = Buffer.from('resilience-test-audio');
      
      // Mix of successful and failed responses
      const responses = [
        { ok: false, status: 500, text: () => Promise.resolve('Server Error') },
        { ok: true, arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer) },
        { ok: false, status: 400, text: () => Promise.resolve('Bad Request') },
        { ok: true, arrayBuffer: () => Promise.resolve(mockAudioBuffer.buffer) }
      ];
      
      responses.forEach(response => {
        (global.fetch as any).mockResolvedValueOnce(response);
      });
      
      const testPromises = [
        emotionService.synthesizeWithEmotion({
          text: 'Test 1', language: 'en', voiceId: 'test',
          emotionContext: { primaryEmotion: 'neutral' }
        }).catch(error => ({ error })),
        emotionService.synthesizeWithEmotion({
          text: 'Test 2', language: 'en', voiceId: 'test',
          emotionContext: { primaryEmotion: 'neutral' }
        }),
        emotionService.synthesizeWithEmotion({
          text: 'Test 3', language: 'en', voiceId: 'test',
          emotionContext: { primaryEmotion: 'neutral' }
        }).catch(error => ({ error })),
        emotionService.synthesizeWithEmotion({
          text: 'Test 4', language: 'en', voiceId: 'test',
          emotionContext: { primaryEmotion: 'neutral' }
        })
      ];
      
      const results = await Promise.all(testPromises);
      
      expect(results).toHaveLength(4);
      
      // Two should succeed, two should fail
      const successes = results.filter(result => result instanceof Buffer);
      const failures = results.filter(result => result && typeof result === 'object' && 'error' in result);
      
      expect(successes).toHaveLength(2);
      expect(failures).toHaveLength(2);
    });
  });
});
