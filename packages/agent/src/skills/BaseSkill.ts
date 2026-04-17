import type { AgentContext, SkillMetadata, SkillExecuteOptions } from "../types.js";

export interface SkillResult {
  success: boolean;
  data?: Record<string, unknown>;
  message?: string;
  error?: string;
}

/**
 * BaseSkill — extend this to create a SkyWalker plugin.
 *
 * Drop your file in packages/agent/src/skills/ and it will be
 * auto-discovered by SkillRegistry on startup.
 *
 * Example:
 *   export class MySkill extends BaseSkill {
 *     metadata = { name: "my-skill", description: "...", version: "1.0.0" }
 *     async execute(opts) { ... }
 *   }
 */
export abstract class BaseSkill {
  abstract readonly metadata: SkillMetadata;

  /**
   * Main entry point. Receives the full AgentContext.
   * Use context.emit() to push real-time events to the UI.
   */
  abstract execute(options: SkillExecuteOptions): Promise<SkillResult>;

  /**
   * Optional: called before execute(). Use to validate params
   * or check prerequisites. Return an error string if invalid.
   */
  validate?(params?: Record<string, unknown>): string | null;

  /**
   * Optional: JSON Schema for the params this skill accepts.
   * Rendered as a form in the SkyWalker Dashboard.
   */
  paramsSchema?(): Record<string, unknown>;

  protected log(context: AgentContext, message: string): void {
    context.emit({
      type: "agent:thought",
      sessionId: context.sessionId,
      timestamp: new Date().toISOString(),
      data: {
        source: this.metadata.name,
        message,
      },
    });
  }
}
