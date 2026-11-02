import "server-only";
import { and, asc, desc, eq, gte, ilike, inArray, isNull, lt, or, sql, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/db";
import {
  articles,
  clubs,
  competitions,
  matchEvents,
  matches,
  playerClubHistory,
  players,
  seasonClubs,
  seasons,
  standingAdjustments,
  users,
  follows,
  type MatchStatus,
} from "@/db/schema";

const home = alias(clubs, "home_club");
const away = alias(clubs, "away_club");

const cardFields = {
  id: matches.id,
  kickoffAt: matches.kickoffAt,
  status: matches.status,
  currentPeriod: matches.currentPeriod,
  periodStartedAt: matches.periodStartedAt,
  homeScore: matches.homeScore,
  awayScore: matches.awayScore,
  homePens: matches.homePens,
  awayPens: matches.awayPens,
  matchday: matches.matchday,
  round: matches.round,
  stadium: matches.stadium,
  isValidated: matches.isValidated,
  seasonId: matches.seasonId,
  version: matches.version,
  updatedAt: matches.updatedAt,
  seasonName: seasons.name,
  compId: competitions.id,
  compName: competitions.name,
  compShort: competitions.shortName,
  compSlug: competitions.slug,
  compColor: competitions.color,
  compOrder: competitions.displayOrder,
  compFormat: competitions.format,
  homeId: home.id,
  homeName: home.name,
  homeShort: home.shortName,
  homeSlug: home.slug,
  homeC1: home.primaryColor,
  homeC2: home.secondaryColor,
  homeLogo: home.logoUrl,
  awayId: away.id,
  awayName: away.name,
  awayShort: away.shortName,
  awaySlug: away.slug,
  awayC1: away.primaryColor,
  awayC2: away.secondaryColor,
  awayLogo: away.logoUrl,
};

function baseMatchQuery() {
  return db
    .select(cardFields)
    .from(matches)
    .innerJoin(seasons, eq(seasons.id, matches.seasonId))
    .innerJoin(competitions, eq(competitions.id, seasons.competitionId))
    .innerJoin(home, eq(home.id, matches.homeClubId))
    .innerJoin(away, eq(away.id, matches.awayClubId));
}

type Row = Awaited<ReturnType<typeof baseMatchQuery>>[number];

function toCard(r: Row) {
  return {
    id: r.id,
    kickoffAt: r.kickoffAt,
    status: r.status,
    currentPeriod: r.currentPeriod,
    periodStartedAt: r.periodStartedAt,
    homeScore: r.homeScore,
    awayScore: r.awayScore,
    homePens: r.homePens,
    awayPens: r.awayPens,
    matchday: r.matchday,
    round: r.round,
    stadium: r.stadium,
    isValidated: r.isValidated,
    seasonId: r.seasonId,
    seasonName: r.seasonName,
    version: r.version,
    updatedAt: r.updatedAt,
    competition: { id: r.compId, name: r.compName, shortName: r.compShort, slug: r.compSlug, color: r.compColor, order: r.compOrder, format: r.compFormat },
    home: { id: r.homeId, name: r.homeName, shortName: r.homeShort, slug: r.homeSlug, primaryColor: r.homeC1, secondaryColor: r.homeC2, logoUrl: r.homeLogo },
    away: { id: r.awayId, name: r.awayName, shortName: r.awayShort, slug: r.awaySlug, primaryColor: r.awayC1, secondaryColor: r.awayC2, logoUrl: r.awayLogo },
  };
}
export type MatchCard = ReturnType<typeof toCard>;
export type ClubLite = MatchCard["home"];

export async function getMatches(opts: {
  from?: Date;
  to?: Date;
  statuses?: MatchStatus[];
  competitionId?: number;
  seasonId?: number;
  clubId?: number;
  ids?: number[];
  order?: "asc" | "desc";
  limit?: number;
}) {
  const conds: SQL[] = [];
  if (opts.from) conds.push(gte(matches.kickoffAt, opts.from));
  if (opts.to) conds.push(lt(matches.kickoffAt, opts.to));
  if (opts.statuses?.length) conds.push(inArray(matches.status, opts.statuses));
  if (opts.competitionId) conds.push(eq(competitions.id, opts.competitionId));
  if (opts.seasonId) conds.push(eq(matches.seasonId, opts.seasonId));
  if (opts.ids) conds.push(opts.ids.length ? inArray(matches.id, opts.ids) : sql`false`);
  if (opts.clubId) conds.push(or(eq(matches.homeClubId, opts.clubId), eq(matches.awayClubId, opts.clubId))!);
  const q = baseMatchQuery()
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(opts.order === "desc" ? desc(matches.kickoffAt) : asc(matches.kickoffAt), asc(matches.id))
    .limit(opts.limit ?? 500);
  return (await q).map(toCard);
}

export async function getMatchCard(id: number) {
  const rows = await baseMatchQuery().where(eq(matches.id, id)).limit(1);
  return rows[0] ? toCard(rows[0]) : null;
}

export function groupByCompetition(cards: MatchCard[]) {
  const map = new Map<number, { competition: MatchCard["competition"]; matches: MatchCard[] }>();
  for (const c of cards) {
    if (!map.has(c.competition.id)) map.set(c.competition.id, { competition: c.competition, matches: [] });
    map.get(c.competition.id)!.matches.push(c);
  }
  return [...map.values()].sort((a, b) => a.competition.order - b.competition.order);
}

export function groupByRound(cards: MatchCard[]) {
  const map = new Map<string, MatchCard[]>();
  for (const c of cards) {
    const key = c.matchday ? `Journée ${c.matchday}` : c.round ?? "Autres matchs";
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(c);
  }
  return [...map.entries()];
}

const p1 = alias(players, "p1");
const p2 = alias(players, "p2");

export async function getMatchEvents(matchId: number) {
  return db
    .select({
      id: matchEvents.id,
      type: matchEvents.type,
      clubId: matchEvents.clubId,
      playerId: matchEvents.playerId,
      relatedPlayerId: matchEvents.relatedPlayerId,
      playerName: matchEvents.playerName,
      minute: matchEvents.minute,
      extraMinute: matchEvents.extraMinute,
      note: matchEvents.note,
      createdAt: matchEvents.createdAt,
      updatedAt: matchEvents.updatedAt,
      pFirst: p1.firstName,
      pLast: p1.lastName,
      rFirst: p2.firstName,
      rLast: p2.lastName,
    })
    .from(matchEvents)
    .leftJoin(p1, eq(p1.id, matchEvents.playerId))
    .leftJoin(p2, eq(p2.id, matchEvents.relatedPlayerId))
    .where(and(eq(matchEvents.matchId, matchId), isNull(matchEvents.deletedAt)))
    .orderBy(asc(matchEvents.minute), asc(matchEvents.extraMinute), asc(matchEvents.id));
}
export type EventRow = Awaited<ReturnType<typeof getMatchEvents>>[number];

/* ------------------------------------------------------------------ */
/* Compétitions & classements                                          */
/* ------------------------------------------------------------------ */

export async function getCompetitions() {
  return db.select().from(competitions).orderBy(asc(competitions.displayOrder), asc(competitions.name));
}

export async function getCompetitionBySlug(slug: string) {
  const r = await db.select().from(competitions).where(eq(competitions.slug, slug)).limit(1);
  return r[0] ?? null;
}

export async function getSeasons(competitionId: number) {
  return db.select().from(seasons).where(eq(seasons.competitionId, competitionId)).orderBy(desc(seasons.isCurrent), desc(seasons.name));
}

export type StandingRow = ClubLite & {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  adjustment: number;
  form: ("W" | "D" | "L")[];
};

export async function computeStandings(seasonId: number) {
  const [info] = await db
    .select({ season: seasons, comp: competitions })
    .from(seasons)
    .innerJoin(competitions, eq(competitions.id, seasons.competitionId))
    .where(eq(seasons.id, seasonId))
    .limit(1);
  if (!info) return { rows: [] as StandingRow[], competition: null, adjustments: [] };
  const { comp } = info;

  const participants = await db
    .select({ id: clubs.id, name: clubs.name, shortName: clubs.shortName, slug: clubs.slug, primaryColor: clubs.primaryColor, secondaryColor: clubs.secondaryColor, logoUrl: clubs.logoUrl })
    .from(seasonClubs)
    .innerJoin(clubs, eq(clubs.id, seasonClubs.clubId))
    .where(eq(seasonClubs.seasonId, seasonId));

  const played = await getMatches({ seasonId, statuses: ["finished"] });
  const validated = played.filter((m) => m.isValidated);
  const adjustments = await db
    .select({ id: standingAdjustments.id, clubId: standingAdjustments.clubId, points: standingAdjustments.points, reason: standingAdjustments.reason, clubName: clubs.name, createdAt: standingAdjustments.createdAt })
    .from(standingAdjustments)
    .innerJoin(clubs, eq(clubs.id, standingAdjustments.clubId))
    .where(eq(standingAdjustments.seasonId, seasonId));

  const table = new Map<number, StandingRow>();
  const ensure = (c: ClubLite) => {
    if (!table.has(c.id))
      table.set(c.id, { ...c, position: 0, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, adjustment: 0, form: [] });
    return table.get(c.id)!;
  };
  participants.forEach(ensure);

  for (const m of validated) {
    const h = ensure(m.home);
    const a = ensure(m.away);
    h.played++;
    a.played++;
    h.gf += m.homeScore;
    h.ga += m.awayScore;
    a.gf += m.awayScore;
    a.ga += m.homeScore;
    if (m.homeScore > m.awayScore) {
      h.won++; a.lost++; h.points += comp.pointsWin; a.points += comp.pointsLoss;
      h.form.push("W"); a.form.push("L");
    } else if (m.homeScore < m.awayScore) {
      a.won++; h.lost++; a.points += comp.pointsWin; h.points += comp.pointsLoss;
      a.form.push("W"); h.form.push("L");
    } else {
      h.drawn++; a.drawn++; h.points += comp.pointsDraw; a.points += comp.pointsDraw;
      h.form.push("D"); a.form.push("D");
    }
  }
  for (const adj of adjustments) {
    const r = table.get(adj.clubId);
    if (r) {
      r.adjustment += adj.points;
      r.points += adj.points;
    }
  }

  const h2h = (x: number, y: number) => {
    let px = 0, py = 0, gx = 0, gy = 0;
    for (const m of validated) {
      if (m.home.id === x && m.away.id === y) { gx += m.homeScore; gy += m.awayScore; }
      else if (m.home.id === y && m.away.id === x) { gx += m.awayScore; gy += m.homeScore; }
      else continue;
      const mx = m.home.id === x ? m.homeScore : m.awayScore;
      const my = m.home.id === x ? m.awayScore : m.homeScore;
      if (mx > my) px += 3; else if (mx < my) py += 3; else { px++; py++; }
    }
    return py - px || gy - gx;
  };

  const rows = [...table.values()].map((r) => ({ ...r, gd: r.gf - r.ga, form: r.form.slice(-5) }));
  rows.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    for (const tb of comp.tiebreakers) {
      let d = 0;
      if (tb === "goal_diff") d = b.gd - a.gd;
      else if (tb === "goals_for") d = b.gf - a.gf;
      else if (tb === "wins") d = b.won - a.won;
      else if (tb === "goals_against") d = a.ga - b.ga;
      else if (tb === "head_to_head") d = h2h(a.id, b.id);
      if (d !== 0) return d;
    }
    return a.name.localeCompare(b.name);
  });
  rows.forEach((r, i) => (r.position = i + 1));
  return { rows, competition: comp, adjustments };
}

export async function getClubStandings(clubId: number) {
  const ss = await db
    .select({ seasonId: seasons.id, seasonName: seasons.name, comp: competitions })
    .from(seasonClubs)
    .innerJoin(seasons, eq(seasons.id, seasonClubs.seasonId))
    .innerJoin(competitions, eq(competitions.id, seasons.competitionId))
    .where(and(eq(seasonClubs.clubId, clubId), eq(seasons.isCurrent, true), eq(competitions.format, "league")));
  const out = [];
  for (const s of ss) {
    const { rows } = await computeStandings(s.seasonId);
    const row = rows.find((r) => r.id === clubId);
    if (row) out.push({ competition: s.comp, seasonName: s.seasonName, row, total: rows.length, rows });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Clubs & joueurs                                                     */
/* ------------------------------------------------------------------ */

export async function getClubBySlug(slug: string) {
  const r = await db.select().from(clubs).where(eq(clubs.slug, slug)).limit(1);
  return r[0] ?? null;
}

export async function getSquad(clubId: number) {
  return db.select().from(players).where(eq(players.currentClubId, clubId)).orderBy(asc(players.shirtNumber), asc(players.lastName));
}

export async function getPlayer(id: number) {
  const [p] = await db
    .select({ player: players, club: clubs })
    .from(players)
    .leftJoin(clubs, eq(clubs.id, players.currentClubId))
    .where(eq(players.id, id))
    .limit(1);
  if (!p) return null;
  const history = await db
    .select({ id: playerClubHistory.id, startDate: playerClubHistory.startDate, endDate: playerClubHistory.endDate, note: playerClubHistory.note, club: clubs })
    .from(playerClubHistory)
    .innerJoin(clubs, eq(clubs.id, playerClubHistory.clubId))
    .where(eq(playerClubHistory.playerId, id))
    .orderBy(desc(playerClubHistory.startDate));
  const goalRows = await db
    .select({ matchId: matchEvents.matchId, minute: matchEvents.minute, type: matchEvents.type })
    .from(matchEvents)
    .innerJoin(matches, eq(matches.id, matchEvents.matchId))
    .where(
      and(
        eq(matchEvents.playerId, id),
        inArray(matchEvents.type, ["goal", "penalty_goal"]),
        isNull(matchEvents.deletedAt),
        eq(matches.isValidated, true),
      ),
    );
  const goalMatches = await getMatches({ ids: [...new Set(goalRows.map((g) => g.matchId))], order: "desc" });
  return { ...p, history, goals: goalRows, goalMatches };
}

/* ------------------------------------------------------------------ */
/* Actualités                                                          */
/* ------------------------------------------------------------------ */

export async function getArticles(opts: { limit?: number; category?: string; clubId?: number; competitionId?: number; includeDrafts?: boolean } = {}) {
  const conds: SQL[] = [];
  if (!opts.includeDrafts) conds.push(eq(articles.status, "published"));
  if (opts.category) conds.push(eq(articles.category, opts.category));
  if (opts.clubId) conds.push(eq(articles.clubId, opts.clubId));
  if (opts.competitionId) conds.push(eq(articles.competitionId, opts.competitionId));
  return db
    .select({
      id: articles.id,
      title: articles.title,
      slug: articles.slug,
      excerpt: articles.excerpt,
      category: articles.category,
      coverUrl: articles.coverUrl,
      status: articles.status,
      isImportant: articles.isImportant,
      publishedAt: articles.publishedAt,
      createdAt: articles.createdAt,
      authorName: users.name,
    })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(desc(sql`coalesce(${articles.publishedAt}, ${articles.createdAt})`))
    .limit(opts.limit ?? 50);
}

export async function getArticleBySlug(slug: string) {
  const [a] = await db
    .select({ article: articles, authorName: users.name })
    .from(articles)
    .leftJoin(users, eq(users.id, articles.authorId))
    .where(eq(articles.slug, slug))
    .limit(1);
  return a ?? null;
}

/* ------------------------------------------------------------------ */
/* Recherche & favoris                                                 */
/* ------------------------------------------------------------------ */

export async function search(q: string) {
  const term = `%${q.trim()}%`;
  const [cl, co, pl] = await Promise.all([
    db.select().from(clubs).where(or(ilike(clubs.name, term), ilike(clubs.city, term), ilike(clubs.shortName, term))).limit(20),
    db.select().from(competitions).where(or(ilike(competitions.name, term), ilike(competitions.shortName, term))).limit(20),
    db
      .select({ player: players, clubName: clubs.name })
      .from(players)
      .leftJoin(clubs, eq(clubs.id, players.currentClubId))
      .where(or(ilike(players.firstName, term), ilike(players.lastName, term), ilike(sql`${players.firstName} || ' ' || ${players.lastName}`, term)))
      .limit(20),
  ]);
  return { clubs: cl, competitions: co, players: pl };
}

export async function getFollowSet(userId: number | undefined) {
  if (!userId) return new Set<string>();
  const rows = await db.select().from(follows).where(eq(follows.userId, userId));
  return new Set(rows.map((r) => `${r.targetType}:${r.targetId}`));
}
