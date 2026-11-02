import {
  pgTable,
  serial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  pgEnum,
  date,
  primaryKey,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Énumérations                                                        */
/* ------------------------------------------------------------------ */

export const roleEnum = pgEnum("user_role", [
  "super_admin",
  "competition_admin",
  "match_operator",
  "correspondent",
  "journalist",
  "supporter",
]);

export const matchStatusEnum = pgEnum("match_status", [
  "scheduled",
  "live",
  "halftime",
  "finished",
  "postponed",
  "cancelled",
  "suspended",
]);

export const eventTypeEnum = pgEnum("event_type", [
  "goal",
  "penalty_goal",
  "own_goal",
  "yellow_card",
  "red_card",
  "substitution",
  "kick_off",
  "half_time",
  "second_half",
  "full_time",
  "shootout_scored",
  "shootout_missed",
]);

export const competitionCategoryEnum = pgEnum("competition_category", [
  "league",
  "cup",
  "supercup",
  "women",
  "regional",
  "youth",
  "university",
  "tournament",
]);

export const competitionFormatEnum = pgEnum("competition_format", ["league", "cup"]);

/* ------------------------------------------------------------------ */
/* Utilisateurs & sessions                                             */
/* ------------------------------------------------------------------ */

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull().default("supporter"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(), // hash SHA-256 du jeton
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Compétitions & saisons                                              */
/* ------------------------------------------------------------------ */

export const competitions = pgTable("competitions", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  shortName: text("short_name").notNull(),
  slug: text("slug").notNull().unique(),
  category: competitionCategoryEnum("category").notNull().default("league"),
  format: competitionFormatEnum("format").notNull().default("league"),
  region: text("region"),
  description: text("description"),
  color: text("color").notNull().default("#00853F"),
  isPopular: boolean("is_popular").notNull().default(false),
  displayOrder: integer("display_order").notNull().default(100),
  // Règles de classement configurables
  pointsWin: integer("points_win").notNull().default(3),
  pointsDraw: integer("points_draw").notNull().default(1),
  pointsLoss: integer("points_loss").notNull().default(0),
  tiebreakers: jsonb("tiebreakers")
    .$type<string[]>()
    .notNull()
    .default(["goal_diff", "goals_for", "head_to_head"]),
  promotionSpots: integer("promotion_spots").notNull().default(0),
  relegationSpots: integer("relegation_spots").notNull().default(0),
  // Préparation intégration fournisseurs de données
  externalId: text("external_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seasons = pgTable(
  "seasons",
  {
    id: serial("id").primaryKey(),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isCurrent: boolean("is_current").notNull().default(false),
    startDate: date("start_date"),
    endDate: date("end_date"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("seasons_comp_name_uq").on(t.competitionId, t.name)],
);

/* ------------------------------------------------------------------ */
/* Clubs & joueurs                                                     */
/* ------------------------------------------------------------------ */

export const clubs = pgTable("clubs", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  officialName: text("official_name").notNull(),
  shortName: text("short_name").notNull(),
  slug: text("slug").notNull().unique(),
  city: text("city").notNull(),
  region: text("region"),
  stadium: text("stadium"),
  founded: integer("founded"),
  coach: text("coach"),
  description: text("description"),
  primaryColor: text("primary_color").notNull().default("#00853F"),
  secondaryColor: text("secondary_color").notNull().default("#FFFFFF"),
  logoUrl: text("logo_url"),
  externalId: text("external_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const seasonClubs = pgTable(
  "season_clubs",
  {
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.seasonId, t.clubId] })],
);

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    position: text("position").notNull().default("MF"), // GK, DF, MF, FW
    shirtNumber: integer("shirt_number"),
    birthDate: date("birth_date"),
    nationality: text("nationality").notNull().default("Sénégal"),
    photoUrl: text("photo_url"),
    currentClubId: integer("current_club_id").references(() => clubs.id, { onDelete: "set null" }),
    externalId: text("external_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("players_club_idx").on(t.currentClubId)],
);

export const playerClubHistory = pgTable("player_club_history", {
  id: serial("id").primaryKey(),
  playerId: integer("player_id")
    .notNull()
    .references(() => players.id, { onDelete: "cascade" }),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubs.id, { onDelete: "cascade" }),
  startDate: date("start_date"),
  endDate: date("end_date"),
  note: text("note"),
});

/* ------------------------------------------------------------------ */
/* Matchs                                                              */
/* ------------------------------------------------------------------ */

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    seasonId: integer("season_id")
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    matchday: integer("matchday"),
    round: text("round"),
    homeClubId: integer("home_club_id")
      .notNull()
      .references(() => clubs.id),
    awayClubId: integer("away_club_id")
      .notNull()
      .references(() => clubs.id),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    stadium: text("stadium"),
    status: matchStatusEnum("status").notNull().default("scheduled"),
    currentPeriod: integer("current_period").notNull().default(0), // 0 avant, 1 = 1re MT, 2 = 2e MT
    periodStartedAt: timestamp("period_started_at", { withTimezone: true }),
    homeScore: integer("home_score").notNull().default(0),
    awayScore: integer("away_score").notNull().default(0),
    homePens: integer("home_pens"),
    awayPens: integer("away_pens"),
    isValidated: boolean("is_validated").notNull().default(false),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    validatedBy: integer("validated_by").references(() => users.id, { onDelete: "set null" }),
    version: integer("version").notNull().default(1),
    externalId: text("external_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Protection contre les doublons de programmation
    uniqueIndex("matches_unique_fixture").on(t.seasonId, t.homeClubId, t.awayClubId, t.kickoffAt),
    index("matches_kickoff_idx").on(t.kickoffAt),
    index("matches_status_idx").on(t.status),
  ],
);

export const matchAssignments = pgTable(
  "match_assignments",
  {
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.userId] })],
);

export const matchEvents = pgTable(
  "match_events",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    type: eventTypeEnum("type").notNull(),
    clubId: integer("club_id").references(() => clubs.id, { onDelete: "set null" }),
    playerId: integer("player_id").references(() => players.id, { onDelete: "set null" }),
    relatedPlayerId: integer("related_player_id").references(() => players.id, { onDelete: "set null" }),
    playerName: text("player_name"),
    minute: integer("minute"),
    extraMinute: integer("extra_minute"),
    note: text("note"),
    // Clé d'idempotence générée côté client (protection doublons / réseau lent)
    clientId: text("client_id").unique(),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("match_events_match_idx").on(t.matchId)],
);

export const matchEventRevisions = pgTable(
  "match_event_revisions",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id").notNull(),
    matchId: integer("match_id").notNull(),
    action: text("action").notNull(), // create | update | delete
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>().notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("mer_match_idx").on(t.matchId)],
);

/**
 * Structure préparée pour les futures statistiques détaillées
 * (possession, tirs, corners, fautes…). Non exploitée en V1.
 */
export const matchStatistics = pgTable("match_statistics", {
  id: serial("id").primaryKey(),
  matchId: integer("match_id")
    .notNull()
    .references(() => matches.id, { onDelete: "cascade" }),
  clubId: integer("club_id").references(() => clubs.id, { onDelete: "cascade" }),
  playerId: integer("player_id").references(() => players.id, { onDelete: "cascade" }),
  key: text("key").notNull(),
  value: text("value").notNull(),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Classements                                                         */
/* ------------------------------------------------------------------ */

export const standingAdjustments = pgTable("standing_adjustments", {
  id: serial("id").primaryKey(),
  seasonId: integer("season_id")
    .notNull()
    .references(() => seasons.id, { onDelete: "cascade" }),
  clubId: integer("club_id")
    .notNull()
    .references(() => clubs.id, { onDelete: "cascade" }),
  points: integer("points").notNull(),
  reason: text("reason").notNull(),
  createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Actualités                                                          */
/* ------------------------------------------------------------------ */

export const articles = pgTable("articles", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  category: text("category").notNull().default("clubs"),
  coverUrl: text("cover_url"),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  status: text("status").notNull().default("draft"), // draft | published
  isImportant: boolean("is_important").notNull().default(false),
  clubId: integer("club_id").references(() => clubs.id, { onDelete: "set null" }),
  competitionId: integer("competition_id").references(() => competitions.id, { onDelete: "set null" }),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Favoris & notifications                                             */
/* ------------------------------------------------------------------ */

export const follows = pgTable(
  "follows",
  {
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    targetType: text("target_type").notNull(), // club | competition
    targetId: integer("target_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.targetType, t.targetId] })],
);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    url: text("url"),
    read: boolean("read").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_user_idx").on(t.userId, t.read)],
);

/* ------------------------------------------------------------------ */
/* Journal d'audit                                                     */
/* ------------------------------------------------------------------ */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: integer("entity_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("audit_created_idx").on(t.createdAt)],
);

export type User = typeof users.$inferSelect;
export type Club = typeof clubs.$inferSelect;
export type Competition = typeof competitions.$inferSelect;
export type Season = typeof seasons.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type MatchEvent = typeof matchEvents.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Article = typeof articles.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type MatchStatus = (typeof matchStatusEnum.enumValues)[number];
export type EventType = (typeof eventTypeEnum.enumValues)[number];
