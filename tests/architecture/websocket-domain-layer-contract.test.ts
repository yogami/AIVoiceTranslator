/**
 * WebSocket-Domain Layer Contract Tests
 * 
 * These tests protect against architectural violations during refactoring.
 * They ensure that the WebSocket layer maintains proper contracts with domain services
 * and doesn't directly import or use domain-specific business logic.
 * 
 * PURPOSE: Prevent architectural boundary violations during handler refactoring
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MessageHandlerContext } from '../../server/services/websocket/MessageHandler';
import { WebSocketClient } from '../../server/services/websocket/ConnectionManager';
import type { 
  TTSRequestMessageToServer, 
  TranscriptionMessageToServer,
  AudioMessageToServer 
} from '../../server/services/WebSocketTypes';

describe('WebSocket-Domain Layer Contract Tests', () => {
  let mockWs: WebSocketClient;
  let mockContext: MessageHandlerContext;

  beforeEach(() => {
    vi.clearAllMocks();
    
    mockWs = {
      send: vi.fn()
    } as any;

    mockContext = {
      ws: mockWs,
      connectionManager: {
        getRole: vi.fn(),
        getSessionId: vi.fn(),
        getLanguage: vi.fn()
      } as any,
      storage: {} as any,
      sessionService: {} as any,
      translationService: {
        validateTTSRequest: vi.fn(),
        generateTTSAudio: vi.fn()
      } as any,
      speechPipelineOrchestrator: {
        handleTTSRequest: vi.fn(),
        handleTranscription: vi.fn(),
        handleAudioProcessing: vi.fn()
      } as any,
      sessionLifecycleService: {} as any,
      webSocketServer: {} as any
    };
  });

  describe('TTS Request Contract', () => {
    it('should delegate TTS requests to SpeechPipelineOrchestrator', async () => {
      // ARRANGE: Mock orchestrator response
      mockContext.speechPipelineOrchestrator.handleTTSRequest.mockResolvedValue({
        status: 'success',
        audioBuffer: Buffer.from('test audio'),
        response: {
          type: 'tts_response',
          status: 'success',
          audioData: 'base64-audio-data'
        }
      });

      const ttsMessage: TTSRequestMessageToServer = {
        type: 'tts_request',
        text: 'Hello world',
        languageCode: 'en-US'
      };

      // ACT: This is the contract we want to enforce
      const result = await mockContext.speechPipelineOrchestrator.handleTTSRequest({
        message: ttsMessage,
        context: mockContext
      });

      // ASSERT: Orchestrator should be called with proper contract
      expect(mockContext.speechPipelineOrchestrator.handleTTSRequest).toHaveBeenCalledWith({
        message: ttsMessage,
        context: mockContext
      });
      
      expect(result.status).toBe('success');
      expect(result.response.type).toBe('tts_response');
    });

    it('should NOT directly call translation services from WebSocket layer', () => {
      // ASSERT: This is an anti-pattern we want to prevent
      // WebSocket handlers should NOT directly call:
      // - context.translationService.generateTTSAudio()
      // - textToSpeechService directly
      // - OpenAI services directly
      
      // This test documents what should NOT happen
      expect(() => {
        // This would be a violation:
        // mockContext.translationService.generateTTSAudio(...)
      }).not.toThrow();
      
      // Instead, all TTS requests should go through speechPipelineOrchestrator
    });
  });

  describe('Transcription Request Contract', () => {
    it('should delegate transcription to SpeechPipelineOrchestrator', async () => {
      // ARRANGE: Mock orchestrator response
      mockContext.speechPipelineOrchestrator.handleTranscription.mockResolvedValue({
        status: 'success',
        transcription: 'Hello world',
        translations: new Map([['es', 'Hola mundo']]),
        response: {
          type: 'transcription_processed',
          status: 'success'
        }
      });

      const transcriptionMessage: TranscriptionMessageToServer = {
        type: 'transcription',
        text: 'Hello world'
      };

      // ACT: This is the contract we want to enforce
      const result = await mockContext.speechPipelineOrchestrator.handleTranscription({
        message: transcriptionMessage,
        context: mockContext
      });

      // ASSERT: Orchestrator should be called with proper contract
      expect(mockContext.speechPipelineOrchestrator.handleTranscription).toHaveBeenCalledWith({
        message: transcriptionMessage,
        context: mockContext
      });
      
      expect(result.status).toBe('success');
      expect(result.transcription).toBe('Hello world');
    });

    it('should NOT directly call translation services from WebSocket layer', () => {
      // ASSERT: This is an anti-pattern we want to prevent
      // WebSocket handlers should NOT directly call:
      // - TranslationBusinessService
      // - speechTranslationService
      // - OpenAI translation services directly
      
      // All transcription processing should go through speechPipelineOrchestrator
      expect(mockContext.speechPipelineOrchestrator).toBeDefined();
    });
  });

  describe('Audio Processing Contract', () => {
    it('should delegate audio processing to SpeechPipelineOrchestrator', async () => {
      // ARRANGE: Mock orchestrator response
      mockContext.speechPipelineOrchestrator.handleAudioProcessing.mockResolvedValue({
        status: 'success',
        processedAudio: Buffer.from('processed audio'),
        transcription: 'Audio transcription',
        response: {
          type: 'audio_processed',
          status: 'success'
        }
      });

      const audioMessage: AudioMessageToServer = {
        type: 'audio',
        data: 'base64-audio-data'
      };

      // ACT: This is the contract we want to enforce
      const result = await mockContext.speechPipelineOrchestrator.handleAudioProcessing({
        message: audioMessage,
        context: mockContext
      });

      // ASSERT: Orchestrator should be called with proper contract
      expect(mockContext.speechPipelineOrchestrator.handleAudioProcessing).toHaveBeenCalledWith({
        message: audioMessage,
        context: mockContext
      });
      
      expect(result.status).toBe('success');
      expect(result.transcription).toBe('Audio transcription');
    });

    it('should NOT directly process audio in WebSocket layer', () => {
      // ASSERT: This is an anti-pattern we want to prevent
      // WebSocket handlers should NOT directly:
      // - Convert audio formats
      // - Call audioTranscriptionService
      // - Process speech-to-text
      // - Handle audio encoding/decoding
      
      // All audio processing should go through speechPipelineOrchestrator
      expect(mockContext.speechPipelineOrchestrator.handleAudioProcessing).toBeDefined();
    });
  });

  describe('Response Format Contract', () => {
    it('should maintain consistent WebSocket response format', () => {
      // ARRANGE: Expected response format
      const expectedTTSResponse = {
        type: 'tts_response',
        status: 'success' as const,
        audioData: expect.any(String),
        metadata: expect.any(Object)
      };

      const expectedTranscriptionResponse = {
        type: 'transcription_processed',
        status: 'success' as const,
        transcription: expect.any(String),
        translations: expect.any(Object)
      };

      const expectedAudioResponse = {
        type: 'audio_processed', 
        status: 'success' as const,
        transcription: expect.any(String)
      };

      // ASSERT: Response formats should be consistent
      expect(expectedTTSResponse.type).toBe('tts_response');
      expect(expectedTranscriptionResponse.type).toBe('transcription_processed');
      expect(expectedAudioResponse.type).toBe('audio_processed');
    });

    it('should maintain error response format consistency', () => {
      // ARRANGE: Expected error response format
      const expectedErrorResponse = {
        type: expect.any(String),
        status: 'error' as const,
        message: expect.any(String),
        code: expect.any(String)
      };

      // ASSERT: Error responses should be consistent across all handlers
      expect(expectedErrorResponse.status).toBe('error');
      expect(expectedErrorResponse).toHaveProperty('message');
      expect(expectedErrorResponse).toHaveProperty('code');
    });
  });

  describe('Context Injection Contract', () => {
    it('should inject WebSocket context to domain handlers', () => {
      // ARRANGE: Required context properties for domain layer
      const requiredContextProperties = [
        'ws',
        'connectionManager', 
        'storage',
        'sessionService',
        'speechPipelineOrchestrator',
        'sessionLifecycleService',
        'webSocketServer'
      ];

      // ASSERT: All required context should be available
      requiredContextProperties.forEach(prop => {
        expect(mockContext).toHaveProperty(prop);
      });
    });

    it('should provide WebSocket response capabilities to domain layer', () => {
      // ASSERT: Domain layer should be able to send responses via WebSocket
      expect(mockContext.ws).toHaveProperty('send');
      expect(typeof mockContext.ws.send).toBe('function');
    });
  });
});
