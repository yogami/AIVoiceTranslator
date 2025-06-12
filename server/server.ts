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
import { WebSocketServer } from './services/WebSocketServer';
import { apiRoutes, apiErrorHandler } from './routes';
import './config'; // Ensures config is loaded
import path from 'path';
import fs from 'fs';
import logger from './logger';
import { createProxyMiddleware, Options as ProxyOptions } from 'http-proxy-middleware';

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
    logger.warn('⚠️ No OPENAI_API_KEY found in environment variables');
    logger.warn('Translation functionality will be limited');
  } else {
    logger.info('OpenAI API key found and client configured.');
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
      const portFromFileStr = fs.readFileSync(vitePortFilePath, 'utf8').trim();
      const portFromFile = parseInt(portFromFileStr, 10);
      if (!isNaN(portFromFile) && portFromFile > 0) {
        vitePort = portFromFile.toString();
        logger.info(`[INIT] Using Vite dev server port from .vite_dev_server_port: ${vitePort}`);
      } else {
        logger.warn(`[INIT] Invalid port number ('${portFromFileStr}') found in .vite_dev_server_port. Using default Vite port: ${vitePort}`);
      }
    } else {
      logger.info(`[INIT] .vite_dev_server_port not found. Using default Vite port: ${vitePort}. Ensure Vite dev server is running and has created this file.`);
    }
  } catch (error: any) { // Catching as any to access error.message
    logger.error(`[INIT] Error reading .vite_dev_server_port: ${error.message}. Proceeding with default Vite port: ${vitePort}`, { error });
  }

  const viteDevServerUrl = `http://localhost:${vitePort}`;
  logger.info(`[INIT] Vite dev server URL configured to: ${viteDevServerUrl}`);

  const proxyLifecycleEvents = {
    onProxyReq: (proxyReq: any, req: any, res: any) => { // req is http.IncomingMessage
        // Extended logging for onProxyReq
        const targetHostHeader = proxyReq.getHeader('host'); // Get the host header HPM is about to send
        const actualTargetHost = proxyReq.host; // Hostname of the request
        const actualTargetPort = proxyReq.port; // Port of the request
        const targetPath = proxyReq.path; // The path HPM is about to request

        logger.info(`[HPM] onProxyReq: ${req.method} ${req.url} -> ${proxyReq.protocol}//${targetHostHeader}${targetPath}`, {
            hpm_target_details: {
                proxyReq_socket_remoteAddress: proxyReq.socket?.remoteAddress,
                proxyReq_socket_remotePort: proxyReq.socket?.remotePort,
                proxyReq_host_property: actualTargetHost, // This is the 'host' property of the ClientRequest object itself
                proxyReq_port_property: actualTargetPort, // This is the 'port' property of the ClientRequest object
                proxyReq_path_property: targetPath,
                proxyReq_explicit_target_host_header: targetHostHeader,
            },
            viteDevServerUrl_in_scope: viteDevServerUrl // Confirm the variable is correct in this scope
        });
    },
    onProxyRes: (proxyRes: any, req: any, res: any) => { // req is http.IncomingMessage
        logger.info(`[HPM] onProxyRes: ${req.method} ${req.url} <- ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
    },
    onError: (err: Error, req: any, res: any, target?: any) => { // req is http.IncomingMessage
        logger.error(`[HPM] onError for ${req.method} ${req.url}:`, {
            errorMessage: err.message,
            errorStack: err.stack,
            target: target ? (typeof target.href === 'string' ? target.href : JSON.stringify(target)) : 'N/A',
        });
        if (res && typeof res.writeHead === 'function' && !res.headersSent) {
            res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('Proxy error occurred. Check server logs.');
        } else if (res && res.headersSent) {
            logger.warn('[HPM] onError: Headers already sent, cannot send 502 error response.');
        } else {
            logger.error('[HPM] onError: Response object is not valid or headers already sent, cannot send 502.');
        }
    }
  };

  logger.info('[PROXY_SETUP] Configuring HPM instances...');

  // Proxy for Vite HMR client and other Vite-specific internals
  // These typically don't need path rewriting if Vite serves them from its root.
  const viteInternalProxyOptions: ProxyOptions = {
    target: viteDevServerUrl,
    changeOrigin: true,
    ws: true, // Enable WebSocket proxying for HMR
    ...proxyLifecycleEvents
  };
  app.use('/@vite', createProxyMiddleware(viteInternalProxyOptions));
  app.use('/node_modules/.vite', createProxyMiddleware(viteInternalProxyOptions));

  // Common proxy options for assets, with path rewriting
  const createAssetProxy = (mountPath: string): express.Handler => {
    logger.info(`[PROXY_SETUP] Creating proxy for mount path: ${mountPath} targeting ${viteDevServerUrl}`);
    const instance = createProxyMiddleware({
      target: viteDevServerUrl,
      changeOrigin: true,
      // No pathRewrite needed; HPM will use the request path relative to the target.
      // For example, a request to Express at /css/style.css, when proxied,
      // will be sent to Vite as http://localhost:VITE_PORT/css/style.css.
      ...proxyLifecycleEvents
    });
    return (req, res, next) => {
        // req here is express.Request, so req.originalUrl, req.baseUrl, req.path are available
        logger.info(`[EXPRESS_ROUTE_MATCH] Proxy for ${mountPath} triggered by: ${req.method} ${req.originalUrl} (req.path: ${req.path}, req.baseUrl: ${req.baseUrl})`);
        instance(req, res, next);
    };
  };

  app.use('/src', createAssetProxy('/src'));
  app.use('/css', createAssetProxy('/css')); // Corrected typo: createAsset_proxy -> createAssetProxy
  app.use('/js', createAssetProxy('/js'));

  logger.info('[PROXY_SETUP] All HPM instances configured.');
  
  // Add API routes (after proxying Vite assets)
  app.use('/api', apiRoutes);
  
  // Add API error handler middleware
  app.use('/api', apiErrorHandler);
  
  // Serve static files from client/public directory
  // This is for assets that are not processed by Vite (e.g., images, fonts directly in public)
  // TEMPORARILY COMMENTED OUT FOR DEBUGGING
  // app.use(express.static('client/public'));
  // logger.info(`[STATIC] Serving static files from: ${path.resolve(__dirname, '../../client/public')}`);


  app.get('/student', (req, res) => {
    const studentHtmlPath = path.resolve(process.cwd(), 'client/public/student.html'); // Use process.cwd()
    logger.info(`[ROUTE /student] Serving ${studentHtmlPath}`);
    res.sendFile(studentHtmlPath, (err) => { 
        if (err) {
            logger.error(`[ROUTE /student] Error sending student.html from ${studentHtmlPath}:`, {
              message: (err as any).message,
              stack: (err as any).stack,
            });
            if (!res.headersSent) {
              res.status(500).send('Server error trying to send student.html');
            }
        }
    });
  });

  app.get('/teacher', (req, res) => {
    logger.info(`Serving teacher.html for request: ${req.path}`);
    // Reverted path to client/teacher.html
    res.sendFile(path.join(process.cwd(), 'client', 'teacher.html'));
  });

  app.get('/diagnostics.html', (req, res) => {
    const diagnosticsHtmlPath = path.resolve(process.cwd(), 'client/public/diagnostics.html'); // Use process.cwd()
    logger.info(`[ROUTE /diagnostics.html] Serving ${diagnosticsHtmlPath}`);
    res.sendFile(diagnosticsHtmlPath, (err) => { 
        if (err) {
            logger.error(`[ROUTE /diagnostics.html] Error sending diagnostics.html from ${diagnosticsHtmlPath}:`, {
              message: (err as any).message,
              stack: (err as any).stack,
            });
            if (!res.headersSent) {
              res.status(500).send('Server error trying to send diagnostics.html');
            }
        }
    });
  });
  
  // TEMPORARILY COMMENTED OUT FOR DEBUGGING
  // app.use(express.static(path.resolve(process.cwd(), 'client/public'))); // Use process.cwd()
  // logger.info(`[STATIC] Serving static files from: ${path.resolve(process.cwd(), 'client/public')}`);


  // TEMPORARILY COMMENTED OUT FOR DEBUGGING
  // app.get('/', (req, res) => {
  //   logger.info(`[ROUTE /] Serving index.html (commented out target)`);
  //   // res.sendFile(path.resolve(process.cwd(), 'client/index.html')); // Use process.cwd()
  //   res.status(404).send('Root path not configured for serving file in this debug state.');
  // });
  
  // TEMPORARILY COMMENTED OUT FOR DEBUGGING
  // app.get('*', (req, res) => {
  //   logger.info(`[ROUTE *] Catch-all for ${req.path} (commented out target)`);
  //   // res.sendFile(path.resolve(process.cwd(), 'client/index.html')); // Use process.cwd()
  //    res.status(404).send(`Resource not found: ${req.path}`);
  // });
  
  // Global Express Error Handler - Placed at the very end of middleware/route chain
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('GLOBAL EXPRESS ERROR HANDLER caught an error:', {
      message: err.message,
      stack: err.stack,
      path: req.path,
      method: req.method,
      errorObject: err // Log the full error object for more details
    });
    if (!res.headersSent) {
      res.status(err.status || 500).send(err.message || 'Something broke on the server!');
    } else {
      next(err);
    }
  });

  // Start server - require PORT and HOST to be set
  const port = Number(process.env.PORT);
  const host = process.env.HOST;
  
  if (!port || isNaN(port) || port <= 0) {
      const portErrorMsg = `CRITICAL: PORT environment variable ('${process.env.PORT}') is not set or is not a valid positive number.`;
      logger.error(portErrorMsg);
      // process.exit(1); // Avoid process.exit in a library-like function
      return Promise.reject(new Error(portErrorMsg));
  }
  if (!host) {
      const hostErrorMsg = `CRITICAL: HOST environment variable ('${process.env.HOST}') is not set.`;
      logger.error(hostErrorMsg);
      // process.exit(1);
      return Promise.reject(new Error(hostErrorMsg));
  }

  const httpServer = createServer(app);
  const wsServer = new WebSocketServer(httpServer);
  
  return new Promise<Server>((resolve, reject) => {
    httpServer.listen(port, host, () => {
      // ... (existing listening log) ...
      const addressInfo = httpServer.address();
      let addressString = 'unknown address';
      if (addressInfo && typeof addressInfo !== 'string') {
        addressString = `http://${host}:${addressInfo.port}`;
      } else if (typeof addressInfo === 'string') {
        addressString = addressInfo;
      }
      logger.info(`Server listening on ${addressString}`);
      resolve(httpServer);
    });

    httpServer.on('error', (err) => {
      logger.error('Server failed to start or encountered an error:', { err });
      reject(err);
    });
  });
}

// Main entry point - start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const appInstance = express();
  logger.info('[DIRECT_RUN] server.ts is being run directly. Initializing and starting server...');
  // Ensure dotenv is configured if run directly, especially if services initialize on import
  dotenv.config(); 
  startServer(appInstance).catch(error => {
    logger.error('[DIRECT_RUN] Failed to start server from main entry point:', {error});
    process.exit(1); 
  });
}