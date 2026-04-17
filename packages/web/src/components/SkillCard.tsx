"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { SkillInfo } from "@/lib/socket";

interface SkillCardProps {
  skill: SkillInfo;
  onSelect: (skill: SkillInfo) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  travel: "text-neon-blue border-neon-blue/20 bg-neon-blue/5",
  social: "text-neon-purple border-neon-purple/20 bg-neon-purple/5",
  productivity: "text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5",
  finance: "text-neon-green border-neon-green/20 bg-neon-green/5",
  shopping: "text-neon-yellow border-neon-yellow/20 bg-neon-yellow/5",
  general: "text-slate-400 border-slate-600 bg-slate-800/20",
};

export function SkillCard({ skill, onSelect }: SkillCardProps) {
  const categoryColor =
    CATEGORY_COLORS[skill.category] ?? CATEGORY_COLORS.general!;

  return (
    <motion.button
      whileHover={{ scale: 1.01, y: -1 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => onSelect(skill)}
      className={cn(
        "w-full text-left p-4 rounded-xl border transition-all duration-200",
        "bg-panel/60 border-panel-border",
        "hover:border-neon-cyan/20 hover:bg-panel/80 hover:shadow-neon-blue",
        "group"
      )}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none mt-0.5">{skill.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-slate-200 group-hover:text-neon-cyan transition-colors">
              {skill.name}
            </h3>
            <span
              className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 rounded border",
                categoryColor
              )}
            >
              {skill.category}
            </span>
          </div>
          <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
            {skill.description}
          </p>

          {skill.triggers.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {skill.triggers.slice(0, 3).map((t) => (
                <span
                  key={t}
                  className="text-[10px] font-mono text-slate-600 bg-void-950 border border-panel-border px-1.5 py-0.5 rounded"
                >
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.button>
  );
}

export function SkillGrid({
  skills,
  onSelect,
}: {
  skills: SkillInfo[];
  onSelect: (skill: SkillInfo) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2">
      {skills.map((skill) => (
        <SkillCard key={skill.name} skill={skill} onSelect={onSelect} />
      ))}
    </div>
  );
}
