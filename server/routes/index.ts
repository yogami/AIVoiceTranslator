/**
 * Routes Index
 * 
 * Main router assembly - combines all route modules
 */

import { Router } from 'express';
import { DatabaseStorage } from '../database-storage';
import { IStorage } from '../storage.interface';
import { IActiveSessionProvider } from '../services/session/IActiveSessionProvider';
import { UnifiedSessionCleanupService } from '../services/session/cleanup/UnifiedSessionCleanupService';
// Business logic services
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { AnalyticsService } from '../services/AnalyticsService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { LanguageService } from '../services/LanguageService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TranslationRoutesService } from '../services/translation/TranslationRoutesService';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { TranscriptService } from '../services/stttranscription/TranscriptService';

const storage = new DatabaseStorage();
const classroomSessionsMap = new Map(); // Empty map for routes context
const sessionCleanupService = new UnifiedSessionCleanupService(storage, classroomSessionsMap);

// Import route modules
import { createHealthRoutes } from './health.routes';
import { createClassroomRoutes } from './classroom.routes';
import { createAnalyticsRoutes } from './analytics.routes';
import { createLanguageRoutes } from './languages.routes';
import { createTranslationRoutes } from './translations.routes';
import { createTranscriptRoutes } from './transcripts.routes';
import { createSessionRoutes } from './sessions.routes';
import authRoutes from './auth';

// Import error handling
import { apiErrorHandler } from '../middleware/error-handler.middleware';

export function createApiRoutes(
  storage: IStorage,
  activeSessionProvider: IActiveSessionProvider,
  sessionCleanupService?: UnifiedSessionCleanupService
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
