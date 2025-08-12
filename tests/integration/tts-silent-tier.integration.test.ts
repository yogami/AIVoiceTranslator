import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTTSService } from '../../server/services/tts/TTSService';

describe('TTS silent tier', () => {
  let originalType: string | undefined;

  beforeEach(() => {
    originalType = process.env.TTS_SERVICE_TYPE;
    process.env.TTS_SERVICE_TYPE = 'silent';
  });

  afterEach(() => {
    if (originalType !== undefined) process.env.TTS_SERVICE_TYPE = originalType; else delete process.env.TTS_SERVICE_TYPE;
  });

  it('should return empty audio buffer and type silent', async () => {
    const tts = getTTSService();
    const res = await tts.synthesize('Hello', { language: 'en-US' });
    expect(res.ttsServiceType).toBe('silent');
    expect(res.audioBuffer).toBeInstanceOf(Buffer);
    expect(res.audioBuffer.length).toBe(0);
  });
});


