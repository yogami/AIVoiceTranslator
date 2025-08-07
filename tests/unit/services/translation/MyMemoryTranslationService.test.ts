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
        responseData: { translatedText: 'Hola mundo' },
        matches: []
      })
    });
    const result = await service.translate('Hello world', 'en', 'es');
    expect(result).toBe('Hola mundo');
    expect(mockFetch).toHaveBeenCalled();
  });

  it('should throw if fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));
    await expect(service.translate('Hello', 'en', 'es')).rejects.toThrow('MyMemory translation failed: Network error');
  });

  it('should throw if API response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500, statusText: 'Server Error' });
    await expect(service.translate('Hello', 'en', 'es')).rejects.toThrow('MyMemory translation failed: 500 Server Error');
  });

  it('should throw if API returns no translation', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ responseData: {} })
    });
    await expect(service.translate('Hello', 'en', 'es')).rejects.toThrow('MyMemory translation failed: No translation found');
  });
});
