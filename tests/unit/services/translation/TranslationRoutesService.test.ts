/**
 * TranslationRoutesService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranslationRoutesService } from '../../../../server/services/translation/TranslationRoutesService';
import { createMockStorage } from '../../../mocks/storage.mock';

// Mock storage interface
const mockStorage = createMockStorage();

describe('TranslationRoutesService', () => {
  let translationService: TranslationRoutesService;

  beforeEach(() => {
    vi.clearAllMocks();
    translationService = new TranslationRoutesService(mockStorage);
  });

  describe('saveTranslation', () => {
    it('should save translation successfully with valid data', async () => {
      const translationData = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        latency: 150
      };

      const mockSavedTranslation = { id: 1, ...translationData, createdAt: new Date() };
      (mockStorage.addTranslation as any).mockResolvedValue(mockSavedTranslation);

      const result = await translationService.saveTranslation(translationData);

      expect(mockStorage.addTranslation).toHaveBeenCalledWith({
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        latency: 150
      });
      expect(result).toEqual(mockSavedTranslation);
    });

    it('should trim whitespace from text fields', async () => {
      const translationData = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: '  Hello world  ',
        translatedText: '  Hola mundo  ',
        latency: 150
      };

      const mockSavedTranslation = { id: 1, createdAt: new Date() };
      (mockStorage.addTranslation as any).mockResolvedValue(mockSavedTranslation);

      await translationService.saveTranslation(translationData);

      expect(mockStorage.addTranslation).toHaveBeenCalledWith({
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        latency: 150
      });
    });

    it('should use default latency of 0 when not provided', async () => {
      const translationData = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello world',
        translatedText: 'Hola mundo'
      };

      const mockSavedTranslation = { id: 1, createdAt: new Date() };
      (mockStorage.addTranslation as any).mockResolvedValue(mockSavedTranslation);

      await translationService.saveTranslation(translationData);

      expect(mockStorage.addTranslation).toHaveBeenCalledWith({
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello world',
        translatedText: 'Hola mundo',
        latency: 0
      });
    });

    it('should throw error when originalText is empty', async () => {
      const translationData = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: '   ',
        translatedText: 'Hola mundo'
      };

      await expect(translationService.saveTranslation(translationData))
        .rejects.toThrow('originalText cannot be empty');

      expect(mockStorage.addTranslation).not.toHaveBeenCalled();
    });

    it('should throw error when translatedText is empty', async () => {
      const translationData = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello world',
        translatedText: '   '
      };

      await expect(translationService.saveTranslation(translationData))
        .rejects.toThrow('translatedText cannot be empty');

      expect(mockStorage.addTranslation).not.toHaveBeenCalled();
    });

    it('should handle storage errors', async () => {
      const translationData = {
        sourceLanguage: 'en',
        targetLanguage: 'es',
        originalText: 'Hello world',
        translatedText: 'Hola mundo'
      };

      const error = new Error('Database connection failed');
      (mockStorage.addTranslation as any).mockRejectedValue(error);

      await expect(translationService.saveTranslation(translationData))
        .rejects.toThrow('Database connection failed');
    });
  });

  describe('getTranslationsByLanguage', () => {
    it('should retrieve translations by language with limit', async () => {
      const mockTranslations = [
        { id: 1, targetLanguage: 'es', originalText: 'Hello', translatedText: 'Hola' },
        { id: 2, targetLanguage: 'es', originalText: 'World', translatedText: 'Mundo' }
      ];

      (mockStorage.getTranslationsByLanguage as any).mockResolvedValue(mockTranslations);

      const result = await translationService.getTranslationsByLanguage('es', 10);

      expect(mockStorage.getTranslationsByLanguage).toHaveBeenCalledWith('es', 10);
      expect(result).toEqual(mockTranslations);
    });

    it('should retrieve translations without limit when not specified', async () => {
      const mockTranslations = [
        { id: 1, targetLanguage: 'fr', originalText: 'Hello', translatedText: 'Bonjour' }
      ];

      (mockStorage.getTranslationsByLanguage as any).mockResolvedValue(mockTranslations);

      const result = await translationService.getTranslationsByLanguage('fr');

      expect(mockStorage.getTranslationsByLanguage).toHaveBeenCalledWith('fr', undefined);
      expect(result).toEqual(mockTranslations);
    });

    it('should return empty array when no translations found', async () => {
      (mockStorage.getTranslationsByLanguage as any).mockResolvedValue([]);

      const result = await translationService.getTranslationsByLanguage('de', 5);

      expect(result).toEqual([]);
    });

    it('should handle storage errors', async () => {
      const error = new Error('Database query failed');
      (mockStorage.getTranslationsByLanguage as any).mockRejectedValue(error);

      await expect(translationService.getTranslationsByLanguage('es', 10))
        .rejects.toThrow('Database query failed');
    });
  });
});
