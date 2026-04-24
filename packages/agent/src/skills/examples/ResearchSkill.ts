import { BaseSkill, type SkillPlan } from "../BaseSkill.js";
import type { SkillMetadata } from "../../types.js";

/**
 * ResearchSkill — deep-dives a topic by searching Google and reading sources.
 *
 * This is SkyWalker's most-reliable skill: text-heavy pages with no custom
 * widgets are where vision-LLM agents excel. We hand the agent a pre-filled
 * Google search URL and let it read + summarize.
 */
export class ResearchSkill extends BaseSkill {
  readonly metadata: SkillMetadata = {
    name: "research",
    description: "Research any topic by searching the web and summarizing findings",
    version: "1.1.0",
    author: "SkyWalker Core",
    triggers: ["research", "find information about", "look up", "what is"],
    category: "productivity",
    icon: "🔍",
  };

  paramsSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        topic: {
          type: "string",
          description: "What to research (e.g. 'LLM evaluation benchmarks 2026')",
        },
        depth: {
          type: "string",
          enum: ["quick", "standard", "deep"],
          default: "standard",
          description: "Quick = 1 source, Standard = 3 sources, Deep = 5 sources",
        },
      },
      required: ["topic"],
    };
  }

  validate(params?: Record<string, unknown>): string | null {
    if (!params?.topic) return "Topic is required";
    return null;
  }

  plan(params?: Record<string, unknown>): SkillPlan {
    const topic = String(params?.topic);
    const depth = String(params?.depth ?? "standard") as "quick" | "standard" | "deep";

    const sources = { quick: 1, standard: 3, deep: 5 }[depth];

    const instructions: Record<typeof depth, string> = {
      quick: `Read the featured snippet and the top result. Summarize the key facts in 3 bullet points.`,
      standard: `Visit the top ${sources} results. For each, extract the key points. Produce a structured summary with a TL;DR + bulleted key findings + source URLs.`,
      deep: `Visit the top ${sources} results. Extract detailed information, compare conflicting viewpoints, and produce a comprehensive report with sections: Overview, Key Findings, Contrasting Perspectives, Sources.`,
    };

    const goal = [
      `Research topic: "${topic}".`,
      instructions[depth],
      `If a consent/cookie banner appears, dismiss it.`,
      `Always include source URLs in your final answer.`,
      `Use the "complete" action when done.`,
    ].join(" ");

    const startUrl = `https://www.google.com/search?q=${encodeURIComponent(topic)}`;

    return { goal, startUrl };
  }
}
