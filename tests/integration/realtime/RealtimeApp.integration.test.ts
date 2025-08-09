import { describe, it, expect, vi } from 'vitest';
import { RealtimeApp } from '../../../server/realtime/RealtimeApp';

class FakeTransport {
  connectCbs: any[] = [];
  messageCbs: any[] = [];
  disconnectCbs: any[] = [];
  sent: Array<[string, unknown]> = [];
  async start() {}
  async stop() {}
  onConnect(cb: any) { this.connectCbs.push(cb); return () => {}; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => {}; }
  onDisconnect(cb: any) { this.disconnectCbs.push(cb); return () => {}; }
  getMessageSender() { return { send: async (id: string, msg: unknown) => { this.sent.push([id, msg]); }, broadcastToSession: async () => {} }; }
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
}

describe('RealtimeApp integration (dispatcher on transport)', () => {
  it('wires ping handler and responds with pong', async () => {
    const transport = new FakeTransport();
    const app = new RealtimeApp(transport as any);
    app.start();
    transport.messageCbs.forEach(cb => cb({ connectionId: 'abc' }, JSON.stringify({ type: 'ping' })));
    expect(transport.sent.length).toBe(1);
    expect(transport.sent[0][0]).toBe('abc');
    expect((transport.sent[0][1] as any).type).toBe('pong');
    app.stop();
  });
});



