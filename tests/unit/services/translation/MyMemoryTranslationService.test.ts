import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MyMemoryTranslationService } from '../../../../server/services/translation/MyMemoryTranslationService';

// Mock fetch for MyMemory API
const mockFetch = vi.fn();

describe('MyMemoryTranslationService', () => {
  let service: MyMemoryTranslationService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new MyMemoryTranslationService();
    // @ts-ignore
    global.fetch = mockFetch;
  });

  it('should return translation from MyMemory API response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        responseData: { translatedText: 'Hola mundo', match: 90 },
        quotaFinished: false,
        mtLangSupported: true,
        responseDetails: '',
        responseStatus: 200,
        responderId: 'test',
        matches: []
      })
    });
    const result = await service.translate('Hello world', 'en-US', 'es-ES');
    expect(result).toBe('Hola mundo');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should return original text if API returns no translation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        responseData: { translatedText: '', match: 0 },
        quotaFinished: false,
        mtLangSupported: true,
        responseDetails: '',
        responseStatus: 200,
        responderId: 'test',
        matches: []
      })
    });
    const result = await service.translate('Hello', 'en-US', 'es-ES');
    expect(result).toBe('Hello');
  });

  it('should return empty string if fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    const result = await service.translate('Hello', 'en-US', 'es-ES');
    expect(result).toBe('');
  });

  it('should return empty string if API response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    const result = await service.translate('Hello', 'en-US', 'es-ES');
    expect(result).toBe('');
  });
});
