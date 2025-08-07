/**
 * Session Orchestrator - Coordinates all session-related operations
 * 
 * This is the main entry point for session management, providing a clean
 * interface that orchestrates multiple underlying services. It follows the
 * Facade pattern to simplify complex subsystem interactions.
 */

import logger from '../../logger';
import { IStorage } from '../../storage.interface';
import { WebSocketClient } from '../websocket/ConnectionManager';
import { ClassroomSessionManager } from './ClassroomSessionManager';
import { StorageSessionManager } from './StorageSessionManager';
import { SessionLifecycleService } from './SessionLifecycleService';
import { config } from '../../config';

export interface SessionInfo {
  sessionId: string;
  isActive: boolean;
  studentsCount: number;
  classCode?: string;
  teacherId?: string;
  startTime?: Date;
  lastActivityAt?: Date;
}

export interface UserRegistration {
  role: 'teacher' | 'student';
  name: string;
  languageCode: string;
  classroomCode?: string;
  teacherId?: string;
  settings?: Record<string, any>;
}

export interface RegistrationResult {
  success: boolean;
  sessionId: string;
  classroomCode?: string;
  error?: string;
  shouldReconnect?: boolean;
  existingSessionId?: string;
}

/**
 * Main session orchestrator that coordinates all session operations
 */
export class SessionOrchestrator {
  private storage: IStorage;
  private classroomManager: ClassroomSessionManager;
  private storageManager: StorageSessionManager;
  private lifecycleService: SessionLifecycleService;

  constructor(
    storage: IStorage,
    classroomManager: ClassroomSessionManager,
    storageManager: StorageSessionManager,
    lifecycleService: SessionLifecycleService
  ) {
    this.storage = storage;
    this.classroomManager = classroomManager;
    this.storageManager = storageManager;
    this.lifecycleService = lifecycleService;
  }

  /**
   * Handle user registration for both teachers and students
   */
  async registerUser(
    ws: WebSocketClient,
    sessionId: string,
    registration: UserRegistration
  ): Promise<RegistrationResult> {
    try {
      if (registration.role === 'teacher') {
        return await this.registerTeacher(ws, sessionId, registration);
      } else {
        return await this.registerStudent(ws, sessionId, registration);
      }
    } catch (error: any) {
      logger.error('Registration failed:', { error: error.message, registration });
      return {
        success: false,
        sessionId,
        error: 'Registration failed due to internal error'
      };
    }
  }

  /**
   * Register a teacher
   */
  private async registerTeacher(
    ws: WebSocketClient,
    sessionId: string,
    registration: UserRegistration
  ): Promise<RegistrationResult> {
    // Check for existing session if teacherId provided
    if (registration.teacherId) {
      const existingSession = await this.findExistingTeacherSession(registration.teacherId);
      if (existingSession) {
        return await this.handleTeacherReconnection(ws, sessionId, existingSession, registration);
      }
    }

    // Create new teacher session
    return await this.createTeacherSession(ws, sessionId, registration);
  }

  /**
   * Register a student
   */
  private async registerStudent(
    ws: WebSocketClient,
    sessionId: string,
    registration: UserRegistration
  ): Promise<RegistrationResult> {
    // Find the target session for the student
    const targetSession = await this.findStudentTargetSession(sessionId, registration.classroomCode);
    
    if (!targetSession) {
      return {
        success: false,
        sessionId,
        error: 'Session not found. Please ask teacher for a new link.'
      };
    }

    // Join the student to the session
    return await this.joinStudentToSession(ws, targetSession, registration);
  }

  /**
   * Find existing teacher session considering grace periods
   */
  private async findExistingTeacherSession(teacherId: string): Promise<SessionInfo | null> {
    try {
      logger.info(`[SessionOrchestrator] Looking for existing session for teacherId: ${teacherId}`);
      
      // Use grace-period-aware logic instead of simple isActive check
      const gracePeriodThreshold = new Date(Date.now() - config.session.teacherReconnectionGracePeriod);
      logger.info(`[SessionOrchestrator] Grace period threshold: ${gracePeriodThreshold.toISOString()}, grace period: ${config.session.teacherReconnectionGracePeriod}ms`);
      
      const existingSession = await this.storage.findActiveSessionByTeacherId(teacherId);
      logger.info(`[SessionOrchestrator] Storage returned session:`, existingSession ? {
        sessionId: existingSession.sessionId,
        isActive: existingSession.isActive,
        lastActivityAt: existingSession.lastActivityAt,
        endTime: existingSession.endTime
      } : null);
      
      // If we found a session, check if it's within grace period
      if (existingSession && existingSession.lastActivityAt) {
        const sessionLastActivity = new Date(existingSession.lastActivityAt);
        
        // If session is outside grace period, treat it as inactive
        if (sessionLastActivity <= gracePeriodThreshold) {
          logger.info(`[SessionOrchestrator] Teacher session found but outside grace period`, {
            teacherId,
            sessionId: existingSession.sessionId,
            lastActivityAt: sessionLastActivity,
            gracePeriodThreshold,
            gracePeriodMs: config.session.teacherReconnectionGracePeriod
          });
          return null;
        }
        
        logger.info(`[SessionOrchestrator] Teacher session found and within grace period`, {
          teacherId,
          sessionId: existingSession.sessionId,
          lastActivityAt: sessionLastActivity,
          gracePeriodThreshold
        });
      }
      
      return existingSession ? {
        sessionId: existingSession.sessionId,
        isActive: existingSession.isActive ?? false,
        studentsCount: existingSession.studentsCount || 0,
        classCode: existingSession.classCode || undefined,
        teacherId: existingSession.teacherId || undefined,
        startTime: existingSession.startTime || undefined,
        lastActivityAt: existingSession.lastActivityAt || undefined
      } : null;
    } catch (error: any) {
      logger.error('Error finding existing teacher session:', { error: error.message, teacherId });
      return null;
    }
  }

  /**
   * Handle teacher reconnection to existing session
   */
  private async handleTeacherReconnection(
    ws: WebSocketClient,
    newSessionId: string,
    existingSession: SessionInfo,
    registration: UserRegistration
  ): Promise<RegistrationResult> {
    try {
      // Update session activity
      await this.lifecycleService.updateSessionActivity(existingSession.sessionId);

      // Restore classroom code if it exists
      if (existingSession.classCode) {
        this.classroomManager.restoreClassroomSession(existingSession.classCode, existingSession.sessionId);
      }

      return {
        success: true,
        sessionId: existingSession.sessionId,
        classroomCode: existingSession.classCode,
        shouldReconnect: true,
        existingSessionId: existingSession.sessionId
      };
    } catch (error: any) {
      logger.error('Teacher reconnection failed:', { error: error.message, existingSession });
      return {
        success: false,
        sessionId: newSessionId,
        error: 'Failed to reconnect to existing session'
      };
    }
  }

  /**
   * Create new teacher session
   */
  private async createTeacherSession(
    ws: WebSocketClient,
    sessionId: string,
    registration: UserRegistration
  ): Promise<RegistrationResult> {
    try {
      // Create session in storage
      await this.storageManager.createSession(sessionId, registration.teacherId);

      // Generate classroom code
      const classroomCode = await this.classroomManager.generateClassroomCode(sessionId);

      logger.info('Teacher session created:', { sessionId, classroomCode, teacherId: registration.teacherId });

      return {
        success: true,
        sessionId,
        classroomCode
      };
    } catch (error: any) {
      logger.error('Teacher session creation failed:', { error: error.message, sessionId });
      return {
        success: false,
        sessionId,
        error: 'Failed to create teacher session'
      };
    }
  }

  /**
   * Find target session for student
   */
  private async findStudentTargetSession(
    sessionId: string,
    classroomCode?: string
  ): Promise<SessionInfo | null> {
    try {
      // First try the current session
      let session = await this.storage.getSessionById(sessionId);
      
      // If no session or ended session, try classroom code
      if ((!session || session.endTime) && classroomCode) {
        const sessionInfo = this.classroomManager.getSessionByCode(classroomCode);
        if (sessionInfo) {
          session = await this.storage.getSessionById(sessionInfo.sessionId);
        }
      }

      if (!session || session.endTime) {
        return null;
      }

      return {
        sessionId: session.sessionId,
        isActive: session.isActive ?? false,
        studentsCount: session.studentsCount || 0,
        classCode: session.classCode || undefined,
        teacherId: session.teacherId || undefined,
        startTime: session.startTime || undefined,
        lastActivityAt: session.lastActivityAt || undefined
      };
    } catch (error: any) {
      logger.error('Error finding student target session:', { error: error.message, sessionId, classroomCode });
      return null;
    }
  }

  /**
   * Join student to session
   */
  private async joinStudentToSession(
    ws: WebSocketClient,
    targetSession: SessionInfo,
    registration: UserRegistration
  ): Promise<RegistrationResult> {
    try {
      // Prepare session update
      const updates: any = {
        isActive: true,
        studentLanguage: registration.languageCode
      };

      // Update student count and start time if this is the first student
      if (targetSession.studentsCount === 0) {
        updates.startTime = new Date();
        updates.studentsCount = 1;
      } else {
        updates.studentsCount = targetSession.studentsCount + 1;
      }

      // Set classroom code if provided
      if (registration.classroomCode) {
        updates.classCode = registration.classroomCode;
      }

      // Update session
      await this.storageManager.updateSession(targetSession.sessionId, updates);

      // Mark students rejoined if needed
      if (targetSession.studentsCount === 0) {
        await this.lifecycleService.markStudentsRejoined(targetSession.sessionId);
      }

      logger.info('Student joined session:', {
        sessionId: targetSession.sessionId,
        studentName: registration.name,
        newStudentCount: updates.studentsCount
      });

      return {
        success: true,
        sessionId: targetSession.sessionId,
        classroomCode: targetSession.classCode || registration.classroomCode
      };
    } catch (error: any) {
      logger.error('Student join failed:', { error: error.message, targetSession, registration });
      return {
        success: false,
        sessionId: targetSession.sessionId,
        error: 'Failed to join session'
      };
    }
  }

  /**
   * Update session activity
   */
  async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await this.lifecycleService.updateSessionActivity(sessionId);
    } catch (error: any) {
      logger.error('Failed to update session activity:', { error: error.message, sessionId });
    }
  }

  /**
   * End session
   */
  async endSession(sessionId: string, reason: string): Promise<void> {
    try {
      await this.lifecycleService.endSession(sessionId, reason);
    } catch (error: any) {
      logger.error('Failed to end session:', { error: error.message, sessionId, reason });
    }
  }

  /**
   * Get session info
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    try {
      const session = await this.storage.getActiveSession(sessionId);
      return session ? {
        sessionId: session.sessionId,
        isActive: session.isActive ?? false,
        studentsCount: session.studentsCount || 0,
        classCode: session.classCode || undefined,
        teacherId: session.teacherId || undefined,
        startTime: session.startTime || undefined,
        lastActivityAt: session.lastActivityAt || undefined
      } : null;
    } catch (error: any) {
      logger.error('Failed to get session info:', { error: error.message, sessionId });
      return null;
    }
  }
}
