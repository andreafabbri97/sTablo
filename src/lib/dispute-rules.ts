/**
 * Pure decision logic for the dispute / "conteso" flow (Livello 2). Kept free
 * of DB/IO so it can be unit-tested in isolation — the server actions and the
 * auto-confirm cron feed it plain data and act on the boolean it returns.
 */

/** Max length we store/accept for a free-form dispute reason. */
export const MAX_DISPUTE_REASON = 200;

/** Preset reasons offered in the Contesta UI (the opponent can also free-type). */
export const DISPUTE_REASON_PRESETS = [
  "Il punteggio non è corretto",
  "Non ho giocato questa partita",
  "Non eravamo noi a giocare",
] as const;

/** Shown/stored when a contestation arrives without an explicit reason. */
export const DISPUTE_REASON_FALLBACK = "Nessun motivo indicato";

/** Normalize a user-supplied dispute reason: trim + clamp, fallback if empty. */
export function normalizeDisputeReason(raw: string | null | undefined): string {
  const trimmed = (raw ?? "").trim().slice(0, MAX_DISPUTE_REASON);
  return trimmed.length > 0 ? trimmed : DISPUTE_REASON_FALLBACK;
}

export type AutoConfirmCandidate = {
  /** ranked = affects Elo; only ranked matches carry fabrication risk */
  ranked: boolean;
  /** a "conteso" result (disputedAt set) is awaiting an admin decision */
  disputed: boolean;
  /** true if the two sides already have a COMPLETED match together */
  hasPriorMeeting: boolean;
};

/**
 * Decide whether an expired pending result may auto-confirm on the opponent's
 * behalf. Two guards protect against fabricated ranked matches:
 *  - a contested ("conteso") result NEVER auto-confirms — an admin arbitrates;
 *  - a ranked result between two sides that have NEVER completed a match before
 *    requires an explicit human confirm, so a fabricated *first* encounter
 *    can't silently settle against an inactive victim.
 * Friendly (non-ranked) matches grant no Elo, so they auto-confirm freely.
 */
export function canAutoConfirm(c: AutoConfirmCandidate): boolean {
  if (c.disputed) return false;
  if (!c.ranked) return true;
  return c.hasPriorMeeting;
}
