import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { TTSRequestMessageToServer, TTSResponseMessageToClient } from '../WebSocketTypes';
import logger from '../../logger';
import { speechTranslationService } from '../TranslationService';

export class TTSRequestMessageHandler implements IMessageHandler<TTSRequestMessageToServer> {
  getMessageType(): string {
    return 'tts_request';
  }

  async handle(message: TTSRequestMessageToServer, context: MessageHandlerContext): Promise<void> {
    const text = message.text;
    const languageCode = message.languageCode;
    
    if (!this.validateTTSRequest(text, languageCode)) {
      await this.sendTTSErrorResponse(context, 'Invalid TTS request parameters');
      return;
    }
    
    // Always use OpenAI TTS for best quality
    const ttsServiceType = 'openai';
    
    try {
      // Generate TTS audio
      const audioBuffer = await this.generateTTSAudio(
        text,
        languageCode,
        ttsServiceType,
        message.voice
      );
      
      if (audioBuffer && audioBuffer.length > 0) {
        // Send successful response with audio
        await this.sendTTSResponse(
          context,
          text,
          languageCode,
          audioBuffer,
          ttsServiceType
        );
      } else {
        // Send error if no audio was generated
        await this.sendTTSErrorResponse(context, 'Failed to generate audio');
      }
    } catch (error) {
      logger.error('Error handling TTS request:', { error });
      await this.sendTTSErrorResponse(context, 'TTS generation error');
    }
  }

  /**
   * Validate TTS request parameters
   */
  private validateTTSRequest(text: string, languageCode: string): boolean {
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      logger.error('Invalid TTS text:', { text });
      return false;
    }
    
    if (!languageCode || typeof languageCode !== 'string') {
      logger.error('Invalid TTS language code:', { languageCode });
      return false;
    }
    
    return true;
  }

  /**
   * Generate TTS audio
   */
  private async generateTTSAudio(
    text: string,
    languageCode: string,
    ttsServiceType: string,
    voice?: string
  ): Promise<Buffer> {
    try {
      // Use empty source language as we aren't translating, just doing TTS
      const result = await speechTranslationService.translateSpeech(
        Buffer.from(''), // Empty buffer as we already have the text
        languageCode,   // Source language is the same as target for TTS-only
        languageCode,   // Target language
        text,           // Text to convert to speech
        { ttsServiceType } // Force specified TTS service type
      );
      
      return result.audioBuffer;
    } catch (error) {
      logger.error('Error generating TTS audio:', { error });
      return Buffer.from(''); // Return empty buffer on error
    }
  }

  /**
   * Send TTS response with audio data
   */
  private async sendTTSResponse(
    context: MessageHandlerContext,
    text: string,
    languageCode: string,
    audioBuffer: Buffer,
    ttsServiceType: string
  ): Promise<void> {
    try {
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
      
      // Send response
      context.ws.send(JSON.stringify(response as TTSResponseMessageToClient));
      logger.info(`TTS response sent successfully for language '${languageCode}'`);
    } catch (error) {
      logger.error('Error sending TTS response:', { error });
      // Try to send error message if possible
      try {
        await this.sendTTSErrorResponse(context, 'Failed to send audio data');
      } catch (sendError) {
        logger.error('Error sending TTS error response:', { sendError });
      }
    }
  }

  /**
   * Send TTS error response
   */
  private async sendTTSErrorResponse(
    context: MessageHandlerContext,
    messageText: string,
    code: string = 'TTS_ERROR'
  ): Promise<void> {
    try {
      const ttsErrorResponse: TTSResponseMessageToClient = {
        type: 'tts_response',
        status: 'error',
        error: {
          message: messageText,
          code: code
        },
        timestamp: Date.now()
      };
      
      context.ws.send(JSON.stringify(ttsErrorResponse));
      logger.error(`TTS error response sent: ${messageText}`);
    } catch (error) {
      logger.error('Error sending TTS error response:', { error });
    }
  }
}
