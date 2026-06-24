import { Sparkles } from "lucide-react";
import type { LevelInfo } from "@/lib/gamification";

export function LevelBar({ level }: { level: LevelInfo }) {
  const pct = Math.round(level.progress * 100);
  return (
    <div className="card-surface p-4">
      <div className="mb-2 flex items-end justify-between">
        <div className="flex items-center gap-2.5">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-strong font-display text-lg font-extrabold text-white shadow-[var(--shadow-brand)]">
            {level.level}
          </span>
          <div>
            <p className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-muted">
              <Sparkles className="h-3 w-3" /> Livello
            </p>
            <p className="font-display font-bold">{level.title}</p>
          </div>
        </div>
        <span className="font-mono text-xs text-muted">
          {level.xpIntoLevel}/{level.xpForNext} XP
        </span>
      </div>
      <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand to-ball transition-[width] duration-700 ease-out"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
