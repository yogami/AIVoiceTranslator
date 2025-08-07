/**
 * Analytics Routes
 * 
 * Endpoints for analytics queries and system insights
 */

import { Router, Request, Response } from 'express';
import { asyncHandler, ApiError } from '../middleware/error-handler.middleware';
import { AnalyticsService } from '../services/AnalyticsService';
import { 
  analyticsRateLimit, 
  analyticsSecurityMiddleware, 
  analyticsPageAuth 
} from '../middleware/analytics-security';
import { db } from '../db';
import { sessions } from '../../shared/schema';
import { sql } from 'drizzle-orm';

export function createAnalyticsRoutes(): Router {
  const router = Router();
  const analyticsService = new AnalyticsService();

  /**
   * Handle natural language analytics queries
   * POST /analytics/query
   */
  const handleAnalyticsQuery = asyncHandler(async (req: Request, res: Response) => {
    const { question } = req.body;
    
    if (!question || typeof question !== 'string') {
      throw new ApiError(400, 'Question is required and must be a string');
    }

    // Gather analytics statistics
    const stats = await analyticsService.gatherAnalyticsStats();

    // Use OpenAI to intelligently process the natural language query
    const answer = await analyticsService.processNaturalLanguageQuery(question, stats);

    // Return structured response for analytics
    const response = {
      success: true,
      answer: answer,
      data: stats,
      question
    };
    res.json(response);
  });

  /**
   * Simple test endpoint for debugging
   * POST /analytics/test
   */
  const testAnalyticsQuery = asyncHandler(async (req: Request, res: Response) => {
    const { question } = req.body;
    
    console.log('🔍 DEBUG: Test analytics endpoint hit with question:', question);
    
    const response = {
      success: true,
      answer: 'Test response with success field',
      data: { test: true },
      question
    };
    
    res.json(response);
  });

  /**
   * Debug endpoint to see raw database data
   * GET /debug/database
   */
  const debugDatabase = asyncHandler(async (req: Request, res: Response) => {
    console.log('🔍 DEBUG: Database debug endpoint hit');
    
    const debugInfo = await analyticsService.getDebugDatabaseInfo();
    
    const response = {
      success: true,
      ...debugInfo
    };
    
    res.json(response);
  });

  // Register routes with security middleware
  router.post('/analytics/query', 
    analyticsRateLimit, 
    analyticsSecurityMiddleware, 
    analyticsPageAuth, 
    handleAnalyticsQuery
  );
  
  router.post('/analytics/ask', 
    analyticsRateLimit, 
    analyticsSecurityMiddleware, 
    analyticsPageAuth, 
    handleAnalyticsQuery
  ); // Alias for client compatibility
  
  router.post('/analytics/test', 
    analyticsRateLimit, 
    analyticsSecurityMiddleware, 
    analyticsPageAuth, 
    testAnalyticsQuery
  ); // Test endpoint
  
  router.get('/debug/database', analyticsPageAuth, debugDatabase); // Debug endpoint

  // New meaningful analytics endpoints - Protected with auth and rate limiting but NOT security middleware
  router.get('/analytics/active-sessions', analyticsPageAuth, analyticsRateLimit, getActiveSessionsNow);
  router.get('/analytics/sessions-this-week', analyticsPageAuth, analyticsRateLimit, getSessionsThisWeek);
  router.get('/analytics/translations-per-session', analyticsPageAuth, analyticsRateLimit, getTranslationsPerSession);
  router.get('/analytics/peak-hours', analyticsPageAuth, analyticsRateLimit, getPeakUsageHours);

  /**
   * Get currently active sessions
   */
  async function getActiveSessionsNow(req: Request, res: Response) {
    try {
      const activeSessionsResult = await db.select({
        count: sql<number>`COUNT(*)`,
        sessionIds: sql<string[]>`ARRAY_AGG(session_id)`,
        teacherIds: sql<string[]>`ARRAY_AGG(teacher_id::text)`,
        classCodes: sql<string[]>`ARRAY_AGG(class_code)`
      }).from(sessions).where(sql`is_active = true`);

      const result = activeSessionsResult[0];
      const sqlQuery = `SELECT COUNT(*) as count, ARRAY_AGG(session_id) as session_ids, 
                        ARRAY_AGG(teacher_id::text) as teacher_ids, ARRAY_AGG(class_code) as class_codes 
                        FROM sessions WHERE is_active = true`;

      res.json({
        success: true,
        data: {
          activeSessionsCount: Number(result.count || 0),
          sessionIds: result.sessionIds || [],
          teacherIds: result.teacherIds || [],
          classCodes: result.classCodes || []
        },
        sql: sqlQuery,
        description: 'Shows currently active teaching sessions'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get active sessions' });
    }
  }

  /**
   * Get sessions from this week
   */
  async function getSessionsThisWeek(req: Request, res: Response) {
    try {
      // Get all sessions from the last 7 days with all needed fields
      const sessionsRes = await db.select({
        sessionId: sql<string>`session_id`,
        startTime: sql<string>`start_time`,
        lastActivityAt: sql<string>`last_activity_at`,
        studentsCount: sql<number>`students_count`,
        teacherId: sql<string>`teacher_id`,
        classCode: sql<string>`class_code`,
        totalTranslations: sql<number>`total_translations`
      }).from(sessions).where(sql`start_time >= CURRENT_DATE - INTERVAL '7 days'`);

      let totalStudents = 0;
      let totalDuration = 0;
      let sessionCount = sessionsRes.length;
      let weeklySessionDetails: any[] = [];
      sessionsRes.forEach((s: { studentsCount?: number; startTime?: string; lastActivityAt?: string; sessionId?: string; teacherId?: string; classCode?: string; totalTranslations?: number }) => {
        totalStudents += typeof s.studentsCount === 'number' ? s.studentsCount : 0;
        if (s.startTime && s.lastActivityAt) {
          const start = new Date(s.startTime).getTime();
          const end = new Date(s.lastActivityAt).getTime();
          if (end > start) {
            totalDuration += (end - start) / 1000; // seconds
          }
        }
        weeklySessionDetails.push({
          sessionId: s.sessionId,
          teacherId: s.teacherId,
          classCode: s.classCode,
          startTime: s.startTime,
          lastActivityAt: s.lastActivityAt,
          studentsCount: s.studentsCount,
          totalTranslations: s.totalTranslations
        });
      });
      const avgStudents = sessionCount > 0 ? Math.round((totalStudents / sessionCount) * 10) / 10 : 0;
      const avgSessionDuration = sessionCount > 0 ? Math.round(totalDuration / sessionCount) : 0;

      // Get session counts for today and week
      const sessionCounts = await db.select({
        count: sql<number>`COUNT(*)`,
        todayCount: sql<number>`COUNT(CASE WHEN DATE(start_time) = CURRENT_DATE THEN 1 END)`,
        last7Days: sql<number>`COUNT(CASE WHEN start_time >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END)`
      }).from(sessions);
      const result = sessionCounts[0];
      const sqlQuery = `SELECT COUNT(*) as total_sessions,
                        COUNT(CASE WHEN DATE(start_time) = CURRENT_DATE THEN 1 END) as today_sessions,
                        COUNT(CASE WHEN start_time >= CURRENT_DATE - INTERVAL '7 days' THEN 1 END) as week_sessions
                        FROM sessions`;

      res.json({
        success: true,
        data: {
          totalSessions: Number(result.count || 0),
          sessionsToday: Number(result.todayCount || 0),
          sessionsThisWeek: Number(result.last7Days || 0),
          averageStudentsPerSession: avgStudents,
          averageSessionDurationSeconds: avgSessionDuration,
          weeklySessionDetails
        },
        sql: sqlQuery,
        description: 'Sessions created in the last 7 days vs today vs all time, with averages'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get weekly sessions' });
    }
  }

  /**
   * Get average translations per session
   */
  async function getTranslationsPerSession(req: Request, res: Response) {
    try {
      const translationStatsResult = await db.select({
        avgTranslations: sql<number>`AVG(COALESCE(total_translations, 0))`,
        totalTranslations: sql<number>`SUM(COALESCE(total_translations, 0))`,
        sessionsWithTranslations: sql<number>`COUNT(CASE WHEN total_translations > 0 THEN 1 END)`,
        topSessions: sql<any>`ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'sessionId', session_id,
            'classCode', class_code,
            'translations', total_translations,
            'students', students_count,
            'startTime', start_time
          ) ORDER BY total_translations DESC
        ) FILTER (WHERE total_translations > 0)`
      }).from(sessions);

      const result = translationStatsResult[0];
      const sqlQuery = `SELECT AVG(COALESCE(total_translations, 0)) as avg_translations,
                        SUM(COALESCE(total_translations, 0)) as total_translations,
                        COUNT(CASE WHEN total_translations > 0 THEN 1 END) as active_sessions
                        FROM sessions`;

      res.json({
        success: true,
        data: {
          averageTranslationsPerSession: Math.round(Number(result.avgTranslations || 0) * 10) / 10,
          totalTranslationsAllTime: Number(result.totalTranslations || 0),
          sessionsWithActivity: Number(result.sessionsWithTranslations || 0),
          topActiveSessions: (result.topSessions || []).slice(0, 5)
        },
        sql: sqlQuery,
        description: 'Translation activity across all sessions - shows actual usage'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get translation stats' });
    }
  }

  /**
   * Get peak usage hours based on session start times
   */
  async function getPeakUsageHours(req: Request, res: Response) {
    try {
      const peakHoursResult = await db.select({
        hourlyDistribution: sql<any>`ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'hour', EXTRACT(HOUR FROM start_time),
            'count', COUNT(*)
          )
        )`
      }).from(sessions)
        .groupBy(sql`EXTRACT(HOUR FROM start_time)`)
        .orderBy(sql`COUNT(*) DESC`);

      // Get connection events from today (if we had a connections table, but we can approximate with sessions)
      const todayActivityResult = await db.select({
        connectionsToday: sql<number>`COUNT(*)`,
        peakHour: sql<number>`EXTRACT(HOUR FROM start_time)`,
        todaySessions: sql<any>`ARRAY_AGG(
          JSON_BUILD_OBJECT(
            'hour', EXTRACT(HOUR FROM start_time),
            'classCode', class_code,
            'students', students_count
          ) ORDER BY start_time DESC
        )`
      }).from(sessions)
        .where(sql`DATE(start_time) = CURRENT_DATE`)
        .groupBy(sql`EXTRACT(HOUR FROM start_time)`)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(1);

      const hourlyData = peakHoursResult[0];
      const todayData = todayActivityResult[0];
      const sqlQuery = `SELECT EXTRACT(HOUR FROM start_time) as hour, COUNT(*) as sessions
                        FROM sessions 
                        GROUP BY EXTRACT(HOUR FROM start_time) 
                        ORDER BY COUNT(*) DESC`;

      res.json({
        success: true,
        data: {
          peakHour: Number(todayData?.peakHour || 0),
          connectionsToday: Number(todayData?.connectionsToday || 0),
          hourlyDistribution: hourlyData?.hourlyDistribution || [],
          todayActivity: todayData?.todaySessions || []
        },
        sql: sqlQuery,
        description: 'Shows when teachers are most active (peak hours for starting sessions)'
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to get peak hours' });
    }
  }

  return router;
}
