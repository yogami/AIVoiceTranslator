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
      
      // Send confirmation
      const response: SettingsResponseToClient = {
        type: 'settings',
        status: 'success',
        settings
      };
      
      try {
        context.ws.send(JSON.stringify(response));
      } catch (sendError) {
        logger.error('Error sending settings response:', sendError);
      }
    } catch (error) {
      logger.error('Error handling settings message:', error);
    }
  }
}
