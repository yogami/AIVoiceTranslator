export interface IMessageSender {
  send(toConnectionId: string, message: unknown): Promise<void>;
  broadcastToSession(sessionId: string, message: unknown): Promise<void>;
}


