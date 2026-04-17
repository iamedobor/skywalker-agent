import OpenAI from "openai";
import { LLMProvider, type LLMInput } from "./LLMProvider.js";
import { LLMResponseSchema, type LLMResponse } from "../types.js";
import { logger } from "../utils/logger.js";

export class OpenAIProvider extends LLMProvider {
  readonly name = "openai";
  readonly model: string;
  private client: OpenAI;

  constructor(model = "gpt-4o") {
    super();
    this.model = model;
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  async think(input: LLMInput): Promise<LLMResponse> {
    const userPrompt = this.buildUserPrompt(input);

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      messages: [
        { role: "system", content: this.buildSystemPrompt() },
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:image/jpeg;base64,${input.screenshotBase64}`,
                detail: "high",
              },
            },
            { type: "text", text: userPrompt },
          ],
        },
      ],
      response_format: { type: "json_object" },
    });

    const rawText = response.choices[0]?.message?.content ?? "";
    logger.debug(`LLM raw response:\n${rawText}`);
    return this.parseResponse(rawText);
  }

  private parseResponse(raw: string): LLMResponse {
    try {
      const parsed = JSON.parse(raw) as unknown;
      const normalized = this.normalizeAction(parsed);
      return LLMResponseSchema.parse(normalized);
    } catch (e) {
      logger.warn(`OpenAI response parse failed: ${String(e)}`);
      return {
        thought: "Failed to parse LLM response.",
        observation: "Parse error",
        action: {
          type: "backtrack",
          reason: `Malformed response: ${raw.slice(0, 100)}`,
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
    const typeMap: Record<string, () => Record<string, unknown>> = {
      clear: () => ({ type: "type", text: "", clearFirst: true, description: action.description ?? "Clear field" }),
      triple_click: () => ({ type: "click", elementId: action.elementId, coordinates: action.coordinates, description: action.description ?? "Click" }),
      double_click: () => ({ type: "click", elementId: action.elementId, coordinates: action.coordinates, description: action.description ?? "Click" }),
      focus: () => ({ type: "click", elementId: action.elementId, coordinates: action.coordinates, description: action.description ?? "Focus" }),
      press: () => ({ type: "key_press", key: (action.key ?? action.value ?? "Enter") as string, description: action.description ?? "Press key" }),
      press_key: () => ({ type: "key_press", key: (action.key ?? "Enter") as string, description: action.description ?? "Press key" }),
      input: () => ({ type: "type", elementId: action.elementId, text: (action.text ?? action.value ?? "") as string, clearFirst: true, description: action.description ?? "Type" }),
      fill: () => ({ type: "type", elementId: action.elementId, text: (action.text ?? action.value ?? "") as string, clearFirst: true, description: action.description ?? "Fill" }),
      goto: () => ({ type: "navigate", url: action.url as string, description: action.description ?? "Navigate" }),
    };
    if (type && typeMap[type]) {
      return { ...obj, action: typeMap[type]!() };
    }
    return parsed;
  }
}
