import type { IRealtimeTransport, ConnectionContext, MessageContext } from './IRealtimeTransport';
import type { IMessageSender } from './IMessageSender';

export type RealtimeMessageHandler = (ctx: MessageContext, message: unknown) => Promise<void> | void;

interface HandlerRegistry {
  [messageType: string]: RealtimeMessageHandler;
}

/**
 * RealTimeCommunicationService
 * Protocol-agnostic dispatcher that plugs into any IRealtimeTransport and routes
 * incoming messages by their `type` field to registered handlers.
 */
export class RealTimeCommunicationService {
  private transport: IRealtimeTransport;
  private handlers: HandlerRegistry = {};
  private unsubscribes: Array<() => void> = [];

  constructor(transport: IRealtimeTransport) {
    this.transport = transport;
  }

  registerHandler(messageType: string, handler: RealtimeMessageHandler): void {
    this.handlers[messageType] = handler;
  }

  unregisterHandler(messageType: string): void {
    delete this.handlers[messageType];
  }

  start(): void {
    const offConnect = this.transport.onConnect((_ctx: ConnectionContext) => {
      // reserved for future use (metrics, presence)
    });
    const offMessage = this.transport.onMessage((ctx: MessageContext, raw: unknown) => {
      try {
        const parsed = this.parseMessage(raw);
        const type = (parsed && (parsed as any).type) || 'unknown';
        const handler = this.handlers[type];
        if (handler) {
          handler(ctx, parsed);
        }
      } catch {
        const handler = this.handlers['error'];
        if (handler) {
          handler(ctx, { type: 'error', message: 'Invalid message payload' });
        }
      }
    });
    const offDisconnect = this.transport.onDisconnect((_id: string) => {
      // reserved for future use (cleanup)
    });
    this.unsubscribes.push(offConnect, offMessage, offDisconnect);
  }

  stop(): void {
    while (this.unsubscribes.length) {
      const off = this.unsubscribes.pop();
      try { off && off(); } catch { /* ignore */ }
    }
  }

  getMessageSender(): IMessageSender {
    return this.transport.getMessageSender();
  }

  private parseMessage(raw: unknown): unknown {
    if (typeof raw === 'string') {
      return JSON.parse(raw);
    }
    if (raw && typeof (raw as any).data === 'string') {
      return JSON.parse((raw as any).data);
    }
    return raw;
  }
}


