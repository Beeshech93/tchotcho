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
  Smartphone,
  CreditCard,
  Wallet,
  Receipt,
  FileSpreadsheet,
  ChevronDown,
  Sparkles,
  ArrowRight,
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

  const coreNav = [
    { to: "/dashboard", label: "Home", icon: Home },
    { to: "/historial", label: "Transactions", icon: History },
    ...(transfersEnabled ? [{ to: "/enviar", label: "Payments", icon: Send }] : []),
    { to: "/dashboard", label: "Cards", icon: CreditCard },
    { to: "/perfil", label: "Accounts", icon: Wallet },
  ];

  const workflowNav = [
    ...(topupsEnabled ? [{ to: "/recargas", label: "Bill Pay", icon: Smartphone }] : []),
    ...(transfersEnabled ? [{ to: "/enviar", label: "Invoicing", icon: Receipt }] : []),
    { to: "/soporte", label: "Reimbursements", icon: LifeBuoy },
    ...(isAdmin ? [{ to: "/admin", label: "Accounting", icon: Shield }] : []),
    ...(isAgent ? [{ to: "/agente", label: "Agent Portal", icon: Briefcase }] : []),
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 md:flex selection:bg-[#02531C] selection:text-[#F2AC00]">
      {/* Desktop Sidebar matching SaaS Dashboard mockup */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-[#0B0D0C] border-r border-white/5 p-4 text-slate-300 md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto custom-scrollbar">
        <div className="flex flex-1 flex-col">
          {/* Organization Switcher Header */}
          <div className="mb-6 flex items-center justify-between gap-2 p-2 rounded-xl bg-white/[0.03] border border-white/5">
            <Link to="/dashboard" className="flex min-w-0 items-center gap-2.5">
              <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-[#02531C] p-1 border border-[#F2AC00]/30 shadow-md">
                <img src={logoSrc} alt={currentBrand.name} className="h-full w-full object-contain" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Banking</p>
                <h2 className="truncate font-display text-sm font-bold text-white">{currentBrand.name}</h2>
              </div>
            </Link>
            <NotificationBell triggerClassName="text-slate-400 hover:text-white hover:bg-white/5" />
          </div>

          {/* Core Navigation */}
          <nav className="flex flex-col gap-1">
            {coreNav.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all",
                    isActive
                      ? "bg-[#02531C] text-[#F2AC00] font-semibold shadow-sm border border-[#F2AC00]/20"
                      : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                  )}
                >
                  <item.icon className={cn("size-4 shrink-0", isActive ? "text-[#F2AC00]" : "text-slate-400")} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Workflows Sub-Group */}
          <div className="mt-6">
            <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
              Workflows
            </p>
            <nav className="flex flex-col gap-1">
              {workflowNav.map((item) => {
                const isActive = pathname === item.to;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-medium transition-all",
                      isActive
                        ? "bg-[#02531C] text-[#F2AC00] font-semibold shadow-sm border border-[#F2AC00]/20"
                        : "text-slate-400 hover:bg-white/[0.04] hover:text-white"
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", isActive ? "text-[#F2AC00]" : "text-slate-400")} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Promotional Bottom Widget ("Accept credit cards and bank payment") */}
          <div className="mt-8 rounded-2xl bg-gradient-to-b from-[#141815] to-[#0A0D0B] border border-white/5 p-3.5 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 size-24 rounded-full bg-[#02531C]/20 blur-xl pointer-events-none" />
            <div className="mx-auto mb-2.5 flex h-14 w-24 items-center justify-between rounded-lg bg-gradient-to-tr from-slate-900 to-[#122417] p-2 border border-white/10 shadow-inner">
              <div className="size-3.5 rounded-sm bg-[#F2AC00]/80 border border-white/30" />
              <span className="text-[8px] font-mono font-bold text-white/50">Tcho-Tcho</span>
            </div>
            <p className="text-xs font-semibold text-white">Accept credit cards and bank payment</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Instant deposits in HTG & USD</p>
            <Link
              to="/enviar"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F2AC00] px-3 py-2 text-xs font-bold text-black shadow-md hover:bg-[#F2AC00]/90 transition"
            >
              Set up now
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="mt-4 shrink-0 space-y-2 border-t border-white/5 pt-3">
          <LanguageSwitcher className="w-full bg-white/[0.04] text-slate-300 border-white/5 text-xs" />
          <div className="px-1 py-1">
            <p className="truncate text-xs font-semibold text-white">{profile?.full_name || t("nav.account")}</p>
            <p className="truncate text-[10px] text-slate-400">{profile?.phone || "Personal Account"}</p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-rose-400 hover:bg-rose-500/10 hover:text-rose-300"
            onClick={signOut}
          >
            <LogOut className="size-3.5" /> {t("nav.signout")}
          </Button>
          {isCustomBrand && (
            <div className="pt-2 text-center border-t border-white/5">
              <a
                href="https://lajanrapid.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-500 transition hover:text-slate-300"
              >
                <span>Creado por</span>
                <span className="font-semibold text-[#F2AC00] underline underline-offset-2">lajanrapid.app</span>
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
        </main>

        <nav
          className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-sm rounded-[28px] bg-[#0D0D0D]/95 backdrop-blur-2xl border border-white/10 px-3 py-2 shadow-[0_12px_32px_rgba(0,0,0,0.9)] md:hidden"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <ul className="flex items-center justify-between">
            <li>
              <Link
                to="/dashboard"
                className={cn(
                  "flex items-center justify-center rounded-2xl p-2.5 transition-all",
                  pathname === "/dashboard"
                    ? "bg-[#02531C] text-[#F2AC00] shadow-lg shadow-[#02531C]/40 border border-[#F2AC00]/30"
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
                      ? "bg-[#02531C] text-[#F2AC00] shadow-lg shadow-[#02531C]/40 border border-[#F2AC00]/30"
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
                      ? "bg-[#02531C] text-[#F2AC00] shadow-lg shadow-[#02531C]/40 border border-[#F2AC00]/30"
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
                    ? "bg-[#02531C] text-[#F2AC00] shadow-lg shadow-[#02531C]/40 border border-[#F2AC00]/30"
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
                    ? "bg-[#02531C] text-[#F2AC00] shadow-lg shadow-[#02531C]/40 border border-[#F2AC00]/30"
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
