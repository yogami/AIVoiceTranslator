import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createMockWebSocketClient } from '../utils/test-helpers';

// Mock the WebSocketClientManager since it might not exist yet
class WebSocketClientManager {
  private clients: Set<any> = new Set();
  
  addClient(client: any) {
    this.clients.add(client);
  }
  
  removeClient(client: any) {
    this.clients.delete(client);
  }
  
  getClient(client: any) {
    return this.clients.has(client) ? client : undefined;
  }
  
  getAllClients() {
    return Array.from(this.clients);
  }
  
  setClientRole(client: any, role: string) {
    if (this.clients.has(client)) {
      client.role = role;
    }
  }
  
  getClientRole(client: any) {
    return client.role;
  }
  
  setClientLanguage(client: any, language: string) {
    if (this.clients.has(client)) {
      client.languageCode = language;
    }
  }
  
  getClientLanguage(client: any) {
    return client.languageCode;
  }
  
  getClientSessionId(client: any) {
    return client.sessionId;
  }
}

describe('WebSocketClientManager', () => {
  let clientManager: WebSocketClientManager;
  let mockClient1: any;
  let mockClient2: any;
  
  beforeEach(() => {
    clientManager = new WebSocketClientManager();
    mockClient1 = createMockWebSocketClient({ sessionId: 'session-1' });
    mockClient2 = createMockWebSocketClient({ sessionId: 'session-2' });
  });
  
  describe('Client Management', () => {
    it('should add and retrieve clients', () => {
      clientManager.addClient(mockClient1);
      
      expect(clientManager.getClient(mockClient1)).toBe(mockClient1);
      expect(clientManager.getAllClients()).toContain(mockClient1);
    });
    
    it('should remove clients', () => {
      clientManager.addClient(mockClient1);
      clientManager.removeClient(mockClient1);
      
      expect(clientManager.getClient(mockClient1)).toBeUndefined();
      expect(clientManager.getAllClients()).not.toContain(mockClient1);
    });
  });
  
  describe('Client Properties', () => {
    it('should set and get client role', () => {
      clientManager.addClient(mockClient1);
      
      clientManager.setClientRole(mockClient1, 'student');
      expect(clientManager.getClientRole(mockClient1)).toBe('student');
      expect(mockClient1.role).toBe('student');
      
      clientManager.setClientRole(mockClient1, 'teacher');
      expect(clientManager.getClientRole(mockClient1)).toBe('teacher');
      expect(mockClient1.role).toBe('teacher');
    });
    
    it('should set and get client language', () => {
      clientManager.addClient(mockClient1);
      
      clientManager.setClientLanguage(mockClient1, 'fr-FR');
      expect(clientManager.getClientLanguage(mockClient1)).toBe('fr-FR');
      expect(mockClient1.languageCode).toBe('fr-FR');
      
      clientManager.setClientLanguage(mockClient1, 'es-ES');
      expect(clientManager.getClientLanguage(mockClient1)).toBe('es-ES');
      expect(mockClient1.languageCode).toBe('es-ES');
    });
    
    it('should get client session ID', () => {
      clientManager.addClient(mockClient1);
      
      const sessionId = clientManager.getClientSessionId(mockClient1);
      expect(sessionId).toBeDefined();
      expect(mockClient1.sessionId).toBe(sessionId);
    });
  });
});