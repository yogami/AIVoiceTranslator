import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import logger from './logger';

// Determine the root directory relative to server/index.ts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..'); // Goes up one level from server/ to project root

// Load appropriate .env file based on NODE_ENV
const envFile = process.env.NODE_ENV === 'test' ? '.env.test' : '.env';
dotenv.config({ path: path.resolve(rootDir, envFile) });
console.log(`🔧 SERVER: Loading environment from ${envFile} (NODE_ENV=${process.env.NODE_ENV})`);

/**
 * Main application entry point
 */

import { validateConfig } from './config'; // Import validateConfig
import { startServer } from './server'; // Ensure this matches your export from server.ts

console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Script starting`);

try {
  // The package.json script 'dev' uses 'dotenv -e .env -- ts-node server/index.ts'
  // This means process.env should be populated by dotenv-cli before this script runs.
  // console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Current environment PORT: ${process.env.PORT}`);

  console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: Calling validateConfig()`);
  validateConfig();
  console.log(`[${new Date().toISOString()}] SERVER_INDEX_TS: validateConfig() completed successfully`);

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
