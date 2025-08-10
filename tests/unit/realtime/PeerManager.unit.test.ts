import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock wrtc with a minimal RTCPeerConnection
vi.mock('wrtc', () => {
  class RTCSessionDescription {
    type: string; sdp: string;
    constructor(init: any) { this.type = init.type; this.sdp = init.sdp; }
  }
  class RTCIceCandidate { candidate: any; constructor(init: any) { this.candidate = init; } }
  class RTCPeerConnection {
    public onicecandidate: ((ev: any)=>void) | null = null;
    private remote: any;
    private local: any;
    createDataChannel(_label: string) { /* no-op */ }
    async setRemoteDescription(desc: any) { this.remote = desc; }
    async createAnswer() { return { type: 'answer', sdp: 'ANS-SDP' }; }
    async setLocalDescription(desc: any) {
      this.local = desc;
      // Simulate ICE gathering
      setTimeout(() => { this.onicecandidate && this.onicecandidate({ candidate: { c: 1 } }); }, 0);
    }
    async addIceCandidate(_cand: any) { /* accept */ }
  }
  return { RTCSessionDescription, RTCIceCandidate, RTCPeerConnection };
});

import { PeerManager } from '../../../server/realtime/webrtc/PeerManager';
import { InMemorySignalingStore } from '../../../server/realtime/signaling/InMemorySignalingStore';

describe('PeerManager', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('handles offer, returns answer, and emits ICE via callback', async () => {
    const store = new InMemorySignalingStore();
    const emitted: any[] = [];
    const pm = new PeerManager(store, async (sid, cand) => { emitted.push([sid, cand]); });
    const answer = await pm.handleOffer('S1', { type: 'offer', sdp: 'O' } as any);
    expect(answer).toBeTruthy();
    vi.runAllTimers();
    expect(emitted.length).toBeGreaterThan(0);
    await pm.addRemoteIce('S1', { c: 2 } as any);
  });
});


