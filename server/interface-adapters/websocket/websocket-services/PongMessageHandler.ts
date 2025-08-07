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
    // Mark connection as alive when we receive a pong
    (context.ws as any).isAlive = true;
  }
}
