import type { MessageHandlerContext } from '../../../interface-adapters/websocket/websocket-services/MessageHandler';

export class TranslationModeService {
  constructor() {}

  public isManualModeForTeacher(context: MessageHandlerContext): boolean {
    const role = context.connectionManager.getRole(context.ws);
    if (role !== 'teacher') return false;
    const settings = context.connectionManager.getClientSettings(context.ws) || {};
    return settings.translationMode === 'manual';
  }
}


