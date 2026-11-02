"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { EventRow, MatchCard } from "@/lib/queries";
import { EVENT_LABELS, formatDateLong, formatTime, isLive, PHASE_TYPES, type EventKey } from "@/lib/format";
import { ClubCrest, StatusBadge } from "./ui";
import { LiveMinute } from "./client";

export type MatchData = { match: MatchCard; events: EventRow[] };

export function useMatchPolling(initial: MatchData) {
  const [data, setData] = useState(initial);
  const [online, setOnline] = useState(true);
  useEffect(() => setData(initial), [initial]);
  useEffect(() => {
    const m = data.match;
    const soon = m.status === "scheduled" && new Date(m.kickoffAt).getTime() - Date.now() < 2 * 3600000;
    const interval = isLive(m.status) ? 10000 : soon ? 30000 : 0;
    if (!interval) return;
    const t = setInterval(async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch(`/api/matches/${m.id}`, { cache: "no-cache" });
        if (r.ok) {
          setData(await r.json());
          setOnline(true);
        }
      } catch {
        setOnline(false);
      }
    }, interval);
    return () => clearInterval(t);
  }, [data.match]);
  return { data, setData, online };
}

export function playerLabel(e: EventRow) {
  if (e.pFirst) return `${e.pFirst} ${e.pLast}`;
  return e.playerName ?? "";
}

export function EventIcon({ type }: { type: EventKey }) {
  const map: Partial<Record<EventKey, React.ReactNode>> = {
    goal: "⚽",
    penalty_goal: "⚽",
    own_goal: "⚽",
    yellow_card: <span className="inline-block h-4 w-3 rounded-[2px] bg-yellow-400" />,
    red_card: <span className="inline-block h-4 w-3 rounded-[2px] bg-red-600" />,
    substitution: "🔁",
    shootout_scored: "✅",
    shootout_missed: "❌",
  };
  return <span className="inline-flex w-5 justify-center text-sm">{map[type] ?? "⏱"}</span>;
}

export function Timeline({ match, events }: MatchData) {
  if (!events.length) return <p className="py-8 text-center text-sm text-slate-500">Aucun événement pour le moment.</p>;
  const regular = events.filter((e) => !e.type.startsWith("shootout"));
  const shootout = events.filter((e) => e.type.startsWith("shootout"));
  const row = (e: EventRow) => {
    if (PHASE_TYPES.includes(e.type)) {
      return (
        <li key={e.id} className="my-2 flex items-center gap-3">
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {EVENT_LABELS[e.type as EventKey]}
            {e.type === "half_time" || e.type === "full_time" ? ` · ${scoreAt(match, events, e)}` : ""}
          </span>
          <span className="h-px flex-1 bg-slate-200 dark:bg-slate-700" />
        </li>
      );
    }
    const isHome = e.clubId === match.home.id;
    const name = playerLabel(e);
    const sub = e.type === "substitution" && e.rFirst ? `${e.rFirst} ${e.rLast}` : null;
    const content = (
      <div className={`flex items-center gap-2 ${isHome ? "" : "flex-row-reverse text-right"}`}>
        <EventIcon type={e.type as EventKey} />
        <div className="min-w-0">
          <div className={`truncate text-sm ${e.type.includes("goal") ? "font-bold" : "font-medium"}`}>
            {e.type === "substitution" && sub ? <span className="text-emerald-600">↑ {sub}</span> : name || EVENT_LABELS[e.type as EventKey]}
          </div>
          <div className="truncate text-[11px] text-slate-500">
            {e.type === "substitution" ? <span className="text-red-500">↓ {name}</span> : e.type === "goal" ? "But" : EVENT_LABELS[e.type as EventKey]}
            {e.note ? ` · ${e.note}` : ""}
          </div>
        </div>
      </div>
    );
    return (
      <li key={e.id} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 py-1.5">
        <div>{isHome && content}</div>
        <span className="w-12 text-center text-xs font-black text-slate-500">
          {e.minute != null ? `${e.minute}'` : ""}
          {e.extraMinute && !e.type.startsWith("shootout") ? `+${e.extraMinute}` : ""}
        </span>
        <div>{!isHome && content}</div>
      </li>
    );
  };
  return (
    <div>
      <ul>{regular.map(row)}</ul>
      {shootout.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-slate-500">
            Tirs au but · {match.homePens}-{match.awayPens}
          </div>
          <ul>{shootout.map((e) => ({ ...e, minute: null })).map(row)}</ul>
        </div>
      )}
    </div>
  );
}

function scoreAt(match: MatchCard, events: EventRow[], until: EventRow) {
  let h = 0, a = 0;
  for (const e of events) {
    if (e.id === until.id) break;
    if (["goal", "penalty_goal", "own_goal"].includes(e.type)) {
      if (e.clubId === match.home.id) h++;
      else if (e.clubId === match.away.id) a++;
    }
  }
  return `${h}-${a}`;
}

export function Scoreboard({ match }: { match: MatchCard }) {
  const live = isLive(match.status);
  const showScore = live || ["finished", "suspended"].includes(match.status);
  return (
    <div className="card overflow-hidden">
      <Link href={`/competitions/${match.competition.slug}`} className="flex items-center justify-center gap-2 border-b border-slate-100 py-2 text-xs font-bold uppercase tracking-wide text-slate-600 dark:border-slate-800 dark:text-slate-300">
        <span className="h-3 w-1.5 rounded-full" style={{ background: match.competition.color }} />
        {match.competition.name}
        {match.matchday ? ` · Journée ${match.matchday}` : match.round ? ` · ${match.round}` : ""}
      </Link>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 px-3 py-6 sm:px-8">
        {[match.home, null, match.away].map((c, i) =>
          c ? (
            <Link key={c.id} href={`/clubs/${c.slug}`} className="flex flex-col items-center gap-2 text-center">
              <ClubCrest club={c} size={64} />
              <span className="text-sm font-bold leading-tight sm:text-base">{c.name}</span>
            </Link>
          ) : (
            <div key={i} className="flex flex-col items-center gap-2">
              {showScore ? (
                <div className={`text-5xl font-black tabular-nums tracking-tight sm:text-6xl ${live ? "text-red-600" : ""}`}>
                  {match.homeScore}
                  <span className="mx-1 text-slate-300 dark:text-slate-600">-</span>
                  {match.awayScore}
                </div>
              ) : (
                <div className="text-3xl font-black tabular-nums text-slate-700 dark:text-slate-200">{formatTime(match.kickoffAt)}</div>
              )}
              {match.homePens != null && (
                <div className="text-xs font-bold text-slate-500">
                  TAB : {match.homePens}-{match.awayPens}
                </div>
              )}
              <StatusBadge status={match.status} />
              {live && <LiveMinute status={match.status} currentPeriod={match.currentPeriod} periodStartedAt={match.periodStartedAt} className="text-lg font-black text-red-600" />}
            </div>
          ),
        )}
      </div>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 border-t border-slate-100 px-3 py-2 text-xs text-slate-500 dark:border-slate-800">
        <span className="capitalize">📅 {formatDateLong(match.kickoffAt)}</span>
        <span>🕒 {formatTime(match.kickoffAt)} (Dakar)</span>
        {match.stadium && <span>🏟️ {match.stadium}</span>}
      </div>
    </div>
  );
}

export function MatchLive({ initial, operateHref }: { initial: MatchData; operateHref?: string }) {
  const { data, online } = useMatchPolling(initial);
  const m = data.match;
  return (
    <div className="space-y-4">
      {!online && <div className="rounded-xl bg-amber-100 px-3 py-2 text-xs font-semibold text-amber-800">Connexion instable — les données seront mises à jour dès le retour du réseau.</div>}
      <Scoreboard match={m} />
      {operateHref && (
        <Link href={operateHref} className="btn-primary w-full">
          🎛️ Ouvrir la console de saisie
        </Link>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="card p-4 md:col-span-2">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide">Événements du match</h2>
          <div className="mb-2 grid grid-cols-[1fr_auto_1fr] text-[11px] font-bold uppercase text-slate-400">
            <span>{m.home.shortName}</span>
            <span className="w-12" />
            <span className="text-right">{m.away.shortName}</span>
          </div>
          <Timeline match={m} events={data.events} />
        </div>
        <div className="card h-fit p-4 text-sm">
          <h2 className="mb-3 text-sm font-extrabold uppercase tracking-wide">Informations</h2>
          <dl className="space-y-2">
            {[
              ["Compétition", m.competition.name],
              ["Saison", m.seasonName],
              [m.matchday ? "Journée" : "Tour", m.matchday ? String(m.matchday) : m.round ?? "—"],
              ["Date", formatDateLong(m.kickoffAt)],
              ["Heure (Dakar)", formatTime(m.kickoffAt)],
              ["Stade", m.stadium ?? "—"],
              ["Résultat", m.status === "finished" ? (m.isValidated ? "✅ Validé" : "⏳ En attente de validation") : "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-2 last:border-0 dark:border-slate-800">
                <dt className="text-slate-500">{k}</dt>
                <dd className="text-right font-semibold capitalize-first">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
