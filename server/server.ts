/**
 * Server setup functionality extracted for easier testing
 */
// TODO: Temporary fix for TTS service not picking up OPENAI_API_KEY
// Root cause: If this file is run directly (or imported before index.ts), environment variables from .env are not loaded before TTS is initialized.
// This causes TTS to use a placeholder API key, breaking audio on the student page.
// We load dotenv here as a workaround, but this should be investigated further to ensure all entry points load env config before any service initialization.
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import { createServer, Server } from 'http';
// Use WebSocketServer for WebSocket connections
import { WebSocketServer } from './services/WebSocketServer';
import { apiRoutes, apiErrorHandler } from './routes';
import './config';
import path from 'path';
import logger from './logger';

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
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    logger.warn('⚠️ No OPENAI_API_KEY found in environment variables');
    logger.warn('Translation functionality will be limited');
  } else {
    logger.info('OpenAI API key found and client configured.');
  }
  
  // Apply CORS middleware (Open/Closed Principle - extending functionality without modifying existing code)
  configureCorsMiddleware(app);
  
  // Parse JSON in request body
  app.use(express.json());
  
  // Add API routes
  app.use('/api', apiRoutes);
  
  // Add API error handler middleware
  app.use('/api', apiErrorHandler);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Serve static files from client/public directory
  app.use(express.static('client/public'));
  
  // Route for student page - keep for backward compatibility
  app.get('/student', (req, res) => {
    res.sendFile(path.resolve('client/public/student.html'));
  });

  // Route for teacher page - keep for backward compatibility
  app.get('/teacher', (req, res) => {
    res.sendFile(path.resolve('client/public/teacher.html'));
  });
  
  // Route for diagnostics - keep for backward compatibility
  app.get('/diagnostics.html', (req, res) => {
    res.sendFile(path.resolve('client/public/diagnostics.html'));
  });
  
  // Serve index.html for root route
  app.get('/', (req, res) => {
    res.sendFile(path.resolve('client/index.html'));
  });
  
  // Catch-all route for any other routes
  app.get('*', (req, res) => {
    res.sendFile(path.resolve('client/index.html'));
  });
  
  // Start server - use random port for tests to avoid conflicts
  const port = process.env.PORT || (process.env.NODE_ENV === 'test' ? 0 : 5000);
  
  return new Promise((resolve, reject) => {
    const server = httpServer.listen(port, () => {
      const actualPort = (httpServer.address() as any)?.port || port;
      logger.info(`${new Date().toLocaleTimeString()} [express] serving on port ${actualPort}`);
      
      // Initialize WebSocket server
      const wsServer = new WebSocketServer(httpServer);
      
      // Make WebSocketServer globally accessible for diagnostics
      (global as any).wsServer = wsServer;
      
      logger.info('Server started successfully');
      resolve(httpServer);
    });
    
    httpServer.on('error', reject);
  });
}

// Main entry point - start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer(express()).catch(error => logger.error('Failed to start server from main entry point', {error}));
}