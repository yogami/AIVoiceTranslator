/**
 * Translation Flow Integration Tests
 * 
 * Consolidated from:
 * - message-handling-integration.test.ts (translation parts)
 * - teacher-student-flow.test.ts
 * - multi-language-classroom.test.ts (translation parts)
 * 
 * Tests end-to-end translation workflows
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import WebSocket from 'ws';
import { createServer, Server } from 'http';
import express from 'express';
import { WebSocketServer as WSServer } from 'ws';
import { WebSocketServer } from '../../server/services/WebSocketServer';

// Test configuration constants
const TEST_PORT = 0; // Use 0 to let the system assign an available port
let actualPort: number; // Store the actual assigned port

describe('Translation Flow Integration', () => {
  let httpServer: Server;
  let wsServer: WebSocketServer;
  let teacherClient: WebSocket;
  let studentClient: WebSocket;
  
  beforeAll(async () => {
    // Create HTTP server
    httpServer = createServer();
    
    // Initialize WebSocket server with the HTTP server
    wsServer = new WebSocketServer(httpServer);
    
    // Start HTTP server
    await new Promise<void>((resolve) => {
      httpServer.listen(TEST_PORT, () => {
        actualPort = (httpServer.address() as any)?.port || 5000;
        console.log(`Test server started on port ${actualPort}`);
        resolve();
      });
    });
  });
  
  afterAll(async () => {
    // Close WebSocket server
    wsServer.close();
    
    // Close HTTP server
    await new Promise<void>((resolve, reject) => {
      httpServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }, 30000); // Increase timeout to 30 seconds
  
  describe('Teacher to Student Translation', () => {
    it('should handle complete translation flow from teacher to student', async () => {
      const teacherMessages: any[] = [];
      const studentMessages: any[] = [];
      
      // Create teacher connection
      teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      teacherClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        teacherMessages.push(message);
        console.log('Teacher received:', message.type);
      });
      
      // Wait for teacher connection
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
      
      // Wait for registration confirmation
      await waitForMessage(teacherMessages, 'register');
      
      // Create student connection
      studentClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      studentClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        studentMessages.push(message);
        console.log('Student received:', message.type);
      });
      
      // Wait for student connection
      await new Promise<void>((resolve) => {
        studentClient.on('open', resolve);
      });
      
      // Wait for student connection confirmation
      await waitForMessage(studentMessages, 'connection');
      
      // Register student
      studentClient.send(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }));
      
      // Wait for student registration confirmation
      await waitForMessage(studentMessages, 'register');
      
      // Clear messages before sending transcription
      studentMessages.length = 0;
      
      // Teacher sends transcription
      teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Hello students, today we will learn about testing.'
      }));
      
      // Wait for translation with increased timeout
      await waitForMessage(studentMessages, 'translation', 10000);
      
      const translation = studentMessages.find(m => m.type === 'translation');
      expect(translation).toBeDefined();
      expect(translation.originalText).toBe('Hello students, today we will learn about testing.');
      expect(translation.targetLanguage).toBe('es-ES');
      expect(translation.text).toBeDefined();
      // Only assert non-empty translation if a real OpenAI API key is present
      const apiKey = process.env.OPENAI_API_KEY;
      if (apiKey && !apiKey.startsWith('test-') && !apiKey.startsWith('sk-place') && apiKey !== '') {
        expect(translation.text).not.toBe(''); // Should have translated text
      } else {
        // If no real key, allow empty translation and log a warning
        if (!translation.text) {
          console.warn('Translation text is empty (expected with missing/invalid OpenAI API key)');
        }
      }
      
      // Clean up
      teacherClient.close();
      studentClient.close();
    });
    
    it('should handle translations to multiple students in different languages', async () => {
      const teacherMessages: any[] = [];
      const spanishMessages: any[] = [];
      const frenchMessages: any[] = [];
      const germanMessages: any[] = [];
      
      // Create teacher connection
      teacherClient = new WebSocket(`ws://localhost:${actualPort}`);
      
      teacherClient.on('message', (data) => {
        const message = JSON.parse(data.toString());
        teacherMessages.push(message);
      });
      
      await new Promise<void>((resolve) => {
        teacherClient.on('open', resolve);
      });
      
      // Wait for connection and register teacher
      await waitForMessage(teacherMessages, 'connection');
      
      teacherClient.send(JSON.stringify({
        type: 'register',
        role: 'teacher',
        languageCode: 'en-US'
      }));
      
      await waitForMessage(teacherMessages, 'register');
      
      // Create multiple student connections
      const spanishStudent = new WebSocket(`ws://localhost:${actualPort}`);
      const frenchStudent = new WebSocket(`ws://localhost:${actualPort}`);
      const germanStudent = new WebSocket(`ws://localhost:${actualPort}`);
      
      // Set up message handlers
      spanishStudent.on('message', (data) => {
        const message = JSON.parse(data.toString());
        spanishMessages.push(message);
        console.log('Spanish student received:', message.type);
      });
      
      frenchStudent.on('message', (data) => {
        const message = JSON.parse(data.toString());
        frenchMessages.push(message);
        console.log('French student received:', message.type);
      });
      
      germanStudent.on('message', (data) => {
        const message = JSON.parse(data.toString());
        germanMessages.push(message);
        console.log('German student received:', message.type);
      });
      
      // Wait for all connections
      await Promise.all([
        new Promise<void>((resolve) => spanishStudent.on('open', resolve)),
        new Promise<void>((resolve) => frenchStudent.on('open', resolve)),
        new Promise<void>((resolve) => germanStudent.on('open', resolve))
      ]);
      
      // Wait for connection confirmations
      await Promise.all([
        waitForMessage(spanishMessages, 'connection'),
        waitForMessage(frenchMessages, 'connection'),
        waitForMessage(germanMessages, 'connection')
      ]);
      
      // Register all students
      spanishStudent.send(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'es-ES'
      }));
      
      frenchStudent.send(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'fr-FR'
      }));
      
      germanStudent.send(JSON.stringify({
        type: 'register',
        role: 'student',
        languageCode: 'de-DE'
      }));
      
      // Wait for registration confirmations
      await Promise.all([
        waitForMessage(spanishMessages, 'register'),
        waitForMessage(frenchMessages, 'register'),
        waitForMessage(germanMessages, 'register')
      ]);
      
      // Clear message arrays before transcription
      spanishMessages.length = 0;
      frenchMessages.length = 0;
      germanMessages.length = 0;
      
      // Teacher sends transcription
      teacherClient.send(JSON.stringify({
        type: 'transcription',
        text: 'Welcome to our international classroom!'
      }));
      
      // Wait for all translations with increased timeout
      await Promise.all([
        waitForMessage(spanishMessages, 'translation', 10000),
        waitForMessage(frenchMessages, 'translation', 10000),
        waitForMessage(germanMessages, 'translation', 10000)
      ]);
      
      // Verify translations
      const spanishTranslation = spanishMessages.find(m => m.type === 'translation');
      const frenchTranslation = frenchMessages.find(m => m.type === 'translation');
      const germanTranslation = germanMessages.find(m => m.type === 'translation');
      
      expect(spanishTranslation?.targetLanguage).toBe('es-ES');
      expect(frenchTranslation?.targetLanguage).toBe('fr-FR');
      expect(germanTranslation?.targetLanguage).toBe('de-DE');
      
      // All should have the same original text
      expect(spanishTranslation?.originalText).toBe('Welcome to our international classroom!');
      expect(frenchTranslation?.originalText).toBe('Welcome to our international classroom!');
      expect(germanTranslation?.originalText).toBe('Welcome to our international classroom!');
      
      // Each should have translated text
      expect(spanishTranslation?.text).toBeDefined();
      expect(frenchTranslation?.text).toBeDefined();
      expect(germanTranslation?.text).toBeDefined();
      
      // Clean up
      teacherClient.close();
      spanishStudent.close();
      frenchStudent.close();
      germanStudent.close();
    }, 15000); // Increased timeout for this specific test to 15 seconds
  });
  
  describe('Error Handling', () => {
    it('should handle invalid message types gracefully', async () => {
      // Create WebSocket connection using the actual port
      const ws = new WebSocket(`ws://localhost:${actualPort}`);
      
      await new Promise<void>((resolve, reject) => {
        ws.on('open', resolve);
        ws.on('error', reject);
      });

      // Send invalid message
      ws.send(JSON.stringify({
        type: 'invalidMessageType',
        data: 'test'
      }));

      // Send invalid JSON
      ws.send('invalid json data');

      await new Promise(resolve => setTimeout(resolve, 1000));

      // Connection should still be open
      expect(ws.readyState).toBe(WebSocket.OPEN);
      
      ws.close();
    });
  });
});

// Update the waitForMessage function to be more robust
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
