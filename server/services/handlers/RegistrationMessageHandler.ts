/**
 * RegistrationMessageHandler
 * 
 * Handles client registration messages
 * - Follows Single Responsibility Principle
 * - Cleanly separates registration logic from other concerns
 */

import { WebSocketClient, WebSocketClientManager } from '../WebSocketClientManager';
import { WebSocketMessageHandler } from '../WebSocketMessageRouter';

export interface RegistrationMessage {
  type: 'register';
  role?: string;
  languageCode?: string;
  settings?: {
    ttsServiceType?: string;
    [key: string]: any;
  };
}

export class RegistrationMessageHandler implements WebSocketMessageHandler {
  constructor(private clientManager: WebSocketClientManager) {}
  
  /**
   * Check if this handler can process the message type
   */
  public canHandle(type: string): boolean {
    return type === 'register';
  }
  
  /**
   * Handle registration message
   */
  public async handle(client: WebSocketClient, message: any): Promise<boolean> {
    const registrationMsg = message as RegistrationMessage;
    
    // Log registration request
    console.log('Processing registration:', 
      `role=${registrationMsg.role}, languageCode=${registrationMsg.languageCode}`);
    
    // Get current client state
    const clientState = this.clientManager.getClientState(client);
    if (!clientState) {
      console.error('Cannot register unknown client');
      return false;
    }
    
    const currentRole = clientState.role;
    
    // Update role if provided
    if (registrationMsg.role) {
      if (currentRole !== registrationMsg.role) {
        console.log(`Changing client role from ${currentRole} to ${registrationMsg.role}`);
      }
      this.clientManager.updateClientRole(client, registrationMsg.role);
    }
    
    // Update language if provided
    if (registrationMsg.languageCode) {
      this.clientManager.updateClientLanguage(client, registrationMsg.languageCode);
    }
    
    // Update settings if provided
    if (registrationMsg.settings) {
      this.clientManager.updateClientSettings(client, registrationMsg.settings);
    }
    
    // Get updated client state
    const updatedState = this.clientManager.getClientState(client);
    
    // Send registration confirmation
    this.sendRegistrationConfirmation(client, updatedState);
    
    return true;
  }
  
  /**
   * Send registration confirmation to client
   */
  private sendRegistrationConfirmation(client: WebSocketClient, state: any): void {
    const response = {
      type: 'register',
      status: 'success',
      data: {
        role: state?.role,
        languageCode: state?.language,
        settings: state?.settings || {}
      }
    };
    
    client.send(JSON.stringify(response));
  }
}