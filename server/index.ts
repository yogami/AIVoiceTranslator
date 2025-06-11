import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import express from 'express';
import logger from './logger';

// Determine the root directory relative to server/index.ts
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..'); // Goes up one level from server/ to project root

// Load .env file from the project root
dotenv.config({ path: path.resolve(rootDir, '.env') });

/**
 * Main application entry point
 */

import './config'; // Now this will mainly import constants like OPENAI_API_KEY and PATHS
import { startServer } from './server';

// Only start server if this file is run directly (not during tests)
if (import.meta.url === `file://${process.argv[1]}`) {
  const app = express();
  startServer(app)
    .then(() => {
      logger.info('Server started successfully');
    })
    .catch((error) => {
      logger.error('Error starting server:', { error });
      process.exit(1);
    });
}

export { startServer };
