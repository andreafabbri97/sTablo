import "dotenv/config";
import { pathToFileURL } from "node:url";
import { hash } from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { db } from "./index";
import { players, users, teams, matches } from "./schema";
import { insertDemoMatches } from "../demo";
import { slugify, colorFromString } from "../utils";

/* The founding crew of the tavolino — names from Rimini. */
const FRIENDS = [
  { name: "Davide Brunelli", nickname: "mesh", playStyle: "bomber", foot: "left", special: "Bordata da fondo tavolo", motto: "Se la prendo, è punto." },
  { name: "Luca Bernucci", nickname: "bernu", playStyle: "muro", foot: "left", special: "Salvataggio impossibile", motto: "Non passa nessuno." },
  { name: "Edoardo Merlanti", nickname: "edo", playStyle: "regista", foot: "right", special: "Smorzata a sorpresa", motto: "Comando io il ritmo." },
  { name: "Andrea Toraldo", nickname: "toro", playStyle: "tank", foot: "right", special: "Incornata di testa", motto: "Spingo finché non mollano." },
  { name: "Federico D'Addario", nickname: "dadda", playStyle: "cecchino", foot: "left", special: "Angolo chirurgico", motto: "Miro e chiudo." },
  { name: "Fabio Pauri", nickname: "pau", playStyle: "fulmine", foot: "right", special: "Contropiede lampo", motto: "Primo su ogni pallone." },
  { name: "Jacopo Angelino", nickname: "jaco", playStyle: "highlander", foot: "right", special: "Killer point garantito", motto: "Nei punti caldi ci sono io." },
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
    } else if (player.preferredFoot !== f.foot) {
      // correct the preferred foot on pre-existing seeded profiles
      await db
        .update(players)
        .set({ preferredFoot: f.foot as "left" | "right" | "both" })
        .where(eq(players.id, player.id));
      console.log(`  ~ piede ${f.nickname} → ${f.foot}`);
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

  // --- demo matches (only on a brand-new, empty database) ---
  // After the first time, demo data is managed entirely from the admin panel,
  // so deploys never resurrect matches the admin has removed.
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(matches);
  if (count === 0) {
    const n = await insertDemoMatches();
    console.log(`  + ${n} partite demo (10 singolo + 10 doppio)`);
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
