/**
 * Test mock for OpenAI streaming functions
 * This provides mock functions for tests without requiring path alias resolution
 */

// Mock implementation for processStreamingAudio
async function processStreamingAudio(ws, sessionId, audioBase64, isFirstChunk, language) {
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
async function finalizeStreamingSession(ws, sessionId) {
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
function cleanupInactiveStreamingSessions(maxInactivityMs) {
  console.log(`[TEST MOCK] Cleaning up inactive streaming sessions older than ${maxInactivityMs}ms`);
  return 0; // No sessions cleaned up
}

// Mock session manager
const sessionManager = {
  getSessions: () => ({}),
  getSession: (sessionId) => ({ id: sessionId, lastAccess: Date.now() }),
  createSession: (sessionId) => ({ id: sessionId, lastAccess: Date.now() }),
  updateSession: (sessionId, data) => true,
  removeSession: (sessionId) => true,
  cleanupInactiveSessions: (maxInactivityMs) => 0
};

// Export the mock functions
module.exports = {
  processStreamingAudio,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions,
  sessionManager
};