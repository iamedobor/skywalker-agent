import { BaseSkill, type SkillPlan } from "../BaseSkill.js";
import type { SkillMetadata } from "../../types.js";

/**
 * LinkedInSkill — automates common LinkedIn tasks.
 *
 * Requires the user to already be logged into LinkedIn in their browser
 * session. Set `BROWSER_USER_DATA_DIR` in `.env` to reuse your Chrome profile.
 *
 * Connection requests always go through `require_human` before sending — the
 * PaymentGate pattern applied to social actions.
 */
export class LinkedInSkill extends BaseSkill {
  readonly metadata: SkillMetadata = {
    name: "linkedin",
    description: "Search profiles, extract leads, or send connection requests",
    version: "1.1.0",
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
          default: "search-profiles",
          description: "What to do on LinkedIn",
        },
        query: {
          type: "string",
          description: "Search query (e.g. 'senior engineers at Stripe') or company slug for view-company",
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
          description: "Custom note to include with connection requests (optional)",
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

  plan(params?: Record<string, unknown>): SkillPlan {
    const task = String(params?.task ?? "search-profiles");
    const query = String(params?.query);
    const maxResults = Number(params?.maxResults ?? 10);
    const connectionMessage = params?.connectionMessage ? String(params.connectionMessage) : undefined;
    const encoded = encodeURIComponent(query);

    const plans: Record<string, SkillPlan> = {
      "search-profiles": {
        startUrl: `https://www.linkedin.com/search/results/people/?keywords=${encoded}&origin=GLOBAL_SEARCH_HEADER`,
        goal: [
          `You are on LinkedIn search results for "${query}".`,
          `Extract up to ${maxResults} profiles. For each: full name, headline, location, and profile URL.`,
          `Scroll the page if needed to load more results.`,
          `If prompted to log in, use require_human. Return results as a JSON list via "complete".`,
        ].join(" "),
      },
      "send-connections": {
        startUrl: `https://www.linkedin.com/search/results/people/?keywords=${encoded}&origin=GLOBAL_SEARCH_HEADER`,
        goal: [
          `You are on LinkedIn search results for "${query}".`,
          `Send connection requests to up to ${maxResults} profiles.`,
          `For each: click "Connect", ${connectionMessage ? `add the note "${connectionMessage}",` : ""}`,
          `then use require_human to get confirmation BEFORE clicking "Send". Never send without human approval.`,
          `Track the names you've contacted. Return the list via "complete".`,
        ].join(" "),
      },
      "extract-posts": {
        startUrl: `https://www.linkedin.com/search/results/content/?keywords=${encoded}&origin=SWITCH_SEARCH_VERTICAL`,
        goal: [
          `You are on LinkedIn post search for "${query}".`,
          `Extract the top ${maxResults} posts: author, content snippet (200 chars), likes count, and post URL.`,
          `Return results as a JSON list via "complete".`,
        ].join(" "),
      },
      "view-company": {
        startUrl: `https://www.linkedin.com/company/${encoded}`,
        goal: [
          `You are on the LinkedIn company page for "${query}".`,
          `Extract: company name, tagline, industry, employee count, website, and 3 recent post summaries.`,
          `Return as structured data via "complete".`,
        ].join(" "),
      },
    };

    return (
      plans[task] ?? {
        goal: `Complete the LinkedIn task "${task}" for "${query}".`,
        startUrl: `https://www.linkedin.com`,
      }
    );
  }
}
