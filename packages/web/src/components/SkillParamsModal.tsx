"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play } from "lucide-react";
import type { SkillInfo } from "@/lib/socket";
import { cn } from "@/lib/utils";

interface SkillParamsModalProps {
  skill: SkillInfo | null;
  onClose: () => void;
  onRun: (skillName: string, params: Record<string, unknown>) => void;
}

interface Field {
  name: string;
  type: "string" | "integer" | "number" | "date" | "enum";
  description?: string;
  defaultValue?: unknown;
  required: boolean;
  enumValues?: string[];
  min?: number;
  max?: number;
}

/**
 * Convert a skill's JSON Schema into a flat field list we can render.
 * Handles the subset of JSON Schema we use in skills: object with `properties`,
 * `required`, primitive types, enums, and `format: date`.
 */
function schemaToFields(schema: Record<string, unknown> | null | undefined): Field[] {
  if (!schema || typeof schema !== "object") return [];
  const props = (schema.properties as Record<string, Record<string, unknown>>) ?? {};
  const required = new Set<string>((schema.required as string[]) ?? []);
  return Object.entries(props).map(([name, spec]): Field => {
    const format = spec.format as string | undefined;
    const enumValues = spec.enum as string[] | undefined;
    let type: Field["type"] = "string";
    if (format === "date") type = "date";
    else if (spec.type === "integer") type = "integer";
    else if (spec.type === "number") type = "number";
    else if (enumValues && enumValues.length > 0) type = "enum";
    return {
      name,
      type,
      description: spec.description as string | undefined,
      defaultValue: spec.default,
      required: required.has(name),
      enumValues,
      min: spec.minimum as number | undefined,
      max: spec.maximum as number | undefined,
    };
  });
}

/**
 * Suggest smart defaults for common field names so the user can hit Run
 * immediately without filling in anything.
 */
function smartDefault(field: Field, skillName: string): unknown {
  if (field.defaultValue !== undefined) return field.defaultValue;
  if (field.type === "date") {
    // Next Friday — reliable fallback for flight/travel demos
    const d = new Date();
    const daysUntilFriday = (5 - d.getDay() + 7) % 7 || 7;
    d.setDate(d.getDate() + daysUntilFriday);
    return d.toISOString().slice(0, 10);
  }
  if (field.type === "enum" && field.enumValues) return field.enumValues[0];
  if (field.type === "integer" || field.type === "number") return field.min ?? 1;
  // String placeholders tuned per skill
  if (skillName === "flight-search") {
    if (field.name === "origin") return "NYC";
    if (field.name === "destination") return "London";
  }
  if (skillName === "research" && field.name === "topic") {
    return "the best AI coding assistants of 2026";
  }
  if (skillName === "linkedin" && field.name === "query") {
    return "senior engineers at Anthropic";
  }
  return "";
}

export function SkillParamsModal({ skill, onClose, onRun }: SkillParamsModalProps) {
  const fields = useMemo(() => schemaToFields(skill?.paramsSchema), [skill]);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);

  // Reset form state whenever a new skill is opened
  useEffect(() => {
    if (!skill) return;
    const initial: Record<string, unknown> = {};
    for (const f of fields) initial[f.name] = smartDefault(f, skill.name);
    setValues(initial);
    setError(null);
  }, [skill, fields]);

  if (!skill) return null;

  const handleSubmit = () => {
    // Strip empty optional fields so the backend validator doesn't choke
    const params: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (v === "" || v === undefined || v === null) {
        if (f.required) {
          setError(`"${f.name}" is required`);
          return;
        }
        continue;
      }
      params[f.name] = v;
    }
    onRun(skill.name, params);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-50 flex items-center justify-center bg-void-950/80 backdrop-blur-sm p-4"
      >
        <motion.div
          initial={{ scale: 0.95, y: 10, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.95, y: 10, opacity: 0 }}
          transition={{ type: "spring", duration: 0.3 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-md glass-panel p-6 relative"
        >
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-500 hover:text-neon-cyan transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-1">
            <span className="text-3xl">{skill.icon}</span>
            <div>
              <h2 className="text-sm font-semibold text-slate-100">{skill.name}</h2>
              <p className="text-[10px] font-mono text-slate-600 uppercase tracking-wider">
                {skill.category} · v{skill.version}
              </p>
            </div>
          </div>
          <p className="text-xs text-slate-400 mb-5 leading-relaxed">{skill.description}</p>

          {fields.length === 0 ? (
            <p className="text-xs text-slate-500 italic mb-4">
              This skill takes no parameters. Click Run to start.
            </p>
          ) : (
            <div className="space-y-3 mb-5">
              {fields.map((f) => (
                <FieldInput
                  key={f.name}
                  field={f}
                  value={values[f.name]}
                  onChange={(v) => setValues((prev) => ({ ...prev, [f.name]: v }))}
                />
              ))}
            </div>
          )}

          {error && (
            <div className="mb-3 text-[11px] font-mono text-neon-red bg-neon-red/10 border border-neon-red/20 rounded-lg px-2.5 py-1.5">
              {error}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded-lg text-xs font-mono text-slate-400 border border-panel-border hover:border-slate-500 hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="flex-[2] flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-mono text-neon-cyan bg-neon-cyan/10 border border-neon-cyan/30 hover:bg-neon-cyan/20 transition-colors"
            >
              <Play className="w-3 h-3" />
              Run {skill.name}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: Field;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  const label = (
    <label className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 mb-1">
      {field.name}
      {field.required && <span className="text-neon-red">*</span>}
      {field.description && (
        <span className="text-slate-600 normal-case">— {field.description}</span>
      )}
    </label>
  );

  const inputBase = cn(
    "w-full px-3 py-2 rounded-lg text-xs font-mono",
    "bg-void-950 border border-panel-border text-slate-200",
    "placeholder:text-slate-600 outline-none",
    "focus:border-neon-cyan/40 transition-colors"
  );

  if (field.type === "enum" && field.enumValues) {
    return (
      <div>
        {label}
        <select
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputBase}
        >
          {field.enumValues.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (field.type === "date") {
    return (
      <div>
        {label}
        <input
          type="date"
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          className={inputBase}
        />
      </div>
    );
  }

  if (field.type === "integer" || field.type === "number") {
    return (
      <div>
        {label}
        <input
          type="number"
          min={field.min}
          max={field.max}
          value={(value as number) ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          className={inputBase}
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type="text"
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
      />
    </div>
  );
}
