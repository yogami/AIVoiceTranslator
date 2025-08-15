import { IMessageHandler, MessageHandlerContext } from './MessageHandler';

interface ComprehensionSignalMessageToServer {
  type: 'comprehension_signal';
  level?: 'confused' | 'following' | 'lost';
}

export class ComprehensionSignalMessageHandler implements IMessageHandler<ComprehensionSignalMessageToServer> {
  getMessageType(): string {
    return 'comprehension_signal';
  }
  async handle(_message: ComprehensionSignalMessageToServer, _context: MessageHandlerContext): Promise<void> {
    // No-op placeholder to satisfy handler registration in tests
    return;
  }
}

