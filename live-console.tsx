"use client";

import { useEffect, useState, useTransition } from "react";
import type { EventRow } from "@/lib/queries";
import { currentMinuteNumber, EVENT_LABELS, isLive, PHASE_TYPES, STATUS_LABELS, type EventKey, type StatusKey } from "@/lib/format";
import { addEventAction, deleteEventAction, setScoreAction, setStatusAction, updateEventAction, validateAction } from "@/app/actions/live";
import type { EventInput } from "@/lib/match-service";
import { ClubCrest, StatusBadge } from "./ui";
import { LiveMinute } from "./client";
import { EventIcon, playerLabel, useMatchPolling, type MatchData } from "./match-live";

type SquadPlayer = { id: number; firstName: string; lastName: string; shirtNumber: number | null; position: string };
type Perms = { editScores: boolean; validate: boolean };

type Draft = {
  editId?: number;
  type: EventKey;
  clubId: number | null;
  playerId: string;
  relatedPlayerId: string;
  playerName: string;
  minute: string;
  extraMinute: string;
  note: string;
};

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const QUEUE_KEY = "senfoot_pending_events";

export function LiveConsole({ initial, homeSquad, awaySquad, perms }: { initial: MatchData; homeSquad: SquadPlayer[]; awaySquad: SquadPlayer[]; perms: Perms }) {
  const { data, setData } = useMatchPolling(initial);
  const m = data.match;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [msg, setMsg] = useState<{ t: "ok" | "err"; s: string } | null>(null);
  const [pending, start] = useTransition();
  const [queue, setQueue] = useState<EventInput[]>([]);

  const refresh = async () => {
    try {
      const r = await fetch(`/api/matches/${m.id}`, { cache: "no-store" });
      if (r.ok) setData(await r.json());
    } catch {}
  };

  // File d'attente hors-ligne : renvoi automatique (clientId = idempotence)
  useEffect(() => {
    try {
      const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as EventInput[];
      setQueue(q.filter((e) => e.matchId === m.id));
    } catch {}
  }, [m.id]);
  const saveQueue = (q: EventInput[]) => {
    setQueue(q);
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q));
  };
  const flush = async () => {
    const q = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]") as EventInput[];
    const left: EventInput[] = [];
    for (const e of q) {
      try {
        const r = await addEventAction(e);
        if (!r.ok) setMsg({ t: "err", s: r.error });
      } catch {
        left.push(e);
      }
    }
    saveQueue(left);
    refresh();
  };
  useEffect(() => {
    const h = () => flush();
    window.addEventListener("online", h);
    return () => window.removeEventListener("online", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const flash = (t: "ok" | "err", s: string) => {
    setMsg({ t, s });
    setTimeout(() => setMsg(null), 3500);
  };

  const submit = async (input: EventInput) => {
    try {
      const r = await addEventAction(input);
      if (r.ok) flash("ok", `${EVENT_LABELS[input.type as EventKey]} enregistré`);
      else flash("err", r.error);
    } catch {
      saveQueue([...JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]"), input]);
      flash("err", "Réseau indisponible : événement mis en file d'attente, renvoi automatique.");
    }
    refresh();
  };

  const phase = (type: EventKey) =>
    start(() =>
      submit({ matchId: m.id, type, minute: type === "kick_off" ? 1 : type === "half_time" ? 45 : type === "second_half" ? 46 : 90, clientId: uid() }),
    );

  const openNew = (type: EventKey, clubId: number) =>
    setDraft({ type, clubId, playerId: "", relatedPlayerId: "", playerName: "", minute: String(currentMinuteNumber(m)), extraMinute: "", note: "" });

  const openEdit = (e: EventRow) =>
    setDraft({
      editId: e.id,
      type: e.type as EventKey,
      clubId: e.clubId,
      playerId: e.playerId ? String(e.playerId) : "",
      relatedPlayerId: e.relatedPlayerId ? String(e.relatedPlayerId) : "",
      playerName: e.playerName ?? "",
      minute: e.minute != null ? String(e.minute) : "",
      extraMinute: e.extraMinute != null ? String(e.extraMinute) : "",
      note: e.note ?? "",
    });

  const saveDraft = () => {
    if (!draft) return;
    const payload = {
      type: draft.type,
      clubId: draft.clubId,
      playerId: draft.playerId ? Number(draft.playerId) : null,
      relatedPlayerId: draft.relatedPlayerId ? Number(draft.relatedPlayerId) : null,
      playerName: draft.playerName || null,
      minute: draft.minute ? Number(draft.minute) : null,
      extraMinute: draft.extraMinute ? Number(draft.extraMinute) : null,
      note: draft.note || null,
    };
    start(async () => {
      if (draft.editId) {
        const r = await updateEventAction(m.id, draft.editId, payload);
        if (r.ok) flash("ok", "Événement modifié (historique conservé)");
        else return flash("err", r.error);
        refresh();
      } else {
        await submit({ ...payload, matchId: m.id, clientId: uid() });
      }
      setDraft(null);
    });
  };

  const remove = (id: number) => {
    if (!confirm("Supprimer cet événement ? Il restera visible dans l'historique des corrections.")) return;
    start(async () => {
      const r = await deleteEventAction(m.id, id);
      if (r.ok) flash("ok", "Événement supprimé");
      else flash("err", r.error);
      refresh();
      setDraft(null);
    });
  };

  const has = (t: string) => data.events.some((e) => e.type === t);
  const nextPhase: EventKey | null = !has("kick_off") ? "kick_off" : !has("half_time") ? "half_time" : !has("second_half") ? "second_half" : !has("full_time") ? "full_time" : null;

  const squadFor = (d: Draft) => {
    const own = d.clubId === m.home.id ? homeSquad : awaySquad;
    const opp = d.clubId === m.home.id ? awaySquad : homeSquad;
    return d.type === "own_goal" ? opp : own;
  };

  const teamCol = (club: typeof m.home) => (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ClubCrest club={club} size={22} />
        <span className="truncate text-sm font-bold">{club.shortName}</span>
      </div>
      <button onClick={() => openNew("goal", club.id)} className="btn w-full bg-emerald-600 py-4 text-base text-white">⚽ But</button>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => openNew("yellow_card", club.id)} className="btn bg-yellow-400 py-3 text-slate-900">🟨</button>
        <button onClick={() => openNew("red_card", club.id)} className="btn bg-red-600 py-3 text-white">🟥</button>
      </div>
      <button onClick={() => openNew("substitution", club.id)} className="btn-ghost w-full py-3">🔁 Changement</button>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => openNew("shootout_scored", club.id)} className="btn-ghost px-1 py-2 text-xs">TAB ✅</button>
        <button onClick={() => openNew("shootout_missed", club.id)} className="btn-ghost px-1 py-2 text-xs">TAB ❌</button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Tableau d'affichage compact, collant */}
      <div className="card sticky top-[60px] z-30 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <ClubCrest club={m.home} size={30} />
            <span className="truncate text-sm font-bold">{m.home.shortName}</span>
          </div>
          <div className="text-center">
            <div className="text-3xl font-black tabular-nums">
              {m.homeScore}-{m.awayScore}
            </div>
            {m.homePens != null && <div className="text-[11px] font-bold text-slate-500">TAB {m.homePens}-{m.awayPens}</div>}
            <div className="flex items-center justify-center gap-1">
              <StatusBadge status={m.status} />
              {isLive(m.status) && <LiveMinute status={m.status} currentPeriod={m.currentPeriod} periodStartedAt={m.periodStartedAt} className="text-xs font-black text-red-600" />}
            </div>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <span className="truncate text-sm font-bold">{m.away.shortName}</span>
            <ClubCrest club={m.away} size={30} />
          </div>
        </div>
        {queue.length > 0 && (
          <button onClick={flush} className="mt-2 w-full rounded-lg bg-amber-100 py-1.5 text-xs font-bold text-amber-800">
            {queue.length} événement(s) en attente d&apos;envoi — Réessayer
          </button>
        )}
        {msg && <div className={`mt-2 rounded-lg px-3 py-1.5 text-center text-xs font-semibold ${msg.t === "ok" ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}>{msg.s}</div>}
      </div>

      {m.isValidated && <div className="rounded-xl bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">✅ Résultat validé — toute modification est réservée aux administrateurs.</div>}

      {/* Phases du match */}
      <div className="grid grid-cols-4 gap-2">
        {(["kick_off", "half_time", "second_half", "full_time"] as EventKey[]).map((t) => (
          <button
            key={t}
            disabled={pending || has(t)}
            onClick={() => phase(t)}
            className={`btn px-1 py-3 text-xs ${nextPhase === t ? "bg-slate-900 text-white ring-2 ring-brand dark:bg-white dark:text-slate-900" : "border border-slate-200 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"}`}
          >
            {has(t) ? "✓ " : ""}
            {EVENT_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Actions par équipe */}
      <div className="card grid grid-cols-2 gap-3 p-3">
        {teamCol(m.home)}
        {teamCol(m.away)}
      </div>

      {/* Liste des événements */}
      <div className="card p-3">
        <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wide">Événements ({data.events.length})</h3>
        {data.events.length === 0 && <p className="py-4 text-center text-sm text-slate-500">Aucun événement.</p>}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...data.events].reverse().map((e) => (
            <li key={e.id} className="flex items-center gap-2 py-2">
              <span className="w-10 text-center text-xs font-black text-slate-500">{e.minute != null ? `${e.minute}'` : ""}{e.extraMinute ? `+${e.extraMinute}` : ""}</span>
              <EventIcon type={e.type as EventKey} />
              <div className="min-w-0 flex-1 text-sm">
                <div className="truncate font-semibold">{EVENT_LABELS[e.type as EventKey]}{e.clubId ? ` · ${e.clubId === m.home.id ? m.home.shortName : m.away.shortName}` : ""}</div>
                <div className="truncate text-xs text-slate-500">
                  {playerLabel(e)}
                  {e.type === "substitution" && e.rFirst ? ` → ${e.rFirst} ${e.rLast}` : ""}
                </div>
              </div>
              <button onClick={() => openEdit(e)} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand hover:bg-slate-100 dark:hover:bg-slate-800">Modifier</button>
            </li>
          ))}
        </ul>
      </div>

      {/* Statut, score, validation */}
      <div className="grid gap-3 md:grid-cols-3">
        <div className="card p-3">
          <h3 className="mb-2 text-xs font-extrabold uppercase">Statut du match</h3>
          <div className="grid grid-cols-2 gap-1.5">
            {(Object.keys(STATUS_LABELS) as StatusKey[]).map((s) => (
              <button
                key={s}
                disabled={pending || m.status === s}
                onClick={() =>
                  start(async () => {
                    const r = await setStatusAction(m.id, s);
                    if (r.ok) flash("ok", `Statut : ${STATUS_LABELS[s]}`);
                    else flash("err", r.error);
                    refresh();
                  })
                }
                className={`rounded-lg border px-2 py-2 text-xs font-semibold ${m.status === s ? "border-brand bg-brand text-white" : "border-slate-200 dark:border-slate-700"}`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        {perms.editScores && (
          <form
            className="card p-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              const f = new FormData(ev.currentTarget);
              const n = (k: string) => (f.get(k) === "" ? null : Number(f.get(k)));
              start(async () => {
                const r = await setScoreAction(m.id, { h: n("h") ?? 0, a: n("a") ?? 0, hp: n("hp"), ap: n("ap") });
                if (r.ok) flash("ok", "Score corrigé");
                else flash("err", r.error);
                refresh();
              });
            }}
          >
            <h3 className="mb-2 text-xs font-extrabold uppercase">Correction manuelle du score</h3>
            <div className="grid grid-cols-2 gap-2">
              <input key={`h${m.version}`} name="h" type="number" min={0} defaultValue={m.homeScore} className="input text-center font-bold" aria-label="Score domicile" />
              <input key={`a${m.version}`} name="a" type="number" min={0} defaultValue={m.awayScore} className="input text-center font-bold" aria-label="Score extérieur" />
              <input key={`hp${m.version}`} name="hp" type="number" min={0} defaultValue={m.homePens ?? ""} placeholder="TAB dom." className="input text-center" />
              <input key={`ap${m.version}`} name="ap" type="number" min={0} defaultValue={m.awayPens ?? ""} placeholder="TAB ext." className="input text-center" />
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Le score est recalculé automatiquement à chaque modification d&apos;un but.</p>
            <button disabled={pending} className="btn-ghost mt-2 w-full">Enregistrer</button>
          </form>
        )}
        {perms.validate && (
          <div className="card p-3">
            <h3 className="mb-2 text-xs font-extrabold uppercase">Validation du résultat</h3>
            <p className="mb-2 text-xs text-slate-500">Seuls les résultats validés comptent dans les classements et statistiques des joueurs.</p>
            <button
              disabled={pending || (m.status !== "finished" && !m.isValidated)}
              onClick={() =>
                start(async () => {
                  const r = await validateAction(m.id, !m.isValidated);
                  if (r.ok) flash("ok", m.isValidated ? "Validation annulée" : "Résultat validé");
                  else flash("err", r.error);
                  refresh();
                })
              }
              className={m.isValidated ? "btn-ghost w-full" : "btn-primary w-full"}
            >
              {m.isValidated ? "Annuler la validation" : "✓ Valider le résultat"}
            </button>
          </div>
        )}
      </div>

      {/* Feuille de saisie (bottom sheet) */}
      {draft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center" onClick={() => setDraft(null)}>
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] sm:rounded-3xl dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-black">{draft.editId ? "Modifier l'événement" : EVENT_LABELS[draft.type]}</h3>
              <button onClick={() => setDraft(null)} className="text-2xl leading-none text-slate-400">×</button>
            </div>
            <div className="space-y-3">
              {(draft.editId || ["goal", "penalty_goal", "own_goal"].includes(draft.type)) && (
                <div>
                  <label className="label">Type</label>
                  <div className="flex flex-wrap gap-1.5">
                    {(draft.editId ? (Object.keys(EVENT_LABELS) as EventKey[]) : (["goal", "penalty_goal", "own_goal"] as EventKey[])).map((t) => (
                      <button key={t} type="button" onClick={() => setDraft({ ...draft, type: t, playerId: "" })} className={`chip ${draft.type === t ? "border-brand bg-brand text-white" : "border-slate-200 dark:border-slate-700"}`}>
                        {EVENT_LABELS[t]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!PHASE_TYPES.includes(draft.type) && (
                <>
                  <div>
                    <label className="label">{draft.type === "own_goal" ? "Équipe bénéficiaire" : "Équipe"}</label>
                    <div className="grid grid-cols-2 gap-2">
                      {[m.home, m.away].map((c) => (
                        <button key={c.id} type="button" onClick={() => setDraft({ ...draft, clubId: c.id, playerId: "", relatedPlayerId: "" })} className={`flex items-center gap-2 rounded-xl border p-2 text-sm font-semibold ${draft.clubId === c.id ? "border-brand bg-emerald-50 dark:bg-emerald-950" : "border-slate-200 dark:border-slate-700"}`}>
                          <ClubCrest club={c} size={20} /> <span className="truncate">{c.shortName}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="label">{draft.type === "substitution" ? "Joueur sortant" : draft.type === "own_goal" ? "Joueur (adversaire)" : "Joueur"}</label>
                    <select value={draft.playerId} onChange={(e) => setDraft({ ...draft, playerId: e.target.value })} className="input !py-3">
                      <option value="">— Non précisé —</option>
                      {squadFor(draft).map((p) => (
                        <option key={p.id} value={p.id}>{p.shirtNumber ? `${p.shirtNumber}. ` : ""}{p.firstName} {p.lastName}</option>
                      ))}
                    </select>
                    {!draft.playerId && <input value={draft.playerName} onChange={(e) => setDraft({ ...draft, playerName: e.target.value })} placeholder="ou saisir un nom libre" className="input mt-2" />}
                  </div>
                  {draft.type === "substitution" && (
                    <div>
                      <label className="label">Joueur entrant</label>
                      <select value={draft.relatedPlayerId} onChange={(e) => setDraft({ ...draft, relatedPlayerId: e.target.value })} className="input !py-3">
                        <option value="">— Non précisé —</option>
                        {(draft.clubId === m.home.id ? homeSquad : awaySquad).map((p) => (
                          <option key={p.id} value={p.id}>{p.shirtNumber ? `${p.shirtNumber}. ` : ""}{p.firstName} {p.lastName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="label">Minute</label>
                  <input type="number" inputMode="numeric" min={0} max={130} value={draft.minute} onChange={(e) => setDraft({ ...draft, minute: e.target.value })} className="input !py-3 text-center text-lg font-bold" />
                </div>
                <div>
                  <label className="label">{draft.type.startsWith("shootout") ? "N° du tir" : "Temps add."}</label>
                  <input type="number" inputMode="numeric" min={0} max={30} value={draft.extraMinute} onChange={(e) => setDraft({ ...draft, extraMinute: e.target.value })} className="input !py-3 text-center text-lg font-bold" />
                </div>
              </div>
              <div>
                <label className="label">Note (facultatif)</label>
                <input value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} className="input" />
              </div>
              <button disabled={pending} onClick={saveDraft} className="btn-primary w-full py-4 text-base">
                {pending ? "Envoi…" : draft.editId ? "Enregistrer la modification" : "Valider"}
              </button>
              {draft.editId && (
                <button disabled={pending} onClick={() => remove(draft.editId!)} className="btn w-full text-red-600">Supprimer l&apos;événement</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
