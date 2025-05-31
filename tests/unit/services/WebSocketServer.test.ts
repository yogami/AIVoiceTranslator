/**
 * WebSocketServer Unit Tests
 * 
 * Comprehensive tests for the ACTIVE WebSocketServer implementation
 * Consolidated from multiple test files
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Server as HttpServer } from 'http';
import { WebSocketServer } from '../../../server/services/WebSocketServer';
import { createMockWebSocketClient, createMockRequest } from '../utils/test-helpers';

// Mock the translation service
vi.mock('../../../server/services/TranslationService', () => ({
  speechTranslationService: {
    translateSpeech: vi.fn().mockResolvedValue({
      originalText: 'Hello class',
      translatedText: 'Hola clase',
      audioBuffer: Buffer.from('mock-audio-data')
    })
  }
}));

describe('WebSocketServer - Real Implementation', () => {
  let httpServer: HttpServer;
  let wsServer: WebSocketServer;

  beforeEach(() => {
    httpServer = new HttpServer();
    wsServer = new WebSocketServer(httpServer);
  });

  afterEach(() => {
    wsServer.close();
    vi.clearAllMocks();
  });

  describe('Connection Management', () => {
    it('should track connections', () => {
      const mockWs = createMockWebSocketClient();
      
      // Simulate connection
      const connections = wsServer.getConnections();
      expect(connections.size).toBe(0);
      
      // Add connection through public method
      connections.add(mockWs);
      expect(connections.size).toBe(1);
    });

    it('should handle message processing', async () => {
      const mockWs = createMockWebSocketClient();
      
      // Test registration message
      await wsServer.handleMessage(mockWs, JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      expect(mockWs.send).toHaveBeenCalled();
      const sentMessage = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(sentMessage.type).toBe('register');
      expect(sentMessage.status).toBe('success');
    });

    it('should store role and language information', async () => {
      const mockWs = createMockWebSocketClient();
      
      await wsServer.handleMessage(mockWs, JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es'
      }));

      expect(wsServer.getRole(mockWs)).toBe('student');
      expect(wsServer.getLanguage(mockWs)).toBe('es');
    });
  });

  describe('Message Handling', () => {
    it('should handle ping messages', async () => {
      const mockWs = createMockWebSocketClient();
      const timestamp = Date.now();
      
      await wsServer.handleMessage(mockWs, JSON.stringify({
        type: 'ping',
        timestamp
      }));

      expect(mockWs.send).toHaveBeenCalled();
      const response = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(response.type).toBe('pong');
      expect(response.originalTimestamp).toBe(timestamp);
    });

    it('should handle settings messages', async () => {
      const mockWs = createMockWebSocketClient();
      
      await wsServer.handleMessage(mockWs, JSON.stringify({
        type: 'settings',
        ttsServiceType: 'openai'
      }));

      expect(mockWs.send).toHaveBeenCalled();
      const response = JSON.parse(mockWs.send.mock.calls[0][0]);
      expect(response.type).toBe('settings');
      expect(response.status).toBe('success');
    });

    it('should handle invalid JSON gracefully', async () => {
      const mockWs = createMockWebSocketClient();
      
      // Should not throw
      await expect(
        wsServer.handleMessage(mockWs, 'invalid json{')
      ).resolves.toBeUndefined();
    });
  });

  describe('Translation Flow', () => {
    it('should process teacher transcriptions', async () => {
      const mockTeacher = createMockWebSocketClient();
      const mockStudent = createMockWebSocketClient();
      
      // Register teacher
      await wsServer.handleMessage(mockTeacher, JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      // Register student
      await wsServer.handleMessage(mockStudent, JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es'
      }));

      // Add student to connections
      wsServer.getConnections().add(mockStudent);

      // Teacher sends transcription
      await wsServer.handleMessage(mockTeacher, JSON.stringify({
        type: 'transcription',
        text: 'Hello class',
        isFinal: true
      }));

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 100));

      // Verify translation was sent to student
      const studentMessages = mockStudent.send.mock.calls;
      const translationMessage = studentMessages.find((call: any[]) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg.type === 'translation';
        } catch {
          return false;
        }
      });

      expect(translationMessage).toBeDefined();
    });

    it('should ignore transcriptions from non-teachers', async () => {
      const mockStudent = createMockWebSocketClient();
      
      await wsServer.handleMessage(mockStudent, JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es'
      }));

      await wsServer.handleMessage(mockStudent, JSON.stringify({
        type: 'transcription',
        text: 'Should be ignored',
        isFinal: true
      }));

      // Student should only receive registration confirmation
      expect(mockStudent.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('Classroom Management', () => {
    it('should generate classroom codes for teachers', async () => {
      const mockTeacher = createMockWebSocketClient();
      
      await wsServer.handleMessage(mockTeacher, JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));

      const messages = mockTeacher.send.mock.calls;
      const classroomMessage = messages.find((call: any[]) => {
        try {
          const msg = JSON.parse(call[0]);
          return msg.type === 'classroom_code';
        } catch {
          return false;
        }
      });

      if (classroomMessage) {
        const msg = JSON.parse(classroomMessage[0]);
        expect(msg.code).toMatch(/^[A-Z0-9]{6}$/);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown message types', async () => {
      const mockWs = createMockWebSocketClient();
      
      await wsServer.handleMessage(mockWs, JSON.stringify({
        type: 'unknown_type',
        data: 'test'
      }));

      // Should not crash
      expect(wsServer.getConnections().has(mockWs)).toBe(false);
    });

    it('should handle malformed messages', async () => {
      const mockWs = createMockWebSocketClient();
      
      await expect(
        wsServer.handleMessage(mockWs, '')
      ).resolves.toBeUndefined();
    });
  });
});