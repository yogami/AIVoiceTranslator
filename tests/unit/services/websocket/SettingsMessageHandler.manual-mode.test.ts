import { describe, it, expect } from 'vitest';
import { SettingsMessageHandler } from '../../../../server/interface-adapters/websocket/websocket-services/SettingsMessageHandler';

describe('SettingsMessageHandler - translationMode normalization', () => {
  it('defaults to auto when invalid or missing', async () => {
    const handler = new SettingsMessageHandler();
    const ws: any = { send: () => {} };
    const cm = {
      getRole: () => 'teacher',
      getClientSettings: () => ({}),
      setClientSettings: (w: any, s: any) => { (ws as any).saved = s; }
    };
    const context: any = { ws, connectionManager: cm };
    await handler.handle({ type: 'settings', settings: {} } as any, context);
    expect((ws as any).saved.translationMode).toBe('auto');
  });

  it('persists manual when set', async () => {
    const handler = new SettingsMessageHandler();
    const ws: any = { send: () => {} };
    const cm = {
      getRole: () => 'teacher',
      getClientSettings: () => ({}),
      setClientSettings: (w: any, s: any) => { (ws as any).saved = s; }
    };
    const context: any = { ws, connectionManager: cm };
    await handler.handle({ type: 'settings', settings: { translationMode: 'manual' } } as any, context);
    expect((ws as any).saved.translationMode).toBe('manual');
  });
});


