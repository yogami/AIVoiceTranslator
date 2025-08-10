import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.stubEnv('REALTIME_APP_ENABLED', '1');

vi.mock('../../../server/realtime/RealtimeTransportFactory', async (orig) => {
  const mod = await (orig as any)();
  // Wrap factory to return a fake transport for this test scope
  return {
    ...mod,
    createRealtimeTransport: () => ({
      onConnect: (_cb: any) => () => {},
      onMessage: (_cb: any) => () => {},
      onDisconnect: (_cb: any) => () => {},
      async start() {},
      async stop() {},
      getMessageSender: () => ({ send: async () => {}, broadcastToSession: async () => {} }),
      getActiveTeacherCount: () => 0,
      getActiveStudentCount: () => 0,
      getActiveSessionsCount: () => 0,
    }),
  };
});

describe('WebSocketRealtimeAppAdapter integration flag', () => {
  it('does not throw when enabling adapter at server startup', async () => {
    const loggerInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    const loggerWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const express = (await import('express')).default;
    const { startServer } = await import('../../../server/server');
    const app = express();
    // Bind to a random high port to avoid EADDRINUSE in CI, and set HOST
    process.env.PORT = String(40000 + Math.floor(Math.random() * 10000));
    process.env.HOST = '127.0.0.1';
    const server = await startServer(app);
    // We only assert that startup succeeded; close server
    await new Promise<void>((resolve) => server.close(() => resolve()));
    loggerInfo.mockRestore();
    loggerWarn.mockRestore();
  });
});


