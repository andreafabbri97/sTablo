import "dotenv/config";
import { pathToFileURL } from "node:url";
import { hash } from "bcryptjs";
import { eq, and, or } from "drizzle-orm";
import { db } from "./index";
import { players, users, teams, friendships } from "./schema";
import { slugify, colorFromString } from "../utils";

/* The founding crew of the tavolino — names from Rimini. */
const FRIENDS = [
  { name: "Davide Brunelli",    nickname: "mesh",  playStyle: "bomber",     foot: "left",  special: "Bordata da fondo tavolo",   motto: "Se la prendo, è punto." },
  { name: "Luca Bernucci",      nickname: "bernu", playStyle: "muro",       foot: "left",  special: "Salvataggio impossibile",   motto: "Non passa nessuno." },
  { name: "Edoardo Merlanti",   nickname: "edo",   playStyle: "regista",    foot: "right", special: "Smorzata a sorpresa",       motto: "Comando io il ritmo." },
  { name: "Andrea Toraldo",     nickname: "toro",  playStyle: "tank",       foot: "right", special: "Incornata di testa",        motto: "Spingo finché non mollano." },
  { name: "Federico D'Addario", nickname: "dadda", playStyle: "cecchino",   foot: "left",  special: "Angolo chirurgico",         motto: "Miro e chiudo." },
  { name: "Fabio Pauri",        nickname: "pau",   playStyle: "fulmine",    foot: "right", special: "Contropiede lampo",         motto: "Primo su ogni pallone." },
  { name: "Jacopo Angelino",    nickname: "jaco",  playStyle: "highlander", foot: "right", special: "Killer point garantito",    motto: "Nei punti caldi ci sono io." },
];

/* Fabbro = admin + giocatore */
const FABBRO = {
  name: "Andrea Fabbri",
  nickname: "fabbro",
  playStyle: "regista",
  foot: "right" as const,
  special: "Tattica d'autore",
  motto: "Il campo digitale è mio.",
};

export async function seed() {
  console.log("🌱 Seeding sTablo…");

  const friendPassword = process.env.FRIEND_PASSWORD || "tavolino26";

  // --- players + accounts for the 7 friends ---
  const allNickToUserId = new Map<string, string>();
  const nickToPlayerId = new Map<string, string>();

  for (const f of FRIENDS) {
    const slug = slugify(f.nickname);
    let player = await db.query.players.findFirst({ where: eq(players.slug, slug) });
    if (!player) {
      const [row] = await db.insert(players).values({
        name: f.name, nickname: f.nickname, slug,
        avatarColor: colorFromString(f.name),
        playStyle: f.playStyle,
        preferredFoot: f.foot as "left" | "right" | "both",
        specialMove: f.special, motto: f.motto,
      }).returning();
      player = row;
      console.log(`  + giocatore ${f.name} (${f.nickname})`);
    } else if (player.preferredFoot !== f.foot) {
      await db.update(players).set({ preferredFoot: f.foot as "left" | "right" | "both" }).where(eq(players.id, player.id));
      console.log(`  ~ piede ${f.nickname} → ${f.foot}`);
    }
    nickToPlayerId.set(f.nickname, player.id);

    let existingUser = await db.query.users.findFirst({ where: eq(users.playerId, player.id) });
    if (!existingUser) {
      const [u] = await db.insert(users).values({
        name: f.name, username: f.nickname,
        passwordHash: await hash(friendPassword, 10),
        role: "player", playerId: player.id,
      }).returning();
      existingUser = u;
      console.log(`  + account @${f.nickname} / ${friendPassword}`);
    } else {
      const patch: { username?: string; email?: null } = {};
      if (!existingUser.username) patch.username = f.nickname;
      if (existingUser.email?.endsWith("@stablo.app")) patch.email = null;
      if (Object.keys(patch).length > 0) {
        await db.update(users).set(patch).where(eq(users.id, existingUser.id));
        console.log(`  ~ account @${f.nickname} aggiornato`);
      }
    }
    allNickToUserId.set(f.nickname, existingUser.id);
  }

  // --- Fabbro: admin + giocatore ---
  const fabbro_slug = slugify(FABBRO.nickname);
  let fabbro_player = await db.query.players.findFirst({ where: eq(players.slug, fabbro_slug) });
  if (!fabbro_player) {
    const [row] = await db.insert(players).values({
      name: FABBRO.name, nickname: FABBRO.nickname, slug: fabbro_slug,
      avatarColor: colorFromString(FABBRO.name),
      playStyle: FABBRO.playStyle, preferredFoot: FABBRO.foot,
      specialMove: FABBRO.special, motto: FABBRO.motto,
    }).returning();
    fabbro_player = row;
    console.log(`  + giocatore ${FABBRO.name} (${FABBRO.nickname})`);
  }
  nickToPlayerId.set(FABBRO.nickname, fabbro_player.id);

  // Try to find existing admin account (by username "admin" OR by username "fabbro")
  const adminPassword = process.env.ADMIN_PASSWORD || "tavolino2026";
  let fabbro_user =
    (await db.query.users.findFirst({ where: eq(users.username, "fabbro") })) ??
    (await db.query.users.findFirst({ where: eq(users.username, "admin") }));

  if (!fabbro_user) {
    const [u] = await db.insert(users).values({
      name: FABBRO.name, username: "fabbro",
      passwordHash: await hash(adminPassword, 10),
      role: "admin", playerId: fabbro_player.id,
    }).returning();
    fabbro_user = u;
    console.log(`  + admin @fabbro / ${adminPassword}`);
  } else {
    // Make sure admin is linked to Fabbro player profile
    const patch: Record<string, unknown> = { role: "admin" };
    if (!fabbro_user.playerId) patch.playerId = fabbro_player.id;
    if (fabbro_user.username !== "fabbro") patch.username = "fabbro";
    if (fabbro_user.name !== FABBRO.name) patch.name = FABBRO.name;
    if (Object.keys(patch).filter(k => k !== 'role' || fabbro_user!.role !== 'admin').length > 0) {
      await db.update(users).set(patch).where(eq(users.id, fabbro_user.id));
      console.log(`  ~ admin aggiornato come @fabbro (${FABBRO.name})`);
    }
  }
  allNickToUserId.set(FABBRO.nickname, fabbro_user.id);

  // --- teams ---
  const teamDefs: [string, string, string][] = [
    ["Spiaggia Brothers", "mesh", "bernu"],
    ["Muro & Cecchino", "edo", "dadda"],
  ];
  for (const [name, n1, n2] of teamDefs) {
    const slug = slugify(name);
    const exists = await db.query.teams.findFirst({ where: eq(teams.slug, slug) });
    if (exists) continue;
    const [p1, p2] = [nickToPlayerId.get(n1)!, nickToPlayerId.get(n2)!].sort();
    await db.insert(teams).values({ name, slug, player1Id: p1, player2Id: p2, avatarColor: colorFromString(name) });
    console.log(`  + team ${name}`);
  }

  // --- mutual friendships between everyone (8 players total) ---
  const allUserIds = [...allNickToUserId.values()];
  let friendsAdded = 0;
  for (let i = 0; i < allUserIds.length; i++) {
    for (let j = i + 1; j < allUserIds.length; j++) {
      const [a, b] = [allUserIds[i], allUserIds[j]].sort();
      const exists = await db.query.friendships.findFirst({
        where: and(
          or(eq(friendships.requesterId, a), eq(friendships.requesterId, b)),
          or(eq(friendships.addresseeId, a), eq(friendships.addresseeId, b)),
        ),
      });
      if (!exists) {
        await db.insert(friendships).values({
          requesterId: a, addresseeId: b, status: "accepted",
          respondedAt: new Date(),
        });
        friendsAdded++;
      }
    }
  }
  if (friendsAdded > 0) console.log(`  + ${friendsAdded} amicizie tra i giocatori`);

  // Demo matches are intentionally NOT auto-seeded here. They used to be created
  // whenever the matches table was empty — but this seed re-runs on every deploy
  // (see scripts/predeploy.ts), so removing them (admin → "Rimuovi demo") only
  // stuck until the next deploy saw an empty table, looked "brand new" again, and
  // recreated them: the zombie-demo bug. Demo data is now purely admin-managed
  // from the admin panel (Genera / Rimuovi demo), so a deletion is permanent.
  // This seed only ensures the core accounts/teams/friendships exist.

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
