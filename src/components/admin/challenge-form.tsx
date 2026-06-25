"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, Swords } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label, Input, FieldError } from "@/components/ui/field";
import { PlayerCombobox } from "@/components/ui/player-combobox";
import { cn } from "@/lib/utils";
import { scheduleMatch } from "@/lib/actions/match-actions";

type Option = { id: string; name: string };

/**
 * Local wall-clock `YYYY-MM-DDTHH:mm` two hours from now — a sensible default
 * "let's play later today" slot for a challenge. Computed on the client only.
 */
function defaultSlot(): string {
  const d = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

export function ChallengeForm({
  players,
  currentPlayerId,
  isAdmin = false,
}: {
  players: Option[];
  currentPlayerId?: string;
  isAdmin?: boolean;
}) {
  const router = useRouter();
  const [format, setFormat] = useState<"singles" | "doubles">("singles");
  const [ranked, setRanked] = useState(true);
  const [sel, setSel] = useState<Record<string, string>>(() => ({
    playedAt: defaultSlot(),
    ...(currentPlayerId ? { playerA: currentPlayerId } : {}),
  }));
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (k: string, v: string) => setSel((s) => ({ ...s, [k]: v }));

  // Ids picked in the other slots, so the same player can't be on both sides.
  const slotKeys =
    format === "singles"
      ? ["playerA", "playerB"]
      : ["playerA", "playerA2", "playerB", "playerB2"];
  const pickedExcept = (slot: string) =>
    new Set(
      slotKeys
        .filter((k) => k !== slot)
        .map((k) => sel[k])
        .filter((id): id is string => Boolean(id)),
    );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload: Record<string, unknown> = {
      format,
      ranked,
      playedAt: sel.playedAt,
      note: sel.note ?? "",
      playerA: sel.playerA,
      playerB: sel.playerB,
    };
    if (format === "doubles") {
      payload.playerA2 = sel.playerA2;
      payload.playerB2 = sel.playerB2;
    }

    const res = await scheduleMatch(payload);
    setLoading(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    router.push(`/partite/${res.matchId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {/* Format switch */}
      <div className="flex gap-1.5 rounded-2xl border border-border bg-surface p-1.5">
        {(["singles", "doubles"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFormat(f)}
            className={cn(
              "flex-1 rounded-xl py-2.5 text-sm font-bold transition",
              format === f
                ? "bg-brand text-white shadow-[var(--shadow-brand)]"
                : "text-muted hover:bg-surface-2",
            )}
          >
            {f === "singles" ? "1 vs 1" : "2 vs 2"}
          </button>
        ))}
      </div>

      {/* Ranked vs friendly */}
      <div className="flex gap-1.5 rounded-2xl border border-border bg-surface p-1.5">
        {[
          { v: true, label: "🏆 Classificata", hint: "Muoverà l'Elo" },
          { v: false, label: "🤝 Amichevole", hint: "Solo XP" },
        ].map((o) => (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => setRanked(o.v)}
            className={cn(
              "flex-1 rounded-xl px-2 py-2 text-center transition",
              ranked === o.v ? "bg-surface-2 ring-2 ring-brand" : "hover:bg-surface-2",
            )}
          >
            <span className="block text-sm font-bold">{o.label}</span>
            <span className="block text-[11px] text-muted">{o.hint}</span>
          </button>
        ))}
      </div>

      {/* Sides */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3">
        <SideColumn tone="brand" label="Sfidante">
          <PlayerSelect
            players={players}
            value={sel.playerA}
            excludeIds={pickedExcept("playerA")}
            placeholder={isAdmin ? "Giocatore A…" : "Tu"}
            onChange={(v) => set("playerA", v)}
          />
          {format === "doubles" && (
            <PlayerSelect
              players={players}
              value={sel.playerA2}
              excludeIds={pickedExcept("playerA2")}
              placeholder="Compagno…"
              onChange={(v) => set("playerA2", v)}
            />
          )}
        </SideColumn>

        <div className="self-center pt-7 font-display text-xl font-extrabold text-muted">
          VS
        </div>

        <SideColumn tone="sea" label="Sfidato">
          <PlayerSelect
            players={players}
            value={sel.playerB}
            excludeIds={pickedExcept("playerB")}
            placeholder="Avversario…"
            onChange={(v) => set("playerB", v)}
          />
          {format === "doubles" && (
            <PlayerSelect
              players={players}
              value={sel.playerB2}
              excludeIds={pickedExcept("playerB2")}
              placeholder="Compagno…"
              onChange={(v) => set("playerB2", v)}
            />
          )}
        </SideColumn>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Label htmlFor="playedAt">Data e ora della sfida</Label>
          <Input
            id="playedAt"
            type="datetime-local"
            suppressHydrationWarning
            value={sel.playedAt ?? ""}
            onChange={(e) => set("playedAt", e.target.value)}
          />
        </div>
        <div>
          <Label htmlFor="note">Nota (opzionale)</Label>
          <Input
            id="note"
            maxLength={140}
            value={sel.note ?? ""}
            onChange={(e) => set("note", e.target.value)}
            placeholder="es. rivincita al bar del Marano"
          />
        </div>
      </div>

      <FieldError>{error}</FieldError>

      <Button type="submit" size="lg" className="w-full" disabled={loading}>
        <Swords className="h-4 w-4" />
        {loading ? "Invio sfida…" : "Lancia la sfida"}
      </Button>
      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted">
        <CalendarPlus className="h-3.5 w-3.5" />
        L&apos;avversario riceve una notifica. Il risultato si registra dopo aver
        giocato.
      </p>
    </form>
  );
}

function SideColumn({
  tone,
  label,
  children,
}: {
  tone: "brand" | "sea";
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <p
        className={cn(
          "text-center text-xs font-bold uppercase tracking-wider",
          tone === "brand" ? "text-brand" : "text-sea",
        )}
      >
        {label}
      </p>
      {children}
    </div>
  );
}

function PlayerSelect({
  players,
  value,
  excludeIds,
  placeholder,
  onChange,
}: {
  players: Option[];
  value?: string;
  excludeIds?: Set<string>;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <PlayerCombobox
      players={players}
      value={value}
      excludeIds={excludeIds}
      placeholder={placeholder}
      onChange={onChange}
    />
  );
}
