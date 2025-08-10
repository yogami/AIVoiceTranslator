import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock the WebSocket transport adapter to avoid spinning up legacy server
vi.mock('../../../server/realtime/WebSocketTransportAdapter', () => {
  class MockWebSocketTransportAdapter {
    public __mock = true;
    constructor(..._args: any[]) {}
    async start() {}
    async stop() {}
    onConnect() { return () => {}; }
    onMessage() { return () => {}; }
    onDisconnect() { return () => {}; }
    getMessageSender() { return { send: async () => {}, broadcastToSession: async () => {} }; }
    getActiveTeacherCount() { return 0; }
    getActiveStudentCount() { return 0; }
    getActiveSessionsCount() { return 0; }
  }
  return { WebSocketTransportAdapter: MockWebSocketTransportAdapter };
});

// Helper to import factory fresh each time
async function importFactory() {
  const mod = await import('../../../server/realtime/RealtimeTransportFactory');
  return mod.createRealtimeTransport;
}

describe('RealtimeTransportFactory gating', () => {
  const prevEnv = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...prevEnv };
  });

  it('returns WebSocket transport by default when REALTIME_TRANSPORT is unset', async () => {
    delete process.env.REALTIME_TRANSPORT;
    const createRealtimeTransport = await importFactory();
    const transport = createRealtimeTransport({} as any, {} as any);
    expect((transport as any).__mock).toBe(true);
  });

  it('returns WebSocket transport when REALTIME_TRANSPORT=websocket', async () => {
    process.env.REALTIME_TRANSPORT = 'websocket';
    const createRealtimeTransport = await importFactory();
    const transport = createRealtimeTransport({} as any, {} as any);
    expect((transport as any).__mock).toBe(true);
  });

  it('falls back to WebSocket and warns when REALTIME_TRANSPORT=webrtc (experiment disabled)', async () => {
    process.env.REALTIME_TRANSPORT = 'webrtc';
    delete process.env.REALTIME_WEBRTC_ALLOW_EXPERIMENT;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const createRealtimeTransport = await importFactory();
    const transport = createRealtimeTransport({} as any, {} as any);
    // Should be WebSocketTransportAdapter mock
    expect((transport as any).__mock).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('respects COMMUNICATION_PROTOCOL alias when set to webrtc (experiment disabled)', async () => {
    delete process.env.REALTIME_TRANSPORT;
    delete process.env.REALTIME_WEBRTC_ALLOW_EXPERIMENT;
    process.env.COMMUNICATION_PROTOCOL = 'webrtc';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const createRealtimeTransport = await importFactory();
    const transport = createRealtimeTransport({} as any, {} as any);
    expect((transport as any).__mock).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns WebRTC transport when enabled via REALTIME_WEBRTC_ALLOW_EXPERIMENT=1', async () => {
    process.env.REALTIME_TRANSPORT = 'webrtc';
    process.env.REALTIME_WEBRTC_ALLOW_EXPERIMENT = '1';
    // Unmock adapter import to validate class existence
    vi.resetModules();
    const { createRealtimeTransport } = await import('../../../server/realtime/RealtimeTransportFactory');
    const transport = createRealtimeTransport({} as any, {} as any);
    expect(transport.constructor.name).toBe('WebRTCTransportAdapter');
  });
});


