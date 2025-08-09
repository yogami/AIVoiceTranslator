import { describe, it, expect } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { registerRealtimeSessionHandlers } from '../../../server/realtime/handlers/RealtimeSessionHandlers';
import { RealtimeSessionRegistry } from '../../../server/realtime/session/RealtimeSessionRegistry';

class FakeTransport {
  messageCbs: any[] = [];
  onConnect() { return () => {}; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => {}; }
  onDisconnect() { return () => {}; }
  async start() {}
  async stop() {}
  getMessageSender() { return { send: async () => {}, broadcastToSession: async () => {} }; }
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
}

describe('RealtimeSessionHandlers', () => {
  it('updates registry on register and join_session', async () => {
    const transport = new FakeTransport();
    const svc = new RealTimeCommunicationService(transport as any);
    const registry = new RealtimeSessionRegistry();
    registerRealtimeSessionHandlers(svc, registry);
    svc.start();
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, { data: JSON.stringify({ type: 'register', role: 'teacher', languageCode: 'en-US' }) }));
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, { data: JSON.stringify({ type: 'join_session', sessionId: 'S1' }) }));
    const d = registry.get('c1');
    expect(d?.role).toBe('teacher');
    expect(d?.languageCode).toBe('en-US');
    expect(d?.sessionId).toBe('S1');
  });
});


