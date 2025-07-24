/**
 * LanguageService Unit Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LanguageService } from '../../../server/services/LanguageService.js';
import { createMockStorage } from '../../mocks/storage.mock.js';
import type { IStorage } from '../../../server/storage.interface.js';

describe('LanguageService', () => {
  let languageService: LanguageService;
  let mockStorage: ReturnType<typeof createMockStorage>;

  beforeEach(() => {
    mockStorage = createMockStorage();
    languageService = new LanguageService(mockStorage);
  });

  describe('getAllLanguages', () => {
    it('should return all languages from storage', async () => {
      const mockLanguages = [
        { id: 1, code: 'en', name: 'English', isActive: true },
        { id: 2, code: 'es', name: 'Spanish', isActive: true },
        { id: 3, code: 'fr', name: 'French', isActive: false }
      ];

      (mockStorage.getLanguages as any).mockResolvedValue(mockLanguages);

      const result = await languageService.getAllLanguages();

      expect(mockStorage.getLanguages).toHaveBeenCalledOnce();
      expect(result).toEqual(mockLanguages);
    });

    it('should handle storage errors', async () => {
      const error = new Error('Storage connection failed');
      (mockStorage.getLanguages as any).mockRejectedValue(error);

      await expect(languageService.getAllLanguages()).rejects.toThrow('Storage connection failed');
    });
  });

  describe('getActiveLanguages', () => {
    it('should return only active languages from storage', async () => {
      const mockActiveLanguages = [
        { id: 1, code: 'en', name: 'English', isActive: true },
        { id: 2, code: 'es', name: 'Spanish', isActive: true }
      ];

      (mockStorage.getActiveLanguages as any).mockResolvedValue(mockActiveLanguages);

      const result = await languageService.getActiveLanguages();

      expect(mockStorage.getActiveLanguages).toHaveBeenCalledOnce();
      expect(result).toEqual(mockActiveLanguages);
    });

    it('should return empty array when no active languages exist', async () => {
      (mockStorage.getActiveLanguages as any).mockResolvedValue([]);

      const result = await languageService.getActiveLanguages();

      expect(result).toEqual([]);
    });
  });

  describe('updateLanguageStatus', () => {
    it('should update language status successfully', async () => {
      const updatedLanguage = { id: 1, code: 'en', name: 'English', isActive: false };
      (mockStorage.updateLanguageStatus as any).mockResolvedValue(updatedLanguage);

      const result = await languageService.updateLanguageStatus('en', false);

      expect(mockStorage.updateLanguageStatus).toHaveBeenCalledWith('en', false);
      expect(result).toEqual(updatedLanguage);
    });

    it('should throw error when language is not found', async () => {
      (mockStorage.updateLanguageStatus as any).mockResolvedValue(null);

      await expect(languageService.updateLanguageStatus('invalid-code', true))
        .rejects.toThrow("Language with code 'invalid-code' not found");

      expect(mockStorage.updateLanguageStatus).toHaveBeenCalledWith('invalid-code', true);
    });

    it('should handle storage errors during update', async () => {
      const error = new Error('Database update failed');
      (mockStorage.updateLanguageStatus as any).mockRejectedValue(error);

      await expect(languageService.updateLanguageStatus('en', true))
        .rejects.toThrow('Database update failed');
    });
  });
});
