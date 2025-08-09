import type { RealTimeCommunicationService } from '../RealTimeCommunicationService';
import { RealtimeSessionRegistry } from '../session/RealtimeSessionRegistry';

export interface RealtimeTranslationDependencies {
  translate: (text: string, sourceLanguage: string, targetLanguage: string) => Promise<string>;
}

/**
 * RealtimeTranslationHandler (protocol-agnostic)
 * Handles { type: 'transcription', text, languageCode? } from teacher and
 * broadcasts { type: 'translation', text, targetLanguage } to the session.
 */
export function registerRealtimeTranslationHandler(
  service: RealTimeCommunicationService,
  deps: RealtimeTranslationDependencies,
  registry: RealtimeSessionRegistry
): void {
  service.registerHandler('transcription', async (ctx, message: any) => {
    const text = (message?.text ?? '').toString();
    if (!text.trim()) return;
    const sessionId = ctx.sessionId || registry.get(ctx.connectionId)?.sessionId;
    const sourceLanguage = message?.languageCode || registry.get(ctx.connectionId)?.languageCode || ctx.languageCode || 'en-US';
    if (!sessionId) return; // cannot broadcast without session

    // For MVP, broadcast the original text tagged as teacher transcription
    const sender = service.getMessageSender();
    await sender.broadcastToSession(sessionId, { type: 'transcription', text, sourceLanguage, isFinal: !!message?.isFinal });
  });

  // Optional: handle direct translate requests { type: 'translate', text, targetLanguage }
  service.registerHandler('translate', async (ctx, message: any) => {
    const text = (message?.text ?? '').toString();
    const targetLanguage = (message?.targetLanguage ?? '').toString();
    const sessionId = ctx.sessionId || registry.get(ctx.connectionId)?.sessionId;
    const sourceLanguage = message?.sourceLanguage || registry.get(ctx.connectionId)?.languageCode || ctx.languageCode || 'en-US';
    if (!text.trim() || !targetLanguage || !sessionId) return;

    try {
      const translated = await deps.translate(text, sourceLanguage, targetLanguage);
      const sender = service.getMessageSender();
      await sender.broadcastToSession(sessionId, { type: 'translation', text: translated, targetLanguage });
    } catch {
      const sender = service.getMessageSender();
      await sender.send(ctx.connectionId, { type: 'error', message: 'translation failed' });
    }
  });
}


