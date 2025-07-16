import logger from '../logger';
import { config } from '../config';
import { eq, and, lt, gt } from 'drizzle-orm';
import { sessions } from '../../shared/schema';
import { db } from '../db';

export class SessionCleanupService {
  private cleanupInterval: NodeJS.Timeout | null = null;
  private isExplicitlyStopped = false; // Track if service was explicitly stopped vs never started

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
    }, config.session.cleanupInterval);
  }

  /**
   * Stop the cleanup service
   */
  stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.isExplicitlyStopped = true; // Mark as explicitly stopped
    logger.info('Stopped session cleanup service');
  }

  /**
   * Check if the service is stopped to prevent database operations after shutdown
   */
  private isStopped(): boolean {
    return this.isExplicitlyStopped;
  }

  /**
   * Clean up stale sessions with different timeouts for different scenarios
   */
  async cleanupStaleSessions(): Promise<void> {
    try {
      // Early exit if service is stopped
      if (this.isStopped()) {
        return;
      }

      const now = Date.now();
      
      // Scenario 1: Sessions with no students that have been waiting too long
      await this.cleanupEmptyTeacherSessions(now);
      
      // Scenario 2: General inactivity cleanup (90+ minutes) - broader fallback, higher priority
      await this.cleanupInactiveSessions(now);
      
      // Scenario 3: Sessions where all students left (grace period for recent disconnections) - more specific
      await this.cleanupAbandonedSessions(now);
      
    } catch (error) {
      logger.error('Error during session cleanup:', error);
    }
  }

  /**
   * Clean up sessions where teacher is waiting but no students joined
   */
  private async cleanupEmptyTeacherSessions(now: number): Promise<void> {
    // Early exit if service is stopped
    if (this.isStopped()) {
      return;
    }

    const noStudentsThreshold = new Date(now - config.session.emptyTeacherTimeout);
    
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

    // Check again after database query in case service was stopped during the query
    if (this.isStopped()) {
      return;
    }

    if (emptySessions.length > 0) {
      logger.info(`Found ${emptySessions.length} empty teacher sessions to clean up`);

      await db
        .update(sessions)
        .set({
          isActive: false,
          endTime: new Date(),
          quality: 'no_students',
          qualityReason: `No students joined within ${config.session.emptyTeacherTimeout / 60000} minutes`
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
    // Early exit if service is stopped
    if (this.isStopped()) {
      return;
    }

    const abandonedThreshold = new Date(now - config.session.allStudentsLeftTimeout);
    const staleThreshold = new Date(now - config.session.staleSessionTimeout);
    
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

    // Check again after database query in case service was stopped during the query
    if (this.isStopped()) {
      return;
    }

    if (abandonedSessions.length > 0) {
      logger.info(`Found ${abandonedSessions.length} potentially abandoned sessions to clean up`);

      await db
        .update(sessions)
        .set({
          isActive: false,
          endTime: new Date(),
          quality: 'no_activity',
          qualityReason: `All students disconnected, no activity for ${config.session.allStudentsLeftTimeout / 60000} minutes`
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
    // Early exit if service is stopped
    if (this.isStopped()) {
      return;
    }

    const staleThreshold = new Date(now - config.session.staleSessionTimeout);
    
    const staleSessions = await db
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.isActive, true),
          lt(sessions.lastActivityAt, staleThreshold)
        )
      );

    // Check again after database query in case service was stopped during the query
    if (this.isStopped()) {
      return;
    }

    if (staleSessions.length > 0) {
      logger.info(`Found ${staleSessions.length} long-term inactive sessions to clean up`);

      await db
        .update(sessions)
        .set({
          isActive: false,
          endTime: new Date(),
          quality: 'no_activity',
          qualityReason: `Session inactive for ${config.session.staleSessionTimeoutUnscaled / 60000} minutes`
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
    // Early exit if service is stopped
    if (this.isStopped()) {
      return;
    }

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
    // Early exit if service is stopped
    if (this.isStopped()) {
      return;
    }

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
    // Early exit if service is stopped
    if (this.isStopped()) {
      return;
    }

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

  /**
   * Find the most recent active session for a teacher by language
   * This helps prevent duplicate sessions when teachers reconnect
   */
  async findActiveTeacherSession(teacherLanguage: string): Promise<any | null> {
    if (this.isStopped()) {
      return null;
    }

    try {
      const recentSessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.isActive, true),
            eq(sessions.teacherLanguage, teacherLanguage),
            // Only sessions that are recent enough (within teacher reconnection grace period)
            gt(sessions.lastActivityAt, new Date(Date.now() - config.session.teacherReconnectionGracePeriod))
          )
        )
        .orderBy(sessions.lastActivityAt)
        .limit(1);

      return recentSessions.length > 0 ? recentSessions[0] : null;
    } catch (error) {
      logger.error('Error finding active teacher session:', { teacherLanguage, error });
      return null;
    }
  }

  /**
   * End duplicate or orphaned sessions for the same teacher
   * Called when a teacher creates a new session to clean up old ones
   */
  async endDuplicateTeacherSessions(currentSessionId: string, teacherLanguage: string): Promise<void> {
    if (this.isStopped()) {
      return;
    }

    try {
      // First, get all active sessions for this teacher language
      const allTeacherSessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.isActive, true),
            eq(sessions.teacherLanguage, teacherLanguage)
          )
        );

      // Filter out the current session to find duplicates
      const duplicateSessions = allTeacherSessions.filter((session: any) => session.sessionId !== currentSessionId);

      if (duplicateSessions.length > 0) {
        logger.info(`Found ${duplicateSessions.length} duplicate teacher sessions to clean up for language ${teacherLanguage}`);

        // End each duplicate session individually
        for (const session of duplicateSessions) {
          await db
            .update(sessions)
            .set({
              isActive: false,
              endTime: new Date(),
              quality: 'no_activity',
              qualityReason: 'Duplicate session - teacher created new session'
            })
            .where(eq(sessions.sessionId, session.sessionId));
        }

        logger.info(`Ended ${duplicateSessions.length} duplicate teacher sessions`);
      }
    } catch (error) {
      logger.error('Error ending duplicate teacher sessions:', { currentSessionId, teacherLanguage, error });
    }
  }

  /**
   * Migrate students from an old session to a new session
   * This helps when a teacher reconnects and creates a new classroom code
   */
  async migrateOrphanedStudents(newSessionId: string, teacherLanguage: string): Promise<number> {
    if (this.isStopped()) {
      return 0;
    }

    // Implementation would require additional database schema to track student-session relationships
    // For now, we log this for monitoring purposes
    logger.info(`Migration of orphaned students would be handled here for session ${newSessionId}, teacher language ${teacherLanguage}`);
    return 0;
  }


}
