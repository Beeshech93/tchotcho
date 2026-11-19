import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownLeft,
  ArrowRightLeft,
  Bell,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Coins,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  Filter,
  Info,
  Layers,
  ListFilter,
  MoreVertical,
  Plus,
  QrCode,
  Repeat,
  Search,
  Send,
  ShieldAlert,
  Smartphone,
  Sparkles,
  TrendingDown,
  TrendingUp,
  User,
  Wallet,
  Wifi,
  XCircle,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useCountries, useRate } from "@/hooks/useCorridors";
import { useWallets } from "@/hooks/useWallet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money, shortDate } from "@/lib/remesa";
import { useI18n } from "@/lib/i18n";
import { useServicesConfig } from "@/hooks/useServicesConfig";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tcho-Tcho Digital Banking" },
      { name: "description", content: "Panel de control financiero inteligente inspirado en Payx con los colores vibrantes de Tcho-Tcho." },
    ],
  }),
  component: Dashboard,
});

export function Dashboard() {
  const { profile, user } = useProfile();
  const { t } = useI18n();
  const { data: countries } = useCountries();
  const [currencyView, setCurrencyView] = useState<"USD" | "HTG">("USD");
  const [hideBalance, setHideBalance] = useState(false);
  const [timeframe, setTimeframe] = useState<"24h" | "week" | "month">("month");
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  const { isEnabled } = useServicesConfig();
  const transfersEnabled = isEnabled("transfers");
  const topupsEnabled = isEnabled("topups");

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
        .limit(10);
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

  const primaryBalance = currencyView === "USD" ? (totalUsd > 0 ? totalUsd : 23094.57) : (totalHtg > 0 ? totalHtg : 3250000.0);
  const formattedBalance = currencyView === "USD"
    ? `$ ${primaryBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `HTG ${primaryBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayName = profile?.full_name?.split(" ")[0] || "Michael";
  const userEmail = profile?.email || "michael@tcho-tcho.com";

  // Tarjetas virtuales y físicas con colores vivos, relieve y abanico 3D
  const cardsList = [
    {
      id: "card-1",
      title: "Business Account",
      type: "Corporate",
      masked: "•••• •••• •••• 1234",
      accountMasked: "•••••••••••• USD",
      expiry: "06/28",
      balance: "$ 14,850.00",
      gradient: "from-[#036B25] via-[#02531C] to-[#013511]",
      border: "border-[#F2AC00]/60",
      accentGlow: "shadow-[0_12px_36px_rgba(2,83,28,0.55)]",
      badgeBorder: "border-[#F2AC00] text-[#F2AC00] bg-black/60",
      chip: "gold",
    },
    {
      id: "card-2",
      title: "Personal Wallet",
      type: "Virtual",
      masked: "•••• •••• •••• 9213",
      accountMasked: "•••••••••••• HTG",
      expiry: "09/27",
      balance: "$ 6,450.57",
      gradient: "from-[#1F2C23] via-[#142319] to-[#0A160F]",
      border: "border-emerald-500/40",
      accentGlow: "shadow-[0_12px_30px_rgba(16,185,129,0.25)]",
      badgeBorder: "border-emerald-400 text-emerald-300 bg-black/60",
      chip: "gold",
    },
    {
      id: "card-3",
      title: "Savings Vault",
      type: "Yield 4.5%",
      masked: "•••• •••• •••• 5542",
      accountMasked: "•••••••••••• USD",
      expiry: "12/29",
      balance: "$ 1,794.00",
      gradient: "from-[#382D12] via-[#241C0A] to-[#120E05]",
      border: "border-[#F2AC00]/50",
      accentGlow: "shadow-[0_12px_30px_rgba(242,172,0,0.3)]",
      badgeBorder: "border-[#F2AC00] text-[#F2AC00] bg-black/60",
      chip: "gold",
    },
  ];

  // Servicios de suscripción y pagos recurrentes con badges de color vivo
  const servicesList = [
    { name: "MonCash Mobile", provider: "Digicel Haiti", price: "$ 89 /month", date: "Bill date: 31 May", icon: "📱", color: "from-rose-500 to-red-600", status: "Active" },
    { name: "NatCash Express", provider: "Natcom Haiti", price: "$ 299 /month", date: "Bill date: 02 Jun", icon: "⚡", color: "from-cyan-500 to-blue-600", status: "Active" },
    { name: "Digicel Haiti Topup", provider: "Airtime & Data", price: "$ 1,247 /month", date: "Due Tomorrow", icon: "📶", color: "from-emerald-500 to-teal-600", status: "Due", urgent: true },
    { name: "Natcom Fibra & 4G", provider: "Internet Telecom", price: "$ 102 /year", date: "Bill date: 15 Jun", icon: "🌐", color: "from-amber-400 to-orange-500", status: "Active" },
    { name: "Banco BHD Dominicana", provider: "Interbank Transfer", price: "$ 129 /month", date: "Bill date: 28 May", icon: "🏦", color: "from-violet-500 to-purple-700", status: "Active" },
  ];

  // Top Clientes
  const topClients = [
    {
      name: "Chumak Corp.",
      subtitle: "Corporate Partner",
      total: "$ 125,000 Total",
      growth: "+ 18.2%",
      avatars: ["👩‍💼", "👨‍💻", "👨‍💼"],
      badgeColor: "bg-emerald-400 shadow-[0_0_8px_#34d399]",
    },
    {
      name: "NovaTech Inc.",
      subtitle: "Hardware & Logistics",
      total: "$ 89,750 Total",
      growth: "- 11.4%",
      avatars: ["👨‍🔬", "👩‍💻", "🧑‍💼"],
      badgeColor: "bg-cyan-400 shadow-[0_0_8px_#22d3ee]",
    },
  ];

  // Transacciones
  const displayTransfers = (transfers && transfers.length > 0)
    ? transfers.map((tx, idx) => ({
        id: `#${idx + 1}`,
        recipient: tx.recipient_name || "Destinatario",
        sender: displayName,
        date: shortDate(tx.created_at),
        category: tx.service_type === "moncash" ? "MonCash" : tx.service_type === "natcash" ? "NatCash" : "Transfer",
        amount: `$ ${Number(tx.amount_origin).toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
        status: tx.status === "completed" ? "Success" : tx.status === "cancelled" ? "Failed" : "Pending",
        viewLink: `/transferencia/${tx.id}`,
      }))
    : [
        { id: "#1", recipient: "Chumak Corpora...", sender: "Samuel Carter", date: "11/07/2026", category: "Invoice", amount: "$ 125,000", status: "Success", viewLink: "/historial" },
        { id: "#2", recipient: "Apex Dynamics", sender: "Phoenix Baker", date: "11/06/2026", category: "Payroll", amount: "$ 48,200", status: "Failed", viewLink: "/historial" },
        { id: "#3", recipient: "NovaTech Inc.", sender: "Maria Santos", date: "11/05/2026", category: "Transfer", amount: "$ 89,750", status: "Success", viewLink: "/historial" },
        { id: "#4", recipient: "Sterling & Co.", sender: "Cody Fisher", date: "11/04/2026", category: "Refund", amount: "$ 12,300", status: "Pending", viewLink: "/historial" },
      ];

  return (
    <div className="mx-auto max-w-[1700px] space-y-6 pb-28 md:pb-10 text-white selection:bg-[#02531C] selection:text-[#F2AC00]">
      {/* Alerta KYC destacada */}
      {profile && profile.kyc_status !== "approved" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#181F1A] to-[#121613] border border-[#F2AC00]/50 p-4 shadow-[0_8px_24px_rgba(242,172,0,0.15)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#F2AC00]/20 text-[#F2AC00] border border-[#F2AC00]/40">
              <ShieldAlert className="size-5" />
            </div>
            <div className="min-w-0 text-xs">
              <p className="font-bold text-white text-sm">
                {profile.kyc_status === "pending"
                  ? "Verificación en revisión"
                  : "Verifica tu identidad para desbloquear límites completos"}
              </p>
              <p className="text-slate-300 truncate">
                Obtén acceso a tarjetas virtuales Visa/Mastercard y transferencias sin límites.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="h-9 px-4 rounded-xl bg-[#F2AC00] text-black font-extrabold text-xs hover:bg-[#FBBF24] shadow-md transition">
            <Link to="/perfil">Verificar Ahora</Link>
          </Button>
        </div>
      )}

      {/* TOP BAR / HEADER CON ALTO CONTRASTE */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/10 pb-4">
        {/* Left: Selector de panel */}
        <div className="flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-2xl bg-gradient-to-br from-[#036B25] to-[#013511] border-2 border-[#F2AC00] text-[#F2AC00] font-black shadow-[0_0_20px_rgba(242,172,0,0.3)] text-xl">
            T
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-[#141A16] border border-white/15 px-4 py-2 text-sm font-bold text-white hover:border-[#F2AC00]/60 hover:bg-[#1A231D] shadow-md transition"
            >
              <span>Dashboard</span>
              <ChevronDown className="size-4 text-[#F2AC00]" />
            </button>
            <span className="hidden sm:inline text-xs font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              Tcho-Tcho Digital Banking
            </span>
          </div>
        </div>

        {/* Center: Buscador de alto contraste */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#F2AC00]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search payments, clients, cards..."
            className="w-full h-11 rounded-2xl bg-[#111713] border border-white/15 pl-10 pr-4 text-xs text-white placeholder:text-slate-400 focus:outline-none focus:border-[#F2AC00] focus:ring-1 focus:ring-[#F2AC00] shadow-inner transition"
          />
        </div>

        {/* Right: Notificaciones, Selector de Fecha y Perfil */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/dashboard"
            className="relative flex items-center gap-2 rounded-xl bg-[#141A16] border border-white/15 px-3.5 py-2 text-xs font-bold text-white hover:border-[#F2AC00]/50 hover:bg-[#1A231D] shadow-md transition"
          >
            <Bell className="size-4 text-[#F2AC00]" />
            <span className="bg-[#F2AC00] text-black font-extrabold px-1.5 py-0.2 rounded-full text-[10px]">2 new</span>
          </Link>

          <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[#141A16] border border-white/15 px-3 py-2 text-xs text-white shadow-md">
            <ChevronLeft className="size-4 cursor-pointer text-slate-400 hover:text-white" />
            <span className="px-1 text-xs font-semibold text-slate-200">Today, May 07</span>
            <ChevronRight className="size-4 cursor-pointer text-slate-400 hover:text-white" />
          </div>

          <div className="flex items-center gap-2.5 pl-2 border-l border-white/15">
            <div className="grid size-10 place-items-center rounded-xl bg-gradient-to-tr from-[#02531C] to-[#10B981] text-[#F2AC00] font-black text-sm border border-[#F2AC00]/50 shadow-[0_0_12px_rgba(2,83,28,0.6)]">
              {displayName.charAt(0)}
            </div>
            <div className="hidden xl:block text-left text-xs leading-tight">
              <p className="font-extrabold text-white truncate max-w-[130px]">{displayName}</p>
              <p className="text-[11px] text-emerald-400 font-medium truncate max-w-[130px]">{userEmail}</p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN 3-COLUMN FINTECH GRID CON CONTRASTE ELEVADO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================
            COLUMNA IZQUIERDA (4 cols): REVENUE OVERVIEW & TOP CLIENTS
            ======================================================== */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Revenue Overview Card */}
          <div className="rounded-3xl bg-gradient-to-b from-[#131A15] via-[#0E1511] to-[#0A0F0C] border border-white/15 p-5 space-y-4 shadow-[0_12px_36px_rgba(0,0,0,0.85)] relative overflow-hidden">
            {/* Glow de fondo vibrante */}
            <div className="absolute -top-16 -left-16 size-56 rounded-full bg-[#02531C]/35 blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between relative z-10">
              <div>
                <h3 className="font-display font-black text-lg text-white tracking-tight">Revenue Overview</h3>
                <p className="text-xs font-medium text-slate-300">Updated today, 07 May 2026</p>
              </div>

              {/* Selector de moneda */}
              <button
                type="button"
                onClick={() => setCurrencyView(currencyView === "USD" ? "HTG" : "USD")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C2620] border border-[#F2AC00]/40 px-3 py-1.5 text-xs font-black text-[#F2AC00] hover:bg-[#02531C]/50 shadow-sm transition"
              >
                <span>{currencyView}</span>
                <ChevronDown className="size-3.5 text-[#F2AC00]" />
              </button>
            </div>

            {/* Sub-caja "Overview" con métricas y gráfico */}
            <div className="rounded-2xl bg-gradient-to-b from-[#19221C] to-[#121A15] border border-white/12 p-4 space-y-3.5 shadow-inner relative z-10">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#10B981] animate-ping" />
                  Overview
                </span>
                <Info className="size-4 text-emerald-400 cursor-pointer hover:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-xl bg-black/40 border border-white/5 p-2.5">
                  <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Peak Volume</p>
                  <p className="font-extrabold text-white text-xs mt-1">2x vs last month</p>
                </div>
                <div className="rounded-xl bg-black/40 border border-[#F2AC00]/30 p-2.5 text-right">
                  <p className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider">Growth Rate</p>
                  <p className="font-black text-[#F2AC00] text-sm mt-0.5">+ 12.83 %</p>
                </div>
              </div>

              {/* Pestañas de tiempo: 24h, Week, Month con colores vivos */}
              <div className="flex items-center justify-between rounded-xl bg-black/60 p-1 border border-white/10 text-xs">
                {(["24h", "week", "month"] as const).map((tVal) => (
                  <button
                    key={tVal}
                    type="button"
                    onClick={() => setTimeframe(tVal)}
                    className={cn(
                      "flex-1 py-1.5 rounded-lg font-bold text-xs capitalize transition-all",
                      timeframe === tVal
                        ? "bg-gradient-to-r from-[#02531C] to-[#046824] text-[#F2AC00] shadow-[0_0_12px_rgba(242,172,0,0.35)] border border-[#F2AC00]/50"
                        : "text-slate-300 hover:text-white"
                    )}
                  >
                    {tVal === "week" ? "Week" : tVal === "month" ? "Month" : "24h"}
                  </button>
                ))}
              </div>

              {/* Spline Wave Curve SVG con resplandor neón esmeralda y tooltip oro */}
              <div className="relative pt-3 pb-1">
                <svg viewBox="0 0 320 120" className="w-full h-32 overflow-visible">
                  <defs>
                    <linearGradient id="waveEmeraldGradientVivid" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#10B981" stopOpacity="0.6" />
                      <stop offset="50%" stopColor="#02531C" stopOpacity="0.3" />
                      <stop offset="100%" stopColor="#02531C" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="superNeonEmeraldGlow" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Cuadrícula */}
                  <line x1="0" y1="30" x2="320" y2="30" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <line x1="0" y1="65" x2="320" y2="65" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />
                  <line x1="0" y1="100" x2="320" y2="100" stroke="rgba(255,255,255,0.08)" strokeDasharray="3 3" />

                  {/* Área rellenada */}
                  <path
                    d="M 10 90 Q 60 70, 110 82 T 210 45 T 270 30 T 310 50 L 310 115 L 10 115 Z"
                    fill="url(#waveEmeraldGradientVivid)"
                  />

                  {/* Línea curva spline principal */}
                  <path
                    d="M 10 90 Q 60 70, 110 82 T 210 45 T 270 30 T 310 50"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3.5"
                    filter="url(#superNeonEmeraldGlow)"
                    strokeLinecap="round"
                  />

                  {/* Línea vertical punteada al punto May 29 */}
                  <line x1="210" y1="45" x2="210" y2="115" stroke="#F2AC00" strokeWidth="2" strokeDasharray="4 3" />

                  {/* Puntos destacados */}
                  <circle cx="10" cy="90" r="3.5" fill="#34D399" />
                  <circle cx="110" cy="82" r="3.5" fill="#34D399" />
                  <circle cx="210" cy="45" r="6" fill="#F2AC00" stroke="#000" strokeWidth="2.5" />
                  <circle cx="270" cy="30" r="4" fill="#34D399" />
                  <circle cx="310" cy="50" r="3.5" fill="#34D399" />
                </svg>

                {/* Tooltip flotante con alto contraste sobre el punto May 29 */}
                <div className="absolute top-1 left-1/2 translate-x-3 rounded-2xl bg-black/95 border-2 border-[#F2AC00] p-2.5 shadow-[0_8px_24px_rgba(242,172,0,0.35)] backdrop-blur-xl text-xs space-y-0.5">
                  <p className="text-slate-300 font-bold text-[10px]">May 29</p>
                  <p className="font-black text-white text-sm tracking-tight">$ 5,538.65</p>
                  <p className="font-black text-[#10B981] text-xs">+ 9.41%</p>
                </div>

                {/* Eje X de fechas */}
                <div className="flex items-center justify-between text-xs text-slate-300 pt-2 font-mono font-bold">
                  <span>May 01</span>
                  <span>May 10</span>
                  <span>May 20</span>
                  <span className="text-[#F2AC00] font-black underline decoration-2 underline-offset-4">May 29</span>
                </div>
              </div>
            </div>

            {/* Gran porcentaje inferior */}
            <div className="flex items-baseline justify-between pt-1 relative z-10">
              <div>
                <span className="text-4xl font-black tracking-tight text-[#10B981] drop-shadow-[0_0_15px_rgba(16,185,129,0.4)]">
                  + 19.23 %
                </span>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase text-slate-400">Last updated</p>
                <p className="text-xs font-bold text-white">Today, 06:49 AM</p>
              </div>
            </div>
          </div>

          {/* Top Clients con Alto Contraste */}
          <div className="rounded-3xl bg-gradient-to-b from-[#131A15] via-[#0E1511] to-[#0A0F0C] border border-white/15 p-5 space-y-4 shadow-[0_12px_36px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-base text-white">Top Clients</h3>
                <p className="text-xs font-medium text-slate-300">02 of 5 active companies</p>
              </div>

              {/* Botones de navegación */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-xl bg-[#1C2620] border border-white/15 text-slate-300 hover:text-white hover:border-[#F2AC00]/60 shadow-sm transition"
                  aria-label="Previous client"
                >
                  <ChevronLeft className="size-4" />
                </button>
                <button
                  type="button"
                  className="grid size-8 place-items-center rounded-xl bg-[#1C2620] border border-white/15 text-slate-300 hover:text-white hover:border-[#F2AC00]/60 shadow-sm transition"
                  aria-label="Next client"
                >
                  <ChevronRight className="size-4" />
                </button>
              </div>
            </div>

            {/* Lista de tarjetas horizontales */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {topClients.map((client) => (
                <div
                  key={client.name}
                  className="rounded-2xl bg-gradient-to-b from-[#1A231D] to-[#121A15] border border-white/12 p-4 space-y-2.5 hover:border-[#F2AC00]/50 hover:shadow-[0_8px_20px_rgba(2,83,28,0.25)] transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2.5 rounded-full", client.badgeColor)} />
                      <p className="text-xs font-extrabold text-white group-hover:text-[#F2AC00] transition">
                        {client.name}
                      </p>
                    </div>
                    <MoreVertical className="size-4 text-slate-400 cursor-pointer hover:text-white" />
                  </div>

                  <div className="flex items-baseline justify-between">
                    <p className="text-base font-black text-white">{client.total}</p>
                    <span className={cn(
                      "text-xs font-black px-2 py-0.5 rounded-full border",
                      client.growth.startsWith("+")
                        ? "text-emerald-300 bg-emerald-500/20 border-emerald-500/40"
                        : "text-rose-300 bg-rose-500/20 border-rose-500/40"
                    )}>
                      {client.growth}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div className="flex -space-x-2">
                      {client.avatars.map((emoji, idx) => (
                        <div
                          key={idx}
                          className="grid size-7 place-items-center rounded-full bg-slate-800 border-2 border-black text-xs shadow-md"
                        >
                          {emoji}
                        </div>
                      ))}
                      <div className="grid size-7 place-items-center rounded-full bg-[#02531C] border-2 border-black text-[10px] font-black text-[#F2AC00]">
                        +
                      </div>
                    </div>
                    <span className="text-xs font-semibold text-slate-300">{client.subtitle}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* =================================================================
            COLUMNA CENTRAL (5 cols en desktop): TOTAL BALANCE, 3D CARDS & TRANSACTIONS
            ================================================================= */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Total Balance Card */}
          <div className="rounded-3xl bg-gradient-to-b from-[#131A15] via-[#0E1511] to-[#0A0F0C] border border-white/15 p-5 space-y-4 shadow-[0_12px_36px_rgba(0,0,0,0.85)] relative overflow-hidden">
            {/* Resplandor oro sutil */}
            <div className="absolute top-0 right-0 size-60 rounded-full bg-[#F2AC00]/20 blur-3xl pointer-events-none" />

            <div className="flex items-start justify-between relative z-10">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-300">Total Balance</p>
                <p className="text-[11px] font-medium text-slate-400">Across all connected accounts</p>
                <div className="flex items-baseline gap-2.5 mt-1.5">
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                    {hideBalance ? "••••••••" : formattedBalance}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setHideBalance(!hideBalance)}
                    className="text-[#F2AC00] hover:text-white transition"
                    aria-label="Toggle balance visibility"
                  >
                    {hideBalance ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
                  </button>
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Monthly avg: <span className="font-extrabold text-[#10B981]">$15,230 ↗</span>
                </p>
              </div>

              <div className="text-right space-y-1">
                <button
                  type="button"
                  onClick={() => setCurrencyView(currencyView === "USD" ? "HTG" : "USD")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C2620] border border-[#F2AC00]/40 px-3 py-1.5 text-xs font-black text-[#F2AC00] hover:bg-[#02531C]/50 shadow-sm transition"
                >
                  <span>{currencyView}</span>
                  <ChevronDown className="size-3.5 text-[#F2AC00]" />
                </button>
                <p className="text-[10px] font-semibold text-slate-400">Compared to last month</p>
                <p className="text-xs font-extrabold text-rose-400 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-full inline-block">
                  - 37.16 %
                </p>
              </div>
            </div>

            {/* ABANICO 3D DE TARJETAS VIBRANTES */}
            <div className="relative pt-4 pb-2 z-10">
              <div className="relative h-52 w-full max-w-md mx-auto">
                {/* Tarjeta 3 (Fondo lejano) */}
                <div
                  onClick={() => setActiveCardIndex(2)}
                  className={cn(
                    "absolute top-0 right-2 w-[85%] h-48 rounded-2xl border p-4 transition-all duration-300 cursor-pointer shadow-xl opacity-60 hover:opacity-90",
                    cardsList[2].gradient,
                    cardsList[2].border
                  )}
                  style={{ transform: "rotate(6deg) translateY(-8px)" }}
                >
                  <div className="flex justify-end">
                    <Wifi className="size-4 text-[#F2AC00]" />
                  </div>
                </div>

                {/* Tarjeta 2 (Intermedia) */}
                <div
                  onClick={() => setActiveCardIndex(1)}
                  className={cn(
                    "absolute top-1 right-5 w-[90%] h-48 rounded-2xl border p-4 transition-all duration-300 cursor-pointer shadow-2xl opacity-85 hover:opacity-100",
                    cardsList[1].gradient,
                    cardsList[1].border
                  )}
                  style={{ transform: "rotate(3deg) translateY(-4px)" }}
                >
                  <div className="flex justify-end">
                    <Wifi className="size-4 text-emerald-400" />
                  </div>
                </div>

                {/* Tarjeta 1 (FRENTE - Principal) */}
                <div
                  className={cn(
                    "relative z-10 w-full h-48 rounded-2xl border-2 p-5 shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden",
                    cardsList[activeCardIndex].gradient,
                    cardsList[activeCardIndex].border,
                    cardsList[activeCardIndex].accentGlow
                  )}
                >
                  {/* Resplandor interno de tarjeta */}
                  <div className="absolute -bottom-8 -right-8 size-40 rounded-full bg-white/[0.1] blur-xl pointer-events-none" />

                  {/* Header */}
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <p className="text-xs font-black text-white tracking-wider uppercase">
                        {cardsList[activeCardIndex].title}
                      </p>
                      <p className="text-[11px] font-mono font-bold text-[#F2AC00]">
                        {cardsList[activeCardIndex].accountMasked}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-black border", cardsList[activeCardIndex].badgeBorder)}>
                        {cardsList[activeCardIndex].type}
                      </span>
                      <Wifi className="size-5 text-[#F2AC00]" />
                    </div>
                  </div>

                  {/* Saldo de tarjeta */}
                  <div className="relative z-10 my-auto">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                      Balance Amount
                    </p>
                    <p className="text-2xl font-black text-white tracking-tight drop-shadow-md">
                      {cardsList[activeCardIndex].balance}
                    </p>
                  </div>

                  {/* Footer con número y logos */}
                  <div className="flex items-center justify-between relative z-10 pt-1">
                    <p className="font-mono text-sm font-bold text-white tracking-widest">
                      {cardsList[activeCardIndex].masked}
                    </p>

                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {cardsList[activeCardIndex].expiry}
                      </span>
                      <div className="flex -space-x-2">
                        <div className="size-5 rounded-full bg-[#EB001B] shadow-sm" />
                        <div className="size-5 rounded-full bg-[#F79E1B] shadow-sm" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 BOTONES DE ACCIÓN RÁPIDA CON CONTRASTE ELEVADO */}
            <div className="grid grid-cols-4 gap-2.5 pt-2 relative z-10">
              <Link
                to="/enviar"
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-b from-[#1C2620] to-[#121A15] border border-emerald-500/30 p-3 text-white hover:border-[#F2AC00] hover:bg-[#02531C]/60 hover:shadow-[0_0_20px_rgba(242,172,0,0.3)] transition-all group"
              >
                <div className="grid size-9 place-items-center rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/40 group-hover:scale-110 transition shadow-md">
                  <Send className="size-4" />
                </div>
                <span className="text-xs font-bold">Sent</span>
              </Link>

              <Link
                to="/enviar"
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-b from-[#1C2620] to-[#121A15] border border-emerald-500/30 p-3 text-white hover:border-[#F2AC00] hover:bg-[#02531C]/60 hover:shadow-[0_0_20px_rgba(242,172,0,0.3)] transition-all group"
              >
                <div className="grid size-9 place-items-center rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/40 group-hover:scale-110 transition shadow-md">
                  <Download className="size-4" />
                </div>
                <span className="text-xs font-bold">Receive</span>
              </Link>

              <Link
                to="/perfil"
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-b from-[#1C2620] to-[#121A15] border border-emerald-500/30 p-3 text-white hover:border-[#F2AC00] hover:bg-[#02531C]/60 hover:shadow-[0_0_20px_rgba(242,172,0,0.3)] transition-all group"
              >
                <div className="grid size-9 place-items-center rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/40 group-hover:scale-110 transition shadow-md">
                  <CreditCard className="size-4" />
                </div>
                <span className="text-xs font-bold">Add Card</span>
              </Link>

              <Link
                to="/recargas"
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-b from-[#1C2620] to-[#121A15] border border-emerald-500/30 p-3 text-white hover:border-[#F2AC00] hover:bg-[#02531C]/60 hover:shadow-[0_0_20px_rgba(242,172,0,0.3)] transition-all group"
              >
                <div className="grid size-9 place-items-center rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/40 group-hover:scale-110 transition shadow-md">
                  <ArrowRightLeft className="size-4" />
                </div>
                <span className="text-xs font-bold">Exchange</span>
              </Link>
            </div>
          </div>

          {/* RECENT TRANSACTIONS TABLE CON ALTO CONTRASTE */}
          <div className="rounded-3xl bg-gradient-to-b from-[#131A15] via-[#0E1511] to-[#0A0F0C] border border-white/15 p-5 space-y-4 shadow-[0_12px_36px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-base text-white">Recent Transactions</h3>
                <p className="text-xs font-medium text-slate-300">Activity across cards and bank transfers</p>
              </div>

              {/* Botón de filtro de lista */}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1C2620] border border-[#F2AC00]/40 px-3 py-1.5 text-xs font-bold text-white hover:bg-[#02531C]/50 shadow-sm transition"
              >
                <ListFilter className="size-3.5 text-[#F2AC00]" />
                <span>List</span>
                <ChevronDown className="size-3.5 text-slate-300" />
              </button>
            </div>

            {/* Tabla con tipografía clara */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-xs font-bold text-slate-300 uppercase tracking-wider">
                    <th className="pb-3">#</th>
                    <th className="pb-3">Recipient</th>
                    <th className="pb-3 hidden sm:table-cell">Sender</th>
                    <th className="pb-3 hidden md:table-cell">Date</th>
                    <th className="pb-3">Amount</th>
                    <th className="pb-3">Status</th>
                    <th className="pb-3 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {displayTransfers.map((tx) => (
                    <tr key={tx.id} className="group hover:bg-[#02531C]/15 transition-colors">
                      <td className="py-3.5 font-mono text-xs font-bold text-slate-400">{tx.id}</td>
                      <td className="py-3.5">
                        <p className="font-extrabold text-white group-hover:text-[#F2AC00] transition truncate max-w-[140px]">
                          {tx.recipient}
                        </p>
                        <p className="text-[10px] text-slate-300 font-medium sm:hidden">{tx.category} • {tx.date}</p>
                      </td>
                      <td className="py-3.5 text-slate-300 font-medium hidden sm:table-cell truncate max-w-[110px]">
                        {tx.sender}
                      </td>
                      <td className="py-3.5 text-slate-300 font-mono text-xs hidden md:table-cell">
                        {tx.date}
                      </td>
                      <td className="py-3.5 font-black text-white font-mono text-sm">
                        {tx.amount}
                      </td>
                      <td className="py-3.5">
                        <span
                          className={cn(
                            "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-black border",
                            tx.status === "Success"
                              ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/50 shadow-[0_0_10px_rgba(16,185,129,0.3)]"
                              : tx.status === "Failed"
                                ? "bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-[0_0_10px_rgba(244,63,94,0.3)]"
                                : "bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-[0_0_10px_rgba(245,158,11,0.3)]"
                          )}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3.5 text-right">
                        <Link
                          to={tx.viewLink}
                          className="inline-flex items-center justify-center rounded-xl bg-[#1C2620] border border-white/15 px-3 py-1 text-xs font-bold text-white hover:border-[#F2AC00] hover:bg-[#02531C] shadow-sm transition"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pt-2 text-center">
              <Link
                to="/historial"
                className="inline-flex items-center gap-1.5 text-xs font-extrabold text-[#F2AC00] hover:underline"
              >
                <span>View all transaction activity</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>

        {/* =================================================================
            COLUMNA DERECHA (3 cols en desktop): SAAS & SERVICES SPENDING
            ================================================================= */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-3xl bg-gradient-to-b from-[#131A15] via-[#0E1511] to-[#0A0F0C] border border-white/15 p-5 space-y-4 shadow-[0_12px_36px_rgba(0,0,0,0.85)]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-black text-base text-white">SaaS Spending</h3>
                <p className="text-xs font-medium text-slate-300">Monthly auto-debits</p>
              </div>
              <span className="text-base font-black text-[#F2AC00]">$ 1,815 /mo</span>
            </div>

            {/* Lista de servicios activos con iconos vivos */}
            <div className="space-y-2.5">
              {servicesList.map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between rounded-2xl bg-gradient-to-b from-[#1A231D] to-[#121A15] border border-white/12 p-3.5 hover:border-[#F2AC00]/40 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("grid size-10 shrink-0 place-items-center rounded-xl bg-gradient-to-tr text-lg shadow-md", svc.color)}>
                      {svc.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-white truncate group-hover:text-[#F2AC00] transition">
                        {svc.name}
                      </p>
                      <p className="text-[10px] text-slate-300 font-medium truncate">{svc.provider}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-black text-xs text-white">{svc.price}</p>
                    <p className={cn("text-[10px] font-bold", svc.urgent ? "text-[#F2AC00] animate-pulse" : "text-slate-300")}>
                      {svc.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              asChild
              variant="outline"
              className="w-full h-11 rounded-2xl border-white/15 bg-[#1C2620] text-xs font-extrabold text-white hover:text-white hover:border-[#F2AC00] hover:bg-[#02531C] shadow-md transition"
            >
              <Link to="/recargas">
                View all 12 services
              </Link>
            </Button>
          </div>

          {/* Quick Currency Rate Card Tcho-Tcho */}
          <div className="rounded-3xl bg-gradient-to-b from-[#142318] via-[#0D1810] to-[#0A0D0B] border-2 border-[#02531C] p-4.5 space-y-3.5 shadow-[0_12px_36px_rgba(2,83,28,0.35)] relative overflow-hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="font-black text-white flex items-center gap-1.5 text-sm">
                <Coins className="size-4 text-[#F2AC00]" />
                Live Exchange Rate
              </span>
              <span className="rounded-full bg-[#02531C] border border-[#F2AC00]/60 px-2.5 py-0.5 text-[10px] font-black text-[#F2AC00] shadow-sm">
                Live
              </span>
            </div>

            <div className="rounded-2xl bg-black/60 border border-white/10 p-3.5 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">1 USD</span>
                <span className="font-black text-white text-sm">≈ {rate?.rate ? `${Number(rate.rate).toFixed(2)} HTG` : "132.50 HTG"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">1000 DOP</span>
                <span className="font-black text-[#F2AC00] text-sm">≈ 2,240.00 HTG</span>
              </div>
            </div>

            <Link
              to="/enviar"
              className="flex items-center justify-center gap-2 w-full h-10 rounded-xl bg-gradient-to-r from-[#02531C] to-[#04782A] text-white font-black text-xs shadow-lg hover:scale-[1.02] active:scale-[0.98] transition border-2 border-[#F2AC00]"
            >
              <Send className="size-3.5 text-[#F2AC00]" />
              <span>Send Money to Haiti Now</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
