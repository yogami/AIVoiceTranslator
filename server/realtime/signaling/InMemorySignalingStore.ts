export interface StoredOffer { from: string; sdp: any; at: number }
export interface StoredAnswer { from: string; sdp: any; at: number }
export interface StoredIce { from: string; candidate: any; at: number }

export interface SessionSignalingState {
  offer?: StoredOffer;
  answers: StoredAnswer[];
  ice: StoredIce[];
}

export class InMemorySignalingStore {
  private readonly bySession = new Map<string, SessionSignalingState>();

  setOffer(sessionId: string, from: string, sdp: any): void {
    const s = this.ensure(sessionId);
    s.offer = { from, sdp, at: Date.now() };
  }

  addAnswer(sessionId: string, from: string, sdp: any): void {
    const s = this.ensure(sessionId);
    s.answers.push({ from, sdp, at: Date.now() });
  }

  addIceCandidate(sessionId: string, from: string, candidate: any): void {
    const s = this.ensure(sessionId);
    s.ice.push({ from, candidate, at: Date.now() });
  }

  get(sessionId: string): SessionSignalingState | undefined {
    const s = this.bySession.get(sessionId);
    if (!s) return undefined;
    // Return shallow copy to avoid external mutation
    return { offer: s.offer, answers: [...s.answers], ice: [...s.ice] };
  }

  clear(sessionId: string): void {
    this.bySession.delete(sessionId);
  }

  private ensure(sessionId: string): SessionSignalingState {
    if (!this.bySession.has(sessionId)) {
      this.bySession.set(sessionId, { answers: [], ice: [] });
    }
    return this.bySession.get(sessionId)!;
  }
}


