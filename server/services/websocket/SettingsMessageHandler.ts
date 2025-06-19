/**
 * Settings Message Handler
 * 
 * Handles client settings update messages.
 * Manages TTS service preferences and other client-specific configurations.
 */

import logger from '../../logger';
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
    const role = context.connectionManager.getRole(context.ws);
    
    // Initialize settings for this client if not already present
    const settings: ClientSettings = context.connectionManager.getClientSettings(context.ws) || {};
    
    // Update settings with new values
    if (message.settings) {
      Object.assign(settings, message.settings);
    }
    
    // Special handling for ttsServiceType since it can be specified outside settings object
    if (message.ttsServiceType) {
      settings.ttsServiceType = message.ttsServiceType;
      logger.info(`Updated TTS service type for ${role} to: ${settings.ttsServiceType}`);
    }
    
    // Store updated settings
    context.connectionManager.setClientSettings(context.ws, settings);
    
    // Send confirmation
    const response: SettingsResponseToClient = {
      type: 'settings',
      status: 'success',
      settings
    };
    
    context.ws.send(JSON.stringify(response));
  }
}
