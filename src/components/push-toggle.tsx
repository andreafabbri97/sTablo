"use client";

import { useEffect, useState } from "react";
import { Bell, BellOff, BellRing, Loader2 } from "lucide-react";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { removePushSubscription, sendTestPush } from "@/lib/actions/push-actions";
import {
  pushSupported,
  subscribeToPush,
  getLocalSubscription,
} from "@/lib/push-client";

type State = "checking" | "unsupported" | "denied" | "off" | "on";

export function PushToggle() {
  const [state, setState] = useState<State>("checking");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!pushSupported()) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      try {
        const sub = await getLocalSubscription();
        if (!cancelled) setState(sub ? "on" : "off");
      } catch {
        if (!cancelled) setState("off");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMsg(null);
    try {
      const res = await subscribeToPush({ promptIfNeeded: true });
      if (!res.ok) {
        if (res.reason === "denied") setState("denied");
        if (res.reason === "no-key")
          setMsg("Notifiche non ancora configurate sul server.");
        else if (res.reason === "needs-prompt") setState("off");
        else if (res.reason !== "denied")
          setMsg(
            res.message ??
              "Impossibile attivare le notifiche su questo dispositivo.",
          );
        return;
      }
      setState("on");
      setMsg("Notifiche attivate! Ti ho mandato una notifica di prova 🎉");
      await sendTestPush();
    } catch {
      setMsg("Impossibile attivare le notifiche su questo dispositivo.");
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const sub = await getLocalSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
    } catch {
      setMsg("Errore nella disattivazione.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardTitle className="mb-1 flex items-center gap-2">
        <Bell className="h-5 w-5 text-brand" /> Notifiche push
      </CardTitle>
      <p className="mb-4 text-sm text-muted">
        Ricevi una notifica sul telefono quando devi confermare un risultato, ti
        arriva una richiesta di amicizia o un invito a un torneo — anche con
        l&apos;app chiusa.
      </p>

      {state === "checking" && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Controllo…
        </p>
      )}

      {state === "unsupported" && (
        <p className="text-sm text-muted">
          Questo browser non supporta le notifiche push. Su iPhone:{" "}
          <span className="font-semibold text-foreground">
            installa prima l&apos;app dalla schermata Home
          </span>{" "}
          (tasto Condividi → &quot;Aggiungi a Home&quot;), poi torna qui.
        </p>
      )}

      {state === "denied" && (
        <p className="text-sm text-loss">
          Hai bloccato le notifiche per sTablo. Riabilitale dalle impostazioni
          del browser/sito, poi ricarica la pagina.
        </p>
      )}

      {state === "off" && (
        <Button onClick={enable} disabled={busy} size="lg" className="w-full sm:w-auto">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
          {busy ? "Attivazione…" : "Abilita notifiche"}
        </Button>
      )}

      {state === "on" && (
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-xl bg-[var(--win)]/15 px-3 py-2 text-sm font-semibold text-[var(--win)]">
            <BellRing className="h-4 w-4" /> Notifiche attive
          </span>
          <Button onClick={disable} disabled={busy} variant="secondary" size="sm">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
            Disattiva
          </Button>
        </div>
      )}

      {msg && <p className="mt-3 text-sm text-muted">{msg}</p>}
    </Card>
  );
}
