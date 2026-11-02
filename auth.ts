import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes, createHash } from "crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users, auditLogs, matchAssignments, type Role } from "@/db/schema";
import { hashPassword, verifyPassword } from "./password";

export { hashPassword, verifyPassword };

export const SESSION_COOKIE = "senfoot_session";
const SESSION_DAYS = 30;

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(sessions).values({ id: sha(token), userId, expiresAt });
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production" && process.env.INSECURE_COOKIES !== "1",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, sha(token)));
  store.delete(SESSION_COOKIE);
}

export type SessionUser = { id: number; name: string; email: string; role: Role };

export const getCurrentUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role, active: users.active })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sha(token)), gt(sessions.expiresAt, new Date())))
    .limit(1);
  const u = rows[0];
  if (!u || !u.active) return null;
  return { id: u.id, name: u.name, email: u.email, role: u.role };
});

export const PERMS = {
  manageClubs: ["super_admin", "competition_admin"],
  managePlayers: ["super_admin", "competition_admin"],
  manageCompetitions: ["super_admin", "competition_admin"],
  scheduleMatches: ["super_admin", "competition_admin"],
  assignCorrespondents: ["super_admin", "competition_admin"],
  liveEvents: ["super_admin", "competition_admin", "match_operator", "correspondent"],
  editScores: ["super_admin", "competition_admin", "match_operator"],
  validateResults: ["super_admin", "competition_admin"],
  manageStandings: ["super_admin", "competition_admin"],
  publishArticles: ["super_admin", "competition_admin", "journalist"],
  manageUsers: ["super_admin"],
  viewAudit: ["super_admin", "competition_admin"],
  backup: ["super_admin"],
} satisfies Record<string, Role[]>;

export type Perm = keyof typeof PERMS;

export function can(user: SessionUser | null, perm: Perm) {
  return !!user && (PERMS[perm] as Role[]).includes(user.role);
}

export const isStaff = (u: SessionUser | null) => !!u && u.role !== "supporter";

export async function requireUser() {
  const u = await getCurrentUser();
  if (!u) redirect("/connexion");
  return u;
}

export async function requirePerm(perm: Perm) {
  const u = await getCurrentUser();
  if (!u) redirect("/connexion");
  if (!can(u, perm)) throw new Error("Accès refusé : droits insuffisants.");
  return u;
}

/** Vérifie qu'un utilisateur peut saisir les événements d'un match donné */
export async function canOperateMatch(user: SessionUser | null, matchId: number) {
  if (!user || !can(user, "liveEvents")) return false;
  if (user.role !== "correspondent") return true;
  const rows = await db
    .select()
    .from(matchAssignments)
    .where(and(eq(matchAssignments.matchId, matchId), eq(matchAssignments.userId, user.id)))
    .limit(1);
  return rows.length > 0;
}

export async function audit(
  userId: number | null,
  action: string,
  entityType: string,
  entityId: number | null,
  details?: Record<string, unknown>,
) {
  await db.insert(auditLogs).values({ userId, action, entityType, entityId, details: details ?? null });
}
