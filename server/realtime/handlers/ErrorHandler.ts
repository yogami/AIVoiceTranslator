import type { RealTimeCommunicationService } from '../RealTimeCommunicationService';

/**
 * Registers a default error handler that responds with a structured error message.
 */
export function registerErrorHandler(service: RealTimeCommunicationService): void {
  const sender = service.getMessageSender();
  service.registerHandler('error', async (ctx, message: any) => {
    await sender.send(ctx.connectionId, {
      type: 'error',
      message: message?.message || 'Malformed or unsupported message',
    });
  });
}


