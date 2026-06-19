import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { registerCsrfRoute } from "./csrf";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV, validateStartupEnvironment } from "./env";
import { serveStatic, setupVite } from "./vite";

function getAllowedCorsOrigins() {
  return [ENV.frontendUrl, ...ENV.corsOrigins.split(",")]
    .map(origin => origin.trim().replace(/\/+$/, ""))
    .filter(Boolean);
}

function isAllowedCorsOrigin(origin: string) {
  const normalizedOrigin = origin.replace(/\/+$/, "");
  const allowedOrigins = getAllowedCorsOrigins();

  if (allowedOrigins.includes(normalizedOrigin)) return true;
  if (!ENV.isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(normalizedOrigin)) {
    return true;
  }

  return false;
}

function registerCors(app: express.Express) {
  app.use((req, res, next) => {
    const origin = req.headers.origin;

    if (origin && isAllowedCorsOrigin(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "content-type, authorization, x-trpc-source, x-csrf-token");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }

    next();
  });
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  validateStartupEnvironment();

  const app = express();
  const server = createServer(app);
  registerCors(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerCsrfRoute(app);
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(error => {
  console.error("[Startup] Server failed to start:", error);
  process.exitCode = 1;
});
