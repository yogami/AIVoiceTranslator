import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TTSRequestMessageHandler } from '../../../../server/services/tts/TTSRequestMessageHandler';
import { MessageHandlerContext } from '../../../../server/services/websocket/MessageHandler';
import { WebSocketClient } from '../../../../server/services/websocket/ConnectionManager';
import type { TTSRequestMessageToServer } from '../../../../server/services/WebSocketTypes';
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

describe('TTSRequestMessageHandler', () => {
  let handler: TTSRequestMessageHandler;
  let mockWs: WebSocketClient;
  let context: MessageHandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWs = {
      send: vi.fn()
    } as any;

    context = {
      ws: mockWs,
      connectionManager: {} as any,
      storage: {} as any,
      sessionService: {} as any,
      translationService: {
        validateTTSRequest: vi.fn(),
        generateTTSAudio: vi.fn()
      } as any,
      sessionLifecycleService: {} as any,
      webSocketServer: {} as any
    };

    handler = new TTSRequestMessageHandler();
  });

  describe('getMessageType', () => {
    it('should handle tts_request message type', () => {
      expect(handler.getMessageType()).toBe('tts_request');
    });
  });

  describe('handle', () => {
    it('should handle valid TTS request', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(true);
      context.translationService.generateTTSAudio.mockResolvedValue(Buffer.from('audio data'));

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      };

      await handler.handle(ttsMessage, context);

      expect(context.translationService.validateTTSRequest).toHaveBeenCalledWith('Hello', 'en-US');
      expect(context.translationService.generateTTSAudio).toHaveBeenCalledWith(
        'Hello',
        'en-US',
        'openai',
        undefined
      );

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"tts_response"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"success"')
      );
    });

    it('should handle TTS request with missing language code', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(false);
      
      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: ''
      };

      await handler.handle(ttsMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"type":"tts_response"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
    });

    it('should handle TTS request with empty text', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(false);
      
      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: '',
        languageCode: 'en-US'
      };

      await handler.handle(ttsMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Invalid TTS request parameters"')
      );
    });

    it('should handle TTS request with whitespace-only text', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(false);
      
      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: '   \n\t  ',
        languageCode: 'en-US'
      };

      await handler.handle(ttsMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Invalid TTS request parameters"')
      );
    });

    it('should handle client speech synthesis response', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(true);
      
      const browserSpeechMarker = JSON.stringify({
        type: 'browser-speech',
        text: 'Hello',
        languageCode: 'en-US'
      });
      
      context.translationService.generateTTSAudio.mockResolvedValue(Buffer.from(browserSpeechMarker));

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      };

      await handler.handle(ttsMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"useClientSpeech":true')
      );
    });

    it('should handle browser speech marker in audioBuffer', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(true);
      
      const browserSpeechMarker = JSON.stringify({
        type: 'browser-speech',
        text: 'Hello',
        language: 'en-US'
      });

      context.translationService.generateTTSAudio.mockResolvedValue(Buffer.from(browserSpeechMarker));

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      };

      await handler.handle(ttsMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"useClientSpeech":true')
      );
    });

    it('should handle TTS generation failure', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(true);
      context.translationService.generateTTSAudio.mockResolvedValue(null);

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      };

      await handler.handle(ttsMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Failed to generate audio"')
      );
    });

    it('should handle translation service errors', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(true);
      context.translationService.generateTTSAudio.mockRejectedValue(
        new Error('Translation service error')
      );

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      };

      await handler.handle(ttsMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"message":"TTS generation error"')
      );
    });

    it('should handle send errors gracefully', async () => {
      mockWs.send = vi.fn().mockImplementation(() => {
        throw new Error('Send failed');
      });

      context.translationService.validateTTSRequest.mockReturnValue(true);
      context.translationService.generateTTSAudio.mockResolvedValue(Buffer.from('audio data'));

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      };

      // Should not throw
      await expect(handler.handle(ttsMessage, context)).resolves.toBeUndefined();
    });

    it('should handle empty audio response', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(true);
      context.translationService.generateTTSAudio.mockResolvedValue(Buffer.from(''));

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      };

      await handler.handle(ttsMessage, context);

      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"error"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"message":"Failed to generate audio"')
      );
    });

    it('should handle custom voice parameter', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(true);
      context.translationService.generateTTSAudio.mockResolvedValue(Buffer.from('audio data'));

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US',
        voice: 'neural-voice'
      };

      await handler.handle(ttsMessage, context);

      expect(context.translationService.generateTTSAudio).toHaveBeenCalledWith(
        'Hello',
        'en-US',
        'openai',
        'neural-voice'
      );
    });

    it('should handle invalid JSON in audioBuffer gracefully', async () => {
      context.translationService.validateTTSRequest.mockReturnValue(true);
      context.translationService.generateTTSAudio.mockResolvedValue(Buffer.from('invalid json content'));

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello',
        languageCode: 'en-US'
      };

      await handler.handle(ttsMessage, context);

      // Should treat as regular audio data since it's not valid JSON
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"status":"success"')
      );
      expect(mockWs.send).toHaveBeenCalledWith(
        expect.stringContaining('"audioData"')
      );
    });
  });
});
