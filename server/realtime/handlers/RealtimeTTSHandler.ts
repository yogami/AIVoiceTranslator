import type { RealTimeCommunicationService } from '../RealTimeCommunicationService';

export interface RealtimeTTSDependencies {
  synthesize: (text: string, options?: { language?: string }) => Promise<Uint8Array | Buffer | string>;
}

/**
 * RealtimeTTSHandler (protocol-agnostic)
 * Handles { type: 'tts_request', text, languageCode? } and replies with
 * { type: 'tts_response', audioBuffer: base64 } to the same connection.
 * Distinct from WebSocket-specific TTSRequestMessageHandler.
 */
export function registerRealtimeTTSHandler(
  service: RealTimeCommunicationService,
  deps: RealtimeTTSDependencies
): void {
  const toBase64 = (data: Uint8Array | Buffer | string): string => {
    if (typeof data === 'string') return Buffer.from(data).toString('base64');
    return Buffer.from(data).toString('base64');
  };

  service.registerHandler('tts_request', async (ctx, message: any) => {
    try {
      const text = (message?.text ?? '').toString();
      const language = message?.languageCode || ctx.languageCode;
      if (!text.trim()) {
        const sender = service.getMessageSender();
        await sender.send(ctx.connectionId, { type: 'error', message: 'tts_request.text required' });
        return;
      }
      const audio = await deps.synthesize(text, { language });
      const audioBase64 = toBase64(audio);
      const sender = service.getMessageSender();
      await sender.send(ctx.connectionId, {
        type: 'tts_response',
        audioBuffer: audioBase64,
        languageCode: language,
      });
    } catch {
      const sender = service.getMessageSender();
      await sender.send(ctx.connectionId, { type: 'error', message: 'tts generation failed' });
    }
  });
}


