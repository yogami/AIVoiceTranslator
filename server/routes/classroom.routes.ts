/**
 * Classroom Routes
 * 
 * Endpoints for classroom joining and management
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../middleware/error-handler.middleware.js';
import { validateClassroomCode } from '../middleware/validation.middleware.js';

export function createClassroomRoutes(): Router {
  const router = Router();

  /**
   * Join classroom by code
   * GET /join/:classCode
   */
  const joinClassroom = asyncHandler(async (req: Request, res: Response) => {
    const { classCode } = req.params;

    if (!validateClassroomCode(classCode)) {
      throw new ApiError(400, 'Invalid classroom code format');
    }

    // Redirect to student interface with classroom parameter
    res.redirect(`/student?code=${classCode}`);
  });

  // Register routes
  router.get('/join/:classCode', joinClassroom);

  return router;
}
