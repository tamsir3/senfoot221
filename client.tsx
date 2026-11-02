"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { computeMinute, timeAgo } from "@/lib/format";
import { toggleFollow, markAllRead } from "@/app/actions/user";

export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);
  useEffect(() => setDark(document.documentElement.classList.contains("dark")), []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };
  return (
    <button onClick={toggle} aria-label="Changer de thème" className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10">
      {dark ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" /></svg>
      )}
    </button>
  );
}

export function LiveMinute({ status, currentPeriod, periodStartedAt, className = "" }: { status: string; currentPeriod: number; periodStartedAt: Date | string | null; className?: string }) {
  const [, setTick] = useState(0);
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    if (status !== "live") return;
    const t = setInterval(() => setTick((x) => x + 1), 15000);
    return () => clearInterval(t);
  }, [status]);
  if (!mounted) return <span className={className}>{status === "halftime" ? "MT" : "•"}</span>;
  return <span className={className}>{computeMinute({ status, currentPeriod, periodStartedAt })}</span>;
}

/** Rafraîchit les données serveur périodiquement (onglet visible uniquement) */
export function AutoRefresh({ active = true, interval = 30000 }: { active?: boolean; interval?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) router.refresh();
    }, interval);
    return () => clearInterval(t);
  }, [active, interval, router]);
  return null;
}

export function FollowButton({ type, id, initial, loggedIn }: { type: "club" | "competition"; id: number; initial: boolean; loggedIn: boolean }) {
  const [following, setFollowing] = useState(initial);
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      disabled={pending}
      onClick={() => {
        if (!loggedIn) return router.push("/connexion");
        start(async () => {
          const r = await toggleFollow(type, id);
          if ("following" in r) setFollowing(!!r.following);
        });
      }}
      className={`chip ${following ? "border-brand bg-brand text-white" : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"}`}
    >
      {following ? "★ Suivi" : "☆ Suivre"}
    </button>
  );
}

type Notif = { id: number; title: string; body: string; url: string | null; read: boolean; createdAt: string };

export function NotificationBell() {
  const [items, setItems] = useState<Notif[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [perm, setPerm] = useState<string>("default");
  const lastId = useRef<number | null>(null);

  useEffect(() => {
    if (typeof Notification !== "undefined") setPerm(Notification.permission);
    let stop = false;
    const load = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const r = await fetch("/api/notifications", { cache: "no-store" });
        if (!r.ok) return;
        const d: { unread: number; items: Notif[] } = await r.json();
        if (stop) return;
        const newest = d.items[0]?.id ?? 0;
        if (lastId.current !== null && newest > lastId.current && typeof Notification !== "undefined" && Notification.permission === "granted") {
          const fresh = d.items.filter((n) => n.id > lastId.current! && !n.read).slice(0, 3);
          const reg = await navigator.serviceWorker?.getRegistration();
          for (const n of fresh) {
            const opts = { body: n.body, icon: "/icons/icon-192.png", badge: "/icons/icon-192.png", data: { url: n.url ?? "/" }, tag: `n${n.id}` };
            if (reg) reg.showNotification(n.title, opts);
            else new Notification(n.title, opts);
          }
        }
        lastId.current = newest;
        setItems(d.items);
        setUnread(d.unread);
      } catch {}
    };
    load();
    const t = setInterval(load, 25000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, []);

  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} aria-label="Notifications" className="relative flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {unread > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-flag-red px-1 text-[10px] font-bold text-white">{unread > 9 ? "9+" : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[90vw] overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-800 shadow-2xl dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-slate-800">
            <span className="text-sm font-bold">Notifications</span>
            {unread > 0 && (
              <button
                className="text-xs font-semibold text-brand"
                onClick={async () => {
                  await markAllRead();
                  setUnread(0);
                  setItems((x) => x.map((n) => ({ ...n, read: true })));
                }}
              >
                Tout marquer comme lu
              </button>
            )}
          </div>
          {perm !== "granted" && typeof Notification !== "undefined" && (
            <button
              onClick={async () => setPerm(await Notification.requestPermission())}
              className="w-full bg-emerald-50 px-4 py-2 text-left text-xs font-semibold text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
            >
              🔔 Activer les alertes sur cet appareil
            </button>
          )}
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 && <p className="px-4 py-6 text-center text-sm text-slate-500">Aucune notification. Suivez vos clubs et compétitions favoris !</p>}
            {items.map((n) => (
              <Link key={n.id} href={n.url ?? "#"} onClick={() => setOpen(false)} className={`block border-b border-slate-100 px-4 py-3 text-sm last:border-0 hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${n.read ? "opacity-60" : ""}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{n.title}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{timeAgo(n.createdAt)}</span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{n.body}</p>
              </Link>
            ))}
          </div>
          <Link href="/compte" onClick={() => setOpen(false)} className="block bg-slate-50 px-4 py-2 text-center text-xs font-semibold text-brand dark:bg-slate-800">
            Gérer mes favoris
          </Link>
        </div>
      )}
    </div>
  );
}

export function PwaSetup() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);
  return null;
}

type BIPEvent = Event & { prompt: () => Promise<void> };

export function InstallButton() {
  const [evt, setEvt] = useState<BIPEvent | null>(null);
  useEffect(() => {
    const h = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);
  if (!evt) return null;
  return (
    <button onClick={() => evt.prompt().then(() => setEvt(null))} className="hidden rounded-full bg-sun px-3 py-1.5 text-xs font-bold text-slate-900 sm:inline-flex">
      Installer l&apos;app
    </button>
  );
}

const NAV = [
  { href: "/", label: "Accueil", icon: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" },
  { href: "/matchs", label: "Matchs", icon: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 4l3 2.2-1.1 3.6h-3.8L9 8.2z" },
  { href: "/competitions", label: "Compétitions", icon: "M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3" },
  { href: "/clubs", label: "Clubs", icon: "M12 2l8 3v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5z" },
  { href: "/actualites", label: "Actus", icon: "M4 4h13v16H5a1 1 0 0 1-1-1zM17 8h3v11a1 1 0 0 1-1 1h-2M7 8h7M7 12h7M7 16h4" },
];

export function NavLinks({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (h: string) => (h === "/" ? path === "/" : path.startsWith(h));
  if (variant === "top")
    return (
      <nav className="hidden items-center gap-1 md:flex">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${active(n.href) ? "bg-white/15 text-white" : "text-white/75 hover:text-white"}`}>
            {n.label}
          </Link>
        ))}
      </nav>
    );
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden dark:border-slate-800 dark:bg-slate-950/95">
      <div className="grid grid-cols-5">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} className={`flex flex-col items-center gap-0.5 py-2 text-[10px] font-semibold ${active(n.href) ? "text-brand" : "text-slate-500 dark:text-slate-400"}`}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round"><path d={n.icon} /></svg>
            {n.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
