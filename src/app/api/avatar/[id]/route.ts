import { connection } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { players } from "@/lib/db/schema";

/**
 * Serves a player's avatar (stored in the DB as a base64 data-URL) as a real
 * image with a long, immutable cache. Callers link here via `avatarSrc()` with a
 * `?v=<hash>` that changes when the avatar changes, so the immutable cache is
 * safe — the browser/CDN fetch each avatar once instead of re-parsing the same
 * base64 inline in every payload.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  await connection();
  const { id } = await params;
  const row = await db.query.players.findFirst({
    where: eq(players.id, id),
    columns: { avatarUrl: true },
  });
  const data = row?.avatarUrl;
  const match = data?.startsWith("data:")
    ? /^data:([^;]+);base64,([\s\S]*)$/.exec(data)
    : null;
  if (!match) return new Response(null, { status: 404 });

  const bytes = Buffer.from(match[2], "base64");
  return new Response(bytes, {
    headers: {
      "Content-Type": match[1],
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
