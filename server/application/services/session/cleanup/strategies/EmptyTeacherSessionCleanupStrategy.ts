import logger from '../../../../../logger';
import { config } from '../../../../../config';
import { eq, and, lt, isNull } from 'drizzle-orm';
import { sessions } from '../../../../../../shared/schema';
import { db } from '../../../../../db';
import { ISessionCleanupStrategy, CleanupResult } from '../ISessionCleanupStrategy';

/**
 * Empty Teacher Session Cleanup Strategy
 * 
 * Responsible for cleaning up sessions where teachers are waiting
 * but no students have joined within the timeout period.
 * 
 * Follows Single Responsibility Principle - only handles empty teacher sessions.
 */
export class EmptyTeacherSessionCleanupStrategy implements ISessionCleanupStrategy {
  getName(): string {
    return 'EmptyTeacherSessionCleanup';
  }

  shouldRun(now: number): boolean {
    // Always run this strategy - it's a core cleanup operation
    return true;
  }

  async execute(now: number): Promise<CleanupResult> {
    const threshold = new Date(now - config.session.emptyTeacherTimeout);
    
    try {
      // Find sessions to clean up - only those that NEVER had students
      const emptySessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.isActive, true),
            eq(sessions.studentsCount, 0),
            lt(sessions.startTime, threshold),
            // CRITICAL: Only sessions that never had grace period (never had students)
            isNull(sessions.qualityReason)
          )
        );

      if (emptySessions.length === 0) {
        return {
          cleanedCount: 0,
          type: this.getName(),
          details: 'No empty teacher sessions found'
        };
      }

      logger.info(`Found ${emptySessions.length} empty teacher sessions to clean up`);

      // Clean up the sessions
      await db
        .update(sessions)
        .set({
          isActive: false,
          endTime: new Date(),
          quality: 'no_students',
          qualityReason: `No students joined within ${config.session.emptyTeacherTimeoutUnscaled / 60000} minutes`
        })
        .where(
          and(
            eq(sessions.isActive, true),
            eq(sessions.studentsCount, 0),
            lt(sessions.startTime, threshold),
            // CRITICAL: Ensure we only update sessions that still have null qualityReason
            isNull(sessions.qualityReason)
          )
        );

      logger.info(`Cleaned up ${emptySessions.length} empty teacher sessions`);

      return {
        cleanedCount: emptySessions.length,
        type: this.getName(),
        details: `Cleaned sessions where no students joined within ${config.session.emptyTeacherTimeoutUnscaled / 60000} minutes`
      };

    } catch (error) {
      logger.error('Error in EmptyTeacherSessionCleanupStrategy:', error);
      return {
        cleanedCount: 0,
        type: this.getName(),
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 