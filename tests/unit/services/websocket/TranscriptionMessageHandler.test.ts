import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TranscriptionMessageHandler } from '../../../../server/services/websocket/TranscriptionMessageHandler';
import { MessageHandlerContext } from '../../../../server/services/websocket/MessageHandler';
import { WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import type { TranscriptionMessageToServer } from '../../../../server/services/WebSocketTypes';
import logger from '../../../../server/logger';

// Mock logger
vi.mock('../../../../server/logger', () => ({
  default: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  }
}));

describe('TranscriptionMessageHandler', () => {
  let handler: TranscriptionMessageHandler;
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
        getRole: vi.fn().mockReturnValue('teacher'),
        getSessionId: vi.fn().mockReturnValue('session123'),
        getLanguage: vi.fn().mockReturnValue('en-US'),
        getStudentConnectionsAndLanguages: vi.fn().mockReturnValue({
          connections: [{ ws: mockWs }],
          languages: ['es', 'fr']
        })
      } as any,
      storage: {
        addTranscript: vi.fn().mockResolvedValue(true)
      } as any,
      sessionService: {} as any,
      translationService: {
        translateToMultipleLanguages: vi.fn().mockResolvedValue({
          translations: new Map([
            ['es', 'Hola mundo'],
            ['fr', 'Bonjour le monde']
          ]),
          translationResults: [
            { language: 'es', translation: 'Hola mundo' },
            { language: 'fr', translation: 'Bonjour le monde' }
          ],
          latencyInfo: {
            start: Date.now(),
            components: {
              preparation: 10,
              translation: 100,
              tts: 200,
              processing: 50
            }
          }
        }),
        sendTranslationsToStudents: vi.fn()
      } as any,
      sessionLifecycleService: {} as any,
      webSocketServer: {} as any
    };

    handler = new TranscriptionMessageHandler();
  });

  describe('getMessageType', () => {
    it('should return transcription message type', () => {
      expect(handler.getMessageType()).toBe('transcription');
    });
  });

  describe('handle', () => {
    it('should handle transcription message from teacher successfully', async () => {
      const message: TranscriptionMessageToServer = {
        type: 'transcription',
        text: 'Hello world'
      };

      await handler.handle(message, context);

      expect(context.connectionManager.getRole).toHaveBeenCalledWith(mockWs);
      expect(context.connectionManager.getSessionId).toHaveBeenCalledWith(mockWs);
      expect(context.connectionManager.getLanguage).toHaveBeenCalledWith(mockWs);
      expect(context.storage.addTranscript).toHaveBeenCalledWith({
        sessionId: 'session123',
        language: 'en-US',
        text: 'Hello world'
      });
      expect(context.translationService.translateToMultipleLanguages).toHaveBeenCalled();
      expect(context.translationService.sendTranslationsToStudents).toHaveBeenCalled();
    });

    it('should ignore transcription from non-teacher role', async () => {
      context.connectionManager.getRole = vi.fn().mockReturnValue('student');
      
      const message: TranscriptionMessageToServer = {
        type: 'transcription',
        text: 'Hello world'
      };

      await handler.handle(message, context);

      expect(context.connectionManager.getRole).toHaveBeenCalledWith(mockWs);
      expect(context.storage.addTranscript).not.toHaveBeenCalled();
      expect(context.translationService.translateToMultipleLanguages).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith('Ignoring transcription from non-teacher role:', { role: 'student' });
    });

    it('should handle missing session ID', async () => {
      context.connectionManager.getSessionId = vi.fn().mockReturnValue(null);
      
      const message: TranscriptionMessageToServer = {
        type: 'transcription',
        text: 'Hello world'
      };

      await handler.handle(message, context);

      expect(context.connectionManager.getRole).toHaveBeenCalledWith(mockWs);
      expect(context.connectionManager.getSessionId).toHaveBeenCalledWith(mockWs);
      expect(context.storage.addTranscript).not.toHaveBeenCalled();
      // Should still try to translate
      expect(context.translationService.translateToMultipleLanguages).toHaveBeenCalled();
    });

    it('should handle storage errors gracefully', async () => {
      context.storage.addTranscript = vi.fn().mockRejectedValue(new Error('Storage error'));
      
      const message: TranscriptionMessageToServer = {
        type: 'transcription',
        text: 'Hello world'
      };

      await handler.handle(message, context);

      expect(context.storage.addTranscript).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith('Failed to store transcript:', expect.objectContaining({
        error: expect.any(Error),
        sessionId: 'session123'
      }));
      // Should still try to translate despite storage error
      expect(context.translationService.translateToMultipleLanguages).toHaveBeenCalled();
    });

    it('should handle translation service errors gracefully', async () => {
      context.translationService.translateToMultipleLanguages = vi.fn().mockRejectedValue(new Error('Translation error'));
      
      const message: TranscriptionMessageToServer = {
        type: 'transcription',
        text: 'Hello world'
      };

      // Should propagate the error since there's no error handling for translation service errors
      await expect(handler.handle(message, context)).rejects.toThrow('Translation error');
      
      expect(context.translationService.translateToMultipleLanguages).toHaveBeenCalled();
    });

    it('should use default language if teacher language is not set', async () => {
      context.connectionManager.getLanguage = vi.fn().mockReturnValue(null);
      
      const message: TranscriptionMessageToServer = {
        type: 'transcription',
        text: 'Hello world'
      };

      await handler.handle(message, context);

      expect(context.storage.addTranscript).toHaveBeenCalledWith({
        sessionId: 'session123',
        language: 'en-US',
        text: 'Hello world'
      });
    });
  });
});
