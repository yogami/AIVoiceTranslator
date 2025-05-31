/**
 * Server setup functionality extracted for easier testing
 */
import express from 'express';
import { createServer } from 'http';
// ACTIVE WebSocket Implementation - This is what's actually running
import { WebSocketServer } from './services/WebSocketServer';
import { apiRoutes } from './routes';
import './config';
import path from 'path';

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
  
  console.log('CORS middleware configured successfully');
};

/**
 * Start the server
 */
export async function startServer() {
  // console.log('Server CWD:', process.cwd()); // Log CWD
  // Check for OpenAI API key
  if (!process.env.OPENAI_API_KEY) {
    console.warn('⚠️ No OPENAI_API_KEY found in environment variables');
    console.warn('Translation functionality will be limited');
  } else {
    console.log('OpenAI API key status: Present');
    console.log('OpenAI client initialized successfully');
    console.log('OpenAI Streaming - API key status: Present');
    console.log('OpenAI Streaming - client initialized successfully');
  }
  
  // Create Express app
  const app = express();
  
  // Apply CORS middleware (Open/Closed Principle - extending functionality without modifying existing code)
  configureCorsMiddleware(app);
  
  // Parse JSON in request body
  app.use(express.json());
  
  // Add API routes
  app.use('/api', apiRoutes);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // 🔥 ACTIVE WebSocket Implementation - WebSocketServer from services/
  // NOT using the WebSocketService from websocket.ts
  const wss = new WebSocketServer(httpServer);
  console.log('🚀 Server using PRIMARY WebSocketServer implementation');
  
  // Serve static files from client/public directory
  app.use(express.static('client/public'));
  
  // Route for student page
  app.get('/student', (req, res) => {
    // Always serve the student.html file.
    // The client-side JavaScript in student.html will handle
    // the case where req.query.code is missing.
    res.sendFile(path.resolve('client/public/student.html'));
  });

  // Route for teacher page
  app.get('/teacher', (req, res) => {
    res.sendFile(path.resolve('client/public/teacher.html'));
  });
  
  // Serve index.html for root route
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'client' });
  });
  
  // Catch-all route for any other routes
  app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'client' });
  });
  
  // Start server - use random port for tests to avoid conflicts
  const port = process.env.PORT || (process.env.NODE_ENV === 'test' ? 0 : 5000);
  
  return new Promise((resolve, reject) => {
    const server = httpServer.listen(port, () => {
      const actualPort = (httpServer.address() as any)?.port || port;
      console.log(`${new Date().toLocaleTimeString()} [express] serving on port ${actualPort}`);
      resolve({ app, httpServer, wss });
    });
    
    server.on('error', (error) => {
      console.error('Server failed to start:', error);
      reject(error);
    });
  });
}

// Main entry point - start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer().catch(console.error);
}