/**
 * TTSMessageHandler
 * 
 * Handles text-to-speech requests
 * - Follows Single Responsibility Principle
 * - Separates TTS handling from other message types
 */

import { WebSocketClient, WebSocketClientManager } from '../WebSocketClientManager';
import { WebSocketMessageHandler } from '../WebSocketMessageRouter';
import { speechTranslationService } from '../TranslationService';

export interface TTSRequestMessage {
  type: 'tts_request';
  text: string;
  languageCode: string;
  voice?: string;
  format?: string;
  // Additional fields that might be present
  [key: string]: any;
}

export class TTSMessageHandler implements WebSocketMessageHandler {
  constructor(private clientManager: WebSocketClientManager) {}
  
  /**
   * Check if this handler can process the message type
   */
  public canHandle(type: string): boolean {
    return type === 'tts_request';
  }
  
  /**
   * Handle TTS request message
   */
  public async handle(client: WebSocketClient, message: any): Promise<boolean> {
    try {
      console.log('Processing TTS request:', message);
      
      const ttsRequest = message as TTSRequestMessage;
      const clientState = this.clientManager.getClientState(client);
      
      // Validate request
      if (!this.validateTTSRequest(ttsRequest.text, ttsRequest.languageCode)) {
        await this.sendTTSErrorResponse(
          client, 
          'Invalid TTS request parameters', 
          'TTS_INVALID_PARAMS'
        );
        return false;
      }
      
      // Get client preferences
      const preferredTtsService = clientState?.settings?.ttsServiceType || 'openai';
      
      // Always use OpenAI TTS for best quality (overrides client preference)
      const ttsServiceToUse = 'openai';
      
      // Generate audio
      const audioData = await this.generateTTSAudio(
        ttsRequest.text,
        ttsRequest.languageCode,
        ttsServiceToUse,
        ttsRequest.voice || 'default'
      );
      
      // Send response
      if (audioData && audioData.length > 0) {
        await this.sendTTSResponse(
          client,
          ttsRequest.text,
          ttsRequest.languageCode,
          audioData,
          ttsServiceToUse
        );
        return true;
      } else {
        // If no audio generated, send error
        await this.sendTTSErrorResponse(
          client,
          'Failed to generate audio',
          'TTS_GENERATION_FAILED'
        );
        return false;
      }
    } catch (error) {
      console.error('Error handling TTS request:', error);
      await this.sendTTSErrorResponse(
        client,
        'Internal server error',
        'TTS_SERVER_ERROR'
      );
      return false;
    }
  }
  
  /**
   * Validate TTS request parameters
   */
  private validateTTSRequest(text: string, languageCode: string): boolean {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      console.error('Invalid TTS text:', text);
      return false;
    }
    
    if (!languageCode || typeof languageCode !== 'string') {
      console.error('Invalid TTS language code:', languageCode);
      return false;
    }
    
    return true;
  }
  
  /**
   * Generate TTS audio using the speechTranslationService
   */
  private async generateTTSAudio(
    text: string,
    languageCode: string,
    ttsServiceType: string,
    voice: string
  ): Promise<Buffer> {
    try {
      console.log(`Generating TTS audio for language '${languageCode}' using service '${ttsServiceType}'`);
      
      // Use empty source language as we aren't translating, just doing TTS
      // Note: We're using the same language for source and target to indicate no translation is needed
      const result = await speechTranslationService.translateSpeech(
        Buffer.from(''), // Empty buffer as we already have the text
        languageCode,   // Source language is the same as target for TTS-only
        languageCode,   // Target language
        text,           // Text to convert to speech
        { 
          ttsServiceType // Use specified TTS service type
          // The service should detect that source and target languages are the same
          // and skip translation automatically
        }
      );
      
      console.log(`TTS audio generated successfully, audio buffer size: ${result.audioBuffer.length} bytes`);
      return result.audioBuffer;
    } catch (error) {
      console.error('Error generating TTS audio:', error);
      return Buffer.from(''); // Return empty buffer on error
    }
  }
  
  /**
   * Send TTS response with audio data
   */
  private async sendTTSResponse(
    client: WebSocketClient,
    text: string,
    languageCode: string,
    audioBuffer: Buffer,
    ttsServiceType: string
  ): Promise<void> {
    try {
      // Create base message
      const response: any = {
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
          console.error('Error parsing speech params:', error);
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
      
      // Send response
      client.send(JSON.stringify(response));
      console.log(`TTS response sent successfully for language '${languageCode}'`);
    } catch (error) {
      console.error('Error sending TTS response:', error);
      // Try to send error message if possible
      try {
        await this.sendTTSErrorResponse(client, 'Failed to send audio data', 'TTS_SEND_FAILED');
      } catch (sendError) {
        console.error('Error sending TTS error response:', sendError);
      }
    }
  }
  
  /**
   * Send TTS error response
   */
  private async sendTTSErrorResponse(
    client: WebSocketClient,
    message: string,
    code: string
  ): Promise<void> {
    try {
      const errorResponse = {
        type: 'tts_response',
        status: 'error',
        error: {
          message,
          code
        },
        timestamp: Date.now()
      };
      
      client.send(JSON.stringify(errorResponse));
      console.error(`TTS error response sent: ${code} - ${message}`);
    } catch (error) {
      console.error('Error sending TTS error response:', error);
    }
  }
}