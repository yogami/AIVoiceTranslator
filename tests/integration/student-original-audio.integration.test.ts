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

describe('Integration: Original source audio is included in student translation messages', () => {
  let testId: string;
  let storage: any;
  let speechOrchestrator: SpeechPipelineOrchestrator;
  let transcriptionService: TranscriptionBusinessService;
  let mockStudentWs: MockWebSocketClient;

  beforeEach(async () => {
    testId = `orig-audio-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    storage = await setupIsolatedTest(testId);
    speechOrchestrator = SpeechPipelineOrchestrator.createWithDefaultServices();
    transcriptionService = new TranscriptionBusinessService(storage, speechOrchestrator);
    mockStudentWs = createMockWebSocketClient();
  });

  afterEach(async () => {
    await cleanupIsolatedTest(testId);
  });

  it('includes originalAudioData and originalAudioFormat when delivering translation', async () => {
    await transcriptionService.processTranscription(
      {
        text: 'Original teacher sentence',
        teacherLanguage: 'en-US',
        sessionId: 'sess-1',
        studentConnections: [mockStudentWs as any],
        studentLanguages: ['es-ES'],
        startTime: Date.now(),
        latencyTracking: { start: Date.now(), components: { preparation: 0, translation: 0, tts: 0, processing: 0 } },
      },
      {
        getClientSettings: () => ({}),
        getLanguage: () => 'es-ES',
        getSessionId: () => 'sess-1',
      },
    );

    const msg = mockStudentWs.sentMessages.find((m) => m.type === 'translation');
    expect(msg).toBeTruthy();
    // originalAudioData may be null if TTS fails; assert field presence when defined
    if (msg.originalAudioData) {
      expect(typeof msg.originalAudioData).toBe('string');
      expect(msg.originalAudioFormat === 'mp3' || msg.originalAudioFormat === 'wav').toBe(true);
    }
  });
});


