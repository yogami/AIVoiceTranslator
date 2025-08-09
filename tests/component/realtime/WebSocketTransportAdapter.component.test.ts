import { describe, expect, it, vi } from 'vitest';

// We import the concrete adapter but stub the legacy server it wraps,
// so we can validate the passthrough behavior without network IO.
vi.mock('../../../server/interface-adapters/websocket/WebSocketServer', () => {
  class FakeLegacy {
    public sent: Array<[string, unknown]> = [];
    public broadcasted: Array<[string, unknown]> = [];
    shutdown = vi.fn(async () => {});
    sendToConnection = vi.fn(async (id: string, msg: any) => { this.sent.push([id, msg]); });
    broadcastToSession = vi.fn(async (sid: string, msg: any) => { this.broadcasted.push([sid, msg]); });
    getActiveTeacherCount() { return 1; }
    getActiveStudentCount() { return 2; }
    getActiveSessionsCount() { return 3; }
  }
  return { WebSocketServer: FakeLegacy };
});

import { WebSocketTransportAdapter } from '../../../server/realtime/WebSocketTransportAdapter';

describe('WebSocketTransportAdapter', () => {
  it('proxies message sending to the legacy server', async () => {
    const adapter = new WebSocketTransportAdapter({} as any, {} as any);
    const sender = adapter.getMessageSender();
    await sender.send('conn-1', { a: 1 });
    await sender.broadcastToSession('sess-1', { b: 2 });

    const legacy = (adapter as any).legacy as { sent: any[]; broadcasted: any[] };
    expect(legacy.sent).toEqual([[ 'conn-1', { a: 1 } ]]);
    expect(legacy.broadcasted).toEqual([[ 'sess-1', { b: 2 } ]]);
  });

  it('exposes active session metrics from the legacy server', () => {
    const adapter = new WebSocketTransportAdapter({} as any, {} as any);
    expect(adapter.getActiveTeacherCount()).toBe(1);
    expect(adapter.getActiveStudentCount()).toBe(2);
    expect(adapter.getActiveSessionsCount()).toBe(3);
  });
});


