import Link from "next/link";
import type { MatchCard, StandingRow } from "@/lib/queries";
import { formatDate, formatTime, isLive, STATUS_LABELS, type StatusKey } from "@/lib/format";
import { ClubCrest } from "./ui";
import { LiveMinute } from "./client";

export function MatchRow({ m, showDate = false }: { m: MatchCard; showDate?: boolean }) {
  const live = isLive(m.status);
  const played = live || m.status === "finished" || m.status === "suspended";
  const hWin = m.status === "finished" && (m.homeScore > m.awayScore || (m.homeScore === m.awayScore && (m.homePens ?? 0) > (m.awayPens ?? 0)));
  const aWin = m.status === "finished" && (m.awayScore > m.homeScore || (m.homeScore === m.awayScore && (m.awayPens ?? 0) > (m.homePens ?? 0)));
  return (
    <Link href={`/matchs/${m.id}`} className="group flex items-center gap-3 px-3 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60">
      <div className="w-14 shrink-0 text-center">
        {live ? (
          <LiveMinute status={m.status} currentPeriod={m.currentPeriod} periodStartedAt={m.periodStartedAt} className="text-sm font-black text-red-600" />
        ) : m.status === "scheduled" ? (
          <div>
            {showDate && <div className="text-[10px] font-semibold uppercase text-slate-400">{formatDate(m.kickoffAt)}</div>}
            <div className="text-sm font-bold text-slate-700 dark:text-slate-200">{formatTime(m.kickoffAt)}</div>
          </div>
        ) : (
          <div>
            {showDate && <div className="text-[10px] font-semibold uppercase text-slate-400">{formatDate(m.kickoffAt)}</div>}
            <div className={`text-[11px] font-bold uppercase ${m.status === "finished" ? "text-slate-500" : "text-orange-600"}`}>
              {m.status === "finished" ? "Terminé" : STATUS_LABELS[m.status as StatusKey]}
            </div>
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1 space-y-1.5">
        {[
          { c: m.home, s: m.homeScore, p: m.homePens, w: hWin },
          { c: m.away, s: m.awayScore, p: m.awayPens, w: aWin },
        ].map(({ c, s, p, w }) => (
          <div key={c.id} className="flex items-center gap-2">
            <ClubCrest club={c} size={20} />
            <span className={`flex-1 truncate text-sm ${w ? "font-bold text-slate-900 dark:text-white" : "font-medium text-slate-700 dark:text-slate-300"}`}>{c.name}</span>
            {played && (
              <span className={`w-7 text-right text-base font-black tabular-nums ${live ? "text-red-600" : "text-slate-900 dark:text-white"}`}>
                {s}
                {p != null && <sup className="ml-0.5 text-[10px] font-bold text-slate-400">{p}</sup>}
              </span>
            )}
          </div>
        ))}
      </div>
      {!m.isValidated && m.status === "finished" && <span title="Résultat en attente de validation" className="text-[10px] font-bold text-amber-600">⏳</span>}
    </Link>
  );
}

export function CompetitionBlock({ competition, matches, showDate, subtitle }: { competition: MatchCard["competition"]; matches: MatchCard[]; showDate?: boolean; subtitle?: string }) {
  return (
    <div className="card overflow-hidden">
      <Link href={`/competitions/${competition.slug}`} className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-800/40">
        <span className="h-4 w-1.5 rounded-full" style={{ background: competition.color }} />
        <span className="text-xs font-extrabold uppercase tracking-wide text-slate-700 dark:text-slate-200">{competition.name}</span>
        {subtitle && <span className="text-xs text-slate-400">· {subtitle}</span>}
        <span className="ml-auto text-xs text-slate-400">›</span>
      </Link>
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {matches.map((m) => (
          <MatchRow key={m.id} m={m} showDate={showDate} />
        ))}
      </div>
    </div>
  );
}

export function StandingsTable({
  rows,
  highlight,
  promotion = 0,
  relegation = 0,
  compact = false,
}: {
  rows: StandingRow[];
  highlight?: number;
  promotion?: number;
  relegation?: number;
  compact?: boolean;
}) {
  const formColor = { W: "bg-emerald-500", D: "bg-slate-400", L: "bg-red-500" };
  return (
    <div className="card overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="border-b border-slate-100 text-[11px] uppercase tracking-wide text-slate-500 dark:border-slate-800">
            <th className="py-2 pl-3 text-left">#</th>
            <th className="py-2 text-left">Club</th>
            <th className="px-1.5 py-2" title="Matchs joués">J</th>
            {!compact && (
              <>
                <th className="px-1.5 py-2" title="Victoires">G</th>
                <th className="px-1.5 py-2" title="Nuls">N</th>
                <th className="px-1.5 py-2" title="Défaites">P</th>
                <th className="hidden px-1.5 py-2 sm:table-cell" title="Buts marqués">BP</th>
                <th className="hidden px-1.5 py-2 sm:table-cell" title="Buts encaissés">BC</th>
              </>
            )}
            <th className="px-1.5 py-2" title="Différence de buts">Diff</th>
            <th className="px-2 py-2" title="Points">Pts</th>
            {!compact && <th className="hidden py-2 pr-3 lg:table-cell">Forme</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const zone = r.position <= promotion ? "bg-emerald-500" : r.position > rows.length - relegation ? "bg-red-500" : "bg-transparent";
            return (
              <tr key={r.id} className={`border-b border-slate-50 last:border-0 dark:border-slate-800/60 ${highlight === r.id ? "bg-emerald-50 dark:bg-emerald-950/40" : ""}`}>
                <td className="relative py-2 pl-3 text-xs font-bold text-slate-500">
                  <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r ${zone}`} />
                  {r.position}
                </td>
                <td className="py-2">
                  <Link href={`/clubs/${r.slug}`} className="flex items-center gap-2 hover:underline">
                    <ClubCrest club={r} size={20} />
                    <span className="truncate font-semibold text-slate-800 dark:text-slate-100">{compact ? r.shortName : r.name}</span>
                    {r.adjustment !== 0 && <span className="text-[10px] font-bold text-red-500" title="Ajustement de points">{r.adjustment > 0 ? `+${r.adjustment}` : r.adjustment}</span>}
                  </Link>
                </td>
                <td className="px-1.5 text-center">{r.played}</td>
                {!compact && (
                  <>
                    <td className="px-1.5 text-center">{r.won}</td>
                    <td className="px-1.5 text-center">{r.drawn}</td>
                    <td className="px-1.5 text-center">{r.lost}</td>
                    <td className="hidden px-1.5 text-center sm:table-cell">{r.gf}</td>
                    <td className="hidden px-1.5 text-center sm:table-cell">{r.ga}</td>
                  </>
                )}
                <td className="px-1.5 text-center">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
                <td className="px-2 text-center text-base font-black text-slate-900 dark:text-white">{r.points}</td>
                {!compact && (
                  <td className="hidden py-2 pr-3 lg:table-cell">
                    <div className="flex justify-center gap-0.5">
                      {r.form.map((f, i) => (
                        <span key={i} className={`flex h-4 w-4 items-center justify-center rounded text-[9px] font-bold text-white ${formColor[f]}`}>
                          {f === "W" ? "V" : f === "D" ? "N" : "D"}
                        </span>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
