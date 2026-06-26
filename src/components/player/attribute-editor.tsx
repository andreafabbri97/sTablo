"use client";

import { useMemo, useState } from "react";
import { RotateCcw, Sparkles } from "lucide-react";
import {
  ATTRIBUTE_FLOOR,
  ATTRIBUTE_KEYS,
  ATTRIBUTE_META,
  baselineAttributes,
  hasCustomAttributes,
  levelAttributeCap,
  levelStatBudget,
  overall,
  resolveAttributes,
  type Attributes,
  type AttributeKey,
} from "@/lib/gamification";
import { cn } from "@/lib/utils";

const sumOf = (a: Attributes) =>
  ATTRIBUTE_KEYS.reduce((s, k) => s + a[k], 0);

/**
 * Budget allocator for the FIFA-card attributes. The five stats share a single
 * pool tied to the player's level: to raise one you must lower another. Reports
 * the chosen distribution upward — an empty object means "auto" (derived card).
 */
export function AttributeEditor({
  derived,
  level,
  initial,
  onChange,
}: {
  derived: Attributes;
  level: number;
  initial: Partial<Record<AttributeKey, number>>;
  onChange: (custom: Record<string, number>) => void;
}) {
  const budget = useMemo(() => levelStatBudget(level), [level]);
  const cap = useMemo(() => levelAttributeCap(level), [level]);
  const baseline = useMemo(
    () => baselineAttributes(derived, level),
    [derived, level],
  );

  const [auto, setAuto] = useState(() => !hasCustomAttributes(initial));
  const [values, setValues] = useState<Attributes>(() =>
    resolveAttributes(derived, initial, level),
  );

  const used = sumOf(values);
  const remaining = budget - used;
  const ovr = overall(values);

  function maxFor(key: AttributeKey): number {
    const others = used - values[key];
    return Math.max(ATTRIBUTE_FLOOR, Math.min(cap, budget - others));
  }

  function setAttr(key: AttributeKey, raw: number) {
    const next = Math.max(ATTRIBUTE_FLOOR, Math.min(maxFor(key), Math.round(raw)));
    const updated = { ...values, [key]: next };
    setValues(updated);
    setAuto(false);
    onChange({ ...updated });
  }

  function resetAuto() {
    setValues(baseline);
    setAuto(true);
    onChange({});
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-bold">
            <Sparkles className="h-4 w-4 text-brand" />
            Personalizza la card
          </p>
          <p className="mt-0.5 text-xs text-muted">
            Hai un budget di punti che cresce col livello. Per alzare una stat
            devi abbassarne un&apos;altra: i giocatori dello stesso livello
            restano sempre coerenti.
          </p>
        </div>
        <div className="shrink-0 text-center">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted">
            OVR
          </div>
          <div className="text-2xl font-black leading-none tabular-nums">{ovr}</div>
        </div>
      </div>

      {/* Budget meter */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">
            Punti usati{" "}
            <span className="font-bold text-fg tabular-nums">
              {used}/{budget}
            </span>
          </span>
          <span
            className={cn(
              "font-semibold tabular-nums",
              remaining === 0 ? "text-muted" : "text-brand",
            )}
          >
            {remaining > 0 ? `${remaining} liberi` : "tutti assegnati"}
          </span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-brand transition-all"
            style={{ width: `${Math.round((used / budget) * 100)}%` }}
          />
        </div>
      </div>

      {/* Sliders */}
      <div className="mt-4 space-y-3">
        {ATTRIBUTE_KEYS.map((key) => {
          const value = values[key];
          const meta = ATTRIBUTE_META[key];
          const atCap = value >= cap;
          return (
            <div key={key}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">
                  {meta.emoji} {meta.label}
                </span>
                <span className="tabular-nums font-bold">{value}</span>
              </div>
              <input
                type="range"
                min={ATTRIBUTE_FLOOR}
                max={cap}
                value={value}
                onChange={(e) => setAttr(key, Number(e.target.value))}
                className="mt-1 w-full touch-pan-y accent-brand"
                aria-label={`${meta.label} (max ${cap} a questo livello)`}
              />
              <div className="flex justify-between text-[10px] text-muted">
                <span>min {ATTRIBUTE_FLOOR}</span>
                <span className={cn(atCap && "font-semibold text-brand")}>
                  max livello {cap}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {auto
            ? "Card automatica, calcolata dalle tue partite."
            : "Card personalizzata."}
        </p>
        <button
          type="button"
          onClick={resetAuto}
          disabled={auto}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition",
            auto
              ? "cursor-default border-border text-muted opacity-60"
              : "border-brand text-brand hover:bg-brand-soft",
          )}
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Ripristina auto
        </button>
      </div>
    </div>
  );
}
