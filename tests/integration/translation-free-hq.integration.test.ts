import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getTranslationService } from '../../server/infrastructure/factories/TranslationServiceFactory';

describe('Translation free-hq (DeepSeek) integration', () => {
  let originalType: string | undefined;

  beforeEach(() => {
    originalType = process.env.TRANSLATION_SERVICE_TYPE;
    process.env.TRANSLATION_SERVICE_TYPE = 'free-hq';
  });

  afterEach(() => {
    if (originalType !== undefined) process.env.TRANSLATION_SERVICE_TYPE = originalType; else delete process.env.TRANSLATION_SERVICE_TYPE;
  });

  it('should translate basic text using DeepSeek without throwing', async () => {
    const svc = getTranslationService();
    const result = await svc.translate('Hello world', 'en', 'es');
    expect(typeof result).toBe('string');
  }, 15000);
});


