export { LLMProvider } from "./LLMProvider.js";
export { AnthropicProvider } from "./AnthropicProvider.js";
export { OpenAIProvider } from "./OpenAIProvider.js";

import { AnthropicProvider } from "./AnthropicProvider.js";
import { OpenAIProvider } from "./OpenAIProvider.js";
import type { LLMProvider } from "./LLMProvider.js";

export function createLLMProvider(
  provider: string = process.env.LLM_PROVIDER ?? "anthropic",
  model?: string
): LLMProvider {
  switch (provider) {
    case "openai":
      return new OpenAIProvider(model ?? process.env.LLM_MODEL ?? "gpt-4o");
    case "anthropic":
    default:
      return new AnthropicProvider(
        model ?? process.env.LLM_MODEL ?? "claude-sonnet-4-6"
      );
  }
}
