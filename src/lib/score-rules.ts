/**
 * Tavolino scoring rule (pure, no IO).
 *
 * Si vince arrivando a `target` (default 15) con almeno 2 punti di scarto.
 * Sul (target-1)-(target-1) — il 14-14 con target 15 — si va ai vantaggi: si
 * continua finché qualcuno conduce di 2 punti. Al killer point, cioè sul
 * (target+4)-(target+4) — il 19-19 — il punto successivo è decisivo:
 * (target+5)-(target+4) = 20-19 è il punteggio massimo possibile.
 *
 * Vale per le partite casual e per i tornei "classici" (sempre a 15). L'Americano
 * usa un punteggio per game configurabile ed è volutamente libero, quindi non
 * passa di qui.
 */
export const TAVOLINO_TARGET = 15;

export type ScoreCheck = { ok: true } | { ok: false; reason: string };

export function validateTavolinoScore(
  scoreA: number,
  scoreB: number,
  target: number = TAVOLINO_TARGET,
): ScoreCheck {
  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB)) {
    return { ok: false, reason: "I punteggi devono essere numeri interi" };
  }
  if (scoreA < 0 || scoreB < 0) {
    return { ok: false, reason: "I punteggi non possono essere negativi" };
  }
  if (scoreA === scoreB) {
    return { ok: false, reason: "Il punteggio non può finire in parità" };
  }

  const w = Math.max(scoreA, scoreB);
  const l = Math.min(scoreA, scoreB);
  const deuceFloor = target - 1; // 14: da qui in poi si gioca ai vantaggi
  const killer = target + 5; // 20: punteggio massimo (killer point)

  // Vittoria netta: arrivati a `target` con l'avversario fermo ad almeno -2.
  if (w === target) {
    return l <= target - 2
      ? { ok: true }
      : { ok: false, reason: `Sul ${deuceFloor}-${deuceFloor} si va ai vantaggi` };
  }

  // Vantaggi: oltre il target si chiude con esattamente 2 punti di scarto,
  // fino al killer point.
  if (w > target && w < killer) {
    if (l < deuceFloor) {
      return { ok: false, reason: `La partita si chiude a ${target}` };
    }
    return w - l === 2
      ? { ok: true }
      : { ok: false, reason: "Ai vantaggi serve uno scarto di 2 punti" };
  }

  // Killer point: sul (target+4)-(target+4) il punto successivo decide.
  if (w === killer) {
    return l === killer - 1
      ? { ok: true }
      : { ok: false, reason: `Il punto secco vale solo sul ${killer - 1}-${killer - 1}` };
  }

  // w < target → nessuno ha ancora vinto; w > killer → oltre il massimo.
  if (w < target) {
    return { ok: false, reason: `Serve arrivare a ${target} per vincere` };
  }
  return { ok: false, reason: `Punteggio massimo ${killer}-${killer - 1}` };
}
