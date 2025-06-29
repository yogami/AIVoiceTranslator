import logger from '../logger';
import { eq, and, lt, gt } from 'drizzle-orm';
import { sessions } from '../../shared/schema';
import { db } from '../db';

export class SessionCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly STALE_SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes - general inactivity
  private readonly NO_STUDENTS_TIMEOUT = 10 * 60 * 1000; // 10 minutes - teacher waiting for students
  private readonly ALL_STUDENTS_LEFT_TIMEOUT = 5 * 60 * 1000; // 5 minutes - grace period after all students leave
  private readonly CLEANUP_INTERVAL = 2 * 60 * 1000; // 2 minutes - check more frequently

  constructor() {}

  /**
   * Start the periodic cleanup service
   */
  start(): void {
    if (this.cleanupInterval) {
      return; // Already started
    }

    logger.info('Starting session cleanup service');
    
    // Run cleanup immediately
    this.cleanupStaleSessions();
    
    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleSessions();
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
      logger.info('Stopped session cleanup service');
    }
  }

  /**
   * Clean up stale sessions with different timeouts for different scenarios
   */
  async cleanupStaleSessions(): Promise<void> {
    try {
      const now = Date.now();
      
      // Scenario 1: Sessions with no students that have been waiting too long
      await this.cleanupEmptyTeacherSessions(now);
      
      // Scenario 2: General inactivity cleanup (30+ minutes) - takes precedence
      await this.cleanupInactiveSessions(now);
      
      // Scenario 3: Sessions where all students left (grace period for recent disconnections)
      await this.cleanupAbandonedSessions(now);
      
    } catch (error) {
      logger.error('Error during session cleanup:', error);
    }
  }

  /**
   * Clean up sessions where teacher is waiting but no students joined
   */
  private async cleanupEmptyTeacherSessions(now: number): Promise<void> {
    const noStudentsThreshold = new Date(now - this.NO_STUDENTS_TIMEOUT);
    
    const emptySessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.isActive, true),
          eq(sessions.studentsCount, 0), // No students ever joined
          lt(sessions.startTime, noStudentsThreshold)
        )
      );

    if (emptySessions.length > 0) {
      logger.info(`Found ${emptySessions.length} empty teacher sessions to clean up`);

      await db
        .update(sessions)
        .set({
          isActive: false,
          endTime: new Date(),
          quality: 'no_students',
          qualityReason: `No students joined within ${this.NO_STUDENTS_TIMEOUT / 60000} minutes`
        })
        .where(
          and(
            eq(sessions.isActive, true),
            eq(sessions.studentsCount, 0),
            lt(sessions.startTime, noStudentsThreshold)
          )
        );

      logger.info(`Cleaned up ${emptySessions.length} empty teacher sessions`);
    }
  }

  /**
   * Clean up sessions where all students left (grace period for reconnection)
   */
  private async cleanupAbandonedSessions(now: number): Promise<void> {
    const abandonedThreshold = new Date(now - this.ALL_STUDENTS_LEFT_TIMEOUT);
    const staleThreshold = new Date(now - this.STALE_SESSION_TIMEOUT);
    
    // Find sessions that had students but haven't been active recently
    // and likely all students have disconnected, but not old enough for general inactivity cleanup
    const abandonedSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.isActive, true),
          gt(sessions.studentsCount, 0), // Had students at some point
          lt(sessions.lastActivityAt, abandonedThreshold), // Inactive for 5+ minutes
          gt(sessions.lastActivityAt, staleThreshold) // But not inactive for 30+ minutes (handled by cleanupInactiveSessions)
        )
      );

    if (abandonedSessions.length > 0) {
      logger.info(`Found ${abandonedSessions.length} potentially abandoned sessions to clean up`);

      await db
        .update(sessions)
        .set({
          isActive: false,
          endTime: new Date(),
          quality: 'no_activity',
          qualityReason: `All students disconnected, no activity for ${this.ALL_STUDENTS_LEFT_TIMEOUT / 60000} minutes`
        })
        .where(
          and(
            eq(sessions.isActive, true),
            gt(sessions.studentsCount, 0),
            lt(sessions.lastActivityAt, abandonedThreshold),
            gt(sessions.lastActivityAt, staleThreshold)
          )
        );

      logger.info(`Cleaned up ${abandonedSessions.length} abandoned sessions`);
    }
  }

  /**
   * Clean up sessions with general long-term inactivity
   */
  private async cleanupInactiveSessions(now: number): Promise<void> {
    const staleThreshold = new Date(now - this.STALE_SESSION_TIMEOUT);
    
    const staleSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.isActive, true),
          lt(sessions.lastActivityAt, staleThreshold)
        )
      );

    if (staleSessions.length > 0) {
      logger.info(`Found ${staleSessions.length} long-term inactive sessions to clean up`);

      await db
        .update(sessions)
        .set({
          isActive: false,
          endTime: new Date(),
          quality: 'no_activity',
          qualityReason: `Session inactive for ${this.STALE_SESSION_TIMEOUT / 60000} minutes`
        })
        .where(
          and(
            eq(sessions.isActive, true),
            lt(sessions.lastActivityAt, staleThreshold)
          )
        );

      logger.info(`Cleaned up ${staleSessions.length} long-term inactive sessions`);
    }
  }

  /**
   * Update last activity time for a session
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await db
        .update(sessions)
        .set({
          lastActivityAt: new Date()
        })
        .where(eq(sessions.sessionId, sessionId));
    } catch (error) {
      logger.error('Error updating session activity:', { sessionId, error });
    }
  }

  /**
   * Mark a specific session as ended (e.g., when user disconnects)
   */
  async endSession(sessionId: string, reason: string = 'User disconnected'): Promise<void> {
    try {
      const endTime = new Date();
      await db
        .update(sessions)
        .set({
          isActive: false,
          endTime: endTime,
          quality: 'no_activity',
          qualityReason: reason
        })
        .where(
          and(
            eq(sessions.sessionId, sessionId),
            eq(sessions.isActive, true)
          )
        );

      logger.info(`Ended session ${sessionId}: ${reason}`);
    } catch (error) {
      logger.error('Error ending session:', { sessionId, reason, error });
    }
  }

  /**
   * Clean up sessions older than a certain age (for housekeeping)
   */
  async cleanupOldSessions(daysOld: number = 30): Promise<void> {
    try {
      const oldThreshold = new Date(Date.now() - (daysOld * 24 * 60 * 60 * 1000));
      
      // For now, just mark them with a special quality
      await db
        .update(sessions)
        .set({
          quality: 'no_activity',
          qualityReason: `Session older than ${daysOld} days - archived`
        })
        .where(
          and(
            eq(sessions.isActive, false),
            lt(sessions.startTime, oldThreshold)
          )
        );

      logger.info(`Archived sessions older than ${daysOld} days`);
    } catch (error) {
      logger.error('Error archiving old sessions:', error);
    }
  }

  /**
   * Mark that all students have left a session (start grace period)
   * This should be called when the last student disconnects
   */
  async markAllStudentsLeft(sessionId: string): Promise<void> {
    try {
      // Update lastActivityAt to current time to start the grace period countdown
      await db
        .update(sessions)
        .set({
          lastActivityAt: new Date(),
          qualityReason: 'All students disconnected - grace period active'
        })
        .where(
          and(
            eq(sessions.sessionId, sessionId),
            eq(sessions.isActive, true)
          )
        );

      logger.info(`Marked session ${sessionId} as all students left - grace period started`);
    } catch (error) {
      logger.error('Error marking session as students left:', { sessionId, error });
    }
  }

  /**
   * Mark that students have rejoined a session (cancel grace period)
   */
  async markStudentsRejoined(sessionId: string): Promise<void> {
    try {
      await db
        .update(sessions)
        .set({
          lastActivityAt: new Date(),
          qualityReason: null // Clear the grace period marker
        })
        .where(
          and(
            eq(sessions.sessionId, sessionId),
            eq(sessions.isActive, true)
          )
        );

      logger.info(`Students rejoined session ${sessionId} - grace period cancelled`);
    } catch (error) {
      logger.error('Error marking students rejoined:', { sessionId, error });
    }
  }
}
