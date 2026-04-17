import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), "../../.env") });
import express from "express";
import { createServer } from "http";
import { Server as SocketServer } from "socket.io";
import cors from "cors";
import { createAgentRouter } from "./routes.js";
import { SkillRegistry } from "../skills/SkillRegistry.js";
import { logger } from "../utils/logger.js";

const PORT = parseInt(process.env.PORT ?? "3001", 10);

async function bootstrap() {
  const app = express();
  const httpServer = createServer(app);

  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_AGENT_URL
        ? [process.env.NEXT_PUBLIC_AGENT_URL, "http://localhost:3000"]
        : "*",
      methods: ["GET", "POST"],
    },
  });

  app.use(cors());
  app.use(express.json({ limit: "10mb" }));

  // Load skills
  const registry = SkillRegistry.getInstance();
  await registry.loadAll();

  // Routes
  app.use("/api", createAgentRouter(io, registry));

  // Health check
  app.get("/health", (_, res) => {
    res.json({ status: "ok", version: "0.1.0", skills: registry.getAll().length });
  });

  // Socket.io connection logging
  io.on("connection", (socket) => {
    logger.info(`Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
      logger.info(`Client disconnected: ${socket.id}`);
    });

    // Client subscribes to a specific agent session
    socket.on("subscribe", (sessionId: string) => {
      socket.join(`session:${sessionId}`);
      logger.info(`Socket ${socket.id} subscribed to session ${sessionId}`);
    });

    socket.on("unsubscribe", (sessionId: string) => {
      socket.leave(`session:${sessionId}`);
    });
  });

  httpServer.listen(PORT, () => {
    logger.info(`
╔═══════════════════════════════════════════╗
║          SkyWalker Agent Server           ║
║                                           ║
║  HTTP  →  http://localhost:${PORT}           ║
║  WS    →  ws://localhost:${PORT}             ║
║                                           ║
║  LLM: ${(process.env.LLM_PROVIDER ?? "anthropic").padEnd(34)}║
║  Model: ${(process.env.LLM_MODEL ?? "claude-sonnet-4-6").padEnd(33)}║
╚═══════════════════════════════════════════╝
`);
  });
}

bootstrap().catch((err) => {
  logger.error(`Failed to start server: ${String(err)}`);
  process.exit(1);
});
