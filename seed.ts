
import { db, pool } from "@/db";
import * as s from "@/db/schema";
import { hashPassword } from "./password";
import { dakarDateKey, shiftDateKey, slugify } from "./format";

let seedPromise: Promise<void> | null = null;

export function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = runSeed().catch((e) => {
      console.error("[seed] échec", e);
      seedPromise = null;
    });
  }
  return seedPromise;
}

async function runSeed() {
  const client = await pool.connect();
  try {
    await client.query("select pg_advisory_lock(424242)");
    const r = await client.query("select count(*)::int as c from users");
    if (r.rows[0].c > 0) return;
    await seed();
    console.log("[seed] données de démonstration créées");
  } finally {
    await client.query("select pg_advisory_unlock(424242)");
    client.release();
  }
}

function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026);
const ri = (min: number, max: number) => Math.floor(rand() * (max - min + 1)) + min;
const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];

type ClubSeed = [string, string, string, string, string, number, string, string, string];
const L1: ClubSeed[] = [
  ["Teungueth FC", "TFC", "Rufisque", "Dakar", "Stade Ngalandou Diouf", 2010, "Youssouph Dabo", "#E30613", "#FFFFFF"],
  ["ASC Jaraaf", "JAR", "Dakar", "Dakar", "Stade Demba Diop", 1969, "Malick Daf", "#00853F", "#FFFFFF"],
  ["Casa Sports", "CASA", "Ziguinchor", "Ziguinchor", "Stade Aline Sitoé Diatta", 1960, "Ansou Diadhiou", "#FDEF42", "#00853F"],
  ["Génération Foot", "GF", "Déni Biram Ndao", "Dakar", "Stade Fodé Wade", 2000, "Djiby Fall", "#F28C00", "#1A1A1A"],
  ["AS Pikine", "ASP", "Pikine", "Dakar", "Stade Alassane Djigo", 1983, "Pape Bounama Cissé", "#1F5FBF", "#FFFFFF"],
  ["US Gorée", "USG", "Gorée", "Dakar", "Stade Demba Diop", 1933, "Bassirou Sarr", "#C8102E", "#1D3E8F"],
  ["Guédiawaye FC", "GFC", "Guédiawaye", "Dakar", "Stade Amadou Barry", 2011, "Lamine Dieng", "#6A1B9A", "#FDEF42"],
  ["Diambars FC", "DIA", "Saly", "Thiès", "Stade Fodé Wade", 2003, "Omar Badji", "#0B3D91", "#FDEF42"],
  ["Sonacos FC", "SON", "Diourbel", "Diourbel", "Stade Ely Manel Fall", 1999, "Abdoulaye Sow", "#2E7D32", "#FFD600"],
  ["Stade de Mbour", "SDM", "Mbour", "Thiès", "Stade Caroline Faye", 1996, "Mamadou Gueye", "#0277BD", "#FFFFFF"],
  ["AS Douanes", "ASD", "Dakar", "Dakar", "Stade Iba Mar Diop", 1980, "Ousmane Touré", "#1B5E20", "#FFFFFF"],
  ["ASC Linguère", "LIN", "Saint-Louis", "Saint-Louis", "Stade Me Babacar Sèye", 1969, "Amara Traoré", "#111111", "#FFFFFF"],
  ["Jamono Fatick", "JAM", "Fatick", "Fatick", "Stade Massène Sène", 1985, "Souleymane Diop", "#D84315", "#FFFFFF"],
  ["Dakar Sacré-Cœur", "DSC", "Dakar", "Dakar", "Stade Iba Mar Diop", 2005, "Pape Alioune Diop", "#283593", "#E53935"],
];
const L2: ClubSeed[] = [
  ["ASC Ndiambour", "NDB", "Louga", "Louga", "Stade Alboury Ndiaye", 1969, "Moustapha Seck", "#FDEF42", "#111111"],
  ["CNEPS Excellence", "CNEPS", "Thiès", "Thiès", "Stade Lat Dior", 1984, "Cheikh Guèye", "#00695C", "#FFFFFF"],
  ["AS Port", "PORT", "Dakar", "Dakar", "Stade Iba Mar Diop", 1980, "Babacar Ndiaye", "#0D47A1", "#FFFFFF"],
  ["Niarry Tally", "NT", "Dakar", "Dakar", "Stade Demba Diop", 1970, "Ibrahima Thiam", "#AD1457", "#FFFFFF"],
  ["US Ouakam", "USO", "Ouakam", "Dakar", "Stade Municipal de Ouakam", 1951, "Mbaye Badji", "#E53935", "#FDEF42"],
  ["Wallydaan FC", "WAL", "Dakar", "Dakar", "Stade Demba Diop", 2004, "Alassane Ndao", "#4E342E", "#FFFFFF"],
  ["Olympique de Ngor", "OLN", "Ngor", "Dakar", "Stade de Ngor", 1990, "Assane Faye", "#00838F", "#FFFFFF"],
  ["ASC HLM", "HLM", "Dakar", "Dakar", "Stade Demba Diop", 1975, "Saliou Kane", "#F9A825", "#1A237E"],
];
const WOMEN: ClubSeed[] = [
  ["Aigles de la Médina", "ADM", "Dakar", "Dakar", "Stade Iba Mar Diop", 2000, "Mame Moussa Cissé", "#1565C0", "#FDEF42"],
  ["Sirènes de Grand-Yoff", "SGY", "Dakar", "Dakar", "Stade Demba Diop", 2004, "Aïssatou Diop", "#00897B", "#FFFFFF"],
  ["Lycée Ameth Fall", "LAF", "Saint-Louis", "Saint-Louis", "Stade Me Babacar Sèye", 1998, "Khady Sène", "#5D4037", "#FDEF42"],
  ["Dakar Sacré-Cœur Féminin", "DSCF", "Dakar", "Dakar", "Stade Iba Mar Diop", 2012, "Ndèye Ndiaye", "#283593", "#E53935"],
];

const MALE = ["Sadio", "Ismaïla", "Idrissa", "Kalidou", "Cheikhou", "Pape", "Moussa", "Mamadou", "Ibrahima", "Abdou", "Lamine", "Bamba", "Habib", "Youssouf", "Alioune", "Ousmane", "Malick", "Serigne", "Modou", "Babacar", "Saliou", "Demba", "Assane", "Mbaye", "Aliou", "El Hadji", "Pathé", "Seydou", "Iliman", "Boulaye", "Krépin", "Formose"];
const FEMALE = ["Awa", "Fatou", "Aminata", "Mame", "Ndèye", "Coumba", "Khady", "Bineta", "Astou", "Mariama", "Adama", "Safiétou", "Rokhaya", "Dieynaba", "Sokhna", "Nafi"];
const LAST = ["Diop", "Ndiaye", "Fall", "Sarr", "Sow", "Ba", "Gueye", "Faye", "Diallo", "Cissé", "Mbaye", "Sène", "Thiam", "Diouf", "Kane", "Camara", "Diatta", "Badji", "Mendy", "Sagna", "Niang", "Seck", "Touré", "Wade", "Dieng", "Ndao", "Diagne", "Lo", "Kouyaté", "Coly", "Sané", "Tine"];

function roundRobin(ids: number[]) {
  const t = [...ids];
  if (t.length % 2) t.push(-1);
  const n = t.length;
  const rounds: [number, number][][] = [];
  for (let r = 0; r < n - 1; r++) {
    const pairs: [number, number][] = [];
    for (let i = 0; i < n / 2; i++) {
      const a = t[i];
      const b = t[n - 1 - i];
      if (a !== -1 && b !== -1) pairs.push(r % 2 === 0 ? [a, b] : [b, a]);
    }
    rounds.push(pairs);
    t.splice(1, 0, t.pop()!);
  }
  return rounds;
}

type PlannedMatch = {
  seasonId: number;
  matchday: number | null;
  round: string | null;
  home: number;
  away: number;
  kickoffAt: Date;
  state: "finished" | "pending" | "live1" | "live2" | "halftime" | "scheduled" | "postponed";
  shootout?: boolean;
};

async function seed() {
  const pw = hashPassword("Senfoot2026!");
  const userRows = await db
    .insert(s.users)
    .values([
      { name: "Awa Diop", email: "admin@senfoot.sn", role: "super_admin" as const, passwordHash: pw },
      { name: "Moussa Ndiaye", email: "competition@senfoot.sn", role: "competition_admin" as const, passwordHash: pw },
      { name: "Ibrahima Fall", email: "operateur@senfoot.sn", role: "match_operator" as const, passwordHash: pw },
      { name: "Cheikh Sarr", email: "correspondant@senfoot.sn", role: "correspondent" as const, passwordHash: pw },
      { name: "Fatou Sow", email: "journaliste@senfoot.sn", role: "journalist" as const, passwordHash: pw },
      { name: "Mamadou Ba", email: "supporter@senfoot.sn", role: "supporter" as const, passwordHash: pw },
    ])
    .returning();
  const U = Object.fromEntries(userRows.map((u) => [u.role, u.id])) as Record<string, number>;

  // Compétitions
  const compDefs = [
    { name: "Ligue 1 sénégalaise", shortName: "Ligue 1", category: "league", format: "league", isPopular: true, displayOrder: 1, color: "#00853F", promotionSpots: 1, relegationSpots: 2, description: "Le championnat d'élite du football sénégalais, organisé par la Ligue Sénégalaise de Football Professionnel (LSFP)." },
    { name: "Ligue 2 sénégalaise", shortName: "Ligue 2", category: "league", format: "league", isPopular: true, displayOrder: 2, color: "#1F5FBF", promotionSpots: 2, relegationSpots: 2, description: "Deuxième division professionnelle du Sénégal." },
    { name: "Coupe du Sénégal", shortName: "Coupe", category: "cup", format: "cup", isPopular: true, displayOrder: 3, color: "#E31B23", description: "La plus prestigieuse coupe nationale, ouverte aux clubs de toutes les divisions." },
    { name: "Supercoupe du Sénégal", shortName: "Supercoupe", category: "supercup", format: "cup", isPopular: false, displayOrder: 4, color: "#C9A227", description: "Opposition entre le champion de Ligue 1 et le vainqueur de la Coupe du Sénégal." },
    { name: "Ligue 1 féminine", shortName: "L1 Féminine", category: "women", format: "league", isPopular: true, displayOrder: 5, color: "#AD1457", description: "Le championnat national de football féminin." },
    { name: "Championnat régional de Dakar", shortName: "Régional Dakar", category: "regional", format: "league", isPopular: false, displayOrder: 10, color: "#455A64", region: "Dakar", description: "Championnat de la Ligue régionale de football de Dakar." },
    { name: "Championnat national U17", shortName: "U17", category: "youth", format: "league", isPopular: false, displayOrder: 11, color: "#6D4C41", description: "Compétition nationale des moins de 17 ans." },
    { name: "Championnat universitaire", shortName: "Universitaire", category: "university", format: "league", isPopular: false, displayOrder: 12, color: "#5E35B1", description: "Championnat inter-universités du Sénégal (UCAD, UGB, UASZ, UADB…)." },
    { name: "Tournoi des Navétanes", shortName: "Navétanes", category: "tournament", format: "cup", isPopular: false, displayOrder: 13, color: "#EF6C00", description: "Les célèbres championnats populaires de quartier pendant l'hivernage." },
  ] as const;
  const comps = await db
    .insert(s.competitions)
    .values(compDefs.map((c) => ({ ...c, slug: slugify(c.shortName) })))
    .returning();
  const seasonRows = await db
    .insert(s.seasons)
    .values(comps.map((c) => ({ competitionId: c.id, name: "2025-2026", isCurrent: true, startDate: "2025-11-01", endDate: "2026-07-31" })))
    .returning();
  const seasonOf = (slug: string) => seasonRows.find((x) => x.competitionId === comps.find((c) => c.slug === slug)!.id)!.id;

  // Clubs
  const toClub = (c: ClubSeed) => ({
    name: c[0],
    officialName: c[0].startsWith("AS") || c[0].startsWith("US") ? `${c[0]} (Association sportive)` : `${c[0]}`,
    shortName: c[1],
    slug: slugify(c[0]),
    city: c[2],
    region: c[3],
    stadium: c[4],
    founded: c[5],
    coach: c[6],
    primaryColor: c[7],
    secondaryColor: c[8],
    description: `${c[0]} est un club basé à ${c[2]} (région de ${c[3]}), fondé en ${c[5]}. Il dispute ses rencontres à domicile au ${c[4]} et fait partie des acteurs du football sénégalais.`,
  });
  const l1 = await db.insert(s.clubs).values(L1.map(toClub)).returning();
  const l2 = await db.insert(s.clubs).values(L2.map(toClub)).returning();
  const wc = await db.insert(s.clubs).values(WOMEN.map(toClub)).returning();

  await db.insert(s.seasonClubs).values([
    ...l1.map((c) => ({ seasonId: seasonOf("ligue-1"), clubId: c.id })),
    ...l2.map((c) => ({ seasonId: seasonOf("ligue-2"), clubId: c.id })),
    ...wc.map((c) => ({ seasonId: seasonOf("l1-feminine"), clubId: c.id })),
  ]);

  // Joueurs
  const playerVals: (typeof s.players.$inferInsert)[] = [];
  const positions = ["GK", "GK", "DF", "DF", "DF", "DF", "DF", "MF", "MF", "MF", "MF", "MF", "FW", "FW", "FW", "FW"];
  for (const club of [...l1, ...l2, ...wc]) {
    const female = wc.includes(club);
    const count = l1.includes(club) ? 16 : 14;
    const used = new Set<string>();
    for (let i = 0; i < count; i++) {
      let fn = "", ln = "";
      do {
        fn = pick(female ? FEMALE : MALE);
        ln = pick(LAST);
      } while (used.has(fn + ln));
      used.add(fn + ln);
      playerVals.push({
        firstName: fn,
        lastName: ln,
        position: positions[i],
        shirtNumber: i === 0 ? 1 : i === 1 ? 16 : i + 1,
        birthDate: rand() > 0.15 ? `${ri(1994, 2007)}-${String(ri(1, 12)).padStart(2, "0")}-${String(ri(1, 28)).padStart(2, "0")}` : null,
        currentClubId: club.id,
      });
    }
  }
  const playerRows = await db.insert(s.players).values(playerVals).returning();
  const allClubs = [...l1, ...l2];
  await db.insert(s.playerClubHistory).values(
    playerRows.flatMap((p) => {
      const rows: (typeof s.playerClubHistory.$inferInsert)[] = [];
      if (rand() > 0.6 && !wc.some((c) => c.id === p.currentClubId)) {
        const prev = pick(allClubs.filter((c) => c.id !== p.currentClubId));
        rows.push({ playerId: p.id, clubId: prev.id, startDate: "2021-08-01", endDate: "2024-06-30", note: "Transfert" });
        rows.push({ playerId: p.id, clubId: p.currentClubId!, startDate: "2024-07-01" });
      } else {
        rows.push({ playerId: p.id, clubId: p.currentClubId!, startDate: `20${ri(19, 24)}-07-01` });
      }
      return rows;
    }),
  );
  const squad = (clubId: number) => playerRows.filter((p) => p.currentClubId === clubId);

  // Planification des matchs
  const now = new Date();
  now.setUTCSeconds(0, 0);
  const today = dakarDateKey(now);
  const at = (offset: number, hh: number, mm = 0) => new Date(`${shiftDateKey(today, offset)}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00Z`);
  const minsAgo = (m: number) => new Date(now.getTime() - m * 60000);
  const hours = [[15, 0], [16, 30], [17, 0], [19, 0]];
  const planned: PlannedMatch[] = [];

  // Ligue 1 : journées 1 à 8 jouées, J9 aujourd'hui, J10-13 à venir
  const l1Rounds = roundRobin(l1.map((c) => c.id));
  l1Rounds.forEach((pairs, r) => {
    const md = r + 1;
    pairs.forEach(([home, away], i) => {
      const [hh, mm] = hours[i % 4];
      if (md < 9) {
        planned.push({ seasonId: seasonOf("ligue-1"), matchday: md, round: null, home, away, kickoffAt: at((md - 9) * 7 + (i % 2), hh, mm), state: "finished" });
      } else if (md === 9) {
        const plan: [PlannedMatch["state"], Date][] = [
          ["live1", minsAgo(32)],
          ["live2", minsAgo(83)],
          ["halftime", minsAgo(50)],
          ["pending", minsAgo(180)],
          ["scheduled", new Date(now.getTime() + 120 * 60000)],
          ["scheduled", new Date(now.getTime() + 240 * 60000)],
          ["postponed", new Date(now.getTime() + 300 * 60000)],
        ];
        const [state, ko] = plan[i] ?? ["scheduled", new Date(now.getTime() + 360 * 60000)];
        planned.push({ seasonId: seasonOf("ligue-1"), matchday: md, round: null, home, away, kickoffAt: ko, state });
      } else {
        planned.push({ seasonId: seasonOf("ligue-1"), matchday: md, round: null, home, away, kickoffAt: at((md - 9) * 7 + (i % 2), hh, mm), state: "scheduled" });
      }
    });
  });

  // Ligue 2 : 7 journées — J1-5 jouées, J6 demain, J7 dans 8 jours
  roundRobin(l2.map((c) => c.id)).forEach((pairs, r) => {
    const md = r + 1;
    pairs.forEach(([home, away], i) => {
      const [hh, mm] = hours[i % 4];
      const offset = md <= 5 ? (md - 6) * 7 : md === 6 ? 1 : 8;
      planned.push({ seasonId: seasonOf("ligue-2"), matchday: md, round: null, home, away, kickoffAt: at(offset, hh, mm), state: md <= 5 ? "finished" : "scheduled" });
    });
  });

  // Ligue 1 féminine : 3 journées
  roundRobin(wc.map((c) => c.id)).forEach((pairs, r) => {
    const md = r + 1;
    pairs.forEach(([home, away], i) => {
      planned.push({ seasonId: seasonOf("l1-feminine"), matchday: md, round: null, home, away, kickoffAt: at(md === 3 ? 2 : (md - 3) * 7, 16, i * 30), state: md === 3 ? "scheduled" : "finished" });
    });
  });

  // Coupe du Sénégal
  const cupS = seasonOf("coupe");
  const c = (n: string) => [...l1, ...l2].find((x) => x.name === n)!.id;
  planned.push(
    { seasonId: cupS, matchday: null, round: "Huitièmes de finale", home: c("ASC Jaraaf"), away: c("ASC Ndiambour"), kickoffAt: at(-10, 17), state: "finished" },
    { seasonId: cupS, matchday: null, round: "Huitièmes de finale", home: c("Casa Sports"), away: c("Génération Foot"), kickoffAt: at(-10, 19), state: "finished", shootout: true },
    { seasonId: cupS, matchday: null, round: "Huitièmes de finale", home: c("US Ouakam"), away: c("Teungueth FC"), kickoffAt: at(-9, 17), state: "finished" },
    { seasonId: cupS, matchday: null, round: "Huitièmes de finale", home: c("AS Pikine"), away: c("CNEPS Excellence"), kickoffAt: at(-9, 19), state: "finished" },
    { seasonId: cupS, matchday: null, round: "Quarts de finale", home: c("ASC Jaraaf"), away: c("AS Pikine"), kickoffAt: at(3, 17), state: "scheduled" },
    { seasonId: cupS, matchday: null, round: "Quarts de finale", home: c("Teungueth FC"), away: c("Casa Sports"), kickoffAt: at(3, 19, 30), state: "scheduled" },
  );
  planned.push({ seasonId: seasonOf("supercoupe"), matchday: null, round: "Finale", home: c("Teungueth FC"), away: c("ASC Jaraaf"), kickoffAt: at(-70, 17), state: "finished" });

  const stadiumOf = new Map([...l1, ...l2, ...wc].map((x) => [x.id, x.stadium]));
  const statusOf: Record<PlannedMatch["state"], s.MatchStatus> = {
    finished: "finished",
    pending: "finished",
    live1: "live",
    live2: "live",
    halftime: "halftime",
    scheduled: "scheduled",
    postponed: "postponed",
  };

  const matchRows = await db
    .insert(s.matches)
    .values(
      planned.map((p) => ({
        seasonId: p.seasonId,
        matchday: p.matchday,
        round: p.round,
        homeClubId: p.home,
        awayClubId: p.away,
        kickoffAt: p.kickoffAt,
        stadium: stadiumOf.get(p.home) ?? null,
        status: statusOf[p.state],
        currentPeriod: p.state === "live1" ? 1 : p.state === "live2" ? 2 : p.state === "halftime" ? 1 : p.state === "finished" || p.state === "pending" ? 2 : 0,
        periodStartedAt: p.state === "live1" ? p.kickoffAt : p.state === "live2" ? minsAgo(20) : null,
        isValidated: p.state === "finished",
        validatedAt: p.state === "finished" ? new Date(p.kickoffAt.getTime() + 3 * 3600000) : null,
        validatedBy: p.state === "finished" ? U.competition_admin : null,
      })),
    )
    .returning();

  // Événements
  const evVals: (typeof s.matchEvents.$inferInsert)[] = [];
  const scoreUpdates: { id: number; h: number; a: number; hp: number | null; ap: number | null }[] = [];
  matchRows.forEach((m, idx) => {
    const p = planned[idx];
    const upTo = { finished: 90, pending: 90, live1: 32, live2: 65, halftime: 45, scheduled: 0, postponed: 0 }[p.state];
    if (!upTo) return;
    const hs = squad(m.homeClubId);
    const as = squad(m.awayClubId);
    const add = (e: Partial<typeof s.matchEvents.$inferInsert> & { type: s.EventType }) =>
      evVals.push({ matchId: m.id, createdBy: U.match_operator, ...e });
    add({ type: "kick_off", minute: 1 });
    let h = 0, a = 0;
    const attackers = (sq: typeof hs) => sq.filter((x) => x.position === "FW" || x.position === "MF");
    const goals = ri(0, 3) + ri(0, 2);
    for (let g = 0; g < goals; g++) {
      const minute = ri(3, 90);
      if (minute > upTo) continue;
      const home = rand() > 0.45;
      const r = rand();
      const type: s.EventType = r > 0.92 ? "own_goal" : r > 0.82 ? "penalty_goal" : "goal";
      const scorer = type === "own_goal" ? pick(home ? as : hs) : pick(attackers(home ? hs : as));
      if (home) h++;
      else a++;
      add({ type, minute, clubId: home ? m.homeClubId : m.awayClubId, playerId: scorer.id });
    }
    if (p.shootout) {
      // Forcer un nul 1-1 pour la séance de tirs au but
      for (let i = evVals.length - 1; i >= 0; i--) if (evVals[i].matchId === m.id && ["goal", "penalty_goal", "own_goal"].includes(evVals[i].type)) evVals.splice(i, 1);
      add({ type: "goal", minute: 27, clubId: m.homeClubId, playerId: attackers(hs)[0].id });
      add({ type: "goal", minute: 74, clubId: m.awayClubId, playerId: attackers(as)[1].id });
      h = 1;
      a = 1;
    }
    for (let k = 0; k < ri(1, 4); k++) {
      const minute = ri(10, 89);
      if (minute > upTo) continue;
      const home = rand() > 0.5;
      add({ type: rand() > 0.9 ? "red_card" : "yellow_card", minute, clubId: home ? m.homeClubId : m.awayClubId, playerId: pick(home ? hs : as).id });
    }
    if (upTo >= 45) add({ type: "half_time", minute: 45 });
    if (upTo > 45) {
      add({ type: "second_half", minute: 46 });
      for (const [sq, clubId] of [[hs, m.homeClubId], [as, m.awayClubId]] as const) {
        for (let k = 0; k < 2; k++) {
          const minute = ri(55, 85);
          if (minute > upTo) continue;
          add({ type: "substitution", minute, clubId, playerId: sq[2 + k * 4].id, relatedPlayerId: sq[sq.length - 1 - k].id });
        }
      }
    }
    let hp: number | null = null, ap: number | null = null;
    if (upTo >= 90) {
      if (p.shootout) {
        hp = 0;
        ap = 0;
        const seq = [[true, true], [true, false], [false, true], [true, true], [true, false]];
        seq.forEach(([hOk, aOk], i) => {
          add({ type: hOk ? "shootout_scored" : "shootout_missed", minute: 120, extraMinute: i + 1, clubId: m.homeClubId, playerId: hs[10 + (i % 6)].id });
          if (hOk) hp!++;
          add({ type: aOk ? "shootout_scored" : "shootout_missed", minute: 120, extraMinute: i + 1, clubId: m.awayClubId, playerId: as[10 + (i % 6)].id });
          if (aOk) ap!++;
        });
      }
      add({ type: "full_time", minute: 90 });
    }
    scoreUpdates.push({ id: m.id, h, a, hp, ap });
  });
  evVals.sort((x, y) => (x.matchId! - y.matchId!) || ((x.minute ?? 0) - (y.minute ?? 0)) || ((x.extraMinute ?? 0) - (y.extraMinute ?? 0)));
  for (let i = 0; i < evVals.length; i += 500) await db.insert(s.matchEvents).values(evVals.slice(i, i + 500));
  if (scoreUpdates.length) {
    const values = scoreUpdates.map((u) => `(${u.id},${u.h},${u.a},${u.hp ?? "NULL"},${u.ap ?? "NULL"})`).join(",");
    await pool.query(
      `update matches m set home_score = v.h, away_score = v.a, home_pens = v.hp::int, away_pens = v.ap::int from (values ${values}) as v(id,h,a,hp,ap) where m.id = v.id`,
    );
  }

  // Désignation du correspondant sur les matchs du jour
  const todays = matchRows.filter((m, i) => planned[i].matchday === 9 && planned[i].seasonId === seasonOf("ligue-1"));
  await db.insert(s.matchAssignments).values(todays.slice(0, 5).map((m) => ({ matchId: m.id, userId: U.correspondent })));

  await db.insert(s.standingAdjustments).values({
    seasonId: seasonOf("ligue-1"),
    clubId: l1.find((x) => x.shortName === "SON")!.id,
    points: -1,
    reason: "Sanction disciplinaire de la commission de discipline (retard de présentation)",
    createdBy: U.competition_admin,
  });

  // Actualités
  const art = (
    title: string,
    category: string,
    cover: string,
    excerpt: string,
    content: string,
    daysAgo: number,
    extra: Partial<typeof s.articles.$inferInsert> = {},
  ) => ({
    title,
    slug: slugify(title),
    category,
    coverUrl: cover,
    excerpt,
    content,
    status: "published",
    authorId: U.journalist,
    publishedAt: new Date(now.getTime() - daysAgo * 3600000 * 24 - 3600000),
    ...extra,
  });
  const l1Id = comps.find((x) => x.slug === "ligue-1")!.id;
  await db.insert(s.articles).values([
    art(
      "Ligue 1 : la course au titre plus ouverte que jamais",
      "competitions",
      "/images/news-1.jpg",
      "À l'approche de la mi-saison, plusieurs prétendants se tiennent en quelques points en tête du championnat.",
      "La Ligue 1 sénégalaise vit l'une de ses saisons les plus disputées. Après huit journées, le haut du classement reste extrêmement serré et chaque week-end redistribue les cartes.\n\nLes entraîneurs s'accordent à dire que la régularité fera la différence. « Il n'y a plus de match facile dans ce championnat », confie un technicien dakarois.\n\nLa neuvième journée, disputée aujourd'hui, pourrait déjà livrer de premiers enseignements avec plusieurs chocs au programme.",
      0,
      { competitionId: l1Id, isImportant: true },
    ),
    art(
      "Coupe du Sénégal : Casa Sports qualifié au bout du suspense",
      "resultats",
      "/images/news-3.jpg",
      "Les Ziguinchorois ont eu besoin des tirs au but pour écarter Génération Foot en huitièmes de finale.",
      "Au terme d'un match intense, Casa Sports a validé son billet pour les quarts de finale de la Coupe du Sénégal en s'imposant aux tirs au but (4-3) face à Génération Foot, après un score de parité (1-1) dans le temps réglementaire.\n\nLe public du stade Aline Sitoé Diatta a vibré jusqu'au dernier tir. Les Ziguinchorois affronteront Teungueth FC au prochain tour.",
      9,
      { competitionId: comps.find((x) => x.slug === "coupe")!.id },
    ),
    art(
      "Mercato : un jeune attaquant de Génération Foot courtisé en Europe",
      "transferts",
      "/images/news-2.jpg",
      "Plusieurs clubs européens suivent de près le meilleur buteur de l'académie de Déni Biram Ndao.",
      "Fidèle à sa réputation de vivier, Génération Foot attire à nouveau l'attention des recruteurs européens. Selon nos informations, des clubs français et belges ont envoyé des observateurs lors des dernières rencontres.\n\nLa direction du club reste sereine et rappelle que la priorité reste la formation et la progression des jeunes joueurs.",
      2,
      { clubId: l1.find((x) => x.shortName === "GF")!.id },
    ),
    art(
      "Entretien : « Le Jaraaf doit retrouver sa place au sommet »",
      "interviews",
      "/images/news-4.jpg",
      "L'entraîneur du club de la Médina évoque ses ambitions et la progression de son groupe.",
      "Rencontré au stade Demba Diop, l'entraîneur de l'ASC Jaraaf s'est livré sur la saison de son équipe.\n\n« Nous avons un groupe jeune et ambitieux. Le Jaraaf est un club historique, nos supporters attendent des titres et nous travaillons chaque jour pour leur en offrir. »\n\nIl a également salué l'engagement de ses cadres et l'apport des jeunes issus du centre de formation.",
      3,
      { clubId: l1.find((x) => x.shortName === "JAR")!.id },
    ),
    art(
      "Football féminin : les Aigles de la Médina toujours invaincues",
      "clubs",
      "/images/news-2.jpg",
      "Le club dakarois confirme sa domination sur le championnat national féminin.",
      "Les Aigles de la Médina poursuivent leur parcours sans faute en Ligue 1 féminine. Portées par une défense solide, les Dakaroises abordent la troisième journée avec confiance.\n\nLe football féminin sénégalais connaît un essor remarquable, avec une affluence en hausse dans les stades.",
      4,
      { competitionId: comps.find((x) => x.slug === "l1-feminine")!.id },
    ),
    art(
      "Portrait : le capitaine de Teungueth FC, l'âme de Rufisque",
      "portraits",
      "/images/news-1.jpg",
      "Retour sur le parcours d'un leader discret devenu indispensable au club rufisquois.",
      "Formé dans les navétanes de Rufisque, il a gravi tous les échelons jusqu'au brassard de capitaine de Teungueth FC.\n\nSes coéquipiers louent son exemplarité et sa capacité à fédérer le vestiaire. À 29 ans, il rêve encore d'une sélection en équipe nationale locale.",
      6,
      { clubId: l1.find((x) => x.shortName === "TFC")!.id },
    ),
  ]);

  // Favoris & notifications du supporter de démonstration
  const jaraaf = l1.find((x) => x.shortName === "JAR")!.id;
  await db.insert(s.follows).values([
    { userId: U.supporter, targetType: "club", targetId: jaraaf },
    { userId: U.supporter, targetType: "competition", targetId: l1Id },
  ]);
  await db.insert(s.notifications).values([
    { userId: U.supporter, type: "news", title: "Actualité importante", body: "Ligue 1 : la course au titre plus ouverte que jamais", url: `/actualites/${slugify("Ligue 1 : la course au titre plus ouverte que jamais")}` },
  ]);
  await db.insert(s.auditLogs).values({ userId: U.super_admin, action: "seed", entityType: "system", entityId: null, details: { message: "Initialisation des données de démonstration" } });
}
