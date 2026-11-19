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
  Coins,
} from "lucide-react";
import type { ReactNode } from "react";
import logoAsset from "@/assets/tchotcho-logo.png";
import iconAsset from "@/assets/tchotcho-icon.png";
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
    { to: "/dashboard", label: "Dashboard", icon: Home },
    ...(transfersEnabled ? [{ to: "/enviar", label: "Enviar Dinero", icon: Send }] : []),
    ...(topupsEnabled ? [{ to: "/recargas", label: "Recargas Haití", icon: Smartphone }] : []),
    { to: "/historial", label: "Transacciones", icon: History },
    { to: "/perfil", label: "Mi Cuenta", icon: User },
  ];

  const workflowNav = [
    { to: "/soporte", label: "Centro de Ayuda", icon: LifeBuoy },
    ...(isAdmin ? [{ to: "/admin", label: "Panel Admin", icon: Shield }] : []),
    ...(isAgent ? [{ to: "/agente", label: "Portal de Agente", icon: Briefcase }] : []),
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-black text-slate-100 md:flex selection:bg-[#02531C] selection:text-[#F2AC00]">
      {/* Desktop Sidebar matching SaaS Dashboard mockup */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-gradient-to-b from-[#101612] via-[#0C110E] to-[#080B09] border-r border-white/10 p-4 text-slate-200 md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto custom-scrollbar">
        <div className="flex flex-1 flex-col">
          {/* Organization Switcher Header con Logo Tcho-Tcho bien destacado */}
          <div className="mb-6 flex items-center justify-between gap-2 p-2.5 rounded-2xl bg-white border-2 border-white shadow-[0_0_24px_rgba(242,172,0,0.3)]">
            <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
              <img src={iconAsset} alt="Tcho-Tcho" className="size-8 object-contain shrink-0" />
              <img src={logoAsset} alt="Tcho-Tcho" className="h-6 w-auto object-contain shrink-0" />
            </Link>
            <NotificationBell triggerClassName="text-slate-800 hover:text-black hover:bg-slate-100" />
          </div>

          {/* Core Navigation */}
          <nav className="flex flex-col gap-1.5">
            {coreNav.map((item) => {
              const isActive = pathname === item.to;
              return (
                <Link
                  key={item.label}
                  to={item.to}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all",
                    isActive
                      ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_16px_rgba(2,83,28,0.5)] border border-[#F2AC00]/50"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white hover:border-white/10 border border-transparent",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-[#F2AC00]" : "text-emerald-400",
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Servicios Adicionales */}
          <div className="mt-6">
            <p className="px-3.5 pb-2 text-[11px] font-black uppercase tracking-wider text-emerald-400">
              Más Opciones
            </p>
            <nav className="flex flex-col gap-1.5">
              {workflowNav.map((item) => {
                const isActive = pathname === item.to;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold transition-all",
                      isActive
                        ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_16px_rgba(2,83,28,0.5)] border border-[#F2AC00]/50"
                        : "text-slate-300 hover:bg-white/[0.06] hover:text-white hover:border-white/10 border border-transparent",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4 shrink-0",
                        isActive ? "text-[#F2AC00]" : "text-emerald-400",
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Widget inferior enfocado 100% en envíos a Haití */}
          <div className="mt-8 rounded-2xl bg-gradient-to-b from-[#18241C] to-[#0F1611] border border-emerald-500/30 p-4 text-center shadow-lg relative overflow-hidden group">
            <div className="absolute -top-10 -right-10 size-28 rounded-full bg-[#F2AC00]/15 blur-xl pointer-events-none" />
            <div className="mx-auto mb-2.5 flex h-11 w-24 items-center justify-center rounded-xl bg-gradient-to-tr from-black to-[#0A2613] p-2 border border-[#F2AC00]/40 shadow-inner">
              <span className="text-xs font-black text-[#F2AC00]">Tcho-Tcho</span>
            </div>
            <p className="text-xs font-black text-white">MonCash & NatCash Directo</p>
            <p className="text-[10px] text-slate-300 mt-0.5">
              Acreditación flash en &lt; 2 minutos
            </p>
            <Link
              to="/enviar"
              className="mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F2AC00] px-3.5 py-2 text-xs font-black text-black shadow-[0_0_15px_rgba(242,172,0,0.4)] hover:bg-[#FBBF24] transition"
            >
              Enviar Dinero
              <ArrowRight className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Sidebar Footer */}
        <div className="mt-4 shrink-0 space-y-2.5 border-t border-white/10 pt-3">
          <LanguageSwitcher className="w-full bg-[#161F18] text-slate-200 border-white/10 text-xs font-semibold" />
          <div className="px-1 py-1">
            <p className="truncate text-xs font-extrabold text-white">
              {profile?.full_name || t("nav.account")}
            </p>
            <p className="truncate text-[10px] font-semibold text-emerald-400">
              {profile?.phone || "Personal Account"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs font-bold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300"
            onClick={signOut}
          >
            <LogOut className="size-3.5" /> {t("nav.signout")}
          </Button>
          {isCustomBrand && (
            <div className="pt-2 text-center border-t border-white/10">
              <a
                href="https://lajanrapid.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 text-[10px] text-slate-400 transition hover:text-slate-200"
              >
                <span>Creado por</span>
                <span className="font-bold text-[#F2AC00] underline underline-offset-2">
                  lajanrapid.app
                </span>
              </a>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-white/10 bg-[#060A08]/95 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl md:hidden">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white px-2.5 py-1 shadow-[0_0_16px_rgba(242,172,0,0.3)] border border-white">
              <img src={iconAsset} alt="Tcho-Tcho" className="size-6 object-contain shrink-0" />
              <img src={logoAsset} alt="Tcho-Tcho" className="h-5 w-auto object-contain shrink-0" />
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={t("nav.support")}
              className="text-slate-300 hover:text-white hover:bg-white/10"
            >
              <Link to="/soporte">
                <LifeBuoy className="size-4" />
              </Link>
            </Button>
            <NotificationBell triggerClassName="text-slate-300 hover:text-white hover:bg-white/10" />
            <LanguageSwitcher className="h-9 w-[80px] text-xs bg-white/10 border-white/15 text-white" />
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label={t("nav.signout")}
              className="text-slate-300 hover:text-white hover:bg-white/10"
            >
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
          className="fixed bottom-4 inset-x-4 z-40 mx-auto max-w-sm rounded-[28px] bg-[#0E1511]/95 backdrop-blur-2xl border-2 border-emerald-500/30 px-3.5 py-2 shadow-[0_16px_40px_rgba(0,0,0,0.95)] md:hidden"
          style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
        >
          <ul className="flex items-center justify-between">
            <li>
              <Link
                to="/dashboard"
                className={cn(
                  "flex items-center justify-center rounded-2xl p-2.5 transition-all",
                  pathname === "/dashboard"
                    ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_16px_rgba(242,172,0,0.4)] border-2 border-[#F2AC00]"
                    : "text-slate-300 hover:text-white",
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
                      ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_16px_rgba(242,172,0,0.4)] border-2 border-[#F2AC00]"
                      : "text-slate-300 hover:text-white",
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
                      ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_16px_rgba(242,172,0,0.4)] border-2 border-[#F2AC00]"
                      : "text-slate-300 hover:text-white",
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
                    ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_16px_rgba(242,172,0,0.4)] border-2 border-[#F2AC00]"
                    : "text-slate-300 hover:text-white",
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
                    ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_16px_rgba(242,172,0,0.4)] border-2 border-[#F2AC00]"
                    : "text-slate-300 hover:text-white",
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
