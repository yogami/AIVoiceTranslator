import { describe, it, expect } from 'vitest';
import { WebRTCTransportAdapter } from '../../../server/realtime/WebRTCTransportAdapter';

describe('WebRTCTransportAdapter (skeleton)', () => {
  it('registers and emits connect/message/disconnect', async () => {
    const rtc = new WebRTCTransportAdapter();
    let connected = false;
    let gotMessage = false;
    let disconnected = false;

    rtc.onConnect(() => { connected = true; });
    rtc.onMessage((_ctx, _msg) => { gotMessage = true; });
    rtc.onDisconnect((_id) => { disconnected = true; });

    rtc.emitConnect({ connectionId: 'c1' });
    rtc.emitMessage({ connectionId: 'c1' }, { type: 'ping' });
    rtc.emitDisconnect('c1');

    expect(connected).toBe(true);
    expect(gotMessage).toBe(true);
    expect(disconnected).toBe(true);
  });
});



