"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Check, ShieldAlert, Trash2 } from "lucide-react";
import { resolveDispute } from "@/lib/actions/match-actions";
import type { DisputedMatchView } from "@/lib/queries";
import { useToast } from "@/components/ui/toast";
import { timeAgo } from "@/lib/utils";

export function DisputeQueue({ items }: { items: DisputedMatchView[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nessuna contestazione in sospeso. 🎉
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {items.map((item) => (
        <DisputeRow key={item.id} item={item} />
      ))}
    </ul>
  );
}

function DisputeRow({ item }: { item: DisputedMatchView }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [armedVoid, setArmedVoid] = useState(false);

  const hasScore = item.scoreA !== null && item.scoreB !== null;

  function resolve(decision: "confirm" | "void") {
    startTransition(async () => {
      const res = await resolveDispute(item.id, decision);
      if (!res.ok) {
        toast.error(res.error);
      } else {
        toast.success(
          decision === "confirm"
            ? "Risultato confermato"
            : "Partita annullata",
        );
        router.refresh();
      }
    });
  }

  return (
    <li className="rounded-xl border border-gold/40 bg-gold/5 p-3">
      <Link
        href={`/partite/${item.id}`}
        className="flex items-center justify-center gap-2 text-sm font-bold hover:text-brand"
      >
        <span className="truncate">{item.labelA}</span>
        <span className="font-mono text-base">
          {hasScore ? `${item.scoreA}–${item.scoreB}` : "vs"}
        </span>
        <span className="truncate">{item.labelB}</span>
      </Link>

      <div className="mt-1.5 space-y-0.5 text-center text-xs text-muted">
        <p className="flex items-center justify-center gap-1 text-gold">
          <ShieldAlert className="h-3.5 w-3.5" />
          Contestata{item.contestedBy ? ` da ${item.contestedBy}` : ""}
          {item.disputedAt ? ` · ${timeAgo(item.disputedAt)}` : ""}
        </p>
        {item.reason && <p>Motivo: «{item.reason}»</p>}
        <p>
          Proposta da {item.proposedBy ?? "—"} ·{" "}
          {item.ranked ? "classificata" : "amichevole"}
        </p>
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => resolve("confirm")}
          disabled={pending}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-win px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
        >
          <Check className="h-4 w-4" /> Conferma risultato
        </button>
        {armedVoid ? (
          <button
            onClick={() => resolve("void")}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl bg-loss px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Confermi?
          </button>
        ) : (
          <button
            onClick={() => setArmedVoid(true)}
            disabled={pending}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-sm font-bold text-muted hover:text-loss disabled:opacity-50"
          >
            <Trash2 className="h-4 w-4" /> Annulla
          </button>
        )}
      </div>
    </li>
  );
}
