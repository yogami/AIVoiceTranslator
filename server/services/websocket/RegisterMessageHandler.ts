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
    
    // Update text-to-speech service type if provided
    if (message.settings?.ttsServiceType) {
      settings.ttsServiceType = message.settings.ttsServiceType;
      logger.info(`Client requested TTS service type: ${settings.ttsServiceType}`);
    }
    
    // Store updated settings
    context.connectionManager.setClientSettings(context.ws, settings);
    
    logger.info('Updated connection:', 
      { role: context.connectionManager.getRole(context.ws), languageCode: context.connectionManager.getLanguage(context.ws), ttsService: settings.ttsServiceType || 'default' });
    
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
    const sessionId = context.connectionManager.getSessionId(context.ws);
    if (sessionId) {
      const classroomCode = context.webSocketServer.classroomSessionManager.generateClassroomCode(sessionId);
      const sessionInfo = context.webSocketServer.classroomSessionManager.getSessionByCode(classroomCode);
      
      // Update session with teacher language - retry on failure to handle timing issues
      if (message.languageCode) {
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
        sessionId: sessionId,
        expiresAt: sessionInfo?.expiresAt || Date.now() + (2 * 60 * 60 * 1000) // Fallback expiration
      };
      context.ws.send(JSON.stringify(response));
      
      logger.info(`Generated classroom code ${classroomCode} for teacher session ${sessionId}`);
    }
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

    if (studentSessionId) {
      // Fetch current session to get current studentsCount
      context.storage.getActiveSession(studentSessionId).then((session: any) => {
        const currentCount = session?.studentsCount || 0;
        // Always ensure session is active when a student joins
        context.webSocketServer.storageSessionManager.updateSession(studentSessionId, { 
          studentsCount: currentCount + 1, 
          isActive: true 
        }).catch((error: any) => {
          logger.error('Failed to increment studentsCount for session:', { error });
        });
      }).catch((error: any) => {
        logger.error('Failed to fetch session for incrementing studentsCount:', { error });
      });

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
