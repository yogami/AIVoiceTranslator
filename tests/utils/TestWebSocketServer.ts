/**
 * Test WebSocketServer that provides access to protected properties
 * for the purpose of integration testing.
 */
import * as http from 'http';
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { IStorage } from '../../server/storage.interface';
import { DiagnosticsService } from '../../server/services/DiagnosticsService';
import { MockTranslationOrchestrator } from './MockTranslationOrchestrator';

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

  // Allow setting a mock translation orchestrator for testing
  setMockTranslationOrchestrator(mockTranslationService?: any): void {
    console.log('🔧 Installing MockTranslationOrchestrator...');
    
    // Access the protected translationOrchestrator via any casting
    const ws = this as any;
    
    // Check if we have access to the translation orchestrator
    console.log('🔧 Checking for existing translation orchestrator...');
    
    if (ws.translationOrchestrator) {
      console.log('🔧 Original orchestrator found, replacing with mock');
      
      // Create a complete mock orchestrator
      const mockOrchestrator = new MockTranslationOrchestrator(ws.translationOrchestrator.storage);
      
      // Replace the orchestrator completely
      ws.translationOrchestrator = mockOrchestrator;
      
      console.log('🔧 ✅ MockTranslationOrchestrator installed successfully');
      console.log('🔧 Mock orchestrator type:', mockOrchestrator.constructor.name);
      
      // Verify the mock is working by checking one of the methods
      if (typeof mockOrchestrator.translateToMultipleLanguages === 'function') {
        console.log('🔧 ✅ translateToMultipleLanguages method confirmed as mock');
      } else {
        console.log('🔧 ❌ translateToMultipleLanguages method not found');
      }
    } else {
      console.warn('🔧 ❌ Could not install mock translation service - translationOrchestrator not found');
      console.log('🔧 Available properties on WebSocketServer:', Object.keys(ws));
    }
  }

  // Expose the translation orchestrator for testing
  public getTranslationOrchestrator(): any {
    return (this as any).translationOrchestrator;
  }
}
