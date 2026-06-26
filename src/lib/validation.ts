import { z } from "zod";
import { PLAY_STYLES } from "./gamification";
import { validateTavolinoScore } from "./score-rules";
import { MAX_COMMENT_LENGTH } from "./reactions";
import { MAX_MESSAGE_LENGTH } from "./chat-core";
import { CARD_BACKGROUND_IDS, DEFAULT_CARD_BACKGROUND } from "./card-backgrounds";

const styleIds = PLAY_STYLES.map((s) => s.id) as [string, ...string[]];

export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(
    /^[a-z0-9_]{3,20}$/,
    "3-20 caratteri: lettere minuscole, numeri o underscore",
  );

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email("Email non valida")
  .optional()
  .or(z.literal(""));

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, "Nome troppo corto").max(40),
    username: usernameSchema,
    password: z.string().min(8, "Minimo 8 caratteri").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Le password non coincidono",
    path: ["confirm"],
  });

export const loginSchema = z.object({
  username: usernameSchema,
  password: z.string().min(1, "Inserisci la password"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Inserisci la password attuale"),
    newPassword: z.string().min(8, "Minimo 8 caratteri").max(72),
    confirm: z.string(),
  })
  .refine((d) => d.newPassword === d.confirm, {
    message: "Le password non coincidono",
    path: ["confirm"],
  });

/**
 * Hard ceiling for an uploaded avatar (stored inline as a base64 data-URL).
 * The client resizes to a small square well below this; the cap is a safety
 * net against oversized payloads (~225 KB decoded). Stays comfortably inside
 * the Server Action body limit.
 */
export const MAX_AVATAR_DATA_URL = 300_000;

const avatarUrlSchema = z
  .string()
  .trim()
  .max(MAX_AVATAR_DATA_URL, "Immagine troppo grande, riprova con una più piccola")
  .refine(
    (v) => v === "" || /^data:image\/(png|jpe?g|webp|gif);base64,/.test(v),
    "Formato immagine non valido",
  )
  .optional()
  .or(z.literal(""));

/**
 * Optional hand-tuned attribute overrides for the FIFA card. The 1..99 bounds
 * here are just a sanity net — the real constraints (per-level per-attribute
 * cap + total-points budget) are enforced server-side via resolveAttributes.
 * An empty object means "auto" (use the derived baseline).
 */
const attributeValueSchema = z.coerce.number().int().min(1).max(99);
export const customAttributesSchema = z
  .object({
    potenza: attributeValueSchema,
    tecnica: attributeValueSchema,
    costanza: attributeValueSchema,
    difesa: attributeValueSchema,
    clutch: attributeValueSchema,
  })
  .partial();

/**
 * Instagram handle — optional. Accepts what people actually paste: "@handle",
 * a full "instagram.com/handle" URL, or the bare handle. Normalizes to the bare
 * handle (letters, numbers, "." and "_"), or "" when blank.
 */
const instagramSchema = z
  .string()
  .trim()
  .max(100)
  .transform((v) => {
    if (!v) return "";
    const urlMatch = v.match(/instagram\.com\/([^/?#\s]+)/i);
    return (urlMatch ? urlMatch[1] : v).replace(/^@+/, "").trim();
  })
  .refine((h) => h === "" || /^[a-zA-Z0-9._]{1,30}$/.test(h), {
    message: "Username Instagram non valido (lettere, numeri, . e _)",
  });

export const profileSchema = z.object({
  username: usernameSchema,
  email: optionalEmail,
  motto: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
  preferredFoot: z.enum(["left", "right", "both"]).optional().or(z.literal("")),
  playStyle: z.enum(styleIds).optional().or(z.literal("")),
  specialMove: z.string().trim().max(60).optional().or(z.literal("")),
  instagram: instagramSchema.optional(),
  avatarUrl: avatarUrlSchema,
  // Cosmetic card background slug; unknown/empty falls back to the default.
  cardBackground: z
    .enum(CARD_BACKGROUND_IDS)
    .optional()
    .default(DEFAULT_CARD_BACKGROUND),
  statsPublic: z.boolean().default(true),
  customAttributes: customAttributesSchema.optional().default({}),
});

export type ProfileInput = z.infer<typeof profileSchema>;

export const matchSchema = z
  .object({
    format: z.enum(["singles", "doubles"]),
    ranked: z.boolean().default(true),
    playedAt: z.string().optional(),
    note: z.string().trim().max(140).optional().or(z.literal("")),
    scoreA: z.coerce.number().int().min(0).max(99),
    scoreB: z.coerce.number().int().min(0).max(99),
    // singles
    playerA: z.string().uuid().optional(),
    playerB: z.string().uuid().optional(),
    // doubles
    teamA: z.string().uuid().optional(),
    teamB: z.string().uuid().optional(),
    playerA2: z.string().uuid().optional(),
    playerB2: z.string().uuid().optional(),
  })
  .superRefine((d, ctx) => {
    // Tavolino: si vince a 15 (vantaggi sul 14-14, killer point sul 19-19).
    const check = validateTavolinoScore(d.scoreA, d.scoreB);
    if (!check.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.reason,
        path: ["scoreB"],
      });
    }
  });

export type MatchInput = z.infer<typeof matchSchema>;

/**
 * Programmare una sfida: stessi lati di una partita ma SENZA punteggi.
 * Data e ora sono obbligatorie (è il senso della sfida); la validazione del
 * punteggio del tavolino arriverà al momento di registrare il risultato.
 */
export const scheduleSchema = z.object({
  format: z.enum(["singles", "doubles"]),
  ranked: z.boolean().default(true),
  playedAt: z.string().min(1, "Scegli data e ora della sfida"),
  note: z.string().trim().max(140).optional().or(z.literal("")),
  // singles
  playerA: z.string().uuid().optional(),
  playerB: z.string().uuid().optional(),
  // doubles
  teamA: z.string().uuid().optional(),
  teamB: z.string().uuid().optional(),
  playerA2: z.string().uuid().optional(),
  playerB2: z.string().uuid().optional(),
});

export type ScheduleInput = z.infer<typeof scheduleSchema>;

/** Registrare il risultato di una sfida già programmata. */
export const scheduledResultSchema = z
  .object({
    scoreA: z.coerce.number().int().min(0).max(99),
    scoreB: z.coerce.number().int().min(0).max(99),
    note: z.string().trim().max(140).optional().or(z.literal("")),
  })
  .superRefine((d, ctx) => {
    const check = validateTavolinoScore(d.scoreA, d.scoreB);
    if (!check.ok) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: check.reason,
        path: ["scoreB"],
      });
    }
  });

export type ScheduledResultInput = z.infer<typeof scheduledResultSchema>;

/** A short comment left on a match. */
export const commentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Scrivi qualcosa")
    .max(MAX_COMMENT_LENGTH, `Massimo ${MAX_COMMENT_LENGTH} caratteri`),
});

export type CommentInput = z.infer<typeof commentSchema>;

/** A single 1:1 direct-message body. */
export const messageSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, "Scrivi un messaggio")
    .max(MAX_MESSAGE_LENGTH, `Massimo ${MAX_MESSAGE_LENGTH} caratteri`),
});

export type MessageInput = z.infer<typeof messageSchema>;

/**
 * A voice note: the recorded audio as a data-URL plus its length in seconds.
 * The size cap (~1.5MB of base64) and the 60s duration keep a single note small
 * enough to live inline in the DB, matching how avatars are stored.
 */
export const voiceMessageSchema = z.object({
  audio: z
    .string()
    .regex(
      /^data:audio\/(webm|mp4|ogg|mpeg|wav)(;[^,]*)?;base64,/,
      "Formato audio non valido",
    )
    .max(2_000_000, "Vocale troppo pesante"),
  duration: z
    .number()
    .int()
    .min(1, "Vocale troppo corto")
    .max(60, "Massimo 60 secondi"),
});

export type VoiceMessageInput = z.infer<typeof voiceMessageSchema>;

export const teamSchema = z.object({
  name: z.string().trim().min(2).max(32),
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
});

export const playerCreateSchema = z.object({
  name: z.string().trim().min(2).max(40),
});

/** Single match/game score: a non-negative integer in a sane range. */
export const scoreValueSchema = z.coerce.number().int().min(0).max(99);

/** Allowed tournament formats — kept in sync with the `tournament_format` DB enum. */
export const tournamentFormatSchema = z.enum([
  "league",
  "round_robin",
  "single_elim",
  "groups_knockout",
  "swiss",
  "americano",
]);

/** Allowed disciplines — kept in sync with the `tournament_discipline` DB enum. */
export const tournamentDisciplineSchema = z.enum(["singles", "doubles", "teams"]);

export const tournamentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  format: tournamentFormatSchema,
  discipline: tournamentDisciplineSchema,
  description: z.string().trim().max(280).optional().or(z.literal("")),
  ranked: z.boolean().default(true),
  doubleRound: z.boolean().optional(),
  groups: z.coerce.number().int().min(1).max(8).optional(),
  advancePerGroup: z.coerce.number().int().min(1).max(8).optional(),
  swissRounds: z.coerce.number().int().min(1).max(12).optional(),
  thirdPlace: z.boolean().optional(),
  /** americano: target score per game + number of rotation rounds */
  targetScore: z.coerce.number().int().min(1).max(99).optional(),
  americanoRounds: z.coerce.number().int().min(1).max(20).optional(),
  /** singles → player ids; teams → team ids. Empty for ad-hoc doubles. */
  entrantIds: z.array(z.string()).default([]),
  /** ad-hoc doubles couples (two player ids), no registered team needed. */
  pairs: z
    .array(
      z.object({
        playerId: z.string().min(1),
        partnerId: z.string().min(1),
      }),
    )
    .default([]),
}).superRefine((d, ctx) => {
  if (d.format === "americano") {
    // Americano is always individual (singles) and needs a full court.
    if (d.entrantIds.length < 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "L'Americano richiede almeno 4 giocatori",
        path: ["entrantIds"],
      });
    }
    return;
  }
  if (d.discipline === "doubles") {
    if (d.pairs.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Servono almeno 2 coppie",
        path: ["pairs"],
      });
    }
  } else if (d.entrantIds.length < 2) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Servono almeno 2 partecipanti",
      path: ["entrantIds"],
    });
  }
});

export type TournamentInput = z.infer<typeof tournamentSchema>;
