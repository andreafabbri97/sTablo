/**
 * Feature flags.
 *
 * TEAMS_ENABLED — the "team" concept (registered pairs with a shared alias and
 * a doubles Elo) is hidden for now. The user plans to reintroduce it later,
 * reworked as "club". All the team backend stays in place (DB schema, queries,
 * server actions, Elo, tournament discipline); only the user-facing entry
 * points are gated behind this flag, so re-exposing it is a one-line change.
 *
 * Typed as `boolean` (not the `false` literal) on purpose: it keeps the gated
 * branches from being flagged as constant/unreachable conditions by the linter.
 */
export const TEAMS_ENABLED: boolean = false;
