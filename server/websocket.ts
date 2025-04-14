import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import { translateSpeech } from './openai';
import { storage } from './storage';

// Map to store active connections by user role and language preference
interface UserConnection {
  ws: WebSocket;
  role: 'teacher' | 'student';
  languageCode: string;
  sessionId: string;
}

export class TranslationWebSocketServer {
  private wss: WebSocketServer;
  private connections: Map<WebSocket, UserConnection> = new Map();
  private sessionCounter: number = 0;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.initialize();
  }

  private initialize() {
    this.wss.on('connection', (ws) => {
      console.log('New WebSocket connection established');
      
      // Initialize connection with default values
      this.connections.set(ws, {
        ws,
        role: 'student', // Default role
        languageCode: 'en-US', // Default language
        sessionId: `session_${Date.now()}_${this.sessionCounter++}`
      });

      // Handle messages from clients
      ws.on('message', async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleMessage(ws, data);
        } catch (error) {
          console.error('Error handling message:', error);
          ws.send(JSON.stringify({ 
            type: 'error', 
            error: 'Invalid message format'
          }));
        }
      });

      // Handle connection close
      ws.on('close', (code, reason) => {
        const connection = this.connections.get(ws);
        console.log(`WebSocket connection closed - Code: ${code}, Reason: ${reason ? reason.toString() : 'No reason provided'}`);
        console.log(`Connection details - Role: ${connection?.role}, Language: ${connection?.languageCode}, Session: ${connection?.sessionId}`);
        this.connections.delete(ws);
        
        // Log current connection stats
        const stats = this.getStats();
        console.log(`Remaining connections: ${stats.totalConnections} (Teachers: ${stats.teacherCount}, Students: ${stats.studentCount})`);
      });

      // Send initial connection confirmation
      ws.send(JSON.stringify({ 
        type: 'connection', 
        status: 'connected',
        sessionId: this.connections.get(ws)?.sessionId 
      }));
    });
  }

  private async handleMessage(ws: WebSocket, data: any) {
    const connection = this.connections.get(ws);
    if (!connection) return;

    const { type, payload } = data;

    switch (type) {
      case 'register':
        // Update connection info
        if (payload.role) connection.role = payload.role;
        if (payload.languageCode) connection.languageCode = payload.languageCode;
        
        ws.send(JSON.stringify({ 
          type: 'register', 
          status: 'success',
          data: { role: connection.role, languageCode: connection.languageCode }
        }));
        break;

      case 'audio':
        // Process audio from teacher and broadcast translations
        if (connection.role === 'teacher' && payload.audio) {
          await this.processAndBroadcastAudio(connection, payload.audio);
        }
        break;

      case 'transcript_request':
        // Send transcript history for the requested language
        if (connection.role === 'student' && payload.sessionId && payload.languageCode) {
          const transcripts = await storage.getTranscriptsBySession(
            payload.sessionId,
            payload.languageCode
          );
          
          ws.send(JSON.stringify({
            type: 'transcript_history',
            data: transcripts
          }));
        }
        break;

      default:
        ws.send(JSON.stringify({ 
          type: 'error', 
          error: 'Unknown message type' 
        }));
    }
  }

  private async processAndBroadcastAudio(teacherConnection: UserConnection, audioBase64: string) {
    try {
      console.log(`Processing audio data (length: ${audioBase64.length}) from teacher...`);
      
      // Convert base64 audio to buffer
      const audioBuffer = Buffer.from(audioBase64, 'base64');
      console.log(`Converted audio data to buffer (size: ${audioBuffer.byteLength})`);
      
      const sourceLanguage = teacherConnection.languageCode;
      const sessionId = teacherConnection.sessionId;
      
      // Get all unique target languages from student connections
      const targetLanguages = new Set<string>();
      for (const conn of this.connections.values()) {
        if (conn.role === 'student' && conn.languageCode !== sourceLanguage) {
          targetLanguages.add(conn.languageCode);
        }
      }

      // Track processing times for latency calculation
      const startTime = Date.now();
      
      // Process translation for each target language
      console.log(`Processing translations for ${targetLanguages.size} target languages: ${Array.from(targetLanguages).join(', ')}`);
      
      if (targetLanguages.size === 0) {
        console.log('No students connected with different languages, processing source language only');
        // Add the source language if there are no students yet
        targetLanguages.add(sourceLanguage);
      }

      // Process each language separately and handle errors independently
      for (const targetLanguage of targetLanguages) {
        console.log(`Translating from ${sourceLanguage} to ${targetLanguage}...`);
        
        try {
          const result = await translateSpeech(audioBuffer, sourceLanguage, targetLanguage);
          console.log(`Translation complete: "${result.originalText}" -> "${result.translatedText}"`);
          
          // Calculate latency
          const latency = Date.now() - startTime;
        
          // Store translation and transcript
          await storage.addTranslation({
            sourceLanguage,
            targetLanguage,
            originalText: result.originalText,
            translatedText: result.translatedText,
            latency
          });
          
          await storage.addTranscript({
            sessionId,
            language: targetLanguage,
            text: result.translatedText
          });
          
          // Broadcast to students who selected this language
          for (const [ws, conn] of this.connections.entries()) {
            if (
              conn.role === 'student' && 
              conn.languageCode === targetLanguage &&
              ws.readyState === WebSocket.OPEN
            ) {
              ws.send(JSON.stringify({
                type: 'translation',
                data: {
                  sessionId,
                  sourceLanguage,
                  targetLanguage,
                  originalText: result.originalText,
                  translatedText: result.translatedText,
                  audio: result.audioBuffer.toString('base64'),
                  timestamp: new Date().toISOString(),
                  latency
                }
              }));
            }
          }
        } catch (error) {
          console.error(`Error processing translation from ${sourceLanguage} to ${targetLanguage}:`, error);
        }
      }
      
      // Also send back confirmation to the teacher
      if (teacherConnection.ws.readyState === WebSocket.OPEN) {
        teacherConnection.ws.send(JSON.stringify({
          type: 'processing_complete',
          data: {
            timestamp: new Date().toISOString(),
            targetLanguages: Array.from(targetLanguages),
            latency: Date.now() - startTime
          }
        }));
      }
    } catch (error) {
      console.error('Error processing audio:', error);
      
      // Notify teacher of error
      if (teacherConnection.ws.readyState === WebSocket.OPEN) {
        teacherConnection.ws.send(JSON.stringify({
          type: 'error',
          error: 'Failed to process audio for translation'
        }));
      }
    }
  }

  // Get statistics about current connections
  public getStats() {
    const teacherCount = Array.from(this.connections.values())
      .filter(conn => conn.role === 'teacher').length;
    
    const studentCount = Array.from(this.connections.values())
      .filter(conn => conn.role === 'student').length;
    
    const languageCounts = Array.from(this.connections.values())
      .reduce((acc, conn) => {
        acc[conn.languageCode] = (acc[conn.languageCode] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    
    return {
      totalConnections: this.connections.size,
      teacherCount,
      studentCount,
      languageCounts
    };
  }
}