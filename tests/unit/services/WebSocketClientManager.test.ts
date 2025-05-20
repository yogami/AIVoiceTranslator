import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebSocketClientManager } from '../../../server/services/WebSocketClientManager';
import { WebSocketClient } from '../../../server/services/WebSocketTypes';

// Mock WebSocketClient
const createMockWebSocketClient = (): any => ({
  isAlive: false,
  sessionId: '',
  on: vi.fn(),
  terminate: vi.fn(),
  ping: vi.fn(),
  send: vi.fn()
});

describe('WebSocketClientManager', () => {
  let clientManager: WebSocketClientManager;
  let mockClient: WebSocketClient;
  
  beforeEach(() => {
    clientManager = new WebSocketClientManager();
    mockClient = createMockWebSocketClient();
  });
  
  it('should add clients and generate session IDs', () => {
    const sessionId = clientManager.addClient(mockClient);
    
    expect(sessionId).toBeDefined();
    expect(sessionId).toContain('session_');
    expect(mockClient.isAlive).toBe(true);
    expect(clientManager.getSessionId(mockClient)).toBe(sessionId);
    expect(clientManager.getAllConnections().size).toBe(1);
  });
  
  it('should add clients with provided session ID', () => {
    const customId = 'custom_session_123';
    const sessionId = clientManager.addClient(mockClient, customId);
    
    expect(sessionId).toBe(customId);
    expect(clientManager.getSessionId(mockClient)).toBe(customId);
  });
  
  it('should remove clients and clean up associated data', () => {
    // Set up client with various data
    clientManager.addClient(mockClient);
    clientManager.setRole(mockClient, 'teacher');
    clientManager.setLanguage(mockClient, 'en-US');
    clientManager.updateSettings(mockClient, { ttsServiceType: 'openai' });
    
    // Verify data exists
    expect(clientManager.getRole(mockClient)).toBe('teacher');
    expect(clientManager.getLanguage(mockClient)).toBe('en-US');
    
    // Remove client
    clientManager.removeClient(mockClient);
    
    // Verify client and data are removed
    expect(clientManager.getAllConnections().size).toBe(0);
    expect(clientManager.getRole(mockClient)).toBeUndefined();
    expect(clientManager.getLanguage(mockClient)).toBeUndefined();
    expect(clientManager.getSessionId(mockClient)).toBeUndefined();
    expect(clientManager.getSettings(mockClient)).toEqual({});
  });
  
  it('should manage client roles', () => {
    clientManager.addClient(mockClient);
    
    // Set role
    clientManager.setRole(mockClient, 'teacher');
    expect(clientManager.getRole(mockClient)).toBe('teacher');
    
    // Change role
    clientManager.setRole(mockClient, 'student');
    expect(clientManager.getRole(mockClient)).toBe('student');
  });
  
  it('should manage client languages', () => {
    clientManager.addClient(mockClient);
    
    // Set language
    clientManager.setLanguage(mockClient, 'en-US');
    expect(clientManager.getLanguage(mockClient)).toBe('en-US');
    
    // Change language
    clientManager.setLanguage(mockClient, 'es-ES');
    expect(clientManager.getLanguage(mockClient)).toBe('es-ES');
  });
  
  it('should manage client settings', () => {
    clientManager.addClient(mockClient);
    
    // Update settings
    const settings = clientManager.updateSettings(mockClient, { 
      ttsServiceType: 'openai', 
      volume: 0.8 
    });
    
    expect(settings).toEqual({ ttsServiceType: 'openai', volume: 0.8 });
    expect(clientManager.getSettings(mockClient)).toEqual({ ttsServiceType: 'openai', volume: 0.8 });
    
    // Update partial settings
    clientManager.updateSettings(mockClient, { volume: 0.5 });
    expect(clientManager.getSettings(mockClient)).toEqual({ ttsServiceType: 'openai', volume: 0.5 });
  });
  
  it('should get clients by role', () => {
    const client1 = createMockWebSocketClient();
    const client2 = createMockWebSocketClient();
    const client3 = createMockWebSocketClient();
    
    clientManager.addClient(client1);
    clientManager.addClient(client2);
    clientManager.addClient(client3);
    
    clientManager.setRole(client1, 'teacher');
    clientManager.setRole(client2, 'student');
    clientManager.setRole(client3, 'student');
    
    const students = clientManager.getClientsByRole('student');
    const teachers = clientManager.getClientsByRole('teacher');
    const admins = clientManager.getClientsByRole('admin');
    
    expect(students.length).toBe(2);
    expect(teachers.length).toBe(1);
    expect(admins.length).toBe(0);
    expect(students).toContain(client2);
    expect(students).toContain(client3);
    expect(teachers).toContain(client1);
  });
  
  it('should get clients by language', () => {
    const client1 = createMockWebSocketClient();
    const client2 = createMockWebSocketClient();
    const client3 = createMockWebSocketClient();
    
    clientManager.addClient(client1);
    clientManager.addClient(client2);
    clientManager.addClient(client3);
    
    clientManager.setLanguage(client1, 'en-US');
    clientManager.setLanguage(client2, 'es-ES');
    clientManager.setLanguage(client3, 'en-US');
    
    const englishClients = clientManager.getClientsByLanguage('en-US');
    const spanishClients = clientManager.getClientsByLanguage('es-ES');
    const frenchClients = clientManager.getClientsByLanguage('fr-FR');
    
    expect(englishClients.length).toBe(2);
    expect(spanishClients.length).toBe(1);
    expect(frenchClients.length).toBe(0);
    expect(englishClients).toContain(client1);
    expect(englishClients).toContain(client3);
    expect(spanishClients).toContain(client2);
  });
  
  it('should get languages by role', () => {
    const client1 = createMockWebSocketClient();
    const client2 = createMockWebSocketClient();
    const client3 = createMockWebSocketClient();
    const client4 = createMockWebSocketClient();
    
    clientManager.addClient(client1);
    clientManager.addClient(client2);
    clientManager.addClient(client3);
    clientManager.addClient(client4);
    
    clientManager.setRole(client1, 'student');
    clientManager.setRole(client2, 'student');
    clientManager.setRole(client3, 'student');
    clientManager.setRole(client4, 'teacher');
    
    clientManager.setLanguage(client1, 'en-US');
    clientManager.setLanguage(client2, 'es-ES');
    clientManager.setLanguage(client3, 'en-US');
    clientManager.setLanguage(client4, 'fr-FR');
    
    const studentLanguages = clientManager.getLanguagesByRole('student');
    const teacherLanguages = clientManager.getLanguagesByRole('teacher');
    
    expect(studentLanguages.length).toBe(2);
    expect(teacherLanguages.length).toBe(1);
    expect(studentLanguages).toContain('en-US');
    expect(studentLanguages).toContain('es-ES');
    expect(teacherLanguages).toContain('fr-FR');
  });
  
  it('should handle heartbeat mechanisms', () => {
    clientManager.addClient(mockClient);
    
    // Initial state
    expect(mockClient.isAlive).toBe(true);
    
    // Mark as pending (not responding)
    clientManager.markPending(mockClient);
    expect(mockClient.isAlive).toBe(false);
    
    // Mark as alive again (responded to ping)
    clientManager.markAlive(mockClient);
    expect(mockClient.isAlive).toBe(true);
  });
});