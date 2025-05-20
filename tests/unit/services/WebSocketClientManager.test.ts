/**
 * WebSocketClientManager Unit Tests
 * 
 * Tests the client state management functionality
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketClientManager, WebSocketClient } from '../../../server/services/WebSocketClientManager';

// Mock WebSocket client implementation
class MockWebSocketClient {
  isAlive: boolean = true;
  sessionId?: string;
  send = vi.fn();
  on = vi.fn(() => this);
  terminate = vi.fn();
  ping = vi.fn();
}

describe('WebSocketClientManager', () => {
  let clientManager: WebSocketClientManager;
  let mockClient: WebSocketClient;
  
  beforeEach(() => {
    clientManager = new WebSocketClientManager();
    mockClient = new MockWebSocketClient() as unknown as WebSocketClient;
  });
  
  describe('registerClient', () => {
    it('should register a client and return a session ID', () => {
      const sessionId = clientManager.registerClient(mockClient, 'teacher', 'en-US');
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toContain('session_');
      expect(mockClient.sessionId).toBe(sessionId);
      
      // Verify client is registered
      const state = clientManager.getClientState(mockClient);
      expect(state).toBeDefined();
      expect(state?.role).toBe('teacher');
      expect(state?.language).toBe('en-US');
    });
    
    it('should create a unique session ID for each client', () => {
      const sessionId1 = clientManager.registerClient(mockClient, 'teacher', 'en-US');
      
      const mockClient2 = new MockWebSocketClient() as unknown as WebSocketClient;
      const sessionId2 = clientManager.registerClient(mockClient2, 'student', 'es-ES');
      
      expect(sessionId1).not.toBe(sessionId2);
    });
  });
  
  describe('getClientState', () => {
    it('should return undefined for unregistered clients', () => {
      const state = clientManager.getClientState(mockClient);
      expect(state).toBeUndefined();
    });
    
    it('should return client state for registered clients', () => {
      clientManager.registerClient(mockClient, 'teacher', 'en-US');
      const state = clientManager.getClientState(mockClient);
      
      expect(state).toBeDefined();
      expect(state?.role).toBe('teacher');
    });
  });
  
  describe('getClientStateBySessionId', () => {
    it('should return client state by session ID', () => {
      const sessionId = clientManager.registerClient(mockClient, 'teacher', 'en-US');
      const state = clientManager.getClientStateBySessionId(sessionId);
      
      expect(state).toBeDefined();
      expect(state?.connection).toBe(mockClient);
    });
    
    it('should return undefined for unknown session IDs', () => {
      const state = clientManager.getClientStateBySessionId('non-existent-id');
      expect(state).toBeUndefined();
    });
  });
  
  describe('client property updates', () => {
    beforeEach(() => {
      clientManager.registerClient(mockClient);
    });
    
    it('should update client role', () => {
      const result = clientManager.updateClientRole(mockClient, 'teacher');
      expect(result).toBe(true);
      
      const state = clientManager.getClientState(mockClient);
      expect(state?.role).toBe('teacher');
    });
    
    it('should update client language', () => {
      const result = clientManager.updateClientLanguage(mockClient, 'fr-FR');
      expect(result).toBe(true);
      
      const state = clientManager.getClientState(mockClient);
      expect(state?.language).toBe('fr-FR');
    });
    
    it('should update client settings', () => {
      const settings = { ttsServiceType: 'openai', volume: 0.8 };
      const result = clientManager.updateClientSettings(mockClient, settings);
      expect(result).toBe(true);
      
      const state = clientManager.getClientState(mockClient);
      expect(state?.settings).toEqual(settings);
    });
    
    it('should merge new settings with existing settings', () => {
      // Set initial settings
      clientManager.updateClientSettings(mockClient, { ttsServiceType: 'openai', volume: 0.8 });
      
      // Update subset of settings
      clientManager.updateClientSettings(mockClient, { volume: 0.5 });
      
      // Verify merge
      const state = clientManager.getClientState(mockClient);
      expect(state?.settings).toEqual({ ttsServiceType: 'openai', volume: 0.5 });
    });
  });
  
  describe('client queries', () => {
    beforeEach(() => {
      // Register multiple clients with different roles and languages
      clientManager.registerClient(mockClient, 'teacher', 'en-US');
      
      const student1 = new MockWebSocketClient() as unknown as WebSocketClient;
      clientManager.registerClient(student1, 'student', 'es-ES');
      
      const student2 = new MockWebSocketClient() as unknown as WebSocketClient;
      clientManager.registerClient(student2, 'student', 'fr-FR');
    });
    
    it('should return all clients', () => {
      const clients = clientManager.getAllClients();
      expect(clients.length).toBe(3);
    });
    
    it('should return clients by role', () => {
      const teachers = clientManager.getClientsByRole('teacher');
      const students = clientManager.getClientsByRole('student');
      
      expect(teachers.length).toBe(1);
      expect(students.length).toBe(2);
    });
    
    it('should return clients by language', () => {
      const englishClients = clientManager.getClientsByLanguage('en-US');
      const spanishClients = clientManager.getClientsByLanguage('es-ES');
      
      expect(englishClients.length).toBe(1);
      expect(spanishClients.length).toBe(1);
    });
    
    it('should return unique languages', () => {
      const languages = clientManager.getUniqueLanguages();
      
      expect(languages.length).toBe(3);
      expect(languages).toContain('en-US');
      expect(languages).toContain('es-ES');
      expect(languages).toContain('fr-FR');
    });
    
    it('should return client count by role', () => {
      const teacherCount = clientManager.getClientCountByRole('teacher');
      const studentCount = clientManager.getClientCountByRole('student');
      
      expect(teacherCount).toBe(1);
      expect(studentCount).toBe(2);
    });
    
    it('should return total client count', () => {
      const count = clientManager.getTotalClientCount();
      expect(count).toBe(3);
    });
  });
  
  describe('client messaging', () => {
    beforeEach(() => {
      clientManager.registerClient(mockClient, 'teacher', 'en-US');
    });
    
    it('should send message to a client', () => {
      const result = clientManager.sendToClient(mockClient, { type: 'test', data: 'hello' });
      
      expect(result).toBe(true);
      expect(mockClient.send).toHaveBeenCalledWith('{"type":"test","data":"hello"}');
    });
    
    it('should return false when sending to non-existent client', () => {
      const unknownClient = new MockWebSocketClient() as unknown as WebSocketClient;
      const result = clientManager.sendToClient(unknownClient, { type: 'test' });
      
      expect(result).toBe(false);
    });
    
    it('should broadcast to all clients', () => {
      const student = new MockWebSocketClient() as unknown as WebSocketClient;
      clientManager.registerClient(student, 'student', 'es-ES');
      
      const count = clientManager.broadcast({ type: 'broadcast', message: 'hello all' });
      
      expect(count).toBe(2);
      expect(mockClient.send).toHaveBeenCalledWith('{"type":"broadcast","message":"hello all"}');
      expect(student.send).toHaveBeenCalledWith('{"type":"broadcast","message":"hello all"}');
    });
    
    it('should broadcast to clients with specific role', () => {
      const student1 = new MockWebSocketClient() as unknown as WebSocketClient;
      clientManager.registerClient(student1, 'student', 'es-ES');
      
      const student2 = new MockWebSocketClient() as unknown as WebSocketClient;
      clientManager.registerClient(student2, 'student', 'fr-FR');
      
      const count = clientManager.broadcastToRole('student', { type: 'student-message' });
      
      expect(count).toBe(2);
      expect(mockClient.send).not.toHaveBeenCalled();
      expect(student1.send).toHaveBeenCalledWith('{"type":"student-message"}');
      expect(student2.send).toHaveBeenCalledWith('{"type":"student-message"}');
    });
  });
  
  describe('client removal', () => {
    it('should remove a client', () => {
      clientManager.registerClient(mockClient);
      
      const result = clientManager.removeClient(mockClient);
      expect(result).toBe(true);
      
      // Verify client is removed
      const state = clientManager.getClientState(mockClient);
      expect(state).toBeUndefined();
    });
    
    it('should return false when removing non-existent client', () => {
      const result = clientManager.removeClient(mockClient);
      expect(result).toBe(false);
    });
  });
});