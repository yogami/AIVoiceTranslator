/**
 * Classroom Session Manager
 * 
 * Manages classroom codes, session validation, and cleanup.
 * Handles the generation and lifecycle of classroom sessions.
 */
import logger from '../../logger';

export interface ClassroomSession {
  code: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  teacherConnected: boolean;
  expiresAt: number;
}

export class ClassroomSessionManager {
  private classroomSessions: Map<string, ClassroomSession> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.setupCleanup();
  }

  /**
   * Generate a classroom code for a session
   */
  public generateClassroomCode(sessionId: string): string {
    // Check if we already have a code for this session
    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.sessionId === sessionId) {
        // Update activity and return existing code
        session.lastActivity = Date.now();
        session.teacherConnected = true;
        return code;
      }
    }
    
    // Generate new 6-character code
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code: string;
    
    // Ensure uniqueness
    do {
      code = '';
      for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
      }
    } while (this.classroomSessions.has(code));
    
    // Create session with 2-hour expiration
    const session: ClassroomSession = {
      code,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      teacherConnected: true,
      expiresAt: Date.now() + (2 * 60 * 60 * 1000) // 2 hours
    };
    
    this.classroomSessions.set(code, session);
    logger.info(`Created new classroom session: ${code} for session ${sessionId}`);
    
    return code;
  }

  /**
   * Validate classroom code
   */
  public isValidClassroomCode(code: string): boolean {
    // Check format
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      return false;
    }
    
    const session = this.classroomSessions.get(code);
    if (!session) {
      return false;
    }
    
    // Check expiration
    if (Date.now() > session.expiresAt) {
      this.classroomSessions.delete(code);
      logger.info(`Classroom code ${code} expired and removed`);
      return false;
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    return true;
  }

  /**
   * Get session by classroom code
   */
  public getSessionByCode(code: string): ClassroomSession | undefined {
    return this.classroomSessions.get(code);
  }

  /**
   * Get all classroom sessions
   */
  public getAllSessions(): Map<string, ClassroomSession> {
    return new Map(this.classroomSessions);
  }

  /**
   * Update session activity
   */
  public updateActivity(code: string): void {
    const session = this.classroomSessions.get(code);
    if (session) {
      session.lastActivity = Date.now();
    }
  }

  /**
   * Get classroom code by session ID
   */
  public getClassroomCodeBySessionId(sessionId: string): string | undefined {
    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.sessionId === sessionId) {
        return code;
      }
    }
    return undefined;
  }

  /**
   * Set up periodic cleanup of expired classroom sessions
   */
  private setupCleanup(): void {
    // Clean up expired sessions every 15 minutes
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      let cleaned = 0;
      
      for (const [code, session] of this.classroomSessions.entries()) {
        if (now > session.expiresAt) {
          this.classroomSessions.delete(code);
          cleaned++;
        }
      }
      
      if (cleaned > 0) {
        logger.info(`Cleaned up ${cleaned} expired classroom sessions`);
      }
    }, 15 * 60 * 1000); // 15 minutes
  }

  /**
   * Clear all sessions (used for shutdown)
   */
  public clear(): void {
    this.classroomSessions.clear();
  }

  /**
   * Clear all classroom sessions (for shutdown)
   */
  public clearAll(): void {
    this.classroomSessions.clear();
    logger.info('All classroom sessions cleared');
  }

  /**
   * Shutdown the classroom session manager
   */
  public shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.clear();
    logger.info('ClassroomSessionManager shutdown completed');
  }

  /**
   * Get session metrics for diagnostics
   */
  public getSessionMetrics(): {
    totalSessions: number;
    activeSessions: string[];
  } {
    const activeSessions: string[] = [];
    
    for (const [code, session] of this.classroomSessions.entries()) {
      if (Date.now() <= session.expiresAt) {
        activeSessions.push(code);
      }
    }

    return {
      totalSessions: this.classroomSessions.size,
      activeSessions
    };
  }

  /**
   * Manually trigger cleanup of expired sessions (primarily for testing)
   */
  public triggerCleanup(): number {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [code, session] of this.classroomSessions.entries()) {
      if (now > session.expiresAt) {
        this.classroomSessions.delete(code);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      logger.info(`Manually triggered cleanup: cleaned up ${cleaned} expired classroom sessions`);
    }
    
    return cleaned;
  }

  /**
   * Add a classroom session directly (primarily for testing)
   */
  public addSession(code: string, session: ClassroomSession): void {
    this.classroomSessions.set(code, session);
  }

  /**
   * Check if a classroom code exists (primarily for testing)
   */
  public hasSession(code: string): boolean {
    return this.classroomSessions.has(code);
  }
}
