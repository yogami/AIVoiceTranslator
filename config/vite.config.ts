import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const projectRoot = path.resolve(__dirname, '..');

console.log('Alias configuration:', {
  '@config': path.resolve(projectRoot, 'server/config'),
});

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    themePlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "client", "src"),
      "@shared": path.resolve(projectRoot, "shared"),
      "@assets": path.resolve(projectRoot, "attached_assets"),
      "@handlers": path.resolve(projectRoot, "server/services/handlers"),
      "@services": path.resolve(projectRoot, "server/services"),
      "@managers": path.resolve(projectRoot, "server/services/managers"),
      "@helpers": path.resolve(projectRoot, "server/services/helpers"),
      "@config": path.resolve(projectRoot, "config"),
      "@websocket": path.resolve(projectRoot, "server/websocket"),
    },
  },
  root: path.resolve(projectRoot, "client"),
  build: {
    outDir: path.resolve(projectRoot, "dist/public"),
    emptyOutDir: true,
  },
});