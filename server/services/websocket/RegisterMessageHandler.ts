/**
 * Register Message     logger.info('Processing message type=register from connection:', 
      { role: message.role, languageCode: message.languageCode, name: message.name }); // Added name to log
    
    const currentRole = context.connectionManager.getRole(context.ws);ler
 * 
 * Handles user registration (teacher/student) messages.
 * Manages role assignment, language settings, classroom code generation, and student notifications.
 */

import logger from '../../logger';
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
      logger.info(`Client settings updated:`, message.settings);
    }
    
    // Store updated settings
    context.connectionManager.setClientSettings(context.ws, settings);
    
    logger.info('Updated connection:', 
      { role: context.connectionManager.getRole(context.ws), languageCode: context.connectionManager.getLanguage(context.ws), settings: settings });
    
    // Send confirmation
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
    
    // If registering as student, increment studentsCount in storage and notify teacher
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
    // Generate a classroom code for teachers immediately, even without a session
    // The actual session will be created when the first student joins
    let sessionId = context.connectionManager.getSessionId(context.ws);
    let classroomCode: string;
    
    if (sessionId) {
      // Teacher already has a session, use existing logic
      classroomCode = context.webSocketServer.classroomSessionManager.generateClassroomCode(sessionId);
    } else {
      // Teacher doesn't have a session yet, generate a temporary classroom code
      // Create a temporary session identifier for classroom code generation
      const tempSessionId = `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      classroomCode = context.webSocketServer.classroomSessionManager.generateClassroomCode(tempSessionId);
      
      // Store the classroom code temporarily so students can find this teacher later
      // The actual session will be created when the first student joins
      logger.info(`Generated temporary classroom code ${classroomCode} for teacher (no session yet)`);
    }
    
    const sessionInfo = context.webSocketServer.classroomSessionManager.getSessionByCode(classroomCode);
    
    // Update session with teacher language - retry on failure to handle timing issues
    // Only do this if we have a real sessionId (not temporary)
    if (sessionId && message.languageCode) {
      let retryCount = 0;
      const maxRetries = 3;
      while (retryCount < maxRetries) {
        try {
          const result = await context.webSocketServer.storageSessionManager.updateSession(sessionId, {
            teacherLanguage: message.languageCode
          });
          if (result) {
            break; // Success
          } else {
            retryCount++;
            if (retryCount < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, 10)); // Small delay before retry
            }
          }
        } catch (error: any) {
          logger.error('Failed to update session with teacher language:', { error, attempt: retryCount + 1 });
          break;
        }
      }
    }
    
    const response: ClassroomCodeMessageToClient = {
      type: 'classroom_code',
      code: classroomCode,
      sessionId: sessionId || undefined, // Don't send temporary sessionId to client
      expiresAt: sessionInfo?.expiresAt || Date.now() + (2 * 60 * 60 * 1000) // Fallback expiration
    };
    context.ws.send(JSON.stringify(response));
    
    logger.info(`Generated classroom code ${classroomCode} for teacher${sessionId ? ` session ${sessionId}` : ' (no session yet)'}`);
  }

  /**
   * Handle student registration specifics
   */
  private async handleStudentRegistration(
    ws: WebSocketClient, 
    message: RegisterMessageToServer, 
    context: MessageHandlerContext
  ): Promise<void> {
    const studentSessionId = context.connectionManager.getSessionId(context.ws);
    const studentName = message.name || 'Unknown Student';
    const studentLanguage = message.languageCode || 'unknown';
    const classroomCode = message.classroomCode;

    if (studentSessionId) {
      // Check if session exists - if not, create it (first student joining)
      try {
        let session = await context.storage.getActiveSession(studentSessionId);
        
        if (!session) {
          // First student joining - create the session
          logger.info('Creating new session for first student:', { studentSessionId, classroomCode });
          try {
            await context.webSocketServer.storageSessionManager.createSession(studentSessionId);
          } catch (error: any) {
            // If session already exists (race condition), ignore the error
            if (error?.code !== 'CREATE_FAILED' && error?.details?.code !== '23505') {
              throw error;
            }
            logger.info('Session already exists (race condition handled):', { studentSessionId });
          }
          session = await context.storage.getActiveSession(studentSessionId);
        }
        
        const currentCount = session?.studentsCount || 0;
        
        // Check if this student connection has already been counted
        const alreadyCounted = context.connectionManager.isStudentCounted(context.ws);
        
        logger.info('DEBUG: Student registration details:', { 
          sessionId: studentSessionId, 
          currentCount, 
          studentName,
          sessionExists: !!session,
          alreadyCounted
        });
        
        // Update session with student info
        try {
          const updateData: any = { 
            studentsCount: alreadyCounted ? currentCount : currentCount + 1, 
            isActive: true 
          };
          
          // Add classCode and studentLanguage if provided
          if (classroomCode) {
            updateData.classCode = classroomCode;
          }
          if (studentLanguage && studentLanguage !== 'unknown') {
            updateData.studentLanguage = studentLanguage;
          }
          
          await context.webSocketServer.storageSessionManager.updateSession(studentSessionId, updateData);
          
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
      } catch (error: any) {
        logger.error('Failed to handle session for student registration:', { error });
      }

      // Notify the teacher(s) in the same session
      context.connectionManager.getConnections().forEach((client: any) => {
        const clientRole = context.connectionManager.getRole(client);
        const clientSessionId = context.connectionManager.getSessionId(client);
        
        if (client !== context.ws && clientRole === 'teacher' && clientSessionId === studentSessionId) {
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
            logger.info(`Sent 'student_joined' to teacher for student: ${studentName} in session ${studentSessionId}`);
          } catch (error) {
            logger.error(`Failed to send 'student_joined' message to teacher:`, { error });
          }
        }
      });
    }
  }
}
