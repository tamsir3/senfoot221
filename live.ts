"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import {
  addEvent,
  deleteEvent,
  setMatchStatus,
  setScore,
  setValidation,
  updateEvent,
  ServiceError,
  type EventInput,
} from "@/lib/match-service";
import type { MatchStatus } from "@/db/schema";

type Result = { ok: true } | { ok: false; error: string };

async function run(matchId: number, fn: (u: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>) => Promise<unknown>): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Session expirée, reconnectez-vous." };
  try {
    await fn(user);
    revalidatePath(`/matchs/${matchId}`);
    return { ok: true };
  } catch (e) {
    if (e instanceof ServiceError) return { ok: false, error: e.message };
    console.error(e);
    return { ok: false, error: "Erreur inattendue. Réessayez." };
  }
}

export async function addEventAction(input: EventInput) {
  return run(input.matchId, (u) => addEvent(u, input));
}

export async function updateEventAction(matchId: number, eventId: number, patch: Omit<EventInput, "matchId" | "clientId">) {
  return run(matchId, (u) => updateEvent(u, eventId, patch));
}

export async function deleteEventAction(matchId: number, eventId: number) {
  return run(matchId, (u) => deleteEvent(u, eventId));
}

export async function setStatusAction(matchId: number, status: MatchStatus) {
  return run(matchId, (u) => setMatchStatus(u, matchId, status));
}

export async function setScoreAction(matchId: number, s: { h: number; a: number; hp: number | null; ap: number | null }) {
  return run(matchId, (u) => setScore(u, matchId, s));
}

export async function validateAction(matchId: number, validated: boolean) {
  return run(matchId, (u) => setValidation(u, matchId, validated));
}
