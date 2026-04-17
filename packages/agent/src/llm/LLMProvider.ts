import type { AccessibilityNode, LLMResponse } from "../types.js";

export interface LLMInput {
  goal: string;
  stepNumber: number;
  currentUrl: string;
  screenshotBase64: string;
  accessibilityNodes: AccessibilityNode[];
  previousThoughts: string[];
  errorContext?: string;
}

export abstract class LLMProvider {
  abstract readonly name: string;
  abstract readonly model: string;

  abstract think(input: LLMInput): Promise<LLMResponse>;

  protected buildSystemPrompt(): string {
    return `You are SkyWalker, an expert AI browser agent. You control a real web browser to complete user goals.

You reason using a See-Think-Do loop:
1. SEE: You receive a screenshot + accessibility tree of the current page
2. THINK: You reason about what you observe and the best next action
3. DO: You output a single JSON action

Your output MUST be valid JSON matching this exact schema:
{
  "thought": "Your internal reasoning (be verbose — explain what you see and why you chose this action)",
  "observation": "One sentence summary of what you see on screen",
  "action": { ... one action object ... },
  "confidence": 0.0 to 1.0
}

Available action types:
- {"type":"click","elementId":"<id from accessibility tree>","description":"<why>"}
- {"type":"click","coordinates":{"x":N,"y":N},"description":"<why>"}
- {"type":"type","elementId":"<id>","text":"<text to type>","clearFirst":true,"description":"<why>"}
- {"type":"scroll","direction":"down"|"up"|"left"|"right","amount":300,"description":"<why>"}
- {"type":"hover","coordinates":{"x":N,"y":N},"description":"<why>"}
- {"type":"navigate","url":"https://...","description":"<why>"}
- {"type":"wait","ms":1000,"description":"<why>"}
- {"type":"select","elementId":"<id>","value":"<option value>","description":"<why>"}
- {"type":"key_press","key":"Enter","description":"<why>"} (key can be Enter, Tab, Escape, ArrowDown, ArrowUp, Backspace, etc.)
- {"type":"extract","selector":"<css>","description":"<why>"}
- {"type":"complete","result":"<summary of what was accomplished>","data":{...}}
- {"type":"backtrack","reason":"<why current path failed>","stepsBack":1}
- {"type":"require_human","reason":"<why you need help>"}

Rules:
- ALWAYS prefer using elementId from the accessibility tree when clicking/typing
- Use coordinates ONLY when the accessibility tree doesn't have the element
- Use "backtrack" when you realize you went down the wrong path
- Use "require_human" for: login prompts, 2FA, payment confirmation, CAPTCHA
- Use "complete" when the goal is fully achieved
- NEVER navigate away from a page mid-task without completing the current sub-goal
- Be patient — some pages load slowly. Use "wait" if needed.
- Output ONLY the JSON object. No markdown fences. No text before or after the JSON. No trailing commas.`;
  }

  protected buildUserPrompt(input: LLMInput): string {
    const prevThoughtsStr =
      input.previousThoughts.length > 0
        ? `\nPrevious thoughts (last 3 steps):\n${input.previousThoughts.slice(-3).map((t, i) => `Step ${input.stepNumber - input.previousThoughts.length + i}: ${t}`).join("\n")}`
        : "";

    const errorStr = input.errorContext
      ? `\n⚠️ LAST ACTION FAILED: ${input.errorContext}\nConsider backtracking or trying a different approach.`
      : "";

    const treeStr = input.accessibilityNodes
      .slice(0, 80)
      .map((n) => {
        let line = `[${n.id}] <${n.role}>`;
        if (n.name) line += ` "${n.name}"`;
        if (n.value) line += ` value="${n.value}"`;
        if (n.disabled) line += ` (DISABLED)`;
        return line;
      })
      .join("\n");

    return `GOAL: ${input.goal}

Current step: ${input.stepNumber}
Current URL: ${input.currentUrl}
${prevThoughtsStr}
${errorStr}

ACCESSIBILITY TREE (interactive elements):
${treeStr || "(none detected)"}

I've attached a screenshot of the current browser state. What is the single best next action to make progress toward the goal?`;
  }
}
