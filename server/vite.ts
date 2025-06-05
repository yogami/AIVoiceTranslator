import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer } from "vite";
import { type Server } from "http";
import viteConfig from "../config/vite.config";
import { nanoid } from "nanoid";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: ["localhost"],
  };

  const vite = await createServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}

export async function createViteServer(server: Server) {
  const vite = await createServer({
    ...viteConfig,
    server: {
      ...viteConfig.server,
      middlewareMode: true,
      hmr: {
        port: 5173,
      },
    },
    appType: "custom",
  });

  return vite;
}

export async function buildClient() {
  const { build } = await import("vite");
  
  await build({
    ...viteConfig,
    build: {
      ...viteConfig.build,
      // Ensure we're building from the correct root
      rollupOptions: {
        ...viteConfig.build?.rollupOptions,
        input: {
          main: path.resolve(__dirname, "../client/index.html"),
          teacher: path.resolve(__dirname, "../client/public/teacher.html"),
          student: path.resolve(__dirname, "../client/public/student.html"),
          diagnostics: path.resolve(__dirname, "../client/public/diagnostics.html"),
        },
      },
    },
  });
}

// Development server integration
export function setupViteDevServer(app: any, vite: any) {
  // Use vite's connect instance as middleware
  app.use(vite.middlewares);

  // Serve HTML pages with vite's transformations
  app.get("/", async (req: any, res: any, next: any) => {
    try {
      const url = req.originalUrl;
      const template = await vite.transformIndexHtml(
        url,
        `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>AIVoiceTranslator</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
      );
      res.status(200).set({ "Content-Type": "text/html" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
