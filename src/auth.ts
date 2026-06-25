import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { loginSchema } from "@/lib/validation";
import { rateLimit, clientKeyFromHeaders, RATE_LIMITS } from "@/lib/rate-limit";

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw, request) {
        // Throttle brute-force attempts per client IP. This is the real auth
        // boundary, so the limit lives here (not just in the form). When tripped
        // we fail like a normal bad-credentials attempt — no info leak about
        // whether the username exists or that a limit was hit.
        const ip = clientKeyFromHeaders(request.headers);
        if (!(await rateLimit(`login:${ip}`, RATE_LIMITS.login)).ok) return null;

        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { username, password } = parsed.data;

        const user = await db.query.users.findFirst({
          where: eq(users.username, username),
        });
        if (!user) return null;

        const ok = await compare(password, user.passwordHash);
        if (!ok) return null;

        // Blocked by an admin ("blocca profilo"): no login. We fail the same way
        // as bad credentials (null) so we don't leak that the account exists or
        // that it's specifically blocked.
        if (user.blocked) return null;

        return {
          id: user.id,
          name: user.name,
          username: user.username,
          email: user.email,
          role: user.role,
          playerId: user.playerId,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.playerId = user.playerId ?? null;
        token.username = user.username ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = (token.role as "admin" | "player") ?? "player";
        session.user.playerId = (token.playerId as string | null) ?? null;
        session.user.username = (token.username as string | null) ?? null;
      }
      return session;
    },
  },
});

/* ---- type augmentation ---- */
declare module "next-auth" {
  interface User {
    role: "admin" | "player";
    playerId: string | null;
    username: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: "admin" | "player";
      playerId: string | null;
      username: string | null;
    } & DefaultSession["user"];
  }
}

