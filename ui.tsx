import Link from "next/link";
import type { ReactNode } from "react";
import { initials, STATUS_LABELS, type StatusKey } from "@/lib/format";

type CrestClub = { name: string; shortName?: string | null; primaryColor: string; secondaryColor: string; logoUrl?: string | null };

export function ClubCrest({ club, size = 28 }: { club: CrestClub; size?: number }) {
  if (club.logoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={club.logoUrl} alt={club.name} width={size} height={size} loading="lazy" className="shrink-0 object-contain" style={{ width: size, height: size }} />;
  }
  const txt = (club.shortName || initials(club.name)).slice(0, 4);
  const fs = txt.length > 3 ? 7 : txt.length > 2 ? 8.5 : 10;
  return (
    <svg width={size} height={size} viewBox="0 0 32 36" className="shrink-0" role="img" aria-label={club.name}>
      <path d="M16 1 L30 6 V17 C30 26 23.5 32 16 35 C8.5 32 2 26 2 17 V6 Z" fill={club.primaryColor} stroke={club.secondaryColor} strokeWidth="2" />
      <path d="M16 3 L28 7.3 V12 H4 V7.3 Z" fill={club.secondaryColor} opacity="0.25" />
      <text x="16" y="22" textAnchor="middle" fontSize={fs} fontWeight="800" fill={club.secondaryColor} fontFamily="system-ui, sans-serif">
        {txt}
      </text>
    </svg>
  );
}

export function Avatar({ name, url, size = 48 }: { name: string; url?: string | null; size?: number }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} loading="lazy" />;
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-brand to-emerald-800 font-bold text-white"
      style={{ width: size, height: size, fontSize: size / 2.8 }}
    >
      {initials(name).slice(0, 2)}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status as StatusKey;
  const styles: Record<StatusKey, string> = {
    scheduled: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
    live: "bg-red-600 text-white",
    halftime: "bg-amber-500 text-white",
    finished: "bg-slate-800 text-white dark:bg-slate-700",
    postponed: "bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300",
    cancelled: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    suspended: "bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${styles[s]}`}>
      {s === "live" && <span className="live-dot h-1.5 w-1.5 rounded-full bg-white" />}
      {STATUS_LABELS[s]}
    </span>
  );
}

export function SectionTitle({ children, href, action, icon }: { children: ReactNode; href?: string; action?: string; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="flex items-center gap-2 text-base font-extrabold tracking-tight text-slate-900 dark:text-white">
        {icon}
        {children}
      </h2>
      {href && (
        <Link href={href} className="text-xs font-semibold text-brand hover:underline">
          {action ?? "Voir tout"} →
        </Link>
      )}
    </div>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">{children}</div>;
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <div
      className={`mb-4 rounded-xl px-4 py-3 text-sm font-medium ${
        err ? "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
      }`}
    >
      {err ?? ok}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }: { title: string; subtitle?: string; children?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl dark:text-white">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
