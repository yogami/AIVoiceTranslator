/**
 * Routes Index
 * 
 * Main router assembly - combines all route modules
 */

import { Router } from 'express';
import { IStorage } from '../storage.interface.js';
import { IActiveSessionProvider } from '../services/IActiveSessionProvider.js';
import { SessionCleanupService } from '../services/SessionCleanupService.js';
// Business logic services
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AnalyticsService } from '../services/AnalyticsService.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { LanguageService } from '../services/LanguageService.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TranslationRoutesService } from '../services/TranslationRoutesService.js';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TranscriptService } from '../services/TranscriptService.js';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const sessionCleanupService = new SessionCleanupService();

// Import route modules
import { createHealthRoutes } from './health.routes.js';
import { createClassroomRoutes } from './classroom.routes.js';
import { createAnalyticsRoutes } from './analytics.routes.js';
import { createLanguageRoutes } from './languages.routes.js';
import { createTranslationRoutes } from './translations.routes.js';
import { createTranscriptRoutes } from './transcripts.routes.js';
import { createSessionRoutes } from './sessions.routes.js';
import authRoutes from './auth.js';

// Import error handling
import { apiErrorHandler } from '../middleware/error-handler.middleware.js';

export function createApiRoutes(
  storage: IStorage,
  activeSessionProvider: IActiveSessionProvider,
  sessionCleanupService?: SessionCleanupService
): Router {
  const router = Router();

  // Mount route modules
  router.use('/', createHealthRoutes(storage, activeSessionProvider));
  router.use('/', createClassroomRoutes());
  router.use('/', createAnalyticsRoutes());
  router.use('/', createLanguageRoutes(storage));
  router.use('/', createTranslationRoutes(storage));
  router.use('/', createTranscriptRoutes(storage));
  router.use('/', createSessionRoutes(storage, activeSessionProvider));
  
  // Auth routes (existing)
  router.use('/auth', authRoutes);

  // Apply error handling middleware
  router.use(apiErrorHandler);

  return router;
}
