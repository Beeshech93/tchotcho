import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  TrendingUp,
  Coins,
  Users,
  Wallet,
  Calendar,
  Layers,
  ArrowUpRight,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  FileSpreadsheet,
  ChevronRight,
  Search,
  ExternalLink,
  ArrowRight,
  Info,
  UserCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, paymentLabel, deliveryLabel } from "@/lib/remesa";
import { Link } from "@tanstack/react-router";

type TransferRow = {
  id: string;
  reference: string;
  created_at: string;
  status: string;
  send_currency: string;
  receive_currency: string;
  amount_send: number;
  fee_send: number;
  total_send: number;
  amount_receive: number;
  agent_commission_send: number;
  recipient_name?: string | null;
  recipient_phone?: string | null;
  delivery_method?: string | null;
  payment_method?: string | null;
  origin_country?: string | null;
  destination_country?: string | null;
  note?: string | null;
  agent_id?: string | null;
  user_id?: string | null;
};

const PERIODS = [
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Último año" },
  { value: "all", label: "Todo el histórico" },
];

const COUNTED = ["paid", "processing", "ready_for_pickup", "completed"];

const CURRENCY_META: Record<string, { flag: string; name: string }> = {
  USD: { flag: "🇺🇸", name: "Dólar estadounidense" },
  MXN: { flag: "🇲🇽", name: "Peso mexicano" },
  DOP: { flag: "🇩🇴", name: "Peso dominicano" },
  HTG: { flag: "🇭🇹", name: "Gourde haitiano" },
  EUR: { flag: "🇪🇺", name: "Euro" },
  CAD: { flag: "🇨🇦", name: "Dólar canadiense" },
  BRL: { flag: "🇧🇷", name: "Real brasileño" },
  CLP: { flag: "🇨🇱", name: "Peso chileno" },
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function formatMonth(key: string) {
  const [year, month] = key.split("-");
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre",
  ];
  const idx = parseInt(month || "1", 10) - 1;
  return `${monthNames[idx] ?? month} ${year}`;
}

function formatShortDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("es-ES", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getStatusBadge(status: string) {
  switch (status) {
    case "completed":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs font-medium">
          Entregado
        </Badge>
      );
    case "paid":
      return (
        <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 text-xs font-medium">
          Pagado
        </Badge>
      );
    case "ready_for_pickup":
      return (
        <Badge className="bg-blue-500/15 text-blue-400 border-blue-500/30 text-xs font-medium">
          Listo retiro
        </Badge>
      );
    case "processing":
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs font-medium">
          En proceso
        </Badge>
      );
    case "awaiting_payment":
    case "created":
      return (
        <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 text-xs font-medium">
          Pendiente pago
        </Badge>
      );
    case "cancelled":
      return (
        <Badge className="bg-rose-500/15 text-rose-400 border-rose-500/30 text-xs font-medium">
          Cancelado
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-xs">
          {status}
        </Badge>
      );
  }
}

type DetailModalState = {
  isOpen: boolean;
  title: string;
  description: string;
  metricType?: "volume" | "fees" | "agents" | "net" | "currency" | "portfolio" | "month";
  filterFn: (row: TransferRow) => boolean;
  currencyBadge?: string;
};

export function AccountingPanel() {
  const [period, setPeriod] = useState("90");
  const [currency, setCurrency] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [modalState, setModalState] = useState<DetailModalState>({
    isOpen: false,
    title: "",
    description: "",
    filterFn: () => true,
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["accounting", period],
    queryFn: async () => {
      let q = supabase
        .from("transfers")
        .select(
          "id,reference,created_at,status,send_currency,receive_currency,amount_send,fee_send,total_send,amount_receive,agent_commission_send,recipient_name,recipient_phone,delivery_method,payment_method,note,agent_id,user_id",
        )
        .order("created_at", { ascending: false })
        .limit(5000);
      if (period !== "all") {
        const from = new Date(Date.now() - Number(period) * 86400000).toISOString();
        q = q.gte("created_at", from);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as TransferRow[];
    },
  });

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, phone")).data ?? [],
  });

  const profilesMap = useMemo(() => {
    return new Map((profiles ?? []).map((p) => [p.id, p]));
  }, [profiles]);

  const currencies = useMemo(
    () => Array.from(new Set(rows.map((r) => r.send_currency))).sort(),
    [rows],
  );

  const filtered = useMemo(
    () => rows.filter((r) => currency === "all" || r.send_currency === currency),
    [rows, currency],
  );

  const settled = useMemo(() => filtered.filter((r) => COUNTED.includes(r.status)), [filtered]);

  const byCurrency = useMemo(() => {
    const map = new Map<
      string,
      { currency: string; volume: number; fees: number; agent: number; net: number; count: number }
    >();
    for (const r of settled) {
      const c = map.get(r.send_currency) ?? {
        currency: r.send_currency,
        volume: 0,
        fees: 0,
        agent: 0,
        net: 0,
        count: 0,
      };
      c.volume += Number(r.amount_send || 0);
      c.fees += Number(r.fee_send || 0);
      c.agent += Number(r.agent_commission_send || 0);
      c.net = c.fees - c.agent;
      c.count += 1;
      map.set(r.send_currency, c);
    }
    return Array.from(map.values()).sort((a, b) => b.volume - a.volume);
  }, [settled]);

  const byMonth = useMemo(() => {
    const map = new Map<
      string,
      {
        month: string;
        currency: string;
        volume: number;
        fees: number;
        agent: number;
        net: number;
        count: number;
      }
    >();
    for (const r of settled) {
      const key = `${monthKey(r.created_at)}|${r.send_currency}`;
      const c = map.get(key) ?? {
        month: monthKey(r.created_at),
        currency: r.send_currency,
        volume: 0,
        fees: 0,
        agent: 0,
        net: 0,
        count: 0,
      };
      c.volume += Number(r.amount_send || 0);
      c.fees += Number(r.fee_send || 0);
      c.agent += Number(r.agent_commission_send || 0);
      c.net = c.fees - c.agent;
      c.count += 1;
      map.set(key, c);
    }
    return Array.from(map.values()).sort(
      (a, b) => b.month.localeCompare(a.month) || a.currency.localeCompare(b.currency),
    );
  }, [settled]);

  const pending = filtered.filter((r) => r.status === "awaiting_payment" || r.status === "created");
  const cancelled = filtered.filter((r) => r.status === "cancelled");
  const totalOps = filtered.length;
  const successRate = totalOps > 0 ? Math.round((settled.length / totalOps) * 100) : 100;

  // Totales acumulados para métricas superiores
  const totalVolumeFormatted = useMemo(() => {
    const first = byCurrency[0];
    if (!first) return "0.00";
    if (byCurrency.length === 1) return money(first.volume, first.currency);
    return byCurrency.map((c) => money(c.volume, c.currency)).join(" + ");
  }, [byCurrency]);

  const totalFeesFormatted = useMemo(() => {
    const first = byCurrency[0];
    if (!first) return "0.00";
    if (byCurrency.length === 1) return money(first.fees, first.currency);
    return byCurrency.map((c) => money(c.fees, c.currency)).join(" + ");
  }, [byCurrency]);

  const totalAgentFormatted = useMemo(() => {
    const first = byCurrency[0];
    if (!first) return "0.00";
    if (byCurrency.length === 1) return money(first.agent, first.currency);
    return byCurrency.map((c) => money(c.agent, c.currency)).join(" + ");
  }, [byCurrency]);

  const totalNetFormatted = useMemo(() => {
    const first = byCurrency[0];
    if (!first) return "0.00";
    if (byCurrency.length === 1) return money(first.net, first.currency);
    return byCurrency.map((c) => money(c.net, c.currency)).join(" + ");
  }, [byCurrency]);

  // Transacciones a mostrar en el modal activo
  const modalTransactions = useMemo(() => {
    if (!modalState.isOpen) return [];
    return filtered.filter(modalState.filterFn).filter((row) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return (
        row.reference.toLowerCase().includes(q) ||
        (row.recipient_name ?? "").toLowerCase().includes(q) ||
        (row.recipient_phone ?? "").toLowerCase().includes(q) ||
        row.send_currency.toLowerCase().includes(q)
      );
    });
  }, [filtered, modalState, searchQuery]);

  // Sumas del modal activo
  const modalTotals = useMemo(() => {
    let vol = 0;
    let fees = 0;
    let agent = 0;
    let net = 0;
    for (const r of modalTransactions) {
      if (COUNTED.includes(r.status)) {
        vol += Number(r.amount_send || 0);
        fees += Number(r.fee_send || 0);
        agent += Number(r.agent_commission_send || 0);
        net += Number(r.fee_send || 0) - Number(r.agent_commission_send || 0);
      }
    }
    return { vol, fees, agent, net, count: modalTransactions.length };
  }, [modalTransactions]);

  const exportCsv = () => {
    const head = "mes,moneda,operaciones,volumen,comisiones_brutas,comision_agentes,margen_neto\n";
    const body = byMonth
      .map((m) =>
        [
          m.month,
          m.currency,
          m.count,
          m.volume.toFixed(2),
          m.fees.toFixed(2),
          m.agent.toFixed(2),
          m.net.toFixed(2),
        ].join(","),
      )
      .join("\n");
    const url = URL.createObjectURL(new Blob([head + body], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte-financiero-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Barra de Filtros y Herramientas */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-white border-2 border-slate-200 shadow-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs font-black text-slate-700 uppercase tracking-wider mr-1">
            <Filter className="size-3.5 text-emerald-700" />
            Filtros
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] bg-slate-50 border-2 border-slate-200 font-bold text-slate-800 rounded-xl">
              <Clock className="size-3.5 mr-2 text-slate-500" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map((p) => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-[200px] bg-slate-50 border-2 border-slate-200 font-bold text-slate-800 rounded-xl">
              <span className="mr-2">🌐</span>
              <SelectValue placeholder="Todas las monedas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las monedas</SelectItem>
              {currencies.map((c) => (
                <SelectItem key={c} value={c}>
                  {CURRENCY_META[c]?.flag ?? "🌐"} {c} · {CURRENCY_META[c]?.name ?? c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          <Badge
            variant="outline"
            className="hidden sm:inline-flex border-2 border-emerald-300 text-emerald-800 bg-emerald-50 font-bold gap-1.5 py-1 rounded-xl"
          >
            <span className="size-2 rounded-full bg-emerald-600 animate-pulse" />
            En vivo
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-2 border-slate-200 bg-white hover:bg-slate-50 text-slate-800 font-bold shadow-2xs rounded-xl"
            onClick={exportCsv}
          >
            <Download className="size-4 text-emerald-700" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* 4 Tarjetas de Métricas Principales (KPIs) — CLICABLES */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Volumen */}
        <Card
          onClick={() => {
            setSearchQuery("");
            setModalState({
              isOpen: true,
              title: "Detalle: Volumen Bruto Procesado",
              description: "Todas las transferencias liquidadas en el periodo seleccionado.",
              metricType: "volume",
              filterFn: (r) => COUNTED.includes(r.status),
            });
          }}
          className="relative overflow-hidden bg-white border-2 border-slate-200 shadow-sm hover:border-emerald-500 hover:shadow-md cursor-pointer hover:translate-y-[-2px] transition-all group rounded-2xl"
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 border-2 border-emerald-200 group-hover:scale-105 transition-transform">
                <TrendingUp className="size-5" />
              </span>
              <span className="flex items-center gap-1 text-xs text-emerald-700 font-bold group-hover:translate-x-1 transition-transform">
                Ver detalle <ChevronRight className="size-3.5" />
              </span>
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
              Volumen Bruto Procesado
            </p>
            <p className="mt-1 font-display text-2xl font-black tracking-tight text-slate-900">
              {isLoading ? "…" : byCurrency.length === 0 ? "0.00" : totalVolumeFormatted}
            </p>
            <p className="mt-1.5 text-xs text-slate-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="size-3.5 text-emerald-700" />
              {settled.length} operaciones liquidadas
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Ingresos por Comisión */}
        <Card
          onClick={() => {
            setSearchQuery("");
            setModalState({
              isOpen: true,
              title: "Detalle: Ingresos por Comisión",
              description: "Comisiones cobradas al remitente por el servicio de transferencia.",
              metricType: "fees",
              filterFn: (r) => COUNTED.includes(r.status),
            });
          }}
          className="relative overflow-hidden bg-white border-2 border-slate-200 shadow-sm hover:border-amber-500 hover:shadow-md cursor-pointer hover:translate-y-[-2px] transition-all group rounded-2xl"
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 border-2 border-amber-200 group-hover:scale-105 transition-transform">
                <Coins className="size-5" />
              </span>
              <span className="flex items-center gap-1 text-xs text-amber-700 font-bold group-hover:translate-x-1 transition-transform">
                Ver detalle <ChevronRight className="size-3.5" />
              </span>
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
              Ingresos por Comisión
            </p>
            <p className="mt-1 font-display text-2xl font-black tracking-tight text-slate-900">
              {isLoading ? "…" : byCurrency.length === 0 ? "0.00" : totalFeesFormatted}
            </p>
            <p className="mt-1.5 text-xs text-slate-600 font-medium flex items-center gap-1">
              <ArrowUpRight className="size-3.5 text-amber-700" />
              Comisiones brutas recaudadas
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Comisión de Agentes */}
        <Card
          onClick={() => {
            setSearchQuery("");
            setModalState({
              isOpen: true,
              title: "Detalle: Comisiones de Red y Agentes",
              description: "Costos de comisión pagados o acreditados a la red de agencias.",
              metricType: "agents",
              filterFn: (r) =>
                COUNTED.includes(r.status) && Number(r.agent_commission_send || 0) > 0,
            });
          }}
          className="relative overflow-hidden bg-white border-2 border-slate-200 shadow-sm hover:border-blue-500 hover:shadow-md cursor-pointer hover:translate-y-[-2px] transition-all group rounded-2xl"
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700 border-2 border-blue-200 group-hover:scale-105 transition-transform">
                <Users className="size-5" />
              </span>
              <span className="flex items-center gap-1 text-xs text-blue-700 font-bold group-hover:translate-x-1 transition-transform">
                Ver detalle <ChevronRight className="size-3.5" />
              </span>
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-slate-500">
              Comisiones de Agentes
            </p>
            <p className="mt-1 font-display text-2xl font-black tracking-tight text-slate-900">
              {isLoading ? "…" : byCurrency.length === 0 ? "0.00" : totalAgentFormatted}
            </p>
            <p className="mt-1.5 text-xs text-slate-600 font-medium flex items-center gap-1">
              <Users className="size-3.5 text-blue-700" />
              Gastos de la red de entrega
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Beneficio Neto */}
        <Card
          onClick={() => {
            setSearchQuery("");
            setModalState({
              isOpen: true,
              title: "Detalle: Beneficio Neto de Plataforma",
              description:
                "Ganancia líquida resultante tras descontar los costos de agentes de las comisiones.",
              metricType: "net",
              filterFn: (r) => COUNTED.includes(r.status),
            });
          }}
          className="relative overflow-hidden bg-emerald-50/70 border-2 border-emerald-300 shadow-sm hover:border-emerald-600 hover:shadow-md cursor-pointer hover:translate-y-[-2px] transition-all group rounded-2xl"
        >
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-100 text-emerald-800 border-2 border-emerald-300 group-hover:scale-105 transition-transform">
                <Wallet className="size-5" />
              </span>
              <Badge className="bg-emerald-600 text-white border-transparent text-xs font-black flex items-center gap-1 px-2.5 py-0.5 rounded-full shadow-2xs">
                Neto <ChevronRight className="size-3" />
              </Badge>
            </div>
            <p className="mt-4 text-[11px] font-black uppercase tracking-wider text-emerald-900">
              Beneficio Neto de Plataforma
            </p>
            <p className="mt-1 font-display text-2xl font-black tracking-tight text-emerald-800">
              {isLoading ? "…" : byCurrency.length === 0 ? "0.00" : totalNetFormatted}
            </p>
            <p className="mt-1.5 text-xs text-emerald-800/80 font-medium">
              Margen neto (Comisiones - Agentes)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sección Media: Rendimiento por Moneda + Estado de Cartera */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Tabla Rendimiento por Moneda — FILAS CLICABLES */}
        <Card className="lg:col-span-2 border-2 border-slate-200 bg-white shadow-sm rounded-2xl">
          <CardHeader className="flex flex-row items-center justify-between border-b border-slate-200 pb-4">
            <div>
              <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900">
                <Layers className="size-4 text-emerald-700" />
                Rendimiento por Moneda
              </CardTitle>
              <CardDescription className="text-xs text-slate-600 font-medium mt-0.5">
                Haz clic sobre cualquier divisa para ver todas sus transacciones detalladas
              </CardDescription>
            </div>
            {byCurrency.length > 0 && (
              <Badge variant="outline" className="text-xs border-2 border-slate-200 text-slate-800 font-bold bg-slate-50">
                {byCurrency.length} {byCurrency.length === 1 ? "divisa" : "divisas"}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {byCurrency.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wider text-slate-700 font-black">
                    <tr>
                      <th className="px-5 py-3 text-left">Divisa</th>
                      <th className="px-4 py-3 text-right">Operaciones</th>
                      <th className="px-4 py-3 text-right">Volumen</th>
                      <th className="px-4 py-3 text-right">Comisiones</th>
                      <th className="px-4 py-3 text-right">Agentes</th>
                      <th className="px-5 py-3 text-right">Margen Neto</th>
                      <th className="w-8 py-3 pr-4"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {byCurrency.map((c) => {
                      const meta = CURRENCY_META[c.currency];
                      return (
                        <tr
                          key={c.currency}
                          onClick={() => {
                            setSearchQuery("");
                            setModalState({
                              isOpen: true,
                              title: `Auditoría Detallada · ${c.currency} (${meta?.name ?? c.currency})`,
                              description: `Todas las operaciones registradas en ${c.currency} durante este periodo.`,
                              metricType: "currency",
                              currencyBadge: c.currency,
                              filterFn: (r) => r.send_currency === c.currency,
                            });
                          }}
                          className="hover:bg-slate-50 transition-colors cursor-pointer group"
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-lg group-hover:scale-110 transition-transform">
                                {meta?.flag ?? "🌐"}
                              </span>
                              <div>
                                <span className="font-extrabold text-slate-900 tracking-wide group-hover:text-emerald-700 transition-colors">
                                  {c.currency}
                                </span>
                                <span className="block text-[11px] text-slate-500 font-medium">
                                  {meta?.name ?? "Internacional"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-slate-800">
                            {c.count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black text-slate-900 tabular-nums">
                            {money(c.volume, c.currency)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-amber-700 tabular-nums">
                            {money(c.fees, c.currency)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-bold text-blue-700 tabular-nums">
                            {money(c.agent, c.currency)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-black text-emerald-700 tabular-nums">
                            {money(c.net, c.currency)}
                          </td>
                          <td className="py-3.5 pr-4 text-slate-400 group-hover:text-slate-900 transition-colors">
                            <ChevronRight className="size-4" />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-10 text-center space-y-3">
                <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-500 border border-slate-200">
                  <FileSpreadsheet className="size-6 text-slate-500" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 text-sm">
                    Aún no hay operaciones liquidadas en este periodo
                  </p>
                  <p className="text-xs text-slate-600 max-w-sm font-medium">
                    Las transacciones completadas o pagadas aparecerán desglosadas por moneda
                    automáticamente.
                  </p>
                </div>
                {period !== "all" && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs text-emerald-700 font-bold underline"
                    onClick={() => setPeriod("all")}
                  >
                    Ver todo el histórico
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estado de la Cartera — ITEMS CLICABLES */}
        <Card className="border-2 border-slate-200 bg-white shadow-sm rounded-2xl flex flex-col justify-between">
          <div>
            <CardHeader className="border-b border-slate-200 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-black text-slate-900 flex items-center gap-2">
                  <Wallet className="size-4 text-emerald-700" />
                  Estado de la Cartera
                </CardTitle>
                <Badge variant="outline" className="text-xs border-2 border-emerald-200 bg-emerald-50 text-emerald-800 font-bold">
                  {successRate}% efectividad
                </Badge>
              </div>
              <CardDescription className="text-xs text-slate-600 font-medium mt-0.5">
                Haz clic en cada categoría para auditar sus envíos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Barra de Distribución Visual */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-semibold text-slate-600">
                  <span>Balance de estados</span>
                  <span>{totalOps} en total</span>
                </div>
                <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-slate-200">
                  <div
                    className="bg-emerald-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalOps > 0 ? (settled.length / totalOps) * 100 : 0}%` }}
                    title={`Liquidados: ${settled.length}`}
                  />
                  <div
                    className="bg-amber-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalOps > 0 ? (pending.length / totalOps) * 100 : 0}%` }}
                    title={`Pendientes: ${pending.length}`}
                  />
                  <div
                    className="bg-rose-500 rounded-full transition-all duration-500"
                    style={{ width: `${totalOps > 0 ? (cancelled.length / totalOps) * 100 : 0}%` }}
                    title={`Cancelados: ${cancelled.length}`}
                  />
                </div>
              </div>

              {/* Lista Detallada de Estados (Clicables) */}
              <div className="space-y-2.5 pt-2">
                {/* 1. Liquidados */}
                <div
                  onClick={() => {
                    setSearchQuery("");
                    setModalState({
                      isOpen: true,
                      title: "Envíos Liquidados (Completados / Pagados)",
                      description:
                        "Operaciones cuyo pago fue confirmado o que ya fueron entregadas al beneficiario.",
                      metricType: "portfolio",
                      filterFn: (r) => COUNTED.includes(r.status),
                    });
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border-2 border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/50 cursor-pointer transition-all group shadow-2xs"
                >
                  <span className="flex items-center gap-2.5 text-xs text-slate-800 font-bold group-hover:text-emerald-800 transition-colors">
                    <span className="size-2.5 rounded-full bg-emerald-500 shadow-xs" />
                    Envíos Liquidados
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-emerald-50 text-emerald-800 border-2 border-emerald-200 font-black text-xs"
                    >
                      {settled.length}
                    </Badge>
                    <span className="text-[11px] font-bold text-slate-500 w-10 text-right">
                      {totalOps > 0 ? `${Math.round((settled.length / totalOps) * 100)}%` : "0%"}
                    </span>
                    <ChevronRight className="size-3.5 text-slate-400 group-hover:text-slate-900 transition-colors" />
                  </div>
                </div>

                {/* 2. Pendientes */}
                <div
                  onClick={() => {
                    setSearchQuery("");
                    setModalState({
                      isOpen: true,
                      title: "Envíos Pendientes de Pago",
                      description:
                        "Órdenes creadas a la espera de confirmación de pago (OXXO, SPEI, o Stripe).",
                      metricType: "portfolio",
                      filterFn: (r) => r.status === "awaiting_payment" || r.status === "created",
                    });
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border-2 border-slate-200 hover:border-amber-500 hover:bg-amber-50/50 cursor-pointer transition-all group shadow-2xs"
                >
                  <span className="flex items-center gap-2.5 text-xs text-slate-800 font-bold group-hover:text-amber-800 transition-colors">
                    <span className="size-2.5 rounded-full bg-amber-500 shadow-xs" />
                    Pendientes de pago
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-amber-50 text-amber-800 border-2 border-amber-200 font-black text-xs"
                    >
                      {pending.length}
                    </Badge>
                    <span className="text-[11px] font-bold text-slate-500 w-10 text-right">
                      {totalOps > 0 ? `${Math.round((pending.length / totalOps) * 100)}%` : "0%"}
                    </span>
                    <ChevronRight className="size-3.5 text-slate-400 group-hover:text-slate-900 transition-colors" />
                  </div>
                </div>

                {/* 3. Cancelados */}
                <div
                  onClick={() => {
                    setSearchQuery("");
                    setModalState({
                      isOpen: true,
                      title: "Envíos Cancelados o Expirados",
                      description:
                        "Operaciones canceladas por el usuario, rechazadas por el banco o expiradas.",
                      metricType: "portfolio",
                      filterFn: (r) => r.status === "cancelled",
                    });
                  }}
                  className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border-2 border-slate-200 hover:border-rose-500 hover:bg-rose-50/50 cursor-pointer transition-all group shadow-2xs"
                >
                  <span className="flex items-center gap-2.5 text-xs text-slate-800 font-bold group-hover:text-rose-800 transition-colors">
                    <span className="size-2.5 rounded-full bg-rose-500 shadow-xs" />
                    Cancelados / Expirados
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className="bg-rose-50 text-rose-800 border-2 border-rose-200 font-black text-xs"
                    >
                      {cancelled.length}
                    </Badge>
                    <span className="text-[11px] font-bold text-slate-500 w-10 text-right">
                      {totalOps > 0 ? `${Math.round((cancelled.length / totalOps) * 100)}%` : "0%"}
                    </span>
                    <ChevronRight className="size-3.5 text-slate-400 group-hover:text-slate-900 transition-colors" />
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="p-4 border-t-2 border-slate-200 bg-slate-50/80 rounded-b-2xl">
            <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
              💡 <strong>Criterio de liquidación:</strong> Envíos pagados, en proceso, listos para
              retiro y completados.
            </p>
          </div>
        </Card>
      </div>

      {/* Sección Inferior: Libro Contable Mensual — FILAS CLICABLES */}
      <Card className="border-2 border-slate-200 bg-white shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="flex flex-row items-center justify-between border-b-2 border-slate-200 pb-4 bg-slate-50/50">
          <div>
            <CardTitle className="text-base font-black flex items-center gap-2 text-slate-900">
              <Calendar className="size-4 text-emerald-700" />
              Libro Contable Mensual
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 font-medium mt-0.5">
              Haz clic sobre cualquier cierre mensual para auditar todas sus transferencias
              individuales
            </CardDescription>
          </div>
          {byMonth.length > 0 && (
            <Badge variant="outline" className="text-xs border-2 border-slate-200 bg-white font-bold text-slate-800">
              {byMonth.length} {byMonth.length === 1 ? "cierre" : "cierres"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {byMonth.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b-2 border-slate-200 bg-slate-100 text-[11px] uppercase tracking-wider text-slate-700 font-black">
                  <tr>
                    <th className="px-5 py-3 text-left">Periodo</th>
                    <th className="px-4 py-3 text-left">Divisa</th>
                    <th className="px-4 py-3 text-right">Operaciones</th>
                    <th className="px-4 py-3 text-right">Volumen</th>
                    <th className="px-4 py-3 text-right">Comisiones</th>
                    <th className="px-4 py-3 text-right">Agentes</th>
                    <th className="px-5 py-3 text-right">Margen Neto</th>
                    <th className="w-8 py-3 pr-4"></th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-100">
                  {byMonth.map((m) => {
                    const meta = CURRENCY_META[m.currency];
                    return (
                      <tr
                        key={m.month + m.currency}
                        onClick={() => {
                          setSearchQuery("");
                          setModalState({
                            isOpen: true,
                            title: `Cierre Contable: ${formatMonth(m.month)} · ${m.currency}`,
                            description: `Detalle de transacciones liquidadas durante ${formatMonth(m.month)} en ${m.currency}.`,
                            metricType: "month",
                            currencyBadge: m.currency,
                            filterFn: (r) =>
                              monthKey(r.created_at) === m.month &&
                              r.send_currency === m.currency &&
                              COUNTED.includes(r.status),
                          });
                        }}
                        className="hover:bg-slate-50 transition-colors cursor-pointer group"
                      >
                        <td className="px-5 py-3.5 font-bold text-slate-900">
                          <Badge
                            variant="secondary"
                            className="font-bold text-xs py-0.5 bg-slate-100 text-slate-800 border border-slate-200 group-hover:border-emerald-500 transition-colors"
                          >
                            {formatMonth(m.month)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 font-extrabold text-slate-900">
                            <span>{meta?.flag ?? "🌐"}</span> {m.currency}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-slate-700">
                          {m.count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right font-black text-slate-900 tabular-nums">
                          {money(m.volume, m.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-amber-700 tabular-nums">
                          {money(m.fees, m.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-bold text-blue-700 tabular-nums">
                          {money(m.agent, m.currency)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-black text-emerald-700 tabular-nums">
                          +{money(m.net, m.currency)}
                        </td>
                        <td className="py-3.5 pr-4 text-slate-400 group-hover:text-slate-900 transition-colors">
                          <ChevronRight className="size-4" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 border-2 border-slate-200">
                <Calendar className="size-6 text-slate-500" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-slate-800 text-sm">
                  Sin movimientos contables en este periodo
                </p>
                <p className="text-xs text-slate-500 max-w-sm font-medium">
                  Al completar transferencias se generará el balance mensual consolidado con sus
                  márgenes netos.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* MODAL / DRAWER INTERACTIVO CON DETALLES COMPLETOS */}
      <Dialog
        open={modalState.isOpen}
        onOpenChange={(open) => setModalState((prev) => ({ ...prev, isOpen: open }))}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0 border-2 border-slate-200 bg-white shadow-2xl rounded-3xl text-slate-900">
          <DialogHeader className="p-6 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Layers className="size-5 text-emerald-700" />
                  {modalState.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-600 font-medium mt-1">
                  {modalState.description}
                </DialogDescription>
              </div>
              {modalState.currencyBadge && (
                <Badge className="bg-emerald-50 text-emerald-800 border-2 border-emerald-300 text-sm font-black px-3 py-1 rounded-xl">
                  {CURRENCY_META[modalState.currencyBadge]?.flag ?? "🌐"} {modalState.currencyBadge}
                </Badge>
              )}
            </div>

            {/* Resumen rápido del modal */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-4 pt-3 border-t border-slate-200">
              <div className="p-3 rounded-2xl bg-white border-2 border-slate-200 shadow-2xs">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                  Total Registros
                </span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  {modalTotals.count}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-white border-2 border-slate-200 shadow-2xs">
                <span className="text-[10px] uppercase tracking-wider text-slate-500 font-bold block">
                  Volumen Liquidadas
                </span>
                <span className="text-lg font-black text-slate-900 mt-0.5 block">
                  {modalTotals.vol.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-amber-50/80 border-2 border-amber-200 shadow-2xs">
                <span className="text-[10px] uppercase tracking-wider text-amber-800 font-bold block">
                  Comisiones Brutas
                </span>
                <span className="text-lg font-black text-amber-800 mt-0.5 block">
                  {modalTotals.fees.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50/80 border-2 border-emerald-200 shadow-2xs">
                <span className="text-[10px] uppercase tracking-wider text-emerald-800 font-bold block">
                  Ganancia Neta
                </span>
                <span className="text-lg font-black text-emerald-800 mt-0.5 block">
                  {modalTotals.net.toLocaleString(undefined, {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </span>
              </div>
            </div>

            {/* Buscador interno */}
            <div className="relative mt-3">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <Input
                placeholder="Buscar por referencia (RH-...), nombre o teléfono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-white border-2 border-slate-300 text-slate-900 text-xs rounded-xl font-medium"
              />
            </div>
          </DialogHeader>

          {/* Lista de Transacciones Detalladas */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-slate-50/50">
            {modalTransactions.length > 0 ? (
              <div className="space-y-2.5">
                {modalTransactions.map((tx) => {
                  const agentId = tx.agent_id || (tx.payment_method === "cash_agent" ? tx.user_id : null);
                  const agentProfile = agentId ? profilesMap.get(agentId) : null;
                  const agentName = agentProfile?.full_name || agentProfile?.phone || (agentId ? "Agente autorizado" : null);

                  return (
                  <div
                    key={tx.id}
                    className="p-4 rounded-2xl bg-white border-2 border-slate-200 hover:border-slate-300 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-black text-slate-900 text-sm">
                          {tx.reference}
                        </span>
                        {getStatusBadge(tx.status)}
                        {agentName && (
                          <Badge className="bg-emerald-50 text-emerald-800 border-2 border-emerald-200 text-[10px] font-bold gap-1 py-0 px-2 shadow-2xs">
                            <UserCheck className="size-3 text-emerald-700" />
                            Agente: {agentName}
                          </Badge>
                        )}
                        <span className="text-[11px] text-slate-500 font-semibold">
                          {formatShortDate(tx.created_at)}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-600 pt-0.5">
                        <span>
                          Destinatario:{" "}
                          <strong className="text-slate-900 font-bold">
                            {tx.recipient_name || "Sin nombre"}
                          </strong>
                        </span>
                        {tx.recipient_phone && (
                          <span>
                            Tel: <strong className="text-slate-800 font-bold">{tx.recipient_phone}</strong>
                          </span>
                        )}
                        <span>
                          Entrega:{" "}
                          <strong className="text-slate-800 font-bold">
                            {deliveryLabel(tx.delivery_method || "")}
                          </strong>
                        </span>
                        <span>
                          Pago:{" "}
                          <strong className="text-slate-800 font-bold">
                            {paymentLabel(tx.payment_method || "")}
                          </strong>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center sm:items-end justify-between sm:justify-start sm:flex-col gap-1 shrink-0 pt-2 sm:pt-0 border-t sm:border-0 border-slate-200">
                      <div className="text-right">
                        <span className="text-sm font-black text-slate-900 block tabular-nums">
                          {money(tx.amount_send, tx.send_currency)}
                        </span>
                        <span className="text-[11px] text-slate-500 font-medium block">
                          Comisión: {money(tx.fee_send, tx.send_currency)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-black text-emerald-700">
                          Neto: +
                          {money(
                            Number(tx.fee_send || 0) - Number(tx.agent_commission_send || 0),
                            tx.send_currency,
                          )}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-1.5 text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 gap-1 rounded-lg"
                          asChild
                        >
                          <Link to="/transferencia/$id" params={{ id: tx.id }} target="_blank">
                            <ExternalLink className="size-3" />
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 text-center space-y-2">
                <Info className="size-8 text-slate-400" />
                <p className="font-bold text-slate-800 text-sm">No se encontraron operaciones</p>
                <p className="text-xs text-slate-500 font-medium">
                  {searchQuery
                    ? "Intenta con otro término de búsqueda."
                    : "No hay transacciones asociadas a este criterio en el rango de fechas actual."}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
