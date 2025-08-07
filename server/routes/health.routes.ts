/**
 * Health & Diagnostics Routes
 * 
 * Endpoints for system health monitoring and diagnostics
 */

import { Router, Request, Response } from 'express';
import { IStorage } from '../storage.interface';
import { IActiveSessionProvider } from '../services/session/IActiveSessionProvider';
import { asyncHandler } from '../middleware/error-handler.middleware';

// Constants
const API_VERSION = '1.0.0';

export function createHealthRoutes(
  storage: IStorage,
  activeSessionProvider: IActiveSessionProvider
): Router {
  const router = Router();

  /**
   * Basic health check endpoint
   * GET /health
   */
  const healthCheck = asyncHandler(async (req: Request, res: Response) => {
    // Check database/storage connectivity
    let dbStatus = 'unknown';
    try {
      await storage.getLanguages(); // Simple query to check connectivity
      dbStatus = 'connected';
    } catch (e) {
      dbStatus = 'disconnected';
    }

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: API_VERSION,
      database: dbStatus,
      environment: process.env.NODE_ENV || 'development',
      activeSessions: activeSessionProvider.getActiveSessionsCount(),
      activeTeachers: activeSessionProvider.getActiveTeacherCount(),
      activeStudents: activeSessionProvider.getActiveStudentCount()
    });
  });

  /**
   * Test endpoint for debugging
   * GET /test
   */
  const testEndpoint = (req: Request, res: Response) => {
    res.json({
      message: 'API is working',
      timestamp: new Date().toISOString(),
      version: API_VERSION
    });
  };

  // Register routes
  router.get('/health', healthCheck);
  router.get('/test', testEndpoint);

  return router;
}
