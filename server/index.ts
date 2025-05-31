/**
 * Main application entry point
 */
// console.log('[server/index.ts] TOP OF FILE REACHED');
// console.log('[server/index.ts] CWD:', process.cwd());
// console.log('[server/index.ts] NODE_ENV:', process.env.NODE_ENV);
// console.log('[server/index.ts] PORT (from env):', process.env.PORT);

import './config'; // Load environment variables first
import { startServer } from './server';

console.log('Loading environment variables from .env file');

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
