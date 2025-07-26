/**
 * Classroom Session Manager
 * 
 * Manages classroom codes, session validation, and cleanup.
 * Handles the generation and lifecycle of classroom sessions.
 */
import logger from '../../logger';
import { config } from '../../config';

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
    console.log(`🔍 DEBUG: generateClassroomCode called with sessionId: ${sessionId}`);
    
    // Check if we already have a code for this session
    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.sessionId === sessionId) {
        // Update activity and return existing code
        session.lastActivity = Date.now();
        session.teacherConnected = true;
        console.log(`🔍 DEBUG: Found existing code ${code} for sessionId ${sessionId}, reusing it`);
        return code;
      }
    }
    
    console.log(`🔍 DEBUG: No existing code found for sessionId ${sessionId}, generating new one`);
    
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
    
    console.log(`🔍 DEBUG: Generated new classroom code: ${code} for sessionId: ${sessionId}`);
    
    // Create session with configurable expiration
    const now = Date.now();
    const expiresAt = now + config.session.classroomCodeExpiration;
    console.log(`🔍 DEBUG: Setting expiration - now=${now}, expiration=${config.session.classroomCodeExpiration}ms, expiresAt=${expiresAt}`);
    
    const session: ClassroomSession = {
      code,
      sessionId,
      createdAt: now,
      lastActivity: now,
      teacherConnected: true,
      expiresAt: expiresAt
    };
    
    this.classroomSessions.set(code, session);
    logger.info(`Created new classroom session: ${code} for session ${sessionId}`);
    
    return code;
  }

  /**
   * Validate classroom code
   */
  public isValidClassroomCode(code: string): boolean {
    console.log(`[DEBUG] isValidClassroomCode called with: ${code}`);
    
    // Check format
    if (!/^[A-Z0-9]{6}$/.test(code)) {
      console.log(`[DEBUG] Classroom code ${code} has invalid format`);
      logger.info(`DEBUG: Classroom code ${code} has invalid format`);
      return false;
    }
    
    const session = this.classroomSessions.get(code);
    if (!session) {
      console.log(`[DEBUG] Classroom code ${code} not found in sessions`);
      logger.info(`DEBUG: Classroom code ${code} not found in sessions`);
      return false;
    }
    
    // Check if teacher is connected
    if (!session.teacherConnected) {
      console.log(`[DEBUG] Classroom code ${code} invalid - teacher not connected`);
      logger.info(`DEBUG: Classroom code ${code} invalid - teacher not connected`);
      return false;
    }
    
    // Check expiration
    const now = Date.now();
    console.log(`[DEBUG] Checking expiration for code ${code}: now=${now}, expiresAt=${session.expiresAt}, expired=${now > session.expiresAt}`);
    logger.info(`DEBUG: Checking expiration for code ${code}: now=${now}, expiresAt=${session.expiresAt}, expired=${now > session.expiresAt}`);
    
    if (now > session.expiresAt) {
      this.classroomSessions.delete(code);
      console.log(`[DEBUG] Classroom code ${code} expired and removed`);
      logger.info(`Classroom code ${code} expired and removed`);
      return false;
    }
    
    // Update last activity
    session.lastActivity = Date.now();
    console.log(`[DEBUG] Classroom code ${code} is valid`);
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
   * Mark teacher as disconnected for a session
   */
  public markTeacherDisconnected(sessionId: string): void {
    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.sessionId === sessionId) {
        session.teacherConnected = false;
        logger.info(`Marked teacher as disconnected for classroom ${code} (session ${sessionId})`);
        return;
      }
    }
  }

  /**
   * Mark teacher as connected for a session (used during reconnection)
   */
  public markTeacherReconnected(sessionId: string): void {
    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.sessionId === sessionId) {
        session.teacherConnected = true;
        session.lastActivity = Date.now();
        logger.info(`Marked teacher as reconnected for classroom ${code} (session ${sessionId})`);
        return;
      }
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
    // Clean up expired sessions periodically
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
    }, config.session.classroomCodeCleanupInterval);
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
   * Get the number of active classroom sessions
   */
  public getActiveSessionCount(): number {
    const now = Date.now();
    let activeCount = 0;
    
    for (const session of this.classroomSessions.values()) {
      if (now <= session.expiresAt) {
        activeCount++;
      }
    }
    
    return activeCount;
  }

  /**
   * Get all active sessions (primarily for debugging)
   */
  public getActiveSessions(): ClassroomSession[] {
    const now = Date.now();
    const activeSessions: ClassroomSession[] = [];
    
    for (const session of this.classroomSessions.values()) {
      if (now <= session.expiresAt) {
        activeSessions.push(session);
      }
    }
    
    return activeSessions;
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

  /**
   * Restore a classroom session from database (used during teacher reconnection)
   */
  public restoreClassroomSession(classroomCode: string, sessionId: string): void {
    // Check if this classroom code already exists
    const existingSession = this.classroomSessions.get(classroomCode);
    if (existingSession) {
      // Update existing session
      existingSession.lastActivity = Date.now();
      existingSession.teacherConnected = true;
      logger.info(`Restored existing classroom session: ${classroomCode} for session ${sessionId}`);
      return;
    }

    // Create new classroom session entry
    const session: ClassroomSession = {
      code: classroomCode,
      sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      teacherConnected: true,
      expiresAt: Date.now() + config.session.classroomCodeExpiration // Configurable expiration from now
    };

    this.classroomSessions.set(classroomCode, session);
    logger.info(`Restored classroom session: ${classroomCode} for session ${sessionId}`);
  }
}
