import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SpeechPipelineOrchestrator } from '../../server/application/services/SpeechPipelineOrchestrator';
import { TranscriptionBusinessService } from '../../server/services/transcription/TranscriptionBusinessService';
import { setupIsolatedTest, cleanupIsolatedTest } from '../utils/test-database-isolation';

interface MockWebSocketClient {
  send: (data: string) => void;
  readyState: number;
  sentMessages: any[];
}

function createMockWebSocketClient(): MockWebSocketClient {
  const mock = {
    send: vi.fn((data: string) => {
      mock.sentMessages.push(JSON.parse(data));
    }),
    readyState: 1,
    sentMessages: [] as any[],
  } as MockWebSocketClient as any;
  return mock;
}

describe.skip('Integration: German teacher original audio prefers Kartoffel with fallback', () => {
  let testId: string;
  let storage: any;
  let speechOrchestrator: SpeechPipelineOrchestrator;
  let transcriptionService: TranscriptionBusinessService;
  let mockStudentWs: MockWebSocketClient;

  beforeEach(async () => {
    process.env.FEATURE_INCLUDE_ORIGINAL_TTS = '1';
    testId = `kartoffel-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    storage = await setupIsolatedTest(testId);
    speechOrchestrator = SpeechPipelineOrchestrator.createWithDefaultServices();
    transcriptionService = new TranscriptionBusinessService(storage, speechOrchestrator);
    mockStudentWs = createMockWebSocketClient();
    // Mock Kartoffel module to ensure it returns audio
    vi.doMock('../../server/infrastructure/external-services/tts/KartoffelTTSService', () => ({
      KartoffelTTSService: class {
        async synthesize() {
          const buf = Buffer.from([0x49, 0x44, 0x33, 0x03]); // ID3 header (mp3)
          return { audioBuffer: buf, ttsServiceType: 'kartoffel' };
        }
      }
    }));
  });

  afterEach(async () => {
    vi.resetModules();
    await cleanupIsolatedTest(testId);
  });

  it('sets originalTtsServiceType to kartoffel and includes originalAudioData', async () => {
    await transcriptionService.processTranscription(
      {
        text: 'Guten Morgen, Klasse',
        teacherLanguage: 'de-DE',
        sessionId: 'sess-1',
        studentConnections: [mockStudentWs as any],
        studentLanguages: ['en-US'],
        startTime: Date.now(),
        latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      },
      {
        getClientSettings: () => ({}),
        getLanguage: () => 'en-US',
        getSessionId: () => 'sess-1',
      },
    );

    const msg = mockStudentWs.sentMessages.find((m) => m.type === 'translation');
    expect(msg).toBeTruthy();
    expect(msg.originalAudioData).toBeDefined();
    expect(msg.originalTtsServiceType).toBe('kartoffel');
  });
});


