"use client";

import { useState } from "react";
import { Link2, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { TournamentForm } from "@/components/admin/tournament-form";
import { TournamentOpenForm } from "@/components/tournament-open-form";

type Option = { id: string; name: string };
type Mode = "open" | "manual";

/**
 * Admin-only chooser between the two ways to create a tournament:
 *  - "open": shareable invite link/QR, public or private, players self-join
 *    (delegates to the same open-tournament flow players use).
 *  - "manual": pick the participants now and start immediately.
 */
export function TournamentCreateSwitch({ players }: { players: Option[] }) {
  const [mode, setMode] = useState<Mode>("manual");

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-border bg-surface p-1.5">
        <ModeTab
          active={mode === "manual"}
          onClick={() => setMode("manual")}
          icon={<Users className="h-4 w-4" />}
          title="Scegli i partecipanti"
          sub="Imposti tu, parte subito"
        />
        <ModeTab
          active={mode === "open"}
          onClick={() => setMode("open")}
          icon={<Link2 className="h-4 w-4" />}
          title="Invito aperto"
          sub="Link/QR, pubblico o privato"
        />
      </div>

      <p className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-xs text-muted">
        {mode === "open"
          ? "Crei il torneo e ottieni un link/QR da condividere: ognuno si iscrive da solo. Scegli se renderlo pubblico (in lista per tutti) o privato (solo chi invii)."
          : "Scegli ora i partecipanti (o le coppie) e il torneo parte subito, senza inviti né iscrizioni."}
      </p>

      {mode === "open" ? <TournamentOpenForm /> : <TournamentForm players={players} />}
    </div>
  );
}

function ModeTab({
  active,
  onClick,
  icon,
  title,
  sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  title: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-full flex-col items-start justify-center gap-0.5 rounded-xl px-3 py-2.5 text-left transition",
        active ? "bg-brand text-white shadow-[var(--shadow-brand)]" : "text-muted hover:bg-surface-2",
      )}
    >
      <span className="flex items-center gap-1.5 text-sm font-bold">
        {icon}
        {title}
      </span>
      <span className={cn("text-[11px]", active ? "text-white/80" : "text-muted")}>{sub}</span>
    </button>
  );
}
