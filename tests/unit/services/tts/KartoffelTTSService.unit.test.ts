import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('KartoffelTTSService', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns empty audio buffer when endpoint not configured', async () => {
    const mod = await import('../../../../server/infrastructure/external-services/tts/KartoffelTTSService');
    const svc = new mod.KartoffelTTSService('');
    const res = await svc.synthesize('Hallo Welt', { language: 'de-DE' });
    expect(res.audioBuffer.length).toBe(0);
    expect(res.ttsServiceType).toBeTruthy();
  });

  it('handles HTTP error gracefully', async () => {
    (global as any).fetch = vi.fn(async () => ({ ok: false, status: 500, text: async () => 'server error' }));
    const mod = await import('../../../../server/infrastructure/external-services/tts/KartoffelTTSService');
    const svc = new mod.KartoffelTTSService('https://example.invalid');
    const res = await svc.synthesize('Hallo Welt', { language: 'de-DE' });
    expect(res.audioBuffer.length).toBe(0);
    expect(String(res.error || '')).toContain('500');
  });

  it('returns buffer and detects type when successful', async () => {
    const fakeMp3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]); // ID3
    (global as any).fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => fakeMp3 }));
    const mod = await import('../../../../server/infrastructure/external-services/tts/KartoffelTTSService');
    const svc = new mod.KartoffelTTSService('https://example.invalid');
    const res = await svc.synthesize('Hallo Welt', { language: 'de-DE' });
    expect(res.audioBuffer.length).toBeGreaterThan(0);
    expect(['mp3','wav','kartoffel']).toContain(res.ttsServiceType);
  });

  it('issues POST and returns audio buffer on success', async () => {
    const fakeMp3 = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00]);
    (global as any).fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => fakeMp3 }));
    const mod = await import('../../../../server/infrastructure/external-services/tts/KartoffelTTSService');
    const svc = new mod.KartoffelTTSService('https://example.com/tts');
    const res = await svc.synthesize('Guten Tag', { language: 'de' });
    expect(res.audioBuffer.length).toBeGreaterThan(0);
    expect(['mp3','wav','kartoffel']).toContain(res.ttsServiceType);
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('KartoffelTTSService', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it('returns error when URL not configured', async () => {
    const mod = await import('../../../../server/infrastructure/external-services/tts/KartoffelTTSService');
    const svc = new mod.KartoffelTTSService('');
    const res = await svc.synthesize('Hallo Welt', { language: 'de-DE' });
    expect(res.ttsServiceType).toBe('kartoffel');
    expect(res.audioBuffer.length).toBe(0);
    expect(String(res.error || '')).toContain('not configured');
  });

  it('issues POST and returns audio buffer on success', async () => {
    const audio = new Uint8Array([0x49, 0x44, 0x33, 0x03]); // fake MP3 header
    // @ts-ignore
    global.fetch = vi.fn(async () => ({ ok: true, arrayBuffer: async () => audio.buffer }));
    const mod = await import('../../../../server/infrastructure/external-services/tts/KartoffelTTSService');
    const svc = new mod.KartoffelTTSService('https://example.com/tts');
    const res = await svc.synthesize('Guten Tag', { language: 'de' });
    expect(['mp3','wav','kartoffel']).toContain(res.ttsServiceType);
    expect(res.audioBuffer.length).toBeGreaterThan(0);
  });

  it('propagates HTTP errors as error string', async () => {
    // @ts-ignore
    global.fetch = vi.fn(async () => ({ ok: false, status: 503, text: async () => 'Service Unavailable' }));
    const mod = await import('../../../../server/infrastructure/external-services/tts/KartoffelTTSService');
    const svc = new mod.KartoffelTTSService('https://example.com/tts');
    const res = await svc.synthesize('Guten Abend');
    expect(String(res.error || '')).toMatch(/503/);
  });
});


