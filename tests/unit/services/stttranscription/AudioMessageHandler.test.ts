import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AudioMessageHandler } from '../../../../server/services/stttranscription/AudioMessageHandler';
import { MessageHandlerContext } from '../../../../server/services/websocket/MessageHandler';
import { WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import type { AudioMessageToServer } from '../../../../server/services/WebSocketTypes';
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

describe('AudioMessageHandler', () => {
  let handler: AudioMessageHandler;
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
        getSessionId: vi.fn(),
        getLanguage: vi.fn()
      } as any,
      storage: {} as any,
      sessionService: {} as any,
      translationService: {} as any,
      sessionLifecycleService: {} as any,
      webSocketServer: {} as any
    };

    handler = new AudioMessageHandler();
  });

  describe('getMessageType', () => {
    it('should handle audio message type', () => {
      expect(handler.getMessageType()).toBe('audio');
    });
  });

  describe('handle', () => {
    it('should process audio from teacher', async () => {
      context.connectionManager.getRole.mockReturnValue('teacher');
      context.connectionManager.getSessionId.mockReturnValue('test-session');
      
      const audioData = Buffer.from('a'.repeat(200)).toString('base64');
      const audioMessage: AudioMessageToServer = {
        type: 'audio',
        data: audioData
      };

      await handler.handle(audioMessage, context);

      expect(logger.debug).toHaveBeenCalledWith(
        'Received audio chunk from teacher, using client-side transcription'
      );
    });

    it('should ignore audio from non-teachers', async () => {
      context.connectionManager.getRole.mockReturnValue('student');
      
      const audioData = Buffer.from('audio data').toString('base64');
      const audioMessage: AudioMessageToServer = {
        type: 'audio',
        data: audioData
      };

      await handler.handle(audioMessage, context);

      expect(logger.info).toHaveBeenCalledWith(
        'Ignoring audio from non-teacher role:',
        { role: 'student' }
      );
    });

    it('should ignore small audio chunks', async () => {
      context.connectionManager.getRole.mockReturnValue('teacher');
      context.connectionManager.getSessionId.mockReturnValue('test-session');
      
      const smallAudio = Buffer.from('small').toString('base64');
      const audioMessage: AudioMessageToServer = {
        type: 'audio',
        data: smallAudio
      };

      await handler.handle(audioMessage, context);

      expect(logger.debug).not.toHaveBeenCalledWith(
        'Received audio chunk from teacher, using client-side transcription'
      );
    });

    it('should handle missing sessionId for teacher', async () => {
      context.connectionManager.getRole.mockReturnValue('teacher');
      context.connectionManager.getSessionId.mockReturnValue(undefined);
      
      const audioData = Buffer.from('a'.repeat(200)).toString('base64');
      const audioMessage: AudioMessageToServer = {
        type: 'audio',
        data: audioData
      };

      await handler.handle(audioMessage, context);

      expect(logger.error).toHaveBeenCalledWith(
        'No session ID found for teacher'
      );
    });

    it('should handle invalid base64 audio data', async () => {
      context.connectionManager.getRole.mockReturnValue('teacher');
      context.connectionManager.getSessionId.mockReturnValue('test-session');
      
      const audioMessage: AudioMessageToServer = {
        type: 'audio',
        data: 'invalid-base64!'
      };

      // Should not throw error, just process what it can
      await expect(handler.handle(audioMessage, context)).resolves.toBeUndefined();
    });

    it('should handle empty audio data', async () => {
      context.connectionManager.getRole.mockReturnValue('teacher');
      context.connectionManager.getSessionId.mockReturnValue('test-session');
      
      const audioMessage: AudioMessageToServer = {
        type: 'audio',
        data: ''
      };

      await handler.handle(audioMessage, context);

      expect(logger.debug).not.toHaveBeenCalledWith(
        'Received audio chunk from teacher, using client-side transcription'
      );
    });

    it('should handle role retrieval errors', async () => {
      context.connectionManager.getRole.mockImplementation(() => {
        throw new Error('Role error');
      });
      
      const audioData = Buffer.from('audio data').toString('base64');
      const audioMessage: AudioMessageToServer = {
        type: 'audio',
        data: audioData
      };

      // Should handle error gracefully
      await expect(handler.handle(audioMessage, context)).resolves.toBeUndefined();
    });
  });
});
