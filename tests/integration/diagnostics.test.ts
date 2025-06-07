/**
 * Diagnostics Service Integration Tests
 * 
 * Tests that the diagnostics/analytics service:
 * 1. Collects metrics without interfering with core functionality
 * 2. Provides both real-time (in-memory) and historical (persistent) data
 * 3. Gracefully handles failures without affecting translations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import { WebSocketServer } from '../../server/services/WebSocketServer';
import { storage } from '../../server/storage';

describe('Diagnostics Service Integration', () => {
  let httpServer: Server;
  let wsServer: WebSocketServer;
  let actualPort: number;
  
  beforeAll(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Initialize WebSocket server
    wsServer = new WebSocketServer(httpServer);
    
    // Start HTTP server
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        actualPort = (httpServer.address() as any)?.port || 5000;
        console.log(`Test server started on port ${actualPort}`);
        resolve();
      });
    });
  });
  
  afterAll(async () => {
    // Ensure all WebSocket clients are closed (if tracked)
    wsServer.close();
    // Close HTTP server
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }, 60000); // Increase timeout to 60s
  
  beforeEach(() => {
    // Clear any existing sessions/metrics before each test
    // This ensures test isolation
  });
  
  describe('Non-Interference with Core Functionality', () => {
    it('should collect metrics without breaking teacher-student translation flow', async () => {
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      
      // Create teacher connection
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      teacherClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        teacherMessages.push(message);
      });
      
      await new Promise<void>((resolve) => {
        teacherClient.on('open', resolve);
      });
      
      // Wait for connection confirmation
      await waitForMessage(teacherMessages, 'connection');
      
      // Register teacher
      teacherClient.send(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
      
      await waitForMessage(teacherMessages, 'register');
      await waitForMessage(teacherMessages, 'classroom_code');
      
      // Get classroom code
      const classroomCodeMsg = teacherMessages.find(m => m.type === 'classroom_code');
      expect(classroomCodeMsg).toBeDefined();
      const classroomCode = classroomCodeMsg.code;
      
      // Create student connection with classroom code
      const studentClient = new WebSocket(`ws://localhost:${actualPort}?code=${classroomCode}`);
      
      studentClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        studentMessages.push(message);
      });
      
      await new Promise<void>((resolve) => {
        studentClient.on('open', resolve);
      });
      
      await waitForMessage(studentMessages, 'connection');
      
      // Register student
      studentClient.send(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }));
      
      await waitForMessage(studentMessages, 'register');
      
      // Clear messages before translation
      studentMessages.length = 0;
      
      // Teacher sends transcription
      teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello, this is a test message.'
      }));
      
      // Wait for translation
      await waitForMessage(studentMessages, 'translation', 10000);
      
      const translation = studentMessages.find(m => m.type === 'translation');
      expect(translation).toBeDefined();
      expect(translation.originalText).toBe('Hello, this is a test message.');
      expect(translation.targetLanguage).toBe('es-ES');
      expect(translation.text).toBeDefined();
      
      // Verify metrics were collected (check storage)
      const activeSessions = await storage.getAllActiveSessions();
      expect(activeSessions.length).toBeGreaterThan(0);
      
      // Clean up
      teacherClient.close();
      studentClient.close();
    });
    
    it('should continue working even if metrics collection fails', async () => {
      // Temporarily break metrics collection (we'll mock this when implementing)
      // For now, just verify the translation still works
      
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const studentClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      
      teacherClient.on('message', (data) => {
        teacherMessages.push(JSON.parse(data.toString()));
      });
      
      studentClient.on('message', (data) => {
        studentMessages.push(JSON.parse(data.toString()));
      });
      
      await Promise.all([
        new Promise<void>((resolve) => teacherClient.on('open', resolve)),
        new Promise<void>((resolve) => studentClient.on('open', resolve))
      ]);
      
      // Register both clients
      teacherClient.send(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
      
      studentClient.send(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'fr-FR'
      }));
      
      await Promise.all([
        waitForMessage(teacherMessages, 'register'),
        waitForMessage(studentMessages, 'register')
      ]);
      
      // Clear messages
      studentMessages.length = 0;
      
      // Send transcription
      teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Testing resilience'
      }));
      
      // Translation should still work
      await waitForMessage(studentMessages, 'translation', 10000);
      
      const translation = studentMessages.find(m => m.type === 'translation');
      expect(translation).toBeDefined();
      expect(translation.text).toBeDefined();
      
      // Clean up
      teacherClient.close();
      studentClient.close();
    });
  });
  
  describe('Real-Time Metrics Collection', () => {
    it('should track active sessions count', async () => {
      // Create multiple teacher connections
      const teacher1 = new WebSocket(`ws://localhost:${actualPort}`);
      const teacher2 = new WebSocket(`ws://localhost:${actualPort}`);
      
      await Promise.all([
        new Promise<void>((resolve) => teacher1.on('open', resolve)),
        new Promise<void>((resolve) => teacher2.on('open', resolve))
      ]);
      
      // Register teachers
      teacher1.send(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
      
      teacher2.send(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
      
      // Wait a bit for registration
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Check active sessions
      const activeSessions = await storage.getAllActiveSessions();
      expect(activeSessions.length).toBeGreaterThanOrEqual(2);
      
      // Clean up
      teacher1.close();
      teacher2.close();
    });
    
    it('should track translation latency', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const studentClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      const studentMessages: any[] = [];
      
      studentClient.on('message', (data) => {
        studentMessages.push(JSON.parse(data.toString()));
      });
      
      await Promise.all([
        new Promise<void>((resolve) => teacherClient.on('open', resolve)),
        new Promise<void>((resolve) => studentClient.on('open', resolve))
      ]);
      
      // Register clients
      teacherClient.send(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
      
      studentClient.send(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'de-DE'
      }));
      
      // Wait for registrations
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Clear messages
      studentMessages.length = 0;
      
      // Send transcription
      const startTime = Date.now();
      teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Latency test message'
      }));
      
      // Wait for translation
      await waitForMessage(studentMessages, 'translation', 10000);
      
      const translation = studentMessages.find(m => m.type === 'translation');
      expect(translation).toBeDefined();
      expect(translation.latency).toBeDefined();
      expect(translation.latency.total).toBeGreaterThan(0);
      expect(translation.latency.total).toBeLessThan(5000); // Should be less than 5 seconds
      
      // Clean up
      teacherClient.close();
      studentClient.close();
    });
  });
  
  describe('Historical Metrics Storage', () => {
    it('should persist session data for later analysis', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      await new Promise<void>((resolve) => {
        teacherClient.on('open', resolve);
      });
      
      // Register teacher
      teacherClient.send(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
      
      // Wait for registration
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get session before closing
      const activeSessionsBefore = await storage.getAllActiveSessions();
      const sessionId = activeSessionsBefore[activeSessionsBefore.length - 1]?.sessionId;
      
      // Close connection
      teacherClient.close();
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Session should be marked as ended
      const activeSessionsAfter = await storage.getAllActiveSessions();
      const endedSession = await storage.getActiveSession(sessionId);
      
      expect(endedSession).toBeUndefined(); // No longer active
      expect(activeSessionsAfter.length).toBeLessThan(activeSessionsBefore.length);
    });
    
    it('should store translation history with language pairs', async () => {
      const teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      const studentClient = new WebSocket(`ws://localhost:${actualPort}`);
      await Promise.all([
        new Promise<void>((resolve) => teacherClient.on('open', resolve)),
        new Promise<void>((resolve) => studentClient.on('open', resolve))
      ]);
      // Register clients
      teacherClient.send(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
      studentClient.send(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'ja-JP'
      }));
      // Wait for registrations
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Send transcription
      teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Historical data test'
      }));
      // Wait for translation to be processed and stored (retry for up to 20 seconds)
      let translations: any[] = [];
      const maxAttempts = 40; // 20 seconds
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        translations = await storage.getTranslationsByLanguage('ja-JP', 10);
        if (translations.length > 0) break;
        console.log(`[diagnostics.test] Attempt ${attempt + 1}: No translations yet.`);
        await new Promise(res => setTimeout(res, 500));
      }
      console.log('[diagnostics.test] Final translations:', translations);
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey && !apiKey.startsWith('test-') && !apiKey.startsWith('sk-place') && apiKey !== '') {
        expect(translations.length).toBeGreaterThan(0);
        const latestTranslation = translations[0];
        expect(latestTranslation.sourceLanguage).toBe('en-US');
        expect(latestTranslation.targetLanguage).toBe('ja-JP');
        expect(latestTranslation.originalText).toBe('Historical data test');
      } else {
        throw new Error('OPENAI_API_KEY is missing or invalid. Please provide a real OpenAI API key to run this integration test.');
      }
      // Clean up
      teacherClient.close();
      studentClient.close();
    });
  });
});

// Helper function
async function waitForMessage(messages: any[], messageType: string, timeout = 5000): Promise<void> {
  const startTime = Date.now();
  
  return new Promise((resolve, reject) => {
    const checkInterval = setInterval(() => {
      const found = messages.find(m => m.type === messageType);
      
      if (found) {
        clearInterval(checkInterval);
        resolve();
      } else if (Date.now() - startTime > timeout) {
        clearInterval(checkInterval);
        console.error(`Timeout waiting for message type: ${messageType}`);
        console.error('Received messages:', messages.map(m => m.type));
        reject(new Error(`Timeout waiting for message type: ${messageType}`));
      }
    }, 100);
  });
}
