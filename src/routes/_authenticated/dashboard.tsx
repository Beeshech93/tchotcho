import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  Bell,
  Coins,
  CreditCard,
  Eye,
  EyeOff,
  Filter,
  Plus,
  QrCode,
  Repeat,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  TrendingUp,
  FileText,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useCountries, useRate, useTopupRate } from "@/hooks/useCorridors";
import { useWallets } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { money, shortDate, STATUS_LABEL, STATUS_TONE } from "@/lib/remesa";
import { useI18n } from "@/lib/i18n";
import { useServicesConfig } from "@/hooks/useServicesConfig";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Inicio — Tcho-Tcho Digital Banking" },
      { name: "description", content: "Resumen de tu billetera inteligente, tarjetas y transferencias." },
    ],
  }),
  component: Dashboard,
});

function VisaLogo() {
  return (
    <span className="font-black italic text-xl tracking-wider text-white select-none">
      VISA
    </span>
  );
}

function FinflowWingsLogo() {
  return (
    <svg className="h-6 w-9 text-white/90 drop-shadow-sm select-none" viewBox="0 0 36 24" fill="none">
      <path d="M2 4 L16 4 L12 9 L2 9 Z" fill="currentColor" />
      <path d="M20 4 L34 4 L34 9 L24 9 Z" fill="currentColor" />
      <path d="M5 11 L16 11 L13 16 L5 16 Z" fill="currentColor" opacity="0.85" />
      <path d="M20 11 L31 11 L31 16 L23 16 Z" fill="currentColor" opacity="0.85" />
      <path d="M9 18 L16 18 L14 22 L9 22 Z" fill="currentColor" opacity="0.7" />
      <path d="M20 18 L27 18 L27 22 L22 22 Z" fill="currentColor" opacity="0.7" />
    </svg>
  );
}

function Dashboard() {
  const { profile, user } = useProfile();
  const { t } = useI18n();
  const { data: countries } = useCountries();
  const [activeCategory, setActiveCategory] = useState<"card" | "bank" | "mobile">("card");
  const [hideBalance, setHideBalance] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { isEnabled } = useServicesConfig();
  const transfersEnabled = isEnabled("transfers");
  const topupsEnabled = isEnabled("topups");
  const cryptoEnabled = isEnabled("crypto");

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

  const totalHtg = (wallets ?? []).reduce(
    (sum, w) => sum + (w.currency === "HTG" ? Number(w.balance) : 0),
    0,
  );
  const totalUsd = (wallets ?? []).reduce(
    (sum, w) => sum + (w.currency === "USD" ? Number(w.balance) : 0),
    0,
  );

  const displayName = profile?.full_name?.split(" ")[0] || "User";

  return (
    <div className="mx-auto max-w-lg space-y-5 px-4 pt-2 pb-24 md:pb-8 text-white">
      {/* Alerta de Verificación KYC si no está aprobado */}
      {profile && profile.kyc_status !== "approved" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-amber-500/10 border border-amber-500/20 p-3.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldAlert className="size-5 shrink-0 text-amber-400" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-amber-300">
                {profile.kyc_status === "pending"
                  ? "Verificación en revisión"
                  : "Verifica tu identidad"}
              </p>
              <p className="text-slate-400 truncate">
                Desbloquea límites más altos de transferencia.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="h-8 rounded-full bg-amber-500 text-black font-semibold text-xs hover:bg-amber-400">
            <Link to="/perfil">Verificar</Link>
          </Button>
        </div>
      )}

      {/* Top Bar estilo Behance Finflow: Avatar + Welcome Back + Notification + Scanner */}
      <header className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3">
          <div className="relative grid size-11 place-items-center rounded-full bg-gradient-to-br from-[#02531C] to-[#10B981] p-0.5 shadow-md shadow-[#02531C]/40">
            <div className="grid size-full place-items-center rounded-full bg-[#0C1A10] text-[#F2AC00] font-bold text-sm">
              {displayName.slice(0, 1).toUpperCase()}
            </div>
          </div>
          <div>
            <p className="text-[11px] font-medium text-slate-400">Welcome Back</p>
            <h2 className="text-sm font-bold text-white tracking-tight">Hi, {displayName}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="grid size-9 place-items-center rounded-full bg-[#112417] border border-white/10 text-slate-300 hover:text-[#F2AC00] transition-colors"
            title="Scan QR"
          >
            <QrCode className="size-4" />
          </button>
          <button
            type="button"
            className="relative grid size-9 place-items-center rounded-full bg-[#112417] border border-white/10 text-slate-300 hover:text-[#F2AC00] transition-colors"
            title="Notifications"
          >
            <Bell className="size-4" />
            <span className="absolute top-2 right-2 size-2 rounded-full bg-[#F2AC00] ring-2 ring-[#112417]" />
          </button>
        </div>
      </header>

      {/* Barra de búsqueda con icono de filtro */}
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-4 size-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search here..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 w-full rounded-2xl bg-[#112417]/90 border border-white/10 pl-11 pr-11 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#02531C]"
        />
        <button
          type="button"
          className="absolute right-3 grid size-7 place-items-center rounded-xl bg-white/[0.06] text-slate-300 hover:text-white"
        >
          <Filter className="size-3.5" />
        </button>
      </div>

      {/* Segment Selector Tabs: Card | Bank | Mobile Banking */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-2">
        <button
          onClick={() => setActiveCategory("card")}
          className={cn(
            "relative pb-1 text-xs font-semibold transition-colors",
            activeCategory === "card" ? "text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <span>Card</span>
          {activeCategory === "card" && (
            <span className="absolute -bottom-2 inset-x-0 h-0.5 rounded-full bg-[#F2AC00]" />
          )}
        </button>

        <button
          onClick={() => setActiveCategory("bank")}
          className={cn(
            "relative pb-1 text-xs font-semibold transition-colors ml-4",
            activeCategory === "bank" ? "text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <span>Bank</span>
          {activeCategory === "bank" && (
            <span className="absolute -bottom-2 inset-x-0 h-0.5 rounded-full bg-[#F2AC00]" />
          )}
        </button>

        <button
          onClick={() => setActiveCategory("mobile")}
          className={cn(
            "relative pb-1 text-xs font-semibold transition-colors ml-4",
            activeCategory === "mobile" ? "text-white" : "text-slate-400 hover:text-slate-200"
          )}
        >
          <span>Mobile Banking</span>
          {activeCategory === "mobile" && (
            <span className="absolute -bottom-2 inset-x-0 h-0.5 rounded-full bg-[#F2AC00]" />
          )}
        </button>
      </div>

      {/* Hero Virtual Card — Fiel réplica de Behance Finflow (Módulo 1486849441) */}
      <div className="relative overflow-hidden rounded-[28px] bg-gradient-to-br from-[#02531C] via-[#056824] to-[#042810] p-6 text-white shadow-2xl border border-[#F2AC00]/30 shadow-[#02531C]/35">
        {/* Sutil resplandor de fondo */}
        <div className="pointer-events-none absolute -left-10 -top-10 size-48 rounded-full bg-white/10 blur-2xl" />

        {/* 3D Glass Layer Overlays idénticos al diseño de Behance */}
        <div className="pointer-events-none absolute -right-6 -bottom-10 size-44 rounded-3xl bg-white/[0.08] backdrop-blur-sm border border-white/15 rotate-[22deg]" />
        <div className="pointer-events-none absolute -right-2 -bottom-6 size-44 rounded-3xl bg-white/[0.09] backdrop-blur-md border border-white/20 rotate-[12deg]" />

        {/* Fila superior: Total Balance + Finflow Wings Logo */}
        <div className="relative z-10 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-xs font-medium text-white/70">Total Balance</p>
              <button
                onClick={() => setHideBalance((v) => !v)}
                className="text-white/60 hover:text-white transition-colors"
                title={hideBalance ? "Mostrar saldo" : "Ocultar saldo"}
              >
                {hideBalance ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
              </button>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mt-1">
              {hideBalance
                ? "••••••••"
                : totalHtg > 0
                  ? money(totalHtg, "HTG")
                  : totalUsd > 0
                    ? `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                    : "$12,458.90"}
            </p>
          </div>

          <FinflowWingsLogo />
        </div>

        {/* Fila inferior: Available Balance + VISA Logo */}
        <div className="relative z-10 mt-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium text-white/70">Available Balance</p>
            <p className="text-base font-semibold text-white/95 mt-0.5">
              {hideBalance ? "••••••" : "$8,458.90"}
            </p>
          </div>

          <VisaLogo />
        </div>
      </div>

      {/* Frequently Used — Cuadrícula 2x2 exacta de Behance */}
      <div>
        <h3 className="text-sm font-semibold text-white mb-3">
          Frequently Used
        </h3>

        <div className="grid grid-cols-2 gap-3">
          {/* Top Up */}
          <Link
            to="/recargas"
            className="group flex items-center gap-3 rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 hover:border-[#02531C] transition-all active:scale-[0.98]"
          >
            <div className="grid size-9 place-items-center rounded-xl bg-white/[0.06] text-[#F2AC00] group-hover:bg-[#02531C] group-hover:text-white transition-colors">
              <Plus className="size-4" />
            </div>
            <span className="text-xs font-semibold text-white">Top Up</span>
          </Link>

          {/* Transfer */}
          <Link
            to="/enviar"
            className="group flex items-center gap-3 rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 hover:border-[#02531C] transition-all active:scale-[0.98]"
          >
            <div className="grid size-9 place-items-center rounded-xl bg-white/[0.06] text-[#F2AC00] group-hover:bg-[#02531C] group-hover:text-white transition-colors">
              <Repeat className="size-4" />
            </div>
            <span className="text-xs font-semibold text-white">Transfer</span>
          </Link>

          {/* Send */}
          <Link
            to="/enviar"
            className="group flex items-center gap-3 rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 hover:border-[#02531C] transition-all active:scale-[0.98]"
          >
            <div className="grid size-9 place-items-center rounded-xl bg-white/[0.06] text-[#F2AC00] group-hover:bg-[#02531C] group-hover:text-white transition-colors">
              <Send className="size-4" />
            </div>
            <span className="text-xs font-semibold text-white">Send</span>
          </Link>

          {/* Analytics */}
          <Link
            to="/cripto"
            className="group flex items-center gap-3 rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 hover:border-[#02531C] transition-all active:scale-[0.98]"
          >
            <div className="grid size-9 place-items-center rounded-xl bg-white/[0.06] text-[#F2AC00] group-hover:bg-[#02531C] group-hover:text-white transition-colors">
              <TrendingUp className="size-4" />
            </div>
            <span className="text-xs font-semibold text-white">Analytics</span>
          </Link>
        </div>
      </div>

      {/* Quick Access — Con Statement & Metas */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Quick Access</h3>
          <Link to="/historial" className="text-xs text-slate-400 hover:text-[#F2AC00] flex items-center gap-0.5">
            <span>See All</span>
            <ChevronRight className="size-3.5" />
          </Link>
        </div>

        {/* Statement Row */}
        <Link
          to="/historial"
          className="group flex items-center justify-between rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 hover:border-[#02531C] transition-all active:scale-[0.98]"
        >
          <div className="flex items-center gap-3">
            <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-[#F2AC00] group-hover:bg-[#02531C] group-hover:text-white transition-colors">
              <FileText className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Statement</p>
              <p className="text-[10px] text-slate-400">View your account statement</p>
            </div>
          </div>
          <ChevronRight className="size-4 text-slate-400 group-hover:text-white transition-colors" />
        </Link>

        {/* Budget Goals Widget */}
        <div className="rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="grid size-7 place-items-center rounded-lg bg-[#02531C]/40 text-[#F2AC00]">
                <Sparkles className="size-3.5" />
              </span>
              <p className="text-xs font-bold text-white">Budget Goals</p>
            </div>
            <span className="text-[11px] font-bold text-[#F2AC00]">48%</span>
          </div>

          <div className="flex items-center justify-between rounded-xl bg-[#0C1A10] p-2.5 border border-white/5">
            <div>
              <p className="text-[10px] text-slate-400">Total saved</p>
              <p className="text-xs font-bold text-white">$2,450 <span className="font-normal text-slate-400">of $55,000</span></p>
            </div>
            <div className="relative size-8 grid place-items-center">
              <svg className="size-8 -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-white/10"
                  strokeWidth="4"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#F2AC00]"
                  strokeDasharray="48, 100"
                  strokeWidth="4"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <span className="absolute text-[8px] font-bold text-white">48%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tipo de Cambio en Vivo */}
      {rate && (
        <div className="flex items-center justify-between rounded-2xl bg-[#112417]/80 border border-white/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-emerald-400" />
            <span className="text-xs text-slate-300">Tipo de cambio hoy</span>
          </div>
          <span className="text-xs font-bold text-white">
            1 USD = {rate.rate.toFixed(2)} HTG (MonCash/NatCash)
          </span>
        </div>
      )}

      {/* Recent Transactions — Lista de transacciones con badges limpios */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Recent Transactions
          </h3>
          <Link to="/historial" className="text-xs text-[#C4B5FD] hover:underline">
            See All &gt;
          </Link>
        </div>

        <div className="space-y-2">
          {transfers && transfers.length > 0 ? (
            transfers.map((tx: any) => {
              const isReceived = tx.destination_account === profile?.phone;
              return (
                <Link
                  key={tx.id}
                  to={`/transferencia/${tx.id}` as any}
                  className="flex items-center justify-between rounded-2xl bg-[#161228]/90 border border-white/10 p-3 hover:border-white/20 transition-all"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "grid size-10 place-items-center rounded-xl text-xs font-bold",
                        isReceived
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-[#02531C]/30 text-[#F2AC00]"
                      )}
                    >
                      {isReceived ? (
                        <ArrowDownLeft className="size-4" />
                      ) : (
                        <ArrowUpRight className="size-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-white truncate">
                        {tx.recipient_name || tx.wallet_type || "Transferencia"}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {shortDate(tx.created_at)} · {tx.destination_method || "MonCash"}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p
                      className={cn(
                        "text-xs font-bold",
                        isReceived ? "text-emerald-400" : "text-white"
                      )}
                    >
                      {isReceived ? "+" : "-"}
                      {money(Number(tx.amount_received || tx.amount_sent), tx.destination_currency || "HTG")}
                    </p>
                    <span className="text-[9px] text-slate-400">
                      {tx.status || "Completado"}
                    </span>
                  </div>
                </Link>
              );
            })
          ) : (
            // Items de ejemplo cuando no hay transacciones aún
            <>
              <div className="flex items-center justify-between rounded-2xl bg-[#112417]/90 border border-white/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-[#02531C]/30 text-[#F2AC00]">
                    <CreditCard className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">Amazon.com</p>
                    <p className="text-[10px] text-slate-400">Yesterday, 08:15 PM</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-white">-$23.40</p>
                  <p className="text-[9px] text-slate-400">Friday</p>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-2xl bg-[#112417]/90 border border-white/10 p-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-400">
                    <ArrowDownLeft className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-white">MonCash Payout</p>
                    <p className="text-[10px] text-slate-400">Today, 10:30 AM</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-emerald-400">+$1,250.00</p>
                  <p className="text-[9px] text-slate-400">Completado</p>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
