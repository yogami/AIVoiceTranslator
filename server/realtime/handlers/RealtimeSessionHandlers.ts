import type { RealTimeCommunicationService } from '../RealTimeCommunicationService';
import { RealtimeSessionRegistry } from '../session/RealtimeSessionRegistry';

/**
 * Register lightweight session-aware handlers: track role/language/sessionId on register.
 */
export function registerRealtimeSessionHandlers(service: RealTimeCommunicationService, registry: RealtimeSessionRegistry): void {
  // On connect/disconnect (future: service could surface hooks); for now, store via register messages
  service.registerHandler('register', async (ctx, message: any) => {
    const role = (message?.role as string) || 'unknown';
    const languageCode = (message?.languageCode as string) || ctx.languageCode || 'en-US';
    const sessionId = (message?.sessionId as string) || ctx.sessionId;
    registry.set(ctx.connectionId, { role: role as any, languageCode, sessionId });
  });
}


