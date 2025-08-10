import { describe, it, expect, vi } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';

class FakeTransport {
  connectCbs: any[] = [];
  messageCbs: any[] = [];
  disconnectCbs: any[] = [];
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
  start = vi.fn(async () => {});
  stop = vi.fn(async () => {});
  onConnect(cb: any) { this.connectCbs.push(cb); return () => { this.connectCbs = this.connectCbs.filter(c => c !== cb); }; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => { this.messageCbs = this.messageCbs.filter(c => c !== cb); }; }
  onDisconnect(cb: any) { this.disconnectCbs.push(cb); return () => { this.disconnectCbs = this.disconnectCbs.filter(c => c !== cb); }; }
  getMessageSender() { return { send: async () => {}, broadcastToSession: async () => {} }; }
}

describe('RealTimeCommunicationService', () => {
  it('routes messages to registered handlers by type', async () => {
    const transport = new FakeTransport();
    const svc = new RealTimeCommunicationService(transport as any);
    const pingHandler = vi.fn();
    svc.registerHandler('ping', pingHandler);
    svc.start();
    // simulate incoming string event
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, JSON.stringify({ type: 'ping' })));
    expect(pingHandler).toHaveBeenCalled();
    svc.stop();
  });

  it('ignores unknown types without throwing', async () => {
    const transport = new FakeTransport();
    const svc = new RealTimeCommunicationService(transport as any);
    svc.start();
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, JSON.stringify({ type: 'unknown' })));
    // no assertion other than not throwing
    svc.stop();
  });
});


