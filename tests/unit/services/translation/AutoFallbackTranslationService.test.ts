import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AutoFallbackTranslationService } from '../../../../server/services/translation/AutoFallbackTranslationService';

const mockOpenAIService = {
  translate: vi.fn()
};
const mockMyMemoryService = {
  translate: vi.fn()
};

describe('AutoFallbackTranslationService', () => {
  let service: AutoFallbackTranslationService;

  beforeEach(() => {
    vi.resetAllMocks();
    service = new AutoFallbackTranslationService(
      mockOpenAIService as any,
      mockMyMemoryService as any
    );
  });

  it('should use OpenAI service if it succeeds', async () => {
    mockOpenAIService.translate.mockResolvedValue('translated by openai');
    const result = await service.translate('foo', 'en', 'fr');
    expect(result).toBe('translated by openai');
    expect(mockOpenAIService.translate).toHaveBeenCalled();
    expect(mockMyMemoryService.translate).not.toHaveBeenCalled();
  });

  it('should fallback to MyMemory if OpenAI fails', async () => {
    mockOpenAIService.translate.mockRejectedValue(new Error('fail'));
    mockMyMemoryService.translate.mockResolvedValue('translated by mymemory');
    const result = await service.translate('foo', 'en', 'fr');
    expect(result).toBe('translated by mymemory');
    expect(mockOpenAIService.translate).toHaveBeenCalled();
    expect(mockMyMemoryService.translate).toHaveBeenCalled();
  });

  it('should throw if both services fail', async () => {
    mockOpenAIService.translate.mockRejectedValue(new Error('fail'));
    mockMyMemoryService.translate.mockRejectedValue(new Error('fail2'));
    await expect(service.translate('foo', 'en', 'fr')).rejects.toThrow();
  });
});
