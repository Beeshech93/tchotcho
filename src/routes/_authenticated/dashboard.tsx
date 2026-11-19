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
    <span className="font-black italic text-lg tracking-wider text-white select-none">
      VISA
    </span>
  );
}

function ChipIcon() {
  return (
    <div className="size-8 rounded-lg bg-gradient-to-br from-amber-200 via-amber-400 to-amber-600 p-0.5 shadow-sm">
      <div className="h-full w-full rounded border border-amber-800/40 bg-amber-400/90 grid grid-cols-2 gap-0.5 p-0.5">
        <div className="border-r border-b border-amber-900/30" />
        <div className="border-b border-amber-900/30" />
        <div className="border-r border-amber-900/30" />
        <div />
      </div>
    </div>
  );
}

function ContactlessIcon() {
  return (
    <svg className="size-5 text-white/80 rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M8.5 16.5a5 5 0 0 1 0-9" strokeLinecap="round" />
      <path d="M12 19a8.5 8.5 0 0 1 0-14" strokeLinecap="round" />
      <path d="M15.5 21.5a12 12 0 0 1 0-19" strokeLinecap="round" />
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

      {/* Hero Virtual Card — Fiel réplica de Behance Finflow */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#02531C] via-[#056B27] to-[#043314] p-6 text-white shadow-2xl border border-[#F2AC00]/30 shadow-[#02531C]/35">
        {/* Curvas sutiles de fondo */}
        <div className="pointer-events-none absolute -right-12 -top-12 size-48 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 size-40 rounded-full bg-[#200847] blur-xl opacity-60" />

        {/* Fila superior: Chip + Contactless + Visa */}
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ChipIcon />
            <ContactlessIcon />
          </div>
          <VisaLogo />
        </div>

        {/* Fila de balances */}
        <div className="relative mt-6 space-y-1">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-medium text-white/70">Total Balance</p>
            <button
              onClick={() => setHideBalance((v) => !v)}
              className="text-white/70 hover:text-white transition-colors"
              title={hideBalance ? "Mostrar saldo" : "Ocultar saldo"}
            >
              {hideBalance ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
            </button>
          </div>
          <p className="text-3xl font-extrabold tracking-tight text-white">
            {hideBalance
              ? "••••••••"
              : totalHtg > 0
                ? money(totalHtg, "HTG")
                : totalUsd > 0
                  ? `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                  : "$12,458.90"}
          </p>
          <p className="text-xs text-white/60">
            Available Balance:{" "}
            <span className="font-semibold text-white/90">
              {hideBalance ? "••••••" : "$8,458.90"}
            </span>
          </p>
        </div>

        {/* Fila inferior: Número de tarjeta + Nombre + Expiración */}
        <div className="relative mt-6 flex items-end justify-between text-xs text-white/80">
          <div>
            <p className="font-mono text-xs tracking-wider">•••• •••• •••• 4568</p>
            <p className="mt-1 font-semibold text-white uppercase text-[11px] tracking-wide">
              {profile?.full_name || "TCHO-TCHO MEMBER"}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-white/60">Expires</p>
            <p className="font-semibold text-white">12/26</p>
          </div>
        </div>
      </div>

      {/* Frequently Used — Cuadrícula 2x2 estilo Behance Finflow */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Frequently Used
          </h3>
          <Link to="/enviar" className="text-xs text-[#C4B5FD] hover:underline">
            See All &gt;
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {/* Top Up */}
          <Link
            to="/recargas"
            className="group flex items-center gap-3 rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 hover:border-[#02531C] transition-all active:scale-[0.98]"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-[#F2AC00] group-hover:bg-[#02531C] group-hover:text-white transition-colors">
              <Plus className="size-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Top Up</p>
              <p className="text-[10px] text-slate-400">Recargar saldo</p>
            </div>
          </Link>

          {/* Transfer */}
          <Link
            to="/enviar"
            className="group flex items-center gap-3 rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 hover:border-[#02531C] transition-all active:scale-[0.98]"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-[#F2AC00] group-hover:bg-[#02531C] group-hover:text-white transition-colors">
              <Repeat className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Transfer</p>
              <p className="text-[10px] text-slate-400">P2P & Cuentas</p>
            </div>
          </Link>

          {/* Send */}
          <Link
            to="/enviar"
            className="group flex items-center gap-3 rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 hover:border-[#02531C] transition-all active:scale-[0.98]"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-[#F2AC00] group-hover:bg-[#02531C] group-hover:text-white transition-colors">
              <Send className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Send</p>
              <p className="text-[10px] text-slate-400">A Haití & RD</p>
            </div>
          </Link>

          {/* Analytics / Cripto */}
          <Link
            to="/cripto"
            className="group flex items-center gap-3 rounded-2xl bg-[#112417]/90 border border-white/10 p-3.5 hover:border-[#02531C] transition-all active:scale-[0.98]"
          >
            <div className="grid size-10 place-items-center rounded-xl bg-white/[0.06] text-[#F2AC00] group-hover:bg-[#02531C] group-hover:text-white transition-colors">
              <Coins className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">Analytics</p>
              <p className="text-[10px] text-slate-400">Cripto & Balance</p>
            </div>
          </Link>
        </div>
      </div>

      {/* Quick Access: Statement & Savings Goals Widget (Módulo 1486849451) */}
      <div className="rounded-3xl bg-[#112417]/90 border border-white/10 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-xl bg-[#02531C]/40 text-[#F2AC00]">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-xs font-bold text-white">Budget Goals</p>
              <p className="text-[10px] text-slate-400">Ahorros y Metas Inteligentes</p>
            </div>
          </div>
          <span className="text-[11px] font-bold text-[#F2AC00]">48%</span>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-[#0C1A10] p-3 border border-white/5">
          <div>
            <p className="text-[10px] text-slate-400">Total saved</p>
            <p className="text-sm font-bold text-white">$2,450 <span className="text-xs font-normal text-slate-400">of $55,000</span></p>
          </div>
          {/* Anillo de progreso SVG */}
          <div className="relative size-10 grid place-items-center">
            <svg className="size-10 -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-white/10"
                strokeWidth="3.5"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-[#F2AC00]"
                strokeDasharray="48, 100"
                strokeWidth="3.5"
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <span className="absolute text-[9px] font-bold text-white">48%</span>
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
