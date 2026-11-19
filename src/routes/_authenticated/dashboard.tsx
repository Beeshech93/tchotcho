import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowUp,
  ArrowDown,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Coins,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  FileText,
  Filter,
  Layers,
  MoreHorizontal,
  Plus,
  QrCode,
  Receipt,
  Repeat,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  TrendingUp,
  User,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useCountries, useRate } from "@/hooks/useCorridors";
import { useWallets } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money, shortDate, STATUS_LABEL } from "@/lib/remesa";
import { useI18n } from "@/lib/i18n";
import { useServicesConfig } from "@/hooks/useServicesConfig";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tcho-Tcho Digital Banking" },
      { name: "description", content: "Panel de control financiero inteligente, cuentas, analíticas y transferencias." },
    ],
  }),
  component: Dashboard,
});

export function Dashboard() {
  const { profile, user } = useProfile();
  const { t } = useI18n();
  const { data: countries } = useCountries();
  const [hideBalance, setHideBalance] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [txFilter, setTxFilter] = useState<"recent" | "my" | "in" | "out">("recent");
  const [activeChartMonth, setActiveChartMonth] = useState("AUG");

  const { isEnabled } = useServicesConfig();
  const transfersEnabled = isEnabled("transfers");

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
        .limit(8);
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

  const displayName = profile?.full_name?.split(" ")[0] || "Ali";

  const todayFormatted = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  const months = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-24 md:pb-8 text-white">
      {/* Alerta KYC si aplica */}
      {profile && profile.kyc_status !== "approved" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#141414] border border-[#F2AC00]/30 p-3.5 shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldAlert className="size-5 shrink-0 text-[#F2AC00]" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-white">
                {profile.kyc_status === "pending"
                  ? "Verificación en revisión"
                  : "Verifica tu identidad en Tcho-Tcho"}
              </p>
              <p className="text-slate-400 truncate">
                Desbloquea transferencias ilimitadas y tarjetas virtuales Visa.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="h-8 rounded-full bg-[#F2AC00] text-black font-semibold text-xs hover:bg-[#E09E00]">
            <Link to="/perfil">Verificar</Link>
          </Button>
        </div>
      )}

      {/* TOP HEADER: Fecha, Saludo y Barra de Acciones Fiel a la Imagen */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-5">
        <div>
          <p className="text-xs font-medium text-slate-400">{todayFormatted}</p>
          <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-white mt-0.5">
            Welcome Back, {displayName} !
          </h1>
        </div>

        {/* Action Buttons Row */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Send (Primary Button) */}
          <Link
            to="/enviar"
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#02531C] to-[#046824] border border-[#F2AC00]/40 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-[#02531C]/30 hover:scale-105 active:scale-95 transition-all"
          >
            <Send className="size-3.5 text-[#F2AC00]" />
            <span>Send</span>
          </Link>

          {/* Request */}
          <Link
            to="/enviar"
            className="flex items-center gap-2 rounded-xl bg-[#121212] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <ArrowDownLeft className="size-3.5 text-[#F2AC00]" />
            <span>Request</span>
          </Link>

          {/* Transfer */}
          <Link
            to="/enviar"
            className="flex items-center gap-2 rounded-xl bg-[#121212] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <Repeat className="size-3.5 text-[#10B981]" />
            <span>Transfer</span>
          </Link>

          {/* Deposit */}
          <Link
            to="/recargas"
            className="flex items-center gap-1.5 rounded-xl bg-[#121212] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <Plus className="size-3.5 text-[#F2AC00]" />
            <span>Deposit</span>
          </Link>

          {/* Pay Bill */}
          <Link
            to="/recargas"
            className="hidden sm:flex items-center gap-2 rounded-xl bg-[#121212] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <Receipt className="size-3.5 text-slate-400" />
            <span>Pay Bill</span>
          </Link>

          {/* Create Invoice */}
          <button
            type="button"
            onClick={() => window.print()}
            className="hidden sm:flex items-center gap-2 rounded-xl bg-[#121212] border border-white/10 px-3.5 py-2 text-xs font-medium text-slate-200 hover:text-white hover:bg-white/[0.08] transition-all"
          >
            <FileText className="size-3.5 text-slate-400" />
            <span>Create Invoice</span>
          </button>

          {/* Search Box + Icons */}
          <div className="flex items-center gap-2 ml-auto lg:ml-2">
            <div className="relative hidden xl:block">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search... ⌘K"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-44 rounded-xl bg-[#121212] border border-white/10 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#02531C]"
              />
            </div>

            <button
              type="button"
              className="grid size-9 place-items-center rounded-xl bg-[#121212] border border-white/10 text-slate-300 hover:text-white transition-colors"
              title="Notificaciones"
            >
              <Bell className="size-4" />
            </button>

            <Link
              to="/perfil"
              className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-[#02531C] to-[#10B981] p-0.5 text-xs font-bold text-[#F2AC00]"
            >
              <div className="grid size-full place-items-center rounded-[10px] bg-[#0A0A0A]">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            </Link>
          </div>
        </div>
      </header>

      {/* ROW 1: OVERVIEW CARD (CON WAVE CHART & TOOLTIP) + ACCOUNTS LIST */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Overview Card (8 cols) */}
        <div className="lg:col-span-8 rounded-3xl bg-[#0E0E0E] border border-white/10 p-5 sm:p-6 shadow-2xl relative overflow-hidden space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">Overview</h2>
            <button className="text-slate-400 hover:text-white p-1 rounded-lg">
              <MoreHorizontal className="size-4" />
            </button>
          </div>

          {/* Balance & Stats Row */}
          <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-400">Total Balance</span>
                <button
                  onClick={() => setHideBalance((v) => !v)}
                  className="text-slate-400 hover:text-white transition-colors"
                >
                  {hideBalance ? <Eye className="size-3.5" /> : <EyeOff className="size-3.5" />}
                </button>
              </div>
              <p className="font-display text-3xl sm:text-4xl font-extrabold tracking-tight text-white mt-1">
                {hideBalance
                  ? "••••••••"
                  : totalHtg > 0
                    ? money(totalHtg, "HTG")
                    : totalUsd > 0
                      ? `$${totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                      : "$32,940.093"}
              </p>
            </div>

            {/* Badges de tendencia idénticos a la imagen */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 font-semibold text-emerald-400">
                <ArrowUpRight className="size-4" />
                <span>+$3,546.02</span>
              </span>
              <span className="flex items-center gap-1 font-semibold text-rose-400">
                <ArrowDownLeft className="size-4" />
                <span>-$567.60</span>
              </span>
            </div>
          </div>

          {/* AI Insight Box */}
          <div className="flex items-start gap-2.5 rounded-2xl bg-white/[0.03] border border-white/5 p-3 text-xs text-slate-400">
            <Sparkles className="size-4 text-[#F2AC00] shrink-0 mt-0.5" />
            <p className="leading-relaxed">
              With August growth reaching <strong className="text-white">+5.8%</strong>, performance trends remain strong.
              AI recommends increasing allocation to high-demand corridors like MonCash & NatCash.
            </p>
          </div>

          {/* WAVE SPLINE MULTI-LINE CHART Fiel a la Imagen */}
          <div className="relative pt-4">
            {/* Active Tooltip Pop-up sobre el mes seleccionado (AUG 2026) */}
            <div className="absolute top-2 left-[58%] -translate-x-1/2 rounded-2xl bg-[#181818] border border-white/15 p-3 shadow-2xl z-20 space-y-1.5 w-44 pointer-events-none">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-300">
                <Calendar className="size-3 text-[#F2AC00]" />
                <span>Aug 2026</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="size-2 rounded-full bg-[#10B981]" />
                  <span>Income</span>
                </span>
                <span className="font-bold text-white">$135,320</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-slate-400">
                  <span className="size-2 rounded-full bg-[#F2AC00]" />
                  <span>Expense</span>
                </span>
                <span className="font-bold text-white">$85,211</span>
              </div>
            </div>

            {/* SVG Curvas Spline Fluidas */}
            <div className="w-full h-44 sm:h-52">
              <svg className="w-full h-full" viewBox="0 0 1000 240" fill="none" preserveAspectRatio="none">
                {/* Líneas horizontales de referencia */}
                <line x1="0" y1="40" x2="1000" y2="40" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                <line x1="0" y1="100" x2="1000" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                <line x1="0" y1="160" x2="1000" y2="160" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />
                <line x1="0" y1="220" x2="1000" y2="220" stroke="rgba(255,255,255,0.05)" strokeDasharray="4 4" />

                {/* Línea vertical activa en Agosto */}
                <line x1="636" y1="10" x2="636" y2="220" stroke="#F2AC00" strokeWidth="1.5" strokeDasharray="3 3" opacity="0.6" />

                {/* Curva 1: Ingresos (Verde Esmeralda #10B981) */}
                <path
                  d="M 0 160 C 80 140, 160 110, 250 120 C 340 130, 420 80, 500 70 C 580 60, 640 110, 720 85 C 800 60, 900 130, 1000 95"
                  stroke="#10B981"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="636" cy="110" r="5" fill="#10B981" stroke="#000000" strokeWidth="2" />

                {/* Curva 2: Gastos (Oro Cálido #F2AC00) */}
                <path
                  d="M 0 180 C 80 170, 160 140, 250 145 C 340 150, 420 120, 500 130 C 580 140, 640 155, 720 135 C 800 115, 900 190, 1000 180"
                  stroke="#F2AC00"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                />
                <circle cx="636" cy="155" r="5" fill="#F2AC00" stroke="#000000" strokeWidth="2" />
              </svg>
            </div>

            {/* Eje de Meses (JAN ... DEC) */}
            <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-semibold text-slate-400 pt-2 border-t border-white/5">
              {months.map((m) => (
                <button
                  key={m}
                  onClick={() => setActiveChartMonth(m)}
                  className={cn(
                    "transition-colors px-1 py-0.5 rounded",
                    activeChartMonth === m
                      ? "text-[#F2AC00] font-bold"
                      : "hover:text-white"
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Accounts Card (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-[#0E0E0E] border border-white/10 p-5 sm:p-6 shadow-2xl flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">Accounts</h2>
            <button className="text-slate-400 hover:text-white p-1 rounded-lg">
              <MoreHorizontal className="size-4" />
            </button>
          </div>

          {/* Cards List */}
          <div className="space-y-3">
            {/* Card 1: Purple Gradient */}
            <div className="flex items-center justify-between rounded-2xl bg-[#141414] border border-white/5 p-3 hover:border-white/15 transition-all">
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 rounded-xl bg-gradient-to-tr from-[#6938F8] to-[#9333EA] p-1.5 flex flex-col justify-between text-white shadow-md">
                  <span className="font-bold text-[8px]">VISA</span>
                  <span className="text-[7px] font-mono tracking-tighter">•••• 9213</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">•••• •••• •••• 9213</p>
                  <p className="text-[10px] text-slate-400">06/28 · Virtual</p>
                </div>
              </div>
              <p className="text-xs font-bold text-white">$202,234.00</p>
            </div>

            {/* Card 2: Emerald Gradient (Tcho-Tcho Primary) */}
            <div className="flex items-center justify-between rounded-2xl bg-[#141414] border border-white/5 p-3 hover:border-white/15 transition-all">
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 rounded-xl bg-gradient-to-tr from-[#02531C] to-[#10B981] p-1.5 flex flex-col justify-between text-white shadow-md">
                  <span className="font-bold text-[8px] text-[#F2AC00]">VISA</span>
                  <span className="text-[7px] font-mono tracking-tighter">•••• 4568</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">•••• •••• •••• 4568</p>
                  <p className="text-[10px] text-slate-400">12/26 · Principal</p>
                </div>
              </div>
              <p className="text-xs font-bold text-white">$54,456.00</p>
            </div>

            {/* Card 3: Amber/Gold Gradient */}
            <div className="flex items-center justify-between rounded-2xl bg-[#141414] border border-white/5 p-3 hover:border-white/15 transition-all">
              <div className="flex items-center gap-3">
                <div className="h-10 w-14 rounded-xl bg-gradient-to-tr from-[#F2AC00] to-[#F59E0B] p-1.5 flex flex-col justify-between text-black shadow-md">
                  <span className="font-bold text-[8px]">VISA</span>
                  <span className="text-[7px] font-mono tracking-tighter font-semibold">•••• 1084</span>
                </div>
                <div>
                  <p className="text-xs font-semibold text-white">•••• •••• •••• 1084</p>
                  <p className="text-[10px] text-slate-400">09/27 · Ahorros</p>
                </div>
              </div>
              <p className="text-xs font-bold text-white">$3,765.00</p>
            </div>
          </div>

          {/* Create Account Button */}
          <Link
            to="/enviar"
            className="flex items-center justify-center gap-2 rounded-2xl border border-dashed border-white/20 bg-white/[0.03] py-2.5 text-xs font-semibold text-slate-200 hover:text-white hover:border-[#F2AC00] transition-colors"
          >
            <Plus className="size-3.5 text-[#F2AC00]" />
            <span>Create account</span>
          </Link>
        </div>
      </div>

      {/* ROW 2: MONEY MOVEMENT (IN/OUT COMPARATIVE) + INVOICE CARD */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Money Movement (8 cols) */}
        <div className="lg:col-span-8 rounded-3xl bg-[#0E0E0E] border border-white/10 p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">Money movement</h2>
            <div className="flex items-center gap-1.5 rounded-xl bg-[#141414] border border-white/10 px-3 py-1 text-xs text-slate-300">
              <Calendar className="size-3.5 text-[#F2AC00]" />
              <span>Aug 2026</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Box 1: Money In */}
            <div className="rounded-2xl bg-[#141414] border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Money in</span>
                <button className="size-6 rounded-lg bg-white/[0.06] grid place-items-center text-slate-300 hover:text-white">
                  <Plus className="size-3" />
                </button>
              </div>

              <p className="font-display text-2xl font-bold tracking-tight text-white">
                $40,829.92
              </p>

              {/* Segmented Progress Bar */}
              <div className="flex h-3 w-full gap-1 rounded-full overflow-hidden bg-white/5">
                <div className="h-full bg-[#10B981] rounded-l-full" style={{ width: "74%" }} />
                <div className="h-full bg-[#02531C]" style={{ width: "16%" }} />
                <div className="h-full bg-slate-700 rounded-r-full" style={{ width: "10%" }} />
              </div>

              <p className="text-[11px] text-slate-400">
                The biggest income this month is from <strong className="text-white">salary 74.4%</strong>
              </p>
            </div>

            {/* Box 2: Money Out */}
            <div className="rounded-2xl bg-[#141414] border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">Money Out</span>
                <button className="size-6 rounded-lg bg-white/[0.06] grid place-items-center text-slate-300 hover:text-white">
                  <Plus className="size-3" />
                </button>
              </div>

              <p className="font-display text-2xl font-bold tracking-tight text-white">
                $7,802.62
              </p>

              {/* Segmented Progress Bar */}
              <div className="flex h-3 w-full gap-1 rounded-full overflow-hidden bg-white/5">
                <div className="h-full bg-rose-500 rounded-l-full" style={{ width: "56%" }} />
                <div className="h-full bg-[#F2AC00]" style={{ width: "28%" }} />
                <div className="h-full bg-slate-700 rounded-r-full" style={{ width: "16%" }} />
              </div>

              <p className="text-[11px] text-slate-400">
                The biggest expend this month is from <strong className="text-white">shopping 56.4%</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Right: Invoice Card (4 cols) */}
        <div className="lg:col-span-4 rounded-3xl bg-[#0E0E0E] border border-white/10 p-5 sm:p-6 shadow-2xl space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-white tracking-tight">Invoice</h2>
            <button className="text-slate-400 hover:text-white p-1 rounded-lg">
              <MoreHorizontal className="size-4" />
            </button>
          </div>

          {/* Payment Score */}
          <div className="rounded-2xl bg-[#141414] border border-white/5 p-3 flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400">Payment Score</p>
              <div className="flex items-center gap-1 mt-1">
                {[...Array(12)].map((_, i) => (
                  <span
                    key={i}
                    className={cn(
                      "w-1 rounded-full",
                      i < 9 ? "bg-[#10B981] h-3.5" : "bg-white/10 h-2"
                    )}
                  />
                ))}
              </div>
            </div>
            <span className="font-display text-xl font-extrabold text-[#F2AC00]">80</span>
          </div>

          {/* Recent Invoices List */}
          <div className="space-y-2.5 text-xs">
            <div className="flex items-center justify-between rounded-xl bg-[#141414] p-2.5">
              <div>
                <p className="font-semibold text-white">Noah Williams</p>
                <p className="text-[10px] text-slate-400">Jun 8 · in 1 week</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-white">$160.00</p>
                <span className="text-[10px] text-emerald-400 font-semibold">• Paid</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-[#141414] p-2.5">
              <div>
                <p className="font-semibold text-white">Ava Thompson</p>
                <p className="text-[10px] text-slate-400">Jun 10 · in 1 week</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-white">$160.00</p>
                <span className="text-[10px] text-rose-400 font-semibold">• Unpaid</span>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-[#141414] p-2.5">
              <div>
                <p className="font-semibold text-white">Alex Johnson</p>
                <p className="text-[10px] text-slate-400">Jun 12</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-white">$160.00</p>
                <span className="text-[10px] text-[#F2AC00] font-semibold">• Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 3: TRANSACTIONS TABLE CON PESTAÑAS SEGMENTADAS */}
      <div className="rounded-3xl bg-[#0E0E0E] border border-white/10 p-5 sm:p-6 shadow-2xl space-y-4">
        {/* Table Header & Segmented Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-base font-bold text-white tracking-tight">Transactions</h2>

          <div className="flex items-center gap-1 rounded-2xl bg-[#141414] border border-white/10 p-1 text-xs">
            <button
              onClick={() => setTxFilter("recent")}
              className={cn(
                "rounded-xl px-3 py-1.5 font-semibold transition-all",
                txFilter === "recent"
                  ? "bg-[#02531C] text-[#F2AC00] shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Recent
            </button>
            <button
              onClick={() => setTxFilter("my")}
              className={cn(
                "rounded-xl px-3 py-1.5 font-semibold transition-all",
                txFilter === "my"
                  ? "bg-[#02531C] text-[#F2AC00] shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              My transactions
            </button>
            <button
              onClick={() => setTxFilter("in")}
              className={cn(
                "hidden sm:inline-block rounded-xl px-3 py-1.5 font-semibold transition-all",
                txFilter === "in"
                  ? "bg-[#02531C] text-[#F2AC00] shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Monthly money in
            </button>
            <button
              onClick={() => setTxFilter("out")}
              className={cn(
                "hidden sm:inline-block rounded-xl px-3 py-1.5 font-semibold transition-all",
                txFilter === "out"
                  ? "bg-[#02531C] text-[#F2AC00] shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              Monthly money out
            </button>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-[11px]">
                <th className="pb-3 font-semibold">Due date</th>
                <th className="pb-3 font-semibold">To/From</th>
                <th className="pb-3 font-semibold">Status</th>
                <th className="pb-3 font-semibold">Amount</th>
                <th className="pb-3 font-semibold">Account</th>
                <th className="pb-3 font-semibold text-right">Method</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {transfers && transfers.length > 0 ? (
                transfers.map((tx: any) => {
                  const isReceived = tx.destination_account === profile?.phone;
                  return (
                    <tr key={tx.id} className="hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 text-slate-300 font-mono text-[11px]">
                        {shortDate(tx.created_at)}
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-7 place-items-center rounded-lg bg-white/[0.06] text-[#F2AC00]">
                            {isReceived ? <ArrowDownLeft className="size-3.5 text-emerald-400" /> : <Send className="size-3.5" />}
                          </div>
                          <span className="font-semibold text-white">
                            {tx.recipient_name || "Transferencia Tcho-Tcho"}
                          </span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="size-2.5" />
                          <span>{STATUS_LABEL[tx.status as keyof typeof STATUS_LABEL] ?? "Completed"}</span>
                        </span>
                      </td>
                      <td className="py-3 font-bold text-white">
                        {isReceived ? "+" : "-"}
                        {money(Number(tx.amount_send || tx.amount_received), tx.send_currency || "USD")}
                      </td>
                      <td className="py-3 text-slate-400 font-mono">
                        Checking ...4568
                      </td>
                      <td className="py-3 text-right text-slate-300 font-medium">
                        {tx.destination_method || "MonCash P2P"}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <>
                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 text-slate-300 font-mono text-[11px]">Oct 12, 2026</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-7 place-items-center rounded-lg bg-blue-500/15 text-blue-400 font-bold text-[10px]">
                          G
                        </div>
                        <span className="font-semibold text-white">Google Workspace</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="size-2.5" />
                        <span>Completed</span>
                      </span>
                    </td>
                    <td className="py-3 font-bold text-white">-$120.00</td>
                    <td className="py-3 text-slate-400 font-mono">Checking ...4568</td>
                    <td className="py-3 text-right text-slate-300 font-medium">Debit Card</td>
                  </tr>

                  <tr className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3 text-slate-300 font-mono text-[11px]">Oct 11, 2026</td>
                    <td className="py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="grid size-7 place-items-center rounded-lg bg-[#02531C]/30 text-[#F2AC00] font-bold text-[10px]">
                          T
                        </div>
                        <span className="font-semibold text-white">Tcho-Tcho MonCash Transfer</span>
                      </div>
                    </td>
                    <td className="py-3">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/20">
                        <CheckCircle2 className="size-2.5" />
                        <span>Completed</span>
                      </span>
                    </td>
                    <td className="py-3 font-bold text-emerald-400">+$2,450.00</td>
                    <td className="py-3 text-slate-400 font-mono">Checking ...4568</td>
                    <td className="py-3 text-right text-slate-300 font-medium">MonCash / P2P</td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
