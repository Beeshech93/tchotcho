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
    { to: "/historial", label: t("shell.transactions"), icon: History },
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
    <div className="min-h-screen bg-black text-slate-100 md:flex selection:bg-[#02531C] selection:text-[#F2AC00]">
      {/* Desktop Sidebar matching SaaS Dashboard mockup - ajustado para que todo quepa en una sola pantalla */}
      <aside className="hidden w-64 shrink-0 flex-col justify-between bg-gradient-to-b from-[#101612] via-[#0C110E] to-[#080B09] border-r border-white/10 p-3 text-slate-200 md:sticky md:top-0 md:flex md:h-screen md:overflow-y-auto custom-scrollbar select-none">
        <div className="flex flex-col gap-2">
          {/* Organization Switcher Header con Logo Tcho-Tcho bien destacado */}
          <div className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border border-white shadow-[0_0_20px_rgba(242,172,0,0.25)]">
            <Link to="/dashboard" className="flex min-w-0 items-center gap-2">
              <img src={iconAsset} alt="Tcho-Tcho" className="size-7 object-contain shrink-0" />
              <img src={logoAsset} alt="Tcho-Tcho" className="h-5 w-auto object-contain shrink-0" />
            </Link>
            <NotificationBell triggerClassName="text-slate-800 hover:text-black hover:bg-slate-100 size-7" />
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
                      ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_12px_rgba(2,83,28,0.4)] border border-[#F2AC00]/40"
                      : "text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent",
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
          <div className="pt-1">
            <p className="px-3 pb-1 text-[10px] font-black uppercase tracking-wider text-emerald-400">
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
                        ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_12px_rgba(2,83,28,0.4)] border border-[#F2AC00]/40"
                        : "text-slate-300 hover:bg-white/[0.06] hover:text-white border border-transparent",
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

          {/* Mini-Badge compacto de envíos directos a Haití */}
          <Link
            to="/enviar"
            className="rounded-xl bg-gradient-to-r from-[#18241C] to-[#0F1611] border border-emerald-500/25 p-2.5 text-center shadow-md hover:border-[#F2AC00]/50 transition group block"
          >
            <p className="text-[11px] font-black text-[#F2AC00] flex items-center justify-center gap-1">
              <span>MonCash & NatCash Flash</span>
              <ArrowRight className="size-3 group-hover:translate-x-0.5 transition" />
            </p>
            <p className="text-[9px] text-slate-300">Acreditación directa en &lt; 2 minutos</p>
          </Link>

          {/* Redes Oficiales compactas */}
          <div className="rounded-xl bg-white/[0.02] border border-white/5 px-2.5 py-1.5 flex items-center justify-between gap-1.5">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">
              Redes
            </span>
            <SocialLinks iconSize="size-3.5" className="justify-end gap-1.5" />
          </div>
        </div>

        {/* Sidebar Footer compacto */}
        <div className="shrink-0 space-y-1.5 border-t border-white/10 pt-2.5 mt-2">
          <LanguageSwitcher className="w-full h-8 bg-[#161F18] text-slate-200 border-white/10 text-xs font-semibold py-1" />
          <div className="px-1 py-0.5">
            <div className="flex items-center justify-between gap-1.5">
              <p className="truncate text-xs font-extrabold text-white">
                {profile?.full_name || t("nav.account")}
              </p>
              {isAdmin && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.2 text-[9px] font-black text-amber-300 shrink-0">
                  <Shield className="size-2.5" /> Super Admin
                </span>
              )}
            </div>
            <p className="truncate text-[10px] font-semibold text-emerald-400">
              {profile?.phone || "Super Administrador"}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full h-7 justify-start gap-2 text-xs font-bold text-rose-400 hover:bg-rose-500/15 hover:text-rose-300 py-1"
            onClick={signOut}
          >
            <LogOut className="size-3.5" /> {t("nav.signout")}
          </Button>
          {isCustomBrand && (
            <div className="pt-1 text-center border-t border-white/10">
              <a
                href="https://tchotcho.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1 text-[9px] text-slate-400 transition hover:text-slate-200"
              >
                <span>Creado por</span>
                <span className="font-bold text-[#F2AC00] underline underline-offset-2">
                  tchotcho.app
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

          <footer className="mt-14 border-t border-white/10 pt-6 pb-2 text-center space-y-2.5">
            <p className="text-xs font-semibold text-slate-400">
              Canales oficiales y redes sociales
            </p>
            <SocialLinks iconSize="size-4" className="justify-center gap-2" />
            <p className="text-[11px] text-slate-500">
              © {new Date().getFullYear()} Tcho-Tcho · {t("landing.footer")}
            </p>
          </footer>
        </main>

        {/* Mobile Navigation Dock - Fijo al fondo con colores destacados y soporte para safe-area */}
        <nav
          className="fixed bottom-3 inset-x-3 z-50 mx-auto max-w-sm rounded-[32px] bg-gradient-to-r from-[#08120B]/98 via-[#0D1C12]/98 to-[#08120B]/98 backdrop-blur-2xl border-2 border-emerald-500/70 p-2 shadow-[0_12px_40px_rgba(0,0,0,0.95),0_0_25px_rgba(2,83,28,0.4)] md:hidden pointer-events-auto select-none"
          style={{ bottom: "max(0.75rem, env(safe-area-inset-bottom, 0px))" }}
          aria-label="Navegación móvil"
        >
          <ul className="flex items-center justify-around gap-1">
            <li>
              <Link
                to="/dashboard"
                className={cn(
                  "flex items-center justify-center transition-all duration-200 active:scale-95",
                  pathname === "/dashboard"
                    ? "size-11 rounded-full bg-gradient-to-br from-[#02531C] via-[#046824] to-[#013813] text-[#F2AC00] shadow-[0_0_18px_rgba(242,172,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.3)] border-2 border-[#F2AC00] scale-105"
                    : "size-10 rounded-full bg-white/[0.06] border border-white/12 text-white hover:border-emerald-400/50 hover:text-[#F2AC00] hover:bg-emerald-950/40",
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
                      ? "size-11 rounded-full bg-gradient-to-br from-[#02531C] via-[#046824] to-[#013813] text-[#F2AC00] shadow-[0_0_18px_rgba(242,172,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.3)] border-2 border-[#F2AC00] scale-105"
                      : "size-10 rounded-full bg-white/[0.06] border border-white/12 text-white hover:border-emerald-400/50 hover:text-[#F2AC00] hover:bg-emerald-950/40",
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
                      ? "size-11 rounded-full bg-gradient-to-br from-[#02531C] via-[#046824] to-[#013813] text-[#F2AC00] shadow-[0_0_18px_rgba(242,172,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.3)] border-2 border-[#F2AC00] scale-105"
                      : "size-10 rounded-full bg-gradient-to-br from-amber-500/15 to-emerald-500/15 border border-[#F2AC00]/40 text-[#F2AC00] hover:bg-amber-500/25 shadow-[0_0_10px_rgba(242,172,0,0.2)]",
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
                  "flex items-center justify-center transition-all duration-200 active:scale-95",
                  pathname.startsWith("/historial") || pathname.startsWith("/transferencia")
                    ? "size-11 rounded-full bg-gradient-to-br from-[#02531C] via-[#046824] to-[#013813] text-[#F2AC00] shadow-[0_0_18px_rgba(242,172,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.3)] border-2 border-[#F2AC00] scale-105"
                    : "size-10 rounded-full bg-white/[0.06] border border-white/12 text-white hover:border-emerald-400/50 hover:text-[#F2AC00] hover:bg-emerald-950/40",
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
                  "flex items-center justify-center transition-all duration-200 active:scale-95",
                  pathname.startsWith("/perfil")
                    ? "size-11 rounded-full bg-gradient-to-br from-[#02531C] via-[#046824] to-[#013813] text-[#F2AC00] shadow-[0_0_18px_rgba(242,172,0,0.65),inset_0_1px_1px_rgba(255,255,255,0.3)] border-2 border-[#F2AC00] scale-105"
                    : "size-10 rounded-full bg-white/[0.06] border border-white/12 text-white hover:border-emerald-400/50 hover:text-[#F2AC00] hover:bg-emerald-950/40",
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
