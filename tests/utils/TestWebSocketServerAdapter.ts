/**
 * Test WebSocketServer Adapter
 * 
 * This adapter extends the main WebSocketServer adapter with test-specific functionality.
 * It provides the same interface as the original TestWebSocketServer for backward compatibility.
 */

import * as http from 'http';
import { IStorage } from '../../server/storage.interface';
import { WebSocketServer, WebSocketClient } from '../../server/services/communication/WebSocketServerAdapter';
import { SpeechPipelineOrchestrator } from '../../server/services/SpeechPipelineOrchestrator';

export class TestWebSocketServer extends WebSocketServer {
  // Test-specific properties
  private mockOrchestrator: SpeechPipelineOrchestrator | null = null;

  constructor(server: http.Server, storage: IStorage) {
    super(server, storage);
  }

  // Test helper methods
  setMockOrchestrator(orchestrator: SpeechPipelineOrchestrator): void {
    this.mockOrchestrator = orchestrator;
    // Note: In the new architecture, the orchestrator is internal to TranslationApplicationService
    // This method is for test compatibility only
  }

  getMockOrchestrator(): SpeechPipelineOrchestrator | null {
    return this.mockOrchestrator;
  }

  // Helper to get connection by session and role for tests
  getConnectionBySessionAndRole(sessionId: string, role: string): WebSocketClient | undefined {
    const connections = Array.from(this.getConnections()) as WebSocketClient[];
    return connections.find(conn => conn.sessionId === sessionId && conn.role === role);
  }

  // Helper to get all connections for a session
  getConnectionsBySession(sessionId: string): WebSocketClient[] {
    const connections = Array.from(this.getConnections()) as WebSocketClient[];
    return connections.filter(conn => conn.sessionId === sessionId);
  }

  // Reset server state for tests
  public resetServerState(): void {
    console.log('🔧 [RESET] Starting TestWebSocketServer state reset...');
    // In the new architecture, state is managed internally
    // This method is for test compatibility
    console.log('🔧 [RESET] State reset complete (new architecture manages state internally)');
  }

  // Shutdown with test-specific cleanup
  public async shutdownWithCleanup(): Promise<void> {
    console.log('🛑 [SHUTDOWN] Starting TestWebSocketServer shutdown...');
    this.shutdown();
    console.log('🛑 [SHUTDOWN] TestWebSocketServer shutdown complete');
  }
}
