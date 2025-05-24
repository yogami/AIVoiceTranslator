// filepath: /Users/yamijala/gitprojects/AIVoiceTranslator/tests/unit/services/OpenAITranslationService.test.ts
import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { setupOpenAITranslationTest } from './translation-test-helpers';
import { ITranslationService } from '../../../server/services/TranslationService';

describe('OpenAITranslationService', () => {
  const { mockOpenAI, getService } = setupOpenAITranslationTest();
  let service: ITranslationService;

  beforeEach(() => {
    service = getService();
  });

  it('should translate a simple phrase from English to Spanish', async () => {
    mockOpenAI.chat.completions.create = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { content: 'Hola' } }]
    });
    const result = await service.translate('Hello', 'en', 'es');
    expect(result).toBe('Hola');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledOnce();
  });

  it('should return the original text if source and target languages are the same', async () => {
    const text = 'Hello';
    const result = await service.translate(text, 'en', 'en');
    expect(result).toBe(text);
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should handle empty input gracefully', async () => {
    const result = await service.translate('', 'en', 'es');
    expect(result).toBe('');
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should handle null or undefined input gracefully', async () => {
    // @ts-expect-error
    await expect(service.translate(null, 'en', 'es')).resolves.toBe('');
    // @ts-expect-error
    await expect(service.translate(undefined, 'en', 'es')).resolves.toBe('');
    expect(mockOpenAI.chat.completions.create).not.toHaveBeenCalled();
  });

  it('should use language mapping for known codes', async () => {
    mockOpenAI.chat.completions.create = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { content: 'Bonjour' } }]
    });
    await service.translate('Hello', 'en-US', 'fr-FR');
    const callArgs = ((mockOpenAI.chat.completions.create as unknown) as Mock).mock.calls[0][0];
    expect(callArgs.messages[1].content).toContain('French');
    expect(callArgs.messages[1].content).toContain('Original text: "Hello"');
    expect(callArgs.messages[1].content).toContain('Translation:');
  });

  it('should use fallback language code if not mapped', async () => {
    mockOpenAI.chat.completions.create = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { content: 'Test' } }]
    });
    await service.translate('Hello', 'en-US', 'xx-YY');
    const callArgs = ((mockOpenAI.chat.completions.create as unknown) as Mock).mock.calls[0][0];
    expect(callArgs.messages[1].content).toContain('xx');
  });

  it('should return original text if OpenAI returns empty content', async () => {
    mockOpenAI.chat.completions.create = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { content: '' } }]
    });
    const result = await service.translate('Hello', 'en', 'es');
    expect(result).toBe('Hello');
  });

  it('should return original text if OpenAI returns undefined content', async () => {
    mockOpenAI.chat.completions.create = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { content: undefined } }]
    });
    const result = await service.translate('Hello', 'en', 'es');
    expect(result).toBe('Hello');
  });

  it('should return empty string if OpenAI returns no choices', async () => {
    mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
      choices: []
    });
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('');
  });

  it('should return empty string if OpenAI returns no message', async () => {
    mockOpenAI.chat.completions.create = vi.fn().mockResolvedValue({
      choices: [{}]
    });
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('');
  });

  it('should retry on OpenAI API error and eventually return empty string after max retries', async () => {
    mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue(new Error('API error'));
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
  });

  it('should succeed if OpenAI API fails once then succeeds', async () => {
    mockOpenAI.chat.completions.create = vi.fn()
      .mockRejectedValueOnce(new Error('API error'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Hallo' } }]
      });
    const promise = service.translate('Hello', 'en', 'de');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('Hallo');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it('should only retry on specific error codes (429, 500+)', async () => {
    const error429 = new Error('Rate limit');
    // @ts-ignore
    error429.status = 429;
    mockOpenAI.chat.completions.create = vi.fn()
      .mockRejectedValueOnce(error429)
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Ciao' } }]
      });
    const promise = service.translate('Hello', 'en', 'it');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('Ciao');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(2);
  });

  it('should not retry on error with status 400', async () => {
    const error400 = new Error('Bad request');
    // @ts-ignore
    error400.status = 400;
    mockOpenAI.chat.completions.create = vi.fn().mockRejectedValueOnce(error400);
    const result = await service.translate('Hello', 'en', 'es');
    expect(result).toBe('');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(1);
  });

  it('should retry on error with status 0 (unknown)', async () => {
    const error0 = new Error('Unknown error');
    // @ts-ignore
    error0.status = 0;
    mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue(error0);
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBe('');
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalledTimes(4);
  });

  it('should log errors during translation', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockOpenAI.chat.completions.create = vi.fn().mockRejectedValue(new Error('API error'));
    const promise = service.translate('Hello', 'en', 'es');
    await vi.runAllTimersAsync();
    await promise;
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('should log success during translation', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    mockOpenAI.chat.completions.create = vi.fn().mockResolvedValueOnce({
      choices: [{ message: { content: 'Hola' } }]
    });
    await service.translate('Hello', 'en', 'es');
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});