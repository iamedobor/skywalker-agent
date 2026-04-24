import { Router, type Request, type Response } from "express";
import type { Server as SocketServer } from "socket.io";
import { Agent } from "../agent/Agent.js";
import { createLLMProvider } from "../llm/index.js";
import type { SkillRegistry } from "../skills/SkillRegistry.js";
import type { AgentConfig, AgentEvent } from "../types.js";
import { TraceRecorder } from "../trace/TraceRecorder.js";
import { logger } from "../utils/logger.js";

const activeSessions = new Map<string, Agent>();

function buildAgentConfig(): AgentConfig {
  return {
    llmProvider: (process.env.LLM_PROVIDER as AgentConfig["llmProvider"]) ?? "anthropic",
    llmModel: process.env.LLM_MODEL ?? "claude-sonnet-4-6",
    maxSteps: parseInt(process.env.MAX_STEPS ?? "50", 10),
    timeoutMs: parseInt(process.env.AGENT_TIMEOUT_MS ?? "120000", 10),
    browserType:
      (process.env.BROWSER_TYPE as AgentConfig["browserType"]) ?? "chromium",
    headless: process.env.BROWSER_HEADLESS !== "false",
    userDataDir: process.env.BROWSER_USER_DATA_DIR,
  };
}

export function createAgentRouter(io: SocketServer, registry: SkillRegistry): Router {
  const router = Router();

  // ── POST /api/run ─────────────────────────────────────────────────────────
  router.post("/run", async (req: Request, res: Response) => {
    const { goal, startUrl, skillName, params } = req.body as {
      goal?: string;
      startUrl?: string;
      skillName?: string;
      params?: Record<string, unknown>;
    };

    if (!goal && !skillName) {
      res.status(400).json({ error: "goal or skillName is required" });
      return;
    }

    const config = buildAgentConfig();
    const llm = createLLMProvider(config.llmProvider, config.llmModel);
    const agent = new Agent(config, llm);

    // If a skill is specified, let it build the plan — the skill's plan() method
    // converts params into a goal string and an optional startUrl. URL shortcuts
    // (e.g. Google Flights deep links) skip brittle form-filling entirely.
    let finalGoal = goal ?? "";
    let finalStartUrl = startUrl;
    if (skillName) {
      const skill = registry.get(skillName);
      if (!skill) {
        res.status(404).json({ error: `Skill "${skillName}" not found` });
        return;
      }
      const validationError = skill.validate?.(params);
      if (validationError) {
        res.status(400).json({ error: validationError });
        return;
      }
      const plan = skill.plan(params);
      finalGoal = plan.goal;
      finalStartUrl = plan.startUrl ?? finalStartUrl;
      logger.info(`[Skill] ${skillName} → ${plan.startUrl ?? "(no startUrl)"}`);
    }

    // Set up listener BEFORE calling run() to avoid race condition
    const sessionIdPromise = new Promise<string>((resolve) => {
      agent.once("agent:start", (event: AgentEvent) => resolve(event.sessionId));
    });

    // Forward all agent events to Socket.io room
    agent.on("*", (event: AgentEvent) => {
      io.to(`session:${event.sessionId}`).emit(event.type, event);
      io.emit(event.type, event);
    });

    // Start agent run (non-blocking)
    const sessionPromise = agent.run({
      goal: finalGoal,
      startUrl: finalStartUrl,
      skillName,
      params,
    });

    const sessionId = await sessionIdPromise;

    activeSessions.set(sessionId, agent);

    res.json({
      sessionId,
      status: "running",
      message: "Agent started. Subscribe via WebSocket for real-time updates.",
    });

    // Cleanup after done
    sessionPromise.then((result) => {
      activeSessions.delete(sessionId);
      logger.info(`Session ${sessionId} ended: ${result.success ? "success" : "failed"}`);
    });
  });

  // ── POST /api/stop/:sessionId ──────────────────────────────────────────────
  router.post("/stop/:sessionId", (req: Request, res: Response) => {
    const agent = activeSessions.get(req.params.sessionId!);
    if (!agent) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    agent.stop();
    activeSessions.delete(req.params.sessionId!);
    res.json({ status: "stopped" });
  });

  // ── POST /api/approve/:sessionId ──────────────────────────────────────────
  router.post("/approve/:sessionId", (req: Request, res: Response) => {
    const agent = activeSessions.get(req.params.sessionId!);
    if (!agent) {
      res.status(404).json({ error: "Session not found or not waiting for approval" });
      return;
    }
    const { approved, userInput } = req.body as {
      approved: boolean;
      userInput?: string;
    };
    agent.resolveHumanApproval(req.params.sessionId!, approved, userInput);
    res.json({ status: approved ? "approved" : "rejected" });
  });

  // ── GET /api/skills ────────────────────────────────────────────────────────
  router.get("/skills", (_req: Request, res: Response) => {
    res.json(registry.toJSON());
  });

  // ── GET /api/traces ────────────────────────────────────────────────────────
  router.get("/traces", (_req: Request, res: Response) => {
    const traces = TraceRecorder.listTraces();
    res.json(
      traces.map((t) => ({
        id: t.id,
        goal: t.goal,
        status: t.status,
        startedAt: t.startedAt,
        completedAt: t.completedAt,
        stepsCount: t.steps.length,
        finalResult: t.finalResult,
      }))
    );
  });

  // ── GET /api/traces/:id ────────────────────────────────────────────────────
  router.get("/traces/:id", (req: Request, res: Response) => {
    try {
      const trace = TraceRecorder.load(`./traces/${req.params.id}.trace.json`);
      res.json(trace);
    } catch {
      res.status(404).json({ error: "Trace not found" });
    }
  });

  // ── GET /api/sessions ─────────────────────────────────────────────────────
  router.get("/sessions", (_req: Request, res: Response) => {
    res.json(
      Array.from(activeSessions.keys()).map((id) => ({ sessionId: id, status: "running" }))
    );
  });

  return router;
}
