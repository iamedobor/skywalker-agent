"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, Loader2, CheckCircle, AlertCircle, PauseCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface BrowserPreviewProps {
  screenshot: string | null;
  url: string;
  status: "idle" | "running" | "paused" | "complete" | "error";
  step: number;
  lastClickPos?: { x: number; y: number } | null;
  lastActionType?: string | null;
}

// Browser canvas is always 1280×800 (set in BrowserController)
const BROWSER_W = 1280;
const BROWSER_H = 800;

export function BrowserPreview({ screenshot, url, status, step, lastClickPos, lastActionType }: BrowserPreviewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [cursorPx, setCursorPx] = useState<{ x: number; y: number } | null>(null);
  const [ripple, setRipple] = useState(0);

  // Translate browser coordinates → rendered image coordinates
  useEffect(() => {
    if (!lastClickPos || !imgRef.current) return;
    const rect = imgRef.current.getBoundingClientRect();
    // The image uses object-contain, so calculate the actual rendered size
    const scale = Math.min(rect.width / BROWSER_W, rect.height / BROWSER_H);
    const renderedW = BROWSER_W * scale;
    const renderedH = BROWSER_H * scale;
    const offsetX = (rect.width - renderedW) / 2;
    const offsetY = (rect.height - renderedH) / 2;
    setCursorPx({
      x: offsetX + lastClickPos.x * scale,
      y: offsetY + lastClickPos.y * scale,
    });
    setRipple((n) => n + 1);
  }, [lastClickPos]);

  const statusConfig = {
    idle:     { icon: <Globe className="w-3.5 h-3.5" />,            label: "Ready",              color: "text-slate-500" },
    running:  { icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: `Step ${step}`,   color: "text-neon-cyan" },
    paused:   { icon: <PauseCircle className="w-3.5 h-3.5" />,      label: "Awaiting approval",  color: "text-neon-yellow" },
    complete: { icon: <CheckCircle className="w-3.5 h-3.5" />,      label: "Complete",           color: "text-neon-green" },
    error:    { icon: <AlertCircle className="w-3.5 h-3.5" />,      label: "Error",              color: "text-neon-red" },
  };

  const { icon, label, color } = statusConfig[status];
  const isTyping = lastActionType === "type";

  return (
    <div className="flex flex-col h-full glass-panel overflow-hidden">
      {/* Browser chrome */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-panel-border bg-void-950/50">
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
        </div>
        <div className="flex-1 flex items-center gap-2 px-2.5 py-1 bg-void-950 rounded-md border border-panel-border">
          <Globe className="w-3 h-3 text-slate-600 flex-shrink-0" />
          <span className="text-xs font-mono text-slate-500 truncate">{url || "about:blank"}</span>
        </div>
        <div className={cn("flex items-center gap-1.5 text-xs font-mono", color)}>
          {icon}
          <span>{label}</span>
        </div>
      </div>

      {/* Screenshot + cursor overlay */}
      <div className="flex-1 relative overflow-hidden bg-void-950">
        <AnimatePresence mode="sync">
          {screenshot ? (
            <motion.img
              ref={imgRef}
              key={screenshot.slice(-20)}
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="Live browser preview"
              className="w-full h-full object-contain"
              initial={{ opacity: 0.6 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.15 }}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-4"
            >
              <div className="relative">
                <Globe className="w-16 h-16 text-slate-700" />
                {status === "running" && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-20 h-20 text-neon-cyan/30 animate-spin" />
                  </div>
                )}
              </div>
              <div className="text-center">
                <p className="text-sm text-slate-600 font-mono">
                  {status === "idle" ? "No active session" : "Connecting to browser..."}
                </p>
                {status === "idle" && (
                  <p className="text-xs text-slate-700 font-mono mt-1">Press ⌘K to start</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Cursor overlay ───────────────────────────────────────────────────── */}
        {cursorPx && screenshot && (
          <div
            className="absolute pointer-events-none"
            style={{ left: cursorPx.x, top: cursorPx.y, transform: "translate(-4px, -4px)" }}
          >
            {/* Click ripple */}
            <AnimatePresence>
              {!isTyping && (
                <motion.div
                  key={ripple}
                  className="absolute rounded-full border border-neon-cyan/70"
                  style={{ left: -8, top: -8 }}
                  initial={{ width: 16, height: 16, opacity: 0.9 }}
                  animate={{ width: 44, height: 44, opacity: 0, left: -22, top: -22 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              )}
            </AnimatePresence>

            {/* Cursor SVG */}
            <svg
              width="20"
              height="24"
              viewBox="0 0 20 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              style={{ filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.8))" }}
            >
              <path
                d="M4 2L4 18L7.5 14.5L10 20L12 19L9.5 13.5L14 13.5L4 2Z"
                fill="white"
                stroke="#000"
                strokeWidth="1"
              />
            </svg>

            {/* Typing cursor indicator */}
            {isTyping && (
              <motion.div
                className="absolute left-5 -top-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-neon-cyan text-void-950 whitespace-nowrap"
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
              >
                typing…
              </motion.div>
            )}
          </div>
        )}

        {/* Scan line when running */}
        {status === "running" && screenshot && (
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute w-full h-px bg-gradient-to-r from-transparent via-neon-cyan/20 to-transparent"
              style={{ animation: "scanLine 3s linear infinite", top: 0 }}
            />
          </div>
        )}

        {/* Paused overlay */}
        {status === "paused" && (
          <div className="absolute inset-0 bg-void-950/60 backdrop-blur-xs flex items-center justify-center">
            <div className="text-center">
              <PauseCircle className="w-12 h-12 text-neon-yellow mx-auto mb-2" />
              <p className="text-sm font-mono text-neon-yellow">Awaiting your approval</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
