"use client";

import { useCallback, useEffect, useReducer, useRef } from "react";

let _idCounter = 0;
const uid = (prefix: string) => `${prefix}-${++_idCounter}-${Date.now()}`;
import { getSocket } from "@/lib/socket";
import { startAgent, stopAgent, approveAction } from "@/lib/socket";

export interface ThinkingLogEntry {
  id: string;
  timestamp: string;
  type:
    | "thought"
    | "action"
    | "screenshot"
    | "complete"
    | "error"
    | "backtrack"
    | "system"
    | "human";
  step?: number;
  content: string;
  detail?: string;
  confidence?: number;
}

export interface AgentState {
  status: "idle" | "running" | "paused" | "complete" | "error";
  sessionId: string | null;
  currentScreenshot: string | null;
  currentUrl: string;
  currentStep: number;
  goal: string;
  log: ThinkingLogEntry[];
  pendingApproval: PendingApproval | null;
  finalResult: string | null;
  error: string | null;
  lastClickPos: { x: number; y: number } | null;
  lastActionType: string | null;
}

export interface PendingApproval {
  sessionId: string;
  reason: string;
  screenshot: string;
  pageTitle: string;
  pageUrl: string;
}

type AgentAction =
  | { type: "START"; goal: string; sessionId: string }
  | { type: "SCREENSHOT"; screenshot: string; url: string; step: number }
  | { type: "THOUGHT"; entry: ThinkingLogEntry }
  | { type: "ACTION_CLICK"; x: number; y: number; actionType: string }
  | { type: "COMPLETE"; result: string }
  | { type: "ERROR"; error: string }
  | { type: "BACKTRACK"; step: number; reason: string }
  | { type: "REQUIRE_HUMAN"; approval: PendingApproval }
  | { type: "APPROVAL_RESOLVED" }
  | { type: "STOP" }
  | { type: "RESET" };

const initialState: AgentState = {
  status: "idle",
  sessionId: null,
  currentScreenshot: null,
  currentUrl: "",
  currentStep: 0,
  goal: "",
  log: [],
  pendingApproval: null,
  finalResult: null,
  error: null,
  lastClickPos: null,
  lastActionType: null,
};

function agentReducer(state: AgentState, action: AgentAction): AgentState {
  switch (action.type) {
    case "START":
      return {
        ...initialState,
        status: "running",
        sessionId: action.sessionId,
        goal: action.goal,
      };

    case "SCREENSHOT":
      return {
        ...state,
        currentScreenshot: action.screenshot,
        currentUrl: action.url,
        currentStep: action.step,
      };

    case "ACTION_CLICK":
      return {
        ...state,
        lastClickPos: { x: action.x, y: action.y },
        lastActionType: action.actionType,
      };

    case "THOUGHT":
      return {
        ...state,
        log: [...state.log, action.entry],
      };

    case "COMPLETE":
      return {
        ...state,
        status: "complete",
        finalResult: action.result,
      };

    case "ERROR":
      return {
        ...state,
        status: "error",
        error: action.error,
      };

    case "BACKTRACK":
      return {
        ...state,
        log: [
          ...state.log,
          {
            id: uid("backtrack"),
            timestamp: new Date().toISOString(),
            type: "backtrack",
            step: action.step,
            content: `Backtracking: ${action.reason}`,
          },
        ],
      };

    case "REQUIRE_HUMAN":
      return {
        ...state,
        status: "paused",
        pendingApproval: action.approval,
      };

    case "APPROVAL_RESOLVED":
      return {
        ...state,
        status: "running",
        pendingApproval: null,
      };

    case "STOP":
      return { ...state, status: "idle", sessionId: null };

    case "RESET":
      return initialState;

    default:
      return state;
  }
}

export function useAgent() {
  const [state, dispatch] = useReducer(agentReducer, initialState);
  const currentSessionRef = useRef<string | null>(null);

  useEffect(() => {
    const socket = getSocket();

    const handleStart = (event: { sessionId: string; data: { goal: string } }) => {
      currentSessionRef.current = event.sessionId;
    };

    const handleScreenshot = (event: {
      sessionId: string;
      data: { screenshot: string; url: string; step: number };
    }) => {
      if (event.sessionId !== currentSessionRef.current) return;
      dispatch({
        type: "SCREENSHOT",
        screenshot: event.data.screenshot,
        url: event.data.url,
        step: event.data.step,
      });
    };

    const handleAction = (event: {
      sessionId: string;
      data: {
        step?: number;
        action?: {
          type: string;
          coordinates?: { x: number; y: number };
          clickX?: number; clickY?: number;
        };
      };
    }) => {
      if (event.sessionId !== currentSessionRef.current) return;
      const coords = event.data.action?.coordinates;
      if (coords) {
        dispatch({ type: "ACTION_CLICK", x: coords.x, y: coords.y, actionType: event.data.action?.type ?? "click" });
      }
    };

    const handleThought = (event: {
      sessionId: string;
      data: {
        step?: number;
        thought?: string;
        observation?: string;
        action?: { type: string; description?: string; coordinates?: { x: number; y: number } };
        confidence?: number;
        status?: string;
      };
    }) => {
      if (event.sessionId !== currentSessionRef.current) return;

      if (event.data.status === "thinking") {
        dispatch({
          type: "THOUGHT",
          entry: {
            id: uid("think"),
            timestamp: new Date().toISOString(),
            type: "thought",
            step: event.data.step,
            content: `Step ${event.data.step ?? "?"} — Analyzing page...`,
          },
        });
        return;
      }

      if (event.data.thought) {
        dispatch({
          type: "THOUGHT",
          entry: {
            id: uid("thought"),
            timestamp: new Date().toISOString(),
            type: "thought",
            step: event.data.step,
            content: event.data.observation ?? event.data.thought,
            detail: event.data.thought,
            confidence: event.data.confidence,
          },
        });
      }

      if (event.data.action) {
        dispatch({
          type: "THOUGHT",
          entry: {
            id: uid("action"),
            timestamp: new Date().toISOString(),
            type: "action",
            step: event.data.step,
            content: `${event.data.action.type.toUpperCase()}: ${event.data.action.description ?? ""}`,
          },
        });
      }
    };

    const handleComplete = (event: {
      sessionId: string;
      data: { result: string };
    }) => {
      if (event.sessionId !== currentSessionRef.current) return;
      currentSessionRef.current = null; // allow follow-up runs
      dispatch({ type: "COMPLETE", result: event.data.result });
    };

    const handleError = (event: { sessionId: string; data: { error: string } }) => {
      if (event.sessionId !== currentSessionRef.current) return;
      currentSessionRef.current = null; // allow retry
      dispatch({ type: "ERROR", error: event.data.error });
    };

    const handleBacktrack = (event: {
      sessionId: string;
      data: { step: number; reason: string };
    }) => {
      if (event.sessionId !== currentSessionRef.current) return;
      dispatch({
        type: "BACKTRACK",
        step: event.data.step,
        reason: event.data.reason,
      });
    };

    const handleRequireHuman = (event: {
      sessionId: string;
      data: PendingApproval;
    }) => {
      if (event.sessionId !== currentSessionRef.current) return;
      dispatch({
        type: "REQUIRE_HUMAN",
        approval: { ...event.data, sessionId: event.sessionId },
      });
    };

    const handlePaymentGate = (event: {
      sessionId: string;
      data: PendingApproval & { message: string };
    }) => {
      if (event.sessionId !== currentSessionRef.current) return;
      dispatch({
        type: "REQUIRE_HUMAN",
        approval: {
          sessionId: event.sessionId,
          reason: event.data.message,
          screenshot: event.data.screenshot,
          pageTitle: event.data.pageTitle,
          pageUrl: event.data.pageUrl,
        },
      });
    };

    socket.on("agent:start", handleStart);
    socket.on("agent:screenshot", handleScreenshot);
    socket.on("agent:action", handleAction);
    socket.on("agent:thought", handleThought);
    socket.on("agent:complete", handleComplete);
    socket.on("agent:error", handleError);
    socket.on("agent:backtrack", handleBacktrack);
    socket.on("agent:require_human", handleRequireHuman);
    socket.on("payment:gate_triggered", handlePaymentGate);

    return () => {
      socket.off("agent:start", handleStart);
      socket.off("agent:screenshot", handleScreenshot);
      socket.off("agent:action", handleAction);
      socket.off("agent:thought", handleThought);
      socket.off("agent:complete", handleComplete);
      socket.off("agent:error", handleError);
      socket.off("agent:backtrack", handleBacktrack);
      socket.off("agent:require_human", handleRequireHuman);
      socket.off("payment:gate_triggered", handlePaymentGate);
    };
  }, []);

  const run = useCallback(async (goal: string, options?: { startUrl?: string; skillName?: string; params?: Record<string, unknown> }) => {
    if (currentSessionRef.current) return; // prevent double-launch
    try {
      const { sessionId } = await startAgent({ goal, ...options });
      currentSessionRef.current = sessionId;
      dispatch({ type: "START", goal, sessionId });

      const socket = getSocket();
      socket.emit("subscribe", sessionId);
    } catch (err) {
      dispatch({
        type: "ERROR",
        error: err instanceof Error ? err.message : "Failed to start agent",
      });
    }
  }, []);

  const stop = useCallback(async () => {
    if (state.sessionId) {
      await stopAgent(state.sessionId);
      dispatch({ type: "STOP" });
    }
  }, [state.sessionId]);

  const approve = useCallback(
    async (approved: boolean, userInput?: string) => {
      if (state.sessionId) {
        await approveAction(state.sessionId, approved, userInput);
        dispatch({ type: "APPROVAL_RESOLVED" });
      }
    },
    [state.sessionId]
  );

  const reset = useCallback(() => {
    currentSessionRef.current = null;
    dispatch({ type: "RESET" });
  }, []);

  return { state, run, stop, approve, reset };
}
