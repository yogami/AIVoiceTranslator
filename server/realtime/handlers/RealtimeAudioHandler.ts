import type { RealTimeCommunicationService } from '../RealTimeCommunicationService';

export interface RealtimeAudioDependencies {
  transcribeAudio: (audioBuffer: Buffer, languageCode: string) => Promise<string>;
  onTranscription?: (connectionId: string, text: string) => Promise<void>;
}

/**
 * RealtimeAudioHandler (protocol-agnostic)
 * Handles { type: 'audio', data, isFirstChunk?, isFinalChunk?, language? }
 * For MVP: when isFinalChunk is true (or chunk flags absent), transcribe and
 * respond with a minimal { type: 'transcription', text, isFinal: true } to the
 * same connection. Distinct from WebSocket-specific AudioMessageHandler.
 */
export function registerRealtimeAudioHandler(
  service: RealTimeCommunicationService,
  deps: RealtimeAudioDependencies
): void {
  service.registerHandler('audio', async (ctx, message: any) => {
    try {
      // Only act on final chunk to reduce churn; treat missing flags as final
      if (typeof message?.isFinalChunk !== 'undefined' && !message.isFinalChunk) {
        return;
      }
      const base64 = message?.data;
      if (!base64 || typeof base64 !== 'string' || base64.length < 32) {
        return;
      }
      const language = message?.language || ctx.languageCode || 'en-US';
      const buffer = Buffer.from(base64, 'base64');
      if (!buffer || buffer.length < 128) {
        return;
      }
      const text = await deps.transcribeAudio(buffer, language);
      if (!text || !text.trim()) {
        return;
      }
      // Optional hook for side effects
      if (deps.onTranscription) {
        await deps.onTranscription(ctx.connectionId, text);
      }
      // Minimal response for MVP
      const sender = service.getMessageSender();
      await sender.send(ctx.connectionId, {
        type: 'transcription',
        text,
        isFinal: true,
      });
    } catch {
      const sender = service.getMessageSender();
      await sender.send(ctx.connectionId, { type: 'error', message: 'audio processing failed' });
    }
  });
}


