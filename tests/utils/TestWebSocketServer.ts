/**
 * Test WebSocketServer that provides access to protected properties
 * for the purpose of integration testing.
 */
import * as http from 'http';
import { WebSocketServer } from '../../server/interface-adapters/websocket/WebSocketServer';
import { IStorage } from '../../server/storage.interface';
import { MessageDispatcher } from '../../server/interface-adapters/websocket/websocket-services/MessageHandler';

export class TestWebSocketServer extends WebSocketServer {
  // Constructor that matches the parent class
  constructor(
    server: http.Server, 
    storage: IStorage
  ) {
    super(server, storage);
  }

  // Reset server state to make tests idempotent
  public resetServerState(): void {
    console.log('🔧 [RESET] Starting TestWebSocketServer state reset...');
    
    const ws = this as any;
    
    // FORCE COMPLETE STATE RESET - Don't just warn about errors, fix them
    try {
      // Clear all connections aggressively
      if (ws.connectionManager) {
        const connections = ws.connectionManager.getConnections();
        if (connections) {
          connections.forEach((client: any) => {
            try {
              if (client && typeof client.terminate === 'function') {
                client.terminate();
              }
            } catch (e) {
              // Force close
              if (client && typeof client.close === 'function') {
                client.close();
              }
            }
          });
        }
        
        if (typeof ws.connectionManager.clearAll === 'function') {
          ws.connectionManager.clearAll();
        }
      }
      
      // Stop cleanup services
      if (ws.unifiedSessionCleanupService && typeof ws.unifiedSessionCleanupService.stop === 'function') {
        ws.unifiedSessionCleanupService.stop();
      }
      
      // Clear classroom sessions
      if (ws.classroomSessionManager && typeof ws.classroomSessionManager.clearAll === 'function') {
        ws.classroomSessionManager.clearAll();
      }
      
      console.log('🔧 [RESET] ✅ Complete state reset successful');
    } catch (error) {
      console.warn('🔧 [RESET] ⚠️ Reset error (ignoring):', error instanceof Error ? error.message : String(error));
    }
  }

  // Enhanced shutdown method to ensure complete cleanup
  public async shutdown(): Promise<void> {
    const ws = this as any;
    
    // Reset to original state first
    this.resetServerState();
    
    // Call parent shutdown
    await super.shutdown();
    
    console.log('🔧 ✅ TestWebSocketServer shutdown complete');
  }

  // Expose the speech pipeline orchestrator for testing
  public getSpeechPipelineOrchestrator(): any {
    return (this as any).speechPipelineOrchestrator;
  }

  /**
   * Get the cleanup service for testing purposes
   */
  public getSessionCleanupService(): any {
    return (this as any).unifiedSessionCleanupService;
  }

  // Expose the message handler registry for testing
  public getMessageHandlerRegistry(): any {
    return (this as any).messageHandlerRegistry;
  }

  // Expose the WebSocketServer instance for tests that need direct access
  public getWebSocketServer(): WebSocketServer {
    return this;
  }
}
