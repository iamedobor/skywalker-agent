"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  Layers,
  History,
  Settings,
  Plus,
  ChevronRight,
  Square,
  RotateCcw,
  BookOpen,
  Star,
  Github,
} from "lucide-react";
import { CommandBar } from "@/components/CommandBar";
import { BrowserPreview } from "@/components/BrowserPreview";
import { ThinkingLog } from "@/components/ThinkingLog";
import { ApprovalModal } from "@/components/ApprovalModal";
import { SkillGrid } from "@/components/SkillCard";
import { StatusBar } from "@/components/StatusBar";
import { useAgent } from "@/hooks/useAgent";
import { useSocket } from "@/hooks/useSocket";
import { fetchSkills, fetchTraces, type SkillInfo, type TraceInfo } from "@/lib/socket";
import { cn, truncate } from "@/lib/utils";

type SidebarTab = "skills" | "history";

export default function DashboardPage() {
  const { state, run, stop, approve, reset } = useAgent();
  const { connected } = useSocket();

  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("skills");
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [traces, setTraces] = useState<TraceInfo[]>([]);
  const [commandOpen, setCommandOpen] = useState(true);

  useEffect(() => {
    fetchSkills()
      .then(setSkills)
      .catch(() => {});
    fetchTraces()
      .then(setTraces)
      .catch(() => {});
  }, [state.status]);

  const handleGoal = useCallback(
    async (goal: string, options?: { startUrl?: string }) => {
      setCommandOpen(false);
      await run(goal, options);
    },
    [run]
  );

  const handleSkillSelect = useCallback(
    (skill: SkillInfo) => {
      handleGoal(`Use the ${skill.name} skill: ${skill.triggers[0] ?? skill.description}`);
    },
    [handleGoal]
  );

  const handleStop = useCallback(async () => {
    await stop();
  }, [stop]);

  const handleReset = useCallback(() => {
    reset();
    setCommandOpen(true);
  }, [reset]);

  const isActive =
    state.status === "running" || state.status === "paused";

  return (
    <div className="flex flex-col h-screen bg-void-950 overflow-hidden">
      {/* ── Top bar ──────────────────────────────────────────────────────────── */}
      <header className="flex items-center gap-4 px-4 py-2.5 border-b border-panel-border bg-void-950/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Zap className="w-6 h-6 text-neon-cyan" />
            <div className="absolute inset-0 blur-md bg-neon-cyan/30 rounded-full" />
          </div>
          <span className="font-bold text-slate-100 tracking-tight text-lg">
            Sky<span className="text-neon-cyan">Walker</span>
          </span>
          <span className="text-[10px] font-mono text-slate-600 border border-panel-border px-1.5 py-0.5 rounded">
            beta
          </span>
        </div>

        {/* Goal pill */}
        {state.goal && !commandOpen && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2 px-3 py-1 bg-panel/80 rounded-lg border border-panel-border text-xs font-mono text-slate-400 max-w-sm"
          >
            <ChevronRight className="w-3 h-3 text-neon-cyan flex-shrink-0" />
            <span className="truncate">{truncate(state.goal, 60)}</span>
          </motion.div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Action buttons */}
          <AnimatePresence mode="wait">
            {isActive ? (
              <motion.button
                key="stop"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={handleStop}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-neon-red border border-neon-red/30 bg-neon-red/5 hover:bg-neon-red/10 transition-colors"
              >
                <Square className="w-3 h-3" />
                Stop
              </motion.button>
            ) : state.status !== "idle" ? (
              <motion.button
                key="reset"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 border border-panel-border hover:border-neon-cyan/30 hover:text-neon-cyan transition-colors"
              >
                <RotateCcw className="w-3 h-3" />
                New Task
              </motion.button>
            ) : null}
          </AnimatePresence>

          <button
            onClick={() => setCommandOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 border border-panel-border hover:border-neon-cyan/30 hover:text-neon-cyan transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Goal</span>
            <kbd className="text-[9px] bg-panel-border px-1 rounded opacity-60">⌘K</kbd>
          </button>

          <a
            href="https://github.com/skywalker-agent/skywalker"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono text-slate-400 border border-panel-border hover:border-neon-cyan/30 hover:text-neon-cyan transition-colors"
          >
            <Github className="w-3.5 h-3.5" />
            <span className="hidden sm:block">Star</span>
            <Star className="w-3 h-3 opacity-60" />
          </a>
        </div>
      </header>

      {/* ── Command bar ──────────────────────────────────────────────────────── */}
      <AnimatePresence>
        {commandOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-b border-panel-border overflow-hidden"
          >
            <div className="p-4">
              <CommandBar
                open={commandOpen}
                onSubmit={handleGoal}
                onClose={() => setCommandOpen(false)}
                isRunning={state.status === "running"}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main layout ──────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {/* Left sidebar */}
        <aside className="w-64 flex-shrink-0 border-r border-panel-border flex flex-col bg-void-950/50">
          {/* Sidebar tabs */}
          <div className="flex border-b border-panel-border">
            {(["skills", "history"] as SidebarTab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setSidebarTab(tab)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-mono transition-colors",
                  sidebarTab === tab
                    ? "text-neon-cyan border-b-2 border-neon-cyan -mb-px"
                    : "text-slate-500 hover:text-slate-300"
                )}
              >
                {tab === "skills" ? (
                  <Layers className="w-3.5 h-3.5" />
                ) : (
                  <History className="w-3.5 h-3.5" />
                )}
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3">
            {sidebarTab === "skills" ? (
              <>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                    Installed Skills
                  </span>
                  <span className="text-[10px] font-mono text-slate-700">
                    ({skills.length})
                  </span>
                </div>

                {skills.length > 0 ? (
                  <SkillGrid skills={skills} onSelect={handleSkillSelect} />
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <Layers className="w-8 h-8 text-slate-700" />
                    <p className="text-xs text-slate-600 font-mono">
                      No skills loaded.
                      <br />
                      Start the agent server first.
                    </p>
                  </div>
                )}

                {/* Contribute CTA */}
                <div className="mt-4 p-3 rounded-xl border border-panel-border bg-neon-cyan/5">
                  <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                    <span className="text-neon-cyan">Want to add a skill?</span>
                    <br />
                    Drop a file in{" "}
                    <code className="text-slate-400">/skills</code> and it
                    auto-loads. 🚀
                  </p>
                  <a
                    href="https://github.com/skywalker-agent/skywalker/blob/main/CONTRIBUTING.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 mt-2 text-[10px] font-mono text-neon-cyan hover:underline"
                  >
                    <BookOpen className="w-3 h-3" />
                    Contributor Guide
                  </a>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                    Recent Traces
                  </span>
                </div>

                {traces.length > 0 ? (
                  <div className="space-y-1.5">
                    {traces
                      .sort(
                        (a, b) =>
                          new Date(b.startedAt).getTime() -
                          new Date(a.startedAt).getTime()
                      )
                      .slice(0, 20)
                      .map((trace) => (
                        <TraceItem key={trace.id} trace={trace} />
                      ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
                    <History className="w-8 h-8 text-slate-700" />
                    <p className="text-xs text-slate-600 font-mono">
                      No traces yet.
                      <br />
                      Completed runs are saved here.
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </aside>

        {/* Center: Browser preview */}
        <main className="flex-1 flex flex-col min-w-0 p-3 gap-3">
          {/* Complete result banner */}
          <AnimatePresence>
            {state.status === "complete" && state.finalResult && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-shrink-0 glass-panel p-4 border-neon-green/20"
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-neon-green mt-1.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-xs font-mono text-neon-green mb-1">TASK COMPLETE</p>
                    <p className="text-sm text-slate-300 leading-relaxed mb-3">
                      {state.finalResult}
                    </p>
                    <FollowUpBar
                      previousResult={state.finalResult}
                      previousGoal={state.goal}
                      lastUrl={state.currentUrl}
                      onSubmit={handleGoal}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {state.status === "error" && state.error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex-shrink-0 glass-panel p-4 border-neon-red/20"
              >
                <div className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-neon-red mt-1.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-mono text-neon-red mb-1">ERROR</p>
                    <p className="text-sm text-slate-300">{state.error}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Browser */}
          <div className="flex-1 min-h-0">
            <BrowserPreview
              screenshot={state.currentScreenshot}
              url={state.currentUrl}
              status={state.status}
              step={state.currentStep}
              lastClickPos={state.lastClickPos}
              lastActionType={state.lastActionType}
            />
          </div>
        </main>

        {/* Right panel: Thinking Log */}
        <aside className="w-96 flex-shrink-0 border-l border-panel-border flex flex-col p-3">
          <div className="flex-1 min-h-0">
            <ThinkingLog
              entries={state.log}
              goal={state.goal}
              status={state.status}
            />
          </div>
        </aside>
      </div>

      {/* ── Status bar ───────────────────────────────────────────────────────── */}
      <StatusBar
        connected={connected}
        status={state.status}
        stepCount={state.currentStep}
        sessionId={state.sessionId}
      />

      {/* ── Approval modal (overlays everything) ─────────────────────────────── */}
      <ApprovalModal
        approval={state.pendingApproval}
        onApprove={(input) => approve(true, input)}
        onReject={() => approve(false)}
      />
    </div>
  );
}

function FollowUpBar({
  previousResult,
  previousGoal,
  lastUrl,
  onSubmit,
}: {
  previousResult: string;
  previousGoal: string;
  lastUrl?: string;
  onSubmit: (goal: string, options?: { startUrl?: string }) => void;
}) {
  const [value, setValue] = useState("");

  const suggestions = [
    "Book the cheapest option",
    "Find a faster alternative",
    "Show me business class options",
    "Try a different date",
  ];

  const submit = (text: string) => {
    if (!text.trim()) return;
    const contextualGoal = `Previous task: "${previousGoal}"\nPrevious result: "${previousResult}"\n\nFollow-up task: ${text}`;
    // Resume from the same page so the agent doesn't re-search from scratch
    const startUrl = lastUrl && lastUrl !== "about:blank" ? lastUrl : undefined;
    onSubmit(contextualGoal, { startUrl });
    setValue("");
  };

  return (
    <div className="border-t border-panel-border pt-3">
      <p className="text-xs font-mono text-slate-500 mb-2">Follow up:</p>
      <div className="flex gap-2 mb-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(value)}
          placeholder='e.g. "Book the cheapest one" or "Find alternatives"'
          className="flex-1 px-3 py-1.5 bg-void-950 border border-panel-border rounded-lg text-xs font-mono text-slate-300 placeholder:text-slate-600 outline-none focus:border-neon-cyan/40"
        />
        <button
          onClick={() => submit(value)}
          disabled={!value.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-mono bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/30 hover:bg-neon-cyan/20 disabled:opacity-30 transition-colors"
        >
          Go
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {suggestions.map((s) => (
          <button
            key={s}
            onClick={() => submit(s)}
            className="text-[10px] font-mono px-2 py-1 rounded border border-panel-border text-slate-500 hover:text-neon-cyan hover:border-neon-cyan/30 transition-colors"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function TraceItem({ trace }: { trace: TraceInfo }) {
  const statusColors = {
    completed: "text-neon-green",
    failed: "text-neon-red",
    running: "text-neon-cyan",
    paused: "text-neon-yellow",
  };

  return (
    <div className="px-2.5 py-2 rounded-lg border border-panel-border hover:border-neon-cyan/20 hover:bg-panel/40 transition-colors cursor-pointer">
      <div className="flex items-center gap-1.5 mb-0.5">
        <div
          className={cn(
            "w-1.5 h-1.5 rounded-full flex-shrink-0",
            trace.status === "completed"
              ? "bg-neon-green"
              : trace.status === "failed"
                ? "bg-neon-red"
                : trace.status === "running"
                  ? "bg-neon-cyan animate-pulse"
                  : "bg-neon-yellow"
          )}
        />
        <span
          className={cn(
            "text-[10px] font-mono",
            statusColors[trace.status] ?? "text-slate-500"
          )}
        >
          {trace.status}
        </span>
        <span className="text-[10px] font-mono text-slate-700 ml-auto">
          {trace.stepsCount} steps
        </span>
      </div>
      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
        {trace.goal}
      </p>
    </div>
  );
}
