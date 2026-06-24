import { ATTRIBUTE_META, type Attributes, type AttributeKey } from "@/lib/gamification";
import { cn } from "@/lib/utils";

const ORDER: AttributeKey[] = ["potenza", "tecnica", "costanza", "difesa", "clutch"];

function barColor(value: number): string {
  if (value >= 80) return "from-emerald-400 to-emerald-600";
  if (value >= 65) return "from-lime-400 to-emerald-500";
  if (value >= 50) return "from-amber-400 to-orange-500";
  return "from-rose-400 to-rose-600";
}

export function AttributeBars({ attributes }: { attributes: Attributes }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {ORDER.map((key) => {
        const value = attributes[key];
        const meta = ATTRIBUTE_META[key];
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="w-8 text-center text-lg">{meta.emoji}</span>
            <div className="flex-1">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-semibold text-muted">{meta.label}</span>
                <span className="font-mono text-sm font-bold tabular-nums">{value}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-surface-2">
                <div
                  className={cn("h-full rounded-full bg-gradient-to-r transition-[width] duration-700", barColor(value))}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
