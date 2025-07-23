import { defineConfig, loadEnv, type ViteDevServer } from "vite";
import reactPlugin from "@vitejs/plugin-react"; // Renamed to avoid conflict
import path from "path";
import fs from 'fs/promises';
import { existsSync, readFileSync } from 'fs';
import { type AddressInfo } from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const clientRoot = path.resolve(projectRoot, 'client');

// Read backend URLs from environment variables - these are for the config file itself
// if (!process.env.VITE_API_URL) { // These will be loaded by loadEnv later
//   throw new Error(\'VITE_API_URL environment variable must be set.\');
// }
// if (!process.env.VITE_WS_URL) {
//   throw new Error(\'VITE_WS_URL environment variable must be set.\');
// }
// const apiUrl = process.env.VITE_API_URL;
// const wsUrl = process.env.VITE_WS_URL;

console.log('[vite.config.ts] Project Root:', projectRoot);
console.log('[vite.config.ts] Client Root (for Vite root option):', clientRoot);

export default defineConfig(async ({ mode, command }) => {
  // Load env files based on mode (development, production) and .env.local, .env
  // Vite automatically loads .env files. This explicit loadEnv is for use within this config file itself.
  const env = loadEnv(mode, projectRoot, '');
  
  // Check if we're in test mode based on NODE_ENV (not Vite mode)
  const isTestMode = process.env.NODE_ENV === 'test';
  
  // Load .env.test if in test mode
  if (isTestMode) {
    const testEnvPath = path.resolve(projectRoot, '.env.test');
    if (existsSync(testEnvPath)) {
      const testEnvContent = readFileSync(testEnvPath, 'utf-8');
      const testEnvVars = testEnvContent.split('\n').filter(line => line && !line.startsWith('#'));
      testEnvVars.forEach(line => {
        const [key, value] = line.split('=');
        if (key && value) {
          env[key] = value;
        }
      });
    }
  }

  // Ensure critical environment variables are available for the Vite config itself
  // These are used by the `define` block to inject into client-side code.
  // For Railway deployment, provide defaults during build if not set
  const port = env.PORT || process.env.PORT || '5000';
  const host = env.HOST || process.env.HOST || '127.0.0.1';
  
  // Environment-specific API and WebSocket URLs
  const apiUrl = env.VITE_API_URL || process.env.VITE_API_URL || 
    (mode === 'production' ? 'https://placeholder.railway.app' : `http://${host}:${port}`);
  const wsUrl = env.VITE_WS_URL || process.env.VITE_WS_URL || 
    (mode === 'production' ? 'wss://placeholder.railway.app' : `ws://${host}:${port}`);
  
  if (!env.VITE_API_URL && !process.env.VITE_API_URL && mode === 'production') {
    console.warn('[vite.config.ts] WARNING: VITE_API_URL not set, using placeholder. Update after Railway deployment.');
  }
  if (!env.VITE_WS_URL && !process.env.VITE_WS_URL && mode === 'production') {
    console.warn('[vite.config.ts] WARNING: VITE_WS_URL not set, using placeholder. Update after Railway deployment.');
  }

  console.log('[vite.config.ts] Environment: env.NODE_ENV =', env.NODE_ENV);
  console.log('[vite.config.ts] Environment: process.env.NODE_ENV =', process.env.NODE_ENV);
  console.log('[vite.config.ts] Environment: env.PORT =', env.PORT);
  console.log('[vite.config.ts] Environment: process.env.PORT =', process.env.PORT);
  console.log('[vite.config.ts] Mode:', mode, 'Command:', command);
  console.log('[vite.config.ts] Port:', port, 'Host:', host);
  console.log('[vite.config.ts] For define block - VITE_API_URL:', apiUrl);
  console.log('[vite.config.ts] For define block - VITE_WS_URL:', wsUrl);

  // Dynamically import cartographer only if it\'s likely a Replit environment
  let cartographerPlugin = null;
  if (process.env.REPL_ID && process.env.REPL_SLUG) {
    try {
      // Import the plugin directly, as it seems to be a CJS module or has a different export structure
      const cartographer = require("@replit/vite-plugin-cartographer");
      cartographerPlugin = cartographer(); // Call the plugin function
      console.log('[vite.config.ts] Cartographer plugin loaded.');
    } catch (e) {
      console.warn('[vite.config.ts] Failed to load Cartographer plugin, continuing without it:', e);
    }
  }

  return {
    plugins: [
      reactPlugin(), // Use renamed import
      // Conditionally add cartographerPlugin if it was successfully loaded
      ...(cartographerPlugin ? [cartographerPlugin] : []),
      // Custom plugin to write the port to a file (only in dev server mode)
      ...(command === 'serve' ? [{ // Only run this plugin for `vite dev` or `vite serve`
        name: 'write-vite-port',
        configureServer(server: ViteDevServer) {
          server.httpServer?.on('listening', async () => {
            const address = server.httpServer?.address();
            if (address && typeof address === 'object' && (address as AddressInfo).port) {
              const port = (address as AddressInfo).port;
              const portFilePath = path.resolve(projectRoot, '.vite_dev_server_port');
              try {
                await fs.writeFile(portFilePath, port.toString(), 'utf8');
                console.log(`[vite-plugin-write-port] Vite dev server is listening on port ${port}. Port written to ${portFilePath}`);
              } catch (err) {
                console.error(`[vite-plugin-write-port] Error writing port file: ${err}`);
              }
            }
          });
        }
      }] : [])
    ],
    root: clientRoot, // Set client as root
    publicDir: path.resolve(clientRoot, 'public'), // Relative to root
    define: {
      // Change to define global constants, these are injected into client-side code
      'process.env.VITE_API_URL': JSON.stringify(apiUrl),
      'process.env.VITE_WS_URL': JSON.stringify(wsUrl),
      // Keep existing __VITE_... definitions if your client code uses them
      '__VITE_API_URL__': JSON.stringify(apiUrl),
      '__VITE_WS_URL__': JSON.stringify(wsUrl),
    },
    server: {
      // port: 3000, // Vite will try this port first, then increment if busy. Let Vite pick.
      // The middlewareMode: true in server/vite.ts means Vite won't start its own server.
      // The port configuration here is for when Vite runs standalone (e.g. `npm run dev:client` which we are removing)
      // When in middlewareMode, it respects the Express server\'s port.
      fs: {
        allow: [
          // projectRoot, // Allow serving files from the project root (includes client, server, etc.)
          clientRoot, // Specifically allow client directory
          path.resolve(projectRoot, 'node_modules'), // Allow node_modules for dependencies
          // Add other specific paths if needed, but clientRoot should cover most frontend assets.
        ],
      },
      // hmr: { // Optional: configure HMR port if needed, usually not necessary with middlewareMode
      //   port: 24678, // Example custom HMR port
      // },
    },
    build: {
      outDir: path.resolve(projectRoot, 'dist/client'), // Output directory, relative to projectRoot
      emptyOutDir: true, // Clean outDir before build
      rollupOptions: {
        input: {
          main: path.resolve(clientRoot, 'index.html'),
          teacher: path.resolve(clientRoot, 'teacher.html'),
          'teacher-login': path.resolve(clientRoot, 'teacher-login.html'),
          analytics: path.resolve(clientRoot, 'analytics.html'), // Add analytics page
        },
      },
    },
    // Optional: Add resolve.alias if you use them extensively
    resolve: {
      alias: {
        '@': clientRoot, // Example: '@components/MyComponent' -> '/client/components/MyComponent'
        '@shared': path.resolve(projectRoot, 'shared'),
        // '@config': path.resolve(projectRoot, 'server/config'), // This was for server, client shouldn\'t need it
      },
    },
  };
});