import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAITranslationService } from '../../../../server/services/translation/OpenAITranslationService';
import { OpenAI } from 'openai';

// Mock OpenAI client
const mockCreate = vi.fn();
const mockOpenAI = {
  chat: {
    completions: {
      create: mockCreate
    }
  }
} as unknown as OpenAI;

describe('OpenAITranslationService', () => {
  let service: OpenAITranslationService;

  beforeEach(() => {
    mockCreate.mockReset();
    service = new OpenAITranslationService(mockOpenAI);
  });

  it('should return translation from OpenAI response', async () => {
    mockCreate.mockResolvedValue({
      choices: [
        { message: { content: 'Bonjour le monde' } }
      ]
    });
    const result = await service.translate('Hello world', 'en', 'fr');
    expect(result).toBe('Bonjour le monde');
    expect(mockCreate).toHaveBeenCalled();
  });

  it('should return empty string if OpenAI response is empty', async () => {
    mockCreate.mockResolvedValue({ choices: [{}] });
    const result = await service.translate('Hello world', 'en', 'fr');
    expect(result).toBe('');
  });

  it('should throw if OpenAI throws', async () => {
    mockCreate.mockRejectedValue(new Error('API error'));
    await expect(service.translate('Hello', 'en', 'fr')).rejects.toThrow('OpenAI translation failed: API error');
  });
});
