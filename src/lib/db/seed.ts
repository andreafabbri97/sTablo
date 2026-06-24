import "dotenv/config";
import { pathToFileURL } from "node:url";
import { hash } from "bcryptjs";
import { eq, and, or, isNull, isNotNull } from "drizzle-orm";
import { db } from "./index";
import { players, users, teams, matches } from "./schema";
import { applyMatchResult, recomputeAllElo } from "../match-engine";
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

/* Demo matches so the rankings aren't empty (delete them anytime).
   Tavolino: si vince arrivando a 18. 10 singolo + 10 doppio,
   metà classificate (ranked) e metà amichevoli. */
type DemoSingle = [string, string, number, number, boolean];
type DemoDouble = [[string, string], [string, string], number, number, boolean];

const DEMO_SINGLES: DemoSingle[] = [
  ["mesh", "bernu", 18, 15, true],
  ["edo", "toro", 18, 16, true],
  ["dadda", "pau", 14, 18, true],
  ["jaco", "mesh", 18, 17, true],
  ["bernu", "edo", 18, 12, true],
  ["toro", "dadda", 16, 18, false],
  ["pau", "jaco", 18, 14, false],
  ["mesh", "edo", 18, 13, false],
  ["bernu", "pau", 11, 18, false],
  ["dadda", "jaco", 20, 18, false],
];

const DEMO_DOUBLES: DemoDouble[] = [
  [["mesh", "bernu"], ["edo", "toro"], 18, 15, true],
  [["dadda", "pau"], ["jaco", "mesh"], 16, 18, true],
  [["bernu", "edo"], ["toro", "dadda"], 18, 11, true],
  [["pau", "jaco"], ["mesh", "edo"], 18, 16, true],
  [["toro", "bernu"], ["dadda", "jaco"], 14, 18, true],
  [["mesh", "toro"], ["edo", "pau"], 18, 13, false],
  [["bernu", "jaco"], ["dadda", "mesh"], 18, 17, false],
  [["edo", "dadda"], ["pau", "toro"], 15, 18, false],
  [["jaco", "bernu"], ["mesh", "pau"], 18, 9, false],
  [["toro", "edo"], ["dadda", "bernu"], 20, 18, false],
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

    // login account linked to the profile — username = nickname, email empty
    const existingUser = await db.query.users.findFirst({
      where: eq(users.playerId, playerId),
    });
    if (!existingUser) {
      await db.insert(users).values({
        name: f.name,
        username: f.nickname,
        passwordHash: await hash(friendPassword, 10),
        role: "player",
        playerId,
      });
      console.log(`  + account @${f.nickname} / ${friendPassword}`);
    } else {
      // migrate accounts created before usernames existed
      const patch: { username?: string; email?: null } = {};
      if (!existingUser.username) patch.username = f.nickname;
      if (existingUser.email?.endsWith("@stablo.app")) patch.email = null;
      if (Object.keys(patch).length > 0) {
        await db.update(users).set(patch).where(eq(users.id, existingUser.id));
        console.log(`  ~ account @${f.nickname} aggiornato`);
      }
    }
  }

  // --- super admin ---
  const adminUsername = (process.env.ADMIN_USERNAME || "admin").toLowerCase();
  const adminEmail = (process.env.ADMIN_EMAIL || "admin@stablo.app").toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "tavolino2026";
  let admin = await db.query.users.findFirst({
    where: eq(users.username, adminUsername),
  });
  if (!admin) {
    admin = await db.query.users.findFirst({
      where: eq(users.email, adminEmail),
    });
  }
  if (!admin) {
    await db.insert(users).values({
      name: "Super Admin",
      username: adminUsername,
      passwordHash: await hash(adminPassword, 10),
      role: "admin",
    });
    console.log(`  + superadmin @${adminUsername} / ${adminPassword}  (CAMBIA LA PASSWORD!)`);
  } else if (!admin.username) {
    await db
      .update(users)
      .set({ username: adminUsername, role: "admin" })
      .where(eq(users.id, admin.id));
    console.log(`  ~ superadmin @${adminUsername} aggiornato`);
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

  // --- demo matches ---
  // "demo" = casual seeded matches (no creator, no tournament). We keep the
  // demo set in sync ONLY while there's no real activity yet; as soon as the
  // admin records a real match or creates a tournament, we stop managing demo
  // entirely (so you can delete it for good).
  const realMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(or(isNotNull(matches.createdById), isNotNull(matches.tournamentId)));
  const demoMatches = await db
    .select({ id: matches.id })
    .from(matches)
    .where(and(isNull(matches.createdById), isNull(matches.tournamentId)));

  const total = DEMO_SINGLES.length + DEMO_DOUBLES.length;

  if (realMatches.length === 0 && demoMatches.length !== total) {
    if (demoMatches.length > 0) {
      await db
        .delete(matches)
        .where(and(isNull(matches.createdById), isNull(matches.tournamentId)));
      console.log(`  - rimosse ${demoMatches.length} partite demo obsolete`);
    }

    let i = 0;
    const nick = (n: string) => nickToId.get(n)!;

    const insertMatch = async (
      format: "singles" | "doubles",
      aIds: string[],
      bIds: string[],
      sa: number,
      sb: number,
      ranked: boolean,
    ) => {
      const playedAt = new Date(Date.now() - (total - i) * 43200000);
      i++;
      await db.transaction(async (tx) => {
        const [m] = await tx
          .insert(matches)
          .values({
            format,
            status: "completed",
            ranked,
            scoreA: sa,
            scoreB: sb,
            winner: sa > sb ? "A" : "B",
            playedAt,
          })
          .returning({ id: matches.id });
        await applyMatchResult(tx, {
          matchId: m.id,
          format,
          sideA: { playerIds: aIds, teamId: null },
          sideB: { playerIds: bIds, teamId: null },
          scoreA: sa,
          scoreB: sb,
          ranked,
        });
      });
    };

    for (const [a, b, sa, sb, r] of DEMO_SINGLES) {
      await insertMatch("singles", [nick(a)], [nick(b)], sa, sb, r);
    }
    for (const [pa, pb, sa, sb, r] of DEMO_DOUBLES) {
      await insertMatch(
        "doubles",
        [nick(pa[0]), nick(pa[1])],
        [nick(pb[0]), nick(pb[1])],
        sa,
        sb,
        r,
      );
    }
    // Rebuild ratings cleanly from the full (chronological) demo set.
    await recomputeAllElo();
    console.log(`  + ${total} partite demo (10 singolo + 10 doppio)`);
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
