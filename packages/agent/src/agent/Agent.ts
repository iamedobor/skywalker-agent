import { v4 as uuidv4 } from "uuid";
import { EventEmitter } from "events";
import type { LLMProvider } from "../llm/LLMProvider.js";
import { BrowserController } from "../browser/BrowserController.js";
import { captureAccessibilityTree } from "../browser/AccessibilityTree.js";
import { TraceRecorder } from "../trace/TraceRecorder.js";
import { PaymentGate } from "../safety/PaymentGate.js";
import type {
  AgentConfig,
  AgentContext,
  AgentEvent,
  AgentEventType,
  AgentStep,
  HumanApprovalRequest,
} from "../types.js";
import { logger } from "../utils/logger.js";

export interface AgentRunOptions {
  goal: string;
  startUrl?: string;
  skillName?: string;
  params?: Record<string, unknown>;
}

export interface AgentRunResult {
  sessionId: string;
  success: boolean;
  result?: string;
  error?: string;
  stepsCount: number;
  traceId: string;
}

export class Agent extends EventEmitter {
  private config: AgentConfig;
  private llm: LLMProvider;
  private browser: BrowserController;
  private paymentGate: PaymentGate;
  private running = false;
  private abortController: AbortController | null = null;

  constructor(config: AgentConfig, llm: LLMProvider) {
    super();
    this.config = config;
    this.llm = llm;
    this.browser = new BrowserController();
    this.paymentGate = new PaymentGate();
  }

  async run(options: AgentRunOptions): Promise<AgentRunResult> {
    if (this.running) throw new Error("Agent is already running");

    const sessionId = uuidv4();
    const traceRecorder = new TraceRecorder(sessionId, options.goal);
    this.abortController = new AbortController();
    this.running = true;

    this.emit_event("agent:start", sessionId, {
      goal: options.goal,
      sessionId,
      model: this.llm.model,
      provider: this.llm.name,
    });

    try {
      await this.browser.launch(this.config);

      if (options.startUrl) {
        await this.browser.executeAction({
          type: "navigate",
          url: options.startUrl,
          description: `Navigate to starting URL: ${options.startUrl}`,
        });
      }

      const context = this.createContext(sessionId, options.goal);
      const result = await this.seeThinkDoLoop(
        context,
        traceRecorder,
        sessionId
      );

      traceRecorder.complete(result);
      this.emit_event("agent:complete", sessionId, {
        result,
        stepsCount: context.stepHistory.length,
      });

      return {
        sessionId,
        success: true,
        result,
        stepsCount: context.stepHistory.length,
        traceId: sessionId,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      traceRecorder.fail(message);
      this.emit_event("agent:error", sessionId, { error: message });

      return {
        sessionId,
        success: false,
        error: message,
        stepsCount: 0,
        traceId: sessionId,
      };
    } finally {
      this.running = false;
      await this.browser.close();
    }
  }

  stop(): void {
    this.abortController?.abort();
    this.running = false;
  }

  resolveHumanApproval(
    sessionId: string,
    approved: boolean,
    userInput?: string
  ): void {
    this.paymentGate.resolveApproval(sessionId, approved, userInput);
  }

  private async seeThinkDoLoop(
    context: AgentContext,
    recorder: TraceRecorder,
    sessionId: string
  ): Promise<string> {
    const previousThoughts: string[] = [];
    let consecutiveErrors = 0;
    let lastError: string | undefined;

    for (let step = 1; step <= this.config.maxSteps; step++) {
      if (this.abortController?.signal.aborted) {
        throw new Error("Agent stopped by user");
      }

      // ── SEE ─────────────────────────────────────────────────────────────────
      const screenshotB64 = await this.browser.screenshot();
      const url = await this.browser.currentUrl();
      const page = this.browser.getPage();
      const a11yTree = await captureAccessibilityTree(page);

      context.currentUrl = url;
      context.currentScreenshot = screenshotB64;
      context.currentAccessibilityTree = a11yTree;

      this.emit_event("agent:screenshot", sessionId, {
        screenshot: screenshotB64,
        url,
        step,
      });

      // Check payment gate before every step
      const isPaymentPage = await this.paymentGate.checkPage(
        page,
        sessionId,
        (type, data) => this.emit_event(type, sessionId, data)
      );

      if (isPaymentPage) {
        const title = await page.title();
        const approvalRequest: HumanApprovalRequest = {
          sessionId,
          reason:
            "Payment screen detected. Please review and confirm if you want to proceed.",
          screenshot: screenshotB64,
          pageTitle: title,
          pageUrl: url,
        };

        recorder.pause();
        const { approved } = await this.paymentGate.waitForApproval(
          sessionId,
          approvalRequest,
          (type, data) => this.emit_event(type, sessionId, data)
        );

        if (!approved) {
          return "Task paused: user declined to proceed with payment.";
        }
        recorder.resume();
      }

      // ── THINK ────────────────────────────────────────────────────────────────
      this.emit_event("agent:thought", sessionId, {
        step,
        status: "thinking",
        url,
      });

      const stepStart = Date.now();

      const llmResponse = await this.llm.think({
        goal: context.goal,
        stepNumber: step,
        currentUrl: url,
        screenshotBase64: screenshotB64,
        accessibilityNodes: a11yTree,
        previousThoughts,
        errorContext: lastError,
      });

      previousThoughts.push(llmResponse.thought);
      lastError = undefined;

      this.emit_event("agent:thought", sessionId, {
        step,
        thought: llmResponse.thought,
        observation: llmResponse.observation,
        action: llmResponse.action,
        confidence: llmResponse.confidence,
        url,
      });

      logger.info(
        `[Step ${step}/${this.config.maxSteps}] ${llmResponse.action.type} — ${llmResponse.observation}`
      );

      // ── Handle terminal actions ───────────────────────────────────────────────
      if (llmResponse.action.type === "complete") {
        const agentStep: AgentStep = {
          stepNumber: step,
          timestamp: new Date().toISOString(),
          screenshot: screenshotB64,
          accessibilityTree: a11yTree,
          url,
          llmThought: llmResponse.thought,
          llmObservation: llmResponse.observation,
          action: llmResponse.action,
          actionResult: { success: true },
          durationMs: Date.now() - stepStart,
        };
        recorder.recordStep(agentStep);
        context.stepHistory.push(agentStep);
        return llmResponse.action.result;
      }

      if (llmResponse.action.type === "require_human") {
        const title = await page.title();
        recorder.pause();

        const { approved, userInput } =
          await this.paymentGate.waitForApproval(
            sessionId,
            {
              sessionId,
              reason: llmResponse.action.reason,
              screenshot: screenshotB64,
              pageTitle: title,
              pageUrl: url,
            },
            (type, data) => this.emit_event(type, sessionId, data)
          );

        if (!approved) {
          return `Task paused: ${llmResponse.action.reason}`;
        }

        recorder.resume();
        if (userInput) {
          context.customData["lastHumanInput"] = userInput;
        }
        continue;
      }

      if (llmResponse.action.type === "backtrack") {
        logger.warn(`Backtracking: ${llmResponse.action.reason}`);
        this.emit_event("agent:backtrack", sessionId, {
          reason: llmResponse.action.reason,
          step,
        });

        const stepsToGoBack = Math.min(
          llmResponse.action.stepsBack,
          context.stepHistory.length
        );

        if (stepsToGoBack > 0) {
          const targetStep =
            context.stepHistory[context.stepHistory.length - stepsToGoBack];
          if (targetStep?.url && targetStep.url !== url) {
            await this.browser.executeAction({
              type: "navigate",
              url: targetStep.url,
              description: "Backtrack to previous page",
            });
          }
        }

        consecutiveErrors++;
        if (consecutiveErrors >= 3) {
          return `Agent failed after ${consecutiveErrors} consecutive errors. Last issue: ${llmResponse.action.reason}`;
        }
        continue;
      }

      // ── DO ───────────────────────────────────────────────────────────────────
      this.emit_event("agent:action", sessionId, {
        step,
        action: llmResponse.action,
      });

      const actionResult = await this.browser.executeAction(llmResponse.action);

      if (!actionResult.success) {
        lastError = actionResult.error;
        consecutiveErrors++;
      } else {
        consecutiveErrors = 0;
      }

      const agentStep: AgentStep = {
        stepNumber: step,
        timestamp: new Date().toISOString(),
        screenshot: screenshotB64,
        accessibilityTree: a11yTree,
        url,
        llmThought: llmResponse.thought,
        llmObservation: llmResponse.observation,
        action: llmResponse.action,
        actionResult,
        durationMs: Date.now() - stepStart,
      };

      recorder.recordStep(agentStep);
      context.stepHistory.push(agentStep);
    }

    return `Reached maximum steps (${this.config.maxSteps}) without completing the goal.`;
  }

  private createContext(sessionId: string, goal: string): AgentContext {
    return {
      goal,
      sessionId,
      currentUrl: "",
      currentScreenshot: "",
      currentAccessibilityTree: [],
      stepHistory: [],
      customData: {},
      emit: (event: AgentEvent) => {
        this.emit(event.type, event);
      },
    };
  }

  private emit_event(
    type: AgentEventType,
    sessionId: string,
    data: Record<string, unknown>
  ): void {
    const event: AgentEvent = {
      type,
      sessionId,
      timestamp: new Date().toISOString(),
      data,
    };
    this.emit(type, event);
    this.emit("*", event);
  }
}
