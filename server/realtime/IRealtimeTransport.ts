import type { Server as HttpServer } from 'http';
import type { IActiveSessionProvider } from '../application/services/session/IActiveSessionProvider';
import type { IMessageSender } from './IMessageSender';

export interface ConnectionContext {
  connectionId: string;
  role?: 'teacher' | 'student' | 'unknown';
  sessionId?: string;
  languageCode?: string;
}

export interface MessageContext extends ConnectionContext {}

export type Unsubscribe = () => void;

export interface IRealtimeTransport extends IActiveSessionProvider {
  start(server: HttpServer): Promise<void>;
  stop(): Promise<void>;

  onConnect(cb: (ctx: ConnectionContext) => void): Unsubscribe;
  onMessage(cb: (ctx: MessageContext, message: unknown) => void): Unsubscribe;
  onDisconnect(cb: (connectionId: string, reason?: string) => void): Unsubscribe;

  getMessageSender(): IMessageSender;
}


