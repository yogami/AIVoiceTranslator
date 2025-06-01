/**
 * Main application entry point
 */

import './config'; // Load environment variables first
import { startServer } from './server';

// Only start server if this file is run directly (not during tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer()
    .then(() => {
      console.log('Server started successfully');
    })
    .catch((error) => {
      console.error('Error starting server:', error);
      process.exit(1);
    });
}

export { startServer };
