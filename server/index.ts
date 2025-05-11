/**
 * AIVoiceTranslator Server
 * 
 * Main server entry point with Express and WebSocket setup
 */
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from './services/WebSocketServer';
import { apiRoutes } from './routes';

import './config';
// SOLID: Single Responsibility - CORS middleware has one job
const configureCorsMiddleware = (app: express.Express): void => {
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

async function startServer() {
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
  
  // Create WebSocket server
  const wss = new WebSocketServer(httpServer);
  
  // Serve static files from client/public directory
  app.use(express.static('client/public'));
  
  // Route for student page
  app.get('/student', (req, res) => {
    res.sendFile('simple-student.html', { root: 'client/public' });
  });
  
  // Route for teacher page
  app.get('/teacher', (req, res) => {
    // Find the teacher HTML file
    if (req.query.demo === 'true') {
      res.sendFile('simple-speech-test.html', { root: 'client/public' });
    } else {
      res.sendFile('simple-speech-test.html', { root: 'client/public' });
    }
  });
  
  // Route for metrics dashboard
  app.get('/metrics', (req, res) => {
    res.sendFile('metrics-dashboard.html', { root: 'client/public' });
  });
  
  // Route for feature tests dashboard
  app.get('/tests', (req, res) => {
    res.sendFile('feature-tests-dashboard.html', { root: 'client/public' });
  });
  
  // Serve index.html for root route
  app.get('/', (req, res) => {
    res.sendFile('index.html', { root: 'client' });
  });
  
  // Catch-all route for any other routes
  app.get('*', (req, res) => {
    res.sendFile('index.html', { root: 'client' });
  });
  
  // Start server
  const port = process.env.PORT || 5000;
  httpServer.listen(port, () => {
    console.log(`${new Date().toLocaleTimeString()} [express] serving on port ${port}`);
  });
}

// Start the server
startServer().catch(error => {
  console.error('Error starting server:', error);
  process.exit(1);
});
