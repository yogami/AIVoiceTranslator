import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wrtc for PeerManager
vi.mock('wrtc', () => {
  class RTCSessionDescription {
    type: string; sdp: string;
    constructor(init: any) { this.type = init.type; this.sdp = init.sdp; }
  }
  class RTCIceCandidate { candidate: any; constructor(init: any) { this.candidate = init; } }
  class RTCPeerConnection {
    public onicecandidate: ((ev: any)=>void) | null = null;
    async setRemoteDescription(_d: any) {}
    createDataChannel(_label: string) {}
    async createAnswer() { return { type: 'answer', sdp: 'ANS' }; }
    async setLocalDescription(_d: any) {
      setTimeout(() => { this.onicecandidate && this.onicecandidate({ candidate: { c: 1 } }); }, 0);
    }
    async addIceCandidate(_cand: any) {}
  }
  return { RTCSessionDescription, RTCIceCandidate, RTCPeerConnection };
});

import { RealTimeCommunicationService } from '../../../server/realtime/RealTimeCommunicationService';
import { RealtimeApp } from '../../../server/realtime/RealtimeApp';

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

describe('PeerManager signaling (component)', () => {
  beforeEach(() => {
    vi.stubEnv('REALTIME_WEBRTC_ALLOW_EXPERIMENT', '1');
  });

  it('broadcasts a webrtc_answer when a webrtc_offer is received', async () => {
    const transport = new FakeTransport();
    const app = new RealtimeApp(transport as any, {});
    app.start();
    const asEvent = (obj: any) => ({ data: JSON.stringify(obj) });
    // ensure session is tracked
    transport.messageCbs.forEach(cb => cb({ connectionId: 't1', sessionId: 'S1' }, asEvent({ type: 'register', role: 'teacher', sessionId: 'S1' })));
    // send offer (string SDP form to exercise normalization)
    transport.messageCbs.forEach(cb => cb({ connectionId: 't1', sessionId: 'S1' }, asEvent({ type: 'webrtc_offer', sessionId: 'S1', sdp: 'O' })));
    await new Promise(res => setTimeout(res, 10));
    const answerMsg = transport.broadcasts.find(([, m]) => (m as any).type === 'webrtc_answer');
    expect(answerMsg).toBeDefined();
    app.stop();
  });
});


