/**
 * Unit Tests for AudioSessionManager Service
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioSessionManager, AudioStreamingSessionState } from '../../../server/services/AudioSessionManager';

describe('AudioSessionManager', () => {
  let sessionManager: AudioSessionManager;
  let mockBuffer: Buffer;
  
  beforeEach(() => {
    // Create a new session manager for each test
    sessionManager = new AudioSessionManager();
    
    // Create a mock audio buffer
    mockBuffer = Buffer.from([0, 1, 2, 3, 4]);
    
    // Spy on console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });
  
  afterEach(() => {
    vi.restoreAllMocks();
  });
  
  it('should create a new session', () => {
    // Create a session
    const sessionId = 'test-session-1';
    const language = 'en-US';
    
    const session = sessionManager.createSession(sessionId, language, mockBuffer);
    
    // Verify session was created correctly
    expect(session).toBeDefined();
    expect(session.sessionId).toBe(sessionId);
    expect(session.language).toBe(language);
    expect(session.audioBuffer).toHaveLength(1);
    expect(session.audioBuffer[0]).toBe(mockBuffer);
    expect(session.transcriptionText).toBe('');
    expect(session.transcriptionInProgress).toBe(false);
  });
  
  it('should get an existing session', () => {
    // Create a session
    const sessionId = 'test-session-2';
    const language = 'en-US';
    
    sessionManager.createSession(sessionId, language, mockBuffer);
    
    // Get the session
    const session = sessionManager.getSession(sessionId);
    
    // Verify session was retrieved correctly
    expect(session).toBeDefined();
    expect(session?.sessionId).toBe(sessionId);
    expect(session?.language).toBe(language);
  });
  
  it('should return undefined for non-existent session', () => {
    const session = sessionManager.getSession('non-existent-session');
    expect(session).toBeUndefined();
  });
  
  it('should add audio to an existing session', () => {
    // Create a session
    const sessionId = 'test-session-3';
    sessionManager.createSession(sessionId, 'en-US', mockBuffer);
    
    // Create a new buffer to add
    const newBuffer = Buffer.from([5, 6, 7, 8, 9]);
    
    // Add the buffer to the session
    sessionManager.addAudioToSession(sessionId, newBuffer);
    
    // Get the updated session
    const session = sessionManager.getSession(sessionId);
    
    // Verify audio was added
    expect(session?.audioBuffer).toHaveLength(2);
    expect(session?.audioBuffer[0]).toBe(mockBuffer);
    expect(session?.audioBuffer[1]).toBe(newBuffer);
  });
  
  it('should ignore adding audio to a non-existent session', () => {
    // Try to add audio to a non-existent session
    sessionManager.addAudioToSession('non-existent-session', mockBuffer);
    
    // This should not throw an error
    expect(true).toBeTruthy();
  });
  
  it('should update session transcription text', () => {
    // Create a session
    const sessionId = 'test-session-4';
    sessionManager.createSession(sessionId, 'en-US', mockBuffer);
    
    // Update the transcription text
    const transcriptionText = 'This is a test transcription';
    sessionManager.updateSessionTranscription(sessionId, transcriptionText);
    
    // Get the updated session
    const session = sessionManager.getSession(sessionId);
    
    // Verify transcription was updated
    expect(session?.transcriptionText).toBe(transcriptionText);
  });
  
  it('should set transcription in progress state', () => {
    // Create a session
    const sessionId = 'test-session-5';
    sessionManager.createSession(sessionId, 'en-US', mockBuffer);
    
    // Set transcription in progress
    sessionManager.setTranscriptionInProgress(sessionId, true);
    
    // Get the updated session
    const session = sessionManager.getSession(sessionId);
    
    // Verify state was updated
    expect(session?.transcriptionInProgress).toBe(true);
    
    // Set transcription not in progress
    sessionManager.setTranscriptionInProgress(sessionId, false);
    
    // Get the updated session
    const updatedSession = sessionManager.getSession(sessionId);
    
    // Verify state was updated
    expect(updatedSession?.transcriptionInProgress).toBe(false);
  });
  
  it('should clear session audio buffer', () => {
    // Create a session
    const sessionId = 'test-session-6';
    sessionManager.createSession(sessionId, 'en-US', mockBuffer);
    
    // Clear the audio buffer
    sessionManager.clearSessionAudioBuffer(sessionId);
    
    // Get the updated session
    const session = sessionManager.getSession(sessionId);
    
    // Verify buffer was cleared
    expect(session?.audioBuffer).toHaveLength(0);
  });
  
  it('should replace session audio buffer', () => {
    // Create a session
    const sessionId = 'test-session-7';
    sessionManager.createSession(sessionId, 'en-US', mockBuffer);
    
    // Create a new buffer to replace with
    const newBuffer = Buffer.from([5, 6, 7, 8, 9]);
    
    // Replace the audio buffer
    sessionManager.replaceSessionAudioBuffer(sessionId, newBuffer);
    
    // Get the updated session
    const session = sessionManager.getSession(sessionId);
    
    // Verify buffer was replaced
    expect(session?.audioBuffer).toHaveLength(1);
    expect(session?.audioBuffer[0]).toBe(newBuffer);
  });
  
  it('should delete a session', () => {
    // Create a session
    const sessionId = 'test-session-8';
    sessionManager.createSession(sessionId, 'en-US', mockBuffer);
    
    // Delete the session
    const result = sessionManager.deleteSession(sessionId);
    
    // Verify session was deleted
    expect(result).toBe(true);
    expect(sessionManager.getSession(sessionId)).toBeUndefined();
  });
  
  it('should return false when deleting a non-existent session', () => {
    const result = sessionManager.deleteSession('non-existent-session');
    expect(result).toBe(false);
  });
  
  it('should clean up inactive sessions', () => {
    // Mock Date.now to control time
    const nowSpy = vi.spyOn(Date, 'now');
    
    // Set current time
    nowSpy.mockReturnValue(1000);
    
    // Create a session
    const sessionId = 'test-session-9';
    sessionManager.createSession(sessionId, 'en-US', mockBuffer);
    
    // Fast forward time past the max age
    nowSpy.mockReturnValue(70000); // 70 seconds later
    
    // Clean up inactive sessions
    sessionManager.cleanupInactiveSessions(60000); // 60 second max age
    
    // Verify session was cleaned up
    expect(sessionManager.getSession(sessionId)).toBeUndefined();
  });
  
  it('should not clean up active sessions', () => {
    // Mock Date.now to control time
    const nowSpy = vi.spyOn(Date, 'now');
    
    // Set current time
    nowSpy.mockReturnValue(1000);
    
    // Create a session
    const sessionId = 'test-session-10';
    sessionManager.createSession(sessionId, 'en-US', mockBuffer);
    
    // Fast forward time but not past the max age
    nowSpy.mockReturnValue(50000); // 50 seconds later
    
    // Clean up inactive sessions
    sessionManager.cleanupInactiveSessions(60000); // 60 second max age
    
    // Verify session was not cleaned up
    expect(sessionManager.getSession(sessionId)).toBeDefined();
  });
  
  it('should get all sessions', () => {
    // Create multiple sessions
    sessionManager.createSession('test-session-11', 'en-US', mockBuffer);
    sessionManager.createSession('test-session-12', 'fr-FR', mockBuffer);
    
    // Get all sessions
    const sessions = sessionManager.getAllSessions();
    
    // Verify we have both sessions
    expect(sessions.size).toBe(2);
    expect(sessions.has('test-session-11')).toBe(true);
    expect(sessions.has('test-session-12')).toBe(true);
  });
});