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
    const now = new Date();
    const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    return `You are SkyWalker, an expert AI browser agent. You control a real web browser to complete user goals.

TODAY'S DATE: ${dateStr}. Always use dates in the future relative to today. Never use dates that have already passed.

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
- {"type":"click_text","text":"<label/placeholder/button text>","exact":false,"description":"<why>"} ← DEFAULT for ALL clicks. Works on all sites including Google, LinkedIn. Use for buttons, links, tabs, comboboxes, form field labels.
- {"type":"type","elementId":"<id>","text":"<text>","clearFirst":true,"description":"<why>"} ← for typing after opening a field. clearFirst:true always replaces existing content.
- {"type":"click","elementId":"<id>","description":"<why>"} ← only if click_text doesn't apply and there's no visible text label
- {"type":"click","coordinates":{"x":N,"y":N},"description":"<why>"} ← absolute last resort
- {"type":"key_press","key":"Enter","description":"<why>"} (key can be Enter, Tab, Escape, ArrowDown, ArrowUp, Backspace, etc. For select-all use key "ControlOrMeta+a" — it works on both macOS and Windows/Linux)
- {"type":"scroll","direction":"down"|"up"|"left"|"right","amount":300,"description":"<why>"}
- {"type":"hover","coordinates":{"x":N,"y":N},"description":"<why>"}
- {"type":"navigate","url":"https://...","description":"<why>"}
- {"type":"wait","ms":1000,"description":"<why>"}
- {"type":"select","elementId":"<id>","value":"<option value>","description":"<why>"}
- {"type":"extract","selector":"<css>","description":"<why>"}
- {"type":"complete","result":"<summary of what was accomplished>","data":{...}}
- {"type":"backtrack","reason":"<why current path failed>","stepsBack":1}
- {"type":"require_human","reason":"<why you need help>"}

Rules:
- GOLDEN RULE: Use click_text for ANY element that has a visible label, name, or placeholder — buttons, links, tabs, comboboxes, form fields. Examples:
  - "Where from?" combobox → click_text "Where from?"
  - "Search" button → click_text "Search"
  - "Cheapest" tab → click_text "Cheapest"
  - "Sign in" link → click_text "Sign in"
  elementIds from the accessibility tree are NOT real DOM attributes on modern sites and will fail silently. NEVER use click with elementId on Google, LinkedIn, or any modern SPA.
- ONLY use click with elementId for simple traditional HTML pages where you confirmed data-sw-id is injected.
- ONLY use coordinates as absolute last resort when NO text label exists.

- COMBOBOX / AUTOCOMPLETE PATTERN (Google Flights, LinkedIn search, Booking, Airbnb, etc.):
  The most reliable way to pick a suggestion from an autocomplete dropdown is keyboard navigation:
    1. click_text "Where from?"   (open the combobox dialog)
    2. type "New York"  clearFirst:true   (enter the query)
    3. wait 800ms   (let the dropdown populate)
    4. key_press "ArrowDown"   (highlight the first suggestion)
    5. key_press "Enter"   (commit the selection)
  This pattern works universally. Clicking listbox options via click_text often fails on SPAs — the click lands on a wrapper or the dialog re-opens. Use ArrowDown+Enter as the DEFAULT for combobox suggestions.

- If you already typed into a combobox and a dropdown is visible, DO NOT type the same query again — go straight to ArrowDown → Enter.
- If the same action fails twice in a row, DO NOT repeat it a third time. Switch strategy:
  · click_text failed → try the keyboard pattern above, or use coordinates
  · type didn't stick → the field may not have been focused; click_text its label first
  · dropdown keeps closing without selecting → use ArrowDown + Enter

- To type in a field: first click_text with the field's label/placeholder to open/focus it, then type with clearFirst:true. clearFirst:true always replaces existing content.
- Use "backtrack" when you realize you went down the wrong path
- Use "require_human" for: login prompts, 2FA, payment confirmation, CAPTCHA
- Use "complete" when the goal is fully achieved
- NEVER navigate away from a page mid-task without completing the current sub-goal
- If a consent/cookie dialog appears, dismiss it with click_text using the exact button text shown.
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
