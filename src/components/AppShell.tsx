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
    { to: "/dashboard", label: t("shell.dashboard"), icon: Home },
    ...(transfersEnabled ? [{ to: "/enviar", label: t("shell.send_money"), icon: Send }] : []),
    ...(topupsEnabled ? [{ to: "/recargas", label: t("shell.topups"), icon: Smartphone }] : []),
    { to: isAgent ? "/agente" : "/historial", label: isAgent ? "Operaciones / Agente" : t("shell.transactions"), icon: isAgent ? Briefcase : History },
    { to: "/perfil", label: t("shell.my_account"), icon: User },
  ];

  const workflowNav = [
    { to: "/soporte", label: t("shell.help_center"), icon: LifeBuoy },
    ...(isAdmin ? [{ to: "/admin", label: t("shell.admin_panel"), icon: Shield }] : []),
    ...(isAgent ? [{ to: "/agente", label: t("shell.agent_portal"), icon: Briefcase }] : []),
  ];

  const signOut = async () => {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth", replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F4F7F5] text-slate-900 md:flex selection:bg-[#DCFCE7] selection:text-[#15803D]">
      {/* Desktop Sidebar matching SaaS Dashboard mockup - ajustado con paleta limpia y profesional */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-white border-r border-slate-200 p-3 text-slate-800 md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto custom-scrollbar select-none shadow-xs">
        <div className="flex flex-col gap-2">
          {/* Organization Switcher Header con Logo Tcho-Tcho bien destacado */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-slate-200/80 shadow-xs">
            <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
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
                    "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-all",
                    isActive
                      ? "bg-[#DCFCE7] text-[#15803D] border border-emerald-300/40 shadow-xs"
                      : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent font-medium",
                  )}
                >
                  <item.icon
                    className={cn(
                      "size-4 shrink-0",
                      isActive ? "text-[#15803D]" : "text-slate-500",
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
              Más Opciones
            </p>
            <nav className="flex flex-col gap-1">
              {workflowNav.map((item) => {
                const isActive = pathname === item.to;
                return (
                  <Link
                    key={item.label}
                    to={item.to}
                    className={cn(
                      "flex items-center gap-2.5 rounded-xl px-3 py-2 text-xs font-bold transition-all",
                      isActive
                        ? "bg-[#DCFCE7] text-[#15803D] border border-emerald-300/40 shadow-xs"
                        : "text-slate-600 hover:bg-slate-100/80 hover:text-slate-900 border border-transparent font-medium",
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-4 shrink-0",
                        isActive ? "text-[#15803D]" : "text-slate-500",
                      )}
                    />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Mini-Badge compacto de envíos directos a Haití */}
          <Link
            to="/enviar"
            className="rounded-xl bg-[#F8FAF9] border border-slate-200 p-2.5 text-center shadow-xs hover:border-emerald-500/40 transition group block"
          >
            <p className="text-[11px] font-black text-[#15803D] flex items-center justify-center gap-1">
              <span>MonCash & NatCash Flash</span>
              <ArrowRight className="size-3 group-hover:translate-x-0.5 transition" />
            </p>
            <p className="text-[9px] text-slate-500">Acreditación directa en &lt; 2 minutos</p>
          </Link>

          {/* Redes Oficiales compactas */}
          <div className="rounded-xl bg-[#F8FAF9] border border-slate-200 px-2.5 py-1.5 flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
              Redes
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
              {profile?.phone || "Super Administrador"}
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
                <span>Creado por</span>
                <span className="font-bold text-[#15803D] underline underline-offset-2">
                  tchotcho.app
                </span>
              </a>
            </div>
          )}
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        {/* Mobile Header - Fijo al tope en versión móvil */}
        <header className="fixed top-0 inset-x-0 z-40 flex items-center justify-between gap-2 border-b border-slate-200 bg-white/95 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] backdrop-blur-xl md:hidden shadow-xs">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white px-2.5 py-1 shadow-xs border border-slate-200">
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
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <Link to="/soporte">
                <LifeBuoy className="size-4" />
              </Link>
            </Button>
            <NotificationBell triggerClassName="text-slate-600 hover:text-slate-900 hover:bg-slate-100" />
            <LanguageSwitcher className="h-9 w-[80px] text-xs bg-slate-100 border-slate-200 text-slate-800" />
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label={t("nav.signout")}
              className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
            >
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <main
          className="flex-1 px-4 pt-[calc(4.75rem+env(safe-area-inset-top,0px))] pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:px-8 md:pt-5 md:pb-10"
        >
          <AdBanner className="mb-5" />
          {children}

          <footer className="mt-14 border-t border-slate-200 pt-6 pb-2 text-center space-y-2.5">
            <p className="text-xs font-semibold text-slate-500">
              Canales oficiales y redes sociales
            </p>
            <SocialLinks iconSize="size-4" className="justify-center gap-2" />
            <p className="text-[11px] text-slate-400">
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

              {topupsEnabled && (
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

              {transfersEnabled && (
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
                  to={isAgent ? "/agente" : "/historial"}
                  className={cn(
                    "flex items-center justify-center transition-all duration-200 active:scale-95",
                    (isAgent
                      ? pathname.startsWith("/agente")
                      : pathname.startsWith("/historial") || pathname.startsWith("/transferencia"))
                      ? "size-11 rounded-full bg-[#DCFCE7] text-[#15803D] shadow-sm border-2 border-emerald-500/70 scale-105"
                      : "size-10 rounded-full bg-slate-100 border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-[#15803D] hover:bg-emerald-50",
                  )}
                  aria-label={isAgent ? "Panel y Operaciones del Agente" : t("nav.history")}
                >
                  {isAgent ? <Briefcase className="size-5" /> : <History className="size-5" />}
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
