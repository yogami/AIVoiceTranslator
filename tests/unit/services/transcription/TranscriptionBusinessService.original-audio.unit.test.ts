import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('TranscriptionBusinessService (Original Source Audio FF)', () => {
  beforeEach(() => {
    // Enable feature flag for this test run
    process.env.FEATURE_ORIGINAL_SOURCE_AUDIO = '1';
  });

  it('includes originalAudioData and originalAudioFormat when feature flag is enabled', async () => {
    // Arrange mocks
    const fakeBuffer = Buffer.from('test-audio');
    const synthesizeSpeech = vi.fn(async (text: string, lang: string) => ({
      audioBuffer: fakeBuffer,
      ttsServiceType: 'elevenlabs',
    }));
    const translateText = vi.fn(async () => 'translated-text');
    const speechPipelineOrchestrator: any = { synthesizeSpeech, translateText };
    const storage: any = { addTranslation: vi.fn() };

    // Late import the service to ensure env is picked up where dynamic import('../../config') occurs
    const { TranscriptionBusinessService } = await import(
      '../../../../server/services/transcription/TranscriptionBusinessService'
    );

    const service = new TranscriptionBusinessService(storage, speechPipelineOrchestrator);

    // Mock student connection (WebSocket)
    const sent: any[] = [];
    const studentWs: any = {
      readyState: 1,
      send: (msg: string) => sent.push(JSON.parse(msg)),
    };

    const clientProvider = {
      getClientSettings: (_ws: any) => ({}),
      getLanguage: (_ws: any) => 'es-ES',
      getSessionId: (_ws: any) => 'sess',
    };

    // Act
    await (service as any).processTranslationsForStudents({
      text: 'hello teacher',
      teacherLanguage: 'en-US',
      sessionId: 'sess',
      studentConnections: [studentWs],
      studentLanguages: ['es-ES'],
      startTime: Date.now(),
      latencyTracking: { start: Date.now(), components: {} },
      clientProvider,
    });

    // Assert
    expect(synthesizeSpeech).toHaveBeenCalled();
    const msg = sent.find((m) => m?.type === 'translation');
    expect(msg).toBeTruthy();
    expect(msg.originalAudioData).toBeDefined();
    expect(typeof msg.originalAudioData).toBe('string');
    expect(msg.originalAudioFormat).toBeDefined();
  });
});


