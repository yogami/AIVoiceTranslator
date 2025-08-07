/**
 * WebSocketServer Compatibility Adapter
 * 
 * This adapter provides backward compatibility with the existing WebSocketServer interface
 * while using the new clean architecture underneath. This allows existing tests and 
 * integration code to work without modification during the transition.
 * 
 * SOLID Principles:
 * - Single Responsibility: Provides backward compatibility
 * - Open/Closed: Extends functionality without modifying core services
 * - Adapter Pattern: Adapts new architecture to old interface
 */

import * as http from 'http';
import logger from '../../logger';
import { IStorage } from '../../storage.interface';
import { IActiveSessionProvider } from '../session/IActiveSessionProvider';
import { 
  IConnection,
  ICommunicationProtocol 
} from './ICommunicationProtocol';
import { 
  ITranslationApplicationService,
  TranslationApplicationService 
} from './TranslationApplicationService';
import { CommunicationProtocolFactory } from './CommunicationProtocolFactory';

// Legacy types for backward compatibility
export interface WebSocketClient {
  // Connection properties
  id: string;
  sessionId?: string;
  role?: string;
  language?: string;
  settings?: any;
  isConnected: boolean;
  messages?: any[]; // For test message buffering
  
  // WebSocket-specific methods for compatibility
  terminate(): void;
  send(data: string, callback?: (error?: Error) => void): void;
  close(): Promise<void>;
  
  // Event handlers
  onMessage(handler: (data: string) => void): void;
  onClose(handler: () => void): void;
  onError(handler: (error: Error) => void): void;
}

export class WebSocketServer implements IActiveSessionProvider {
  private translationService: ITranslationApplicationService;
  private protocol: ICommunicationProtocol;
  private isShutdown = false;
  
  // Static registry for cleanup tracking (backward compatibility)
  private static instances: Set<WebSocketServer> = new Set();

  constructor(server: http.Server, storage: IStorage) {
    // Register this instance for cleanup tracking
    WebSocketServer.instances.add(this);
    
    // Create protocol and translation service
    this.protocol = CommunicationProtocolFactory.createFromEnvironment();
    this.translationService = new TranslationApplicationService(
      this.protocol,
      storage,
      server
    );
    
    // Start the service
    this.translationService.start().catch(error => {
      logger.error('Failed to start TranslationApplicationService:', { error });
    });
    
    logger.info('WebSocketServer compatibility adapter initialized');
  }

  // IActiveSessionProvider implementation
  getActiveSessionCount(): number {
    return this.translationService.getConnections().length;
  }

  getActiveSessionsCount(): number {
    const sessions = new Set(
      this.translationService.getConnections()
        .map(conn => conn.sessionId)
        .filter(sessionId => sessionId)
    );
    return sessions.size;
  }

  getActiveStudentCount(): number {
    return this.translationService.getActiveStudentCount();
  }

  getActiveTeacherCount(): number {
    return this.translationService.getActiveTeacherCount();
  }

  // Backward compatibility methods
  getConnections(): Set<WebSocketClient> {
    const connections = this.translationService.getConnections();
    const compatibleConnections = connections.map(this.adaptToLegacyClient);
    return new Set(compatibleConnections);
  }

  getConnection(id: string): WebSocketClient | undefined {
    const connection = this.translationService.getConnections().find(c => c.id === id);
    return connection ? this.adaptToLegacyClient(connection) : undefined;
  }

  close(): void {
    this.shutdown();
  }

  shutdown(): void {
    if (this.isShutdown) {
      logger.warn('[WebSocketServer] Shutdown already in progress or completed.');
      return;
    }
    this.isShutdown = true;
    
    logger.info('[WebSocketServer] Shutting down...');
    
    // Unregister from static registry
    WebSocketServer.instances.delete(this);
    
    // Stop the translation service
    this.translationService.stop().catch(error => {
      logger.error('[WebSocketServer] Error stopping TranslationApplicationService:', { error });
    });
    
    logger.info('[WebSocketServer] Shutdown complete.');
  }

  async broadcastStudentCount(sessionId: string): Promise<void> {
    await this.translationService.broadcastStudentCount(sessionId);
  }

  // Protocol switching capability
  async switchProtocol(protocolType: 'websocket' | 'webrtc'): Promise<void> {
    const newProtocol = CommunicationProtocolFactory.create(protocolType);
    await this.translationService.switchProtocol(newProtocol);
    this.protocol = newProtocol;
    logger.info(`Switched to protocol: ${protocolType}`);
  }

  getCurrentProtocol(): string {
    return this.translationService.getCurrentProtocol();
  }

  // Legacy compatibility properties (getters/setters for tests)
  get connections(): Set<WebSocketClient> {
    return this.getConnections();
  }

  set connections(value: Set<WebSocketClient>) {
    // In the new architecture, connections are managed internally
    // This setter is for test compatibility only
    logger.warn('Setting connections directly is deprecated in new architecture');
  }

  get roles(): Map<WebSocketClient, string> {
    const rolesMap = new Map<WebSocketClient, string>();
    const connections = this.translationService.getConnections();
    
    for (const connection of connections) {
      if (connection.role) {
        const legacyClient = this.adaptToLegacyClient(connection);
        rolesMap.set(legacyClient, connection.role);
      }
    }
    
    return rolesMap;
  }

  set roles(value: Map<WebSocketClient, string>) {
    // In the new architecture, roles are set during registration
    logger.warn('Setting roles directly is deprecated in new architecture');
  }

  get languages(): Map<WebSocketClient, string> {
    const languagesMap = new Map<WebSocketClient, string>();
    const connections = this.translationService.getConnections();
    
    for (const connection of connections) {
      if (connection.language) {
        const legacyClient = this.adaptToLegacyClient(connection);
        languagesMap.set(legacyClient, connection.language);
      }
    }
    
    return languagesMap;
  }

  set languages(value: Map<WebSocketClient, string>) {
    // In the new architecture, languages are set during registration
    logger.warn('Setting languages directly is deprecated in new architecture');
  }

  get sessionIds(): Map<WebSocketClient, string> {
    const sessionIdsMap = new Map<WebSocketClient, string>();
    const connections = this.translationService.getConnections();
    
    for (const connection of connections) {
      if (connection.sessionId) {
        const legacyClient = this.adaptToLegacyClient(connection);
        sessionIdsMap.set(legacyClient, connection.sessionId);
      }
    }
    
    return sessionIdsMap;
  }

  set sessionIds(value: Map<WebSocketClient, string>) {
    // In the new architecture, session IDs are set during registration
    logger.warn('Setting sessionIds directly is deprecated in new architecture');
  }

  get clientSettings(): Map<WebSocketClient, any> {
    const settingsMap = new Map<WebSocketClient, any>();
    const connections = this.translationService.getConnections();
    
    for (const connection of connections) {
      if (connection.settings) {
        const legacyClient = this.adaptToLegacyClient(connection);
        settingsMap.set(legacyClient, connection.settings);
      }
    }
    
    return settingsMap;
  }

  set clientSettings(value: Map<WebSocketClient, any>) {
    // In the new architecture, settings are managed during settings messages
    logger.warn('Setting clientSettings directly is deprecated in new architecture');
  }

  // Test helper methods for compatibility
  _addTestConnection(ws: WebSocketClient, sessionId: string, role?: string, language?: string, settings?: any): void {
    // In the new architecture, connections are managed internally
    // This is for test compatibility only
    logger.warn('_addTestConnection is deprecated in new architecture');
  }

  updateStorage(newStorage: IStorage): void {
    // In the new architecture, storage updates would require recreating the service
    logger.warn('updateStorage is deprecated - storage is immutable in new architecture');
  }

  // Static cleanup method for backward compatibility
  static shutdownAll(): void {
    logger.info(`[WebSocketServer] Shutting down ${WebSocketServer.instances.size} remaining instances...`);
    const instances = Array.from(WebSocketServer.instances);
    for (const instance of instances) {
      try {
        instance.shutdown();
      } catch (error) {
        logger.error('[WebSocketServer] Error during instance shutdown:', { error });
      }
    }
    logger.info('[WebSocketServer] All instances shutdown complete.');
  }

  // Helper method to adapt new IConnection to legacy WebSocketClient interface
  private adaptToLegacyClient(connection: IConnection): WebSocketClient {
    const legacyClient = connection as unknown as WebSocketClient;
    
    // Copy connection properties
    legacyClient.id = connection.id;
    legacyClient.sessionId = connection.sessionId;
    legacyClient.role = connection.role;
    legacyClient.language = connection.language;
    legacyClient.settings = connection.settings;
    legacyClient.isConnected = connection.isConnected;
    
    // Add legacy methods
    legacyClient.terminate = () => {
      connection.close().catch(error => {
        logger.error('Error terminating connection:', { error });
      });
    };
    
    legacyClient.send = (data: string, callback?: (error?: Error) => void) => {
      connection.send(data)
        .then(() => callback?.())
        .catch(error => callback?.(error));
    };
    
    legacyClient.close = () => connection.close();
    legacyClient.onMessage = (handler) => connection.onMessage(handler);
    legacyClient.onClose = (handler) => connection.onClose(handler);
    legacyClient.onError = (handler) => connection.onError(handler);
    
    // Initialize messages array for test compatibility
    if (!legacyClient.messages) {
      legacyClient.messages = [];
    }
    
    return legacyClient;
  }
}
