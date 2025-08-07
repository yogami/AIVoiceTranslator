import {
  type Session,
  type InsertSession,
  type Transcript,
  sessions,      // Actual schema from shared/schema
  transcripts    // Actual schema from shared/schema
} from '../../shared/schema'; // Correct: Import schemas directly
import { db, sql as dbSql } from '../db'; // Import db instance and sql from ../db
// Import Drizzle operators directly from drizzle-orm
import { eq, and, or, desc, count as drizzleCount, gt, gte, SQL } from 'drizzle-orm'; 
import { StorageError, StorageErrorCode } from '../storage.error';
import logger from '../logger'; // Add logger import

export const DEFAULT_SESSION_QUERY_LIMIT = 10;

export type SessionActivity = {
  sessionId: string;
  teacherLanguage: string | null;
  studentLanguage: string | null;
  classCode: string | null;
  transcriptCount: number;
  studentCount: number;
  startTime: Date | null;
  endTime: Date | null;
  duration: number;
};

export interface ISessionStorage {
  createSession(session: InsertSession): Promise<Session>;
  updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined>;
  getActiveSession(sessionId: string): Promise<Session | undefined>;
  getAllActiveSessions(): Promise<Session[]>;
  getCurrentlyActiveSessions(): Promise<Session[]>;
  endSession(sessionId: string): Promise<Session | undefined>;
  getRecentSessionActivity(limit?: number, hoursBack?: number): Promise<SessionActivity[]>;
  getSessionById(sessionId: string): Promise<Session | undefined>;
  getTranscriptCountBySession(sessionId: string): Promise<number>;
  findActiveSessionByTeacherId(teacherId: string): Promise<Session | null>;
  findRecentSessionByTeacherId(teacherId: string, withinMinutes?: number): Promise<Session | null>;
  reactivateSession(sessionId: string): Promise<Session | null>;
  getSessionQualityStats(): Promise<{
    total: number;
    real: number; 
    dead: number;
    breakdown: Record<string, number>;
  }>;
}

export class MemSessionStorage implements ISessionStorage {
  private readonly sessions: Map<number, Session>;
  private idCounter: { value: number };
  private readonly transcripts: Map<number, Transcript>;

  constructor(sessions: Map<number, Session>, idCounter: { value: number }, transcripts: Map<number, Transcript>) {
    this.sessions = sessions;
    this.idCounter = idCounter;
    this.transcripts = transcripts;
    if (this.sessions.size > 0) {
      const maxId = Math.max(...Array.from(this.sessions.keys()));
      this.idCounter.value = Math.max(this.idCounter.value, maxId + 1);
    }
  }

  protected validateSessionInput(sessionData: InsertSession): void {
    if (!sessionData.sessionId) {
      throw new StorageError('Session ID is required', StorageErrorCode.VALIDATION_ERROR);
    }
    if (!sessionData.teacherId) {
      throw new StorageError('Teacher ID is required', StorageErrorCode.VALIDATION_ERROR);
    }
    // Add other validation rules as needed
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    this.validateSessionInput(insertSession);
    const id = this.idCounter.value++;
    const session: Session = {
      id,
      sessionId: insertSession.sessionId,
      teacherId: insertSession.teacherId ?? null,
      classCode: insertSession.classCode ?? null,
      teacherLanguage: insertSession.teacherLanguage ?? null,
      studentLanguage: insertSession.studentLanguage ?? null,
      startTime: null, // Don't set startTime at creation - will be set when first student joins
      endTime: null,
      studentsCount: insertSession.studentsCount ?? 0, // Ensure default is 0, not null
      totalTranslations: insertSession.totalTranslations ?? 0, // Default to 0
      averageLatency: insertSession.averageLatency ?? null, // Keep as null for new sessions
      isActive: insertSession.isActive ?? true,
      quality: insertSession.quality ?? 'unknown',
      qualityReason: insertSession.qualityReason ?? null,
      lastActivityAt: insertSession.lastActivityAt ?? new Date()
    };
    this.sessions.set(id, session);
    return session;
  }

  async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    const session = Array.from(this.sessions.values()).find(s => s.sessionId === sessionId);
    if (!session) {
      return undefined;
    }
    const updatedSession: Session = { ...session, ...updates };
    this.sessions.set(session.id, updatedSession);
    return updatedSession;
  }

  async getActiveSession(sessionId: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(s => s.sessionId === sessionId && s.isActive);
  }

  async getAllActiveSessions(): Promise<Session[]> {
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  async getCurrentlyActiveSessions(): Promise<Session[]> {
    // Return only active sessions (isActive implies students are present)
    return Array.from(this.sessions.values()).filter(s => s.isActive);
  }

  async endSession(sessionId: string): Promise<Session | undefined> {
    const session = await this.getActiveSession(sessionId); // Uses getActiveSession which checks isActive
    if (!session) {
      return undefined; // Session not found or not active
    }
    const updatedSession: Session = {
      ...session,
      endTime: new Date(),
      isActive: false
    };
    this.sessions.set(session.id, updatedSession);
    return updatedSession;
  }

  async getRecentSessionActivity(limit: number = 5, hoursBack: number = 24): Promise<SessionActivity[]> { // Update return type to SessionActivity[]
    // Calculate the cutoff time for "recent" activity
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

    const recentSessions = Array.from(this.sessions.values())
      .filter((s: Session) => {
        // Timeline filter: sessions that started within the specified time range OR are currently active
        const withinTimeRange = s.startTime ? new Date(s.startTime).getTime() >= cutoffTime.getTime() : false;
        const isCurrentlyActive = s.isActive;
        
        // Activity filter: active sessions with students OR sessions with translations
        const hasStudents = (s.studentsCount ?? 0) > 0;
        const hasTranslations = (s.totalTranslations ?? 0) > 0;
        const hasActivity = (s.isActive && hasStudents) || hasTranslations;
        
        // Include sessions that:
        // 1. Are within time range AND have activity, OR
        // 2. Are currently active (regardless of time, but must have activity)
        return hasActivity && (withinTimeRange || isCurrentlyActive);
      })
      .sort((a: Session, b: Session) => {
        // For sessions without startTime (no students joined yet), use lastActivityAt for sorting
        const aTime = a.startTime ? new Date(a.startTime).getTime() : (a.lastActivityAt ? new Date(a.lastActivityAt).getTime() : 0);
        const bTime = b.startTime ? new Date(b.startTime).getTime() : (b.lastActivityAt ? new Date(b.lastActivityAt).getTime() : 0);
        return bTime - aTime; // Sort by startTime or lastActivityAt descending
      })
      .slice(0, limit);

    return recentSessions.map((s: Session) => {
      const transcriptCount = s.totalTranslations ?? 0; // Use the stored totalTranslations for performance
      const duration = s.startTime && s.endTime
        ? new Date(s.endTime).getTime() - new Date(s.startTime).getTime()
        : (s.startTime && s.isActive ? Date.now() - new Date(s.startTime).getTime() : 0); // Calculate duration for active sessions
      return {
        sessionId: s.sessionId,
        teacherLanguage: s.teacherLanguage,
        studentLanguage: s.studentLanguage,
        classCode: s.classCode,
        transcriptCount,
        studentCount: s.studentsCount ?? 0, // Added studentCount
        startTime: s.startTime,
        endTime: s.endTime,
        duration
      };
    });
  }

  async getSessionById(sessionId: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(s => s.sessionId === sessionId);
  }

  async getTranscriptCountBySession(sessionId: string): Promise<number> {
    const transcriptsForSession = Array.from(this.transcripts.values())
      .filter(t => t.sessionId === sessionId);
    return transcriptsForSession.length;
  }

  async getSessionQualityStats(): Promise<{
    total: number;
    real: number; 
    dead: number;
    breakdown: Record<string, number>;
  }> {
    const breakdown: Record<string, number> = {};
    let total = 0;
    let real = 0;
    let dead = 0;

    for (const session of this.sessions.values()) {
      const quality = session.quality || 'unknown';
      breakdown[quality] = (breakdown[quality] || 0) + 1;
      total++;
      
      if (quality === 'real') {
        real++;
      } else if (['no_students', 'no_activity', 'too_short'].includes(quality)) {
        dead++;
      }
    }

    return { total, real, dead, breakdown };
  }

  async findActiveSessionByTeacherId(teacherId: string): Promise<Session | null> {
    const session = Array.from(this.sessions.values()).find(s => 
      s.teacherId === teacherId && s.isActive
    );
    return session || null;
  }

  async findRecentSessionByTeacherId(teacherId: string, withinMinutes: number = 10): Promise<Session | null> {
    const cutoffTime = new Date();
    cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes);
    
    // Find the most recent ENDED session for this teacher (not active sessions)
    const sessions = Array.from(this.sessions.values())
      .filter(s => s.teacherId === teacherId)
      .filter(s => {
        // Only include inactive (ended) sessions
        if (s.isActive) return false;
        
        // For ended sessions, prioritize endTime over lastActivityAt
        const activityTime = s.endTime || s.lastActivityAt;
        return activityTime && new Date(activityTime).getTime() >= cutoffTime.getTime();
      })
      .sort((a, b) => {
        // Sort by most recent activity (prioritize endTime for ended sessions)
        const aTime = a.endTime || a.lastActivityAt || new Date(0);
        const bTime = b.endTime || b.lastActivityAt || new Date(0);
        return new Date(bTime).getTime() - new Date(aTime).getTime();
      });
    
    return sessions[0] || null;
  }

  async reactivateSession(sessionId: string): Promise<Session | null> {
    const session = Array.from(this.sessions.values()).find(s => s.sessionId === sessionId);
    if (!session) {
      return null;
    }
    
    // Only reactivate if session is currently inactive
    if (session.isActive) {
      return null;
    }
    
    const reactivatedSession: Session = {
      ...session,
      isActive: true,
      endTime: null,
      lastActivityAt: new Date()
    };
    
    this.sessions.set(session.id, reactivatedSession);
    return reactivatedSession;
  }
}

export class DbSessionStorage implements ISessionStorage {
  protected validateSessionInput(sessionData: InsertSession): void {
    if (!sessionData.sessionId) {
      throw new StorageError('Session ID is required', StorageErrorCode.VALIDATION_ERROR);
    }
    if (!sessionData.teacherId) {
      throw new StorageError('Teacher ID is required', StorageErrorCode.VALIDATION_ERROR);
    }
    // Add other validation rules as needed
  }

  async createSession(session: InsertSession): Promise<Session> {
    this.validateSessionInput(session);
    try {
      const result = await db
        .insert(sessions)
        .values({
          ...session,
          // Use application server time for consistent timing across the application
          startTime: new Date(),
          lastActivityAt: new Date(),
          endTime: null,
          isActive: session.isActive ?? true
        })
        .returning();
      if (!result[0]) {
        throw new StorageError('Failed to create session', StorageErrorCode.CREATE_FAILED);
      }
      return result[0];
    } catch (error: any) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(`Failed to create session: ${error.message}`, StorageErrorCode.CREATE_FAILED, error);
    }
  }

  async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    try {
      const result = await db // db from ../db
        .update(sessions) // sessions from ../../shared/schema
        .set(updates)
        .where(eq(sessions.sessionId, sessionId)) // eq from drizzle-orm, sessions from ../../shared/schema
        .returning();
      
      return result[0];
    } catch (error: any) {
      logger.error('Failed to update session activity', {
        sessionId,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw new StorageError(`Failed to update session ${sessionId}: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async getActiveSession(sessionId: string): Promise<Session | undefined> {
    try {
      const result = await db // db from ../db
        .select()
        .from(sessions) // sessions from ../../shared/schema
        .where(and( // and, eq from drizzle-orm, sessions from ../../shared/schema
          eq(sessions.sessionId, sessionId),
          eq(sessions.isActive, true)
        ))
        .limit(1);
      return result[0];
    } catch (error: any) {
      logger.error('Failed to get active session', {
        sessionId,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw new StorageError(`Failed to get active session ${sessionId}: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async getAllActiveSessions(): Promise<Session[]> {
    try {
      return await db // db from ../db
        .select()
        .from(sessions) // sessions from ../../shared/schema
        .where(eq(sessions.isActive, true)); // eq from drizzle-orm, sessions from ../../shared/schema
    } catch (error: any) {
      logger.error('Failed to get all active sessions', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw new StorageError(`Failed to get all active sessions: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async getCurrentlyActiveSessions(): Promise<Session[]> {
    // Return only active sessions (isActive implies students are present)
    try {
      return await db
        .select()
        .from(sessions)
        .where(eq(sessions.isActive, true));
    } catch (error: any) {
      logger.error('Failed to get currently active sessions', {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw new StorageError(`Failed to get currently active sessions: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async endSession(sessionId: string): Promise<Session | undefined> {
    try {
      const result = await db // db from ../db
        .update(sessions) // sessions from ../../shared/schema
        .set({
          endTime: new Date(),
          isActive: false
        })
        .where(and( // and, eq from drizzle-orm, sessions from ../../shared/schema
          eq(sessions.sessionId, sessionId),
          eq(sessions.isActive, true) 
        ))
        .returning();
      return result[0];
    } catch (error: any) {
      logger.error('Failed to end session', {
        sessionId,
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined
      });
      throw new StorageError(`Failed to end session: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async getRecentSessionActivity(limit: number = DEFAULT_SESSION_QUERY_LIMIT, hoursBack: number = 24): Promise<SessionActivity[]> { // Update return type to SessionActivity[]
    try {
      // Calculate the cutoff time for "recent" activity
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - hoursBack);

      // Subquery to count transcripts per session
      const transcriptCountsSubquery = db
        .select({
          sq_sessionId: transcripts.sessionId, // Aliased to avoid conflicts and for clarity
          num_transcripts: drizzleCount(transcripts.id).as('num_transcripts'), // Aggregate aliased by key
        })
        .from(transcripts)
        .groupBy(transcripts.sessionId) // Group by the original column
        .as('transcript_counts'); // Alias for the subquery itself

      const recentSessionsData = await db
        .select({
          sessionId: sessions.sessionId,
          teacherLanguage: sessions.teacherLanguage,
          studentLanguage: sessions.studentLanguage,
          classCode: sessions.classCode,
          studentsCount: sessions.studentsCount,
          startTime: sessions.startTime,
          endTime: sessions.endTime,
          isActive: sessions.isActive, // Include isActive to calculate duration for active sessions
          transcriptCount: transcriptCountsSubquery.num_transcripts, // Use the aliased aggregate from subquery
        })
        .from(sessions)
        .leftJoin(
          transcriptCountsSubquery,
          eq(sessions.sessionId, transcriptCountsSubquery.sq_sessionId) // Join using the aliased sessionId from subquery
        )
        .where(and(
          // Timeline filter: sessions that started within the specified time range OR are currently active
          or(
            gte(sessions.startTime, cutoffTime),
            eq(sessions.isActive, true)
          ),
          // Activity filter: active sessions with students OR sessions with translations
          or(
            and(
              eq(sessions.isActive, true), // Active sessions
              gt(sessions.studentsCount, 0) // With at least one student
            ),
            gt(sessions.totalTranslations, 0) // Or completed sessions with at least one translation
          )
        ))
        .orderBy(desc(sessions.startTime))
        .limit(limit);

      return recentSessionsData.map((s: {
        sessionId: string;
        teacherLanguage: string | null;
        studentLanguage: string | null;
        classCode: string | null;
        studentsCount: number | null;
        startTime: Date | null;
        endTime: Date | null;
        isActive: boolean | null;
        transcriptCount: number | null;
      }) => {
        const duration = s.startTime && s.endTime
          ? new Date(s.endTime).getTime() - new Date(s.startTime).getTime()
          : (s.startTime && s.isActive ? Date.now() - new Date(s.startTime).getTime() : 0);
        return {
          sessionId: s.sessionId,
          teacherLanguage: s.teacherLanguage,
          studentLanguage: s.studentLanguage,
          classCode: s.classCode,
          transcriptCount: s.transcriptCount || 0,
          studentCount: s.studentsCount ?? 0,
          startTime: s.startTime,
          endTime: s.endTime,
          duration,
        };
      });
    } catch (error: any) {
      console.error('[DbSessionStorage.getRecentSessionActivity] Error:', error);
      throw new StorageError(
        `Failed to get recent session activity: ${error.message}`,
        StorageErrorCode.STORAGE_ERROR,
        error
      );
    }
  }

  async getSessionById(sessionId: string): Promise<Session | undefined> {
    try {
      const result = await db
        .select()
        .from(sessions)
        .where(eq(sessions.sessionId, sessionId))
        .limit(1);
      return result[0];
    } catch (error: any) {
      throw new StorageError(`Failed to get session by ID ${sessionId}: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async getTranscriptCountBySession(sessionId: string): Promise<number> {
    try {
      const result = await db
        .select({ count: drizzleCount(transcripts.id) })
        .from(transcripts)
        .where(eq(transcripts.sessionId, sessionId));
      
      return result[0]?.count ? Number(result[0].count) : 0;
    } catch (error: any) {
      throw new StorageError(`Failed to get transcript count for session ${sessionId}: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async getSessionQualityStats(): Promise<{
    total: number;
    real: number; 
    dead: number;
    breakdown: Record<string, number>;
  }> {
    try {
      const result = await db
        .select({
          quality: sessions.quality,
          count: drizzleCount(sessions.id)
        })
        .from(sessions)
        .where(dbSql`${sessions.quality} IS NOT NULL`)
        .groupBy(sessions.quality);

      const breakdown: Record<string, number> = {};
      let total = 0;
      let real = 0;
      let dead = 0;

      for (const row of result) {
        const quality = row.quality || 'unknown';
        const count = Number(row.count) || 0;
        breakdown[quality] = count;
        total += count;
        
        if (quality === 'real') {
          real += count;
        } else if (['no_students', 'no_activity', 'too_short'].includes(quality)) {
          dead += count;
        }
      }

      return { total, real, dead, breakdown };
    } catch (error: any) {
      throw new StorageError(`Failed to get session quality stats: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async findActiveSessionByTeacherId(teacherId: string): Promise<Session | null> {
    try {
      if (!teacherId) {
        logger.info('[DbSessionStorage] No teacherId provided to findActiveSessionByTeacherId');
        return null;
      }
      
      logger.info(`[DbSessionStorage] Searching for active session with teacherId: ${teacherId}`);
      
      // Use individual condition queries instead of 'and' to debug
      const allSessions = await db.select().from(sessions);
      logger.info(`[DbSessionStorage] Total sessions in DB: ${allSessions.length}`);
      
      const sessionsWithTeacherId = allSessions.filter((s: Session) => s.teacherId === teacherId);
      logger.info(`[DbSessionStorage] Sessions with teacherId ${teacherId}: ${sessionsWithTeacherId.length}`);
      
      const activeSessions = sessionsWithTeacherId.filter((s: Session) => s.isActive);
      logger.info(`[DbSessionStorage] Active sessions with teacherId ${teacherId}: ${activeSessions.length}`);
      
      const activeSession = activeSessions[0] || null;
      
      if (activeSession) {
        logger.info(`[DbSessionStorage] Found active session for teacherId: ${teacherId}`, {
          sessionId: activeSession.sessionId,
          isActive: activeSession.isActive,
          classCode: activeSession.classCode
        });
      } else {
        logger.info(`[DbSessionStorage] No active session found for teacherId: ${teacherId}`);
      }
      
      return activeSession;
    } catch (error: any) {
      logger.error(`[DbSessionStorage] Error in findActiveSessionByTeacherId for teacherId ${teacherId}:`, {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        code: error.code,
        detail: error.detail
      });
      return null; // Always return null on error to allow graceful fallback
    }
  }

  async findRecentSessionByTeacherId(teacherId: string, withinMinutes: number = 10): Promise<Session | null> {
    try {
      logger.info(`[DbSessionStorage] Finding recent session for teacherId: ${teacherId} within ${withinMinutes} minutes`);
      
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - withinMinutes);
      
      const result = await db
        .select()
        .from(sessions)
        .where(and(
          eq(sessions.teacherId, teacherId),
          eq(sessions.isActive, false), // Only inactive (ended) sessions
          or(
            gte(sessions.endTime, cutoffTime),
            gte(sessions.lastActivityAt, cutoffTime)
          )
        ))
        .orderBy(desc(sessions.endTime), desc(sessions.lastActivityAt))
        .limit(1);
      
      logger.info(`[DbSessionStorage] Recent session query result for teacherId ${teacherId}:`, {
        resultCount: result.length,
        session: result[0] ? {
          sessionId: result[0].sessionId,
          teacherId: result[0].teacherId,
          isActive: result[0].isActive,
          lastActivityAt: result[0].lastActivityAt,
          endTime: result[0].endTime
        } : null
      });
      
      return result[0] || null;
    } catch (error: any) {
      logger.error(`[DbSessionStorage] Error in findRecentSessionByTeacherId for ${teacherId}:`, {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        code: error.code,
        details: error
      });
      throw new StorageError(`Failed to find recent session for teacher ${teacherId}: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async reactivateSession(sessionId: string): Promise<Session | null> {
    try {
      logger.info(`[DbSessionStorage] Reactivating session: ${sessionId}`);
      
      const result = await db
        .update(sessions)
        .set({
          isActive: true,
          endTime: null,
          lastActivityAt: new Date()
        })
        .where(and(
          eq(sessions.sessionId, sessionId),
          eq(sessions.isActive, false) // Only reactivate if currently inactive
        ))
        .returning();
      
      if (result[0]) {
        logger.info('[DbSessionStorage] Successfully reactivated session:', {
          sessionId: result[0].sessionId,
          teacherId: result[0].teacherId,
          isActive: result[0].isActive
        });
      } else {
        logger.warn(`[DbSessionStorage] No session found to reactivate: ${sessionId}`);
      }
      
      return result[0] || null;
    } catch (error: any) {
      logger.error(`[DbSessionStorage] Error reactivating session ${sessionId}:`, {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        errorStack: error instanceof Error ? error.stack : undefined,
        code: error.code,
        details: error
      });
      throw new StorageError(`Failed to reactivate session ${sessionId}: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }
}