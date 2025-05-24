/**
 * Audio Session Manager Service
 * 
 * Responsible for maintaining the state of audio streaming sessions.
 */

// Configuration constants
const CONFIG = {
  SESSION_MAX_AGE_MS: 60000,     // How long a session can be inactive before cleanup
  LOG_PREFIX: '[AudioSessionManager]' // Prefix for all logs from this module
};

/**
 * Represents the state of an audio streaming session
 */
export interface AudioStreamingSessionState {
  sessionId: string;
  language: string;
  isProcessing: boolean;
  audioBuffer: Buffer[];
  lastChunkTime: number;
  transcriptionText: string;
  transcriptionInProgress: boolean;
}

/**
 * Session Manager - responsible for maintaining session state
 * Follows the repository pattern for data access
 */
export class AudioSessionManager {
  private sessions = new Map<string, AudioStreamingSessionState>();
  
  /**
   * Create a new streaming session
   */
  createSession(sessionId: string, language: string, initialBuffer: Buffer): AudioStreamingSessionState {
    const session: AudioStreamingSessionState = {
      sessionId,
      language,
      isProcessing: false,
      audioBuffer: [initialBuffer],
      lastChunkTime: Date.now(),
      transcriptionText: '',
      transcriptionInProgress: false
    };
    
    this.sessions.set(sessionId, session);
    console.log(`${CONFIG.LOG_PREFIX} Created new session: ${sessionId}, language: ${language}`);
    return session;
  }
  
  /**
   * Get an existing session
   */
  getSession(sessionId: string): AudioStreamingSessionState | undefined {
    return this.sessions.get(sessionId);
  }
  
  /**
   * Add audio data to an existing session
   */
  addAudioToSession(sessionId: string, audioBuffer: Buffer): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.audioBuffer.push(audioBuffer);
      session.lastChunkTime = Date.now();
    }
  }
  
  /**
   * Update session transcription text
   */
  updateSessionTranscription(sessionId: string, text: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.transcriptionText = text;
    }
  }
  
  /**
   * Set the session's transcription in progress state
   */
  setTranscriptionInProgress(sessionId: string, inProgress: boolean): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.transcriptionInProgress = inProgress;
    }
  }
  
  /**
   * Clear the audio buffer for a session
   */
  clearSessionAudioBuffer(sessionId: string): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.audioBuffer = [];
    }
  }
  
  /**
   * Replace a session's audio buffer
   */
  replaceSessionAudioBuffer(sessionId: string, buffer: Buffer): void {
    const session = this.getSession(sessionId);
    if (session) {
      session.audioBuffer = [buffer];
    }
  }
  
  /**
   * Delete a session
   */
  deleteSession(sessionId: string): boolean {
    const result = this.sessions.delete(sessionId);
    if (result) {
      console.log(`${CONFIG.LOG_PREFIX} Deleted session: ${sessionId}`);
    }
    return result;
  }
  
  /**
   * Clean up inactive sessions
   */
  cleanupInactiveSessions(maxAgeMs: number = CONFIG.SESSION_MAX_AGE_MS): void {
    const now = Date.now();
    
    // Convert entries to array first (avoids downlevelIteration issues)
    for (const [sessionId, session] of Array.from(this.sessions.entries())) {
      const sessionAge = now - session.lastChunkTime;
      
      if (sessionAge > maxAgeMs) {
        console.log(`${CONFIG.LOG_PREFIX} Cleaning up inactive session: ${sessionId}, age: ${sessionAge}ms`);
        this.sessions.delete(sessionId);
      }
    }
  }
  
  /**
   * Get all sessions
   */
  getAllSessions(): Map<string, AudioStreamingSessionState> {
    return this.sessions;
  }
}

// Create a singleton instance
export const sessionManager = new AudioSessionManager();