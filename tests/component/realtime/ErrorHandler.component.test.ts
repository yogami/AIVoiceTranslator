import { describe, it, expect, vi } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { registerErrorHandler } from '../../../server/realtime/handlers/ErrorHandler';

class FakeTransportWithSender {
  messageCbs: any[] = [];
  sent: Array<[string, unknown]> = [];
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

describe('ErrorHandler', () => {
  it('responds with error message on invalid payload', async () => {
    const transport = new FakeTransportWithSender();
    const svc = new RealTimeCommunicationService(transport as any);
    registerErrorHandler(svc);
    svc.start();
    // simulate malformed (non-JSON) without type
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, 'not-json'));
    expect(transport.sent.length).toBe(1);
    expect((transport.sent[0][1] as any).type).toBe('error');
    svc.stop();
  });
});


