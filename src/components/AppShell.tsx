import { Link, useRouter, useRouterState } from "@tanstack/react-router";
import {
  Home,
  Send,
  History,
  User,
  LifeBuoy,
  Shield,
  Briefcase,
  LogOut,
  Plus,
  Smartphone,
} from "lucide-react";
import type { ReactNode } from "react";
import logoAsset from "@/assets/lajan-rapid-logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { NotificationBell } from "@/components/NotificationBell";
import { AdBanner } from "@/components/AdBanner";
import { useServicesConfig } from "@/hooks/useServicesConfig";
import { useI18n } from "@/lib/i18n";
import { useBrand } from "@/hooks/useBrand";

const baseNav = [
  { to: "/dashboard", key: "nav.home", icon: Home },
  { to: "/enviar", key: "nav.send", icon: Send },
  { to: "/recargas", key: "nav.topups", icon: Smartphone },
  { to: "/historial", key: "nav.history", icon: History },
  { to: "/perfil", key: "nav.profile", icon: User },
];

const mobileNav = [
  { to: "/dashboard", key: "nav.home", icon: Home },
  { to: "/recargas", key: "nav.topups", icon: Smartphone },
  { to: "/historial", key: "nav.history", icon: History },
  { to: "/perfil", key: "nav.profile", icon: User },
];

type NavEntry = { to: string; key: string; icon: typeof Home };

function NavItem({ item, active, label }: { item: NavEntry; active: boolean; label: string }) {
  return (
    <li>
      <Link
        to={item.to}
        className={cn(
          "press flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-semibold transition-colors",
          active ? "text-accent" : "text-muted-foreground",
        )}
      >
        <span
          className={cn(
            "grid size-9 place-items-center rounded-xl transition-colors",
            active ? "bg-accent/12" : "bg-transparent",
          )}
        >
          <item.icon className="size-5" />
        </span>
        <span className="max-w-full truncate px-1">{label}</span>
      </Link>
    </li>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, isAdmin, isAgent } = useProfile();
  const { t } = useI18n();
  const { currentBrand, logoSrc, isCustomBrand } = useBrand();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const { isEnabled } = useServicesConfig();
  const transfersEnabled = isEnabled("transfers");
  const topupsEnabled = isEnabled("topups");

  const nav = [
    { to: "/dashboard", key: "nav.home", icon: Home },
    ...(transfersEnabled ? [{ to: "/enviar", key: "nav.send", icon: Send }] : []),
    ...(topupsEnabled ? [{ to: "/recargas", key: "nav.topups", icon: Smartphone }] : []),
    { to: "/historial", key: "nav.history", icon: History },
    { to: "/perfil", key: "nav.profile", icon: User },
    ...(isAgent ? [{ to: "/agente", key: "nav.agent", icon: Briefcase }] : []),
    ...(isAdmin ? [{ to: "/admin", key: "nav.admin", icon: Shield }] : []),
    { to: "/soporte", key: "nav.support", icon: LifeBuoy },
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-background md:flex">
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-sidebar p-5 text-sidebar-foreground md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto">
        <div className="flex flex-1 flex-col">
          <div className="mb-8 flex items-center justify-between gap-2">
            <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-xl bg-logo-surface p-1">
                <img src={logoSrc} alt={currentBrand.name} className="h-full w-full object-contain" />
              </span>
              <span className="truncate font-display text-lg font-semibold">{currentBrand.name}</span>
            </Link>
            <NotificationBell triggerClassName="text-sidebar-foreground/70 hover:text-sidebar-accent-foreground hover:bg-sidebar-accent/60" />
          </div>
          <nav className="flex flex-1 flex-col gap-1">
            {nav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  pathname === item.to
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                )}
              >
                <item.icon className="size-4" />
                {t(item.key)}
              </Link>
            ))}
          </nav>
        </div>
        <div className="mt-4 shrink-0 space-y-2 border-t border-sidebar-border pt-4">
          <LanguageSwitcher className="w-full bg-sidebar-accent/40 text-sidebar-foreground" />
          <p className="truncate text-sm font-medium">{profile?.full_name || t("nav.account")}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-accent-foreground"
            onClick={signOut}
          >
            <LogOut className="size-4" /> {t("nav.signout")}
          </Button>
          {isCustomBrand && (
            <div className="pt-3 text-center border-t border-sidebar-border/40">
              <a
                href="https://lajanrapid.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 text-[11px] text-sidebar-foreground/60 transition hover:text-sidebar-foreground"
              >
                <span>Creado por</span>
                <span className="font-semibold text-primary underline underline-offset-2">lajanrapid.app</span>
              </a>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-b bg-card/90 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-md md:hidden">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="grid size-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-logo-surface p-0.5">
              <img src={logoSrc} alt={currentBrand.name} className="h-full w-full object-contain" />
            </span>
            <span className="truncate font-display font-semibold">{currentBrand.name}</span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Button variant="ghost" size="icon" asChild aria-label={t("nav.support")}>
              <Link to="/soporte">
                <LifeBuoy className="size-4" />
              </Link>
            </Button>
            <NotificationBell />
            <LanguageSwitcher className="h-9 w-[96px] text-xs" />
            <Button variant="ghost" size="icon" onClick={signOut} aria-label={t("nav.signout")}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main
          className="flex-1 px-4 pt-5 md:px-8 md:pb-10"
          style={{ paddingBottom: "calc(5.75rem + env(safe-area-inset-bottom))" }}
        >
          <AdBanner className="mb-5" />
          {children}

          {isCustomBrand && (
            <footer className="mt-12 pb-6 text-center">
              <a
                href="https://lajanrapid.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 rounded-full border border-border/50 bg-card/60 px-3.5 py-1 text-xs text-muted-foreground transition hover:border-primary/50 hover:text-foreground shadow-sm"
              >
                <span>Tecnología y motor creado por</span>
                <span className="font-semibold text-primary">lajanrapid.app</span>
              </a>
            </footer>
          )}
        </main>

        <nav
          className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-sm rounded-[28px] bg-[#140F29]/95 backdrop-blur-2xl border border-white/10 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.8)] md:hidden"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <ul className="flex items-center justify-between">
            <li>
              <Link
                to="/dashboard"
                className={cn(
                  "flex items-center justify-center rounded-2xl p-2.5 transition-all",
                  pathname === "/dashboard"
                    ? "bg-[#6938F8] text-white shadow-lg shadow-[#6938F8]/40"
                    : "text-slate-400 hover:text-white"
                )}
                aria-label={t("nav.home")}
              >
                <Home className="size-5" />
              </Link>
            </li>

            {topupsEnabled && (
              <li>
                <Link
                  to="/recargas"
                  className={cn(
                    "flex items-center justify-center rounded-2xl p-2.5 transition-all",
                    pathname === "/recargas"
                      ? "bg-[#6938F8] text-white shadow-lg shadow-[#6938F8]/40"
                      : "text-slate-400 hover:text-white"
                  )}
                  aria-label={t("nav.topups")}
                >
                  <Smartphone className="size-5" />
                </Link>
              </li>
            )}

            {transfersEnabled && (
              <li>
                <Link
                  to="/enviar"
                  className={cn(
                    "flex items-center justify-center rounded-2xl p-2.5 transition-all",
                    pathname === "/enviar"
                      ? "bg-[#6938F8] text-white shadow-lg shadow-[#6938F8]/40"
                      : "text-slate-400 hover:text-white"
                  )}
                  aria-label={t("nav.send")}
                >
                  <Send className="size-5" />
                </Link>
              </li>
            )}

            <li>
              <Link
                to="/historial"
                className={cn(
                  "flex items-center justify-center rounded-2xl p-2.5 transition-all",
                  pathname === "/historial"
                    ? "bg-[#6938F8] text-white shadow-lg shadow-[#6938F8]/40"
                    : "text-slate-400 hover:text-white"
                )}
                aria-label={t("nav.history")}
              >
                <History className="size-5" />
              </Link>
            </li>

            <li>
              <Link
                to="/perfil"
                className={cn(
                  "flex items-center justify-center rounded-2xl p-2.5 transition-all",
                  pathname === "/perfil"
                    ? "bg-[#6938F8] text-white shadow-lg shadow-[#6938F8]/40"
                    : "text-slate-400 hover:text-white"
                )}
                aria-label={t("nav.profile")}
              >
                <User className="size-5" />
              </Link>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}
