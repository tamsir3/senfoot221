// Utilitaires partagés client/serveur — aucun import serveur ici.

export const TZ = "Africa/Dakar";

const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, day: "2-digit", month: "short" });
const dateLongFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const dateTimeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export const toDate = (d: Date | string) => (typeof d === "string" ? new Date(d) : d);
export const formatTime = (d: Date | string) => timeFmt.format(toDate(d));
export const formatDate = (d: Date | string) => dateFmt.format(toDate(d));
export const formatDateLong = (d: Date | string) => dateLongFmt.format(toDate(d));
export const formatDateTime = (d: Date | string) => dateTimeFmt.format(toDate(d));
/** Clé de date YYYY-MM-DD dans le fuseau Africa/Dakar */
export const dakarDateKey = (d: Date | string = new Date()) => keyFmt.format(toDate(d));

/** Début/fin de journée (Dakar = UTC+0 toute l'année, sans heure d'été) */
export function dayRange(key: string) {
  const start = new Date(`${key}T00:00:00Z`);
  const end = new Date(start.getTime() + 86400000);
  return { start, end };
}

export function shiftDateKey(key: string, days: number) {
  const d = new Date(`${key}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Convertit une valeur datetime-local (heure de Dakar) en Date */
export function fromDakarLocalInput(v: string) {
  return new Date(`${v}:00Z`);
}
export function toDakarLocalInput(d: Date | string) {
  return toDate(d).toISOString().slice(0, 16);
}

export function timeAgo(d: Date | string) {
  const diff = (Date.now() - toDate(d).getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`;
  return formatDate(d);
}

export type StatusKey = "scheduled" | "live" | "halftime" | "finished" | "postponed" | "cancelled" | "suspended";

export const STATUS_LABELS: Record<StatusKey, string> = {
  scheduled: "À venir",
  live: "En direct",
  halftime: "Mi-temps",
  finished: "Terminé",
  postponed: "Reporté",
  cancelled: "Annulé",
  suspended: "Suspendu",
};

export const isLive = (s: string) => s === "live" || s === "halftime";

/** Calcule la minute de jeu affichée pendant un match en direct */
export function computeMinute(
  m: { status: string; currentPeriod: number; periodStartedAt: Date | string | null },
  now: number = Date.now(),
): string {
  if (m.status === "halftime") return "MT";
  if (m.status !== "live" || !m.periodStartedAt) return "";
  const elapsed = Math.max(0, Math.floor((now - toDate(m.periodStartedAt).getTime()) / 60000));
  const base = m.currentPeriod >= 2 ? 45 : 0;
  const cap = base + 45;
  const minute = base + elapsed + 1;
  if (minute > cap) return `${cap}+${Math.min(minute - cap, 15)}'`;
  return `${minute}'`;
}

export function currentMinuteNumber(m: { status: string; currentPeriod: number; periodStartedAt: Date | string | null }) {
  if (!m.periodStartedAt || m.status !== "live") return m.currentPeriod >= 2 ? 46 : 1;
  const elapsed = Math.max(0, Math.floor((Date.now() - toDate(m.periodStartedAt).getTime()) / 60000));
  const base = m.currentPeriod >= 2 ? 45 : 0;
  return Math.min(base + elapsed + 1, base + 45);
}

export type EventKey =
  | "goal"
  | "penalty_goal"
  | "own_goal"
  | "yellow_card"
  | "red_card"
  | "substitution"
  | "kick_off"
  | "half_time"
  | "second_half"
  | "full_time"
  | "shootout_scored"
  | "shootout_missed";

export const EVENT_LABELS: Record<EventKey, string> = {
  goal: "But",
  penalty_goal: "But sur penalty",
  own_goal: "But contre son camp",
  yellow_card: "Carton jaune",
  red_card: "Carton rouge",
  substitution: "Remplacement",
  kick_off: "Coup d'envoi",
  half_time: "Mi-temps",
  second_half: "Reprise",
  full_time: "Fin du match",
  shootout_scored: "Tir au but réussi",
  shootout_missed: "Tir au but manqué",
};

export const GOAL_TYPES = ["goal", "penalty_goal", "own_goal"];
export const PHASE_TYPES = ["kick_off", "half_time", "second_half", "full_time"];

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super administrateur",
  competition_admin: "Administrateur de compétition",
  match_operator: "Opérateur de match",
  correspondent: "Correspondant sportif",
  journalist: "Journaliste",
  supporter: "Supporter",
};

export const CATEGORY_LABELS: Record<string, string> = {
  league: "Championnat national",
  cup: "Coupe",
  supercup: "Supercoupe",
  women: "Football féminin",
  regional: "Régional / départemental",
  youth: "Jeunes",
  university: "Universitaire",
  tournament: "Tournoi local",
};

export const ARTICLE_CATEGORIES: Record<string, string> = {
  transferts: "Transferts",
  resultats: "Résultats",
  interviews: "Interviews",
  clubs: "Actualités des clubs",
  competitions: "Compétitions",
  portraits: "Portraits",
};

export const POSITION_LABELS: Record<string, string> = {
  GK: "Gardien",
  DF: "Défenseur",
  MF: "Milieu",
  FW: "Attaquant",
};

export const TIEBREAKER_LABELS: Record<string, string> = {
  goal_diff: "Différence de buts",
  goals_for: "Buts marqués",
  head_to_head: "Confrontations directes",
  wins: "Nombre de victoires",
  goals_against: "Moins de buts encaissés",
};

export function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function initials(name: string) {
  const parts = name.replace(/[^A-Za-zÀ-ÿ ]/g, " ").split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 3).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
