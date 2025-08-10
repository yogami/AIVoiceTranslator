import type { InMemorySignalingStore } from '../signaling/InMemorySignalingStore';

export class PeerManager {
  private readonly peers = new Map<string, any>(); // sessionId -> RTCPeerConnection
  private wrtc: any | null = null;

  constructor(private readonly store: InMemorySignalingStore, private readonly broadcastIce: (sessionId: string, candidate: any) => Promise<void>) {}

  private async ensureWrtc(): Promise<boolean> {
    if (this.wrtc) return true;
    try {
      // Dynamic import to avoid hard dependency if not installed
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      this.wrtc = await import('wrtc');
      return true;
    } catch {
      console.warn('[PeerManager] wrtc not available; skipping DataChannel setup');
      return false;
    }
  }

  async handleOffer(sessionId: string, offerSdp: any): Promise<any | null> {
    const ok = await this.ensureWrtc();
    if (!ok) return null;
    const RTCPeerConnection = this.wrtc.RTCPeerConnection;
    const pc = new RTCPeerConnection({ iceServers: [] });
    this.peers.set(sessionId, pc);
    pc.onicecandidate = async (ev: any) => {
      if (ev.candidate) {
        await this.broadcastIce(sessionId, ev.candidate);
      }
    };
    // Create a simple data channel for demo
    pc.createDataChannel('data');
    const remoteDesc = typeof offerSdp === 'string'
      ? new this.wrtc.RTCSessionDescription({ type: 'offer', sdp: offerSdp })
      : new this.wrtc.RTCSessionDescription(offerSdp);
    await pc.setRemoteDescription(remoteDesc);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    return answer.sdp ? { type: 'answer', sdp: answer.sdp } as any : (answer as any);
  }

  async addRemoteIce(sessionId: string, candidate: any): Promise<void> {
    const ok = await this.ensureWrtc();
    if (!ok) return;
    const pc = this.peers.get(sessionId);
    if (!pc) return;
    await pc.addIceCandidate(new this.wrtc.RTCIceCandidate(candidate));
  }
}


