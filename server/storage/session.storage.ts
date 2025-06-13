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

export interface ISessionStorage {
  createSession(session: InsertSession): Promise<Session>;
  updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<Session | undefined>;
  getActiveSession(sessionId: string): Promise<Session | undefined>;
  getAllActiveSessions(): Promise<Session[]>;
  endSession(sessionId: string): Promise<Session | undefined>;
  getRecentSessionActivity(limit?: number): Promise<{
    sessionId: string;
    teacherLanguage: string | null;
    transcriptCount: number;
    startTime: Date | null;
    endTime: Date | null;
    duration: number;
  }[]>;
  getSessionById(sessionId: string): Promise<Session | undefined>; // New method
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
      teacherLanguage: insertSession.teacherLanguage ?? null,
      startTime: new Date(),
      endTime: null,
      studentsCount: insertSession.studentsCount ?? null,
      totalTranslations: insertSession.totalTranslations ?? null,
      averageLatency: insertSession.averageLatency ?? null,
      isActive: insertSession.isActive ?? true
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

  async getRecentSessionActivity(limit: number = 5) {
    const recentSessions = Array.from(this.sessions.values())
      .sort((a: Session, b: Session) => {
        const aTime = a.startTime ? new Date(a.startTime).getTime() : 0;
        const bTime = b.startTime ? new Date(b.startTime).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);

    return recentSessions.map((s: Session) => {
      const transcriptCount = Array.from(this.transcripts.values())
        .filter((t: Transcript) => t.sessionId === s.sessionId).length;
      const duration = s.startTime && s.endTime
        ? new Date(s.endTime).getTime() - new Date(s.startTime).getTime()
        : 0;
      return {
        sessionId: s.sessionId,
        teacherLanguage: s.teacherLanguage,
        transcriptCount,
        startTime: s.startTime,
        endTime: s.endTime,
        duration
      };
    });
  }

  async getSessionById(sessionId: string): Promise<Session | undefined> {
    return Array.from(this.sessions.values()).find(s => s.sessionId === sessionId);
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
      const result = await db // db from ../db
        .update(sessions) // sessions from ../../shared/schema
        .set(updates)
        .where(eq(sessions.sessionId, sessionId)) // eq from drizzle-orm, sessions from ../../shared/schema
        .returning();
      return result[0];
    } catch (error: any) {
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

  async getRecentSessionActivity(limit: number = 5) {
    try {
      type ActivityRow = {
        sessionId: string;
        teacherLanguage: string | null;
        transcriptCount: number; // This will be a number due to .mapWith(Number)
        startTime: Date | null;
        endTime: Date | null;
      };

      // Use dbSql for raw SQL parts if needed, or drizzleCount for aggregates
      const activityResults: ActivityRow[] = await db // db from ../db
        .select({
          sessionId: sessions.sessionId, // sessions from ../../shared/schema
          teacherLanguage: sessions.teacherLanguage,
          transcriptCount: drizzleCount(transcripts.id).mapWith(Number), // drizzleCount from drizzle-orm, transcripts from ../../shared/schema
          startTime: sessions.startTime,
          endTime: sessions.endTime,
        })
        .from(sessions) // sessions from ../../shared/schema
        .leftJoin(transcripts, eq(sessions.sessionId, transcripts.sessionId)) // transcripts, eq from drizzle-orm, sessions from ../../shared/schema
        .groupBy(
          sessions.id, 
          sessions.sessionId, 
          sessions.teacherLanguage, 
          sessions.startTime, 
          sessions.endTime
        )
        .orderBy(desc(sessions.startTime)) // desc from drizzle-orm, sessions from ../../shared/schema
        .limit(limit);

      return activityResults.map((row: ActivityRow) => ({
        ...row,
        duration: row.startTime && row.endTime
          ? new Date(row.endTime).getTime() - new Date(row.startTime).getTime()
          : 0,
      }));
    } catch (error: any) {
      if (error instanceof StorageError) throw error;
      throw new StorageError(`Failed to get recent session activity: ${error.message}`, StorageErrorCode.STORAGE_ERROR, error);
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
}