/**
 * Storage Session Manager
 * 
 * Manages database session operations - creation, updates, and cleanup.
 * Handles the persistence aspect of WebSocket sessions.
 */
import logger from '../../logger';
import { IStorage } from '../../storage.interface';
import { type InsertSession } from '../../../shared/schema';

export class StorageSessionManager {
  private storage: IStorage;

  constructor(storage: IStorage) {
    this.storage = storage;
  }

  /**
   * Create session in storage for metrics tracking
   */
  public async createSession(sessionId: string): Promise<void> {
    try {
      // Check if a session with this ID already exists
      const existingSession = await this.storage.getSessionById(sessionId);
      if (existingSession) {
        logger.info('Session already exists in storage, ensuring it is active:', { sessionId });
        if (!existingSession.isActive) {
          await this.storage.updateSession(sessionId, { isActive: true });
        }
        return;
      }

      // If not, create a new session
      await this.storage.createSession({
        sessionId,
        isActive: true
        // startTime is automatically set by the database default
      });
      logger.info('Successfully created new session in storage:', { sessionId });
    } catch (error: any) {
      // Log other errors but don't throw - metrics should not break core functionality
      logger.error('Failed to create or update session in storage:', { sessionId, error });
    }
  }

  /**
   * Update session in storage
   */
  public async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<void> {
    try {
      await this.storage.updateSession(sessionId, updates);
      // Removed debug logging to avoid interfering with tests that expect no debug logs
    } catch (error) {
      logger.error('Failed to update session in storage:', { sessionId, error });
    }
  }

  /**
   * End session in storage
   */
  public async endSession(sessionId: string): Promise<void> {
    try {
      await this.storage.endSession(sessionId);
      logger.info('Successfully ended session in storage:', { sessionId });
    } catch (error) {
      logger.error('Failed to end session in storage:', { sessionId, error });
    }
  }

  /**
   * Get session by ID
   */
  public async getSession(sessionId: string): Promise<any> {
    try {
      return await this.storage.getSessionById(sessionId);
    } catch (error) {
      logger.error('Failed to get session from storage:', { sessionId, error });
      return null;
    }
  }

  /**
   * Check if session exists and is active
   */
  public async isSessionActive(sessionId: string): Promise<boolean> {
    try {
      const session = await this.storage.getSessionById(sessionId);
      return session?.isActive ?? false;
    } catch (error) {
      logger.error('Failed to check session status:', { sessionId, error });
      return false;
    }
  }
}
