import type { Server as HttpServer } from 'http';
import type { IRealtimeTransport, ConnectionContext, MessageContext, Unsubscribe } from './IRealtimeTransport';
import type { IMessageSender } from './IMessageSender';

/**
 * Experimental skeleton for WebRTC transport.
 * Not wired into factory (factory still falls back to WebSocket for 'webrtc').
 * Provides event hooks and a stubbed message sender for future implementation.
 */
export class WebRTCTransportAdapter implements IRealtimeTransport {
  private connectHandlers: Array<(ctx: ConnectionContext) => void> = [];
  private messageHandlers: Array<(ctx: MessageContext, message: unknown) => void> = [];
  private disconnectHandlers: Array<(connectionId: string, reason?: string) => void> = [];

  async start(_server: HttpServer): Promise<void> {
    // Placeholder: future signaling and peer connection setup
  }

  async stop(): Promise<void> {
    // Placeholder: future cleanup
  }

  onConnect(cb: (ctx: ConnectionContext) => void): Unsubscribe {
    this.connectHandlers.push(cb);
    return () => { this.connectHandlers = this.connectHandlers.filter(h => h !== cb); };
  }

  onMessage(cb: (ctx: MessageContext, message: unknown) => void): Unsubscribe {
    this.messageHandlers.push(cb);
    return () => { this.messageHandlers = this.messageHandlers.filter(h => h !== cb); };
  }

  onDisconnect(cb: (connectionId: string, reason?: string) => void): Unsubscribe {
    this.disconnectHandlers.push(cb);
    return () => { this.disconnectHandlers = this.disconnectHandlers.filter(h => h !== cb); };
  }

  getMessageSender(): IMessageSender {
    return {
      async send(_toConnectionId: string, _message: unknown): Promise<void> {
        // TODO: route over RTCDataChannel
      },
      async broadcastToSession(_sessionId: string, _message: unknown): Promise<void> {
        // TODO: route to all peers in session
      },
    };
  }

  // Active session metrics (stubbed)
  getActiveTeacherCount(): number { return 0; }
  getActiveStudentCount(): number { return 0; }
  getActiveSessionsCount(): number { return 0; }

  // Test helpers to simulate events (temporary; to be removed when real impl lands)
  public emitConnect(ctx: ConnectionContext): void { this.connectHandlers.forEach(h => h(ctx)); }
  public emitMessage(ctx: MessageContext, message: unknown): void { this.messageHandlers.forEach(h => h(ctx, message)); }
  public emitDisconnect(connectionId: string, reason?: string): void { this.disconnectHandlers.forEach(h => h(connectionId, reason)); }
}



