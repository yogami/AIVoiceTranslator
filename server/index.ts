// Environment variables are loaded by the npm script (dotenv -e .env)
// Removed dotenv import to prevent conflicts
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import logger from './logger';

// Determine the root directory relative to server/index.ts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);  
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const rootDir = path.resolve(__dirname, '..'); // Goes up one level from server/ to project root

// Environment variables are loaded by the npm script (dotenv -e .env)
// No need to load them again here

/**
 * Main application entry point
 */

import { validateConfig, debugTimingScaling } from './config'; // Import both functions
import { startServer } from './server'; // Ensure this matches your export from server.ts

console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Script starting`);

try {
  // The package.json script 'dev' uses 'dotenv -e .env -- ts-node server/index.ts'
  // This means process.env should be populated by dotenv-cli before this script runs.
  // console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Current environment PORT: ${process.env.PORT}`);

  console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Calling validateConfig()`);
  validateConfig();
  console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: validateConfig() completed successfully`);
  
  // Show timing scaling info in test environment
  debugTimingScaling();

  console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Creating Express app instance`);
  const app = express(); // Create the app instance

  const port = process.env.PORT || '5000'; // Default to 5000 if not set
  console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Determined port: ${port}`);

  console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Calling startServer(app)`);
  startServer(app); // Pass the app instance to startServer. startServer will handle app.listen().

  console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: startServer(app) has been called. Server should be initializing and listening.`);
} catch (error) {
  console.error(`[${new Date().toISOString()}] SERVER_INDEX_TS: CRITICAL ERROR during initialization:`, error);
  // If the error is a string or simple object, it might not have a stack.
  if (error instanceof Error) {
    console.error(`[${new Date().toISOString()}] SERVER_INDEX_TS: Error stack: ${error.stack}`);
  }
  process.exit(1); // Exit if there's an unhandled error during setup
}

// Optional: Keep the process alive for a moment for any async logs, though startServer() should do this.
// setTimeout(() => {
//   console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Process still alive after 5 seconds (if server hasn't fully started).`);
// }, 5000);

export { startServer };
