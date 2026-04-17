import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join } from "path";
import type { AgentTrace, AgentStep } from "../types.js";
import { logger } from "../utils/logger.js";

export class TraceRecorder {
  private trace: AgentTrace;
  private tracePath: string;
  private traceDir: string;

  constructor(traceId: string, goal: string, traceDir = "./traces") {
    this.traceDir = traceDir;
    this.tracePath = join(traceDir, `${traceId}.trace.json`);

    this.trace = {
      id: traceId,
      goal,
      startedAt: new Date().toISOString(),
      status: "running",
      steps: [],
    };

    if (!existsSync(traceDir)) {
      mkdirSync(traceDir, { recursive: true });
    }

    this.persist();
  }

  recordStep(step: AgentStep): void {
    this.trace.steps.push(step);
    this.persist();
  }

  complete(result: string, tokensUsed?: number): void {
    this.trace.status = "completed";
    this.trace.completedAt = new Date().toISOString();
    this.trace.finalResult = result;
    this.trace.totalTokensUsed = tokensUsed;
    this.persist();
    logger.info(`Trace saved: ${this.tracePath}`);
  }

  fail(error: string): void {
    this.trace.status = "failed";
    this.trace.completedAt = new Date().toISOString();
    this.trace.finalResult = error;
    this.persist();
  }

  pause(): void {
    this.trace.status = "paused";
    this.persist();
  }

  resume(): void {
    this.trace.status = "running";
    this.persist();
  }

  getTrace(): AgentTrace {
    return { ...this.trace };
  }

  private persist(): void {
    try {
      writeFileSync(this.tracePath, JSON.stringify(this.trace, null, 2));
    } catch (e) {
      logger.warn(`Failed to persist trace: ${String(e)}`);
    }
  }

  static load(tracePath: string): AgentTrace {
    const raw = readFileSync(tracePath, "utf-8");
    return JSON.parse(raw) as AgentTrace;
  }

  static listTraces(traceDir = "./traces"): AgentTrace[] {
    if (!existsSync(traceDir)) return [];
    const { readdirSync } = require("fs") as typeof import("fs");
    return readdirSync(traceDir)
      .filter((f: string) => f.endsWith(".trace.json"))
      .map((f: string) => TraceRecorder.load(join(traceDir, f)));
  }
}
