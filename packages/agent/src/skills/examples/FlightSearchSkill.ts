import { BaseSkill, type SkillResult } from "../BaseSkill.js";
import type { SkillMetadata, SkillExecuteOptions } from "../../types.js";

/**
 * FlightSearchSkill — finds the cheapest flight matching the user's criteria.
 *
 * This skill demonstrates the full See-Think-Do loop and the PaymentGate.
 * It uses Google Flights as the primary source but the LLM will adapt
 * to whatever UI it encounters.
 */
export class FlightSearchSkill extends BaseSkill {
  readonly metadata: SkillMetadata = {
    name: "flight-search",
    description: "Search for flights and find the cheapest option",
    version: "1.0.0",
    author: "SkyWalker Core",
    triggers: ["book a flight", "find flight", "fly to", "cheapest flight"],
    category: "travel",
    icon: "✈️",
  };

  paramsSchema(): Record<string, unknown> {
    return {
      type: "object",
      properties: {
        origin: { type: "string", description: "Departure city or airport code" },
        destination: { type: "string", description: "Destination city or airport code" },
        departDate: { type: "string", format: "date", description: "YYYY-MM-DD" },
        returnDate: { type: "string", format: "date", description: "Return date for round trips" },
        passengers: { type: "integer", minimum: 1, maximum: 9, default: 1 },
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
    if (!params?.origin) return "Origin city is required";
    if (!params?.destination) return "Destination city is required";
    if (!params?.departDate) return "Departure date is required";
    return null;
  }

  async execute({ context, params }: SkillExecuteOptions): Promise<SkillResult> {
    const { origin, destination, departDate, returnDate, passengers = 1, cabinClass = "economy" } =
      params ?? {};

    this.log(context, `FlightSearchSkill: searching ${origin} → ${destination} on ${departDate}`);

    // Build a natural-language goal for the agent's See-Think-Do loop
    const roundTrip = returnDate ? ` returning ${returnDate}` : " (one-way)";
    context.goal = [
      `Search for the cheapest ${cabinClass} class flight from ${origin} to ${destination}`,
      `departing ${departDate}${roundTrip}, ${passengers} passenger(s).`,
      `Use any flight search site you prefer (Google Flights, Kayak, Skyscanner, Expedia, etc.).`,
      `Find the best price and return: airline, price, departure time, arrival time, and duration.`,
      `Do NOT book or click any payment button — report the result only.`,
    ].join(" ");

    this.log(context, `Goal set. Handing off to core See-Think-Do loop.`);

    return {
      success: true,
      message: "Flight search goal configured. Core agent will execute.",
    };
  }
}
