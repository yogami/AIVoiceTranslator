/**
 * Transcript Routes
 * 
 * Endpoints for transcript management
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../middleware/error-handler.middleware.js';
import { validateRequiredFields } from '../middleware/validation.middleware.js';
import { TranscriptService } from '../services/stttranscription/TranscriptService';
import { IStorage } from '../storage.interface.js';

export function createTranscriptRoutes(storage: IStorage): Router {
  const router = Router();
  const transcriptService = new TranscriptService(storage);

  /**
   * Save a new transcript
   * POST /transcripts
   */
  const saveTranscript = asyncHandler(async (req: Request, res: Response) => {
    validateRequiredFields(req.body, ['sessionId', 'language', 'text']);

    const { sessionId, language, text } = req.body;

    try {
      const transcript = await transcriptService.saveTranscript({
        sessionId,
        language,
        text
      });

      res.status(201).json(transcript);
    } catch (error) {
      if (error instanceof Error && error.message.includes('cannot be empty')) {
        throw new ApiError(400, error.message);
      }
      throw error;
    }
  });

  /**
   * Get transcripts by session and language
   * GET /transcripts/:sessionId/:language
   */
  const getTranscriptsBySession = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId, language } = req.params;

    const transcripts = await transcriptService.getTranscriptsBySession(sessionId, language);

    res.json(transcripts);
  });

  // Register routes
  router.post('/transcripts', saveTranscript);
  router.get('/transcripts/:sessionId/:language', getTranscriptsBySession);

  return router;
}
