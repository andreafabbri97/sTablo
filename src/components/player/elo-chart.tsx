"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Tooltip,
  YAxis,
  XAxis,
} from "recharts";
import type { EloPoint } from "@/lib/queries";

export function EloChart({ data }: { data: EloPoint[] }) {
  if (data.length < 2) {
    return (
      <div className="grid h-40 place-items-center text-sm text-muted">
        Gioca qualche partita per vedere l&apos;andamento Elo.
      </div>
    );
  }

  const values = data.map((d) => d.elo);
  const min = Math.min(...values) - 20;
  const max = Math.max(...values) + 20;

  return (
    <div className="h-44 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="elo" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--brand)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--brand)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="i" hide />
          <YAxis domain={[min, max]} tick={{ fontSize: 11, fill: "var(--muted)" }} width={42} />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 12,
              fontSize: 12,
            }}
            labelFormatter={() => ""}
            formatter={(value) => [`${value} Elo`, "Elo"]}
          />
          <Area
            type="monotone"
            dataKey="elo"
            stroke="var(--brand)"
            strokeWidth={2.5}
            fill="url(#elo)"
            dot={false}
            animationDuration={800}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
