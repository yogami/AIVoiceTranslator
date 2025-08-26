import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('TranscriptionBusinessService - German original audio prefers Kartoffel with fallback', () => {
  beforeEach(() => {
    process.env.FEATURE_INCLUDE_ORIGINAL_TTS = '1';
  });

  it('uses Kartoffel when available; falls back when it returns empty', async () => {
    // Mock Kartoffel service to return empty buffer first, then ensure fallback path used
    vi.doMock('../../../../server/infrastructure/external-services/tts/KartoffelTTSService', () => ({
      KartoffelTTSService: class {
        async synthesize() { return { audioBuffer: Buffer.alloc(0), ttsServiceType: 'kartoffel' }; }
      }
    }));

    const translateText = vi.fn(async (_t: string, _s: string, _tg: string) => 'x');
    const fallbackBuffer = Buffer.from('mp3data');
    const synthesizeSpeech = vi.fn(async () => ({ audioBuffer: fallbackBuffer, ttsServiceType: 'openai' }));
    const storage: any = { addTranslation: vi.fn() };
    const speechPipelineOrchestrator: any = { translateText, synthesizeSpeech };

    const { TranscriptionBusinessService } = await import('../../../../server/services/transcription/TranscriptionBusinessService');
    const svc = new TranscriptionBusinessService(storage, speechPipelineOrchestrator);

    const sent: any[] = [];
    const studentWs: any = { readyState: 1, send: (msg: string) => sent.push(JSON.parse(msg)) };
    await (svc as any).processTranslationsForStudents({
      text: 'Guten Morgen',
      teacherLanguage: 'de-DE',
      sessionId: 's',
      studentConnections: [studentWs],
      studentLanguages: ['en-US'],
      startTime: Date.now(),
      latencyTracking: { start: Date.now(), components: {} },
      clientProvider: {
        getClientSettings: () => ({}),
        getLanguage: () => 'en-US',
        getSessionId: () => 's',
      }
    });

    const msg = sent.find(m => m.type === 'translation');
    expect(msg).toBeTruthy();
    // Should include original audio via fallback
    expect(msg.originalAudioData).toBeDefined();
    expect(msg.originalTtsServiceType).toBe('openai');
  });
});


