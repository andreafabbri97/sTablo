"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  removeDemoMatches,
  regenerateDemoMatches,
} from "@/lib/actions/demo-actions";

export function DemoControls({ count }: { count: number }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    startTransition(async () => {
      setMsg(null);
      const res = await fn();
      setConfirming(false);
      setMsg(res.ok ? ok : (res.error ?? "Errore"));
      router.refresh();
    });

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        Al momento ci sono <span className="font-bold text-foreground">{count}</span> partite demo.
        Puoi toglierle o rigenerarle quando vuoi: non toccano le partite vere.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={pending}
          onClick={() => run(regenerateDemoMatches, "Partite demo rigenerate ✅")}
        >
          <Sparkles className="h-4 w-4" />
          {pending ? "…" : count > 0 ? "Rigenera demo" : "Genera demo"}
        </Button>

        {count > 0 &&
          (confirming ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted">Sicuro?</span>
              <button
                onClick={() => run(removeDemoMatches, "Partite demo rimosse ✅")}
                disabled={pending}
                className="font-semibold text-loss hover:underline disabled:opacity-50"
              >
                {pending ? "…" : "Sì, rimuovi"}
              </button>
              <button onClick={() => setConfirming(false)} className="font-semibold text-muted">
                Annulla
              </button>
            </div>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirming(true)}>
              <Trash2 className="h-4 w-4" /> Rimuovi demo
            </Button>
          ))}
      </div>
      {msg && <p className="text-sm font-medium text-brand">{msg}</p>}
    </div>
  );
}
