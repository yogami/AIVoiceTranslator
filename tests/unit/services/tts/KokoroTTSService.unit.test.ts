import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('KokoroTTSService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns empty buffer when URL missing', async () => {
    const mod = await import('../../../../server/infrastructure/external-services/tts/KokoroTTSService');
    const svc = new mod.KokoroTTSService('');
    const res = await svc.synthesize('Hallo Welt');
    expect(res.audioBuffer.length).toBe(0);
  });

  it('returns audio buffer on success', async () => {
    const audio = new Uint8Array([0x49, 0x44, 0x33, 0x03]);
    // @ts-ignore
    global.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => audio.buffer }));
    const mod = await import('../../../../server/infrastructure/external-services/tts/KokoroTTSService');
    const svc = new mod.KokoroTTSService('https://example.com/kokoro');
    const res = await svc.synthesize('Guten Tag');
    expect(res.audioBuffer.length).toBeGreaterThan(0);
  });
});


