"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  articles,
  clubs,
  competitions,
  matchAssignments,
  matches,
  playerClubHistory,
  players,
  seasonClubs,
  seasons,
  standingAdjustments,
  users,
  roleEnum,
  type Role,
} from "@/db/schema";
import { audit, hashPassword, requirePerm, getCurrentUser, can } from "@/lib/auth";
import { fromDakarLocalInput, slugify, dakarDateKey } from "@/lib/format";

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const optStr = (fd: FormData, k: string) => str(fd, k) || null;
const optInt = (fd: FormData, k: string) => {
  const v = str(fd, k);
  return v === "" || isNaN(Number(v)) ? null : Number(v);
};

function back(path: string, msg: string, kind: "ok" | "err" = "ok"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(msg)}`);
}

function isUniqueViolation(e: unknown) {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
}

/* ---------------------------- Clubs ---------------------------- */

export async function saveClub(fd: FormData) {
  const u = await requirePerm("manageClubs");
  const id = optInt(fd, "id");
  const name = str(fd, "name");
  if (!name || !str(fd, "city")) back("/admin/clubs", "Nom et ville obligatoires.", "err");
  const values = {
    name,
    officialName: str(fd, "officialName") || name,
    shortName: str(fd, "shortName") || name.slice(0, 3).toUpperCase(),
    slug: str(fd, "slug") ? slugify(str(fd, "slug")) : slugify(name),
    city: str(fd, "city"),
    region: optStr(fd, "region"),
    stadium: optStr(fd, "stadium"),
    founded: optInt(fd, "founded"),
    coach: optStr(fd, "coach"),
    description: optStr(fd, "description"),
    primaryColor: str(fd, "primaryColor") || "#00853F",
    secondaryColor: str(fd, "secondaryColor") || "#FFFFFF",
    logoUrl: optStr(fd, "logoUrl"),
  };
  try {
    if (id) await db.update(clubs).set(values).where(eq(clubs.id, id));
    else {
      const [c] = await db.insert(clubs).values(values).returning();
      await audit(u.id, "club.create", "club", c.id, { name });
    }
    if (id) await audit(u.id, "club.update", "club", id, { name });
  } catch (e) {
    if (isUniqueViolation(e)) back("/admin/clubs", "Un club avec cet identifiant existe déjà (doublon).", "err");
    throw e;
  }
  revalidatePath("/clubs");
  back("/admin/clubs", id ? "Club mis à jour." : "Club créé.");
}

export async function deleteClub(fd: FormData) {
  const u = await requirePerm("manageClubs");
  const id = Number(fd.get("id"));
  const [used] = await db.select({ c: sql<number>`count(*)::int` }).from(matches).where(sql`${matches.homeClubId} = ${id} or ${matches.awayClubId} = ${id}`);
  if (used.c > 0) back("/admin/clubs", "Impossible : ce club a des matchs programmés.", "err");
  await db.delete(clubs).where(eq(clubs.id, id));
  await audit(u.id, "club.delete", "club", id);
  back("/admin/clubs", "Club supprimé.");
}

/* ---------------------------- Joueurs ---------------------------- */

export async function savePlayer(fd: FormData) {
  const u = await requirePerm("managePlayers");
  const id = optInt(fd, "id");
  const ret = str(fd, "return") || "/admin/joueurs";
  const values = {
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    position: str(fd, "position") || "MF",
    shirtNumber: optInt(fd, "shirtNumber"),
    birthDate: optStr(fd, "birthDate"),
    nationality: str(fd, "nationality") || "Sénégal",
    photoUrl: optStr(fd, "photoUrl"),
    currentClubId: optInt(fd, "currentClubId"),
  };
  if (!values.firstName || !values.lastName) back(ret, "Prénom et nom obligatoires.", "err");
  const today = dakarDateKey();
  if (id) {
    const [old] = await db.select().from(players).where(eq(players.id, id)).limit(1);
    await db.update(players).set(values).where(eq(players.id, id));
    if (old && old.currentClubId !== values.currentClubId) {
      // Transfert : on clôture l'historique et on ouvre une nouvelle période
      await db.update(playerClubHistory).set({ endDate: today }).where(and(eq(playerClubHistory.playerId, id), isNull(playerClubHistory.endDate)));
      if (values.currentClubId) await db.insert(playerClubHistory).values({ playerId: id, clubId: values.currentClubId, startDate: today, note: "Transfert" });
    }
    await audit(u.id, "player.update", "player", id, { name: `${values.firstName} ${values.lastName}`, clubChanged: old?.currentClubId !== values.currentClubId });
  } else {
    const [dup] = await db
      .select({ id: players.id })
      .from(players)
      .where(and(eq(players.firstName, values.firstName), eq(players.lastName, values.lastName), values.birthDate ? eq(players.birthDate, values.birthDate) : sql`true`, values.currentClubId ? eq(players.currentClubId, values.currentClubId) : sql`true`))
      .limit(1);
    if (dup) back(ret, "Ce joueur semble déjà exister (doublon détecté).", "err");
    const [p] = await db.insert(players).values(values).returning();
    if (p.currentClubId) await db.insert(playerClubHistory).values({ playerId: p.id, clubId: p.currentClubId, startDate: today });
    await audit(u.id, "player.create", "player", p.id, { name: `${p.firstName} ${p.lastName}` });
  }
  back(ret, id ? "Joueur mis à jour." : "Joueur ajouté.");
}

export async function deletePlayer(fd: FormData) {
  const u = await requirePerm("managePlayers");
  const id = Number(fd.get("id"));
  await db.delete(players).where(eq(players.id, id));
  await audit(u.id, "player.delete", "player", id);
  back(str(fd, "return") || "/admin/joueurs", "Joueur supprimé.");
}

/* ------------------------- Compétitions ------------------------- */

export async function saveCompetition(fd: FormData) {
  const u = await requirePerm("manageCompetitions");
  const id = optInt(fd, "id");
  const name = str(fd, "name");
  if (!name) back("/admin/competitions", "Nom obligatoire.", "err");
  const tiebreakers = ["tb1", "tb2", "tb3", "tb4"].map((k) => str(fd, k)).filter((v, i, a) => v && a.indexOf(v) === i);
  const values = {
    name,
    shortName: str(fd, "shortName") || name,
    slug: slugify(str(fd, "slug") || str(fd, "shortName") || name),
    category: (str(fd, "category") || "league") as "league",
    format: (str(fd, "format") || "league") as "league" | "cup",
    region: optStr(fd, "region"),
    description: optStr(fd, "description"),
    color: str(fd, "color") || "#00853F",
    isPopular: fd.get("isPopular") === "on",
    displayOrder: optInt(fd, "displayOrder") ?? 100,
    pointsWin: optInt(fd, "pointsWin") ?? 3,
    pointsDraw: optInt(fd, "pointsDraw") ?? 1,
    pointsLoss: optInt(fd, "pointsLoss") ?? 0,
    tiebreakers: tiebreakers.length ? tiebreakers : ["goal_diff", "goals_for"],
    promotionSpots: optInt(fd, "promotionSpots") ?? 0,
    relegationSpots: optInt(fd, "relegationSpots") ?? 0,
  };
  try {
    if (id) {
      await db.update(competitions).set(values).where(eq(competitions.id, id));
      await audit(u.id, "competition.update", "competition", id, { name, rules: { w: values.pointsWin, d: values.pointsDraw, l: values.pointsLoss, tiebreakers } });
    } else {
      const [c] = await db.insert(competitions).values(values).returning();
      await audit(u.id, "competition.create", "competition", c.id, { name });
    }
  } catch (e) {
    if (isUniqueViolation(e)) back("/admin/competitions", "Une compétition avec cet identifiant existe déjà.", "err");
    throw e;
  }
  revalidatePath("/competitions");
  back("/admin/competitions", "Compétition enregistrée.");
}

export async function saveSeason(fd: FormData) {
  const u = await requirePerm("manageCompetitions");
  const id = optInt(fd, "id");
  const competitionId = Number(fd.get("competitionId"));
  const name = str(fd, "name");
  const isCurrent = fd.get("isCurrent") === "on";
  const clubIds = fd.getAll("clubIds").map(Number).filter(Boolean);
  const ret = `/admin/competitions?edit=${competitionId}`;
  if (!name) back(ret, "Nom de saison obligatoire.", "err");
  let seasonId = id;
  try {
    if (isCurrent) await db.update(seasons).set({ isCurrent: false }).where(eq(seasons.competitionId, competitionId));
    if (id) await db.update(seasons).set({ name, isCurrent, startDate: optStr(fd, "startDate"), endDate: optStr(fd, "endDate") }).where(eq(seasons.id, id));
    else {
      const [s] = await db.insert(seasons).values({ competitionId, name, isCurrent, startDate: optStr(fd, "startDate"), endDate: optStr(fd, "endDate") }).returning();
      seasonId = s.id;
    }
  } catch (e) {
    if (isUniqueViolation(e)) back(ret, "Cette saison existe déjà pour la compétition.", "err");
    throw e;
  }
  await db.delete(seasonClubs).where(eq(seasonClubs.seasonId, seasonId!));
  if (clubIds.length) await db.insert(seasonClubs).values(clubIds.map((clubId) => ({ seasonId: seasonId!, clubId }))).onConflictDoNothing();
  await audit(u.id, id ? "season.update" : "season.create", "season", seasonId, { name, clubs: clubIds.length });
  back(ret, "Saison enregistrée.");
}

export async function addAdjustment(fd: FormData) {
  const u = await requirePerm("manageStandings");
  const seasonId = Number(fd.get("seasonId"));
  const ret = str(fd, "return") || "/admin/classements";
  const points = optInt(fd, "points");
  const reason = str(fd, "reason");
  if (!points || !reason) back(ret, "Points et motif obligatoires.", "err");
  const [a] = await db.insert(standingAdjustments).values({ seasonId, clubId: Number(fd.get("clubId")), points: points!, reason, createdBy: u.id }).returning();
  await audit(u.id, "standing.adjust", "season", seasonId, { adjustmentId: a.id, clubId: a.clubId, points, reason });
  back(ret, "Ajustement de points enregistré.");
}

export async function deleteAdjustment(fd: FormData) {
  const u = await requirePerm("manageStandings");
  const id = Number(fd.get("id"));
  const [a] = await db.delete(standingAdjustments).where(eq(standingAdjustments.id, id)).returning();
  await audit(u.id, "standing.adjust.delete", "season", a?.seasonId ?? null, { adjustmentId: id });
  back(str(fd, "return") || "/admin/classements", "Ajustement supprimé.");
}

/* ---------------------------- Matchs ---------------------------- */

export async function saveMatch(fd: FormData) {
  const u = await requirePerm("scheduleMatches");
  const id = optInt(fd, "id");
  const homeClubId = Number(fd.get("homeClubId"));
  const awayClubId = Number(fd.get("awayClubId"));
  const kickoff = str(fd, "kickoffAt");
  const ret = str(fd, "return") || "/admin/matchs";
  if (!homeClubId || !awayClubId || homeClubId === awayClubId) back(ret, "Sélectionnez deux équipes différentes.", "err");
  if (!kickoff) back(ret, "Date et heure obligatoires.", "err");
  const values = {
    seasonId: Number(fd.get("seasonId")),
    matchday: optInt(fd, "matchday"),
    round: optStr(fd, "round"),
    homeClubId,
    awayClubId,
    kickoffAt: fromDakarLocalInput(kickoff),
    stadium: optStr(fd, "stadium"),
  };
  if (!values.stadium) {
    const [h] = await db.select({ stadium: clubs.stadium }).from(clubs).where(eq(clubs.id, homeClubId));
    values.stadium = h?.stadium ?? null;
  }
  // Doublon : même affiche, même jour, même saison
  const [dup] = await db
    .select({ id: matches.id })
    .from(matches)
    .where(
      and(
        eq(matches.seasonId, values.seasonId),
        eq(matches.homeClubId, homeClubId),
        eq(matches.awayClubId, awayClubId),
        sql`date(${matches.kickoffAt} at time zone 'Africa/Dakar') = date(${values.kickoffAt.toISOString()}::timestamptz at time zone 'Africa/Dakar')`,
        id ? ne(matches.id, id) : sql`true`,
      ),
    )
    .limit(1);
  if (dup) back(ret, "Doublon : cette rencontre est déjà programmée ce jour-là.", "err");
  try {
    if (id) {
      await db.update(matches).set({ ...values, updatedAt: new Date(), version: sql`${matches.version} + 1` }).where(eq(matches.id, id));
      await audit(u.id, "match.update", "match", id, { kickoffAt: values.kickoffAt.toISOString() });
    } else {
      const [m] = await db.insert(matches).values(values).returning();
      await audit(u.id, "match.create", "match", m.id, { homeClubId, awayClubId, kickoffAt: values.kickoffAt.toISOString() });
    }
  } catch (e) {
    if (isUniqueViolation(e)) back(ret, "Doublon : rencontre déjà existante.", "err");
    throw e;
  }
  back(ret, id ? "Match mis à jour." : "Match programmé.");
}

export async function deleteMatch(fd: FormData) {
  const u = await requirePerm("scheduleMatches");
  const id = Number(fd.get("id"));
  await db.delete(matches).where(eq(matches.id, id));
  await audit(u.id, "match.delete", "match", id);
  back("/admin/matchs", "Match supprimé.");
}

export async function assignCorrespondent(fd: FormData) {
  const u = await requirePerm("assignCorrespondents");
  const matchId = Number(fd.get("matchId"));
  const userId = Number(fd.get("userId"));
  const remove = fd.get("remove") === "1";
  if (remove) await db.delete(matchAssignments).where(and(eq(matchAssignments.matchId, matchId), eq(matchAssignments.userId, userId)));
  else if (userId) await db.insert(matchAssignments).values({ matchId, userId }).onConflictDoNothing();
  await audit(u.id, remove ? "match.unassign" : "match.assign", "match", matchId, { userId });
  back(`/admin/matchs/${matchId}`, remove ? "Désignation retirée." : "Correspondant désigné.");
}

/* -------------------------- Actualités -------------------------- */

export async function saveArticle(fd: FormData) {
  const u = await requirePerm("publishArticles");
  const id = optInt(fd, "id");
  const title = str(fd, "title");
  const status = str(fd, "status") === "published" ? "published" : "draft";
  if (!title || !str(fd, "content")) back("/admin/actualites", "Titre et contenu obligatoires.", "err");
  let old: typeof articles.$inferSelect | undefined;
  if (id) {
    [old] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
    if (old && u.role === "journalist" && old.authorId !== u.id) back("/admin/actualites", "Vous ne pouvez modifier que vos propres articles.", "err");
  }
  const values = {
    title,
    slug: slugify(str(fd, "slug") || title),
    excerpt: str(fd, "excerpt") || str(fd, "content").slice(0, 180),
    content: str(fd, "content"),
    category: str(fd, "category") || "clubs",
    coverUrl: optStr(fd, "coverUrl"),
    status,
    isImportant: fd.get("isImportant") === "on",
    clubId: optInt(fd, "clubId"),
    competitionId: optInt(fd, "competitionId"),
    publishedAt: status === "published" ? old?.publishedAt ?? new Date() : null,
    updatedAt: new Date(),
  };
  let articleId = id;
  try {
    if (id) await db.update(articles).set(values).where(eq(articles.id, id));
    else {
      const [a] = await db.insert(articles).values({ ...values, authorId: u.id }).returning();
      articleId = a.id;
    }
  } catch (e) {
    if (isUniqueViolation(e)) back("/admin/actualites", "Un article avec ce titre/identifiant existe déjà.", "err");
    throw e;
  }
  const newlyPublished = status === "published" && old?.status !== "published";
  if (newlyPublished) {
    const url = `/actualites/${values.slug}`;
    if (values.isImportant) {
      await db.execute(sql`insert into notifications (user_id, type, title, body, url) select id, 'news', 'Actualité importante', ${title}, ${url} from users where active = true`);
    } else if (values.clubId || values.competitionId) {
      await db.execute(sql`insert into notifications (user_id, type, title, body, url)
        select distinct user_id, 'news', 'Nouvelle actualité', ${title}, ${url} from follows
        where (target_type = 'club' and target_id = ${values.clubId ?? -1}) or (target_type = 'competition' and target_id = ${values.competitionId ?? -1})`);
    }
  }
  await audit(u.id, id ? "article.update" : "article.create", "article", articleId, { title, status });
  revalidatePath("/actualites");
  back("/admin/actualites", status === "published" ? "Article publié." : "Brouillon enregistré.");
}

export async function deleteArticle(fd: FormData) {
  const u = await requirePerm("publishArticles");
  const id = Number(fd.get("id"));
  const [a] = await db.select().from(articles).where(eq(articles.id, id)).limit(1);
  if (a && u.role === "journalist" && a.authorId !== u.id) back("/admin/actualites", "Action non autorisée.", "err");
  await db.delete(articles).where(eq(articles.id, id));
  await audit(u.id, "article.delete", "article", id, { title: a?.title });
  back("/admin/actualites", "Article supprimé.");
}

/* -------------------------- Utilisateurs -------------------------- */

export async function saveUser(fd: FormData) {
  const u = await requirePerm("manageUsers");
  const id = optInt(fd, "id");
  const role = str(fd, "role") as Role;
  if (!(roleEnum.enumValues as readonly string[]).includes(role)) back("/admin/utilisateurs", "Rôle invalide.", "err");
  if (id) {
    if (id === u.id && role !== "super_admin") back("/admin/utilisateurs", "Vous ne pouvez pas retirer votre propre rôle.", "err");
    await db.update(users).set({ role, active: fd.get("active") === "on" }).where(eq(users.id, id));
    await audit(u.id, "user.update", "user", id, { role });
    back("/admin/utilisateurs", "Utilisateur mis à jour.");
  }
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  if (!email || password.length < 8 || !str(fd, "name")) back("/admin/utilisateurs", "Nom, e-mail et mot de passe (8 caractères min.) requis.", "err");
  try {
    const [n] = await db.insert(users).values({ name: str(fd, "name"), email, role, passwordHash: hashPassword(password) }).returning();
    await audit(u.id, "user.create", "user", n.id, { email, role });
  } catch (e) {
    if (isUniqueViolation(e)) back("/admin/utilisateurs", "Cet e-mail est déjà utilisé.", "err");
    throw e;
  }
  back("/admin/utilisateurs", "Compte créé.");
}

/* Utilitaire pour vérifier les droits côté UI */
export async function myPerms() {
  const u = await getCurrentUser();
  return { manageClubs: can(u, "manageClubs") };
}

export async function bulkValidate(fd: FormData) {
  const u = await requirePerm("validateResults");
  const ids = fd.getAll("ids").map(Number).filter(Boolean);
  if (!ids.length) back("/admin/matchs?filter=pending", "Aucun match sélectionné.", "err");
  await db.update(matches).set({ isValidated: true, validatedAt: new Date(), validatedBy: u.id, updatedAt: new Date() }).where(and(inArray(matches.id, ids), eq(matches.status, "finished")));
  await audit(u.id, "match.validate.bulk", "match", null, { ids });
  back("/admin/matchs?filter=pending", `${ids.length} résultat(s) validé(s).`);
}
