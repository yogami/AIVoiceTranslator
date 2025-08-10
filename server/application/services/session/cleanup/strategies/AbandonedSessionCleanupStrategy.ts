import logger from '../../../../../logger';
import { config } from '../../../../../config';
import { eq, and, lt, gt, isNotNull, inArray } from 'drizzle-orm';
import { sessions, type Session } from '../../../../../../shared/schema';
import { db } from '../../../../../db';
import { ISessionCleanupStrategy, CleanupResult } from '../ISessionCleanupStrategy';

/**
 * Abandoned Session Cleanup Strategy
 * 
 * Responsible for cleaning up sessions where all students have left
 * and the grace period for reconnection has expired.
 * 
 * Follows Single Responsibility Principle.
 */
export class AbandonedSessionCleanupStrategy implements ISessionCleanupStrategy {
  getName(): string {
    return 'AbandonedSessionCleanup';
  }

  shouldRun(now: number): boolean {
    // Always run this strategy - it's a core cleanup operation
    return true;
  }

  async execute(now: number): Promise<CleanupResult> {
    const threshold = new Date(now - config.session.allStudentsLeftTimeout);
    
    try {
      logger.info(`[AbandonedSessionCleanup] Checking for abandoned sessions. Threshold: ${threshold.toISOString()}, Timeout: ${config.session.allStudentsLeftTimeout}ms`);
      
      // Find sessions marked with grace period that have exceeded the timeout
      const abandonedSessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.isActive, true),
            eq(sessions.studentsCount, 0),
            // CRITICAL: Only sessions that HAD students (have grace period marker)
            isNotNull(sessions.qualityReason),
            // Check for grace period specifically
            // Use lastActivityAt for grace period timeout
            lt(sessions.lastActivityAt, threshold)
          )
        );

      logger.info(`[AbandonedSessionCleanup] Found ${abandonedSessions.length} potential abandoned sessions`);
      
      // Log session details for debugging
      for (const session of abandonedSessions) {
        logger.info(`[AbandonedSessionCleanup] Session ${session.sessionId}: lastActivityAt=${session.lastActivityAt}, qualityReason="${session.qualityReason}", studentsCount=${session.studentsCount}`);
      }

      if (abandonedSessions.length === 0) {
        return {
          cleanedCount: 0,
          type: this.getName(),
          details: 'No abandoned sessions found'
        };
      }

      logger.info(`Found ${abandonedSessions.length} potentially abandoned sessions to clean up`);

      await db
        .update(sessions)
        .set({
          isActive: false,
          endTime: new Date(),
          quality: 'no_activity',
          qualityReason: `All students disconnected, no activity for ${config.session.allStudentsLeftTimeoutUnscaled / 60000} minutes`
        })
        .where(
          and(
            eq(sessions.isActive, true),
            eq(sessions.studentsCount, 0),
            isNotNull(sessions.qualityReason),
            lt(sessions.lastActivityAt, threshold)
          )
        );

      logger.info(`Cleaned up ${abandonedSessions.length} abandoned sessions`);

      return {
        cleanedCount: abandonedSessions.length,
        type: this.getName(),
        details: `Cleaned sessions where students left and grace period (${config.session.allStudentsLeftTimeoutUnscaled / 60000} minutes) expired`
      };

    } catch (error) {
      logger.error('Error in AbandonedSessionCleanupStrategy:', error);
      return {
        cleanedCount: 0,
        type: this.getName(),
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 