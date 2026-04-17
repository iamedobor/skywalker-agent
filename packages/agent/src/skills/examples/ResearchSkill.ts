import { BaseSkill, type SkillResult } from "../BaseSkill.js";
import type { SkillMetadata, SkillExecuteOptions } from "../../types.js";

/**
 * ResearchSkill — deep-dives a topic by visiting multiple sources.
 *
 * Great "good first issue" template for contributors to build upon.
 */
export class ResearchSkill extends BaseSkill {
  readonly metadata: SkillMetadata = {
    name: "research",
    description: "Research any topic by searching the web and summarizing findings",
    version: "1.0.0",
    author: "SkyWalker Core",
    triggers: ["research", "find information about", "look up", "what is"],
    category: "productivity",
    icon: "🔍",
  };

  paramsSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        topic: { type: "string", description: "What to research" },
        depth: {
          type: "string",
          enum: ["quick", "standard", "deep"],
          default: "standard",
          description: "How thorough the research should be",
        },
        sources: {
          type: "integer",
          minimum: 1,
          maximum: 10,
          default: 3,
        },
      },
      required: ["topic"],
    };
  }

  async execute({ context, params }: SkillExecuteOptions): Promise<SkillResult> {
    const { topic, depth = "standard", sources = 3 } = params ?? {};

    this.log(context, `ResearchSkill: researching "${topic}" (depth: ${depth})`);

    const depthInstructions = {
      quick: "Find 1-2 key facts and summarize in 3 sentences.",
      standard: `Visit ${sources} sources, read the key sections, and write a structured summary with key takeaways.`,
      deep: `Visit ${sources} sources, extract detailed information, compare viewpoints, and produce a comprehensive report with sections.`,
    };

    context.goal = `Go to https://www.google.com and search for "${topic}". ${depthInstructions[depth as keyof typeof depthInstructions]} Include source URLs in your final answer. Use extract actions to capture relevant text.`;

    this.log(context, "Research goal set.");

    return { success: true, message: "Research task configured." };
  }
}
