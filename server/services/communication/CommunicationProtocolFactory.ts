/**
 * Communication Protocol Factory
 * 
 * Factory for creating communication protocol instances.
 * Supports runtime protocol switching and configuration.
 * 
 * SOLID Principles:
 * - Single Responsibility: Protocol creation and management
 * - Open/Closed: Easy to add new protocols
 * - Dependency Inversion: Returns abstract protocol interface
 */

import { ICommunicationProtocol } from './ICommunicationProtocol';
import { WebSocketProtocol } from './WebSocketProtocol';
import { WebRTCProtocol } from './WebRTCProtocol';

export type ProtocolType = 'websocket' | 'webrtc';

export class CommunicationProtocolFactory {
  private static protocols = new Map<ProtocolType, () => ICommunicationProtocol>([
    ['websocket', () => new WebSocketProtocol()],
    ['webrtc', () => new WebRTCProtocol()],
  ]);

  static create(type: ProtocolType): ICommunicationProtocol {
    const protocolFactory = this.protocols.get(type);
    if (!protocolFactory) {
      throw new Error(`Unsupported protocol type: ${type}`);
    }
    return protocolFactory();
  }

  static getSupportedProtocols(): ProtocolType[] {
    return Array.from(this.protocols.keys());
  }

  static registerProtocol(type: ProtocolType, factory: () => ICommunicationProtocol): void {
    this.protocols.set(type, factory);
  }

  static createFromEnvironment(): ICommunicationProtocol {
    const protocolType = (process.env.COMMUNICATION_PROTOCOL as ProtocolType) || 'websocket';
    return this.create(protocolType);
  }
}
