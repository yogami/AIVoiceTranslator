/**
 * RegistrationMessageHandler Unit Tests
 * 
 * Tests the registration message handling functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistrationMessageHandler } from '../../../../server/services/handlers/RegistrationMessageHandler';
import { WebSocketClientManager, WebSocketClient } from '../../../../server/services/WebSocketClientManager';

// Mock WebSocket client implementation
class MockWebSocketClient {
  isAlive: boolean = true;
  sessionId?: string;
  send = vi.fn();
  on = vi.fn(() => this);
  terminate = vi.fn();
  ping = vi.fn();
}

describe('RegistrationMessageHandler', () => {
  let handler: RegistrationMessageHandler;
  let clientManager: WebSocketClientManager;
  let mockClient: WebSocketClient;
  
  beforeEach(() => {
    clientManager = new WebSocketClientManager();
    handler = new RegistrationMessageHandler(clientManager);
    mockClient = new MockWebSocketClient() as unknown as WebSocketClient;
    
    // Register the client
    clientManager.registerClient(mockClient);
  });
  
  describe('canHandle', () => {
    it('should return true for register message type', () => {
      expect(handler.canHandle('register')).toBe(true);
    });
    
    it('should return false for other message types', () => {
      expect(handler.canHandle('transcription')).toBe(false);
      expect(handler.canHandle('audio')).toBe(false);
    });
  });
  
  describe('handle', () => {
    it('should update client role when provided', async () => {
      const message = {
        type: 'register',
        role: 'teacher'
      };
      
      const result = await handler.handle(mockClient, message);
      
      expect(result).toBe(true);
      
      // Verify client state updated
      const state = clientManager.getClientState(mockClient);
      expect(state?.role).toBe('teacher');
      
      // Verify confirmation sent
      expect(mockClient.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('register');
      expect(sentMessage.status).toBe('success');
      expect(sentMessage.data.role).toBe('teacher');
    });
    
    it('should update client language when provided', async () => {
      const message = {
        type: 'register',
        languageCode: 'fr-FR'
      };
      
      const result = await handler.handle(mockClient, message);
      
      expect(result).toBe(true);
      
      // Verify client state updated
      const state = clientManager.getClientState(mockClient);
      expect(state?.language).toBe('fr-FR');
      
      // Verify confirmation sent
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(sentMessage.data.languageCode).toBe('fr-FR');
    });
    
    it('should update client settings when provided', async () => {
      const message = {
        type: 'register',
        settings: {
          ttsServiceType: 'openai',
          volume: 0.8
        }
      };
      
      const result = await handler.handle(mockClient, message);
      
      expect(result).toBe(true);
      
      // Verify client settings updated
      const state = clientManager.getClientState(mockClient);
      expect(state?.settings).toEqual({
        ttsServiceType: 'openai',
        volume: 0.8
      });
      
      // Verify settings in response
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(sentMessage.data.settings).toEqual({
        ttsServiceType: 'openai',
        volume: 0.8
      });
    });
    
    it('should return false for unregistered clients', async () => {
      const unregisteredClient = new MockWebSocketClient() as unknown as WebSocketClient;
      
      const message = {
        type: 'register',
        role: 'teacher'
      };
      
      const result = await handler.handle(unregisteredClient, message);
      
      expect(result).toBe(false);
      expect(unregisteredClient.send).not.toHaveBeenCalled();
    });
    
    it('should handle multiple registration fields simultaneously', async () => {
      const message = {
        type: 'register',
        role: 'student',
        languageCode: 'es-ES',
        settings: {
          ttsServiceType: 'browser'
        }
      };
      
      const result = await handler.handle(mockClient, message);
      
      expect(result).toBe(true);
      
      // Verify all fields updated
      const state = clientManager.getClientState(mockClient);
      expect(state?.role).toBe('student');
      expect(state?.language).toBe('es-ES');
      expect(state?.settings.ttsServiceType).toBe('browser');
      
      // Verify response includes all updated fields
      const sentMessage = JSON.parse(mockClient.send.mock.calls[0][0]);
      expect(sentMessage.data.role).toBe('student');
      expect(sentMessage.data.languageCode).toBe('es-ES');
      expect(sentMessage.data.settings.ttsServiceType).toBe('browser');
    });
  });
});