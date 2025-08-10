import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// We want to verify end-to-end wiring at the factory boundary without creating sockets.
// Mock legacy server to be inert but observable.
vi.mock('../../../server/interface-adapters/websocket/WebSocketServer', () => {
  class FakeLegacy {
    shutdown = vi.fn(async () => {});
  }
  return { WebSocketServer: FakeLegacy };
});

import { createServer } from 'http';

describe('Integration: RealtimeTransportFactory env gating', () => {
  const prevEnv = { ...process.env };
  let httpServer: ReturnType<typeof createServer>;

  beforeAll(() => {
    httpServer = createServer((_req, res) => { res.statusCode = 204; res.end(); });
  });

  afterAll(async () => {
    process.env = { ...prevEnv };
    httpServer.close();
  });

  it('uses WebSocket adapter when REALTIME_TRANSPORT not set', async () => {
    delete process.env.REALTIME_TRANSPORT;
    const { createRealtimeTransport } = await import('../../../server/realtime/RealtimeTransportFactory');
    const transport = createRealtimeTransport(httpServer as any, {} as any);
    await transport.start(httpServer as any);
    expect((transport as any).legacy).toBeDefined();
    await transport.stop();
  });

  it('falls back to WebSocket adapter when REALTIME_TRANSPORT=webrtc', async () => {
    process.env.REALTIME_TRANSPORT = 'webrtc';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { createRealtimeTransport } = await import('../../../server/realtime/RealtimeTransportFactory');
    const transport = createRealtimeTransport(httpServer as any, {} as any);
    await transport.start(httpServer as any);
    expect((transport as any).legacy).toBeDefined();
    expect(warnSpy).toHaveBeenCalled();
    await transport.stop();
    warnSpy.mockRestore();
  });
});


