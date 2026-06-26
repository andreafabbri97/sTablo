import { cn } from "@/lib/utils";

/**
 * A player's display name with their account handle (@username) on a second,
 * smaller muted line. Used everywhere a player is shown so you can always tell
 * exactly who's who and there are never omonymy mix-ups. Renders two stacked
 * block <span>s (a Fragment), meant to drop into an existing `min-w-0` container
 * next to an Avatar — matching the picker / match-card treatment used app-wide.
 *
 * `username` is null for account-less players; then only the name renders.
 */
export function PlayerName({
  name,
  username,
  nameClassName,
  handleClassName,
}: {
  name: string;
  username: string | null | undefined;
  /** Typography for the name line (size / weight / colour). Caller owns it. */
  nameClassName?: string;
  /** Override for the @handle line (defaults to a small muted style). */
  handleClassName?: string;
}) {
  return (
    <>
      <span className={cn("block truncate font-semibold", nameClassName)}>
        {name}
      </span>
      {username ? (
        <span
          className={cn(
            "block truncate text-xs font-medium text-muted",
            handleClassName,
          )}
        >
          @{username}
        </span>
      ) : null}
    </>
  );
}
