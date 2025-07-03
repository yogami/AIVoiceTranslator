import {
  type Session,
  type InsertSession,
  type Transcript,
  sessions,      // Actual schema from shared/schema
  transcripts    // Actual schema from shared/schema
} from "../../shared/schema"; // Correct: Import schemas directly
import { db, sql as dbSql } from "../db"; // Import db instance and sql from ../db
// Import Drizzle operators directly from drizzle-orm
import { eq, and, desc, count as drizzleCount, SQL } from "drizzle-orm"; 
import { StorageError, StorageErrorCode } from "../storage.error";

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
  endSession(sessionId: string): Promise<Session | undefined>;
  getRecentSessionActivity(limit?: number): Promise<SessionActivity[]>;
  getSessionById(sessionId: string): Promise<Session | undefined>;
  getTranscriptCountBySession(sessionId: string): Promise<number>;
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
    // Add other validation rules as needed
  }

  async createSession(insertSession: InsertSession): Promise<Session> {
    this.validateSessionInput(insertSession);
    const id = this.idCounter.value++;
    const session: Session = {
      id,
      sessionId: insertSession.sessionId,
      classCode: insertSession.classCode ?? null,
      teacherLanguage: insertSession.teacherLanguage ?? null,
      studentLanguage: insertSession.studentLanguage ?? null,
      startTime: new Date(),
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

  async getRecentSessionActivity(limit: number = 5): Promise<SessionActivity[]> { // Update return type to SessionActivity[]
    const recentSessions = Array.from(this.sessions.values())
      .sort((a: Session, b: Session) => {
        // Ensure startTime is valid before getTime()
        const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
        return bTime - aTime; // Sort by startTime descending
      })
      .slice(0, limit);

    return recentSessions.map((s: Session) => {
      const transcriptCount = Array.from(this.transcripts.values())
        .filter((t: Transcript) => t.sessionId === s.sessionId).length;
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
}

export class DbSessionStorage implements ISessionStorage {
  async createSession(session: InsertSession): Promise<Session> {
    try {
      console.log('[DbSessionStorage.createSession] Attempting to insert session:', {
        sessionId: session.sessionId,
        values: { ...session }
      });
      const result = await db
        .insert(sessions)
        .values({
          ...session,
          startTime: new Date(),
          lastActivityAt: new Date(),
          endTime: null,
          isActive: true
        })
        .returning();
      if (!result[0]) {
        console.error('[DbSessionStorage.createSession] Insert returned no result for sessionId:', session.sessionId);
        throw new StorageError('Failed to create session', StorageErrorCode.CREATE_FAILED);
      }
      console.log('[DbSessionStorage.createSession] Successfully inserted session:', result[0]);
      return result[0];
    } catch (error: any) {
      console.error('[DbSessionStorage.createSession] Error inserting session:', {
        sessionId: session.sessionId,
        error: error && error.message ? error.message : error
      });
      if (error instanceof StorageError) throw error;
      throw new StorageError(`Failed to create session: ${error.message}`, StorageErrorCode.CREATE_FAILED, error);
    }
  }

  async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined> {
    try {
      console.log('[DbSessionStorage.updateSession] Attempting to update session:', { sessionId, updates }); // Added log
      const result = await db // db from ../db
        .update(sessions) // sessions from ../../shared/schema
        .set(updates)
        .where(eq(sessions.sessionId, sessionId)) // eq from drizzle-orm, sessions from ../../shared/schema
        .returning();
      
      if (result[0]) {
        console.log('[DbSessionStorage.updateSession] Successfully updated session:', result[0]); // Added log
      } else {
        console.log('[DbSessionStorage.updateSession] No session found to update:', sessionId); // No session found
      }
      return result[0];
    } catch (error: any) {
      console.error('[DbSessionStorage.updateSession] Error updating session:', { sessionId, updates, error: error && error.message ? error.message : error }); // Added log
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
      throw new StorageError(`Failed to get all active sessions: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
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
      throw new StorageError(`Failed to end session: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
    }
  }

  async getRecentSessionActivity(limit: number = DEFAULT_SESSION_QUERY_LIMIT): Promise<SessionActivity[]> { // Update return type to SessionActivity[]
    try {
      // Subquery to count transcripts per session
      const transcriptCountsSubquery = db
        .select({
          sq_sessionId: transcripts.sessionId, // Aliased to avoid conflicts and for clarity
          num_transcripts: drizzleCount(transcripts.id).as("num_transcripts"), // Aggregate aliased by key
        })
        .from(transcripts)
        .groupBy(transcripts.sessionId) // Group by the original column
        .as("transcript_counts"); // Alias for the subquery itself

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
      console.error("[DbSessionStorage.getRecentSessionActivity] Error:", error);
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
}