import { describe, it, expect, vi } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { registerRealtimeTranslationHandler } from '../../../server/realtime/handlers/RealtimeTranslationHandler';
import { RealtimeSessionRegistry } from '../../../server/realtime/session/RealtimeSessionRegistry';

class FakeTransportWithSender {
  messageCbs: any[] = [];
  sent: Array<[string, any]> = [];
  sessionBroadcasts: Array<[string, any]> = [];
  onConnect() { return () => {}; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => {}; }
  onDisconnect() { return () => {}; }
  async start() {}
  async stop() {}
  getMessageSender() { return { send: async (id: string, msg: unknown) => { this.sent.push([id, msg]); }, broadcastToSession: async (sid: string, msg: unknown) => { this.sessionBroadcasts.push([sid, msg]); } }; }
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
}

describe('RealtimeTranslationHandler', () => {
  it('broadcasts teacher transcription to session', async () => {
    const transport = new FakeTransportWithSender();
    const svc = new RealTimeCommunicationService(transport as any);
    const registry = new RealtimeSessionRegistry();
    registry.set('t1', { role: 'teacher', sessionId: 'S', languageCode: 'en-US' });
    registerRealtimeTranslationHandler(svc, { translate: vi.fn(async (t) => t) }, registry);
    svc.start();
    const payload = { type: 'transcription', text: 'hello', isFinal: true };
    transport.messageCbs.forEach(cb => cb({ connectionId: 't1', languageCode: 'en-US', sessionId: 'S' }, { data: JSON.stringify(payload) }));
    await new Promise(res => setTimeout(res, 0));
    expect(transport.sessionBroadcasts.length).toBe(1);
    expect(transport.sessionBroadcasts[0][0]).toBe('S');
    expect(transport.sessionBroadcasts[0][1].type).toBe('transcription');
    svc.stop();
  });

  it('translates on demand and broadcasts translation', async () => {
    const transport = new FakeTransportWithSender();
    const svc = new RealTimeCommunicationService(transport as any);
    const registry = new RealtimeSessionRegistry();
    registry.set('t1', { role: 'teacher', sessionId: 'S', languageCode: 'en-US' });
    const deps = { translate: vi.fn(async (_t, _src, _dst) => 'hola') };
    registerRealtimeTranslationHandler(svc, deps, registry);
    svc.start();
    const payload = { type: 'translate', text: 'hello', targetLanguage: 'es-ES' };
    transport.messageCbs.forEach(cb => cb({ connectionId: 't1', languageCode: 'en-US', sessionId: 'S' }, { data: JSON.stringify(payload) }));
    await new Promise(res => setTimeout(res, 0));
    expect(deps.translate).toHaveBeenCalledWith('hello', 'en-US', 'es-ES');
    expect(transport.sessionBroadcasts.length).toBe(1);
    expect(transport.sessionBroadcasts[0][1].type).toBe('translation');
    expect(transport.sessionBroadcasts[0][1].text).toBe('hola');
    svc.stop();
  });
});


