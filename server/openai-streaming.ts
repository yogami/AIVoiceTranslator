/**
 * OpenAI Streaming Audio Transcription Service
 * 
 * Provides real-time transcription for audio streams using OpenAI's Whisper model.
 * 
 * This module follows SOLID principles:
 * - Single Responsibility: Each class and function has a specific purpose
 * - Open/Closed: Components can be extended without modification
 * - Liskov Substitution: Interfaces define contracts that implementations must follow
 * - Interface Segregation: Each interface exposes only what clients need
 * - Dependency Inversion: High-level modules depend on abstractions
 */

// Export all functionality from our modular services
export {
  processStreamingAudio,
  finalizeStreamingSession,
  cleanupInactiveStreamingSessions
} from './services/processors/StreamingAudioProcessor';

export { sessionManager } from './services/managers/AudioSessionManager';

// Log API key status (masked for security)
console.log(`OpenAI Streaming - API key status: ${process.env.OPENAI_API_KEY ? 'Present' : 'Missing'}`);