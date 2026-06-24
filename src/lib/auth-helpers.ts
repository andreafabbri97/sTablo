import { auth } from "@/auth";

export type SessionUser = {
  id: string;
  name?: string | null;
  email?: string | null;
  role: "admin" | "player";
  playerId: string | null;
};

export async function getCurrentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user) return null;
  return session.user as SessionUser;
}

export async function isAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

/** Throws if the caller is not an admin — use inside server actions. */
export async function assertAdmin(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") {
    throw new Error("Azione riservata all'amministratore");
  }
  return user;
}

export async function assertAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) throw new Error("Devi accedere per continuare");
  return user;
}
