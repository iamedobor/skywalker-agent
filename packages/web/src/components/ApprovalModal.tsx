"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Check, X, CreditCard, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PendingApproval } from "@/hooks/useAgent";

interface ApprovalModalProps {
  approval: PendingApproval | null;
  onApprove: (userInput?: string) => void;
  onReject: () => void;
}

export function ApprovalModal({ approval, onApprove, onReject }: ApprovalModalProps) {
  const [userInput, setUserInput] = useState("");
  const [inputMode, setInputMode] = useState(false);

  const isPayment =
    approval?.reason.toLowerCase().includes("payment") ||
    approval?.reason.toLowerCase().includes("pay") ||
    approval?.reason.toLowerCase().includes("purchase");

  return (
    <AnimatePresence>
      {approval && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-void-950/80 backdrop-blur-sm"
          />

          {/* Modal */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-lg glass-panel overflow-hidden"
          >
            {/* Header glow */}
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-px",
                isPayment
                  ? "bg-gradient-to-r from-transparent via-neon-yellow/60 to-transparent"
                  : "bg-gradient-to-r from-transparent via-neon-purple/60 to-transparent"
              )}
            />

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-panel-border">
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-lg",
                  isPayment ? "bg-neon-yellow/10" : "bg-neon-purple/10"
                )}
              >
                {isPayment ? (
                  <CreditCard
                    className={cn("w-5 h-5", isPayment ? "text-neon-yellow" : "text-neon-purple")}
                  />
                ) : (
                  <ShieldAlert className="w-5 h-5 text-neon-purple" />
                )}
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  {isPayment ? "Payment Gate Triggered" : "Human Approval Required"}
                </h2>
                <p className="text-xs text-slate-500 font-mono">
                  SkyWalker is waiting for you
                </p>
              </div>
            </div>

            {/* Screenshot */}
            {approval.screenshot && (
              <div className="px-5 pt-4">
                <div className="rounded-lg overflow-hidden border border-panel-border">
                  <div className="flex items-center gap-2 px-3 py-1.5 bg-void-950 border-b border-panel-border">
                    <div className="w-2 h-2 rounded-full bg-red-500/60" />
                    <div className="w-2 h-2 rounded-full bg-yellow-500/60" />
                    <div className="w-2 h-2 rounded-full bg-green-500/60" />
                    <span className="text-[10px] font-mono text-slate-600 ml-2 truncate">
                      {approval.pageTitle || approval.pageUrl}
                    </span>
                  </div>
                  <img
                    src={`data:image/jpeg;base64,${approval.screenshot}`}
                    alt="Current page"
                    className="w-full max-h-48 object-cover object-top"
                  />
                </div>
              </div>
            )}

            {/* Reason */}
            <div className="px-5 py-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                {approval.reason}
              </p>
              <p className="text-xs text-slate-600 font-mono mt-2">
                URL: {approval.pageUrl}
              </p>
            </div>

            {/* Optional text input */}
            {inputMode && (
              <div className="px-5 pb-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-neon-purple" />
                  <span className="text-xs text-slate-400">Send a message to the agent:</span>
                </div>
                <input
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="e.g. 'Use the Visa card ending in 4242'"
                  className="w-full px-3 py-2 bg-void-950 border border-panel-border rounded-lg text-sm font-mono text-slate-300 placeholder:text-slate-600 outline-none focus:border-neon-purple/40"
                  autoFocus
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 px-5 py-4 border-t border-panel-border">
              <button
                onClick={() => onApprove(userInput || undefined)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg",
                  "text-sm font-medium transition-all duration-200",
                  isPayment
                    ? "bg-neon-yellow/10 text-neon-yellow border border-neon-yellow/30 hover:bg-neon-yellow/20"
                    : "bg-neon-green/10 text-neon-green border border-neon-green/30 hover:bg-neon-green/20"
                )}
              >
                <Check className="w-4 h-4" />
                {isPayment ? "Approve & Proceed" : "Approve"}
              </button>

              <button
                onClick={() => setInputMode((v) => !v)}
                className="p-2.5 rounded-lg border border-panel-border text-slate-500 hover:text-neon-purple hover:border-neon-purple/30 transition-colors"
                title="Send message to agent"
              >
                <MessageSquare className="w-4 h-4" />
              </button>

              <button
                onClick={onReject}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium bg-neon-red/5 text-neon-red border border-neon-red/20 hover:bg-neon-red/10 transition-all duration-200"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
