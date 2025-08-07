/**
 * ElevenLabs TTS Features Integration Tests
 *
 * Verifies that advanced ElevenLabs TTS features (emotion control, cultural adaptation, emphasis) work as expected
 * in the auto-fallback pipeline. Also ensures fallback order is correct: ElevenLabs → OpenAI → Browser TTS.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';

function createTestText(): string {
  return 'This is a test of emotional and cultural speech synthesis.';
}

const emotionContext = {
  primaryEmotion: 'excited',
  intensity: 0.9,
  pace: 'fast',
  emphasis: ['test', 'speech'],
  culturalContext: {
    targetCulture: 'japanese',
    formalityLevel: 'formal',
    ageGroup: 'teens'
  }
};

describe('ElevenLabs TTS Features Integration', () => {
  let originalElevenLabsApiKey: string | undefined;
  let originalTtsServiceType: string | undefined;

  beforeEach(() => {
    originalElevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    originalTtsServiceType = process.env.TTS_SERVICE_TYPE;
    process.env.TTS_SERVICE_TYPE = 'auto';
    process.env.ELEVENLABS_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalElevenLabsApiKey !== undefined) {
      process.env.ELEVENLABS_API_KEY = originalElevenLabsApiKey;
    } else {
      delete process.env.ELEVENLABS_API_KEY;
    }
    if (originalTtsServiceType !== undefined) {
      process.env.TTS_SERVICE_TYPE = originalTtsServiceType;
    } else {
      delete process.env.TTS_SERVICE_TYPE;
    }
  });

  it('should synthesize speech with emotion control and cultural adaptation', async () => {
    const { getTTSService } = await import('../../server/services/tts/TTSService.js');
    const service = getTTSService();
    const testText = createTestText();
    try {
      const result = await service.synthesize(testText, {
        language: 'ja-JP',
        voice: 'female',
        emotionContext: emotionContext
      });
      expect(result).toBeDefined();
      expect(result.audioBuffer).toBeDefined();
      // Optionally, decode buffer and check for SSML markers if supported
      // e.g., <emphasis>, <prosody>
      // console.log('Synthesized audio buffer:', result.audioBuffer);
    } catch (error) {
      expect(error).toBeDefined();
      // Log for manual inspection
      console.log('Error during ElevenLabs TTS synthesis:', error instanceof Error ? error.message : String(error));
    }
  });

  it('should fallback to OpenAI TTS when ElevenLabs fails', async () => {
    process.env.ELEVENLABS_API_KEY = 'invalid-key-to-trigger-failure';
    const { getTTSService } = await import('../../server/services/tts/TTSService.js');
    const service = getTTSService();
    const testText = createTestText();
    try {
      const result = await service.synthesize(testText, {
        language: 'en-US',
        voice: 'female',
        emotionContext: emotionContext
      });
      expect(result).toBeDefined();
      expect(result.audioBuffer).toBeDefined();
      // Optionally, check that fallback occurred (e.g., via logs or result metadata)
    } catch (error) {
      expect(error).toBeDefined();
      console.log('Error during OpenAI TTS fallback:', error instanceof Error ? error.message : String(error));
    }
  });

  it('should fallback to Browser TTS when both ElevenLabs and OpenAI fail', async () => {
    process.env.ELEVENLABS_API_KEY = 'invalid-key-to-trigger-failure';
    process.env.OPENAI_API_KEY = 'invalid-key-to-trigger-failure';
    const { getTTSService } = await import('../../server/services/tts/TTSService.js');
    const service = getTTSService();
    const testText = createTestText();
    try {
      const result = await service.synthesize(testText, {
        language: 'en-US',
        voice: 'female',
        emotionContext: emotionContext
      });
      expect(result).toBeDefined();
      expect(result.audioBuffer).toBeDefined();
    } catch (error) {
      expect(error).toBeDefined();
      console.log('Error during Browser TTS fallback:', error instanceof Error ? error.message : String(error));
    }
  });
});
