import { IMessageHandler, MessageHandlerContext } from './MessageHandler';

// Pong messages don't have a specific structure, just the type
interface PongMessageToServer {
  type: 'pong';
}

export class PongMessageHandler implements IMessageHandler<PongMessageToServer> {
  getMessageType(): string {
    return 'pong';
  }

  async handle(message: PongMessageToServer, context: MessageHandlerContext): Promise<void> {
    // No specific handling needed for pong messages
    // They are just acknowledgments of ping messages
  }
}
