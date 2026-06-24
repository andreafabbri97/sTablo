import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Swords } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Card, CardLabel } from "@/components/ui/card";
import { MatchCard } from "@/components/match-card";
import { EmptyState } from "@/components/ui/page";
import { getHeadToHead, type HeadToHead, type H2HFormatRecord } from "@/lib/h2h";
import { safe } from "@/lib/safe";

export const dynamic = "force-dynamic";

const MAX_LISTED = 12;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string; opp: string }>;
}): Promise<Metadata> {
  const { slug, opp } = await params;
  const h2h = await safe(() => getHeadToHead(slug, opp), null);
  if (!h2h) return { title: "Testa a testa" };
  return { title: `${h2h.a.name} vs ${h2h.b.name}` };
}

export default async function HeadToHeadPage({
  params,
}: {
  params: Promise<{ slug: string; opp: string }>;
}) {
  const { slug, opp } = await params;
  const h2h = await safe(() => getHeadToHead(slug, opp), null);
  if (!h2h) notFound();

  const { a, b, total, aWins, bWins, aPoints, bPoints } = h2h;
  const aLeads = aWins > bWins;
  const bLeads = bWins > aWins;

  return (
    <div className="space-y-6">
      {/* Hero confronto */}
      <div className="card-surface p-6">
        <p className="mb-4 flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wide text-muted">
          <Swords className="h-4 w-4 text-brand" /> Testa a testa
        </p>

        <div className="flex items-center justify-between gap-3">
          <PlayerHead player={a} highlight={aLeads} align="left" />

          <div className="shrink-0 text-center">
            <div className="flex items-center gap-2 font-display text-4xl font-extrabold tabular-nums">
              <span className={aLeads ? "text-win" : "text-foreground"}>
                {aWins}
              </span>
              <span className="text-muted/40">-</span>
              <span className={bLeads ? "text-win" : "text-foreground"}>
                {bWins}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted">
              {total} {total === 1 ? "sfida" : "sfide"}
            </p>
          </div>

          <PlayerHead player={b} highlight={bLeads} align="right" />
        </div>

        {total > 0 && <WinBar aWins={aWins} bWins={bWins} total={total} />}
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<Swords className="h-6 w-6" />}
          title="Non si sono ancora affrontati"
          description="Quando giocheranno una partita uno contro l'altro, comparirà qui il loro storico."
        />
      ) : (
        <>
          {/* Riepilogo numeri */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <FormatBox label="Singolo" record={h2h.singles} />
            <FormatBox label="Doppio" record={h2h.doubles} />
            <StatBox label={`Punti ${a.name}`} value={aPoints} />
            <StatBox label={`Punti ${b.name}`} value={bPoints} />
          </div>

          {/* Scontri */}
          <div>
            <h2 className="mb-3 font-display text-lg font-extrabold">
              Gli scontri
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {h2h.matches.slice(0, MAX_LISTED).map((m) => (
                <MatchCard key={m.id} match={m} />
              ))}
            </div>
            {h2h.matches.length > MAX_LISTED && (
              <p className="mt-3 text-center text-xs text-muted">
                Mostrati gli ultimi {MAX_LISTED} di {h2h.matches.length} scontri.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function PlayerHead({
  player,
  highlight,
  align,
}: {
  player: HeadToHead["a"];
  highlight: boolean;
  align: "left" | "right";
}) {
  return (
    <Link
      href={`/giocatori/${player.slug}`}
      className={
        "group flex min-w-0 flex-1 flex-col items-center gap-2 " +
        (align === "left" ? "sm:items-start" : "sm:items-end")
      }
    >
      <Avatar
        name={player.name}
        colorIndex={player.avatarColor}
        imageUrl={player.avatarUrl}
        size="lg"
      />
      <p
        className={
          "max-w-full truncate text-center text-sm font-bold group-hover:text-brand " +
          (highlight ? "text-brand" : "")
        }
      >
        {player.name}
      </p>
    </Link>
  );
}

function WinBar({
  aWins,
  bWins,
  total,
}: {
  aWins: number;
  bWins: number;
  total: number;
}) {
  const aPct = Math.round((aWins / total) * 100);
  return (
    <div className="mt-5">
      <div className="flex h-2.5 overflow-hidden rounded-full bg-surface-2">
        <div className="bg-win" style={{ width: `${aPct}%` }} />
        <div className="flex-1 bg-brand" />
      </div>
      <div className="mt-1.5 flex justify-between text-[11px] font-semibold text-muted">
        <span>{aPct}%</span>
        <span>{100 - aPct}%</span>
      </div>
      {/* keep bWins referenced for clarity in markup */}
      <span className="sr-only">
        {aWins} vittorie contro {bWins}
      </span>
    </div>
  );
}

function FormatBox({
  label,
  record,
}: {
  label: string;
  record: H2HFormatRecord;
}) {
  return (
    <div className="card-surface p-4 text-center">
      <p className="font-display text-2xl font-extrabold tabular-nums">
        {record.aWins}<span className="text-muted/40">-</span>{record.bWins}
      </p>
      <p className="text-xs text-muted">
        {label} · {record.total} {record.total === 1 ? "sfida" : "sfide"}
      </p>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: number }) {
  return (
    <Card className="text-center">
      <p className="font-display text-2xl font-extrabold tabular-nums">{value}</p>
      <CardLabel className="truncate">{label}</CardLabel>
    </Card>
  );
}
