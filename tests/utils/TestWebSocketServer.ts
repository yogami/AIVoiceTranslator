/**
 * Test WebSocketServer that provides access to protected properties
 * for the purpose of integration testing.
 */
import * as http from 'http';
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { IStorage } from '../../server/storage.interface';
import { DiagnosticsService } from '../../server/services/DiagnosticsService';
import { MockTranslationOrchestrator } from './MockTranslationOrchestrator';
import { MessageDispatcher } from '../../server/services/websocket/MessageHandler';

export class TestWebSocketServer extends WebSocketServer {
  // Constructor that matches the parent class with optional diagnostics service
  constructor(
    server: http.Server, 
    storage: IStorage, 
    diagnosticsService?: DiagnosticsService
  ) {
    super(server, storage);
    
    // Set diagnostics service if provided
    if (diagnosticsService) {
      // Access the protected properties via any casting
      const ws = this as any;
      ws.diagnosticsService = diagnosticsService;
    }
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
      
      // Stop all services
      if (ws.sessionCleanupService && typeof ws.sessionCleanupService.stop === 'function') {
        ws.sessionCleanupService.stop();
      }
      
      // Clear classroom sessions
      if (ws.classroomSessionManager && typeof ws.classroomSessionManager.clearAll === 'function') {
        ws.classroomSessionManager.clearAll();
      }
      
      // Reset orchestrator completely
      if (ws.originalTranslationOrchestrator) {
        ws.translationOrchestrator = ws.originalTranslationOrchestrator;
        
        // Recreate message dispatcher
        if (ws.messageDispatcher && ws.messageHandlerRegistry) {
          const originalContext = {
            ws: null as any,
            connectionManager: ws.connectionManager,
            storage: ws.storage,
            sessionService: ws.sessionService,
            translationService: ws.originalTranslationOrchestrator,
            sessionLifecycleService: ws.sessionLifecycleService,
            webSocketServer: this
          };
          
          ws.messageDispatcher = new MessageDispatcher(ws.messageHandlerRegistry, originalContext);
        }
        
        ws.originalTranslationOrchestrator = null;
      }
      
      console.log('🔧 [RESET] ✅ Complete state reset successful');
    } catch (error) {
      console.warn('🔧 [RESET] ⚠️ Reset error (ignoring):', error instanceof Error ? error.message : String(error));
    }
  }

  // Allow setting a mock translation orchestrator for testing
  setMockTranslationOrchestrator(mockTranslationService?: any): void {
    const ws = this as any;
    
    if (ws.translationOrchestrator) {
      // Store original orchestrator if not already stored
      if (!ws.originalTranslationOrchestrator) {
        ws.originalTranslationOrchestrator = ws.translationOrchestrator;
      }
      
      // Create a complete mock orchestrator
      const mockOrchestrator = new MockTranslationOrchestrator(ws.translationOrchestrator.storage);
      
      // Replace the orchestrator completely
      ws.translationOrchestrator = mockOrchestrator;
      
      // CRITICAL: Update the message dispatcher context to use the mock
      if (ws.messageDispatcher && ws.messageHandlerRegistry) {
        const newContext = {
          ws: null as any,
          connectionManager: ws.connectionManager,
          storage: ws.storage,
          sessionService: ws.sessionService,
          translationService: mockOrchestrator, // Use the mock orchestrator here!
          sessionLifecycleService: ws.sessionLifecycleService,
          webSocketServer: this
        };
        
        ws.messageDispatcher = new MessageDispatcher(ws.messageHandlerRegistry, newContext);
      }
      
      console.log('🔧 [MOCK] ✅ MockTranslationOrchestrator installed');
    } else {
      console.warn('🔧 [MOCK] ❌ Could not install mock - translationOrchestrator not found');
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

  // Expose the translation orchestrator for testing
  public getTranslationOrchestrator(): any {
    return (this as any).translationOrchestrator;
  }

  // Expose the session cleanup service for testing
  public getSessionCleanupService(): any {
    return (this as any).sessionCleanupService;
  }

  // Expose the original translation orchestrator for testing
  public getOriginalTranslationOrchestrator(): any {
    return (this as any).originalTranslationOrchestrator;
  }
}
