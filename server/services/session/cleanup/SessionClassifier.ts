import logger from '../../../logger';
import { IStorage } from '../../../storage.interface';
import { ISessionClassifier, SessionQuality, ClassificationResult } from './ISessionClassifier';

/**
 * Session Quality Classifier
 * 
 * Responsible for classifying sessions as real or dead based on various metrics.
 * Follows Single Responsibility Principle - only handles classification logic.
 * Uses Dependency Injection for storage access.
 */
export class SessionClassifier implements ISessionClassifier {
  private readonly MIN_SESSION_DURATION = 30000; // 30 seconds
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  classifySession(session: any, transcriptCount: number): SessionQuality {
    const now = new Date();
    const sessionDuration = session.endTime ? 
      session.endTime.getTime() - session.startTime.getTime() :
      now.getTime() - session.startTime.getTime();

    // Real session: Has meaningful activity
    if (session.totalTranslations > 0 && session.studentsCount > 0 && sessionDuration >= this.MIN_SESSION_DURATION) {
      return {
        isReal: true,
        reason: 'real',
        studentsCount: session.studentsCount,
        totalTranslations: session.totalTranslations || 0,
        duration: sessionDuration,
        transcriptCount: transcriptCount || 0
      };
    }

    // Dead sessions: Various reasons
    if (session.studentsCount === 0) {
      return {
        isReal: false,
        reason: 'no_students',
        studentsCount: session.studentsCount,
        totalTranslations: session.totalTranslations || 0,
        duration: sessionDuration,
        transcriptCount: transcriptCount || 0
      };
    }

    if (session.totalTranslations === 0 && transcriptCount === 0) {
      return {
        isReal: false,
        reason: 'no_activity',
        studentsCount: session.studentsCount,
        totalTranslations: session.totalTranslations || 0,
        duration: sessionDuration,
        transcriptCount: transcriptCount || 0
      };
    }

    if (sessionDuration < this.MIN_SESSION_DURATION) {
      return {
        isReal: false,
        reason: 'too_short',
        studentsCount: session.studentsCount,
        totalTranslations: session.totalTranslations || 0,
        duration: sessionDuration,
        transcriptCount: transcriptCount || 0
      };
    }

    // Default to real if it doesn't match dead criteria
    return {
      isReal: true,
      reason: 'real',
      studentsCount: session.studentsCount,
      totalTranslations: session.totalTranslations || 0,
      duration: sessionDuration,
      transcriptCount: transcriptCount || 0
    };
  }

  getQualityReasonText(classification: SessionQuality): string {
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

  async classifyDeadSessions(limit: number = 100): Promise<ClassificationResult> {
    const result: ClassificationResult = {
      classified: 0,
      realSessions: 0,
      deadSessions: 0
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

      if (result.classified > 0) {
        logger.info('Session classification completed', result);
      }

      return result;
    } catch (error) {
      logger.error('Failed to classify dead sessions', { error });
      return result;
    }
  }
} 