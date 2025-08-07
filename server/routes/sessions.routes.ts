/**
 * Session Routes
 * 
 * Endpoints for session status and management
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../middleware/error-handler.middleware';
import { IStorage } from '../storage.interface';
import { IActiveSessionProvider } from '../services/session/IActiveSessionProvider';

// Language name mapping for display
const LANGUAGE_NAMES: Record<string, string> = {
  'en-US': 'English (United States)',
  'en-GB': 'English (United Kingdom)',
  'en-AU': 'English (Australia)',
  'en-CA': 'English (Canada)',
  'es-ES': 'Spanish (Spain)',
  'es-MX': 'Spanish (Mexico)',
  'es-AR': 'Spanish (Argentina)',
  'fr-FR': 'French (France)',
  'fr-CA': 'French (Canada)',
  'de-DE': 'German (Germany)',
  'it-IT': 'Italian (Italy)',
  'pt-PT': 'Portuguese (Portugal)',
  'pt-BR': 'Portuguese (Brazil)',
  'ru-RU': 'Russian (Russia)',
  'zh-CN': 'Chinese (Simplified)',
  'zh-TW': 'Chinese (Traditional)',
  'ja-JP': 'Japanese (Japan)',
  'ko-KR': 'Korean (Korea)',
  'hi-IN': 'Hindi (India)',
  'ar-SA': 'Arabic (Saudi Arabia)',
  'th-TH': 'Thai (Thailand)',
  'vi-VN': 'Vietnamese (Vietnam)',
  'nl-NL': 'Dutch (Netherlands)',
  'sv-SE': 'Swedish (Sweden)',
  'da-DK': 'Danish (Denmark)',
  'no-NO': 'Norwegian (Norway)',
  'fi-FI': 'Finnish (Finland)',
  'pl-PL': 'Polish (Poland)',
  'tr-TR': 'Turkish (Turkey)',
  'el-GR': 'Greek (Greece)',
  'he-IL': 'Hebrew (Israel)',
  'en': 'English (Default)'
};

interface LanguageBreakdown {
  languageCode: string;
  languageName: string;
  studentCount: number;
  percentage: number;
}

interface SessionStatusResponse {
  success: boolean;
  data: {
    sessionId: string;
    classCode: string | null;
    connectedStudents: number;
    languages: LanguageBreakdown[];
    lastUpdated: string;
  };
}

export function createSessionRoutes(
  storage: IStorage,
  activeSessionProvider: IActiveSessionProvider
): Router {
  const router = Router();

  /**
   * Get session status with connected students and language breakdown
   * GET /api/sessions/:sessionId/status
   */
    const getSessionStatus = asyncHandler(async (req: Request, res: Response) => {
    const { sessionId } = req.params;

    if (!sessionId) {
      throw new ApiError(400, 'Session ID is required');
    }

    // Get session from database
    const session = await storage.getSessionById(sessionId);
    if (!session) {
      throw new ApiError(404, 'Session not found');
    }

    // Check if activeSessionProvider has the _connectionManager getter
    if (!activeSessionProvider || typeof (activeSessionProvider as any)._connectionManager !== 'object') {
      throw new ApiError(500, 'Connection manager not available');
    }

    // Use the activeSessionProvider (WebSocketServer) to access ConnectionManager
    const connectionManager = (activeSessionProvider as any)._connectionManager;
    const connectionStats = connectionManager.getStudentConnectionsAndLanguagesForSession(sessionId);

    // Calculate language breakdown with percentages
    const languageCount = connectionStats.languages.reduce((acc: Record<string, number>, lang: string) => {
      acc[lang] = (acc[lang] || 0) + 1;
      return acc;
    }, {});

    const languageStats = Object.entries(languageCount).map(([lang, count]) => {
      const percentage = ((Number(count) / connectionStats.languages.length) * 100).toFixed(1);
      return {
        languageCode: lang,
        languageName: LANGUAGE_NAMES[lang] || lang,
        studentCount: Number(count),
        percentage: parseFloat(percentage)
      };
    });

    const response: SessionStatusResponse = {
      success: true,  
      data: {
        sessionId,
        classCode: session.classCode,
        connectedStudents: connectionStats.connections.length,
        languages: languageStats,
        lastUpdated: new Date().toISOString()
      }
    };

    res.json(response);
  });

  /**
   * Get all active sessions summary (for debugging/admin)
   * GET /api/sessions/active
   */
  const getActiveSessions = asyncHandler(async (req: Request, res: Response) => {
    // Check if activeSessionProvider has the _connectionManager getter
    if (!activeSessionProvider || typeof (activeSessionProvider as any)._connectionManager !== 'object') {
      throw new ApiError(500, 'Connection manager not available');
    }

    const connectionManager = (activeSessionProvider as any)._connectionManager;
    const activeSessionIds = connectionManager.getActiveSessionIds();
    const sessions = [];

    for (const sessionId of activeSessionIds) {
      try {
        const session = await storage.getSessionById(sessionId);
        if (session) {
          const stats = connectionManager.getStudentConnectionsAndLanguagesForSession(sessionId);
          sessions.push({
            sessionId,
            classCode: session.classCode,
            connectedStudents: stats.connections.length,
            languages: Array.from(new Set(stats.languages)),
            isActive: session.isActive
          });
        }
      } catch (error) {
        // Skip sessions that can't be loaded
        continue;
      }
    }

    res.json({
      success: true,
      data: {
        activeSessions: sessions,
        totalActiveSessions: sessions.length,
        lastUpdated: new Date().toISOString()
      }
    });
  });

  // Register routes
  router.get('/sessions/:sessionId/status', getSessionStatus);
  router.get('/sessions/active', getActiveSessions);

  return router;
}
