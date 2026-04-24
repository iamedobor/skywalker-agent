import { BaseSkill, type SkillPlan } from "../BaseSkill.js";
import type { SkillMetadata } from "../../types.js";

/**
 * FlightSearchSkill — finds the cheapest flight matching the user's criteria.
 *
 * ## Why this is bulletproof
 *
 * Google Flights' custom date picker and autocomplete dropdowns are notoriously
 * hostile to automation — even the best vision-LLM agents burn step budgets
 * fighting the UI. We bypass the whole form by constructing a deep-link URL
 * with the query pre-filled, so the agent lands directly on the results page
 * and only has to do what it's good at: read flight options from a screenshot.
 *
 * URL shape we use (the "?q=" free-text form):
 *   https://www.google.com/travel/flights?q=Flights%20to%20London%20from%20NYC%20on%202026-04-24
 *
 * Google parses the natural-language query and renders results directly.
 */
export class FlightSearchSkill extends BaseSkill {
  readonly metadata: SkillMetadata = {
    name: "flight-search",
    description: "Find the cheapest flight between any two cities on a given date",
    version: "1.1.0",
    author: "SkyWalker Core",
    triggers: ["book a flight", "find flight", "fly to", "cheapest flight"],
    category: "travel",
    icon: "✈️",
  };

  paramsSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        origin: {
          type: "string",
          description: "Departure city or 3-letter airport code (e.g. 'NYC', 'San Francisco')",
        },
        destination: {
          type: "string",
          description: "Destination city or 3-letter airport code (e.g. 'London', 'LHR')",
        },
        departDate: {
          type: "string",
          format: "date",
          description: "YYYY-MM-DD",
        },
        returnDate: {
          type: "string",
          format: "date",
          description: "Optional return date for round trips (YYYY-MM-DD)",
        },
        adults: {
          type: "integer",
          minimum: 1,
          maximum: 9,
          default: 1,
          description: "Adults (age 18+)",
        },
        children: {
          type: "integer",
          minimum: 0,
          maximum: 8,
          default: 0,
          description: "Children (age 2–17)",
        },
        infants: {
          type: "integer",
          minimum: 0,
          maximum: 4,
          default: 0,
          description: "Infants (under 2, on lap)",
        },
        cabinClass: {
          type: "string",
          enum: ["economy", "premium-economy", "business", "first"],
          default: "economy",
        },
      },
      required: ["origin", "destination", "departDate"],
    };
  }

  validate(params?: Record<string, unknown>): string | null {
    if (!params?.origin) return "Origin is required (city or airport code)";
    if (!params?.destination) return "Destination is required";
    if (!params?.departDate) return "Departure date is required (YYYY-MM-DD)";
    const depart = String(params.departDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(depart)) {
      return `Departure date must be in YYYY-MM-DD format (got "${depart}")`;
    }
    if (params.returnDate) {
      const ret = String(params.returnDate);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(ret)) {
        return `Return date must be in YYYY-MM-DD format (got "${ret}")`;
      }
      if (ret < depart) return "Return date must be after departure date";
    }
    const adults = Number(params.adults ?? 1);
    const infants = Number(params.infants ?? 0);
    if (infants > adults) {
      return `Infants (${infants}) cannot exceed adults (${adults}) — each infant must sit with an adult`;
    }
    return null;
  }

  plan(params?: Record<string, unknown>): SkillPlan {
    const origin = String(params?.origin);
    const destination = String(params?.destination);
    const departDate = String(params?.departDate);
    const returnDate = params?.returnDate ? String(params.returnDate) : undefined;
    const adults = Number(params?.adults ?? 1);
    const children = Number(params?.children ?? 0);
    const infants = Number(params?.infants ?? 0);
    const cabinClass = String(params?.cabinClass ?? "economy");

    // Google Flights' `?q=` endpoint parses natural language. We write the
    // query in the shape we've verified parses correctly: singular/plural
    // matters, and "adult"/"child"/"infant" is the vocabulary it recognizes.
    const queryParts: string[] = ["Flights", `from ${origin}`, `to ${destination}`, `on ${departDate}`];
    if (returnDate) queryParts.push(`returning ${returnDate}`);

    const paxParts: string[] = [];
    paxParts.push(`${adults} ${adults === 1 ? "adult" : "adults"}`);
    if (children > 0) paxParts.push(`${children} ${children === 1 ? "child" : "children"}`);
    if (infants > 0) paxParts.push(`${infants} ${infants === 1 ? "infant" : "infants"}`);
    queryParts.push(`for ${paxParts.join(", ")}`);

    if (cabinClass !== "economy") queryParts.push(`in ${cabinClass.replace("-", " ")} class`);

    const query = queryParts.join(" ");
    const startUrl = `https://www.google.com/travel/flights?q=${encodeURIComponent(query)}`;

    const paxSummary = paxParts.join(", ");
    const goal = [
      `You are on Google Flights for: ${query}.`,
      `The search is ALREADY CONFIGURED with the correct origin, destination, dates, and passengers (${paxSummary}).`,
      `Do NOT re-enter any of these fields.`,
      `If a consent/cookie dialog appears, dismiss it first.`,
      `Wait for results to load (2–3 seconds), then VERIFY the passenger count shown on the page matches "${paxSummary}". If it doesn't match, note the discrepancy in your final answer.`,
      `Read the results and identify the CHEAPEST option. Report: airline, price, departure time, arrival time, total duration, number of stops, and confirmed passenger count.`,
      `Use the "complete" action with a structured result. Do NOT click "Book", "Continue", or "Select" — the user will book manually.`,
    ].join(" ");

    return { goal, startUrl };
  }
}
