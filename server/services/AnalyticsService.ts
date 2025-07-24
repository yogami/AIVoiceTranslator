/**
 * Analytics Service
 * 
 * Business logic for analytics queries and OpenAI integration
 */

import OpenAI from 'openai';
import { sql } from 'drizzle-orm';
import { sessions } from '../../shared/schema.js';
import { db } from '../db.js';

export interface AnalyticsStats {
  activeSessions: number;
  totalSessions: number;
  recentSessions: number;
  sessionsToday: number;
  uniqueStudents: number;
  currentlyActiveStudents: number;
  averageSessionDuration: number;
  completedSessions: number;
}

export class AnalyticsService {
  private openai: OpenAI;

  constructor() {
    // Initialize OpenAI client
    try {
      this.openai = new OpenAI({ 
        apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder-for-initialization-only' 
      });
    } catch (error) {
      console.error('Error initializing OpenAI client for analytics:', error);
      this.openai = new OpenAI({ apiKey: 'sk-placeholder-for-initialization-only' });
    }
  }

  /**
   * Gather comprehensive analytics statistics from the database
   */
  async gatherAnalyticsStats(): Promise<AnalyticsStats> {
    // Get basic session counts
    const sessionStats = await db.select({
      totalSessions: sql<number>`COUNT(*)`,
      activeSessions: sql<number>`COUNT(CASE WHEN ${sessions.isActive} = true THEN 1 END)`,
      sessionsToday: sql<number>`COUNT(CASE WHEN DATE(start_time) = CURRENT_DATE THEN 1 END)`,
      recentSessions24h: sql<number>`COUNT(CASE WHEN start_time >= NOW() - INTERVAL '24 hours' THEN 1 END)`
    }).from(sessions);

    // Get student statistics
    const studentStats = await db.select({
      totalStudentConnections: sql<number>`SUM(COALESCE(students_count, 0))`,
      avgStudentsPerSession: sql<number>`AVG(COALESCE(students_count, 0))`,
      maxStudentsInSession: sql<number>`MAX(students_count)`,
      currentlyActiveStudents: sql<number>`SUM(CASE WHEN is_active = true THEN COALESCE(students_count, 0) ELSE 0 END)`
    }).from(sessions);

    // Get duration statistics from completed sessions
    const durationStats = await db.select({
      avgDurationSeconds: sql<number>`AVG(EXTRACT(EPOCH FROM (end_time - start_time)))`,
      completedSessions: sql<number>`COUNT(*)`
    }).from(sessions).where(sql`end_time IS NOT NULL AND start_time IS NOT NULL`);

    // Parse results with null checking
    const sessionData = sessionStats[0] || {};
    const studentData = studentStats[0] || {};
    const durationData = durationStats[0] || {};

    return {
      activeSessions: Number(sessionData.activeSessions || 0),
      totalSessions: Number(sessionData.totalSessions || 0),
      recentSessions: Number(sessionData.recentSessions24h || 0),
      sessionsToday: Number(sessionData.sessionsToday || 0),
      uniqueStudents: Number(studentData.totalStudentConnections || 0),
      currentlyActiveStudents: Number(studentData.currentlyActiveStudents || 0),
      averageSessionDuration: Number(durationData.avgDurationSeconds || 0),
      completedSessions: Number(durationData.completedSessions || 0)
    };
  }

  /**
   * Process natural language queries using OpenAI with database schema awareness
   */
  async processNaturalLanguageQuery(question: string, stats: AnalyticsStats): Promise<string> {
    try {
      if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'sk-placeholder-for-initialization-only') {
        return `I understand you're asking about "${question}". Based on the current data: ${stats.totalSessions} total sessions, ${stats.activeSessions} active sessions, ${stats.sessionsToday} sessions today, and ${stats.uniqueStudents} total student connections.`;
      }

      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are an AI assistant helping analyze AI Voice Translator system analytics. 

Available data fields:
- activeSessions: ${stats.activeSessions} (currently running sessions)
- totalSessions: ${stats.totalSessions} (all sessions ever created)
- sessionsToday: ${stats.sessionsToday} (sessions started today)
- uniqueStudents: ${stats.uniqueStudents} (total student connections across all sessions)
- currentlyActiveStudents: ${stats.currentlyActiveStudents} (students in currently active sessions)
- averageSessionDuration: ${Math.round(stats.averageSessionDuration / 60)} minutes
- completedSessions: ${stats.completedSessions} (sessions that have ended)

Answer the user's question clearly and directly based on this data. Be concise and helpful.`
          },
          {
            role: 'user', 
            content: question
          }
        ],
        max_tokens: 150,
        temperature: 0.1
      });

      return completion.choices[0]?.message?.content || `Based on the current data: ${stats.totalSessions} total sessions, ${stats.activeSessions} active sessions, and ${stats.uniqueStudents} total student connections.`;
    } catch (error) {
      console.error('Error processing natural language query with OpenAI:', error);
      return `I understand you're asking: "${question}". Current stats: ${stats.totalSessions} total sessions, ${stats.activeSessions} active sessions, ${stats.sessionsToday} sessions today, ${stats.uniqueStudents} total students, and ${Math.round(stats.averageSessionDuration / 60)} minutes average duration.`;
    }
  }

  /**
   * Get debug database information
   */
  async getDebugDatabaseInfo() {
    // Get all sessions
    const allSessions = await db.select().from(sessions);
    
    // Get raw counts
    const activeSessions = await db.select({
      count: sql<number>`COUNT(*)`
    }).from(sessions).where(sql`is_active = true`);
    
    const totalStudents = await db.select({
      total: sql<number>`SUM(students_count)`
    }).from(sessions);
    
    return {
      allSessions: allSessions,
      activeSessions: activeSessions[0],
      totalStudents: totalStudents[0],
      message: 'Database debug info'
    };
  }
}
