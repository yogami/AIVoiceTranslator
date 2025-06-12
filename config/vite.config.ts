import { defineConfig, loadEnv, ViteDevServer } from "vite";
import type { Connect } from 'vite'; // Or import from 'connect' if installed
import { IncomingMessage, ServerResponse } from 'http';
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import fs from 'fs/promises';
import { AddressInfo } from 'net'; // Import AddressInfo

const projectRoot = path.resolve(__dirname, '..');

// Read backend URLs from environment variables
if (!process.env.VITE_API_URL) {
  throw new Error('VITE_API_URL environment variable must be set.');
}
if (!process.env.VITE_WS_URL) {
  throw new Error('VITE_WS_URL environment variable must be set.');
}
const apiUrl = process.env.VITE_API_URL;
const wsUrl = process.env.VITE_WS_URL;

console.log('Alias configuration:', {
  '@config': path.resolve(projectRoot, 'server/config'),
});

export default defineConfig(async ({ mode }) => { // Make the function async
  // Load env files based on mode (development, production) and .env.local, .env
  // Vite automatically loads .env files. This explicit loadEnv is for use within this config file itself.
  const env = loadEnv(mode, projectRoot, ''); // Load from project root

  // Ensure critical environment variables are available for the Vite config itself
  if (!env.VITE_API_URL) {
    throw new Error('VITE_API_URL environment variable must be set for define block.');
  }
  if (!env.VITE_WS_URL) {
    throw new Error('VITE_WS_URL environment variable must be set for define block.');
  }

  console.log('[vite.config.ts] For define block - VITE_API_URL:', env.VITE_API_URL);
  console.log('[vite.config.ts] For define block - VITE_WS_URL:', env.VITE_WS_URL);

  // Dynamically import cartographer only if it's likely a Replit environment
  let cartographerPlugin = null;
  if (process.env.REPL_ID && process.env.REPL_SLUG) {
    try {
      // Import the plugin directly, as it seems to be a CJS module or has a different export structure
      const cartographer = require("@replit/vite-plugin-cartographer");
      cartographerPlugin = cartographer(); // Call the plugin function
      console.log('[vite.config.js] Cartographer plugin loaded.');
    } catch (e) {
      console.warn('[vite.config.js] Failed to load Cartographer plugin, continuing without it:', e);
    }
  }

  return {
    plugins: [
      react(),
      ...(process.env.REPL_ID ? [
        runtimeErrorOverlay(),
        themePlugin(),
      ] : []),
      // Conditionally add cartographerPlugin if it was successfully loaded
      ...(cartographerPlugin ? [cartographerPlugin] : []),
      // Custom plugin to write the port to a file
      {
        name: 'write-vite-port',
        configureServer(server: ViteDevServer) {
          server.httpServer?.on('listening', async () => {
            const address = server.httpServer?.address();
            if (address && typeof address === 'object' && (address as AddressInfo).port) {
              const port = (address as AddressInfo).port;
              const portFilePath = path.resolve(projectRoot, '.vite_dev_server_port');
              try {
                await fs.writeFile(portFilePath, port.toString());
                console.log(`[vite-plugin-write-port] Vite server is listening on port ${port}. Port written to ${portFilePath}`);
              } catch (err) {
                console.error(`[vite-plugin-write-port] Error writing port file: ${err}`);
              }
            }
          });
        }
      }
    ],
    root: path.resolve(projectRoot, 'client'), // Set client as root
    publicDir: path.resolve(projectRoot, 'client/public'),
    define: {
      // Change to define global constants
      '__VITE_API_URL__': JSON.stringify(env.VITE_API_URL),
      '__VITE_WS_URL__': JSON.stringify(env.VITE_WS_URL),
    },
    server: {
      port: 3000, // Vite will try this port first, then increment if busy.
      fs: {
        allow: [
          path.resolve(projectRoot, 'client/src'),
          path.resolve(projectRoot, 'client/public'),
          projectRoot, // project root
        ],
      },
      proxy: {
        '/api': {
          target: apiUrl,
          changeOrigin: true
        },
        '/ws': {
          target: wsUrl,
          ws: true
        }
      }
    },
    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "client", "src"),
        "@shared": path.resolve(projectRoot, "shared"),
        "@assets": path.resolve(projectRoot, "attached_assets"),
        "@handlers": path.resolve(projectRoot, "server/services/handlers"),
        "@services": path.resolve(projectRoot, "server/services"),
        "@managers": path.resolve(projectRoot, "server/services/managers"),
        "@helpers": path.resolve(projectRoot, "server/services/helpers"),
        "@config": path.resolve(projectRoot, "config"), // This was server/config, changed to config
        "@websocket": path.resolve(projectRoot, "server/websocket"),
      },
    },
  };
});