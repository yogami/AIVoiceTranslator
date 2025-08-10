import { describe, it, expect } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { RealtimeSessionRegistry } from '../../../server/realtime/session/RealtimeSessionRegistry';
import { registerRealtimeSignalingHandler } from '../../../server/realtime/handlers/RealtimeSignalingHandler';
import { InMemorySignalingStore } from '../../../server/realtime/signaling/InMemorySignalingStore';

class FakeTransport {
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

describe('RealtimeSignaling webrtc_sync', () => {
  it('returns stored signaling state to requester', async () => {
    const transport = new FakeTransport();
    const svc = new RealTimeCommunicationService(transport as any);
    const registry = new RealtimeSessionRegistry();
    const store = new InMemorySignalingStore();
    registry.set('t1', { sessionId: 'S1' });
    registerRealtimeSignalingHandler(svc, registry, store);
    svc.start();

    const asEvent = (obj: any) => ({ data: JSON.stringify(obj) });
    // Seed state
    transport.messageCbs.forEach(cb => cb({ connectionId: 't1' }, asEvent({ type: 'webrtc_offer', sessionId: 'S1', sdp: 'O' })));
    transport.messageCbs.forEach(cb => cb({ connectionId: 't1' }, asEvent({ type: 'webrtc_ice_candidate', sessionId: 'S1', candidate: { c: 1 } })));
    // Request sync
    transport.messageCbs.forEach(cb => cb({ connectionId: 't1' }, asEvent({ type: 'webrtc_sync', sessionId: 'S1' })));
    const syncMsg = transport.sent.find(([id, msg]) => id === 't1' && (msg as any).type === 'webrtc_sync');
    expect(syncMsg).toBeDefined();
    expect((syncMsg![1] as any).state.offer?.sdp).toBe('O');
  });
});


