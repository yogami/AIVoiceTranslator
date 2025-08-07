/**
 * TTS Request Domain Handler
 * 
 * Clean Architecture Domain Layer Handler for TTS Requests
 * 
 * This handler contains the business logic for processing TTS requests.
 * It delegates to the SpeechPipelineOrchestrator for actual TTS generation.
 * 
 * Clean Architecture Principles:
 * - Contains TTS-specific business logic and validation
 * - Delegates to SpeechPipelineOrchestrator for TTS generation
 * - Independent of transport layer (WebSocket) concerns
 * - Can be tested independently
 */

import type { TTSRequestMessageToServer, TTSResponseMessageToClient } from '../../WebSocketTypes';
import logger from '../../../logger';

export interface ITTSRequestDomainHandler {
  handle(request: TTSRequestMessageToServer, sessionId: string): Promise<TTSResponseMessageToClient>;
}

export class TTSRequestDomainHandler implements ITTSRequestDomainHandler {
  constructor(
    private speechPipelineOrchestrator: any // SpeechPipelineOrchestrator
  ) {}

  async handle(message: TTSRequestMessageToServer, sessionId: string): Promise<TTSResponseMessageToClient> {
    const text = message.text;
    const languageCode = message.languageCode;
    
    // Validate TTS request parameters
    if (!this.validateTTSRequest(text, languageCode)) {
      return this.createTTSErrorResponse('Invalid TTS request parameters');
    }
    
    // Always use OpenAI TTS for best quality
    const ttsServiceType = 'openai';
    
    try {
      // Delegate to SpeechPipelineOrchestrator
      const audioBuffer = await this.speechPipelineOrchestrator.generateTTSAudio(
        text,
        languageCode,
        ttsServiceType,
        message.voice
      );
      
      if (audioBuffer && audioBuffer.length > 0) {
        // Create successful response with audio
        return this.createTTSResponse(
          text,
          languageCode,
          audioBuffer,
          ttsServiceType
        );
      } else {
        // Return error if no audio was generated
        return this.createTTSErrorResponse('Failed to generate audio');
      }
    } catch (error) {
      logger.error('Error handling TTS request:', { error, sessionId });
      return this.createTTSErrorResponse('TTS generation error');
    }
  }

  /**
   * Validate TTS request parameters
   */
  private validateTTSRequest(text: string, languageCode: string): boolean {
    if (!text || text.trim().length === 0) {
      return false;
    }
    
    if (!languageCode || languageCode.trim().length === 0) {
      return false;
    }
    
    // Additional validation can be added here
    return true;
  }

  /**
   * Create TTS response with audio data
   */
  private createTTSResponse(
    text: string,
    languageCode: string,
    audioBuffer: Buffer,
    ttsServiceType: string
  ): TTSResponseMessageToClient {
    // Create base message
    const response: Partial<TTSResponseMessageToClient> = {
      type: 'tts_response',
      status: 'success',
      text,
      languageCode,
      ttsServiceType,
      timestamp: Date.now()
    };
    
    // Check if this is a browser speech synthesis marker
    const bufferString = audioBuffer.toString('utf8');
    
    if (bufferString.startsWith('{"type":"browser-speech"')) {
      response.useClientSpeech = true;
      try {
        response.speechParams = JSON.parse(bufferString);
      } catch (error) {
        logger.error('Error parsing speech params:', { error });
        response.speechParams = {
          type: 'browser-speech',
          text,
          languageCode,
          autoPlay: true
        };
      }
    } else {
      // Real audio data
      response.audioData = audioBuffer.toString('base64');
      response.useClientSpeech = false;
    }
    
    return response as TTSResponseMessageToClient;
  }

  /**
   * Create TTS error response
   */
  private createTTSErrorResponse(
    messageText: string,
    code: string = 'TTS_ERROR'
  ): TTSResponseMessageToClient {
    return {
      type: 'tts_response',
      status: 'error',
      error: {
        message: messageText,
        code: code
      },
      timestamp: Date.now()
    };
  }
}
