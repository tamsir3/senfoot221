"use client";

import Link from "next/link";
import { useActionState } from "react";
import { loginAction, registerAction, type FormState } from "@/app/actions/auth";

export function AuthForm({ mode, next }: { mode: "login" | "register"; next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? loginAction : registerAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-6">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "register" && (
        <div>
          <label className="label">Nom complet</label>
          <input name="name" required className="input" autoComplete="name" />
        </div>
      )}
      <div>
        <label className="label">E-mail</label>
        <input name="email" type="email" required className="input" autoComplete="email" />
      </div>
      <div>
        <label className="label">Mot de passe</label>
        <input name="password" type="password" required minLength={mode === "register" ? 8 : 1} className="input" autoComplete={mode === "login" ? "current-password" : "new-password"} />
      </div>
      {state?.error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{state.error}</p>}
      <button disabled={pending} className="btn-primary w-full">
        {pending ? "Veuillez patienter…" : mode === "login" ? "Se connecter" : "Créer mon compte"}
      </button>
      <p className="text-center text-sm text-slate-500">
        {mode === "login" ? (
          <>Pas encore de compte ? <Link href="/inscription" className="font-semibold text-brand">Inscrivez-vous</Link></>
        ) : (
          <>Déjà inscrit ? <Link href="/connexion" className="font-semibold text-brand">Connectez-vous</Link></>
        )}
      </p>
    </form>
  );
}
