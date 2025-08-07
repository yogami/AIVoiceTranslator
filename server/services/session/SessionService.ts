/**
 * Session Service
 * 
 * Manages classroom sessions, session IDs, classroom codes, and session lifecycle.
 * Follows Single Responsibility Principle by handling only session-related operations.
 */

import logger from '../../logger';
import { config } from '../../config';
import { IStorage } from '../../storage.interface';
import type { InsertSession } from '../../../shared/schema';

// Classroom session interface
export interface ClassroomSession {
  code: string;
  sessionId: string;
  createdAt: number;
  lastActivity: number;
  teacherConnected: boolean;
  expiresAt: number;
}

export class SessionService {
  private classroomSessions: Map<string, ClassroomSession> = new Map();
  private sessionCounter: number = 0;
  private classroomCleanupInterval: NodeJS.Timeout | null = null;
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
    this.startCleanupTask();
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
    this.sessionCounter++;
    return `session-${this.sessionCounter}-${Date.now()}`;
  }

  /**
   * Generate a classroom code for a session
   */
  generateClassroomCode(sessionId: string): string {
    // Check if we already have a classroom code for this session
    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.sessionId === sessionId) {
        return code;
      }
    }

    // Generate new 6-character alphanumeric code
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    // Create new classroom session
    const session: ClassroomSession = {
      code: result,
      sessionId: sessionId,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      teacherConnected: true,
      expiresAt: Date.now() + config.session.classroomCodeExpiration // Configurable expiration
    };

    this.classroomSessions.set(result, session);
    logger.info(`Created classroom session with code ${result} for session ${sessionId}`);

    return result;
  }

  /**
   * Get classroom session by code
   */
  getClassroomSession(code: string): ClassroomSession | undefined {
    return this.classroomSessions.get(code);
  }

  /**
   * Get all classroom sessions
   */
  getAllClassroomSessions(): Map<string, ClassroomSession> {
    return new Map(this.classroomSessions);
  }

  /**
   * Update session in storage
   */
  async updateSessionInStorage(sessionId: string, updates: Partial<InsertSession>): Promise<void> {
    try {
      await this.storage.updateSession(sessionId, updates);
      logger.debug('Updated session in storage:', { sessionId, updates });
    } catch (error) {
      logger.error('Failed to update session in storage:', { error, sessionId });
      throw error;
    }
  }

  /**
   * Clean up expired classroom sessions
   */
  private cleanupExpiredSessions(): void {
    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [code, session] of this.classroomSessions.entries()) {
      if (session.expiresAt < now) {
        expiredSessions.push(code);
      }
    }

    for (const code of expiredSessions) {
      this.classroomSessions.delete(code);
      logger.info(`Cleaned up expired classroom session: ${code}`);
    }

    if (expiredSessions.length > 0) {
      logger.info(`Cleaned up ${expiredSessions.length} expired classroom sessions`);
    }
  }

  /**
   * Start periodic cleanup task
   */
  private startCleanupTask(): void {
    // Clean up expired sessions periodically
    this.classroomCleanupInterval = setInterval(() => {
      this.cleanupExpiredSessions();
    }, config.session.classroomCodeCleanupInterval);

    logger.info('Started classroom session cleanup task');
  }

  /**
   * Stop cleanup task and cleanup resources
   */
  shutdown(): void {
    if (this.classroomCleanupInterval) {
      clearInterval(this.classroomCleanupInterval);
      this.classroomCleanupInterval = null;
    }
    this.classroomSessions.clear();
    logger.info('SessionService shutdown completed');
  }
}
