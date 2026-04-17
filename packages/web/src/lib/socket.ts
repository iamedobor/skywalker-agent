import { io, type Socket } from "socket.io-client";

const AGENT_URL =
  process.env.NEXT_PUBLIC_AGENT_URL ?? "http://localhost:3001";

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(AGENT_URL, {
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });
  }
  return socket;
}

export function disconnectSocket(): void {
  socket?.disconnect();
  socket = null;
}

// ─── API helpers ──────────────────────────────────────────────────────────────

export async function startAgent(payload: {
  goal: string;
  startUrl?: string;
  skillName?: string;
  params?: Record<string, unknown>;
}): Promise<{ sessionId: string; status: string }> {
  const res = await fetch(`${AGENT_URL}/api/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error: string };
    throw new Error(err.error ?? "Failed to start agent");
  }
  return res.json() as Promise<{ sessionId: string; status: string }>;
}

export async function stopAgent(sessionId: string): Promise<void> {
  await fetch(`${AGENT_URL}/api/stop/${sessionId}`, { method: "POST" });
}

export async function approveAction(
  sessionId: string,
  approved: boolean,
  userInput?: string
): Promise<void> {
  await fetch(`${AGENT_URL}/api/approve/${sessionId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ approved, userInput }),
  });
}

export async function fetchSkills(): Promise<SkillInfo[]> {
  const res = await fetch(`${AGENT_URL}/api/skills`);
  return res.json() as Promise<SkillInfo[]>;
}

export async function fetchTraces(): Promise<TraceInfo[]> {
  const res = await fetch(`${AGENT_URL}/api/traces`);
  return res.json() as Promise<TraceInfo[]>;
}

export interface SkillInfo {
  name: string;
  description: string;
  version: string;
  author?: string;
  triggers: string[];
  category: string;
  icon: string;
  paramsSchema?: Record<string, unknown> | null;
}

export interface TraceInfo {
  id: string;
  goal: string;
  status: "running" | "completed" | "failed" | "paused";
  startedAt: string;
  completedAt?: string;
  stepsCount: number;
  finalResult?: string;
}
