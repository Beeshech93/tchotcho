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
      { name: "description", content: "Panel de control financiero inteligente inspirado en Payx con los colores de Tcho-Tcho." },
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
  const [chartHoverPoint, setChartHoverPoint] = useState<number | null>(4); // Default to May 29
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
  const formattedBalance = currencyView === "USD" ? `$ ${primaryBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : `HTG ${primaryBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const displayName = profile?.full_name?.split(" ")[0] || "Michael";
  const userEmail = profile?.email || "michael@tcho-tcho.com";

  // Tarjetas virtuales y físicas inspiradas en el abanico 3D de Payx con colores Tcho-Tcho
  const cardsList = [
    {
      id: "card-1",
      title: "Business Account",
      type: "Corporate",
      masked: "•••• •••• •••• 1234",
      accountMasked: "•••••••••••• USD",
      expiry: "06/28",
      balance: "$ 14,850.00",
      gradient: "from-[#02531C] via-[#046824] to-[#0A3D18]",
      accentGlow: "shadow-[#02531C]/40",
      badgeBorder: "border-[#F2AC00]/40",
      chip: "gold",
      network: "mastercard",
    },
    {
      id: "card-2",
      title: "Personal Wallet",
      type: "Virtual",
      masked: "•••• •••• •••• 9213",
      accountMasked: "•••••••••••• HTG",
      expiry: "09/27",
      balance: "$ 6,450.57",
      gradient: "from-[#17201A] via-[#102B1A] to-[#0B1A11]",
      accentGlow: "shadow-[#02531C]/20",
      badgeBorder: "border-white/20",
      chip: "gold",
      network: "visa",
    },
    {
      id: "card-3",
      title: "Savings Vault",
      type: "Yield 4.5%",
      masked: "•••• •••• •••• 5542",
      accountMasked: "•••••••••••• USD",
      expiry: "12/29",
      balance: "$ 1,794.00",
      gradient: "from-[#2A2312] via-[#1F1B10] to-[#12110B]",
      accentGlow: "shadow-[#F2AC00]/20",
      badgeBorder: "border-[#F2AC00]/30",
      chip: "silver",
      network: "visa",
    },
  ];

  // Datos interactivos para la curva de ingresos/gastos según timeframe
  const chartPoints = [
    { label: "May 01", value: 3200, growth: "+4.1%" },
    { label: "May 10", value: 4100, growth: "+7.3%" },
    { label: "May 15", value: 3750, growth: "+6.0%" },
    { label: "May 20", value: 4890, growth: "+8.5%" },
    { label: "May 29", value: 5538.65, growth: "+9.41%" },
    { label: "Jun 05", value: 6120, growth: "+12.1%" },
  ];

  // Servicios de suscripción y pagos recurrentes (SaaS / Remesas / Topups)
  const servicesList = [
    { name: "MonCash Mobile", provider: "Digicel Haiti", price: "$ 89 /month", date: "Bill date: 31 May", icon: "📱", color: "from-red-600 to-rose-700", status: "Active" },
    { name: "NatCash Express", provider: "Natcom Haiti", price: "$ 299 /month", date: "Bill date: 02 Jun", icon: "⚡", color: "from-blue-600 to-indigo-700", status: "Active" },
    { name: "Digicel Haiti Topup", provider: "Airtime & Data", price: "$ 1,247 /month", date: "Due Tomorrow", icon: "📶", color: "from-emerald-600 to-teal-700", status: "Due", urgent: true },
    { name: "Natcom Fibra & 4G", provider: "Internet Telecom", price: "$ 102 /year", date: "Bill date: 15 Jun", icon: "🌐", color: "from-amber-600 to-yellow-600", status: "Active" },
    { name: "Banco BHD Dominicana", provider: "Interbank Transfer", price: "$ 129 /month", date: "Bill date: 28 May", icon: "🏦", color: "from-purple-600 to-indigo-800", status: "Active" },
  ];

  // Top Beneficiarios / Clientes
  const topClients = [
    {
      name: "Chumak Corp.",
      subtitle: "Corporate Partner",
      total: "$ 125,000 Total",
      growth: "+ 18.2%",
      avatars: ["👩‍💼", "👨‍💻", "👨‍💼"],
      badgeColor: "bg-emerald-500",
    },
    {
      name: "NovaTech Inc.",
      subtitle: "Hardware & Logistics",
      total: "$ 89,750 Total",
      growth: "- 11.4%",
      avatars: ["👨‍🔬", "👩‍💻", "🧑‍💼"],
      badgeColor: "bg-blue-500",
    },
  ];

  // Transacciones recientes (reales o de muestra de alta fidelidad)
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
      {/* Alerta KYC si aplica */}
      {profile && profile.kyc_status !== "approved" && (
        <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#0D120E] border border-[#F2AC00]/30 p-3.5 shadow-lg">
          <div className="flex items-center gap-2.5 min-w-0">
            <ShieldAlert className="size-5 shrink-0 text-[#F2AC00]" />
            <div className="min-w-0 text-xs">
              <p className="font-semibold text-white">
                {profile.kyc_status === "pending"
                  ? "Verificación en revisión"
                  : "Verifica tu identidad para desbloquear límites completos"}
              </p>
              <p className="text-slate-400 truncate">
                Obtén acceso a tarjetas virtuales Visa/Mastercard y transferencias sin límites.
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="h-8 rounded-full bg-[#F2AC00] text-black font-semibold text-xs hover:bg-[#E09E00]">
            <Link to="/perfil">Verificar</Link>
          </Button>
        </div>
      )}

      {/* TOP BAR / HEADER (Inspirado en Payx) */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between border-b border-white/5 pb-4">
        {/* Left: Selector de panel */}
        <div className="flex items-center gap-3">
          <div className="grid size-10 place-items-center rounded-2xl bg-[#02531C] border border-[#F2AC00]/40 text-[#F2AC00] font-black shadow-lg shadow-[#02531C]/30 text-lg">
            T
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-xl bg-white/[0.04] border border-white/10 px-3.5 py-1.5 text-sm font-bold text-white hover:bg-white/[0.08] transition"
            >
              <span>Dashboard</span>
              <ChevronDown className="size-3.5 text-slate-400" />
            </button>
            <span className="hidden sm:inline text-xs text-slate-500">Tcho-Tcho Digital Banking</span>
          </div>
        </div>

        {/* Center: Buscador elegante */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search payments, clients, cards..."
            className="w-full h-10 rounded-2xl bg-[#0D0F0E] border border-white/10 pl-10 pr-4 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-[#F2AC00]/50 transition"
          />
        </div>

        {/* Right: Notificaciones, Selector de Fecha y Perfil */}
        <div className="flex items-center gap-2.5">
          <Link
            to="/dashboard"
            className="relative flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:text-white transition"
          >
            <Bell className="size-3.5 text-[#F2AC00]" />
            <span>2 new</span>
          </Link>

          <div className="hidden sm:flex items-center gap-1 rounded-xl bg-white/[0.04] border border-white/10 px-2.5 py-1 text-xs text-slate-300">
            <ChevronLeft className="size-3.5 cursor-pointer text-slate-400 hover:text-white" />
            <span className="px-1 text-[11px] font-medium">Today, May 07</span>
            <ChevronRight className="size-3.5 cursor-pointer text-slate-400 hover:text-white" />
          </div>

          <div className="flex items-center gap-2 pl-2 border-l border-white/10">
            <div className="grid size-9 place-items-center rounded-xl bg-gradient-to-tr from-[#02531C] to-[#057A29] text-[#F2AC00] font-bold text-xs shadow-md">
              {displayName.charAt(0)}
            </div>
            <div className="hidden xl:block text-left text-xs leading-tight">
              <p className="font-bold text-white truncate max-w-[120px]">{displayName}</p>
              <p className="text-[10px] text-slate-400 truncate max-w-[120px]">{userEmail}</p>
            </div>
          </div>
        </div>
      </header>

      {/* MAIN 3-COLUMN FINTECH GRID (Payx Layout con Colores Tcho-Tcho) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* ========================================================
            COLUMNA IZQUIERDA (4 cols): REVENUE OVERVIEW & TOP CLIENTS
            ======================================================== */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Revenue Overview Card */}
          <div className="rounded-3xl bg-[#090C0A] border border-white/10 p-5 space-y-4 shadow-xl relative overflow-hidden">
            {/* Glow sutil de fondo */}
            <div className="absolute -top-16 -left-16 size-48 rounded-full bg-[#02531C]/25 blur-3xl pointer-events-none" />

            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-lg text-white">Revenue Overview</h3>
                <p className="text-[11px] text-slate-400">Updated today, 07 May 2026</p>
              </div>

              {/* Selector de moneda */}
              <button
                type="button"
                onClick={() => setCurrencyView(currencyView === "USD" ? "HTG" : "USD")}
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-white/10 transition"
              >
                <span>{currencyView}</span>
                <ChevronDown className="size-3 text-slate-400" />
              </button>
            </div>

            {/* Sub-caja "Overview" con métricas y gráfico */}
            <div className="rounded-2xl bg-[#0F1410] border border-white/5 p-4 space-y-3.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-white">Overview</span>
                <Info className="size-3.5 text-slate-500 cursor-pointer hover:text-white" />
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <p className="text-[10px] text-slate-400">Peak Volume</p>
                  <p className="font-bold text-white text-xs mt-0.5">2x increase vs last month</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Growth Rate</p>
                  <p className="font-bold text-[#F2AC00] text-xs mt-0.5">+ 12.83 %</p>
                </div>
              </div>

              {/* Pestañas de tiempo: 24h, Week, Month */}
              <div className="flex items-center justify-between rounded-xl bg-black/40 p-1 border border-white/5 text-xs">
                {(["24h", "week", "month"] as const).map((tVal) => (
                  <button
                    key={tVal}
                    type="button"
                    onClick={() => setTimeframe(tVal)}
                    className={cn(
                      "flex-1 py-1 rounded-lg font-semibold text-xs capitalize transition-all",
                      timeframe === tVal
                        ? "bg-[#02531C] text-[#F2AC00] shadow-sm border border-[#F2AC00]/30"
                        : "text-slate-400 hover:text-white"
                    )}
                  >
                    {tVal === "week" ? "Week" : tVal === "month" ? "Month" : "24h"}
                  </button>
                ))}
              </div>

              {/* Spline Wave Curve SVG con resplandor esmeralda/dorado y tooltip interactivo */}
              <div className="relative pt-3 pb-1">
                <svg viewBox="0 0 320 120" className="w-full h-28 overflow-visible">
                  <defs>
                    <linearGradient id="waveEmeraldGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#02531C" stopOpacity="0.5" />
                      <stop offset="100%" stopColor="#02531C" stopOpacity="0.0" />
                    </linearGradient>
                    <filter id="neonEmeraldGlow" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="3" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* Líneas de cuadrícula sutiles */}
                  <line x1="0" y1="30" x2="320" y2="30" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="0" y1="65" x2="320" y2="65" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />
                  <line x1="0" y1="100" x2="320" y2="100" stroke="rgba(255,255,255,0.05)" strokeDasharray="3 3" />

                  {/* Área rellenada */}
                  <path
                    d="M 10 90 Q 60 70, 110 82 T 210 45 T 270 30 T 310 50 L 310 115 L 10 115 Z"
                    fill="url(#waveEmeraldGradient)"
                  />

                  {/* Línea de onda spline principal en verde esmeralda */}
                  <path
                    d="M 10 90 Q 60 70, 110 82 T 210 45 T 270 30 T 310 50"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="3"
                    filter="url(#neonEmeraldGlow)"
                    strokeLinecap="round"
                  />

                  {/* Línea vertical punteada al punto May 29 */}
                  <line x1="210" y1="45" x2="210" y2="115" stroke="#F2AC00" strokeWidth="1.5" strokeDasharray="3 3" />

                  {/* Puntos destacados */}
                  <circle cx="10" cy="90" r="3" fill="#10B981" />
                  <circle cx="110" cy="82" r="3" fill="#10B981" />
                  <circle cx="210" cy="45" r="5" fill="#F2AC00" stroke="#000" strokeWidth="2" className="animate-pulse" />
                  <circle cx="270" cy="30" r="3.5" fill="#10B981" />
                  <circle cx="310" cy="50" r="3" fill="#10B981" />
                </svg>

                {/* Tooltip flotante fiel al mockup sobre el punto May 29 */}
                <div className="absolute top-2 left-1/2 translate-x-2 rounded-xl bg-black/90 border border-[#F2AC00]/40 p-2 shadow-xl backdrop-blur-md text-[10px] space-y-0.5">
                  <p className="text-slate-400 font-medium">May 29</p>
                  <p className="font-bold text-white text-xs">$ 5,538.65</p>
                  <p className="font-semibold text-[#F2AC00]">+ 9.41%</p>
                </div>

                {/* Etiquetas de fechas en el eje X */}
                <div className="flex items-center justify-between text-[10px] text-slate-500 pt-2 font-mono">
                  <span>May 01</span>
                  <span>May 10</span>
                  <span>May 20</span>
                  <span className="text-[#F2AC00] font-semibold">May 29</span>
                </div>
              </div>
            </div>

            {/* Métrica inferior en grande */}
            <div className="flex items-baseline justify-between pt-1">
              <div>
                <span className="text-3xl font-extrabold tracking-tight text-white">+ 19.23 %</span>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-slate-500">Last updated</p>
                <p className="text-xs font-medium text-slate-300">Today, 06:49 AM</p>
              </div>
            </div>
          </div>

          {/* Top Clients / Beneficiarios Recientes */}
          <div className="rounded-3xl bg-[#090C0A] border border-white/10 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-white">Top Clients</h3>
                <p className="text-[11px] text-slate-400">02 of 5 active companies</p>
              </div>

              {/* Botones de paginación */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-lg bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition"
                  aria-label="Previous client"
                >
                  <ChevronLeft className="size-3.5" />
                </button>
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-lg bg-white/[0.04] border border-white/10 text-slate-400 hover:text-white hover:bg-white/10 transition"
                  aria-label="Next client"
                >
                  <ChevronRight className="size-3.5" />
                </button>
              </div>
            </div>

            {/* Lista de tarjetas horizontales de clientes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3">
              {topClients.map((client) => (
                <div
                  key={client.name}
                  className="rounded-2xl bg-[#0F1410] border border-white/5 p-3.5 space-y-2.5 hover:border-[#02531C]/50 transition-all group"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", client.badgeColor)} />
                      <p className="text-xs font-bold text-white group-hover:text-[#F2AC00] transition">
                        {client.name}
                      </p>
                    </div>
                    <MoreVertical className="size-3.5 text-slate-500 cursor-pointer hover:text-white" />
                  </div>

                  <div className="flex items-baseline justify-between">
                    <p className="text-sm font-extrabold text-white">{client.total}</p>
                    <span className={cn(
                      "text-[10px] font-bold",
                      client.growth.startsWith("+") ? "text-[#10B981]" : "text-rose-400"
                    )}>
                      {client.growth}
                    </span>
                  </div>

                  {/* Stack de avatares */}
                  <div className="flex items-center justify-between pt-1">
                    <div className="flex -space-x-1.5">
                      {client.avatars.map((emoji, idx) => (
                        <div
                          key={idx}
                          className="grid size-6 place-items-center rounded-full bg-slate-800 border border-black text-xs shadow-sm"
                        >
                          {emoji}
                        </div>
                      ))}
                      <div className="grid size-6 place-items-center rounded-full bg-[#02531C] border border-black text-[9px] font-bold text-[#F2AC00]">
                        +
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-400">{client.subtitle}</span>
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
          <div className="rounded-3xl bg-[#090C0A] border border-white/10 p-5 space-y-4 shadow-xl relative overflow-hidden">
            {/* Glow sutil en verde esmeralda y oro */}
            <div className="absolute top-0 right-0 size-48 rounded-full bg-[#F2AC00]/15 blur-3xl pointer-events-none" />

            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-slate-400">Total Balance</p>
                <p className="text-[10px] text-slate-500">Across all connected accounts</p>
                <div className="flex items-baseline gap-2 mt-1">
                  <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-white">
                    {hideBalance ? "••••••••" : formattedBalance}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setHideBalance(!hideBalance)}
                    className="text-slate-400 hover:text-white transition"
                    aria-label="Toggle balance visibility"
                  >
                    {hideBalance ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Monthly avg: <span className="font-semibold text-white">$15,230 ↗</span>
                </p>
              </div>

              <div className="text-right space-y-1">
                <button
                  type="button"
                  onClick={() => setCurrencyView(currencyView === "USD" ? "HTG" : "USD")}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.05] border border-white/10 px-2.5 py-1 text-xs font-bold text-slate-200 hover:bg-white/10 transition"
                >
                  <span>{currencyView}</span>
                  <ChevronDown className="size-3 text-slate-400" />
                </button>
                <p className="text-[10px] text-slate-500">Compared to last month</p>
                <p className="text-xs font-bold text-rose-400">- 37.16 %</p>
              </div>
            </div>

            {/* ABANICO 3D DE TARJETAS SUPERPUESTAS (Fiel al mockup de Payx con colores Tcho-Tcho) */}
            <div className="relative pt-4 pb-2">
              <div className="relative h-48 w-full max-w-md mx-auto">
                {/* Tarjeta 3 (Fondo lejano) */}
                <div
                  onClick={() => setActiveCardIndex(2)}
                  className={cn(
                    "absolute top-0 right-2 w-[85%] h-44 rounded-2xl border border-white/10 p-4 transition-all duration-300 cursor-pointer shadow-lg opacity-40 hover:opacity-70",
                    cardsList[2].gradient
                  )}
                  style={{ transform: "rotate(6deg) translateY(-8px)" }}
                >
                  <div className="flex justify-end">
                    <Wifi className="size-4 text-white/50" />
                  </div>
                </div>

                {/* Tarjeta 2 (Intermedia) */}
                <div
                  onClick={() => setActiveCardIndex(1)}
                  className={cn(
                    "absolute top-1 right-5 w-[90%] h-44 rounded-2xl border border-white/10 p-4 transition-all duration-300 cursor-pointer shadow-xl opacity-75 hover:opacity-90",
                    cardsList[1].gradient
                  )}
                  style={{ transform: "rotate(3deg) translateY(-4px)" }}
                >
                  <div className="flex justify-end">
                    <Wifi className="size-4 text-white/70" />
                  </div>
                </div>

                {/* Tarjeta 1 (FRENTE - Principal) */}
                <div
                  className={cn(
                    "relative z-10 w-full h-44 rounded-2xl border border-white/15 p-4 shadow-2xl transition-all duration-300 flex flex-col justify-between overflow-hidden",
                    cardsList[activeCardIndex].gradient,
                    cardsList[activeCardIndex].accentGlow
                  )}
                >
                  {/* Textura de fondo con rejilla y logo */}
                  <div className="absolute -bottom-8 -right-8 size-36 rounded-full bg-white/[0.06] blur-xl pointer-events-none" />

                  {/* Header de la tarjeta */}
                  <div className="flex items-center justify-between relative z-10">
                    <div>
                      <p className="text-xs font-bold text-white tracking-wide">
                        {cardsList[activeCardIndex].title}
                      </p>
                      <p className="text-[10px] font-mono text-white/70">
                        {cardsList[activeCardIndex].accountMasked}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={cn("rounded-full bg-black/40 px-2 py-0.5 text-[9px] font-semibold text-white/90 border", cardsList[activeCardIndex].badgeBorder)}>
                        {cardsList[activeCardIndex].type}
                      </span>
                      <Wifi className="size-4 text-[#F2AC00]" />
                    </div>
                  </div>

                  {/* Saldo de la tarjeta */}
                  <div className="relative z-10 my-auto">
                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white/60">
                      Balance Amount
                    </p>
                    <p className="text-xl font-black text-white tracking-tight">
                      {cardsList[activeCardIndex].balance}
                    </p>
                  </div>

                  {/* Footer de la tarjeta con chip, masked number y logo */}
                  <div className="flex items-center justify-between relative z-10 pt-1">
                    <p className="font-mono text-xs text-white/80 tracking-widest">
                      {cardsList[activeCardIndex].masked}
                    </p>

                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono text-white/60">
                        {cardsList[activeCardIndex].expiry}
                      </span>
                      {/* Logo Mastercard / Visa en colores vivos */}
                      <div className="flex -space-x-2">
                        <div className="size-4 rounded-full bg-[#EB001B] opacity-90" />
                        <div className="size-4 rounded-full bg-[#F79E1B] opacity-90" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 BOTONES DE ACCIÓN RÁPIDA (Sent, Receive, Add Card, Exchange) */}
            <div className="grid grid-cols-4 gap-2 pt-2">
              <Link
                to="/enviar"
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#0F1410] border border-white/5 p-2.5 text-slate-300 hover:text-white hover:bg-[#02531C]/40 hover:border-[#F2AC00]/40 transition group"
              >
                <div className="grid size-8 place-items-center rounded-xl bg-white/[0.04] text-[#F2AC00] group-hover:scale-110 transition">
                  <Send className="size-3.5" />
                </div>
                <span className="text-[11px] font-semibold">Sent</span>
              </Link>

              <Link
                to="/enviar"
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#0F1410] border border-white/5 p-2.5 text-slate-300 hover:text-white hover:bg-[#02531C]/40 hover:border-[#F2AC00]/40 transition group"
              >
                <div className="grid size-8 place-items-center rounded-xl bg-white/[0.04] text-[#F2AC00] group-hover:scale-110 transition">
                  <Download className="size-3.5" />
                </div>
                <span className="text-[11px] font-semibold">Receive</span>
              </Link>

              <Link
                to="/perfil"
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#0F1410] border border-white/5 p-2.5 text-slate-300 hover:text-white hover:bg-[#02531C]/40 hover:border-[#F2AC00]/40 transition group"
              >
                <div className="grid size-8 place-items-center rounded-xl bg-white/[0.04] text-[#F2AC00] group-hover:scale-110 transition">
                  <CreditCard className="size-3.5" />
                </div>
                <span className="text-[11px] font-semibold">Add Card</span>
              </Link>

              <Link
                to="/recargas"
                className="flex flex-col items-center justify-center gap-1.5 rounded-2xl bg-[#0F1410] border border-white/5 p-2.5 text-slate-300 hover:text-white hover:bg-[#02531C]/40 hover:border-[#F2AC00]/40 transition group"
              >
                <div className="grid size-8 place-items-center rounded-xl bg-white/[0.04] text-[#F2AC00] group-hover:scale-110 transition">
                  <ArrowRightLeft className="size-3.5" />
                </div>
                <span className="text-[11px] font-semibold">Exchange</span>
              </Link>
            </div>
          </div>

          {/* RECENT TRANSACTIONS TABLE CARD */}
          <div className="rounded-3xl bg-[#090C0A] border border-white/10 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-white">Recent Transactions</h3>
                <p className="text-[11px] text-slate-400">Activity across cards and bank transfers</p>
              </div>

              {/* Botón de filtro de lista */}
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-xl bg-white/[0.04] border border-white/10 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition"
              >
                <ListFilter className="size-3 text-[#F2AC00]" />
                <span>List</span>
                <ChevronDown className="size-3 text-slate-400" />
              </button>
            </div>

            {/* Tabla interactiva */}
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/5 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="pb-2.5 font-bold">#</th>
                    <th className="pb-2.5 font-bold">Recipient</th>
                    <th className="pb-2.5 font-bold hidden sm:table-cell">Sender</th>
                    <th className="pb-2.5 font-bold hidden md:table-cell">Date</th>
                    <th className="pb-2.5 font-bold">Amount</th>
                    <th className="pb-2.5 font-bold">Status</th>
                    <th className="pb-2.5 font-bold text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {displayTransfers.map((tx) => (
                    <tr key={tx.id} className="group hover:bg-white/[0.02] transition-colors">
                      <td className="py-3 font-mono text-[11px] text-slate-500">{tx.id}</td>
                      <td className="py-3">
                        <p className="font-bold text-white group-hover:text-[#F2AC00] transition truncate max-w-[130px]">
                          {tx.recipient}
                        </p>
                        <p className="text-[10px] text-slate-500 sm:hidden">{tx.category} • {tx.date}</p>
                      </td>
                      <td className="py-3 text-slate-400 hidden sm:table-cell truncate max-w-[100px]">
                        {tx.sender}
                      </td>
                      <td className="py-3 text-slate-400 hidden md:table-cell font-mono text-[11px]">
                        {tx.date}
                      </td>
                      <td className="py-3 font-bold text-white font-mono">
                        {tx.amount}
                      </td>
                      <td className="py-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border",
                            tx.status === "Success"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : tx.status === "Failed"
                                ? "bg-rose-500/10 text-rose-400 border-rose-500/30"
                                : "bg-amber-500/10 text-amber-400 border-amber-500/30"
                          )}
                        >
                          {tx.status}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          to={tx.viewLink}
                          className="inline-flex items-center justify-center rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-1 text-[11px] font-semibold text-slate-300 hover:text-white hover:bg-white/10 transition"
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
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#F2AC00] hover:underline"
              >
                <span>View all transaction activity</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* =================================================================
            COLUMNA DERECHA (3 cols en desktop): SAAS & SERVICES SPENDING
            ================================================================= */}
        <div className="lg:col-span-3 space-y-6">
          <div className="rounded-3xl bg-[#090C0A] border border-white/10 p-5 space-y-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-white">SaaS Spending</h3>
                <p className="text-[11px] text-slate-400">Monthly auto-debits</p>
              </div>
              <span className="text-sm font-extrabold text-[#F2AC00]">$ 1,815 /mo</span>
            </div>

            {/* Lista de servicios activos */}
            <div className="space-y-2.5">
              {servicesList.map((svc) => (
                <div
                  key={svc.name}
                  className="flex items-center justify-between rounded-2xl bg-[#0F1410] border border-white/5 p-3 hover:border-white/15 transition group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-gradient-to-tr text-base shadow-md", svc.color)}>
                      {svc.icon}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-xs text-white truncate group-hover:text-[#F2AC00] transition">
                        {svc.name}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">{svc.provider}</p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="font-bold text-xs text-white">{svc.price}</p>
                    <p className={cn("text-[9px] font-medium", svc.urgent ? "text-[#F2AC00] font-bold" : "text-slate-500")}>
                      {svc.date}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <Button
              asChild
              variant="outline"
              className="w-full h-10 rounded-2xl border-white/10 bg-white/[0.04] text-xs font-semibold text-slate-200 hover:text-white hover:bg-white/[0.08]"
            >
              <Link to="/recargas">
                View all 12 services
              </Link>
            </Button>
          </div>

          {/* Quick Currency Rate Card Tcho-Tcho */}
          <div className="rounded-3xl bg-gradient-to-b from-[#0F1611] to-[#0A0D0B] border border-[#02531C]/40 p-4 space-y-3 shadow-xl relative overflow-hidden">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-white flex items-center gap-1.5">
                <Coins className="size-3.5 text-[#F2AC00]" />
                Live Exchange Rate
              </span>
              <span className="rounded-full bg-[#02531C] px-2 py-0.5 text-[9px] font-bold text-[#F2AC00]">
                Live
              </span>
            </div>

            <div className="rounded-xl bg-black/50 border border-white/5 p-3 space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">1 USD</span>
                <span className="font-bold text-white">≈ {rate?.rate ? `${Number(rate.rate).toFixed(2)} HTG` : "132.50 HTG"}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">1000 DOP</span>
                <span className="font-bold text-white">≈ 2,240.00 HTG</span>
              </div>
            </div>

            <Link
              to="/enviar"
              className="flex items-center justify-center gap-2 w-full h-9 rounded-xl bg-gradient-to-r from-[#02531C] to-[#046824] text-white font-bold text-xs shadow-md hover:scale-[1.02] active:scale-[0.98] transition border border-[#F2AC00]/30"
            >
              <Send className="size-3 text-[#F2AC00]" />
              <span>Send Money to Haiti Now</span>
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
