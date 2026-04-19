import { z } from "zod";

// ─── Agent Configuration ──────────────────────────────────────────────────────

export interface AgentConfig {
  llmProvider: "anthropic" | "openai";
  llmModel: string;
  maxSteps: number;
  timeoutMs: number;
  browserType: "chromium" | "firefox" | "webkit";
  headless: boolean;
  userDataDir?: string;
}

// ─── Accessibility Tree ───────────────────────────────────────────────────────

export interface AccessibilityNode {
  id: string;
  role: string;
  name: string;
  description?: string;
  value?: string;
  checked?: boolean;
  disabled?: boolean;
  focused?: boolean;
  expanded?: boolean;
  required?: boolean;
  placeholder?: string;
  href?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  children?: AccessibilityNode[];
}

// ─── LLM Actions (Zod-validated) ─────────────────────────────────────────────

export const ClickActionSchema = z.object({
  type: z.literal("click"),
  elementId: z.string().optional(),
  coordinates: z
    .object({ x: z.number(), y: z.number() })
    .optional(),
  description: z.string(),
});

export const TypeActionSchema = z.object({
  type: z.literal("type"),
  elementId: z.string().optional(),
  text: z.string(),
  clearFirst: z.boolean().default(true),
  description: z.string(),
});

export const ScrollActionSchema = z.object({
  type: z.literal("scroll"),
  direction: z.enum(["up", "down", "left", "right"]),
  amount: z.number().default(300),
  description: z.string(),
});

export const HoverActionSchema = z.object({
  type: z.literal("hover"),
  elementId: z.string().optional(),
  coordinates: z
    .object({ x: z.number(), y: z.number() })
    .optional(),
  description: z.string(),
});

export const NavigateActionSchema = z.object({
  type: z.literal("navigate"),
  url: z.string().url(),
  description: z.string(),
});

export const WaitActionSchema = z.object({
  type: z.literal("wait"),
  ms: z.number().max(10000),
  description: z.string(),
});

export const SelectActionSchema = z.object({
  type: z.literal("select"),
  elementId: z.string(),
  value: z.string(),
  description: z.string(),
});

export const ExtractActionSchema = z.object({
  type: z.literal("extract"),
  selector: z.string().optional(),
  description: z.string(),
});

export const CompleteActionSchema = z.object({
  type: z.literal("complete"),
  result: z.string(),
  data: z.record(z.unknown()).optional(),
});

export const BacktrackActionSchema = z.object({
  type: z.literal("backtrack"),
  reason: z.string(),
  stepsBack: z.number().default(1),
});

export const ClickTextActionSchema = z.object({
  type: z.literal("click_text"),
  text: z.string(),
  exact: z.boolean().default(false),
  description: z.string(),
});

export const TripleClickActionSchema = z.object({
  type: z.literal("triple_click"),
  elementId: z.string().optional(),
  coordinates: z.object({ x: z.number(), y: z.number() }).optional(),
  description: z.string(),
});

export const KeyPressActionSchema = z.object({
  type: z.literal("key_press"),
  key: z.string(),
  description: z.string(),
});

export const RequireHumanActionSchema = z.object({
  type: z.literal("require_human"),
  reason: z.string(),
  screenshotContext: z.string().optional(),
});

export const AgentActionSchema = z.discriminatedUnion("type", [
  ClickActionSchema,
  TypeActionSchema,
  ScrollActionSchema,
  HoverActionSchema,
  NavigateActionSchema,
  WaitActionSchema,
  SelectActionSchema,
  ExtractActionSchema,
  CompleteActionSchema,
  BacktrackActionSchema,
  ClickTextActionSchema,
  TripleClickActionSchema,
  KeyPressActionSchema,
  RequireHumanActionSchema,
]);

export type AgentAction = z.infer<typeof AgentActionSchema>;
export type ClickAction = z.infer<typeof ClickActionSchema>;
export type TypeAction = z.infer<typeof TypeActionSchema>;

// ─── LLM Response ─────────────────────────────────────────────────────────────

export const LLMResponseSchema = z.object({
  thought: z.string(),
  observation: z.string(),
  action: AgentActionSchema,
  confidence: z.number().min(0).max(1).default(0.8),
});

export type LLMResponse = z.infer<typeof LLMResponseSchema>;

// ─── Agent Step (Trace entry) ─────────────────────────────────────────────────

export interface AgentStep {
  stepNumber: number;
  timestamp: string;
  screenshot: string; // base64
  accessibilityTree: AccessibilityNode[];
  url: string;
  llmThought: string;
  llmObservation: string;
  action: AgentAction;
  actionResult: ActionResult;
  durationMs: number;
}

export interface ActionResult {
  success: boolean;
  error?: string;
  extractedData?: unknown;
  newUrl?: string;
  newScreenshot?: string;
}

// ─── Trace File ───────────────────────────────────────────────────────────────

export interface AgentTrace {
  id: string;
  goal: string;
  startedAt: string;
  completedAt?: string;
  status: "running" | "completed" | "failed" | "paused";
  steps: AgentStep[];
  finalResult?: string;
  totalTokensUsed?: number;
}

// ─── Agent Context (passed to Skills) ────────────────────────────────────────

export interface AgentContext {
  goal: string;
  sessionId: string;
  currentUrl: string;
  currentScreenshot: string;
  currentAccessibilityTree: AccessibilityNode[];
  stepHistory: AgentStep[];
  customData: Record<string, unknown>;
  emit: (event: AgentEvent) => void;
}

// ─── Events (Socket.io) ───────────────────────────────────────────────────────

export type AgentEventType =
  | "agent:start"
  | "agent:step"
  | "agent:thought"
  | "agent:action"
  | "agent:screenshot"
  | "agent:complete"
  | "agent:error"
  | "agent:paused"
  | "agent:backtrack"
  | "agent:require_human"
  | "agent:human_response"
  | "agent:skill_start"
  | "agent:skill_complete"
  | "payment:gate_triggered"
  | "payment:approved"
  | "payment:rejected";

export interface AgentEvent {
  type: AgentEventType;
  sessionId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ─── Human-in-the-Loop ────────────────────────────────────────────────────────

export interface HumanApprovalRequest {
  sessionId: string;
  reason: string;
  screenshot: string;
  pageTitle: string;
  pageUrl: string;
  actionDescription?: string;
  resolvePromise?: (approved: boolean, userInput?: string) => void;
}

// ─── Skill types ──────────────────────────────────────────────────────────────

export interface SkillMetadata {
  name: string;
  description: string;
  version: string;
  author?: string;
  triggers?: string[];
  category?: string;
  icon?: string;
}

export interface SkillExecuteOptions {
  context: AgentContext;
  params?: Record<string, unknown>;
}
