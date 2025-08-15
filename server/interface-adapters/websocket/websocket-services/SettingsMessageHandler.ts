/**
 * Settings Message Handler
 * 
 * Handles client settings update messages.
 * Manages TTS service preferences and other client-specific configurations.
 */

import logger from '../../../logger';
import { WebSocketClient } from './ConnectionManager';
import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type {
  SettingsMessageToServer,
  SettingsResponseToClient,
  ClientSettings
} from '../WebSocketTypes';
import { FeatureFlags } from '../../../application/services/config/FeatureFlags';

export class SettingsMessageHandler implements IMessageHandler<SettingsMessageToServer> {
  getMessageType(): string {
    return 'settings';
  }

  async handle(message: SettingsMessageToServer, context: MessageHandlerContext): Promise<void> {
    try {
      const role = context.connectionManager.getRole(context.ws);
      
      // Initialize settings for this client if not already present
      const settings: ClientSettings = context.connectionManager.getClientSettings(context.ws) || {};
      
      // Special handling for legacy ttsServiceType field (applied first, so settings object takes priority)
      if (message.ttsServiceType) {
        settings.ttsServiceType = message.ttsServiceType;
        logger.info(`Updated TTS service type for ${role} to: ${settings.ttsServiceType}`);
      }
      
      // Update settings with new values (this will override the legacy field if both are present)
      if (message.settings) {
        Object.assign(settings, message.settings);
      }
      
      // Normalize translationMode default to 'auto' if not specified or invalid
      if (settings.translationMode !== 'manual') {
        settings.translationMode = 'auto';
      }

      // Store updated settings
      context.connectionManager.setClientSettings(context.ws, settings);
      
      // Send confirmation + current teacher mode (for students UI hints)
      const response: SettingsResponseToClient = { type: 'settings', status: 'success', settings };
      const teacherModeMessage = { type: 'teacher_mode', mode: settings.translationMode } as const;
      try {
        context.ws.send(JSON.stringify(response));
      } catch (sendError) {
        logger.error('Error sending settings response:', sendError);
      }
      try {
        // Broadcast teacher_mode to all students in same session
        const sessionId = context.connectionManager.getSessionId(context.ws);
        const { connections } = context.connectionManager.getStudentConnectionsAndLanguagesForSession(sessionId);
        connections.forEach((studentWs: any) => {
          if (studentWs && studentWs.readyState === 1) {
            studentWs.send(JSON.stringify(teacherModeMessage));
          }
        });
        // Classroom modes broadcast if enabled and teacher set classroomMode
        if (FeatureFlags.CLASSROOM_MODES && settings.classroomMode && context.connectionManager.getRole(context.ws) === 'teacher') {
          connections.forEach((studentWs: any) => {
            if (studentWs && studentWs.readyState === 1) {
              studentWs.send(JSON.stringify({ type: 'classroom_mode', mode: settings.classroomMode, timestamp: Date.now() }));
            }
          });
        }
      } catch (broadcastError) {
        logger.error('Error broadcasting settings:', broadcastError);
      }
    } catch (error) {
      logger.error('Error handling settings message:', error);
    }
  }
}
