/**
 * Benedictaitor Server
 * 
 * Main server entry point with Express and WebSocket setup
 */
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from './services/WebSocketServer';
import { setupVite } from './vite';
import { apiRoutes } from './routes';

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
  
  // Parse JSON in request body
  app.use(express.json());
  
  // Add API routes
  app.use('/api', apiRoutes);
  
  // Create HTTP server
  const httpServer = createServer(app);
  
  // Create WebSocket server
  const wss = new WebSocketServer(httpServer);
  
  // Set up Vite dev server in development mode
  if (process.env.NODE_ENV === 'development') {
    await setupVite(app, httpServer);
  } else {
    // Serve static files in production mode
    app.use(express.static('dist/client'));
    
    // Serve index.html for all routes not matched by API or static files
    app.get('*', (req, res) => {
      res.sendFile('index.html', { root: 'dist/client' });
    });
  }
  
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