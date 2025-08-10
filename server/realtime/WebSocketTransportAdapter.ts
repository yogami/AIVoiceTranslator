import type { Server as HttpServer } from 'http';
import type { IRealtimeTransport, ConnectionContext, MessageContext, Unsubscribe } from './IRealtimeTransport';
import type { IMessageSender } from './IMessageSender';
import type { IActiveSessionProvider } from '../application/services/session/IActiveSessionProvider';
import type { IStorage } from '../storage.interface';
import { WebSocketServer as LegacyWebSocketServer } from '../interface-adapters/websocket/WebSocketServer';

/**
 * Adapter that presents the existing WebSocketServer as an IRealtimeTransport implementation.
 * Zero behavior change; used to keep default transport as WebSocket.
 */
export class WebSocketTransportAdapter implements IRealtimeTransport {
  private legacy: LegacyWebSocketServer;
  
  constructor(httpServer: HttpServer, storage: IStorage) {
    this.legacy = new LegacyWebSocketServer(httpServer, storage);
  }

  async start(_server: HttpServer): Promise<void> {
    // Legacy server starts in constructor; nothing to do
  }

  async stop(): Promise<void> {
    await this.legacy.shutdown?.();
  }

  onConnect(_cb: (ctx: ConnectionContext) => void): Unsubscribe { return () => {}; }
  onMessage(_cb: (ctx: MessageContext, message: unknown) => void): Unsubscribe { return () => {}; }
  onDisconnect(_cb: (connectionId: string, reason?: string) => void): Unsubscribe { return () => {}; }

  getMessageSender(): IMessageSender {
    const legacy = this.legacy;
    return {
      async send(toConnectionId: string, message: unknown): Promise<void> {
        legacy.sendToConnection?.(toConnectionId as any, message as any);
      },
      async broadcastToSession(sessionId: string, message: unknown): Promise<void> {
        legacy.broadcastToSession?.(sessionId as any, message as any);
      },
    };
  }

  // IActiveSessionProvider passthrough
  getActiveTeacherCount(): number { return this.legacy.getActiveTeacherCount(); }
  getActiveStudentCount(): number { return this.legacy.getActiveStudentCount(); }
  getActiveSessionsCount(): number { return this.legacy.getActiveSessionsCount(); }
}


