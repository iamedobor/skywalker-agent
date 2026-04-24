"use client";

import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  MousePointerClick,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  User,
  Terminal,
  ChevronRight,
} from "lucide-react";
import { cn, formatTimestamp } from "@/lib/utils";
import type { ThinkingLogEntry } from "@/hooks/useAgent";

interface ThinkingLogProps {
  entries: ThinkingLogEntry[];
  goal: string;
  status: "idle" | "running" | "paused" | "complete" | "error";
}

const ENTRY_CONFIG = {
  thought: {
    icon: Brain,
    color: "text-neon-blue",
    bg: "bg-neon-blue/5",
    border: "border-neon-blue/20",
    prefix: "THINK",
  },
  action: {
    icon: MousePointerClick,
    color: "text-neon-cyan",
    bg: "bg-neon-cyan/5",
    border: "border-neon-cyan/20",
    prefix: "DO",
  },
  screenshot: {
    icon: Terminal,
    color: "text-slate-500",
    bg: "bg-transparent",
    border: "border-transparent",
    prefix: "SEE",
  },
  backtrack: {
    icon: RotateCcw,
    color: "text-neon-yellow",
    bg: "bg-neon-yellow/5",
    border: "border-neon-yellow/20",
    prefix: "BACK",
  },
  complete: {
    icon: CheckCircle2,
    color: "text-neon-green",
    bg: "bg-neon-green/5",
    border: "border-neon-green/20",
    prefix: "DONE",
  },
  error: {
    icon: AlertTriangle,
    color: "text-neon-red",
    bg: "bg-neon-red/5",
    border: "border-neon-red/20",
    prefix: "ERR",
  },
  system: {
    icon: Terminal,
    color: "text-slate-500",
    bg: "bg-transparent",
    border: "border-transparent",
    prefix: "SYS",
  },
  human: {
    icon: User,
    color: "text-neon-purple",
    bg: "bg-neon-purple/5",
    border: "border-neon-purple/20",
    prefix: "YOU",
  },
};

export function ThinkingLog({ entries, goal, status }: ThinkingLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottomRef = useRef(true);

  // Only auto-scroll when the user is already near the bottom. If they've
  // scrolled up to read an earlier entry, don't yank them back down.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickToBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [entries, status]);

  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickToBottomRef.current = distanceFromBottom < 80;
  };

  return (
    <div className="flex flex-col h-full glass-panel overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-panel-border">
        <Terminal className="w-4 h-4 text-neon-cyan" />
        <span className="text-xs font-mono text-neon-cyan font-medium tracking-wider">
          THINKING LOG
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <div
            className={cn("status-dot", {
              running: status === "running",
              idle: status === "idle",
              error: status === "error",
              paused: status === "paused",
            })}
          />
          <span className="text-xs font-mono text-slate-500 uppercase">
            {status}
          </span>
        </div>
      </div>

      {/* Goal display */}
      {goal && (
        <div className="px-4 py-2 border-b border-panel-border bg-void-950/30">
          <div className="flex items-start gap-2">
            <ChevronRight className="w-3.5 h-3.5 text-neon-cyan mt-0.5 flex-shrink-0" />
            <p className="text-xs font-mono text-slate-400 leading-relaxed">
              <span className="text-neon-cyan">GOAL:</span> {goal}
            </p>
          </div>
        </div>
      )}

      {/* Log entries */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono"
      >
        {entries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <Terminal className="w-10 h-10 text-slate-700" />
            <p className="text-xs text-slate-600">
              Agent thoughts will appear here...
            </p>
            <p className="text-xs text-slate-700">
              Start by typing a goal above
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {entries.map((entry) => (
              <LogEntry key={entry.id} entry={entry} />
            ))}
          </AnimatePresence>
        )}

        {/* Blinking cursor when running */}
        {status === "running" && (
          <div className="flex items-center gap-2 text-xs text-slate-600 px-1">
            <span className="text-neon-cyan animate-blink">▊</span>
            <span>Processing...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function LogEntry({ entry }: { entry: ThinkingLogEntry }) {
  const config = ENTRY_CONFIG[entry.type] ?? ENTRY_CONFIG.system;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={cn(
        "flex items-start gap-2.5 px-2.5 py-2 rounded-lg border text-xs",
        config.bg,
        config.border
      )}
    >
      <Icon className={cn("w-3.5 h-3.5 mt-0.5 flex-shrink-0", config.color)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className={cn("font-bold text-[10px] tracking-widest", config.color)}>
            {config.prefix}
          </span>
          {entry.step !== undefined && (
            <span className="text-[10px] text-slate-600">
              step {entry.step}
            </span>
          )}
          <span className="text-[10px] text-slate-700 ml-auto">
            {formatTimestamp(entry.timestamp)}
          </span>
          {entry.confidence !== undefined && (
            <span
              className={cn(
                "text-[10px] font-mono",
                entry.confidence > 0.7
                  ? "text-neon-green"
                  : entry.confidence > 0.4
                    ? "text-neon-yellow"
                    : "text-neon-red"
              )}
            >
              {Math.round(entry.confidence * 100)}%
            </span>
          )}
        </div>
        <p className="text-slate-300 leading-relaxed break-words">
          {entry.content}
        </p>
        {entry.detail && entry.detail !== entry.content && (
          <p className="text-slate-600 text-[10px] mt-1 leading-relaxed line-clamp-3">
            {entry.detail}
          </p>
        )}
      </div>
    </motion.div>
  );
}
