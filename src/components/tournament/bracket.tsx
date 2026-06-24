import { MatchRow } from "./match-row";
import type { TournamentMatchView } from "@/lib/tournament/queries";

export function Bracket({
  matches,
  canManage,
}: {
  matches: TournamentMatchView[];
  canManage: boolean;
}) {
  const main = matches.filter((m) => m.label !== "Finale 3°/4°");
  const thirdPlace = matches.find((m) => m.label === "Finale 3°/4°");

  const byRound = new Map<number, TournamentMatchView[]>();
  for (const m of main) {
    const r = m.round ?? 1;
    if (!byRound.has(r)) byRound.set(r, []);
    byRound.get(r)!.push(m);
  }
  const rounds = [...byRound.keys()].sort((a, b) => a - b);

  return (
    <div className="space-y-4">
      <div className="flex gap-4 overflow-x-auto pb-2">
        {rounds.map((r) => {
          const col = byRound.get(r)!.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
          return (
            <div key={r} className="flex min-w-[230px] flex-col justify-around gap-3">
              <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">
                {col[0]?.label ?? `Turno ${r}`}
              </p>
              {col.map((m) => (
                <MatchRow key={m.id} match={m} canManage={canManage} />
              ))}
            </div>
          );
        })}
      </div>

      {thirdPlace && (
        <div className="max-w-sm">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Finale 3°/4° posto
          </p>
          <MatchRow match={thirdPlace} canManage={canManage} />
        </div>
      )}
    </div>
  );
}
