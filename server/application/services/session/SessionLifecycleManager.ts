/**
 * Session Lifecycle Management
 * 
 * Defines session quality tiers and automatic cleanup policies
 * to handle real-world scenarios where sessions are created but not used.
 */

export enum SessionQuality {
  // Dead session - no meaningful activity, should be cleaned up
  DEAD = 'dead',
  
  // Minimal session - connection established but very limited activity
  MINIMAL = 'minimal', 
  
  // Active session - has meaningful classroom activity
  ACTIVE = 'active',
  
  // Complete session - full classroom experience with good engagement
  COMPLETE = 'complete'
}

export interface SessionMetrics {
  connectionDurationMs: number;
  studentCount: number;
  translationCount: number;
  transcriptCount: number;
  lastActivityTimestamp: Date;
  teacherInteractionCount: number; // mic usage, UI interactions
}

export interface SessionLifecycleConfig {
  // Time limits for different phases
  deadSessionTimeoutMs: number;      // 5 minutes - cleanup if no activity
  minimalSessionTimeoutMs: number;   // 15 minutes - promote to minimal if some activity
  activeSessionTimeoutMs: number;    // 2 hours - normal classroom duration
  
  // Activity thresholds for quality classification
  minTranslationsForActive: number;  // 3+ translations = active session
  minStudentsForComplete: number;    // 5+ students = complete session
  minDurationForComplete: number;    // 30+ minutes = complete session
}

export const DEFAULT_SESSION_LIFECYCLE_CONFIG: SessionLifecycleConfig = {
  deadSessionTimeoutMs: 5 * 60 * 1000,      // 5 minutes
  minimalSessionTimeoutMs: 15 * 60 * 1000,  // 15 minutes  
  activeSessionTimeoutMs: 2 * 60 * 60 * 1000, // 2 hours
  
  minTranslationsForActive: 3,
  minStudentsForComplete: 5,
  minDurationForComplete: 30 * 60 * 1000,    // 30 minutes
};

export class SessionLifecycleManager {
  private config: SessionLifecycleConfig;
  
  constructor(config: SessionLifecycleConfig = DEFAULT_SESSION_LIFECYCLE_CONFIG) {
    this.config = config;
  }
  
  /**
   * Classify session quality based on metrics
   */
  classifySession(metrics: SessionMetrics, createdAt: Date): SessionQuality {
    const now = new Date();
    const sessionAge = now.getTime() - createdAt.getTime();
    const timeSinceLastActivity = now.getTime() - metrics.lastActivityTimestamp.getTime();
    
    // Dead session: No meaningful activity within timeout
    if (metrics.translationCount === 0 && 
        metrics.studentCount === 0 && 
        timeSinceLastActivity > this.config.deadSessionTimeoutMs) {
      return SessionQuality.DEAD;
    }
    
    // Minimal session: Some connection but very limited activity
    if (metrics.translationCount < this.config.minTranslationsForActive && 
        sessionAge < this.config.activeSessionTimeoutMs) {
      return SessionQuality.MINIMAL;
    }
    
    // Complete session: Full classroom experience
    if (metrics.translationCount >= this.config.minTranslationsForActive &&
        metrics.studentCount >= this.config.minStudentsForComplete &&
        metrics.connectionDurationMs >= this.config.minDurationForComplete) {
      return SessionQuality.COMPLETE;
    }
    
    // Active session: Has meaningful activity but not complete
    if (metrics.translationCount >= this.config.minTranslationsForActive) {
      return SessionQuality.ACTIVE;
    }
    
    return SessionQuality.MINIMAL;
  }
  
  /**
   * Determine if session should be cleaned up
   */
  shouldCleanupSession(quality: SessionQuality, metrics: SessionMetrics): boolean {
    const timeSinceLastActivity = Date.now() - metrics.lastActivityTimestamp.getTime();
    
    switch (quality) {
      case SessionQuality.DEAD:
        return timeSinceLastActivity > this.config.deadSessionTimeoutMs;
        
      case SessionQuality.MINIMAL:
        return timeSinceLastActivity > this.config.minimalSessionTimeoutMs;
        
      case SessionQuality.ACTIVE:
      case SessionQuality.COMPLETE:
        return timeSinceLastActivity > this.config.activeSessionTimeoutMs;
        
      default:
        return false;
    }
  }
  
  /**
   * Get sessions that should be included in diagnostics/analytics
   */
  shouldIncludeInAnalytics(quality: SessionQuality): boolean {
    // Only include sessions with meaningful activity in analytics
    return quality === SessionQuality.ACTIVE || quality === SessionQuality.COMPLETE;
  }
  
  /**
   * Get sessions that should be cleaned up immediately
   */
  shouldAutoCleanup(quality: SessionQuality): boolean {
    return quality === SessionQuality.DEAD;
  }
}
