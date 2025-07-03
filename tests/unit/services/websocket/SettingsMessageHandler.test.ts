import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SettingsMessageHandler } from '../../../../server/services/websocket/SettingsMessageHandler';
import { MessageHandlerContext } from '../../../../server/services/websocket/MessageHandler';
import { WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import type { SettingsMessageToServer, ClientSettings } from '../../../../server/services/WebSocketTypes';
import logger from '../../../../server/logger';

// Mock logger
vi.mock('../../../../server/logger', () => ({
  default: {
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    info: vi.fn()
  }
}));

describe('SettingsMessageHandler', () => {
  let handler: SettingsMessageHandler;
  let mockWs: WebSocketClient;
  let context: MessageHandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWs = {
      send: vi.fn()
    } as any;

    context = {
      ws: mockWs,
      connectionManager: {
        getRole: vi.fn(),
        getClientSettings: vi.fn(),
        setClientSettings: vi.fn()
      } as any,
      storage: {} as any,
      sessionService: {} as any,
      translationService: {} as any,
      sessionLifecycleService: {} as any,
      webSocketServer: {} as any
    };

    handler = new SettingsMessageHandler();
  });

  describe('getMessageType', () => {
    it('should handle settings message type', () => {
      expect(handler.getMessageType()).toBe('settings');
    });
  });

  describe('handle', () => {
    it('should update client settings', async () => {
      const existingSettings: ClientSettings = {
        ttsServiceType: 'azure',
        useClientSpeech: false
      };
      
      context.connectionManager.getClientSettings.mockReturnValue(existingSettings);
      
      const settingsMessage: SettingsMessageToServer = {
        type: 'settings',
        settings: {
          ttsServiceType: 'google',
          useClientSpeech: true
        }
      };

      await handler.handle(settingsMessage, context);

      expect(context.connectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWs,
        {
          ttsServiceType: 'google',
          useClientSpeech: true
        }
      );

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'settings',
          status: 'success',
          settings: {
            ttsServiceType: 'google',
            useClientSpeech: true
          }
        })
      );
    });

    it('should handle legacy ttsServiceType field', async () => {
      context.connectionManager.getClientSettings.mockReturnValue({});
      
      const settingsMessage: SettingsMessageToServer = {
        type: 'settings',
        ttsServiceType: 'azure'
      };

      await handler.handle(settingsMessage, context);

      expect(context.connectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWs,
        {
          ttsServiceType: 'azure'
        }
      );

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'settings',
          status: 'success',
          settings: {
            ttsServiceType: 'azure'
          }
        })
      );
    });

    it('should merge with existing settings', async () => {
      const existingSettings: ClientSettings = {
        ttsServiceType: 'azure',
        useClientSpeech: false,
        customProperty: 'value'
      } as any;
      
      context.connectionManager.getClientSettings.mockReturnValue(existingSettings);
      
      const settingsMessage: SettingsMessageToServer = {
        type: 'settings',
        settings: {
          useClientSpeech: true
        }
      };

      await handler.handle(settingsMessage, context);

      expect(context.connectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWs,
        {
          ttsServiceType: 'azure',
          useClientSpeech: true,
          customProperty: 'value'
        }
      );
    });

    it('should handle empty settings message', async () => {
      context.connectionManager.getClientSettings.mockReturnValue({});
      
      const settingsMessage: SettingsMessageToServer = {
        type: 'settings'
      };

      await handler.handle(settingsMessage, context);

      expect(context.connectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWs,
        {}
      );

      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'settings',
          status: 'success',
          settings: {}
        })
      );
    });

    it('should prioritize settings object over legacy field', async () => {
      context.connectionManager.getClientSettings.mockReturnValue({});
      
      const settingsMessage: SettingsMessageToServer = {
        type: 'settings',
        settings: {
          ttsServiceType: 'google'
        },
        ttsServiceType: 'azure' // This should be ignored
      };

      await handler.handle(settingsMessage, context);

      expect(context.connectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWs,
        {
          ttsServiceType: 'google'
        }
      );
    });

    it('should handle send errors gracefully', async () => {
      context.connectionManager.getClientSettings.mockReturnValue({});
      mockWs.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });
      
      const settingsMessage: SettingsMessageToServer = {
        type: 'settings',
        settings: {
          ttsServiceType: 'google'
        }
      };

      // Should not throw
      await expect(handler.handle(settingsMessage, context)).resolves.toBeUndefined();
      
      // Settings should still be updated
      expect(context.connectionManager.setClientSettings).toHaveBeenCalled();
    });

    it('should handle missing client settings gracefully', async () => {
      context.connectionManager.getClientSettings.mockReturnValue(null);
      
      const settingsMessage: SettingsMessageToServer = {
        type: 'settings',
        settings: {
          ttsServiceType: 'google'
        }
      };

      await handler.handle(settingsMessage, context);

      expect(context.connectionManager.setClientSettings).toHaveBeenCalledWith(
        mockWs,
        {
          ttsServiceType: 'google'
        }
      );
    });

    it('should handle connection manager errors', async () => {
      context.connectionManager.getClientSettings.mockImplementation(() => {
        throw new Error('Connection manager error');
      });
      
      const settingsMessage: SettingsMessageToServer = {
        type: 'settings',
        settings: {
          ttsServiceType: 'google'
        }
      };

      // Should handle error gracefully
      await expect(handler.handle(settingsMessage, context)).resolves.toBeUndefined();
    });
  });
});
