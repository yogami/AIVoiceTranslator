import express from 'express';
import { createServer as createViteServer, type ViteDevServer, type UserConfig } from 'vite';
import path from 'path';
import fsPromises from 'fs/promises'; // For async operations in setupVite
import fsSync from 'fs'; // For sync operations like existsSync in serveStatic
import logger from './logger';
import { analyticsPageAuth } from './middleware/analytics-security.js';

let vite: ViteDevServer | null = null;

export async function setupVite(app: express.Express): Promise<void> {
  const viteConfigPath = path.resolve(process.cwd(), 'config', 'vite.config.ts');
  logger.info(`[VITE DEV] Attempting to load Vite config from: ${viteConfigPath}`);

  try {
    const configModule = await import(viteConfigPath /* @vite-ignore */);
    
    let resolvedViteConfig: UserConfig;
    if (typeof configModule.default === 'function') {
      resolvedViteConfig = await configModule.default({ command: 'serve', mode: 'development' });
    } else {
      resolvedViteConfig = configModule.default;
    }

    if (!resolvedViteConfig) {
      throw new Error('Vite config loaded as undefined or null.');
    }
    logger.info(`[VITE DEV] Successfully loaded Vite config. Root: ${resolvedViteConfig.root || path.resolve(process.cwd(), 'client')}, Base: ${resolvedViteConfig.base || '/'}`);
    
    vite = await createViteServer({
      configFile: viteConfigPath,
      server: { 
        middlewareMode: true,
      },
      appType: 'custom',
    });

    logger.info('[VITE DEV] Vite server created successfully.');

    if (vite) {
      app.use(vite.middlewares);
      logger.info('[VITE DEV] Vite asset/HMR middleware configured.');

      const inputs = resolvedViteConfig.build?.rollupOptions?.input;
      // const clientRoot = resolvedViteConfig.root || path.resolve(process.cwd(), 'client'); // Already have filePath

      if (typeof inputs === 'object' && inputs !== null) {
        for (const [name, filePath] of Object.entries(inputs)) {
          if (typeof filePath !== 'string') continue;

          let urlPath: string;
          if (name === 'main') {
            urlPath = '/';
          } else if (filePath.endsWith('.html') && name === path.basename(filePath, '.html')) {
            urlPath = name === 'diagnostics' ? '/diagnostics.html' : `/${name}`;
          } else {
            logger.warn(`[VITE DEV] Skipping HTML route for entry '${name}' due to unclear path mapping from ${filePath}`);
            continue;
          }
          
          if (name === 'main' && urlPath === '/') {
            app.get('/index.html', async (req, res, next) => {
              try {
                const html = await fsPromises.readFile(filePath, 'utf-8');
                const transformedHtml = await vite!.transformIndexHtml(req.originalUrl, html);
                logger.info(`[VITE DEV] Serving transformed /index.html (explicitly) from ${filePath}`);
                res.status(200).set({ 'Content-Type': 'text/html' }).end(transformedHtml);
              } catch (e: any) {
                logger.error(`[VITE DEV] Error transforming HTML for ${req.originalUrl} (explicit /index.html): ${e.message}`);
                return next(e);
              }
            });
          }

          app.get(urlPath, async (req, res, next) => {
            try {
              const html = await fsPromises.readFile(filePath, 'utf-8');
              const transformedHtml = await vite!.transformIndexHtml(req.originalUrl, html);
              logger.info(`[VITE DEV] Serving transformed ${urlPath} from ${filePath} for originalUrl ${req.originalUrl}`);
              res.status(200).set({ 'Content-Type': 'text/html' }).end(transformedHtml);
            } catch (e: any) {
              logger.error(`[VITE DEV] Error transforming HTML for ${req.originalUrl} (path ${urlPath}): ${e.message}`);
              return next(e);
            }
          });
          logger.info(`[VITE DEV] Configured HTML route: ${urlPath} -> ${filePath}`);
        }
      } else {
        logger.warn('[VITE DEV] No HTML entry points found in Vite config (build.rollupOptions.input) to set up routes.');
      }
      logger.info('[VITE DEV] Vite HTML transformation routes configured.');

    } else {
      logger.error('[VITE DEV SETUP] Vite server instance was not created. Middleware not applied.');
      throw new Error('Vite server instance is null after creation attempt.');
    }

  } catch (error: any) {
    logger.error(`[VITE DEV SETUP] Failed to create Vite server or apply middleware: ${error.message}`);
    logger.error(`[VITE DEV SETUP] Error stack: ${error.stack}`);
    app.use((req, res, next) => {
      if (req.path.startsWith('/api/')) return next(); 
      res.status(500).send('Vite server setup failed. Please check server logs for more details.');
    });
  }
}

export function serveStatic(app: express.Express): void {
  const clientDistPath = path.resolve(process.cwd(), 'dist', 'client');
  logger.info(`[PROD STATIC] Configuring static file serving from: ${clientDistPath}`);

  if (!fsSync.existsSync(clientDistPath)) { // Use fsSync for existsSync
    logger.error(`[PROD STATIC] Distribution directory not found: ${clientDistPath}. Static serving will not work.`);
    app.get('*', (req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api/')) {
        logger.warn(`[PROD STATIC] Attempted to serve ${req.path} but dist folder is missing.`);
        res.status(503).send('Static assets are not available. The application may not have been built correctly.');
      } else {
        next();
      }
    });
    return;
  }
  
  // Serve static assets (JS, CSS, images) but not HTML files (index: false)
  app.use(express.static(clientDistPath, { index: false })); 

  // SPA fallback - serve index.html for all routes that don't match static assets
  const indexHtmlPath = path.join(clientDistPath, 'index.html');
  
  if (fsSync.existsSync(indexHtmlPath)) {
    // Special handling for analytics route with auth
    app.get('/analytics', analyticsPageAuth, (req, res) => {
      const analyticsHtmlPath = path.join(clientDistPath, 'analytics.html');
      if (fsSync.existsSync(analyticsHtmlPath)) {
        logger.info(`[PROD STATIC] Serving ${analyticsHtmlPath} for ${req.path} (with auth)`);
        res.sendFile(analyticsHtmlPath);
      } else {
        logger.info(`[PROD STATIC] Serving ${indexHtmlPath} for ${req.path} (analytics fallback with auth)`);
        res.sendFile(indexHtmlPath);
      }
    });

    // Serve specific HTML files for their routes
    const htmlRoutes = {
      '/': 'index.html',
      '/teacher': 'teacher.html',
      '/teacher-login': 'teacher-login.html'
    };

    Object.entries(htmlRoutes).forEach(([route, htmlFile]) => {
      const htmlPath = path.join(clientDistPath, htmlFile);
      if (fsSync.existsSync(htmlPath)) {
        app.get(route, (req, res) => {
          logger.info(`[PROD STATIC] Serving ${htmlPath} for ${req.path}`);
          res.sendFile(htmlPath);
        });
      } else {
        logger.warn(`[PROD STATIC] HTML file not found: ${htmlPath}. Route ${route} will fall back to index.html`);
        app.get(route, (req, res) => {
          logger.info(`[PROD STATIC] Serving ${indexHtmlPath} for ${req.path} (fallback)`);
          res.sendFile(indexHtmlPath);
        });
      }
    });

    // Explicit index.html route
    app.get('/index.html', (req, res) => {
      logger.info(`[PROD STATIC] Serving ${indexHtmlPath} for /index.html (explicit)`);
      res.sendFile(indexHtmlPath);
    });

    // Catch-all fallback for any other routes (SPA fallback)
    app.get('*', (req, res) => {
      // Don't handle API routes or static assets
      if (req.path.startsWith('/api/') || req.path.includes('.')) {
        return; // Let other handlers or 404 handle this
      }
      logger.info(`[PROD STATIC] Serving ${indexHtmlPath} for ${req.path} (SPA fallback)`);
      res.sendFile(indexHtmlPath);
    });
  } else {
    logger.error(`[PROD STATIC] index.html not found at ${indexHtmlPath}. SPA routing will not work.`);
  }
  
  logger.info('[PROD STATIC] Static serving configured for assets and specific HTML files.');
}

export function getViteInstance(): ViteDevServer | null {
  return vite;
}
