import { describe, it, beforeEach, expect } from 'vitest';
import { AudioMessageHandler } from '../../server/interface-adapters/websocket/websocket-services/AudioMessageHandler';
import type { MessageHandlerContext } from '../../server/interface-adapters/websocket/websocket-services/MessageHandler';
import type { WebSocketClient } from '../../server/interface-adapters/websocket/websocket-services/ConnectionManager';

describe('Baseline - AudioMessageHandler (interim disabled)', () => {
  let handler: AudioMessageHandler;
  let context: MessageHandlerContext;
  let ws: WebSocketClient & { sent: any[] };

  beforeEach(() => {
    delete process.env.FEATURE_SERVER_INTERIM_TRANSCRIPTION;
    ws = {
      sent: [],
      send: function (data: string) { (this as any).sent.push(JSON.parse(data)); }
    } as any;
    context = {
      ws,
      connectionManager: {
        getRole: () => 'teacher',
        getSessionId: () => 's-baseline',
        getLanguage: () => 'en-US'
      } as any,
      storage: {} as any,
      sessionService: {} as any,
      translationService: {} as any,
      sessionLifecycleService: {} as any,
      webSocketServer: {} as any,
      speechPipelineOrchestrator: undefined as any
    };
    handler = new AudioMessageHandler();
  });

  it('ignores non-final chunks when feature is off', async () => {
    const data = Buffer.from('a'.repeat(300)).toString('base64');
    await handler.handle({ type: 'audio', data, isFinalChunk: false } as any, context);
    expect((ws as any).sent.length).toBe(0);
  });
});


