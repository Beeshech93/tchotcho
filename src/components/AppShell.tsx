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
import { SocialLinks } from "@/components/SocialLinks";
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
          "press flex flex-col items-center gap-0.5 py-1.5 text-[10px] transition-colors",
          active ? "text-emerald-800 font-black" : "text-slate-600 font-bold hover:text-slate-900",
        )}
      >
        <span
          className={cn(
            "grid size-9 place-items-center rounded-xl transition-colors",
            active ? "bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs" : "bg-transparent",
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

  // Ocultar opciones de cliente/dashboard únicamente para los agentes que no son administradores
  const isAgentOnly = isAgent && !isAdmin;

  const { isEnabled } = useServicesConfig();
  const transfersEnabled = isEnabled("transfers");
  const topupsEnabled = isEnabled("topups");

  const coreNav = [
    ...(!isAgentOnly ? [{ to: "/dashboard", label: t("shell.dashboard"), icon: Home }] : []),
    ...(transfersEnabled && !isAgentOnly ? [{ to: "/enviar", label: t("shell.send_money"), icon: Send }] : []),
    ...(topupsEnabled && !isAgentOnly ? [{ to: "/recargas", label: t("shell.topups"), icon: Smartphone }] : []),
    {
      to: isAgentOnly ? "/agente" : "/historial",
      label: isAgentOnly ? t("shell.agent_portal") : t("shell.transactions"),
      icon: isAgentOnly ? Briefcase : History,
    },
    { to: "/perfil", label: t("shell.my_account"), icon: User },
  ];

  const workflowNav = [
    { to: "/soporte", label: t("shell.help_center"), icon: LifeBuoy },
    ...(isAdmin ? [{ to: "/admin", label: t("shell.admin_panel"), icon: Shield }] : []),
    ...(isAdmin && isAgent ? [{ to: "/agente", label: t("shell.agent_portal"), icon: Briefcase }] : []),
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F4F7F5] text-slate-900 md:flex selection:bg-[#DCFCE7] selection:text-[#15803D] w-full max-w-full overflow-x-hidden">
      {/* Desktop Sidebar matching SaaS Dashboard mockup - ajustado con paleta limpia y profesional */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-white border-r border-slate-200 p-3 text-slate-800 md:fixed md:inset-y-0 md:left-0 md:z-30 md:flex md:w-64 md:h-screen md:overflow-y-auto custom-scrollbar select-none shadow-xs">
        <div className="flex flex-col gap-2">
          {/* Organization Switcher Header con Logo Tcho-Tcho bien destacado */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-[#F0FDF4] border border-emerald-200/80 shadow-xs">
            <Link to={isAgentOnly ? "/agente" : "/dashboard"} className="flex min-w-0 items-center gap-2">
              <img src={iconAsset} alt="Tcho-Tcho" className="size-7 object-contain shrink-0" />
              <img src={logoAsset} alt="Tcho-Tcho" className="h-5 w-auto object-contain shrink-0" />
            </Link>
            <NotificationBell triggerClassName="text-slate-600 hover:text-slate-900 hover:bg-slate-100 size-7" />
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
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-all",
                    isActive
                      ? "bg-emerald-50 text-emerald-800 border-2 border-emerald-300 shadow-2xs font-black"
                      : "text-slate-700 hover:bg-slate-100 hover:text-slate-950 border border-transparent font-bold",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-emerald-700" : "text-slate-500",
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Servicios Adicionales */}
          <div className="pt-1">
            <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-slate-400">
              {t("shell.more_options")}
            </p>
            <nav className="flex flex-col gap-1">
              {workflowNav.map((item) => {
                const isActive = pathname === item.to;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs transition-all",
                      isActive
                        ? "bg-emerald-50 text-emerald-900 border-2 border-emerald-300 shadow-2xs font-black"
                        : "text-slate-800 hover:bg-slate-100 hover:text-slate-950 border border-transparent font-bold",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4 shrink-0",
                        isActive ? "text-emerald-700" : "text-slate-700",
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Mini-Badge compacto de envíos directos a Haití */}
          {!isAgentOnly && (
            <Link
              to="/enviar"
              className="rounded-xl bg-[#F8FAF9] border border-slate-200 p-2.5 text-center shadow-xs hover:border-emerald-500/40 transition group block"
            >
              <p className="text-[11px] font-black text-[#15803D] flex items-center justify-center gap-1">
                <span>MonCash & NatCash Flash</span>
                <ArrowRight className="size-3 group-hover:translate-x-0.5 transition" />
              </p>
              <p className="text-[9px] text-slate-500">{t("shell.direct_credit")}</p>
            </Link>
          )}

          {/* Redes Oficiales compactas */}
          <div className="rounded-xl bg-[#F8FAF9] border border-slate-200 px-2.5 py-1.5 flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
              {t("shell.social_networks")}
            </span>
            <SocialLinks iconSize="size-3.5" className="justify-end gap-1.5" />
          </div>
        </div>

        {/* Sidebar Footer compacto */}
        <div className="shrink-0 space-y-1.5 border-t border-slate-200 pt-2.5 mt-2">
          <LanguageSwitcher className="w-full h-8 bg-[#F8FAF9] text-slate-700 border-slate-200 text-xs font-semibold py-1 hover:bg-slate-100" />
          <div className="px-1 py-0.5">
            <div className="flex items-center justify-between gap-1.5">
              <p className="truncate text-xs font-extrabold text-slate-900">
                {profile?.full_name || t("nav.account")}
              </p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#EF4444] px-1.5 py-0.5 text-[9px] font-bold text-white shrink-0 uppercase shadow-xs">
                  <Shield className="size-2.5" /> ADMIN
                </span>
              )}
            </div>
            <p className="truncate text-[10px] font-semibold text-slate-500">
              {profile?.phone || t("roles.super_admin")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 justify-start gap-2 text-xs font-bold text-rose-600 hover:bg-rose-50 hover:text-rose-700 py-1"
            onClick={signOut}
          >
            <LogOut className="size-3.5" /> {t("nav.signout")}
          </Button>
          {isCustomBrand && (
            <div className="pt-1 text-center border-t border-slate-200">
              <a
                href="https://tchotcho.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 text-[9px] text-slate-400 transition hover:text-slate-600"
              >
                <span>{t("shell.created_by")}</span>
                <span className="font-bold text-[#15803D] underline underline-offset-2">
                  tchotcho.app
                </span>
              </a>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col min-w-0 w-full max-w-full overflow-x-hidden md:pl-64">
        {/* Mobile Header - Fijo al tope en versión móvil */}
        <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between gap-1.5 sm:gap-2 border-b border-slate-200 bg-white/95 px-3 sm:px-4 py-2.5 sm:py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl md:hidden shadow-xs w-full max-w-full">
          <Link to={isAgentOnly ? "/agente" : "/dashboard"} className="flex min-w-0 items-center gap-1.5 sm:gap-2 shrink-0">
            <span className="inline-flex items-center gap-1.5 sm:gap-2 rounded-xl bg-[#F0FDF4] px-2 py-1 shadow-xs border border-emerald-200/80">
              <img src={iconAsset} alt="Tcho-Tcho" className="size-5 sm:size-6 object-contain shrink-0" />
              <img src={logoAsset} alt="Tcho-Tcho" className="h-4 sm:h-5 w-auto object-contain shrink-0" />
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-0.5 sm:gap-1">
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label={t("nav.support")}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 size-8 sm:size-9"
            >
              <Link to="/soporte">
                <LifeBuoy className="size-4" />
              </Link>
            </Button>
            <NotificationBell triggerClassName="text-slate-600 hover:text-slate-900 hover:bg-slate-100 size-8 sm:size-9" />
            <LanguageSwitcher className="h-8 sm:h-9 w-[74px] sm:w-[80px] text-[11px] sm:text-xs bg-slate-100 border-slate-200 text-slate-800 px-1.5" />
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label={t("nav.signout")}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 size-8 sm:size-9"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main
          className="flex-1 px-3 sm:px-4 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:px-8 md:pt-5 md:pb-10 min-w-0 w-full max-w-full overflow-x-hidden"
        >
          <AdBanner className="mb-5" />
          {children}

          <footer className="mt-14 border-t-2 border-slate-200 pt-6 pb-2 text-center space-y-2.5">
            <p className="text-xs font-bold text-slate-700">
              {t("shell.official_channels")}
            </p>
            <SocialLinks iconSize="size-4" className="justify-center gap-2" />
            <p className="text-xs font-bold text-slate-600">
              © {new Date().getFullYear()} Tcho-Tcho · {t("landing.footer")}
            </p>
          </footer>
        </main>

        {/* Mobile Navigation Dock - Fijo al fondo con colores adaptados */}
        <nav
          className="fixed bottom-0 inset-x-0 z-50 w-full rounded-t-[28px] border-t-2 border-x-2 border-emerald-500/30 bg-white/95 backdrop-blur-2xl shadow-[0_-8px_32px_rgba(0,0,0,0.08)] md:hidden select-none pointer-events-auto px-3 pt-2.5 pb-[calc(0.6rem+env(safe-area-inset-bottom,0px))]"
          aria-label="Navegación móvil"
        >
          <div className="mx-auto max-w-sm">
            <ul className="flex items-center justify-around gap-1">
              {!isAgentOnly && (
                <li>
                  <Link
                    to="/dashboard"
                    className={cn(
                      "flex items-center justify-center transition-all duration-200 active:scale-95",
                      pathname === "/dashboard"
                        ? "size-11 rounded-full bg-[#DCFCE7] text-[#15803D] shadow-sm border-2 border-emerald-500/70 scale-105"
                        : "size-10 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-[#15803D] hover:bg-emerald-50",
                    )}
                    aria-label={t("nav.home")}
                  >
                    <Home className="size-5" />
                  </Link>
                </li>
              )}

              {topupsEnabled && !isAgentOnly && (
                <li>
                  <Link
                    to="/recargas"
                    className={cn(
                      "flex items-center justify-center transition-all duration-200 active:scale-95",
                      pathname.startsWith("/recargas")
                        ? "size-11 rounded-full bg-[#DCFCE7] text-[#15803D] shadow-sm border-2 border-emerald-500/70 scale-105"
                        : "size-10 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-[#15803D] hover:bg-emerald-50",
                    )}
                    aria-label={t("nav.topups")}
                  >
                    <Smartphone className="size-5" />
                  </Link>
                </li>
              )}

              {transfersEnabled && !isAgentOnly && (
                <li>
                  <Link
                    to="/enviar"
                    className={cn(
                      "flex items-center justify-center transition-all duration-200 active:scale-95",
                      pathname.startsWith("/enviar")
                        ? "size-11 rounded-full bg-[#DCFCE7] text-[#15803D] shadow-sm border-2 border-emerald-500/70 scale-105"
                        : "size-10 rounded-full bg-emerald-50 border border-emerald-300 text-[#15803D] hover:bg-emerald-100 shadow-xs",
                    )}
                    aria-label={t("nav.send")}
                  >
                    <Send className="size-5" />
                  </Link>
                </li>
              )}

              <li>
                <Link
                  to={isAgentOnly ? "/agente" : "/historial"}
                  className={cn(
                    "flex items-center justify-center transition-all duration-200 active:scale-95",
                    (isAgentOnly
                      ? pathname.startsWith("/agente")
                      : pathname.startsWith("/historial") || pathname.startsWith("/transferencia"))
                      ? "size-11 rounded-full bg-[#DCFCE7] text-[#15803D] shadow-sm border-2 border-emerald-500/70 scale-105"
                      : "size-10 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-[#15803D] hover:bg-emerald-50",
                  )}
                  aria-label={isAgentOnly ? "Panel y Operaciones del Agente" : t("nav.history")}
                >
                  {isAgentOnly ? <Briefcase className="size-5" /> : <History className="size-5" />}
                </Link>
              </li>

              <li>
                <Link
                  to="/perfil"
                  className={cn(
                    "flex items-center justify-center transition-all duration-200 active:scale-95",
                    pathname.startsWith("/perfil")
                      ? "size-11 rounded-full bg-[#DCFCE7] text-[#15803D] shadow-sm border-2 border-emerald-500/70 scale-105"
                      : "size-10 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-[#15803D] hover:bg-emerald-50",
                  )}
                  aria-label={t("nav.profile")}
                >
                  <User className="size-5" />
                </Link>
              </li>
            </ul>
          </div>
        </nav>
      </div>
    </div>
  );
}
