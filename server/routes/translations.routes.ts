/**
 * Translation Routes
 * 
 * Endpoints for translation management
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../middleware/error-handler.middleware';
import { validateRequiredFields, parseLimit } from '../middleware/validation.middleware';
import { TranslationRoutesService } from '../services/translation/TranslationRoutesService';
import { IStorage } from '../storage.interface';

export function createTranslationRoutes(storage: IStorage): Router {
  const router = Router();
  const translationService = new TranslationRoutesService(storage);

  /**
   * Save a new translation
   * POST /translations
   */
  const saveTranslation = asyncHandler(async (req: Request, res: Response) => {
    validateRequiredFields(req.body, ['sourceLanguage', 'targetLanguage', 'originalText', 'translatedText']);

    const { sourceLanguage, targetLanguage, originalText, translatedText, latency } = req.body;

    try {
      const translation = await translationService.saveTranslation({
        sourceLanguage,
        targetLanguage,
        originalText,
        translatedText,
        latency
      });

      res.status(201).json(translation);
    } catch (error) {
      if (error instanceof Error && error.message.includes('cannot be empty')) {
        throw new ApiError(400, error.message);
      }
      throw error;
    }
  });

  /**
   * Get translations by target language
   * GET /translations/language/:language
   */
  const getTranslationsByLanguage = asyncHandler(async (req: Request, res: Response) => {
    const { language } = req.params;
    const limit = parseLimit(req.query.limit as string);

    const translations = await translationService.getTranslationsByLanguage(language, limit);

    res.json(translations);
  });

  // Register routes
  router.post('/translations', saveTranslation);
  router.get('/translations/language/:language', getTranslationsByLanguage);

  return router;
}
