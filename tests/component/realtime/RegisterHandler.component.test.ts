import { describe, it, expect, vi } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { registerRegisterHandler } from '../../../server/realtime/handlers/RegisterHandler';

class FakeTransportWithSender {
  messageCbs: any[] = [];
  sent: Array<[string, any]> = [];
  onConnect() { return () => {}; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => {}; }
  onDisconnect() { return () => {}; }
  start = vi.fn(async () => {});
  stop = vi.fn(async () => {});
  getMessageSender() { return { send: async (id: string, msg: unknown) => { this.sent.push([id, msg]); }, broadcastToSession: async () => {} }; }
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
}

describe('RegisterHandler', () => {
  it('acknowledges register with success status', async () => {
    const transport = new FakeTransportWithSender();
    const svc = new RealTimeCommunicationService(transport as any);
    registerRegisterHandler(svc);
    svc.start();
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' })));
    expect(transport.sent.length).toBe(1);
    expect(transport.sent[0][0]).toBe('c1');
    expect(transport.sent[0][1].type).toBe('register');
    expect(transport.sent[0][1].status).toBe('success');
    svc.stop();
  });
});


