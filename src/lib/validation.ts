import { z } from "zod";
import { PLAY_STYLES } from "./gamification";

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

export const profileSchema = z.object({
  username: usernameSchema,
  email: optionalEmail,
  nickname: z.string().trim().max(24).optional().or(z.literal("")),
  motto: z.string().trim().max(80).optional().or(z.literal("")),
  bio: z.string().trim().max(280).optional().or(z.literal("")),
  preferredFoot: z.enum(["left", "right", "both"]).optional().or(z.literal("")),
  playStyle: z.enum(styleIds).optional().or(z.literal("")),
  specialMove: z.string().trim().max(60).optional().or(z.literal("")),
  statsPublic: z.boolean().default(true),
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
  .refine((d) => d.scoreA !== d.scoreB, {
    message: "Il punteggio non può finire in parità",
    path: ["scoreB"],
  });

export type MatchInput = z.infer<typeof matchSchema>;

export const teamSchema = z.object({
  name: z.string().trim().min(2).max(32),
  player1Id: z.string().uuid(),
  player2Id: z.string().uuid(),
});

export const playerCreateSchema = z.object({
  name: z.string().trim().min(2).max(40),
  nickname: z.string().trim().max(24).optional().or(z.literal("")),
});

export const tournamentSchema = z.object({
  name: z.string().trim().min(2).max(60),
  format: z.enum([
    "league",
    "round_robin",
    "single_elim",
    "groups_knockout",
    "swiss",
  ]),
  discipline: z.enum(["singles", "doubles", "teams"]),
  description: z.string().trim().max(280).optional().or(z.literal("")),
  ranked: z.boolean().default(true),
  doubleRound: z.boolean().optional(),
  groups: z.coerce.number().int().min(1).max(8).optional(),
  advancePerGroup: z.coerce.number().int().min(1).max(8).optional(),
  swissRounds: z.coerce.number().int().min(1).max(12).optional(),
  thirdPlace: z.boolean().optional(),
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
