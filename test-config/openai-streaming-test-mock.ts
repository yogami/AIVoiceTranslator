/**
 * Test mock for OpenAI streaming functions
 * This provides mock functions for tests without requiring path alias resolution
 * 
 * This file provides mocks for the functions that were originally imported from:
 * '../../../server/openai-streaming'
 */

// Define WebSocket-like type to avoid direct dependency
export interface WebSocketLike {
  send: (data: string) => void;
}

// Define session-related types
export interface AudioSession {
  id: string;
  lastAccess: number;
  audioChunks?: Buffer[];
  language?: string;
  isProcessing?: boolean;
}

export interface SessionManager {
  getSessions: () => Record<string, AudioSession>;
  getSession: (sessionId: string) => AudioSession | null;
  createSession: (sessionId: string) => AudioSession;
  updateSession: (sessionId: string, data: Partial<AudioSession>) => boolean;
  removeSession: (sessionId: string) => boolean;
  cleanupInactiveSessions: (maxInactivityMs: number) => number;
}

// Mock implementation for processStreamingAudio
export async function processStreamingAudio(
  ws: WebSocketLike, 
  sessionId: string, 
  audioBase64: string, 
  isFirstChunk: boolean, 
  language: string
): Promise<boolean> {
  console.log(`[TEST MOCK] Processing streaming audio: sessionId=${sessionId}, isFirstChunk=${isFirstChunk}, language=${language}`);
  
  // Simple mock implementation that sends a transcription message
  if (ws && typeof ws.send === 'function') {
    ws.send(JSON.stringify({
      type: 'transcription',
      sessionId,
      text: 'This is a mock transcription for testing',
      isFinal: false
    }));
  }
  
  return true;
}

// Mock implementation for finalizeStreamingSession
export async function finalizeStreamingSession(
  ws: WebSocketLike, 
  sessionId: string
): Promise<boolean> {
  console.log(`[TEST MOCK] Finalizing streaming session: sessionId=${sessionId}`);
  
  // Simple mock implementation that sends a finalization message
  if (ws && typeof ws.send === 'function') {
    ws.send(JSON.stringify({
      type: 'transcription',
      sessionId,
      text: 'Final mock transcription for testing',
      isFinal: true
    }));
  }
  
  return true;
}

// Mock implementation for cleanupInactiveStreamingSessions
export function cleanupInactiveStreamingSessions(maxInactivityMs: number = 300000): number {
  console.log(`[TEST MOCK] Cleaning up inactive streaming sessions older than ${maxInactivityMs}ms`);
  return 0; // No sessions cleaned up
}

// Mock session manager
export const sessionManager: SessionManager = {
  getSessions: () => ({}),
  getSession: (sessionId: string) => ({ id: sessionId, lastAccess: Date.now() }),
  createSession: (sessionId: string) => ({ id: sessionId, lastAccess: Date.now() }),
  updateSession: (sessionId: string, data: any) => true,
  removeSession: (sessionId: string) => true,
  cleanupInactiveSessions: (maxInactivityMs: number) => 0
};