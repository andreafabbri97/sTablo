import { cn } from "@/lib/utils";
import type { StandingRow } from "@/lib/tournament/standings";

export function StandingsTable({
  rows,
  highlight = 0,
  entrantLabel = "Partecipante",
}: {
  rows: StandingRow[];
  highlight?: number;
  /** Column header for the entrant — depends on discipline (Giocatore/Coppia/Squadra). */
  entrantLabel?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <div className="card-surface overflow-hidden p-0">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border text-xs uppercase tracking-wide text-muted">
            <th className="px-3 py-2 text-left font-semibold">#</th>
            <th className="px-2 py-2 text-left font-semibold">{entrantLabel}</th>
            <th className="px-2 py-2 text-center font-semibold">G</th>
            <th className="px-2 py-2 text-center font-semibold">V</th>
            <th className="px-2 py-2 text-center font-semibold">S</th>
            <th className="px-2 py-2 text-center font-semibold">DP</th>
            <th className="px-3 py-2 text-center font-semibold">Pt</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.entrant.id}
              className={cn(
                "border-b border-border last:border-0",
                highlight > 0 && i < highlight && "bg-brand-soft",
              )}
            >
              <td className="px-3 py-2.5 font-bold text-muted">{i + 1}</td>
              <td className="px-2 py-2.5 break-words">
                <span className="block font-semibold">{r.entrant.name}</span>
                {r.entrant.username && (
                  <span className="block text-xs font-medium text-muted">
                    @{r.entrant.username}
                  </span>
                )}
              </td>
              <td className="px-2 py-2.5 text-center text-muted">{r.played}</td>
              <td className="px-2 py-2.5 text-center text-win">{r.won}</td>
              <td className="px-2 py-2.5 text-center text-loss">{r.lost}</td>
              <td className="px-2 py-2.5 text-center text-muted">
                {r.diff >= 0 ? "+" : ""}
                {r.diff}
              </td>
              <td className="px-3 py-2.5 text-center font-mono font-extrabold text-brand">
                {r.points}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
