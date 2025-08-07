/**
 * Session Lifecycle Service
 * 
 * Manages the lifecycle of WebSocket sessions including:
 * - Classification of sessions as real vs dead
 * - Automatic cleanup of inactive sessions
 * - Activity t        }
      }

      logger.info('Cleaned up dead sessions', result);nd quality assessment
 */
import logger from '../../logger';
import { IStorage } from '../../storage.interface';
import type { Session, InsertSession } from '../../../shared/schema';

export interface SessionQuality {
  isReal: boolean;
  reason: 'no_students' | 'no_activity' | 'too_short' | 'real';
  studentsCount: number;
  totalTranslations: number;
  duration: number; // in milliseconds
  transcriptCount: number;
}

export interface CleanupResult {
  classified: number;
  deadSessions: number;
  realSessions: number;
  endedCount?: number;
  classifiedCount?: number;
}

export interface ProcessInactiveSessionsResult {
  endedCount: number;
  classifiedCount: number;
}

export class SessionLifecycleService {
  private readonly MIN_SESSION_DURATION = 30000; // 30 seconds
  private readonly DEFAULT_INACTIVE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

  constructor(private storage: IStorage) {}

  /**
   * Classify a session based on its activity and duration
   */
  public classifySession(session: Session, transcriptCount: number): SessionQuality {
    const startTime = session.startTime ? session.startTime.getTime() : Date.now();
    const endTime = session.endTime ? session.endTime.getTime() : Date.now();
    const duration = endTime - startTime;

    // Dead session: Too short (less than 30 seconds) - check first as it's most definitive
    if (duration < this.MIN_SESSION_DURATION) {
      return {
        isReal: false,
        reason: 'too_short',
        studentsCount: session.studentsCount || 0,
        totalTranslations: session.totalTranslations || 0,
        duration,
        transcriptCount
      };
    }

    // Dead session: No students ever joined
    if (session.studentsCount === 0) {
      return {
        isReal: false,
        reason: 'no_students',
        studentsCount: 0,
        totalTranslations: session.totalTranslations || 0,
        duration,
        transcriptCount
      };
    }

    // Dead session: Students joined but no teaching activity
    if ((session.totalTranslations || 0) === 0 && transcriptCount === 0) {
      return {
        isReal: false,
        reason: 'no_activity',
        studentsCount: session.studentsCount || 0,
        totalTranslations: 0,
        duration,
        transcriptCount: 0
      };
    }

    // Real session
    return {
      isReal: true,
      reason: 'real',
      studentsCount: session.studentsCount || 0,
      totalTranslations: session.totalTranslations || 0,
      duration,
      transcriptCount
    };
  }

  /**
   * Update session activity timestamp
   */
  public async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      // First check if the session exists in the database to avoid unnecessary updates
      const existingSession = await this.storage.getActiveSession(sessionId);
      if (!existingSession) {
        // Session doesn't exist in DB yet (e.g., teacher-only session)
        // Don't spam logs for this expected condition
        logger.debug('Session not yet persisted to database, skipping activity update', { sessionId });
        return;
      }

      await this.storage.updateSession(sessionId, {
        lastActivityAt: new Date()
      });
      logger.debug('Updated session activity', { sessionId });
    } catch (error) {
      logger.error('Failed to update session activity', { sessionId, error });
    }
  }

  /**
   * Process inactive sessions and end them if needed
   */
  public async processInactiveSessions(inactiveTimeoutMs: number = this.DEFAULT_INACTIVE_TIMEOUT): Promise<ProcessInactiveSessionsResult> {
    const result: ProcessInactiveSessionsResult = {
      endedCount: 0,
      classifiedCount: 0
    };

    try {
      const activeSessions = await this.storage.getAllActiveSessions();
      const now = new Date();
      const cutoffTime = new Date(now.getTime() - inactiveTimeoutMs);

      for (const session of activeSessions) {
        const lastActivity = session.lastActivityAt || session.startTime;
        
        if (lastActivity && lastActivity < cutoffTime) {
          // Session is inactive, end it and classify
          const classification = this.classifySession(session, 0); // We don't have transcript count here
          
          await this.storage.updateSession(session.sessionId, {
            isActive: false,
            endTime: now,
            quality: classification.isReal ? 'real' : classification.reason,
            qualityReason: this.getQualityReasonText(classification)
          });

          result.endedCount++;
          result.classifiedCount++;
          
          logger.info('Ended inactive session', { 
            sessionId: session.sessionId, 
            quality: classification.reason,
            inactiveFor: now.getTime() - (lastActivity?.getTime() || 0)
          });
        }
      }

      logger.info('Processed inactive sessions', result);
      return result;
    } catch (error) {
      logger.error('Failed to process inactive sessions', { error });
      return result;
    }
  }

  /**
   * Clean up and classify dead sessions
   */
  public async cleanupDeadSessions(limit: number = 100): Promise<CleanupResult> {
    const result: CleanupResult = {
      classified: 0,
      deadSessions: 0,
      realSessions: 0
    };

    try {
      // Get recent sessions that haven't been classified yet
      const recentActivity = await this.storage.getRecentSessionActivity(limit);
      
      for (const activity of recentActivity) {
        const session = await this.storage.getSessionById(activity.sessionId);
        
        if (!session || session.quality !== 'unknown') {
          continue; // Skip if session not found or already classified
        }

        const classification = this.classifySession(session, activity.transcriptCount);
        let quality: 'real' | 'no_students' | 'no_activity' | 'too_short';
        
        if (classification.isReal) {
          quality = 'real';
        } else {
          quality = classification.reason;
        }
        
        await this.storage.updateSession(session.sessionId, {
          quality,
          qualityReason: this.getQualityReasonText(classification)
        });

        result.classified++;
        if (classification.isReal) {
          result.realSessions++;
        } else {
          result.deadSessions++;
        }

        logger.debug('Classified session', { 
          sessionId: session.sessionId, 
          quality,
          reason: classification.reason 
        });
      }

      logger.info('Cleaned up dead sessions', result);
      return result;
    } catch (error) {
      logger.error('Failed to cleanup dead sessions', { error });
      return result;
    }
  }

  /**
   * Mark that students have rejoined a session (cancel grace period)
   * DELEGATION: Routes to unified cleanup service
   */
  async markStudentsRejoined(sessionId: string): Promise<void> {
    // This method will be called by the unified cleanup service
    // For now, just log - the actual implementation is in UnifiedSessionCleanupService
    logger.debug(`SessionLifecycleService delegating markStudentsRejoined to unified cleanup for session ${sessionId}`);
    
    // TODO: This should be injected or accessed differently once the migration is complete
    // For now, just update the session activity directly
    await this.updateSessionActivity(sessionId);
  }

  /**
   * End a session
   * DELEGATION: Routes to unified cleanup service
   */
  async endSession(sessionId: string, reason: string): Promise<void> {
    // This method will be called by the unified cleanup service
    // For now, implement basic functionality directly
    logger.info(`SessionLifecycleService delegating endSession to unified cleanup for session ${sessionId}: ${reason}`);
    
    try {
      await this.storage.updateSession(sessionId, {
        isActive: false,
        endTime: new Date(),
        qualityReason: reason
      });
      logger.info(`Ended session ${sessionId}: ${reason}`);
    } catch (error) {
      logger.error('Error ending session:', { sessionId, reason, error });
    }
  }

  /**
   * Get human-readable quality reason text
   */
  private getQualityReasonText(classification: SessionQuality): string {
    switch (classification.reason) {
      case 'no_students':
        return `No students joined this session (duration: ${Math.round(classification.duration / 1000)}s)`;
      case 'no_activity':
        return `Session had ${classification.studentsCount} students but no translations or transcripts (duration: ${Math.round(classification.duration / 1000)}s)`;
      case 'too_short':
        return `Session was too short (${Math.round(classification.duration / 1000)}s) to be meaningful`;
      case 'real':
        return `Session had meaningful activity: ${classification.studentsCount} students, ${classification.totalTranslations} translations, ${classification.transcriptCount} transcripts`;
      default:
        return 'Unknown classification reason';
    }
  }

  /**
   * Get session quality statistics
   */
  public async getQualityStatistics(): Promise<{
    total: number;
    real: number;
    dead: number;
    breakdown: Record<string, number>;
  }> {
    try {
      return await this.storage.getSessionQualityStats();
    } catch (error) {
      logger.error('Failed to get quality statistics', { error });
      return {
        total: 0,
        real: 0,
        dead: 0,
        breakdown: {}
      };
    }
  }
}
