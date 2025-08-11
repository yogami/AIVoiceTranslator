import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ManualSendTranslationHandler } from '../../../../server/interface-adapters/websocket/websocket-services/ManualSendTranslationHandler';

describe('ManualSendTranslationHandler (unit)', () => {
  const handler = new ManualSendTranslationHandler();
  let context: any;

  beforeEach(() => {
    process.env.FEATURE_MANUAL_TRANSLATION_CONTROL = '1';
    context = {
      connectionManager: {
        getRole: vi.fn(() => 'teacher'),
        getSessionId: vi.fn(() => 'session-xyz'),
        getLanguage: vi.fn(() => 'en-US'),
        getStudentConnectionsAndLanguagesForSession: vi.fn(() => ({
          connections: [{ readyState: 1, send: vi.fn() }],
          languages: ['es-ES']
        })),
        getClientSettings: vi.fn(() => ({}))
      },
      storage: {},
      speechPipelineOrchestrator: {
        // Will be called inside business service; we can leave real for unit as business service handles translation
      }
    };
  });

  it('registers correct message type', () => {
    expect(handler.getMessageType()).toBe('send_translation');
  });

  it('ignores when feature flag is off', async () => {
    process.env.FEATURE_MANUAL_TRANSLATION_CONTROL = '0';
    await handler.handle({ type: 'send_translation', text: 'hello' } as any, context);
    expect(context.connectionManager.getRole).not.toHaveBeenCalled();
  });

  it('warns and returns for non-teacher', async () => {
    context.connectionManager.getRole = vi.fn(() => 'student');
    await handler.handle({ type: 'send_translation', text: 'hello' } as any, context);
    expect(context.connectionManager.getRole).toHaveBeenCalled();
  });

  it('returns if no sessionId', async () => {
    context.connectionManager.getSessionId = vi.fn(() => undefined);
    await handler.handle({ type: 'send_translation', text: 'hello' } as any, context);
    expect(context.connectionManager.getSessionId).toHaveBeenCalled();
  });
});


