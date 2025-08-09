import { describe, it, expect } from 'vitest';
import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { RealtimeSessionRegistry } from '../../../server/realtime/session/RealtimeSessionRegistry';
import { registerRealtimeSignalingHandler } from '../../../server/realtime/handlers/RealtimeSignalingHandler';

class FakeTransport {
  messageCbs: any[] = [];
  broadcasts: Array<[string, any]> = [];
  onConnect() { return () => {}; }
  onMessage(cb: any) { this.messageCbs.push(cb); return () => {}; }
  onDisconnect() { return () => {}; }
  async start() {}
  async stop() {}
  getMessageSender() { return { send: async () => {}, broadcastToSession: async (sid: string, msg: unknown) => { this.broadcasts.push([sid, msg]); } }; }
  getActiveTeacherCount() { return 0; }
  getActiveStudentCount() { return 0; }
  getActiveSessionsCount() { return 0; }
}

describe('RealtimeSignalingHandler', () => {
  it('relays offers/answers/ice via broadcast', async () => {
    const transport = new FakeTransport();
    const svc = new RealTimeCommunicationService(transport as any);
    const registry = new RealtimeSessionRegistry();
    registry.set('c1', { sessionId: 'S1' });
    registerRealtimeSignalingHandler(svc, registry);
    svc.start();

    const asEvent = (obj: any) => ({ data: JSON.stringify(obj) });
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, asEvent({ type: 'webrtc_offer', sessionId: 'S1', sdp: 'O' })));
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, asEvent({ type: 'webrtc_answer', sessionId: 'S1', sdp: 'A' })));
    transport.messageCbs.forEach(cb => cb({ connectionId: 'c1' }, asEvent({ type: 'webrtc_ice_candidate', sessionId: 'S1', candidate: { c: 1 } })));
    expect(transport.broadcasts.length).toBe(3);
    expect(transport.broadcasts[0][0]).toBe('S1');
  });
});


