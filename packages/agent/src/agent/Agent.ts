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
    let lastUrl = "";
    let staleStepCount = 0;
    let consentAttempts = 0;
    // Count consecutive DOM-changing actions that didn't advance the URL.
    // Distinct from staleStepCount, which needs an empty a11y tree to fire —
    // this catches the "rich page but clicks aren't progressing" trap
    // (e.g., clicking Continue on a fare-selection page 10× in a row).
    let urlUnchangedActions = 0;
    const recentActionFingerprints: string[] = [];

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

      // ── Auto-dismiss consent/cookie pages without consuming a real step ──────
      // Only match by URL — aria tree check was too broad and triggered on Google Flights itself
      if (url.includes("consent.google.com") || url.includes("google.com/sorry")) {
        consentAttempts++;
        logger.info(`[Auto] Consent page detected — attempt ${consentAttempts}`);

        if (consentAttempts <= 4) {
          // Use JS evaluation to click button by inner text — works regardless of Shadow DOM or locale
          await page.evaluate(() => {
            const btns = Array.from(document.querySelectorAll("button, [role='button']")) as HTMLElement[];
            const target =
              btns.find(b => /reject|ablehnen|refuser|decline/i.test(b.innerText)) ??
              btns.find(b => /accept|accepter|akzeptieren|agree/i.test(b.innerText)) ??
              btns[0];
            target?.click();
          }).catch(() => {});
          await page.waitForTimeout(2000);
        } else {
          // Tried 4 times — force navigate past consent using the continue param
          const continueUrl = new URL(url).searchParams.get("continue") ?? "";
          if (continueUrl) {
            logger.warn(`[Auto] Consent not dismissing — force-navigating to: ${continueUrl}`);
            await page.goto(continueUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {});
            await page.waitForTimeout(1500);
          }
          consentAttempts = 0;
        }

        step--; // consent handling is NOT a real step — don't consume the step budget
        continue;
      }

      // Reset consent counter once we leave the consent page
      consentAttempts = 0;

      // Detect stale loop: same URL + empty tree for 4+ steps → force backtrack
      if (url === lastUrl && a11yTree.filter(n => n.role !== "document").length < 3) {
        staleStepCount++;
        if (staleStepCount >= 4) {
          staleStepCount = 0;
          lastError = "Stuck on this page for multiple steps with no interactive elements found. Try click_text, navigate to a different site, or use extract to read the page content.";
        }
      } else {
        staleStepCount = 0;
        lastUrl = url;
      }

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

      // ── Loop detection ───────────────────────────────────────────────────────
      // If the LLM keeps emitting the same action 4+ times in a row without
      // progress, the current approach is not working — inject a pointed error
      // that forces it to switch strategies. Without this the agent can burn
      // the entire step budget repeating a click that never lands.
      const action = llmResponse.action;
      const fingerprint = this.actionFingerprint(action);
      recentActionFingerprints.push(fingerprint);
      if (recentActionFingerprints.length > 6) recentActionFingerprints.shift();

      const repeatCount = recentActionFingerprints.filter((f) => f === fingerprint).length;
      if (repeatCount >= 4 && action.type !== "complete" && action.type !== "require_human") {
        logger.warn(`[Loop] Action "${fingerprint}" repeated ${repeatCount}× — forcing strategy change`);
        lastError =
          `You have tried this same action ${repeatCount} times in a row without progress. The current approach is NOT working — the click is likely not landing on the intended target, or the page is re-rendering on each interaction. ` +
          `STOP repeating it. Try one of these alternatives: ` +
          `(1) If targeting a combobox/autocomplete suggestion, use key_press "ArrowDown" then key_press "Enter" instead of click_text. ` +
          `(2) If the dialog keeps closing, the click is landing on a wrapper — try click_text with more specific/exact text, or use click with coordinates. ` +
          `(3) If truly stuck, emit a backtrack action with a reason.`;
        recentActionFingerprints.length = 0; // reset so the warning isn't repeated every step
      }

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

      // Track whether the URL advanced after this action. Clicks/typing on a
      // page that doesn't change the URL for 6+ actions is a strong signal we
      // are stuck in a no-op loop (e.g., fare-selection "Continue" that keeps
      // re-opening the same overlay). Nudge the agent out of it.
      const urlAfterAction = await this.browser.currentUrl();
      const progresses = ["click", "click_text", "type", "key_press", "navigate", "triple_click"];
      if (progresses.includes(llmResponse.action.type)) {
        if (urlAfterAction === url) {
          urlUnchangedActions++;
        } else {
          urlUnchangedActions = 0;
        }
        if (urlUnchangedActions >= 6) {
          logger.warn(`[Loop] ${urlUnchangedActions} actions with no URL change — forcing strategy change`);
          lastError =
            `You have performed ${urlUnchangedActions} actions on this page with no URL change — clicks are not advancing the flow. ` +
            `This usually means: (a) the page uses a modal/overlay you're clicking inside of, or (b) the target requires a specific sequence (e.g. scroll into view first). ` +
            `Try: scrolling to reveal more options, pressing Escape to close any overlay, or emitting "complete" if the goal can already be answered from what you've read. ` +
            `If the goal is a booking/checkout and you've already identified the cheapest option — STOP clicking and call "complete" with that result. Never click "Book" or "Continue" past a fare-selection screen without require_human approval.`;
          urlUnchangedActions = 0;
        }
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

  /**
   * Build a stable fingerprint for an action so we can detect the LLM looping
   * on the same target. Uses action type + the most discriminating field
   * (text for click_text/type, key for key_press, url for navigate, etc).
   */
  private actionFingerprint(action: import("../types.js").AgentAction): string {
    switch (action.type) {
      case "click_text": return `click_text:${action.text.slice(0, 40).toLowerCase()}`;
      case "click":      return `click:${action.elementId ?? action.coordinates?.x + "," + action.coordinates?.y}`;
      case "type":       return `type:${action.text.slice(0, 40).toLowerCase()}`;
      case "key_press":  return `key_press:${action.key.toLowerCase()}`;
      case "navigate":   return `navigate:${action.url}`;
      case "select":     return `select:${action.elementId}:${action.value}`;
      case "scroll":     return `scroll:${action.direction}`;
      case "hover":      return `hover:${action.elementId ?? action.coordinates?.x + "," + action.coordinates?.y}`;
      case "triple_click": return `triple_click:${action.elementId ?? "focused"}`;
      default:           return action.type;
    }
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
