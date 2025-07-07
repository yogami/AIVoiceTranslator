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
        logger.info('Session already exists in storage:', { sessionId });
        // Only activate if there are students or if it was already active
        if (existingSession.studentsCount && existingSession.studentsCount > 0 && !existingSession.isActive) {
          await this.storage.updateSession(sessionId, { isActive: true });
        }
        return;
      }

      // If not, create a new session (active as soon as teacher creates it)
      await this.storage.createSession({
        sessionId,
        isActive: true, // Session is active when teacher registers
        teacherLanguage: null, // Will be set when teacher registers
        classCode: null, // Will be set when classroom code is generated
        studentLanguage: null, // Will be set when student registers
        lastActivityAt: new Date() // Set initial activity timestamp
        // startTime is automatically set by the database default
      });
      logger.info('Successfully created new session in storage:', { sessionId });
    } catch (error: any) {
      // Check if it's a duplicate key error (race condition)
      if (error?.code === '23505' || error?.details?.code === '23505' || 
          (error?.code === 'DUPLICATE_ENTRY' && error?.details?.code === '23505') ||
          (error?.code === 'CREATE_FAILED' && error?.details?.code === '23505')) {
        logger.info('Session already exists (race condition detected):', { sessionId });
        return; // Session was created by another concurrent request, that's fine
      }
      
      // Log other errors but don't throw - metrics should not break core functionality
      logger.error('Failed to create or update session in storage:', { sessionId, error });
    }
  }

  /**
   * Update session in storage
   */
  public async updateSession(sessionId: string, updates: Partial<InsertSession>): Promise<boolean> {
    try {
      const result = await this.storage.updateSession(sessionId, updates);
      return !!result; // Return true if update was successful
    } catch (error) {
      logger.error('Failed to update session in storage:', { sessionId, error, updates });
      return false; // Return false on failure
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

  /**
   * Create session in storage with teacher language
   */
  public async createSessionWithLanguage(sessionId: string, teacherLanguage: string): Promise<void> {
    try {
      // Check if a session with this ID already exists
      const existingSession = await this.storage.getSessionById(sessionId);
      if (existingSession) {
        logger.info('Session already exists in storage, updating teacher language:', { sessionId, teacherLanguage });
        const updates: any = {};
        // Session should be active when teacher is present
        updates.isActive = true;
        if (teacherLanguage && teacherLanguage !== 'unknown') {
          updates.teacherLanguage = teacherLanguage;
        }
        if (Object.keys(updates).length > 0) {
          await this.storage.updateSession(sessionId, updates);
        }
        return;
      }

      // If not, create a new session with teacher language (active when teacher registers)
      const sessionData: any = {
        sessionId,
        isActive: true, // Session is active when teacher registers
        lastActivityAt: new Date() // Set initial activity timestamp
        // startTime is automatically set by the database default
      };
      
      if (teacherLanguage && teacherLanguage !== 'unknown') {
        sessionData.teacherLanguage = teacherLanguage;
      }
      
      await this.storage.createSession(sessionData);
      logger.info('Successfully created new session in storage with teacher language:', { sessionId, teacherLanguage });
    } catch (error: any) {
      // Log other errors but don't throw - metrics should not break core functionality
      logger.error('Failed to create or update session in storage:', { sessionId, teacherLanguage, error });
    }
  }
}
