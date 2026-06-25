import { Avatar } from "@/components/ui/avatar";

/**
 * The shape every player picker (match, challenge, team, tournament) speaks.
 * Only id + name are required; the rest enrich the row when the query provides
 * them, so lean callers keep working and richer ones show avatar + handle.
 */
export type PlayerOption = {
  id: string;
  name: string;
  nickname?: string | null;
  username?: string | null;
  avatarColor?: number;
  avatarUrl?: string | null;
};

/** Secondary line for a player: nickname and/or @username, when present. */
export function playerSubLabel(p: PlayerOption): string {
  return [p.nickname, p.username ? `@${p.username}` : null]
    .filter(Boolean)
    .join(" · ");
}

/**
 * Avatar + name (+ nickname/username) block, used inside every picker list so
 * the look stays consistent. Meant to sit in a flex row; the text takes the
 * remaining space and truncates.
 */
export function PlayerOptionLabel({
  player,
  size = "sm",
}: {
  player: PlayerOption;
  size?: "xs" | "sm" | "md";
}) {
  const sub = playerSubLabel(player);
  return (
    <>
      <Avatar
        name={player.name}
        colorIndex={player.avatarColor ?? 0}
        imageUrl={player.avatarUrl}
        size={size}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">
          {player.name}
        </span>
        {sub && (
          <span className="block truncate text-xs text-muted">{sub}</span>
        )}
      </span>
    </>
  );
}
