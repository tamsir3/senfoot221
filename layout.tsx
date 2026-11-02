import type { Metadata, Viewport } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import "./globals.css";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { ensureSeeded } from "@/lib/seed";
import { InstallButton, NavLinks, NotificationBell, PwaSetup, ThemeToggle } from "@/components/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "SenFoot — Le football sénégalais en direct", template: "%s · SenFoot" },
  description: "Scores en direct, résultats, classements, clubs, joueurs et actualités du football sénégalais : Ligue 1, Ligue 2, Coupe du Sénégal, football féminin, jeunes et plus.",
  applicationName: "SenFoot",
  appleWebApp: { capable: true, title: "SenFoot", statusBarStyle: "black-translucent" },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#00853F" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const themeScript = `(function(){try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&matchMedia('(prefers-color-scheme: dark)').matches))document.documentElement.classList.add('dark')}catch(e){}})()`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  const user = await getCurrentUser();
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen bg-slate-100 text-slate-900 antialiased dark:bg-slate-950 dark:text-slate-100">
        <header className="sticky top-0 z-40 bg-gradient-to-r from-[#006b33] via-brand to-[#006b33] text-white shadow-md dark:from-slate-900 dark:via-slate-900 dark:to-slate-900 dark:shadow-black/40">
          <div className="h-1 w-full bg-[linear-gradient(90deg,#00853F_33%,#FDEF42_33%_66%,#E31B23_66%)]" />
          <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/30">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="#FDEF42"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6z" /></svg>
              </span>
              <span className="text-lg font-black tracking-tight">
                Sen<span className="text-sun">Foot</span>
              </span>
            </Link>
            <NavLinks variant="top" />
            <div className="ml-auto flex items-center gap-1">
              <InstallButton />
              <Link href="/recherche" aria-label="Rechercher" className="flex h-9 w-9 items-center justify-center rounded-full text-white/90 hover:bg-white/10">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></svg>
              </Link>
              <ThemeToggle />
              {user && <NotificationBell />}
              {user ? (
                <Link href={isStaff(user) ? "/admin" : "/compte"} className="ml-1 flex h-8 items-center gap-1.5 rounded-full bg-white/15 pl-1 pr-3 text-xs font-semibold ring-1 ring-white/20 hover:bg-white/25">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-sun text-[11px] font-black text-slate-900">{user.name[0]}</span>
                  <span className="hidden sm:inline">{isStaff(user) ? "Admin" : "Mon compte"}</span>
                </Link>
              ) : (
                <Link href="/connexion" className="ml-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand hover:bg-sun hover:text-slate-900">
                  Connexion
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-3 pb-24 pt-4 sm:px-4 md:pb-10">{children}</main>
        <footer className="hidden border-t border-slate-200 py-6 text-center text-xs text-slate-500 md:block dark:border-slate-800">
          SenFoot — Plateforme de suivi du football sénégalais · Horaires affichés à l&apos;heure de Dakar (GMT)
        </footer>
        <NavLinks variant="bottom" />
        <PwaSetup />
      </body>
    </html>
  );
}
