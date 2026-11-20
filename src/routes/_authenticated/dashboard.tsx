import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  History,
  Plus,
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
  const { profile, user, isAdmin } = useProfile();
  const { t } = useI18n();
  const { data: countries } = useCountries();
  const [hideBalance, setHideBalance] = useState(false);

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
  const totalHtg = (wallets ?? []).reduce(
    (sum, w) => sum + (w.currency === "HTG" ? Number(w.balance) : 0),
    0,
  );

  const formattedBalance = `HTG ${totalHtg.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayName = profile?.full_name?.split(" ")[0] || "Usuario";

  // Beneficiarios directos para envío en 1 clic
  const quickContacts = [
    {
      name: "Jean Baptiste",
      phone: "+509 3712-4589",
      wallet: "MonCash",
      color: "bg-red-500/20 text-red-400 border-red-500/40",
    },
    {
      name: "Marie Claire",
      phone: "+509 4823-9012",
      wallet: "NatCash",
      color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/40",
    },
    {
      name: "Emmanuel Joseph",
      phone: "+509 3144-5566",
      wallet: "MonCash",
      color: "bg-red-500/20 text-red-400 border-red-500/40",
    },
  ];

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
        ? "text-emerald-400 bg-emerald-500/15 border-emerald-500/30"
        : "text-amber-400 bg-amber-500/15 border-amber-500/30",
    viewLink: `/transferencia/${tx.id}`,
  }));

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-24 md:pb-12 text-white selection:bg-[#02531C] selection:text-[#F2AC00]">
      {/* Alerta KYC solo si está pendiente y no es admin */}
      {profile && !isAdmin && profile.kyc_status !== "approved" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#111713] border border-[#F2AC00]/40 p-4 shadow-lg">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F2AC00]/15 text-[#F2AC00]">
              <ShieldAlert className="size-5" />
            </div>
            <div className="min-w-0 text-xs">
              <p className="font-bold text-white text-sm">
                {profile.kyc_status === "pending"
                  ? t("dash.kyc_pending_title")
                  : t("dash.kyc_none_title")}
              </p>
              <p className="text-slate-300 truncate">
                {t("dash.kyc_unlock")}
              </p>
            </div>
          </div>
          <Button
            asChild
            size="sm"
            className="h-8 px-3 rounded-xl bg-[#F2AC00] text-black font-extrabold text-xs hover:bg-[#FBBF24]"
          >
            <Link to="/perfil">{t("dash.verify")}</Link>
          </Button>
        </div>
      )}

      {/* SALUDO Y SALDO PRINCIPAL */}
      <div className="rounded-[32px] bg-gradient-to-b from-[#131B15] to-[#0A0E0C] border border-white/12 p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 size-72 rounded-full bg-[#02531C]/30 blur-3xl pointer-events-none" />

        {/* Fila superior: Logo Oficial Tcho-Tcho bien destacado y Saludo */}
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-2xl bg-white px-3.5 py-2 shadow-[0_0_24px_rgba(242,172,0,0.35),0_4px_16px_rgba(0,0,0,0.3)] border-2 border-white hover:scale-105 transition-all">
              <img src={iconAsset} alt="Tcho-Tcho" className="size-8 object-contain shrink-0" />
              <img src={logoAsset} alt="Tcho-Tcho" className="h-6 w-auto object-contain shrink-0" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
                {t("dash.official_banking")}
              </p>
              <h1 className="text-lg sm:text-xl font-black text-white">{t("dash.hello")}, {displayName} 👋</h1>
            </div>
          </div>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-[#02531C] border border-[#F2AC00]/40 px-3.5 py-1.5 text-xs font-black text-[#F2AC00] shadow-sm">
            <span>🇭🇹 {t("dash.htg_wallet")}</span>
          </div>
        </div>

        {/* Saldo Central Grande 100% en HTG */}
        <div className="space-y-1 relative z-10">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            {t("dash.available_balance_htg")}
          </p>
          <div className="flex items-center gap-3">
            <span className="text-4xl sm:text-5xl font-black tracking-tight text-white">
              {hideBalance ? "••••••••" : formattedBalance}
            </span>
            <button
              type="button"
              onClick={() => setHideBalance(!hideBalance)}
              className="text-[#F2AC00] hover:text-white transition p-1"
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
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#02531C] to-[#046824] border-2 border-[#F2AC00] p-4 text-white shadow-[0_0_20px_rgba(242,172,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-black/40 text-[#F2AC00] group-hover:scale-110 transition">
              <Send className="size-5" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-white">{t("dash.send_money")}</p>
              <p className="text-[10px] text-emerald-200">{t("dash.send_money_sub")}</p>
            </div>
          </Link>

          <Link
            to="/recargas"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#18231C] to-[#0F1712] border border-emerald-500/30 p-4 text-white hover:border-[#F2AC00] hover:bg-[#1E2C23] shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/30 group-hover:scale-110 transition">
              <Smartphone className="size-5" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-white">{t("dash.topups_haiti")}</p>
              <p className="text-[10px] text-slate-300">{t("dash.topups_sub")}</p>
            </div>
          </Link>

          <Link
            to="/historial"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#18231C] to-[#0F1712] border border-emerald-500/30 p-4 text-white hover:border-[#F2AC00] hover:bg-[#1E2C23] shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/30 group-hover:scale-110 transition">
              <History className="size-5" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-white">{t("dash.history_title")}</p>
              <p className="text-[10px] text-slate-300">{t("dash.history_sub")}</p>
            </div>
          </Link>

          <Link
            to="/perfil"
            className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-gradient-to-b from-[#18231C] to-[#0F1712] border border-emerald-500/30 p-4 text-white hover:border-[#F2AC00] hover:bg-[#1E2C23] shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all group"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/30 group-hover:scale-110 transition">
              <User className="size-5" />
            </div>
            <div className="text-center">
              <p className="text-sm font-black text-white">{t("dash.account_title")}</p>
              <p className="text-[10px] text-slate-300">{t("dash.account_sub")}</p>
            </div>
          </Link>
        </div>
      </div>

      {/* BENEFICIARIOS RÁPIDOS EN HAITÍ */}
      <div className="rounded-[28px] bg-gradient-to-b from-[#131B15] to-[#0A0E0C] border border-white/12 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-black text-base text-white">Beneficiarios en Haití</h2>
            <p className="text-xs text-slate-300">Envío directo en 1 clic</p>
          </div>
          <Link
            to="/enviar"
            className="inline-flex items-center gap-1 text-xs font-bold text-[#F2AC00] hover:underline"
          >
            <Plus className="size-3.5" />
            <span>Nuevo envío</span>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {quickContacts.map((contact) => (
            <Link
              key={contact.name}
              to="/enviar"
              className="flex items-center justify-between rounded-2xl bg-black/40 border border-white/10 p-3.5 hover:border-[#F2AC00]/60 hover:bg-[#02531C]/30 transition group"
            >
              <div className="flex items-center gap-3">
                <div className="grid size-9 place-items-center rounded-xl bg-[#02531C] text-[#F2AC00] font-black text-xs border border-[#F2AC00]/40">
                  {contact.name.charAt(0)}
                </div>
                <div>
                  <p className="text-xs font-bold text-white group-hover:text-[#F2AC00] transition">
                    {contact.name}
                  </p>
                  <p className="text-[11px] font-mono text-slate-400">{contact.phone}</p>
                </div>
              </div>

              <span
                className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  contact.color,
                )}
              >
                {contact.wallet}
              </span>
            </Link>
          ))}
        </div>
      </div>

      {/* ÚLTIMAS TRANSACCIONES */}
      <div className="rounded-[28px] bg-gradient-to-b from-[#131B15] to-[#0A0E0C] border border-white/12 p-6 space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display font-black text-base text-white">{t("dash.recent_activity")}</h2>
            <p className="text-xs text-slate-300">{t("dash.recent_activity_sub")}</p>
          </div>

          <Link
            to="/historial"
            className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F2AC00] hover:underline"
          >
            <span>{t("dash.see_all")}</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {/* Lista de transferencias */}
        {displayTransfers.length > 0 ? (
          <div className="divide-y divide-white/10">
            {displayTransfers.map((tx) => (
              <Link
                key={tx.id}
                to={tx.viewLink}
                className="flex items-center justify-between py-3.5 hover:bg-[#02531C]/20 px-2 rounded-xl transition group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/30 shadow-sm group-hover:scale-105 transition">
                    <Send className="size-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-extrabold text-white truncate group-hover:text-[#F2AC00] transition">
                      {tx.recipient}
                    </p>
                    <p className="text-[11px] text-slate-300 truncate">
                      {tx.service} • {tx.date}
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 space-y-1">
                  <p className="text-sm font-black text-white font-mono">{tx.amount}</p>
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
          <div className="py-8 text-center space-y-3 rounded-2xl bg-black/30 border border-dashed border-white/10 p-6">
            <div className="grid size-12 mx-auto place-items-center rounded-2xl bg-[#02531C]/30 text-[#F2AC00] border border-[#F2AC00]/30">
              <History className="size-6" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-white">{t("dash.no_activity")}</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                {t("dash.no_activity_sub")}
              </p>
            </div>
            <Button
              asChild
              size="sm"
              className="rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/40 font-bold hover:bg-[#036B25]"
            >
              <Link to="/enviar">{t("dash.send_money")}</Link>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
