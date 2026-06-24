"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, Check } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { inviteFriendsToTournament } from "@/lib/actions/tournament-actions";

export type InviteFriend = {
  userId: string;
  name: string;
  avatarColor: number;
};

export function InviteFriendsButton({
  tournamentId,
  friends,
  invitedUserIds,
}: {
  tournamentId: string;
  friends: InviteFriend[];
  invitedUserIds: string[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const invited = new Set(invitedUserIds);
  const available = friends.filter((f) => !invited.has(f.userId));
  const alreadyInvited = friends.filter((f) => invited.has(f.userId));

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function submit() {
    setError(null);
    setDone(null);
    startTransition(async () => {
      const res = await inviteFriendsToTournament(tournamentId, [...selected]);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setDone(
        res.invited === 1
          ? "1 invito inviato 🎾"
          : `${res.invited ?? 0} inviti inviati 🎾`,
      );
      setSelected(new Set());
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold transition hover:bg-surface-2"
      >
        <UserPlus className="h-4 w-4 text-brand" /> Invita amici
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Invita amici"
        icon={<UserPlus className="h-5 w-5 text-brand" />}
      >
        <div className="space-y-4">
          {friends.length === 0 ? (
            <p className="text-sm text-muted">
              Non hai ancora amici da invitare. Aggiungi amici dalla pagina Amici
              e potrai invitarli ai tuoi tornei.
            </p>
          ) : (
            <>
              {available.length > 0 ? (
                <ul className="space-y-1.5">
                  {available.map((f) => {
                    const checked = selected.has(f.userId);
                    return (
                      <li key={f.userId}>
                        <button
                          type="button"
                          onClick={() => toggle(f.userId)}
                          className={cn(
                            "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
                            checked
                              ? "border-brand bg-brand-soft"
                              : "border-border bg-surface hover:bg-surface-2",
                          )}
                        >
                          <Avatar
                            name={f.name}
                            colorIndex={f.avatarColor}
                            size="xs"
                          />
                          <span className="flex-1 truncate text-sm font-semibold">
                            {f.name}
                          </span>
                          <span
                            className={cn(
                              "grid h-5 w-5 place-items-center rounded-md border",
                              checked
                                ? "border-brand bg-brand text-white"
                                : "border-border",
                            )}
                          >
                            {checked && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-muted">
                  Hai già invitato tutti i tuoi amici. 🎉
                </p>
              )}

              {alreadyInvited.length > 0 && (
                <div>
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted">
                    Già invitati
                  </p>
                  <ul className="space-y-1.5">
                    {alreadyInvited.map((f) => (
                      <li
                        key={f.userId}
                        className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 opacity-60"
                      >
                        <Avatar
                          name={f.name}
                          colorIndex={f.avatarColor}
                          size="xs"
                        />
                        <span className="flex-1 truncate text-sm font-semibold">
                          {f.name}
                        </span>
                        <span className="text-xs font-medium text-brand">
                          ✓ Invitato
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-loss">{error}</p>}
          {done && <p className="text-sm font-semibold text-win">{done}</p>}

          {available.length > 0 && (
            <button
              type="button"
              onClick={submit}
              disabled={pending || selected.size === 0}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-bold text-white transition disabled:opacity-50"
            >
              <UserPlus className="h-4 w-4" />
              {pending
                ? "Invio…"
                : selected.size > 0
                  ? `Invita (${selected.size})`
                  : "Seleziona amici"}
            </button>
          )}
        </div>
      </Modal>
    </>
  );
}
