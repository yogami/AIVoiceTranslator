/**
 * Communication Services Index
 * 
 * Exports for the new SOLID-compliant communication architecture.
 * Provides protocol abstraction for WebSocket and WebRTC.
 */

// Core abstractions
export type { 
  IConnection, 
  ICommunicationServer, 
  ICommunicationProtocol 
} from './ICommunicationProtocol';

// Protocol implementations
export { 
  WebSocketConnection,
  WebSocketCommunicationServer,
  WebSocketProtocol 
} from './WebSocketProtocol';

export { 
  WebRTCConnection,
  WebRTCCommunicationServer,
  WebRTCProtocol 
} from './WebRTCProtocol';

// Services
export type { 
  IRealTimeCommunicationService
} from './RealTimeCommunicationService';
export { RealTimeCommunicationService } from './RealTimeCommunicationService';

export type { 
  ITranslationApplicationService
} from './TranslationApplicationService';
export { TranslationApplicationService } from './TranslationApplicationService';

// Factory and utilities
export { 
  CommunicationProtocolFactory
} from './CommunicationProtocolFactory';
export type { ProtocolType } from './CommunicationProtocolFactory';

// Backward compatibility
export { WebSocketServer } from './WebSocketServerAdapter';
export type { WebSocketClient } from './WebSocketServerAdapter';

// Import dependencies for factory functions
import { CommunicationProtocolFactory } from './CommunicationProtocolFactory';
import { TranslationApplicationService } from './TranslationApplicationService';

// Environment-based initialization
export function createTranslationService(
  httpServer?: any, 
  storage?: any, 
  protocolType?: import('./CommunicationProtocolFactory').ProtocolType
) {
  const protocol = protocolType 
    ? CommunicationProtocolFactory.create(protocolType)
    : CommunicationProtocolFactory.createFromEnvironment();
    
  return new TranslationApplicationService(protocol, storage, httpServer);
}

// Legacy compatibility factory
export async function createWebSocketServer(httpServer: any, storage: any) {
  // Import here to avoid circular dependencies
  const { WebSocketServer } = await import('./WebSocketServerAdapter');
  return new WebSocketServer(httpServer, storage);
}
