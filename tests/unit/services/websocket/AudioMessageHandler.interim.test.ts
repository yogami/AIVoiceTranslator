import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { AudioMessageHandler } from '../../../../server/interface-adapters/websocket/websocket-services/AudioMessageHandler';
import type { MessageHandlerContext } from '../../../../server/interface-adapters/websocket/websocket-services/MessageHandler';
import type { WebSocketClient } from '../../../../server/interface-adapters/websocket/websocket-services/ConnectionManager';

describe('AudioMessageHandler - interim transcription (feature-flagged)', () => {
  const OLD_ENV = process.env;
  let handler: AudioMessageHandler;
  let mockWs: WebSocketClient & { sent: any[] };
  let context: MessageHandlerContext;

  beforeEach(() => {
    vi.useFakeTimers();
    process.env = { ...OLD_ENV };
    handler = new AudioMessageHandler();
    mockWs = {
      sent: [],
      send: vi.fn(function (this: any, data: string) {
        (this as any).sent.push(JSON.parse(data));
      })
    } as any;
    context = {
      ws: mockWs,
      connectionManager: {
        getRole: vi.fn(() => 'teacher'),
        getSessionId: vi.fn(() => 's1'),
        getLanguage: vi.fn(() => 'en-US')
      } as any,
      storage: {} as any,
      sessionService: {} as any,
      translationService: {} as any,
      sessionLifecycleService: {} as any,
      webSocketServer: {} as any,
      speechPipelineOrchestrator: {
        transcribeAudio: vi.fn(async () => 'hello interim')
      } as any
    };
  });

  afterEach(() => {
    process.env = OLD_ENV;
    vi.useRealTimers();
  });

  it('does not emit interim when feature is disabled', async () => {
    delete process.env.FEATURE_SERVER_INTERIM_TRANSCRIPTION;
    const data = Buffer.from('a'.repeat(300)).toString('base64');
    await handler.handle({ type: 'audio', data, isFinalChunk: false } as any, context);
    expect((mockWs as any).sent.length).toBe(0);
  });

  it('emits throttled teacher-only interim when feature is enabled', async () => {
    process.env.FEATURE_SERVER_INTERIM_TRANSCRIPTION = '1';
    process.env.FEATURE_INTERIM_THROTTLE_MS = '400';
    const data = Buffer.from('a'.repeat(300)).toString('base64');

    await handler.handle({ type: 'audio', data, isFinalChunk: false } as any, context);
    expect((mockWs as any).sent[0]).toMatchObject({ type: 'transcription', isFinal: false, text: 'hello interim' });

    // Within throttle window → ignored
    await handler.handle({ type: 'audio', data, isFinalChunk: false } as any, context);
    expect((mockWs as any).sent.length).toBe(1);

    // Advance timers beyond throttle and try again
    vi.setSystemTime(Date.now() + 500);
    await handler.handle({ type: 'audio', data, isFinalChunk: false } as any, context);
    expect((mockWs as any).sent.length).toBe(2);
  });
});


