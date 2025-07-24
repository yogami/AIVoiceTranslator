/**
 * Language Routes
 * 
 * Endpoints for language management
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../middleware/error-handler.middleware.js';
import { LanguageService } from '../services/LanguageService.js';
import { IStorage } from '../storage.interface.js';

export function createLanguageRoutes(storage: IStorage): Router {
  const router = Router();
  const languageService = new LanguageService(storage);

  /**
   * Get all available languages
   * GET /languages
   */
  const getLanguages = asyncHandler(async (req: Request, res: Response) => {
    const languages = await languageService.getAllLanguages();
    res.json(languages);
  });

  /**
   * Get only active languages
   * GET /languages/active
   */
  const getActiveLanguages = asyncHandler(async (req: Request, res: Response) => {
    const activeLanguages = await languageService.getActiveLanguages();
    res.json(activeLanguages);
  });

  /**
   * Update language status
   * PATCH /languages/:code/status
   */
  const updateLanguageStatus = asyncHandler(async (req: Request, res: Response) => {
    const { code } = req.params;
    const { isActive } = req.body;

    if (typeof isActive !== 'boolean') {
      throw new ApiError(400, 'isActive must be a boolean value');
    }

    try {
      const updatedLanguage = await languageService.updateLanguageStatus(code, isActive);
      res.json(updatedLanguage);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not found')) {
        throw new ApiError(404, error.message);
      }
      throw error;
    }
  });

  // Register routes
  router.get('/languages', getLanguages);
  router.get('/languages/active', getActiveLanguages);
  router.patch('/languages/:code/status', updateLanguageStatus);

  return router;
}
