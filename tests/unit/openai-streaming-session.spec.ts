/**
 * Tests for the Session Management in OpenAI Streaming service
 * 
 * These tests verify the SessionManager class functionality in openai-streaming.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AudioStreamingSessionState } from '../../server/openai-streaming';

// Mock OpenAI and WebSocket
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      audio: {
        transcriptions: {
          create: vi.fn().mockResolvedValue({
            text: 'This is a mock transcription',
          }),
        },
      },
    })),
  };
});

vi.mock('ws', () => {
  return {
    WebSocket: {
      OPEN: 1,
      CONNECTING: 0,
      CLOSING: 2,
      CLOSED: 3
    }
  };
});

// Mock buffer transformations
vi.mock('buffer', () => {
  return {
    Buffer: {
      from: vi.fn((data, encoding) => {
        // Just return a simple buffer for testing
        return { 
          length: 128,
          toString: () => 'mocked-buffer-content'
        };
      }),
      concat: vi.fn((buffers) => {
        return { 
          length: buffers.reduce((acc, buf) => acc + (buf.length || 10), 0),
          toString: () => 'mocked-concatenated-buffer'
        };
      })
    }
  };
});

// Environment variables
vi.stubEnv('OPENAI_API_KEY', 'test-api-key');

describe('OpenAI Streaming Session Management', () => {
  let sessionManager: any;
  
  beforeEach(async () => {
    vi.clearAllMocks();
    vi.resetModules();
    
    // Import the module to get access to SessionManager
    // We need to use any because SessionManager is not exported
    const streamingModule: any = await import('../../server/openai-streaming');
    
    // Access the SessionManager class - this is a bit of a hack, but necessary
    // since the class is not exported
    const privateMembers = Object.getOwnPropertyNames(streamingModule);
    const SessionManagerClass = privateMembers
      .map(name => streamingModule[name])
      .find(member => 
        typeof member === 'function' && 
        /SessionManager/.test(member.toString())
      );
    
    if (!SessionManagerClass) {
      throw new Error('Could not find SessionManager class');
    }
    
    sessionManager = new SessionManagerClass();
  });
  
  it('should create a new session', () => {
    const sessionId = 'test-session-123';
    const language = 'en-US';
    const initialBuffer = { length: 100 } as any;
    
    const session = sessionManager.createSession(sessionId, language, initialBuffer);
    
    expect(session).toBeDefined();
    expect(session.sessionId).toBe(sessionId);
    expect(session.language).toBe(language);
    expect(session.audioBuffer).toEqual([initialBuffer]);
    expect(session.isProcessing).toBe(false);
    expect(session.transcriptionInProgress).toBe(false);
  });
  
  it('should get an existing session', () => {
    const sessionId = 'test-session-456';
    const language = 'fr-FR';
    const initialBuffer = { length: 100 } as any;
    
    // Create session first
    sessionManager.createSession(sessionId, language, initialBuffer);
    
    // Now get it
    const session = sessionManager.getSession(sessionId);
    
    expect(session).toBeDefined();
    expect(session.sessionId).toBe(sessionId);
    expect(session.language).toBe(language);
  });
  
  it('should add audio to an existing session', () => {
    const sessionId = 'test-session-789';
    const language = 'es-ES';
    const initialBuffer = { length: 100 } as any;
    
    // Create session first
    const session = sessionManager.createSession(sessionId, language, initialBuffer);
    
    // Add more audio
    const newBuffer = { length: 200 } as any;
    sessionManager.addAudioToSession(sessionId, newBuffer);
    
    // Verify the audio was added
    expect(session.audioBuffer.length).toBe(2);
    expect(session.audioBuffer[1]).toBe(newBuffer);
    expect(session.lastChunkTime).toBeInstanceOf(Date);
  });
  
  it('should return undefined when getting a non-existent session', () => {
    const session = sessionManager.getSession('non-existent-session');
    expect(session).toBeUndefined();
  });
  
  it('should delete a session', () => {
    const sessionId = 'test-session-to-delete';
    const language = 'de-DE';
    const initialBuffer = { length: 100 } as any;
    
    // Create session
    sessionManager.createSession(sessionId, language, initialBuffer);
    
    // Delete it
    const result = sessionManager.deleteSession(sessionId);
    
    // Verify it's gone
    expect(result).toBe(true);
    expect(sessionManager.getSession(sessionId)).toBeUndefined();
  });
  
  it('should return false when deleting a non-existent session', () => {
    const result = sessionManager.deleteSession('non-existent-session');
    expect(result).toBe(false);
  });
  
  it('should allow accessing all sessions', () => {
    // Clear any existing sessions
    sessionManager.getAllSessions().clear();
    
    // Create some test sessions
    sessionManager.createSession('session-1', 'en-US', { length: 100 } as any);
    sessionManager.createSession('session-2', 'fr-FR', { length: 100 } as any);
    
    // Get all sessions
    const sessions = sessionManager.getAllSessions();
    
    // Verify sessions
    expect(sessions.size).toBe(2);
    expect(sessions.has('session-1')).toBe(true);
    expect(sessions.has('session-2')).toBe(true);
  });
  
  it('should clean up inactive sessions', () => {
    // Clear any existing sessions
    sessionManager.getAllSessions().clear();
    
    // Create test sessions
    const session1 = sessionManager.createSession('session-1', 'en-US', { length: 100 } as any);
    const session2 = sessionManager.createSession('session-2', 'fr-FR', { length: 100 } as any);
    
    // Make one session old
    session1.lastChunkTime = new Date(Date.now() - 3600000); // 1 hour ago
    
    // Clean up with a short timeout
    sessionManager.cleanupInactiveSessions(1000); // 1 second
    
    // Check which sessions remain
    const sessions = sessionManager.getAllSessions();
    expect(sessions.size).toBe(1);
    expect(sessions.has('session-1')).toBe(false);
    expect(sessions.has('session-2')).toBe(true);
  });
});