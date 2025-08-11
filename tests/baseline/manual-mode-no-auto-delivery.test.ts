import { describe, it, expect, beforeEach } from 'vitest';
import { TranscriptionMessageHandler } from '../../server/interface-adapters/websocket/websocket-services/TranscriptionMessageHandler';

describe('Baseline - Manual Mode gating (server)', () => {
  beforeEach(() => {
    process.env.FEATURE_MANUAL_TRANSLATION_CONTROL = '1';
  });

  it('ignores automatic transcription delivery in manual mode', async () => {
    const handler = new TranscriptionMessageHandler();
    const ws: any = { sent: [], send: function (d: string){ this.sent.push(JSON.parse(d)); } };
    const context: any = {
      ws,
      connectionManager: {
        getRole: () => 'teacher',
        getSessionId: () => 's1',
        getLanguage: () => 'en-US',
        getStudentConnectionsAndLanguagesForSession: () => ({ connections: [], languages: [] }),
        getClientSettings: () => ({ translationMode: 'manual' }),
      },
      storage: {},
      speechPipelineOrchestrator: {}
    };
    await handler.handle({ type: 'transcription', text: 'hello' } as any, context);
    expect(ws.sent.length).toBe(0);
  });
});


