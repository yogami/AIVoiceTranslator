/**
 * Server setup functionality extracted for easier testing
 */
// TODO: Temporary fix for TTS service not picking up OPENAI_API_KEY
// Environment variables are now loaded by the npm script (dotenv -e .env)
// This ensures proper loading order and avoids conflicts

import express from 'express';
import { createServer, type Server } from 'http';
import path from 'path';
import logger from './logger';
import { config, validateConfig } from './config'; // Assuming config is imported and validated
import { createApiRoutes, apiErrorHandler } from './routes'; // Adjusted import
import { type IStorage } from './storage.interface';
import { DatabaseStorage } from './database-storage';
import { WebSocketServer } from './services/WebSocketServer';
import { SessionCleanupService } from './services/SessionCleanupService';
import fs from 'fs'; // Added fs import
// Ensure setupVite and serveStatic are imported from your vite.ts
import { setupVite, serveStatic } from './vite';

/**
 * Configure CORS middleware
 * SOLID: Single Responsibility - CORS middleware has one job
 */
export const configureCorsMiddleware = (app: express.Express): void => {
  app.use((req, res, next) => {
    // Allow requests from any origin
    res.header('Access-Control-Allow-Origin', '*');
    // Allow these HTTP methods
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    // Allow these headers
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    // Allow credentials
    res.header('Access-Control-Allow-Credentials', 'true');
    
    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
    } else {
      next();
    }
  });
};

/**
 * Start the server
 */
export async function startServer(app: express.Express): Promise<Server> {
  // Add a console log to see all incoming request paths at a high level
  app.use((req, res, next) => {
    logger.info({
        message: `GENERAL LOGGER: Request received`,
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        headers: req.headers,
        query: req.query,
        ip: req.ip
    });
    next();
  });

  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    logger.warn("OpenAI API key not found. TTS and other AI features may not work.");
  } else {
    logger.info("OpenAI API key found and client configured.");
  }
  
  // Apply CORS middleware (Open/Closed Principle - extending functionality without modifying existing code)
  configureCorsMiddleware(app);
  
  // Parse JSON in request body
  app.use(express.json());

  // Dynamically determine Vite dev server port
  let vitePort = process.env.VITE_PORT || '3006'; // Default port as string
  const vitePortFilePath = path.resolve(process.cwd(), '.vite_dev_server_port');
  logger.info(`[INIT] Attempting to read Vite port from: ${vitePortFilePath}`);
  try {
    if (fs.existsSync(vitePortFilePath)) {
      vitePort = fs.readFileSync(vitePortFilePath, 'utf-8').trim();
      logger.info(`[INIT] Using Vite dev server port from .vite_dev_server_port: ${vitePort}`);
    } else {
      logger.warn(`[INIT] .vite_dev_server_port file not found at ${vitePortFilePath}. Using default/env VITE_PORT: ${vitePort}.`);
    }
  } catch (error: any) {
    logger.error(`[INIT] Error reading Vite port file: ${error.message}. Using default/env VITE_PORT: ${vitePort}.`);
  }
  const viteDevServerUrl = `http://localhost:${vitePort}`;
  logger.info(`[INIT] Vite dev server URL configured to: ${viteDevServerUrl}`);


  let storage: IStorage;
  storage = new DatabaseStorage();
  logger.info('[INIT] Using database storage.');

  const httpServer = createServer(app);
  const wss = new WebSocketServer(httpServer, storage);
  
  // Initialize session cleanup service
  const cleanupService = new SessionCleanupService();
  cleanupService.start();
  logger.info('[INIT] Session cleanup service started.');
  
  // Gracefully shutdown cleanup service when server shuts down
  process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully...');
    cleanupService.stop();
  });
  
  process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully...');
    cleanupService.stop();
  });

  const apiRoutes = createApiRoutes(storage, wss, cleanupService);
  app.use('/api', apiRoutes);
  app.use('/api', apiErrorHandler); // Ensure this is after API routes

  // Frontend serving: Vite for dev, static for prod
  if (process.env.NODE_ENV === 'development') {
    logger.info('[INIT] Development mode: Setting up Vite middleware.');
    // setupVite is imported from ./vite
    await setupVite(app); // Removed httpServer argument
  } else if (process.env.NODE_ENV === 'production') {
    logger.info('[INIT] Production mode: Setting up static file serving.');
    // serveStatic is imported from ./vite
    serveStatic(app); // This function should configure serving from your build output (e.g., 'dist')
  } else {
    logger.info('[INIT] Test mode: Setting up static file serving for E2E tests.');
    // Use static file serving for tests to avoid Vite HMR issues
    serveStatic(app);
                     // and handle SPA fallbacks to index.html for client-side routing.
  }
  
  // The specific app.get routes for /teacher, /student, /diagnostics.html
  // are now handled by setupVite in development and potentially by serveStatic's SPA fallback or specific rules in production.
  // So, they should be removed from here to avoid conflict.

  // Global Express Error Handler - Placed at the very end
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Global error handler caught an error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      status: err.status || (res.statusCode >= 400 ? res.statusCode : 500) // Use err.status or derive from res.statusCode
    });
    if (res.headersSent) {
      return next(err);
    }
    const statusCode = err.status || (res.statusCode >= 400 ? res.statusCode : 500) || 500;
    res.status(statusCode).json({
      error: {
        message: err.message || 'Internal Server Error',
        ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }), // Include stack in non-production
      },
    });
  });

  const port = Number(process.env.PORT);
  const host = process.env.HOST;

  if (!port || isNaN(port) || port <= 0) {
    logger.error(`[CRITICAL] Invalid PORT: ${process.env.PORT}. Server cannot start.`);
    process.exit(1);
  }
  if (!host) {
    logger.error(`[CRITICAL] HOST not set. Server cannot start.`);
    process.exit(1);
  }

  return new Promise<Server>((resolve, reject) => {
    httpServer.listen(port, host, () => {
      logger.info(`Server listening on http://${host}:${port}`);
      resolve(httpServer);
    });
    httpServer.on('error', (error: Error) => {
      logger.error('Failed to start server:', error);
      reject(error);
    });
  });
}

// Main entry point - start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const appInstance = express();
  logger.info('[DIRECT_RUN] server.ts is being run directly. Initializing and starting server...');
  // Environment variables should already be loaded by the npm script
  startServer(appInstance).catch(error => {
    logger.error('[DIRECT_RUN] Failed to start server from direct run:', error);
    process.exit(1);
  });
}