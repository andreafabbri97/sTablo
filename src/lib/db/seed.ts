import "dotenv/config";
import { pathToFileURL } from "node:url";
import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { players, users, teams, matches } from "./schema";
import { applyMatchResult } from "../match-engine";
import { slugify, colorFromString } from "../utils";

/* The founding crew of the tavolino — names from Rimini. */
const FRIENDS = [
  { name: "Davide Brunelli", nickname: "mesh", playStyle: "bomber", foot: "right", special: "Bordata da fondo tavolo", motto: "Se la prendo, è punto." },
  { name: "Luca Bernucci", nickname: "bernu", playStyle: "muro", foot: "left", special: "Salvataggio impossibile", motto: "Non passa nessuno." },
  { name: "Edoardo Merlanti", nickname: "edo", playStyle: "regista", foot: "right", special: "Smorzata a sorpresa", motto: "Comando io il ritmo." },
  { name: "Andrea Toraldo", nickname: "toro", playStyle: "tank", foot: "both", special: "Incornata di testa", motto: "Spingo finché non mollano." },
  { name: "Federico D'Addario", nickname: "dadda", playStyle: "cecchino", foot: "right", special: "Angolo chirurgico", motto: "Miro e chiudo." },
  { name: "Fabio Pauri", nickname: "pau", playStyle: "fulmine", foot: "left", special: "Contropiede lampo", motto: "Primo su ogni pallone." },
  { name: "Jacopo Angelino", nickname: "jaco", playStyle: "highlander", foot: "right", special: "Killer point garantito", motto: "Nei punti caldi ci sono io." },
];

/* Demo matches so the rankings aren't empty (delete them anytime). */
const DEMO_MATCHES: [string, string, number, number][] = [
  ["mesh", "bernu", 15, 11],
  ["edo", "toro", 15, 13],
  ["dadda", "pau", 11, 15],
  ["jaco", "mesh", 17, 15],
  ["bernu", "edo", 15, 9],
  ["toro", "dadda", 12, 15],
  ["pau", "jaco", 15, 14],
  ["mesh", "edo", 15, 12],
  ["bernu", "pau", 9, 15],
  ["dadda", "jaco", 15, 17],
];

export async function seed() {
  console.log("🌱 Seeding sTablo…");

  // --- players + their accounts ---
  const friendPassword = process.env.FRIEND_PASSWORD || "tavolino26";
  const nickToId = new Map<string, string>();
  for (const f of FRIENDS) {
    const slug = slugify(f.nickname);
    let player = await db.query.players.findFirst({
      where: eq(players.slug, slug),
    });
    if (!player) {
      const [row] = await db
        .insert(players)
        .values({
          name: f.name,
          nickname: f.nickname,
          slug,
          avatarColor: colorFromString(f.name),
          playStyle: f.playStyle,
          preferredFoot: f.foot as "left" | "right" | "both",
          specialMove: f.special,
          motto: f.motto,
        })
        .returning();
      player = row;
      console.log(`  + giocatore ${f.name} (${f.nickname})`);
    }
    const playerId = player!.id;
    nickToId.set(f.nickname, playerId);

    // login account linked to the profile
    const email = `${f.nickname}@stablo.app`;
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email),
    });
    if (!existingUser) {
      await db.insert(users).values({
        name: f.name,
        email,
        passwordHash: await hash(friendPassword, 10),
        role: "player",
        playerId,
      });
      console.log(`  + account ${email} / ${friendPassword}`);
    }
  }

  // --- super admin ---
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@stablo.app").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "tavolino2026";
  const adminExists = await db.query.users.findFirst({
    where: eq(users.email, adminEmail),
  });
  if (!adminExists) {
    await db.insert(users).values({
      name: "Super Admin",
      email: adminEmail,
      passwordHash: await hash(adminPassword, 10),
      role: "admin",
    });
    console.log(`  + superadmin ${adminEmail} / ${adminPassword}  (CAMBIA LA PASSWORD!)`);
  }

  // --- a couple of teams ---
  const teamDefs: [string, string, string][] = [
    ["Spiaggia Brothers", "mesh", "bernu"],
    ["Muro & Cecchino", "edo", "dadda"],
  ];
  for (const [name, n1, n2] of teamDefs) {
    const slug = slugify(name);
    const exists = await db.query.teams.findFirst({ where: eq(teams.slug, slug) });
    if (exists) continue;
    const [p1, p2] = [nickToId.get(n1)!, nickToId.get(n2)!].sort();
    await db.insert(teams).values({
      name,
      slug,
      player1Id: p1,
      player2Id: p2,
      avatarColor: colorFromString(name),
    });
    console.log(`  + team ${name}`);
  }

  // --- demo matches (only if none exist) ---
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches);
  if (count === 0) {
    let i = 0;
    for (const [aNick, bNick, sa, sb] of DEMO_MATCHES) {
      const a = nickToId.get(aNick)!;
      const b = nickToId.get(bNick)!;
      const playedAt = new Date(Date.now() - (DEMO_MATCHES.length - i) * 86400000);
      await db.transaction(async (tx) => {
        const [m] = await tx
          .insert(matches)
          .values({
            format: "singles",
            status: "completed",
            ranked: true,
            scoreA: sa,
            scoreB: sb,
            winner: sa > sb ? "A" : "B",
            playedAt,
          })
          .returning({ id: matches.id });
        await applyMatchResult(tx, {
          matchId: m.id,
          format: "singles",
          sideA: { playerIds: [a], teamId: null },
          sideB: { playerIds: [b], teamId: null },
          scoreA: sa,
          scoreB: sb,
          ranked: true,
        });
      });
      i++;
    }
    console.log(`  + ${DEMO_MATCHES.length} partite demo`);
  }

  console.log("✅ Seed completato.");
}

// Run directly via `npm run db:seed`
const isDirectRun =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isDirectRun) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("❌ Seed fallito:", err);
      process.exit(1);
    });
}
