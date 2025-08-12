import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getSTTTranscriptionService } from '../../server/infrastructure/factories/STTServiceFactory';

function createTestAudioBuffer(): Buffer {
  const wavHeader = Buffer.from([
    0x52, 0x49, 0x46, 0x46,
    0x24, 0x00, 0x00, 0x00,
    0x57, 0x41, 0x56, 0x45,
    0x66, 0x6D, 0x74, 0x20,
    0x10, 0x00, 0x00, 0x00,
    0x01, 0x00, 0x01, 0x00,
    0x44, 0xAC, 0x00, 0x00,
    0x88, 0x58, 0x01, 0x00,
    0x02, 0x00, 0x10, 0x00,
    0x64, 0x61, 0x74, 0x61,
    0x00, 0x00, 0x00, 0x00
  ]);
  const audioData = Buffer.alloc(2000, 0x80);
  return Buffer.concat([wavHeader, audioData]);
}

describe('STT Free Tier Selections', () => {
  let originalSTT: string | undefined;
  let originalOpenAI: string | undefined;
  let originalLabs: string | undefined;

  beforeEach(() => {
    originalSTT = process.env.STT_SERVICE_TYPE;
    originalOpenAI = process.env.OPENAI_API_KEY;
    originalLabs = process.env.ELEVENLABS_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
  });

  afterEach(() => {
    if (originalSTT !== undefined) process.env.STT_SERVICE_TYPE = originalSTT; else delete process.env.STT_SERVICE_TYPE;
    if (originalOpenAI !== undefined) process.env.OPENAI_API_KEY = originalOpenAI; else delete process.env.OPENAI_API_KEY;
    if (originalLabs !== undefined) process.env.ELEVENLABS_API_KEY = originalLabs; else delete process.env.ELEVENLABS_API_KEY;
  });

  it('free-hq (Deepgram) should transcribe without throwing', async () => {
    process.env.STT_SERVICE_TYPE = 'free-hq'; // deepgram
    const stt = getSTTTranscriptionService();
    const result = await stt.transcribe(createTestAudioBuffer(), 'en');
    expect(typeof result).toBe('string');
  }, 20000);

  it('free-enhanced (Enhanced Whisper) should transcribe without throwing', async () => {
    process.env.STT_SERVICE_TYPE = 'free-enhanced'; // enhanced whisper
    const stt = getSTTTranscriptionService();
    const result = await stt.transcribe(createTestAudioBuffer(), 'en');
    expect(typeof result).toBe('string');
  }, 20000);
});


