import Link from "next/link";
import { computeStandings, getArticles, getCompetitions, getMatches, groupByCompetition } from "@/lib/queries";
import { dakarDateKey, dayRange, formatDateLong, timeAgo, ARTICLE_CATEGORIES, CATEGORY_LABELS } from "@/lib/format";
import { CompetitionBlock, StandingsTable } from "@/components/matches";
import { SectionTitle, Empty } from "@/components/ui";
import { AutoRefresh } from "@/components/client";
import { ensureSeeded } from "@/lib/seed";
import { db } from "@/db";
import { seasons } from "@/db/schema";
import { and, eq } from "drizzle-orm";

export default async function Home() {
  await ensureSeeded();
  const today = dakarDateKey();
  const { start, end } = dayRange(today);
  const now = new Date();

  const [live, todays, upcoming, results, comps, news] = await Promise.all([
    getMatches({ statuses: ["live", "halftime"] }),
    getMatches({ from: start, to: end }),
    getMatches({ from: end, statuses: ["scheduled"], limit: 10 }),
    getMatches({ to: now, statuses: ["finished"], order: "desc", limit: 10 }),
    getCompetitions(),
    getArticles({ limit: 5 }),
  ]);
  const todayOthers = todays.filter((m) => m.status !== "live" && m.status !== "halftime");
  const popular = comps.filter((c) => c.isPopular);
  const l1 = comps.find((c) => c.slug === "ligue-1");
  const [l1Season] = l1 ? await db.select().from(seasons).where(and(eq(seasons.competitionId, l1.id), eq(seasons.isCurrent, true))).limit(1) : [];
  const standings = l1Season ? await computeStandings(l1Season.id) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <AutoRefresh active={live.length > 0} interval={30000} />
      <div className="space-y-6 lg:col-span-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Aujourd&apos;hui</p>
            <h1 className="text-xl font-black capitalize tracking-tight sm:text-2xl">{formatDateLong(now)}</h1>
          </div>
          <Link href="/matchs" className="btn-ghost text-xs">📅 Calendrier</Link>
        </div>

        <div className="scrollbar-none -mx-3 flex gap-2 overflow-x-auto px-3">
          {popular.map((c) => (
            <Link key={c.id} href={`/competitions/${c.slug}`} className="chip border-slate-200 bg-white text-slate-700 hover:border-brand dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
              <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
              {c.shortName}
            </Link>
          ))}
        </div>

        <section>
          <SectionTitle icon={<span className="live-dot h-2.5 w-2.5 rounded-full bg-red-600" />}>
            En direct <span className="rounded-full bg-red-600 px-2 text-xs text-white">{live.length}</span>
          </SectionTitle>
          {live.length ? (
            <div className="space-y-3">
              {groupByCompetition(live).map((g) => (
                <CompetitionBlock key={g.competition.id} competition={g.competition} matches={g.matches} subtitle={g.matches[0].matchday ? `Journée ${g.matches[0].matchday}` : g.matches[0].round ?? undefined} />
              ))}
            </div>
          ) : (
            <Empty>Aucun match en direct pour le moment.</Empty>
          )}
        </section>

        <section>
          <SectionTitle href={`/matchs?date=${today}`}>Matchs du jour</SectionTitle>
          {todayOthers.length ? (
            <div className="space-y-3">
              {groupByCompetition(todayOthers).map((g) => (
                <CompetitionBlock key={g.competition.id} competition={g.competition} matches={g.matches} subtitle={g.matches[0].matchday ? `Journée ${g.matches[0].matchday}` : g.matches[0].round ?? undefined} />
              ))}
            </div>
          ) : (
            <Empty>Pas d&apos;autre match programmé aujourd&apos;hui.</Empty>
          )}
        </section>

        <section>
          <SectionTitle href="/matchs?vue=a-venir">Prochains matchs</SectionTitle>
          {upcoming.length ? (
            <div className="space-y-3">
              {groupByCompetition(upcoming).map((g) => (
                <CompetitionBlock key={g.competition.id} competition={g.competition} matches={g.matches} showDate />
              ))}
            </div>
          ) : (
            <Empty>Aucun match à venir.</Empty>
          )}
        </section>

        <section>
          <SectionTitle href="/matchs?vue=resultats">Derniers résultats</SectionTitle>
          {results.length ? (
            <div className="space-y-3">
              {groupByCompetition(results).map((g) => (
                <CompetitionBlock key={g.competition.id} competition={g.competition} matches={g.matches} showDate />
              ))}
            </div>
          ) : (
            <Empty>Aucun résultat récent.</Empty>
          )}
        </section>
      </div>

      <aside className="space-y-6">
        <section>
          <SectionTitle href="/competitions">Compétitions populaires</SectionTitle>
          <div className="card divide-y divide-slate-100 overflow-hidden dark:divide-slate-800">
            {popular.map((c) => (
              <Link key={c.id} href={`/competitions/${c.slug}`} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-black text-white" style={{ background: c.color }}>
                  {c.shortName.slice(0, 2).toUpperCase()}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{c.name}</div>
                  <div className="text-xs text-slate-500">{CATEGORY_LABELS[c.category]}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {standings && l1 && (
          <section>
            <SectionTitle href={`/competitions/${l1.slug}?tab=classement`}>Classement Ligue 1</SectionTitle>
            <StandingsTable rows={standings.rows.slice(0, 8)} compact promotion={l1.promotionSpots} />
          </section>
        )}

        <section>
          <SectionTitle href="/actualites">Dernières actualités</SectionTitle>
          <div className="space-y-3">
            {news.map((a, i) => (
              <Link key={a.id} href={`/actualites/${a.slug}`} className="card flex gap-3 overflow-hidden p-2 transition hover:shadow-md">
                {a.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.coverUrl} alt="" loading={i < 2 ? "eager" : "lazy"} className="h-20 w-24 shrink-0 rounded-xl object-cover" />
                )}
                <div className="min-w-0 py-1">
                  <div className="text-[10px] font-bold uppercase tracking-wide text-brand">{ARTICLE_CATEGORIES[a.category] ?? a.category}</div>
                  <h3 className="line-clamp-2 text-sm font-bold leading-snug">{a.title}</h3>
                  <div className="mt-1 text-[11px] text-slate-400">{a.publishedAt ? timeAgo(a.publishedAt) : ""}</div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
