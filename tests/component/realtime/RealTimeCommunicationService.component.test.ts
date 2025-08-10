import { describe, it, expect, vi } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { registerPingHandler } from '../../../server/realtime/handlers/PingHandler';

class FakeTransportWithSender {
  connectCbs: any[] = [];
  messageCbs: any[] = [];
  disconnectCbs: any[] = [];
  sent: Array<[string, unknown]> = [];
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
  start = vi.fn(async () => {});
  stop = vi.fn(async () => {});
  onConnect(cb: any) { this.connectCbs.push(cb); return () => { this.connectCbs = this.connectCbs.filter(c => c !== cb); }; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => { this.messageCbs = this.messageCbs.filter(c => c !== cb); }; }
  onDisconnect(cb: any) { this.disconnectCbs.push(cb); return () => { this.disconnectCbs = this.disconnectCbs.filter(c => c !== cb); }; }
  getMessageSender() { return { send: async (id: string, msg: unknown) => { this.sent.push([id, msg]); }, broadcastToSession: async () => {} }; }
}

describe('RealTimeCommunicationService + PingHandler', () => {
  it('responds with pong when ping is received', async () => {
    const transport = new FakeTransportWithSender();
    const svc = new RealTimeCommunicationService(transport as any);
    registerPingHandler(svc);
    svc.start();
    // simulate a ping message event
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, JSON.stringify({ type: 'ping' })));
    expect(transport.sent.length).toBe(1);
    expect(transport.sent[0][0]).toBe('c1');
    expect((transport.sent[0][1] as any).type).toBe('pong');
    svc.stop();
  });
});



