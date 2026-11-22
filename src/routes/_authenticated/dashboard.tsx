import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  History,
  Send,
  ShieldAlert,
  Smartphone,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useCountries, useRate } from "@/hooks/useCorridors";
import { useWallets } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { SocialLinks } from "@/components/SocialLinks";
import { shortDate } from "@/lib/remesa";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import logoAsset from "@/assets/tchotcho-logo.png";
import iconAsset from "@/assets/tchotcho-icon.png";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tcho-Tcho" },
      {
        name: "description",
        content: "Panel de control simple para enviar dinero y recargas a Haití.",
      },
    ],
  }),
  component: Dashboard,
});

export function Dashboard() {
  const { profile, user, isAdmin, isAgent, loading: profileLoading } = useProfile();
  const router = useRouter();
  const { t } = useI18n();
  const { data: countries } = useCountries();
  const [hideBalance, setHideBalance] = useState(false);

  // Si el usuario es un agente operativo, redirigir a su panel central de agente
  useEffect(() => {
    if (!profileLoading && isAgent && !isAdmin) {
      router.navigate({ to: "/agente", replace: true });
    }
  }, [profileLoading, isAgent, isAdmin, router]);

  const origins = (countries ?? []).filter((c) => c.is_origin);
  const destinations = (countries ?? []).filter((c) => c.is_destination && c.code !== "DO");
  const sendCur = origins[0]?.currency ?? "USD";
  const recvCur = destinations[0]?.currency ?? "HTG";

  const { data: rate } = useRate(sendCur, recvCur);

  const { data: transfers } = useQuery({
    queryKey: ["my-transfers", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("transfers")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(6);
      return data ?? [];
    },
  });

  const { data: wallets } = useWallets();

  // Billetera 100% en HTG (Gourdes Haitianas) real
  const walletHtg = (wallets ?? []).reduce(
    (sum, w) => sum + (w.currency === "HTG" ? Number(w.balance) : 0),
    0,
  );

  const totalHtg = walletHtg;

  const formattedBalance = isAdmin
    ? "Ilimitado (Admin)"
    : `HTG ${totalHtg.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayName = profile?.full_name?.split(" ")[0] || "Usuario";

  // Transacciones 100% reales en HTG
  const displayTransfers = (transfers ?? []).map((tx) => ({
    id: tx.id,
    recipient: tx.recipient_name || "Destinatario en Haití",
    service:
      tx.delivery_method?.toLowerCase() === "moncash"
        ? "MonCash Haití"
        : tx.delivery_method?.toLowerCase() === "natcash"
          ? "NatCash Haití"
          : "Remesa Haití",
    date: shortDate(tx.created_at),
    amount: `${tx.receive_currency || "HTG"} ${Number(tx.amount_receive || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    status:
      tx.status === "completed"
        ? "Completado"
        : tx.status === "cancelled"
          ? "Cancelado"
          : "En proceso",
    statusColor:
      tx.status === "completed"
        ? "text-emerald-700 bg-emerald-50 border-emerald-200"
        : tx.status === "cancelled"
          ? "text-rose-700 bg-rose-50 border-rose-200"
          : "text-amber-700 bg-amber-50 border-amber-200",
    viewLink: `/transferencia/${tx.id}`,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24 md:pb-12 text-slate-900 selection:bg-[#DCFCE7] selection:text-[#15803D]">
      {/* Alerta KYC para clientes: paso obligatorio antes de operar */}
      {profile && !isAdmin && profile.kyc_status !== "approved" && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-amber-50 border border-amber-200 p-4 shadow-xs">
          <div className="flex items-start sm:items-center gap-3 min-w-0">
            <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-800 shadow-xs mt-0.5 sm:mt-0">
              <ShieldAlert className="size-5" />
            </div>
            <div className="min-w-0 text-xs space-y-0.5">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-black text-amber-950 text-sm">
                  {profile.kyc_status === "pending"
                    ? "Verificación KYC en revisión"
                    : profile.kyc_status === "rejected"
                      ? "Verificación KYC rechazada"
                      : "Paso obligatorio: Verifica tu identidad (KYC)"}
                </p>
                <span className="inline-block rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Requerido
                </span>
              </div>
              <p className="text-amber-900/80">
                {profile.kyc_status === "pending"
                  ? "Tus documentos están siendo revisados por nuestro equipo. Te avisaremos en cuanto se aprueben."
                  : profile.kyc_status === "rejected"
                    ? "Tu documentación anterior fue rechazada. Por favor sube una identificación válida para operar."
                    : "Por seguridad, las cuentas de clientes deben completar la verificación de identidad antes de poder realizar envíos o recargas."}
              </p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            className="h-9 px-4 shrink-0 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs shadow-xs"
          >
            <Link to="/perfil">
              {profile.kyc_status === "pending" ? "Ver estado" : "Verificar ahora"}
            </Link>
          </Button>
        </div>
      )}

      {/* SALUDO Y SALDO PRINCIPAL */}
      <div className="rounded-[28px] bg-white border border-slate-200 p-6 sm:p-8 space-y-6 shadow-sm relative overflow-hidden">
        {/* Fila superior: Logo Oficial Tcho-Tcho bien destacado y Saludo */}
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-xl bg-[#F8FAF9] px-3.5 py-2 shadow-xs border border-slate-200/80 hover:scale-105 transition-all">
              <img src={iconAsset} alt="Tcho-Tcho" className="size-8 object-contain shrink-0" />
              <img src={logoAsset} alt="Tcho-Tcho" className="h-6 w-auto object-contain shrink-0" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-[#15803D] uppercase tracking-wider flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-[#15803D] animate-pulse" />
                {t("dash.official_banking")}
              </p>
              <h1 className="text-lg sm:text-xl font-black text-slate-900">
                {t("dash.hello")}, {displayName} 👋
              </h1>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-3.5 py-1.5 text-xs font-bold text-[#15803D] shadow-xs">
            <span>{isAdmin ? "👑 Administrador (Sin límite de saldo)" : `🇭🇹 ${t("dash.htg_wallet")}`}</span>
          </div>
        </div>

        {/* Saldo Central Grande 100% en HTG */}
        <div className="space-y-1 relative z-10">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
            {isAdmin ? "Saldo Operativo Administrador" : t("dash.available_balance_htg")}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-[#15803D]">
              {hideBalance ? "••••••••" : formattedBalance}
            </span>
            <button
              type="button"
              onClick={() => setHideBalance(!hideBalance)}
              className="text-slate-400 hover:text-slate-700 transition p-1"
              aria-label="Alternar visibilidad del saldo"
            >
              {hideBalance ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            </button>
          </div>
        </div>

        {/* 4 BOTONES DE ACCIÓN DIRECTA */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 relative z-10">
          <Link
            to="/enviar"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#15803D] hover:bg-[#166534] border border-emerald-600 p-4 text-white shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-white/20 text-white group-hover:scale-110 transition">
              <Send className="size-5" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-white">{t("dash.send_money")}</p>
              <p className="text-[10px] text-emerald-100">{t("dash.send_money_sub")}</p>
            </div>
          </Link>

          <Link
            to="/recargas"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#F8FAF9] border border-slate-200 p-4 text-slate-800 hover:border-emerald-500/40 hover:bg-emerald-50/40 shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-[#15803D] group-hover:scale-110 transition">
              <Smartphone className="size-5" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-900">{t("dash.topups_haiti")}</p>
              <p className="text-[10px] text-slate-500">{t("dash.topups_sub")}</p>
            </div>
          </Link>

          <Link
            to="/historial"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#F8FAF9] border border-slate-200 p-4 text-slate-800 hover:border-emerald-500/40 hover:bg-emerald-50/40 shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-[#15803D] group-hover:scale-110 transition">
              <History className="size-5" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-900">{t("dash.history_title")}</p>
              <p className="text-[10px] text-slate-500">{t("dash.history_sub")}</p>
            </div>
          </Link>

          <Link
            to="/perfil"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#F8FAF9] border border-slate-200 p-4 text-slate-800 hover:border-emerald-500/40 hover:bg-emerald-50/40 shadow-xs hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-[#15803D] group-hover:scale-110 transition">
              <User className="size-5" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-slate-900">{t("dash.account_title")}</p>
              <p className="text-[10px] text-slate-500">{t("dash.account_sub")}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* ÚLTIMAS TRANSACCIONES */}
      <div className="rounded-[28px] bg-white border border-slate-200 p-6 space-y-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-black text-base text-slate-900">
              {t("dash.recent_activity")}
            </h2>
            <p className="text-xs text-slate-500">{t("dash.recent_activity_sub")}</p>
          </div>

          <Link
            to="/historial"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#15803D] hover:underline"
          >
            <span>{t("dash.see_all")}</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* Lista de transferencias */}
        {displayTransfers.length > 0 ? (
          <div className="divide-y divide-slate-100">
            {displayTransfers.map((tx) => (
              <Link
                key={tx.id}
                to={tx.viewLink}
                className="flex items-center justify-between py-3.5 hover:bg-slate-50 px-2 rounded-xl transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-[#15803D] border border-emerald-100 group-hover:scale-105 transition">
                    <Send className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-slate-900 truncate group-hover:text-[#15803D] transition">
                      {tx.recipient}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate">
                      {tx.service} • {tx.date}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-black text-slate-900 font-mono">{tx.amount}</p>
                  <span
                    className={cn(
                      "inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border",
                      tx.statusColor,
                    )}
                  >
                    {tx.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center space-y-3 rounded-2xl bg-slate-50 border border-dashed border-slate-200 p-6">
            <div className="grid size-12 mx-auto place-items-center rounded-2xl bg-emerald-50 text-[#15803D] border border-emerald-200">
              <History className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">{t("dash.no_activity")}</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">{t("dash.no_activity_sub")}</p>
            </div>
            <Button
              asChild
              size="sm"
              className="rounded-xl bg-[#15803D] text-white hover:bg-[#166534] font-bold"
            >
              <Link to="/enviar">{t("dash.send_money")}</Link>
            </Button>
          </div>
        )}
      </div>

      {/* Comunidad y Redes Sociales */}
      <div className="rounded-2xl bg-white border border-slate-200 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
        <div className="space-y-0.5">
          <p className="text-[11px] font-black text-[#15803D] uppercase tracking-wider">
            Comunidad Tcho-Tcho
          </p>
          <p className="text-sm font-extrabold text-slate-900">
            Conéctate con nuestras redes oficiales
          </p>
          <p className="text-xs text-slate-500">
            Atención al cliente, tutoriales y avisos en tiempo real
          </p>
        </div>
        <SocialLinks showLabels className="justify-start sm:justify-end gap-2" />
      </div>
    </div>
  );
}
