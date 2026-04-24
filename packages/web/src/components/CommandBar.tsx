"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Globe, BookOpen, Plane, Briefcase, Search, ArrowRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

function nextFriday(): string {
  const d = new Date();
  const days = (5 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

interface ExampleGoal {
  icon: React.ReactNode;
  text: string;
  skill?: { name: string; params: Record<string, unknown> };
}

// Pre-canned demos. The three skill-backed ones use deep-link URL shortcuts
// (~1 step). The two free-form ones are pure-vision reads (Bitcoin, HN) —
// exactly the shape vision LLMs excel at.
function buildExamples(): ExampleGoal[] {
  return [
    {
      icon: <Plane className="w-4 h-4" />,
      text: "Find the cheapest flight from NYC to London next Friday",
      skill: {
        name: "flight-search",
        params: { origin: "NYC", destination: "London", departDate: nextFriday(), adults: 1 },
      },
    },
    {
      icon: <Search className="w-4 h-4" />,
      text: "Research the latest AI safety papers on arxiv",
      skill: {
        name: "research",
        params: { topic: "latest AI safety papers on arxiv 2026", depth: "standard" },
      },
    },
    {
      icon: <Briefcase className="w-4 h-4" />,
      text: "Find senior engineers at Stripe on LinkedIn",
      skill: {
        name: "linkedin",
        params: { task: "search-profiles", query: "senior engineers at Stripe", maxResults: 10 },
      },
    },
    { icon: <Globe className="w-4 h-4" />, text: "What's the current Bitcoin price and 24h change?" },
    { icon: <BookOpen className="w-4 h-4" />, text: "Summarize today's top stories on Hacker News" },
  ];
}

interface CommandBarProps {
  onSubmit: (goal: string) => void;
  onRunSkill?: (skillName: string, params: Record<string, unknown>) => void;
  onClose?: () => void;
  isRunning?: boolean;
  open: boolean;
}

export function CommandBar({ onSubmit, onRunSkill, onClose, isRunning, open }: CommandBarProps) {
  const examples = buildExamples();
  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape" && open) {
        onClose?.();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  const handleSubmit = useCallback(
    (goal: string) => {
      if (!goal.trim() || isRunning) return;
      onSubmit(goal.trim());
      setValue("");
    },
    [onSubmit, isRunning]
  );

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -10, scale: 0.97 }}
        transition={{ duration: 0.2, ease: "easeOut" }}
        className="w-full"
      >
        {/* Main input */}
        <div
          className={cn(
            "relative flex items-center gap-3 px-4 py-3 rounded-xl border transition-all duration-200",
            "bg-panel/90 backdrop-blur-md",
            focused
              ? "border-neon-cyan/40 shadow-neon"
              : "border-panel-border"
          )}
        >
          <Zap
            className={cn(
              "w-5 h-5 flex-shrink-0 transition-colors",
              focused ? "text-neon-cyan" : "text-slate-500"
            )}
          />

          <input
            ref={inputRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit(value);
            }}
            placeholder="Tell SkyWalker what to do... (e.g. 'Book a table for 2 in Soho')"
            disabled={isRunning}
            className={cn(
              "flex-1 bg-transparent text-sm font-mono outline-none placeholder:text-slate-600",
              "text-slate-100 disabled:opacity-40"
            )}
          />

          <div className="flex items-center gap-2">
            {value && (
              <button
                onClick={() => setValue("")}
                className="text-slate-600 hover:text-slate-400 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => handleSubmit(value)}
              disabled={!value.trim() || isRunning}
              className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium",
                "transition-all duration-200",
                value.trim() && !isRunning
                  ? "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20"
                  : "bg-panel-border/50 text-slate-600 cursor-not-allowed"
              )}
            >
              <span>{isRunning ? "Running..." : "Launch"}</span>
              <ArrowRight className="w-3 h-3" />
            </button>
          </div>

          {/* Keyboard hint */}
          <div className="absolute right-3 bottom-1 flex items-center gap-1 opacity-30">
            <kbd className="text-[9px] font-mono bg-panel-border px-1 rounded">⌘</kbd>
            <kbd className="text-[9px] font-mono bg-panel-border px-1 rounded">K</kbd>
          </div>
        </div>

        {/* Suggestions */}
        {!isRunning && !value && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 flex flex-col gap-0.5"
          >
            {examples.map((eg, i) => (
              <button
                key={i}
                onClick={() => {
                  if (eg.skill && onRunSkill) {
                    onRunSkill(eg.skill.name, eg.skill.params);
                  } else {
                    handleSubmit(eg.text);
                  }
                }}
                className={cn(
                  "flex items-center gap-3 px-4 py-2.5 rounded-lg text-left",
                  "text-xs text-slate-500 hover:text-slate-300",
                  "hover:bg-panel/60 transition-colors duration-150",
                  "group"
                )}
              >
                <span className="text-slate-600 group-hover:text-neon-cyan transition-colors">
                  {eg.icon}
                </span>
                <span className="font-mono flex-1">{eg.text}</span>
                {eg.skill && (
                  <span className="text-[9px] font-mono text-neon-cyan/70 border border-neon-cyan/30 px-1.5 py-0.5 rounded">
                    {eg.skill.name}
                  </span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}
