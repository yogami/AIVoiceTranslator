import logger from '../../../../../logger';
import { config } from '../../../../../config';
import { eq, and, lt, or, isNull } from 'drizzle-orm';
import { sessions } from '../../../../../../shared/schema';
import { db } from '../../../../../db';
import { ISessionCleanupStrategy, CleanupResult } from '../ISessionCleanupStrategy';

/**
 * Inactive Session Cleanup Strategy
 * 
 * Responsible for cleaning up sessions with general long-term inactivity.
 * This serves as a broader fallback cleanup for sessions that don't match
 * more specific cleanup criteria.
 * 
 * Follows Single Responsibility Principle.
 */
export class InactiveSessionCleanupStrategy implements ISessionCleanupStrategy {
  getName(): string {
    return 'InactiveSessionCleanup';
  }

  shouldRun(now: number): boolean {
    // Always run this strategy - it's a fallback cleanup operation
    return true;
  }

  async execute(now: number): Promise<CleanupResult> {
    const staleThreshold = new Date(now - config.session.staleSessionTimeout);
    
    try {
      logger.info(`[InactiveSessionCleanup] Checking for stale sessions. Threshold: ${staleThreshold.toISOString()}, Timeout: ${config.session.staleSessionTimeout}ms`);
      
      // Find sessions that have been inactive for a long time
      const staleSessions = await db
        .select()
        .from(sessions)
        .where(
          and(
            eq(sessions.isActive, true),
            or(
              lt(sessions.lastActivityAt, staleThreshold),
              and(
                isNull(sessions.lastActivityAt),
                lt(sessions.startTime, staleThreshold)
              )
            )
          )
        );

      logger.info(`[InactiveSessionCleanup] Found ${staleSessions.length} potential stale sessions`);
      
      // Log session details for debugging  
      for (const session of staleSessions) {
        logger.info(`[InactiveSessionCleanup] Session ${session.sessionId}: lastActivityAt=${session.lastActivityAt}, studentsCount=${session.studentsCount}`);
      }

      if (staleSessions.length === 0) {
        return {
          cleanedCount: 0,
          type: this.getName(),
          details: 'No stale sessions found'
        };
      }

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
            or(
              lt(sessions.lastActivityAt, staleThreshold),
              and(
                isNull(sessions.lastActivityAt),
                lt(sessions.startTime, staleThreshold)
              )
            )
          )
        );

      logger.info(`Cleaned up ${staleSessions.length} long-term inactive sessions`);

      return {
        cleanedCount: staleSessions.length,
        type: this.getName(),
        details: `Cleaned sessions inactive for over ${config.session.staleSessionTimeoutUnscaled / 60000} minutes`
      };

    } catch (error) {
      logger.error('Error in InactiveSessionCleanupStrategy:', error);
      return {
        cleanedCount: 0,
        type: this.getName(),
        details: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
} 