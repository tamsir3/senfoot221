import "server-only";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { clubs, matchEvents, matchEventRevisions, matches, players, type EventType, type MatchStatus } from "@/db/schema";
import { audit, can, canOperateMatch, type SessionUser } from "./auth";
import { EVENT_LABELS, GOAL_TYPES, STATUS_LABELS } from "./format";

export class ServiceError extends Error {}

const TEAM_TYPES: EventType[] = ["goal", "penalty_goal", "own_goal", "yellow_card", "red_card", "substitution", "shootout_scored", "shootout_missed"];

async function loadMatch(matchId: number) {
  const [m] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!m) throw new ServiceError("Match introuvable.");
  return m;
}

async function assertCanOperate(user: SessionUser, matchId: number) {
  const m = await loadMatch(matchId);
  if (!(await canOperateMatch(user, matchId))) throw new ServiceError("Vous n'êtes pas autorisé à saisir ce match.");
  if (m.isValidated && !can(user, "validateResults"))
    throw new ServiceError("Ce résultat est validé : seul un administrateur peut le modifier.");
  return m;
}

async function clubNames(m: { homeClubId: number; awayClubId: number }) {
  const rows = await db.select({ id: clubs.id, name: clubs.name }).from(clubs).where(sql`${clubs.id} in (${m.homeClubId}, ${m.awayClubId})`);
  const n = (id: number) => rows.find((r) => r.id === id)?.name ?? "";
  return { home: n(m.homeClubId), away: n(m.awayClubId) };
}

export async function notifyMatchFollowers(matchId: number, type: string, title: string, body: string) {
  const m = await loadMatch(matchId);
  await db.execute(sql`
    insert into notifications (user_id, type, title, body, url)
    select distinct f.user_id, ${type}, ${title}, ${body}, ${`/matchs/${matchId}`}
    from follows f
    left join seasons s on s.id = ${m.seasonId}
    where (f.target_type = 'club' and f.target_id in (${m.homeClubId}, ${m.awayClubId}))
       or (f.target_type = 'competition' and f.target_id = s.competition_id)
  `);
}

/** Recalcule le score et les tirs au but à partir des événements non supprimés */
export async function recomputeScore(matchId: number) {
  const m = await loadMatch(matchId);
  const evs = await db
    .select({ type: matchEvents.type, clubId: matchEvents.clubId })
    .from(matchEvents)
    .where(and(eq(matchEvents.matchId, matchId), isNull(matchEvents.deletedAt)));
  let h = 0, a = 0, hp = 0, ap = 0, shootout = false;
  for (const e of evs) {
    if (GOAL_TYPES.includes(e.type)) {
      if (e.clubId === m.homeClubId) h++;
      else if (e.clubId === m.awayClubId) a++;
    }
    if (e.type === "shootout_scored" || e.type === "shootout_missed") {
      shootout = true;
      if (e.type === "shootout_scored") {
        if (e.clubId === m.homeClubId) hp++;
        else if (e.clubId === m.awayClubId) ap++;
      }
    }
  }
  await db
    .update(matches)
    .set({
      homeScore: h,
      awayScore: a,
      homePens: shootout ? hp : null,
      awayPens: shootout ? ap : null,
      version: sql`${matches.version} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(matches.id, matchId));
  return { h, a };
}

export type EventInput = {
  matchId: number;
  type: EventType;
  clubId?: number | null;
  playerId?: number | null;
  relatedPlayerId?: number | null;
  playerName?: string | null;
  minute?: number | null;
  extraMinute?: number | null;
  note?: string | null;
  clientId?: string | null;
};

function validateInput(m: { homeClubId: number; awayClubId: number }, e: EventInput) {
  if (TEAM_TYPES.includes(e.type)) {
    if (!e.clubId || (e.clubId !== m.homeClubId && e.clubId !== m.awayClubId))
      throw new ServiceError("Veuillez sélectionner l'équipe concernée.");
  } else {
    e.clubId = null;
    e.playerId = null;
    e.relatedPlayerId = null;
  }
  if (e.minute != null && (e.minute < 0 || e.minute > 130)) throw new ServiceError("Minute invalide.");
}

export async function addEvent(user: SessionUser, input: EventInput) {
  if (input.clientId) {
    const [dup] = await db.select().from(matchEvents).where(eq(matchEvents.clientId, input.clientId)).limit(1);
    if (dup) return dup; // déjà enregistré (double envoi / réseau lent)
  }
  const m = await assertCanOperate(user, input.matchId);
  validateInput(m, input);

  const now = new Date();
  const [ev] = await db
    .insert(matchEvents)
    .values({
      matchId: input.matchId,
      type: input.type,
      clubId: input.clubId ?? null,
      playerId: input.playerId ?? null,
      relatedPlayerId: input.relatedPlayerId ?? null,
      playerName: input.playerName || null,
      minute: input.minute ?? null,
      extraMinute: input.extraMinute ?? null,
      note: input.note || null,
      clientId: input.clientId || null,
      createdBy: user.id,
    })
    .onConflictDoNothing({ target: matchEvents.clientId })
    .returning();
  if (!ev) {
    const [dup] = await db.select().from(matchEvents).where(eq(matchEvents.clientId, input.clientId!)).limit(1);
    return dup;
  }
  await db.insert(matchEventRevisions).values({ eventId: ev.id, matchId: ev.matchId, action: "create", snapshot: ev as unknown as Record<string, unknown>, userId: user.id });

  // Effets des événements de phase sur le statut
  const names = await clubNames(m);
  const label = `${names.home} ${"–"} ${names.away}`;
  const statusPatch: Partial<typeof matches.$inferInsert> = {};
  if (input.type === "kick_off") Object.assign(statusPatch, { status: "live", currentPeriod: 1, periodStartedAt: now });
  if (input.type === "half_time") Object.assign(statusPatch, { status: "halftime", periodStartedAt: null });
  if (input.type === "second_half") Object.assign(statusPatch, { status: "live", currentPeriod: 2, periodStartedAt: now });
  if (input.type === "full_time") Object.assign(statusPatch, { status: "finished", periodStartedAt: null });
  if (Object.keys(statusPatch).length) await db.update(matches).set(statusPatch).where(eq(matches.id, m.id));

  const score = await recomputeScore(m.id);

  if (input.type === "kick_off") await notifyMatchFollowers(m.id, "match_start", "Coup d'envoi", `${label} vient de commencer.`);
  if (input.type === "full_time") await notifyMatchFollowers(m.id, "match_end", "Fin du match", `Score final : ${names.home} ${score.h}-${score.a} ${names.away}`);
  if (GOAL_TYPES.includes(input.type)) {
    let scorer = input.playerName ?? "";
    if (input.playerId) {
      const [p] = await db.select().from(players).where(eq(players.id, input.playerId)).limit(1);
      if (p) scorer = `${p.firstName} ${p.lastName}`;
    }
    const team = input.clubId === m.homeClubId ? names.home : names.away;
    await notifyMatchFollowers(
      m.id,
      "goal",
      `⚽ BUT pour ${team} !`,
      `${names.home} ${score.h}-${score.a} ${names.away}${scorer ? ` — ${scorer}` : ""}${input.minute ? ` (${input.minute}')` : ""}`,
    );
  }
  await audit(user.id, "event.create", "match", m.id, { eventId: ev.id, type: ev.type, label: EVENT_LABELS[ev.type], minute: ev.minute });
  return ev;
}

export async function updateEvent(user: SessionUser, eventId: number, patch: Omit<EventInput, "matchId" | "clientId">) {
  const [old] = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId)).limit(1);
  if (!old || old.deletedAt) throw new ServiceError("Événement introuvable.");
  const m = await assertCanOperate(user, old.matchId);
  const input = { ...patch, matchId: old.matchId };
  validateInput(m, input);
  const [ev] = await db
    .update(matchEvents)
    .set({
      type: input.type,
      clubId: input.clubId ?? null,
      playerId: input.playerId ?? null,
      relatedPlayerId: input.relatedPlayerId ?? null,
      playerName: input.playerName || null,
      minute: input.minute ?? null,
      extraMinute: input.extraMinute ?? null,
      note: input.note || null,
      updatedAt: new Date(),
    })
    .where(eq(matchEvents.id, eventId))
    .returning();
  await db.insert(matchEventRevisions).values({ eventId, matchId: ev.matchId, action: "update", snapshot: { before: old, after: ev } as unknown as Record<string, unknown>, userId: user.id });
  await recomputeScore(ev.matchId);
  await audit(user.id, "event.update", "match", ev.matchId, { eventId, from: { type: old.type, minute: old.minute }, to: { type: ev.type, minute: ev.minute } });
  return ev;
}

export async function deleteEvent(user: SessionUser, eventId: number) {
  const [old] = await db.select().from(matchEvents).where(eq(matchEvents.id, eventId)).limit(1);
  if (!old || old.deletedAt) throw new ServiceError("Événement introuvable.");
  await assertCanOperate(user, old.matchId);
  await db.update(matchEvents).set({ deletedAt: new Date() }).where(eq(matchEvents.id, eventId));
  await db.insert(matchEventRevisions).values({ eventId, matchId: old.matchId, action: "delete", snapshot: old as unknown as Record<string, unknown>, userId: user.id });
  await recomputeScore(old.matchId);
  await audit(user.id, "event.delete", "match", old.matchId, { eventId, type: old.type, minute: old.minute });
}

export async function setMatchStatus(user: SessionUser, matchId: number, status: MatchStatus) {
  const m = await assertCanOperate(user, matchId);
  const patch: Partial<typeof matches.$inferInsert> = { status, version: m.version + 1, updatedAt: new Date() };
  if (status === "live" && !m.periodStartedAt) Object.assign(patch, { currentPeriod: m.currentPeriod || 1, periodStartedAt: new Date() });
  if (status !== "live") patch.periodStartedAt = null;
  await db.update(matches).set(patch).where(eq(matches.id, matchId));
  await audit(user.id, "match.status", "match", matchId, { from: m.status, to: status, label: STATUS_LABELS[status] });
}

export async function setScore(user: SessionUser, matchId: number, s: { h: number; a: number; hp: number | null; ap: number | null }) {
  if (!can(user, "editScores")) throw new ServiceError("Droits insuffisants pour modifier le score.");
  const m = await assertCanOperate(user, matchId);
  await db
    .update(matches)
    .set({ homeScore: s.h, awayScore: s.a, homePens: s.hp, awayPens: s.ap, version: m.version + 1, updatedAt: new Date() })
    .where(eq(matches.id, matchId));
  await audit(user.id, "match.score", "match", matchId, { from: `${m.homeScore}-${m.awayScore}`, to: `${s.h}-${s.a}`, pens: s.hp != null ? `${s.hp}-${s.ap}` : null });
}

export async function setValidation(user: SessionUser, matchId: number, validated: boolean) {
  if (!can(user, "validateResults")) throw new ServiceError("Droits insuffisants.");
  const m = await loadMatch(matchId);
  if (validated && m.status !== "finished") throw new ServiceError("Seul un match terminé peut être validé.");
  await db
    .update(matches)
    .set({ isValidated: validated, validatedAt: validated ? new Date() : null, validatedBy: validated ? user.id : null, version: m.version + 1, updatedAt: new Date() })
    .where(eq(matches.id, matchId));
  await audit(user.id, validated ? "match.validate" : "match.unvalidate", "match", matchId, { score: `${m.homeScore}-${m.awayScore}` });
  if (validated) {
    const names = await clubNames(m);
    await notifyMatchFollowers(matchId, "result", "Résultat officiel", `${names.home} ${m.homeScore}-${m.awayScore} ${names.away} (résultat validé)`);
  }
}
