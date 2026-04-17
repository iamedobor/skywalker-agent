"use client";

import { Wifi, WifiOff, Zap, GitBranch, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusBarProps {
  connected: boolean;
  status: "idle" | "running" | "paused" | "complete" | "error";
  stepCount: number;
  sessionId: string | null;
}

export function StatusBar({ connected, status, stepCount, sessionId }: StatusBarProps) {
  return (
    <div className="flex items-center gap-4 px-4 py-1.5 bg-void-950 border-t border-panel-border text-[11px] font-mono">
      {/* Brand */}
      <div className="flex items-center gap-1.5">
        <Zap className="w-3 h-3 text-neon-cyan" />
        <span className="text-neon-cyan font-bold tracking-wider">SKYWALKER</span>
        <span className="text-slate-700">v0.1.0</span>
      </div>

      <div className="h-3 w-px bg-panel-border" />

      {/* Connection */}
      <div className="flex items-center gap-1.5">
        {connected ? (
          <>
            <Wifi className="w-3 h-3 text-neon-green" />
            <span className="text-neon-green">Connected</span>
          </>
        ) : (
          <>
            <WifiOff className="w-3 h-3 text-neon-red" />
            <span className="text-neon-red">Disconnected</span>
          </>
        )}
      </div>

      <div className="h-3 w-px bg-panel-border" />

      {/* Status */}
      <div className="flex items-center gap-1.5">
        <div
          className={cn("status-dot", {
            running: status === "running",
            idle: status === "idle" || status === "complete",
            error: status === "error",
            paused: status === "paused",
          })}
        />
        <span
          className={cn({
            "text-neon-cyan": status === "running",
            "text-slate-500": status === "idle",
            "text-neon-green": status === "complete",
            "text-neon-red": status === "error",
            "text-neon-yellow": status === "paused",
          })}
        >
          {status.toUpperCase()}
        </span>
      </div>

      {stepCount > 0 && (
        <>
          <div className="h-3 w-px bg-panel-border" />
          <div className="flex items-center gap-1.5 text-slate-500">
            <Terminal className="w-3 h-3" />
            <span>{stepCount} steps</span>
          </div>
        </>
      )}

      {sessionId && (
        <>
          <div className="h-3 w-px bg-panel-border" />
          <div className="flex items-center gap-1.5 text-slate-700">
            <GitBranch className="w-3 h-3" />
            <span title={sessionId}>{sessionId.slice(0, 8)}</span>
          </div>
        </>
      )}

      <div className="ml-auto text-slate-700">
        Playwright · TypeScript · Next.js 15
      </div>
    </div>
  );
}
