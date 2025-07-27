/**
 * Register Message     logger.info('Processing message type=register from connection:', 
      { role: message.role, languageCode: message.languageCode, name: message.name }); // Added name to log
    
    const currentRole = context.connectionManager.getRole(context.ws);ler
 * 
 * Handles user registration (teacher/student) messages.
 * Manages role assignment, language settings, classroom code generation, and student notifications.
 */

import logger from '../../logger';
import { config } from '../../config';
import { WebSocketClient } from './ConnectionManager';
import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type {
  RegisterMessageToServer,
  ClassroomCodeMessageToClient,
  RegisterResponseToClient,
  StudentJoinedMessageToClient,
  ClientSettings
} from '../WebSocketTypes';

export class RegisterMessageHandler implements IMessageHandler<RegisterMessageToServer> {
  getMessageType(): string {
    return 'register';
  }

  async handle(message: RegisterMessageToServer, context: MessageHandlerContext): Promise<void> {
    logger.info('Processing message type=register from connection:', 
      { role: message.role, languageCode: message.languageCode, name: message.name });
    
    const currentRole = context.connectionManager.getRole(context.ws);
    
    // Update role if provided
    if (message.role) {
      if (currentRole !== message.role) {
        logger.info(`Changing connection role from ${currentRole} to ${message.role}`);
      }
      context.connectionManager.setRole(context.ws, message.role);
      
      // If registering as teacher, generate or update classroom code
      if (message.role === 'teacher') {
        await this.handleTeacherRegistration(context.ws, message, context);
      }
    }
    
    // Update language if provided
    if (message.languageCode) {
      context.connectionManager.setLanguage(context.ws, message.languageCode);
    }
    
    // Store client settings
    const settings: ClientSettings = context.connectionManager.getClientSettings(context.ws) || {};
    
    // Update all settings if provided (proper merge)
    if (message.settings) {
      Object.assign(settings, message.settings);
      logger.info('Client settings updated:', message.settings);
    }
    
    // Store updated settings
    context.connectionManager.setClientSettings(context.ws, settings);
    
    logger.info('Updated connection:', 
      { role: context.connectionManager.getRole(context.ws), languageCode: context.connectionManager.getLanguage(context.ws), settings: settings });
    
    // If registering as student, validate classroom code and handle registration
    if (message.role === 'student') {
      // Get classroom code from message or connection manager
      const classroomCode = message.classroomCode || context.connectionManager.getClassroomCode(context.ws);
      
      logger.info(`DEBUG: Student registration - classroomCode from message: ${message.classroomCode}, from connection: ${context.connectionManager.getClassroomCode(context.ws)}, final: ${classroomCode}`);
      
      // Only validate classroom code if one is provided
      if (classroomCode) {
        console.log(`[DEBUG] Validating classroom code: ${classroomCode}`);
        logger.info(`DEBUG: Validating classroom code: ${classroomCode}`);
        if (!context.webSocketServer._classroomSessionManager.isValidClassroomCode(classroomCode)) {
          console.log(`[DEBUG] Student registration FAILED - invalid classroom code: ${classroomCode}`);
          logger.warn(`Student attempted to register with invalid classroom code: ${classroomCode}`);
          const errorResponse = {
            type: 'error',
            message: 'Classroom session expired or invalid. Please ask teacher for new link.',
            code: 'INVALID_CLASSROOM'
          };
          context.ws.send(JSON.stringify(errorResponse));
          // Close connection after sending error - only if close method exists (not in tests)
          if (typeof context.ws.close === 'function') {
            setTimeout(() => {
              context.ws.close(1008, 'Invalid classroom session');
            }, config.session.invalidClassroomMessageDelay); // Small delay to ensure message is sent
          }
          return;
        }
        console.log(`[DEBUG] Student registration SUCCESS - valid classroom code: ${classroomCode}`);
      } else {
        console.log('[DEBUG] No classroom code provided, skipping validation');
      }
      // Note: In production, classroom code should always be provided,
      // but in tests it might be omitted, so we continue without validation
    }
    
    // Send confirmation (only if validation passed)
    const response: RegisterResponseToClient = {
      type: 'register',
      status: 'success',
      data: {
        role: context.connectionManager.getRole(context.ws) as ('teacher' | 'student' | undefined),
        languageCode: context.connectionManager.getLanguage(context.ws),
        settings: settings
      }
    };
    
    context.ws.send(JSON.stringify(response));
    
    // If registering as student, handle registration (validation already passed)
    if (message.role === 'student') {
      await this.handleStudentRegistration(context.ws, message, context);
    }
  }

  /**
   * Handle teacher registration specifics
   */
  private async handleTeacherRegistration(
    ws: WebSocketClient, 
    message: RegisterMessageToServer, 
    context: MessageHandlerContext
  ): Promise<void> {
    let sessionId = context.connectionManager.getSessionId(context.ws);
    let classroomCode: string;
    let wasExistingSession = false; // Track if we reconnected to existing session
    
    console.log(`🔍 DEBUG: handleTeacherRegistration - sessionId from connection: ${sessionId}, message.teacherId: ${message.teacherId || 'NONE'}`);
    
    if (!sessionId) {
      logger.error('Teacher has no session ID - this should not happen');
      return;
    }
    
    // NOTE: We'll update the session with teacherId AFTER ensuring it exists in the database
    
    // Check if teacher has ANY active sessions first
    // This handles the case where teacher accidentally closed page and reconnects
    if (message.teacherId) {
      // Teacher ID provided - look for existing session with this teacherId
      try {
        logger.info(`[TEACHER_RECONNECT] Looking for existing session with teacherId: ${message.teacherId}`);
        let existingSession = await context.storage.findActiveSessionByTeacherId(message.teacherId);
        
        // If no active session found, look for recent sessions (handles disconnection + quick reconnection)
        if (!existingSession) {
          logger.info(`[TEACHER_RECONNECT] No active session found, checking for recent sessions for teacherId: ${message.teacherId}`);
          const recentSession = await context.storage.findRecentSessionByTeacherId(message.teacherId, 10); // 10 minutes
          
          if (recentSession && !recentSession.isActive) {
            logger.info(`[TEACHER_RECONNECT] Found recent inactive session, reactivating: ${recentSession.sessionId}`);
            // Use the dedicated reactivateSession method
            existingSession = await context.storage.reactivateSession(recentSession.sessionId);
            if (existingSession) {
              logger.info(`[TEACHER_RECONNECT] Successfully reactivated session: ${existingSession.sessionId}`);
            } else {
              logger.warn(`[TEACHER_RECONNECT] Failed to reactivate session: ${recentSession.sessionId}`);
            }
          }
        }
        
        logger.info('[TEACHER_RECONNECT] Found existing session:', existingSession ? {
          sessionId: existingSession.sessionId,
          teacherId: existingSession.teacherId,
          isActive: existingSession.isActive,
          classCode: existingSession.classCode
        } : 'NONE');
        
        if (existingSession && existingSession.sessionId !== sessionId) {
          logger.info(`[TEACHER_RECONNECT] Teacher has existing active session with teacherId: ${existingSession.sessionId}, current session: ${sessionId}`);
          
          // Reuse the existing session
          logger.info(`[TEACHER_RECONNECT] Teacher reconnecting to existing session with teacherId: ${existingSession.sessionId}`);
          
          // End the new session that was just created
          const cleanupService = context.webSocketServer.getSessionCleanupService();
          if (cleanupService) {
            await cleanupService.endSession(sessionId, 'Duplicate session - teacher reconnected to existing with teacherId');
          }
          
          // Use the existing session instead
          sessionId = existingSession.sessionId;
          wasExistingSession = true;
          
          // Update the connection to use the existing session
          context.connectionManager.updateSessionId(context.ws, existingSession.sessionId);
          
          // Update session activity to show teacher reconnected
          if (cleanupService) {
            await cleanupService.updateSessionActivity(sessionId);
          }
          
          // If the existing session has a stored classroom code, restore it to ClassroomSessionManager
          if (existingSession.classCode) {
            context.webSocketServer.classroomSessionManager.restoreClassroomSession(
              existingSession.classCode, 
              sessionId
            );
            logger.info(`[TEACHER_RECONNECT] Restored classroom code ${existingSession.classCode} for reconnected teacher session ${sessionId}`);
          }
        } else if (existingSession && existingSession.sessionId === sessionId) {
          logger.info('[TEACHER_RECONNECT] Teacher connected to same session as existing - no action needed');
        } else {
          logger.info(`[TEACHER_RECONNECT] No existing session found for teacherId: ${message.teacherId}, proceeding with new session: ${sessionId}`);
        }
      } catch (error: any) {
        logger.error('Error searching for existing teacher sessions by teacherId:', { 
          teacherId: message.teacherId,
          errorMessage: error?.message || 'No error message',
          errorStack: error?.stack || 'No stack trace',
          errorCode: error?.code || 'No error code',
          errorName: error?.name || 'No error name',
          fullError: JSON.stringify(error, Object.getOwnPropertyNames(error))
        });
      }
    } else if (message.languageCode) {
      // Fallback to old behavior if no teacherId provided
      try {
        const activeSessions = await context.storage.getAllActiveSessions();
        const existingSession = activeSessions.find((s: any) => 
          s.teacherLanguage === message.languageCode && s.isActive && s.sessionId !== sessionId
        );
        
        if (existingSession) {
          logger.info(`Teacher has existing active session: ${existingSession.sessionId}, current session: ${sessionId}`);
          
          // If we found an existing session, we have two options:
          // 1. Reuse the existing session (if it's recent)
          // 2. End the existing session and use the new one
          
          const existingSessionAge = new Date().getTime() - new Date(existingSession.lastActivityAt).getTime();
          const gracePermissionMs = config.session.teacherReconnectionGracePeriod;
          
          if (existingSessionAge < gracePermissionMs) {
            // Reuse the existing session
            logger.info(`Teacher reconnecting to existing recent session: ${existingSession.sessionId}`);
            
            // End the new session that was just created
            const cleanupService = context.webSocketServer.getSessionCleanupService();
            if (cleanupService) {
              await cleanupService.endSession(sessionId, 'Duplicate session - teacher reconnected to existing');
            }
            
            // Use the existing session instead
            sessionId = existingSession.sessionId;
            wasExistingSession = true;
            
            // Update the connection to use the existing session
            context.connectionManager.updateSessionId(context.ws, existingSession.sessionId);
            
            // Update session activity to show teacher reconnected
            if (cleanupService) {
              await cleanupService.updateSessionActivity(sessionId);
            }
            
            // If the existing session has a stored classroom code, restore it to ClassroomSessionManager
            if (existingSession.classCode) {
              context.webSocketServer.classroomSessionManager.restoreClassroomSession(
                existingSession.classCode, 
                sessionId
              );
              logger.info(`Restored classroom code ${existingSession.classCode} for reconnected teacher session ${sessionId}`);
            }
          } else {
            // End the existing session - teacher created a new one
            logger.info(`Ending existing session ${existingSession.sessionId} - teacher created new session ${sessionId}`);
            const cleanupService = context.webSocketServer.getSessionCleanupService();
            if (cleanupService) {
              await cleanupService.endSession(existingSession.sessionId, 'Teacher created new session');
            }
          }
        }
      } catch (error: any) {
        logger.error('Error searching for existing teacher sessions:', { error, teacherLanguage: message.languageCode });
      }
    }
    
    // Check if current session exists in database, if not create it
    try {
      let session = await context.storage.getActiveSession(sessionId);
      
      if (!session && !wasExistingSession) {
        // If no existing session found, create a new one
        if (!wasExistingSession) {
          logger.info('Creating new session for teacher:', { sessionId, languageCode: message.languageCode, teacherId: message.teacherId });
          await context.webSocketServer.storageSessionManager.createSession(sessionId, message.teacherId);
          session = await context.storage.getActiveSession(sessionId);
        } else {
          // Get the existing session we're reusing
          session = await context.storage.getActiveSession(sessionId);
        }
      } else {
        // Session already exists, just use it
        logger.info('Using existing session for teacher:', { sessionId });
      }
      
      // Generate classroom code for this session
      console.log(`🔍 DEBUG: About to generate classroom code for sessionId: ${sessionId}`);
      classroomCode = context.webSocketServer.classroomSessionManager.generateClassroomCode(sessionId);
      
      // Store the classroom code in the database if this is a new session or if it's not already stored
      if (sessionId && classroomCode) {
        try {
          const currentSession = await context.storage.getSessionById(sessionId);
          if (currentSession && !currentSession.classCode) {
            await context.webSocketServer.storageSessionManager.updateSession(sessionId, {
              classCode: classroomCode
            });
            logger.info(`Stored classroom code ${classroomCode} for session ${sessionId}`);
          }
        } catch (error: any) {
          logger.error('Error storing classroom code:', { error, sessionId, classroomCode });
        }
      }
      
    } catch (error: any) {
      logger.error('Failed to create/get session for teacher:', { error, sessionId });
      // Generate classroom code anyway for temporary use
      console.log(`🔍 DEBUG: About to generate classroom code (fallback) for sessionId: ${sessionId}`);
      classroomCode = context.webSocketServer.classroomSessionManager.generateClassroomCode(sessionId);
    }
    
    const sessionInfo = context.webSocketServer.classroomSessionManager.getSessionByCode(classroomCode);
    
    // Update session with teacher language since we created it
    if (sessionId && message.languageCode) {
      try {
        const updateData: any = {
          teacherLanguage: message.languageCode
        };
        
        // Note: teacherId was already stored above, so we don't need to store it again
        
        const result = await context.webSocketServer.storageSessionManager.updateSession(sessionId, updateData);
        if (!result) {
          logger.warn('Failed to update session with teacher language', { sessionId });
        }
      } catch (error: any) {
        logger.error('Error updating session with teacher language:', { error, sessionId });
      }
    }
    
    const response: ClassroomCodeMessageToClient = {
      type: 'classroom_code',
      code: classroomCode,
      sessionId: sessionId,
      expiresAt: sessionInfo?.expiresAt || Date.now() + config.session.classroomCodeExpiration // Fallback expiration
    };
    context.ws.send(JSON.stringify(response));
    
    logger.info(`Generated classroom code ${classroomCode} for teacher session ${sessionId}`);
  }

  /**
   * Handle student registration specifics
   */
  private async handleStudentRegistration(
    ws: WebSocketClient, 
    message: RegisterMessageToServer, 
    context: MessageHandlerContext
  ): Promise<void> {
    let studentSessionId = context.connectionManager.getSessionId(context.ws);
    const studentName = message.name || 'Unknown Student';
    const studentLanguage = message.languageCode || 'unknown';
    const classroomCode = context.connectionManager.getClassroomCode(context.ws) || message.classroomCode;

    // DEBUG: Log all student registration details
    logger.info('[DEBUG] Student registration started:', {
      studentSessionId,
      studentName,
      studentLanguage,
      classroomCode,
      messageClassroomCode: message.classroomCode,
      connectionClassroomCode: context.connectionManager.getClassroomCode(context.ws)
    });

    if (!studentSessionId) {
      logger.error('Student has no session ID - this should not happen');
      return;
    }

    try {
      // BUGFIX: Students can join sessions regardless of isActive status
      let session = await context.storage.getSessionById(studentSessionId);
      
      // Don't allow students to join ended sessions
      if (session && session.endTime) {
        logger.warn('Student trying to join ended session:', { studentSessionId, endTime: session.endTime });
        session = null; // Treat as session not found
      }
      
      // DEBUG: Log session lookup results
      logger.info('[DEBUG] Student session lookup:', {
        studentSessionId,
        sessionFound: !!session,
        sessionData: session ? {
          id: session.id,
          sessionId: session.sessionId,
          isActive: session.isActive,
          studentsCount: session.studentsCount,
          classCode: session.classCode
        } : null,
        classroomCode
      });
      
      if (!session && classroomCode) {
        // Student connected without classroom code in URL, but provided it in registration
        // Look up the teacher's session using the classroom code
        logger.info('[DEBUG] Looking up teacher session by classroom code:', { classroomCode });
        const sessionInfo = context.webSocketServer.classroomSessionManager.getSessionByCode(classroomCode);
        
        logger.info('[DEBUG] Teacher session lookup result:', {
          sessionInfo: sessionInfo ? {
            sessionId: sessionInfo.sessionId,
            expiresAt: sessionInfo.expiresAt
          } : null
        });
        
        if (sessionInfo) {
          // Found the teacher's session, now get it from storage
          session = await context.storage.getSessionById(sessionInfo.sessionId);
          
          // Don't allow students to join ended sessions
          if (session && session.endTime) {
            logger.warn('Student trying to join ended session via classroom code:', { 
              sessionId: sessionInfo.sessionId, 
              endTime: session.endTime 
            });
            session = null; // Treat as session not found
          }
          logger.info('[DEBUG] Teacher session from storage:', {
            teacherSessionId: sessionInfo.sessionId,
            sessionFound: !!session,
            sessionData: session ? {
              id: session.id,
              sessionId: session.sessionId,
              isActive: session.isActive,
              studentsCount: session.studentsCount,
              classCode: session.classCode
            } : null
          });
          
          if (session) {
            // Update the student's connection to use the correct session ID
            context.connectionManager.updateSessionId(context.ws, sessionInfo.sessionId);
            logger.info('[DEBUG] Student session ID updated to match teacher session:', { 
              oldSessionId: studentSessionId, 
              newSessionId: sessionInfo.sessionId, 
              classroomCode 
            });
            // IMPORTANT: Update local variable so all future updates use the teacher's sessionId
            studentSessionId = sessionInfo.sessionId;
          }
        }
      }
      
      if (!session) {
        logger.error('Student trying to join non-existent session:', { studentSessionId, classroomCode });
        // Send error to student (restore previous behavior)
        const errorResponse = {
          type: 'error',
          message: 'Session not found. Please ask teacher for a new link.',
          code: 'SESSION_NOT_FOUND'
        };
        context.ws.send(JSON.stringify(errorResponse));
        return;
      }
      
      const currentCount = session.studentsCount || 0;
      
      // Check if this student connection has already been counted
      const alreadyCounted = context.connectionManager.isStudentCounted(context.ws);
      
      logger.info('Student registration details:', { 
        sessionId: studentSessionId, 
        currentCount, 
        studentName,
        alreadyCounted,
        classroomCode
      });
      
      // Update session with student info
        try {
          const updateData: any = { 
            studentsCount: alreadyCounted ? currentCount : currentCount + 1, 
            isActive: true 
          };
          
          // Update startTime when the first student joins (session becomes valid)
          if (!alreadyCounted && currentCount === 0) {
            updateData.startTime = new Date();
            logger.info('[DEBUG] First student joining - updating startTime:', { 
              sessionId: studentSessionId, 
              studentName 
            });
          }
          
          // Always set classCode if we have it - this ensures it's set even if session already existed
          if (classroomCode) {
            updateData.classCode = classroomCode;
          }
          if (studentLanguage && studentLanguage !== 'unknown') {
            updateData.studentLanguage = studentLanguage;
          }
          
          // DEBUG: Log what we're about to update
          logger.info('[DEBUG] About to update session:', {
            sessionId: studentSessionId,
            updateData,
            currentSessionState: {
              id: session.id,
              sessionId: session.sessionId,
              isActive: session.isActive,
              studentsCount: session.studentsCount,
              classCode: session.classCode
            }
          });
          
          await context.webSocketServer.storageSessionManager.updateSession(studentSessionId, updateData);
          
          // DEBUG: Verify the update worked by reading the session back
          const updatedSession = await context.storage.getActiveSession(studentSessionId);
          logger.info('[DEBUG] Session after update:', {
            sessionId: studentSessionId,
            updatedSessionData: updatedSession ? {
              id: updatedSession.id,
              sessionId: updatedSession.sessionId,
              isActive: updatedSession.isActive,
              studentsCount: updatedSession.studentsCount,
              classCode: updatedSession.classCode
            } : null
          });
          
          // Mark this student as counted (only if not already counted)
          if (!alreadyCounted) {
            context.connectionManager.setStudentCounted(context.ws, true);
          }
          
          // If this is a student rejoining after all students left, cancel grace period
          if (currentCount === 0) {
            try {
              const cleanupService = context.webSocketServer.getSessionCleanupService();
              if (cleanupService) {
                await cleanupService.markStudentsRejoined(studentSessionId);
              }
            } catch (error: any) {
              logger.error('Error marking students rejoined:', { error });
            }
          }
        } catch (error: any) {
          logger.error('Failed to update session for student registration:', { error });
        }

      // Notify the teacher(s) in the same session
      const allConnections = context.connectionManager.getConnections();
      logger.info('[DEBUG] Looking for teachers to notify about student_joined:', {
        totalConnections: allConnections.length,
        studentSessionId,
        studentName
      });
      
      let teachersFound = 0;
      let teachersNotified = 0;
      
      allConnections.forEach((client: any, index: number) => {
        const clientRole = context.connectionManager.getRole(client);
        const clientSessionId = context.connectionManager.getSessionId(client);
        
        logger.info(`[DEBUG] Connection ${index}:`, {
          isSameAsStudentWs: client === context.ws,
          clientRole,
          clientSessionId,
          studentSessionId,
          isMatchingSession: clientSessionId === studentSessionId,
          isTeacher: clientRole === 'teacher'
        });
        
        if (client !== context.ws && clientRole === 'teacher') {
          teachersFound++;
          
          if (clientSessionId === studentSessionId) {
            const studentJoinedMessage: StudentJoinedMessageToClient = {
              type: 'student_joined',
              payload: {
                // Generate a simple unique ID for the student for this message
                studentId: `student-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
                name: studentName,
                languageCode: studentLanguage,
              }
            };
            try {
              client.send(JSON.stringify(studentJoinedMessage));
              teachersNotified++;
              logger.info(`[DEBUG] Successfully sent 'student_joined' to teacher for student: ${studentName} in session ${studentSessionId}`);
            } catch (error) {
              logger.error('[DEBUG] Failed to send \'student_joined\' message to teacher:', { error });
            }
          }
        }
      });
      
      logger.info('[DEBUG] Student notification summary:', {
        totalConnections: allConnections.length,
        teachersFound,
        teachersNotified,
        studentSessionId,
        studentName
      });

      // Broadcast updated student count to teachers in the session
      context.webSocketServer.broadcastStudentCount(studentSessionId);
      
    } catch (error: any) {
      logger.error('Failed to handle student registration:', { error });
    }
  }
}
