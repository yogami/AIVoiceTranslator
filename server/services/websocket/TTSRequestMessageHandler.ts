import { IMessageHandler, MessageHandlerContext } from './MessageHandler';
import type { TTSRequestMessageToServer, TTSResponseMessageToClient } from '../WebSocketTypes';
import logger from '../../logger';

export class TTSRequestMessageHandler implements IMessageHandler<TTSRequestMessageToServer> {
  getMessageType(): string {
    return 'tts_request';
  }

  async handle(message: TTSRequestMessageToServer, context: MessageHandlerContext): Promise<void> {
    const text = message.text;
    const languageCode = message.languageCode;
    
    if (!context.translationService.validateTTSRequest(text, languageCode)) {
      await this.sendTTSErrorResponse(context, 'Invalid TTS request parameters');
      return;
    }
    
    // Always use OpenAI TTS for best quality
    const ttsServiceType = 'openai';
    
    try {
      // Generate TTS audio using TranslationService
      const audioBuffer = await context.translationService.generateTTSAudio(
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
