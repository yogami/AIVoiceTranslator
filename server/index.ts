/**
 * AIVoiceTranslator Server
 * 
 * Main server entry point with Express and WebSocket setup
 */
import { startServer } from './server';

// Start the server
startServer().catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
