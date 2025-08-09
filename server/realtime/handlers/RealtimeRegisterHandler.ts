import type { RealTimeCommunicationService } from '../RealTimeCommunicationService';

/**
 * RealtimeRegisterHandler (protocol-agnostic)
 * Acknowledges teacher/student registration messages.
 * Distinct from WebSocket-specific RegisterMessageHandler.
 */
export function registerRealtimeRegisterHandler(service: RealTimeCommunicationService): void {
  const sender = service.getMessageSender();
  service.registerHandler('register', async (ctx, message: any) => {
    const role = message?.role;
    const languageCode = message?.languageCode;
    if (!role || typeof role !== 'string') {
      await sender.send(ctx.connectionId, { type: 'error', message: 'register.role required' });
      return;
    }
    await sender.send(ctx.connectionId, {
      type: 'register',
      status: 'success',
      role,
      languageCode,
    });
  });
}


