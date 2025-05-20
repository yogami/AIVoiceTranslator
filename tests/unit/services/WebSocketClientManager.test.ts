import { describe, it, expect, beforeEach } from 'vitest';
import { WebSocketClientManager, type WebSocketClient } from '../../../server/services/WebSocketClientManager';

// Mock WebSocket client
const createMockClient = (): WebSocketClient => {
  return {
    isAlive: false,
    send: () => {},
    close: () => {},
    terminate: () => {},
    ping: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => new Event('test'),
    CLOSED: 3,
    CLOSING: 2,
    CONNECTING: 0,
    OPEN: 1,
    on: () => ({}),
    once: () => ({}),
    off: () => ({}),
    emit: () => false,
    addListener: () => ({}),
    removeListener: () => ({}),
    removeAllListeners: () => ({}),
    setMaxListeners: () => ({}),
    getMaxListeners: () => 0,
    listeners: () => [],
    rawListeners: () => [],
    listenerCount: () => 0,
    prependListener: () => ({}),
    prependOnceListener: () => ({}),
    eventNames: () => [],
    readyState: 1,
    protocol: '',
    url: '',
    bufferedAmount: 0,
    extensions: '',
    binaryType: 'arraybuffer' as const,
    onopen: null,
    onerror: null,
    onclose: null,
    onmessage: null
  } as unknown as WebSocketClient;
};

describe('WebSocketClientManager', () => {
  let clientManager: WebSocketClientManager;
  let mockClient1: WebSocketClient;
  let mockClient2: WebSocketClient;
  let mockClient3: WebSocketClient;
  
  beforeEach(() => {
    clientManager = new WebSocketClientManager();
    mockClient1 = createMockClient();
    mockClient2 = createMockClient();
    mockClient3 = createMockClient();
  });
  
  describe('Client Management', () => {
    it('should add a client with default values', () => {
      const client = clientManager.addClient(mockClient1);
      
      expect(client.isAlive).toBe(true);
      expect(client.sessionId).toBeDefined();
      expect(clientManager.getAllClients().has(client)).toBe(true);
    });
    
    it('should add a client with role and language', () => {
      const client = clientManager.addClient(mockClient1, 'teacher', 'en-US');
      
      expect(client.role).toBe('teacher');
      expect(client.languageCode).toBe('en-US');
      expect(clientManager.getClientRole(client)).toBe('teacher');
      expect(clientManager.getClientLanguage(client)).toBe('en-US');
    });
    
    it('should remove a client', () => {
      clientManager.addClient(mockClient1, 'teacher', 'en-US');
      
      expect(clientManager.getAllClients().size).toBe(1);
      
      clientManager.removeClient(mockClient1);
      
      expect(clientManager.getAllClients().size).toBe(0);
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
    
    it('should manage client settings', () => {
      clientManager.addClient(mockClient1);
      
      // Initial settings should be empty
      expect(clientManager.getClientSettings(mockClient1)).toEqual({});
      
      // Update settings
      const settings = clientManager.updateClientSettings(mockClient1, {
        ttsServiceType: 'openai',
        volume: 0.8
      });
      
      expect(settings).toEqual({
        ttsServiceType: 'openai',
        volume: 0.8
      });
      
      // Get updated settings
      expect(clientManager.getClientSettings(mockClient1)).toEqual({
        ttsServiceType: 'openai',
        volume: 0.8
      });
      
      // Merge with existing settings
      const updatedSettings = clientManager.updateClientSettings(mockClient1, {
        volume: 0.5,
        speed: 1.2
      });
      
      expect(updatedSettings).toEqual({
        ttsServiceType: 'openai',
        volume: 0.5,
        speed: 1.2
      });
    });
  });
  
  describe('Client Filtering', () => {
    beforeEach(() => {
      clientManager.addClient(mockClient1, 'teacher', 'en-US');
      clientManager.addClient(mockClient2, 'student', 'fr-FR');
      clientManager.addClient(mockClient3, 'student', 'es-ES');
    });
    
    it('should get clients by role', () => {
      const teachers = clientManager.getClientsByRole('teacher');
      const students = clientManager.getClientsByRole('student');
      
      expect(teachers.length).toBe(1);
      expect(teachers[0]).toBe(mockClient1);
      
      expect(students.length).toBe(2);
      expect(students).toContain(mockClient2);
      expect(students).toContain(mockClient3);
    });
    
    it('should get clients by language', () => {
      const englishClients = clientManager.getClientsByLanguage('en-US');
      const frenchClients = clientManager.getClientsByLanguage('fr-FR');
      const spanishClients = clientManager.getClientsByLanguage('es-ES');
      
      expect(englishClients.length).toBe(1);
      expect(englishClients[0]).toBe(mockClient1);
      
      expect(frenchClients.length).toBe(1);
      expect(frenchClients[0]).toBe(mockClient2);
      
      expect(spanishClients.length).toBe(1);
      expect(spanishClients[0]).toBe(mockClient3);
    });
    
    it('should get teacher clients', () => {
      const teachers = clientManager.getTeacherClients();
      
      expect(teachers.length).toBe(1);
      expect(teachers[0]).toBe(mockClient1);
    });
    
    it('should get student clients', () => {
      const students = clientManager.getStudentClients();
      
      expect(students.length).toBe(2);
      expect(students).toContain(mockClient2);
      expect(students).toContain(mockClient3);
    });
    
    it('should get student languages', () => {
      const languages = clientManager.getStudentLanguages();
      
      expect(languages.length).toBe(2);
      expect(languages).toContain('fr-FR');
      expect(languages).toContain('es-ES');
      expect(languages).not.toContain('en-US'); // Teacher language
    });
    
    it('should get students by language', () => {
      const studentsByLanguage = clientManager.getStudentsByLanguage();
      
      expect(studentsByLanguage.size).toBe(2);
      expect(studentsByLanguage.has('fr-FR')).toBe(true);
      expect(studentsByLanguage.has('es-ES')).toBe(true);
      
      const frenchStudents = studentsByLanguage.get('fr-FR')!;
      expect(frenchStudents.length).toBe(1);
      expect(frenchStudents[0]).toBe(mockClient2);
      
      const spanishStudents = studentsByLanguage.get('es-ES')!;
      expect(spanishStudents.length).toBe(1);
      expect(spanishStudents[0]).toBe(mockClient3);
    });
  });
});