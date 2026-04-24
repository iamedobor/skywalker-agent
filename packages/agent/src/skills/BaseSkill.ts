import type { SkillMetadata } from "../types.js";

/**
 * SkillPlan — what a skill returns to the core agent.
 *
 * A skill's job is to convert user-friendly params (from the UI form) into an
 * agent plan: a natural-language goal and optionally a startUrl that the agent
 * navigates to BEFORE the See-Think-Do loop begins.
 *
 * Using a startUrl is the most reliable pattern on sites with custom widgets
 * (date pickers, autocomplete dropdowns). Instead of making the LLM click
 * through a brittle form, the skill constructs a URL with query params
 * pre-filled and the agent starts on the results page.
 */
export interface SkillPlan {
  /** Natural-language goal passed to the LLM. */
  goal: string;
  /** Optional URL to navigate to before the See-Think-Do loop starts. */
  startUrl?: string;
}

/**
 * BaseSkill — extend this to create a SkyWalker plugin.
 *
 * Drop your file in `/skills/` (project root) or `packages/agent/src/skills/examples/`
 * and it will be auto-discovered by SkillRegistry on startup.
 *
 * Example:
 * ```ts
 * export class PizzaSkill extends BaseSkill {
 *   readonly metadata = {
 *     name: "pizza-delivery",
 *     description: "Order pizza from Domino's",
 *     version: "1.0.0",
 *     icon: "🍕",
 *     category: "food",
 *     triggers: ["order pizza"],
 *   };
 *
 *   paramsSchema() {
 *     return {
 *       type: "object",
 *       properties: { items: { type: "string" }, address: { type: "string" } },
 *       required: ["items", "address"],
 *     };
 *   }
 *
 *   plan(params) {
 *     return {
 *       goal: `Order ${params.items} to ${params.address}. Stop at payment — require_human.`,
 *       startUrl: "https://www.dominos.com",
 *     };
 *   }
 * }
 * ```
 */
export abstract class BaseSkill {
  abstract readonly metadata: SkillMetadata;

  /**
   * Convert user-supplied params into an agent plan.
   *
   * This is the ONLY method you must implement. The returned goal is handed
   * to the LLM; the optional startUrl is navigated to before the loop starts.
   *
   * Tip: if the target site supports deep-linking (query params encode the
   * full task — e.g. Google Flights' `?q=`, LinkedIn's search URLs), include
   * a startUrl. The agent skips form-filling and goes straight to results.
   * This is dramatically more reliable than making the LLM click through
   * custom date pickers and autocompletes.
   */
  abstract plan(params?: Record<string, unknown>): SkillPlan;

  /**
   * Optional: validate params before `plan()` is called. Return an error
   * string if invalid, or null if OK. The error is sent back to the UI.
   */
  validate?(params?: Record<string, unknown>): string | null;

  /**
   * Optional: JSON Schema for the params this skill accepts. Rendered as a
   * form in the SkyWalker Dashboard when the user clicks this skill.
   */
  paramsSchema?(): Record<string, unknown>;
}
