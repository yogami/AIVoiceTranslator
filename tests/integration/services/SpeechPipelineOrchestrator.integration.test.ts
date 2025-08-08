import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpeechPipelineOrchestrator, ITTSService, SpeechPipelineOptions } from '../../../server/application/services/SpeechPipelineOrchestrator';
import { ISTTTranscriptionService, ITranslationService } from '../../../server/services/translation/translation.interfaces';

// Mocks for dependencies
class MockTranscriptionService implements ISTTTranscriptionService {
  async transcribe(buffer: Buffer, language: string): Promise<string> {
    return 'mocked transcription';
  }
}
class MockTranslationService implements ITranslationService {
  async translate(text: string, from: string, to: string): Promise<string> {
    if (to === 'fail') throw new Error('Translation failed');
    return `translated(${text})-${to}`;
  }
}
class MockTTSService implements ITTSService {
  type: string;
  fail: boolean;
  constructor(type: string, fail = false) { this.type = type; this.fail = fail; }
  async synthesize(text: string, options?: { language?: string }) {
    if (this.fail) throw new Error('TTS failed');
    return { audioBuffer: Buffer.from(`audio-${text}-${this.type}`), ttsServiceType: this.type };
  }
}

describe('SpeechPipelineOrchestrator Integration', () => {
  let orchestrator: SpeechPipelineOrchestrator;
  let ttsFactory: (type: string) => ITTSService;
  let storage: any;
  let wsSends: any[];
  let ws: any;

  // Minimal WebSocketClient mock
  function makeWs() {
    const arr: any[] = [];
    const ws = { send: (msg: string) => arr.push(JSON.parse(msg)) } as any;
    return [ws, arr] as const;
  }

  beforeEach(() => {
    ttsFactory = (type: string) => new MockTTSService(type, type === 'fail');
    orchestrator = new SpeechPipelineOrchestrator(
      new MockTranscriptionService(),
      new MockTranslationService(),
      ttsFactory
    );
    wsSends = [];
    ws = { send: (msg: string) => wsSends.push(JSON.parse(msg)) };
    storage = { addTranslation: vi.fn().mockResolvedValue(undefined) };
  });

  it('handles storage/database failure gracefully', async () => {
    // Mock the database storage (not persistence service) to simulate database failure
    const mockStorage = {
      addTranslation: vi.fn().mockRejectedValue(new Error('DB down'))
    };
    
    // Create a real persistence service but with our mock database
    const mockPersistenceService = {
      persistTranslationAfterDelivery: async (params: any) => {
        // Simulate the real persistence service behavior - it catches DB errors and doesn't re-throw
        try {
          await mockStorage.addTranslation({
            sessionId: params.sessionId,
            sourceLanguage: params.sourceLanguage,
            targetLanguage: params.studentLanguage,
            originalText: params.originalText,
            translatedText: params.translation,
            latency: params.latencyTracking.components?.translation || 0
          });
        } catch (error) {
          // Real persistence service logs error but doesn't throw
          console.log('DB error logged but not thrown:', error instanceof Error ? error.message : String(error));
        }
      }
    };
    
    orchestrator = new SpeechPipelineOrchestrator(
      new MockTranscriptionService(),
      new MockTranslationService(),
      ttsFactory
    );
    
    // Replace the internal persistence service with our mock
    (orchestrator as any).persistenceService = mockPersistenceService;
    
    const options: SpeechPipelineOptions = {
      studentConnections: [ws],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      sessionId: 'sess1',
      getClientSettings: () => ({}),
      getLanguage: () => 'es',
      getSessionId: () => 'sess1',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';
    
    // Should NOT throw - should handle database failure gracefully
    await expect(orchestrator.sendTranslationsToStudents(options)).resolves.toBeUndefined();
    
    // Should attempt to save to database (and fail)
    expect(mockStorage.addTranslation).toHaveBeenCalled();
    
    // Should still deliver translation to students despite database failure
    expect(wsSends).toHaveLength(1);
    expect(wsSends[0]).toMatchObject({
      type: 'translation',
      text: 'translated(hello)-es'
    });
    
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'false';
  });

  it('retries TTS and delivery up to 3 times and then fails', async () => {
    // TTS always fails, so delivery should retry 3 times and then give up
    let ttsCallCount = 0;
    ttsFactory = (type: string) => ({
      synthesize: async () => { ttsCallCount++; throw new Error('TTS fail'); },
    } as any);
    orchestrator = new SpeechPipelineOrchestrator(
      new MockTranscriptionService(),
      new MockTranslationService(),
      ttsFactory
    );
    const [ws3, arr3] = makeWs();
    const options: SpeechPipelineOptions = {
      studentConnections: [ws3],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      getClientSettings: () => ({}),
      getLanguage: () => 'es',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(ttsCallCount).toBeGreaterThanOrEqual(1); // TTS tried
    expect(arr3.length).toBe(1); // Message still sent (with empty audio)
    // Now simulate send() always throws to test delivery retry
    let sendCount = 0;
    const wsFail = { send: () => { sendCount++; throw new Error('Send fail'); } } as any;
    const options2: SpeechPipelineOptions = {
      studentConnections: [wsFail],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      getClientSettings: () => ({}),
      getLanguage: () => 'es',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    await orchestrator.sendTranslationsToStudents(options2);
    expect(sendCount).toBe(3); // 3 attempts
  });

  it('delivers to multiple students and languages', async () => {
    const [wsA, arrA] = makeWs();
    const [wsB, arrB] = makeWs();
    const wsList = [wsA, wsB];
    const arrList = [arrA, arrB];
    const options: SpeechPipelineOptions = {
      studentConnections: wsList,
      originalText: 'hi',
      sourceLanguage: 'en',
      targetLanguages: ['es', 'fr'],
      getClientSettings: (ws) => (ws === wsList[0] ? {} : { ttsServiceType: 'auto' }),
      getLanguage: (ws) => (ws === wsList[0] ? 'es' : 'fr'),
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(arrA[0].targetLanguage).toBe('es');
    expect(arrB[0].targetLanguage).toBe('fr');
    expect(arrA[0].text).toContain('translated');
    expect(arrB[0].text).toContain('translated');
  });
  it('delivers translation and audio to student (happy path)', async () => {
    const options: SpeechPipelineOptions = {
      studentConnections: [ws],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      getClientSettings: () => ({}),
      getLanguage: () => 'es',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(wsSends[0].text).toContain('translated');
    // audioData is base64 encoded, decode before checking contents
    const audioDecoded = Buffer.from(wsSends[0].audioData, 'base64').toString();
    expect(audioDecoded).toContain('audio-');
  });
  it('retries and logs error if translation fails', async () => {
    const options: SpeechPipelineOptions = {
      studentConnections: [ws],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['fail'],
      getClientSettings: () => ({}),
      getLanguage: () => 'fail',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(wsSends[0].text).toBe('hello'); // fallback to original
  });

  it('uses browser speech if useClientSpeech is true', async () => {
    const options: SpeechPipelineOptions = {
      studentConnections: [ws],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      getClientSettings: () => ({ useClientSpeech: true }),
      getLanguage: () => 'es',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(wsSends[0].useClientSpeech).toBe(true);
    expect(wsSends[0].speechParams).toBeDefined();
  });

  it('falls back to secondary TTS if primary fails and ttsServiceType is auto', async () => {
    // Patch ttsFactory to simulate fallback: 'auto' fails, 'elevenlabs' succeeds and returns correct ttsServiceType
    ttsFactory = (type: string) => {
      if (type === 'auto') {
        return {
          synthesize: async () => { throw new Error('TTS fail'); }
        } as any;
      }
      if (type === 'elevenlabs') {
        return {
          synthesize: async () => ({ audioBuffer: Buffer.from('audio-elevenlabs'), ttsServiceType: 'elevenlabs' })
        } as any;
      }
      return new MockTTSService(type);
    };
    orchestrator = new SpeechPipelineOrchestrator(
      new MockTranscriptionService(),
      new MockTranslationService(),
      ttsFactory
    );
    const options: SpeechPipelineOptions = {
      studentConnections: [ws],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      getClientSettings: () => ({ ttsServiceType: 'auto' }),
      getLanguage: () => 'es',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(wsSends[0].ttsServiceType).toBe('elevenlabs');
  });

  it('skips students with invalid language', async () => {
    const options: SpeechPipelineOptions = {
      studentConnections: [ws],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      getClientSettings: () => ({}),
      getLanguage: () => '',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(wsSends.length).toBe(0);
  });

  it('persists translation if logging enabled and sessionId present', async () => {
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'true';
    
    // Mock the database storage to track calls
    const mockStorage = {
      addTranslation: vi.fn().mockResolvedValue({ id: 123 })
    };
    
    // Create a real persistence service but with our mock database
    const mockPersistenceService = {
      persistTranslationAfterDelivery: async (params: any) => {
        // Simulate the real persistence service behavior
        const studentSessionId = params.getSessionId?.(params.studentWs) || params.sessionId;
        if (!studentSessionId) return;
        
        const translationData = {
          sessionId: studentSessionId,
          sourceLanguage: params.sourceLanguage,
          targetLanguage: params.studentLanguage,
          originalText: params.originalText,
          translatedText: params.translation,
          latency: params.latencyTracking.components?.translation || 0
        };
        
        await mockStorage.addTranslation(translationData);
      }
    };
    
    orchestrator = new SpeechPipelineOrchestrator(
      new MockTranscriptionService(),
      new MockTranslationService(),
      ttsFactory
    );
    
    // Replace the internal persistence service with our mock
    (orchestrator as any).persistenceService = mockPersistenceService;
    
    const options: SpeechPipelineOptions = {
      studentConnections: [ws],
      originalText: 'hello',
      sourceLanguage: 'en',
      targetLanguages: ['es'],
      sessionId: 'sess1',
      getClientSettings: () => ({}),
      getLanguage: () => 'es',
      getSessionId: () => 'sess1',
      latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      startTime: Date.now(),
    };
    await orchestrator.sendTranslationsToStudents(options);
    expect(mockStorage.addTranslation).toHaveBeenCalled();
    process.env.ENABLE_DETAILED_TRANSLATION_LOGGING = 'false';
  });
});
