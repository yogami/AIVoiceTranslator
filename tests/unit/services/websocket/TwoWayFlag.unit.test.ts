import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('Feature flag parsing - two way communication', () => {
  beforeEach(() => {
    // Reset cache by reloading module between tests
    delete (global as any).config;
    for (const k of ['FEATURE_TWO_WAY_COMMUNICATION']) delete process.env[k];
  });

  it('treats true-like values as enabled', async () => {
    for (const v of ['1', 'true', 'TRUE', 'yes', 'on', 'On']) {
      process.env.FEATURE_TWO_WAY_COMMUNICATION = v;
      vi.resetModules();
      // Re-import config to pick up env per iteration
      const { config } = await import('../../../../server/config');
      expect(config.features?.twoWayCommunication).toBe(true);
    }
  });

  it('treats other values as disabled', async () => {
    for (const v of ['', '0', 'false', 'off', 'no']) {
      process.env.FEATURE_TWO_WAY_COMMUNICATION = v;
      vi.resetModules();
      const { config } = await import('../../../../server/config');
      expect(config.features?.twoWayCommunication).toBe(false);
    }
  });
});


