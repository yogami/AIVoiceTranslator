import { describe, it, expect } from 'vitest';
import { InMemorySignalingStore } from '../../../server/realtime/signaling/InMemorySignalingStore';

describe('InMemorySignalingStore', () => {
  it('stores and retrieves offer/answers/ice by session', () => {
    const store = new InMemorySignalingStore();
    store.setOffer('S', 't1', { sdp: 'offer' });
    store.addAnswer('S', 's1', { sdp: 'answer1' });
    store.addIceCandidate('S', 's1', { c: 1 });
    const state = store.get('S')!;
    expect(state.offer?.from).toBe('t1');
    expect(state.answers.length).toBe(1);
    expect(state.ice.length).toBe(1);
  });
});


