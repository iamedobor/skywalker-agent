import type { AgentTrace, AgentStep } from "../types.js";
import type { BrowserController } from "../browser/BrowserController.js";
import { logger } from "../utils/logger.js";

export class TracePlayer {
  private browser: BrowserController;

  constructor(browser: BrowserController) {
    this.browser = browser;
  }

  async replay(
    trace: AgentTrace,
    onStep?: (step: AgentStep, index: number) => void
  ): Promise<void> {
    logger.info(`Replaying trace "${trace.goal}" (${trace.steps.length} steps)`);

    for (let i = 0; i < trace.steps.length; i++) {
      const step = trace.steps[i]!;
      logger.info(`Replay step ${i + 1}/${trace.steps.length}: ${step.action.type}`);

      if (step.action.type === "complete") {
        logger.info(`Replay complete: ${step.action.result}`);
        break;
      }

      if (
        step.action.type === "backtrack" ||
        step.action.type === "require_human"
      ) {
        logger.warn(`Skipping non-replayable action: ${step.action.type}`);
        continue;
      }

      await this.browser.executeAction(step.action);
      onStep?.(step, i);

      await new Promise((r) => setTimeout(r, 300));
    }

    logger.info("Trace replay complete");
  }
}
