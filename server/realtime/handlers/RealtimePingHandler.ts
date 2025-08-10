import type { RealTimeCommunicationService } from '../RealTimeCommunicationService';

/**
 * RealtimePingHandler (protocol-agnostic)
 * Responds to { type: 'ping' } with { type: 'pong', timestamp }.
 * Distinct from WebSocket-specific PingMessageHandler.
 */
export function registerRealtimePingHandler(service: RealTimeCommunicationService): void {
  const sender = service.getMessageSender();
  service.registerHandler('ping', async (ctx) => {
    await sender.send(ctx.connectionId, { type: 'pong', timestamp: Date.now() });
  });
}


