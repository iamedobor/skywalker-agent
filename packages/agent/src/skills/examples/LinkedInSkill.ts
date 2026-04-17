import { BaseSkill, type SkillResult } from "../BaseSkill.js";
import type { SkillMetadata, SkillExecuteOptions } from "../../types.js";

/**
 * LinkedInSkill — automates common LinkedIn tasks.
 *
 * Requires the user to be already logged into LinkedIn in their browser session.
 * Uses Human-in-the-Loop for connection requests (asks user to confirm each one).
 */
export class LinkedInSkill extends BaseSkill {
  readonly metadata: SkillMetadata = {
    name: "linkedin",
    description: "Automate LinkedIn tasks: search profiles, send connections, extract leads",
    version: "1.0.0",
    author: "SkyWalker Core",
    triggers: ["linkedin", "connect on linkedin", "find linkedin profile", "linkedin search"],
    category: "social",
    icon: "💼",
  };

  paramsSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        task: {
          type: "string",
          enum: ["search-profiles", "send-connections", "extract-posts", "view-company"],
          description: "What to do on LinkedIn",
        },
        query: {
          type: "string",
          description: "Search query (e.g. 'senior engineers at Stripe')",
        },
        maxResults: {
          type: "integer",
          minimum: 1,
          maximum: 50,
          default: 10,
        },
        connectionMessage: {
          type: "string",
          maxLength: 300,
          description: "Custom note to include with connection requests",
        },
      },
      required: ["task", "query"],
    };
  }

  validate(params?: Record<string, unknown>): string | null {
    if (!params?.task) return "Task is required";
    if (!params?.query) return "Search query is required";
    return null;
  }

  async execute({ context, params }: SkillExecuteOptions): Promise<SkillResult> {
    const { task, query, maxResults = 10, connectionMessage } = params ?? {};

    this.log(context, `LinkedInSkill: task="${task}", query="${query}"`);

    const goals: Record<string, string> = {
      "search-profiles": `Go to https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query as string)}&origin=GLOBAL_SEARCH_HEADER. Find up to ${maxResults} profiles matching "${query}". For each profile extract: full name, headline, location, and profile URL. Return as a JSON list.`,

      "send-connections": `Go to https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query as string)}&origin=GLOBAL_SEARCH_HEADER. Find up to ${maxResults} profiles. For each: click "Connect", ${connectionMessage ? `add a note: "${connectionMessage}",` : ""} then STOP and use require_human to confirm before sending each connection request.`,

      "extract-posts": `Go to https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query as string)}&origin=SWITCH_SEARCH_VERTICAL. Extract the top ${maxResults} posts: author, content snippet, likes count, and post URL.`,

      "view-company": `Go to https://www.linkedin.com/company/${encodeURIComponent(query as string)}. Extract company details: name, tagline, employee count, industry, website, and recent posts.`,
    };

    context.goal =
      goals[task as string] ??
      `Navigate to LinkedIn and complete this task: ${task} for "${query}"`;

    this.log(context, "Goal set. Handing off to core agent.");

    return { success: true, message: "LinkedIn task configured." };
  }
}
