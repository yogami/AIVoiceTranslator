import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the business service used by the handler so we can assert it's called
vi.mock('../../server/services/transcription/TranscriptionBusinessService', async (orig) => {
  const mod = await orig();
  return {
    ...mod,
    TranscriptionBusinessService: class {
      constructor() {}
      processTranscription = vi.fn(async () => {});
      validateTranscriptionSource() { return { valid: true }; }
    }
  };
});

// Import after mock
import { TranscriptionMessageHandler } from '../../server/interface-adapters/websocket/websocket-services/TranscriptionMessageHandler';
import { TranscriptionBusinessService } from '../../server/services/transcription/TranscriptionBusinessService';

describe('Baseline - Auto mode delivers (manual mode off)', () => {
  beforeEach(() => {
    // Feature flag can be on; behavior should still deliver in auto mode
    process.env.FEATURE_MANUAL_TRANSLATION_CONTROL = '1';
    vi.clearAllMocks();
  });

  it('calls business service when teacher is not in manual mode', async () => {
    const handler = new TranscriptionMessageHandler();
    const ws: any = { sent: [], send: function (d: string){ this.sent.push(JSON.parse(d)); } };
    const mockStudent: any = { readyState: 1, send: vi.fn() };
    const context: any = {
      ws,
      connectionManager: {
        getRole: () => 'teacher',
        getSessionId: () => 's-auto',
        getLanguage: () => 'en-US',
        getStudentConnectionsAndLanguagesForSession: () => ({ connections: [mockStudent], languages: ['es-ES'] }),
        getClientSettings: () => ({ /* translationMode undefined -> auto */ }),
      },
      storage: {},
      speechPipelineOrchestrator: { /* not used because we mock business service */ }
    };

    // Spy on the mocked class method
    const svcProto = (TranscriptionBusinessService as unknown as any).prototype;
    const spy = vi.spyOn(svcProto, 'processTranscription');

    await handler.handle({ type: 'transcription', text: 'hello auto flow' } as any, context);

    expect(spy).toHaveBeenCalledTimes(1);
  });
});


