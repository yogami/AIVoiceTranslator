import { describe, it, expect } from 'vitest';
import { TTSService } from '../../../../server/services/tts/TTSService.js';

describe('TTSService', () => {
  it('should instantiate without error', () => {
    const service = new TTSService();
    expect(service).toBeInstanceOf(TTSService);
  });

  it('should return error for empty text', async () => {
    const service = new TTSService();
    const result = await service.synthesize('', { language: 'en' });
    expect(result.error).toBeDefined();
  });
});
