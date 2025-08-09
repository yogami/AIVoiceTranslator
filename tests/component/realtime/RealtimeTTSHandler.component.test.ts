import { describe, it, expect, vi } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { registerRealtimeTTSHandler } from '../../../server/realtime/handlers/RealtimeTTSHandler';

class FakeTransportWithSender {
  messageCbs: any[] = [];
  sent: Array<[string, any]> = [];
  onConnect() { return () => {}; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => {}; }
  onDisconnect() { return () => {}; }
  async start() {}
  async stop() {}
  getMessageSender() { return { send: async (id: string, msg: unknown) => { this.sent.push([id, msg]); }, broadcastToSession: async () => {} }; }
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
}

describe('RealtimeTTSHandler', () => {
  it('synthesizes text and responds with tts_response', async () => {
    const transport = new FakeTransportWithSender();
    const svc = new RealTimeCommunicationService(transport as any);
    const deps = { synthesize: vi.fn(async (text: string) => Buffer.from(`AUDIO:${text}`)) };
    registerRealtimeTTSHandler(svc, deps);
    svc.start();
    const payload = { type: 'tts_request', text: 'hello', languageCode: 'en-US' };
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1', languageCode: 'en-US' }, { data: JSON.stringify(payload) }));
    await new Promise(res => setTimeout(res, 0));
    expect(deps.synthesize).toHaveBeenCalledWith('hello', { language: 'en-US' });
    expect(transport.sent.length).toBe(1);
    expect(transport.sent[0][1].type).toBe('tts_response');
    expect(typeof transport.sent[0][1].audioBuffer).toBe('string');
    svc.stop();
  });
});


