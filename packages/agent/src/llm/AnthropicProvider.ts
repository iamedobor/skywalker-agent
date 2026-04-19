import Anthropic from "@anthropic-ai/sdk";

function extractFirstJson(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i]!;
    if (escape) { escape = false; continue; }
    if (ch === "\\" && inString) { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) return text.slice(start, i + 1); }
  }
  return null;
}
import { z } from "zod";
import { LLMProvider, type LLMInput } from "./LLMProvider.js";
import { LLMResponseSchema, type LLMResponse } from "../types.js";
import { logger } from "../utils/logger.js";

export class AnthropicProvider extends LLMProvider {
  readonly name = "anthropic";
  readonly model: string;
  private client: Anthropic;

  constructor(model = "claude-sonnet-4-6") {
    super();
    this.model = model;
    this.client = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }

  async think(input: LLMInput): Promise<LLMResponse> {
    const userPrompt = this.buildUserPrompt(input);

    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: this.buildSystemPrompt(),
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/jpeg",
                data: input.screenshotBase64,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
    });

    const rawText =
      response.content[0]?.type === "text" ? response.content[0].text : "";

    logger.debug(`LLM raw response:\n${rawText}`);

    return this.parseResponse(rawText);
  }

  private parseResponse(raw: string): LLMResponse {
    const cleaned = raw
      .replace(/^```json\s*/i, "")
      .replace(/^```\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    try {
      const parsed = JSON.parse(cleaned) as unknown;
      const normalized = this.normalizeAction(parsed);
      return LLMResponseSchema.parse(normalized);
    } catch (e) {
      logger.warn(`LLM response parse failed, attempting repair: ${String(e)}`);

      // Extract the first complete JSON object using brace matching
      const firstJson = extractFirstJson(cleaned);
      if (firstJson) {
        try {
          const parsed = JSON.parse(firstJson) as unknown;
          const normalized = this.normalizeAction(parsed);
          return LLMResponseSchema.parse(normalized);
        } catch {
          // fall through
        }
      }

      return {
        thought: "Failed to parse LLM response. Backing off.",
        observation: "Parse error",
        action: {
          type: "backtrack",
          reason: `LLM output was malformed: ${cleaned.slice(0, 100)}`,
          stepsBack: 1,
        },
        confidence: 0.1,
      };
    }
  }

  private normalizeAction(parsed: unknown): unknown {
    if (typeof parsed !== "object" || parsed === null) return parsed;
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.action !== "object" || obj.action === null) return parsed;

    const action = obj.action as Record<string, unknown>;
    const type = action.type as string | undefined;

    // Remap action types the LLM commonly invents
    const typeMap: Record<string, () => Record<string, unknown>> = {
      clear: () => ({ type: "type", text: "", clearFirst: true, description: action.description ?? "Clear field" }),
      triple_click: () => ({ type: "triple_click", elementId: action.elementId, coordinates: action.coordinates, description: action.description ?? "Triple click to select all" }),
      double_click: () => ({ type: "triple_click", elementId: action.elementId, coordinates: action.coordinates, description: action.description ?? "Double click" }),
      focus: () => ({ type: "click", elementId: action.elementId, coordinates: action.coordinates, description: action.description ?? "Focus element" }),
      press: () => ({ type: "key_press", key: (action.key ?? action.value ?? "Enter") as string, description: action.description ?? "Press key" }),
      press_key: () => ({ type: "key_press", key: (action.key ?? "Enter") as string, description: action.description ?? "Press key" }),
      keyboard: () => ({ type: "key_press", key: (action.key ?? "Enter") as string, description: action.description ?? "Press key" }),
      input: () => ({ type: "type", elementId: action.elementId, text: (action.text ?? action.value ?? "") as string, clearFirst: true, description: action.description ?? "Type text" }),
      fill: () => ({ type: "type", elementId: action.elementId, text: (action.text ?? action.value ?? "") as string, clearFirst: true, description: action.description ?? "Fill field" }),
      goto: () => ({ type: "navigate", url: action.url as string, description: action.description ?? "Navigate" }),
      open: () => ({ type: "navigate", url: action.url as string, description: action.description ?? "Open URL" }),
    };

    if (type && typeMap[type]) {
      logger.warn(`Normalizing unknown action type "${type}" → known type`);
      return { ...obj, action: typeMap[type]!() };
    }

    return parsed;
  }
}
