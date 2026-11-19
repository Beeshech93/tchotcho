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
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money } from "@/lib/remesa";

type Row = {
  created_at: string;
  status: string;
  send_currency: string;
  receive_currency: string;
  amount_send: number;
  fee_send: number;
  total_send: number;
  amount_receive: number;
  agent_commission_send: number;
};

const PERIODS = [
  { value: "30", label: "Últimos 30 días" },
  { value: "90", label: "Últimos 90 días" },
  { value: "365", label: "Último año" },
  { value: "all", label: "Todo el histórico" },
];

const COUNTED = ["paid", "processing", "ready_for_pickup", "completed"];

const CURRENCY_META: Record<string, { flag: string; name: string }> = {
  USD: { flag: "🇺🇸", name: "Dólar (USD)" },
  MXN: { flag: "🇲🇽", name: "Peso Mexicano (MXN)" },
  DOP: { flag: "🇩🇴", name: "Peso Dominicano (DOP)" },
  HTG: { flag: "🇭🇹", name: "Gourde Haitiano (HTG)" },
  EUR: { flag: "🇪🇺", name: "Euro (EUR)" },
  CAD: { flag: "🇨🇦", name: "Dólar Canadiense (CAD)" },
  BRL: { flag: "🇧🇷", name: "Real Brasileño (BRL)" },
  CLP: { flag: "🇨🇱", name: "Peso Chileno (CLP)" },
};

function monthKey(iso: string) {
  return iso.slice(0, 7);
}

function formatMonth(key: string) {
  const [year, month] = key.split("-");
  const monthNames = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"
  ];
  const idx = parseInt(month || "1", 10) - 1;
  return `${monthNames[idx] ?? month} ${year}`;
}

export function AccountingPanel() {
  const [period, setPeriod] = useState("90");
  const [currency, setCurrency] = useState("all");

  const { data: rows = [], isLoading, refetch } = useQuery({
    queryKey: ["accounting", period],
    queryFn: async () => {
      let q = supabase
        .from("transfers")
        .select(
          "created_at,status,send_currency,receive_currency,amount_send,fee_send,total_send,amount_receive,agent_commission_send",
        )
        .order("created_at", { ascending: false })
        .limit(5000);
      if (period !== "all") {
        const from = new Date(Date.now() - Number(period) * 86400000).toISOString();
        q = q.gte("created_at", from);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-card/60 border border-white/5 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-1">
            <Filter className="size-3.5 text-primary" />
            Filtros
          </div>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] bg-background/80 border-white/10 font-medium">
              <Clock className="size-3.5 mr-2 text-muted-foreground" />
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
            <SelectTrigger className="w-[200px] bg-background/80 border-white/10 font-medium">
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
          <Badge variant="outline" className="hidden sm:inline-flex border-emerald-500/30 text-emerald-400 bg-emerald-500/10 gap-1.5 py-1">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            En vivo
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-white/10 bg-background/80 hover:bg-secondary font-medium"
            onClick={exportCsv}
          >
            <Download className="size-4 text-primary" /> Exportar CSV
          </Button>
        </div>
      </div>

      {/* 4 Tarjetas de Métricas Principales (KPIs) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden bg-gradient-to-br from-[#121820] to-[#0D1117] border-white/10 shadow-lg">
          <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-emerald-500/10 blur-2xl" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                <TrendingUp className="size-5" />
              </span>
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 text-xs font-medium">
                {settled.length} ops
              </Badge>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Volumen Bruto Procesado
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-white">
              {isLoading ? "…" : byCurrency.length === 0 ? "0.00" : totalVolumeFormatted}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
              <CheckCircle2 className="size-3 text-emerald-400" />
              Total liquidado en el periodo
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-[#121820] to-[#0D1117] border-white/10 shadow-lg">
          <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-amber-500/10 blur-2xl" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400 border border-amber-500/30">
                <Coins className="size-5" />
              </span>
              <Badge variant="outline" className="border-amber-500/30 text-amber-400 text-xs font-medium">
                Ingresos
              </Badge>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Ingresos por Comisión
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-white">
              {isLoading ? "…" : byCurrency.length === 0 ? "0.00" : totalFeesFormatted}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
              <ArrowUpRight className="size-3 text-amber-400" />
              Comisiones brutas cobradas
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-[#121820] to-[#0D1117] border-white/10 shadow-lg">
          <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-blue-500/10 blur-2xl" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <Users className="size-5" />
              </span>
              <Badge variant="outline" className="border-blue-500/30 text-blue-400 text-xs font-medium">
                Red
              </Badge>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Comisiones de Agentes
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-white">
              {isLoading ? "…" : byCurrency.length === 0 ? "0.00" : totalAgentFormatted}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground flex items-center gap-1">
              <Users className="size-3 text-blue-400" />
              Costo pagado a red de agencias
            </p>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-[#0F1E16] to-[#0D1117] border-emerald-500/25 shadow-lg">
          <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-emerald-500/20 blur-2xl" />
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                <Wallet className="size-5" />
              </span>
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-bold">
                Margen Neto
              </Badge>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Beneficio Neto de Plataforma
            </p>
            <p className="mt-1 font-display text-2xl font-bold tracking-tight text-emerald-400">
              {isLoading ? "…" : byCurrency.length === 0 ? "0.00" : totalNetFormatted}
            </p>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Ganancia neta (Comisiones - Agentes)
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Sección Media: Resultado por Moneda + Estado de Cartera */}
      <div className="grid gap-5 lg:grid-cols-3">
        {/* Tabla Resultado por Moneda */}
        <Card className="lg:col-span-2 border-white/10 bg-card/80 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
                <Layers className="size-4 text-primary" />
                Rendimiento por Moneda
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                Volumen y comisiones discriminadas por divisa de origen
              </CardDescription>
            </div>
            {byCurrency.length > 0 && (
              <Badge variant="outline" className="text-xs border-white/10">
                {byCurrency.length} {byCurrency.length === 1 ? "divisa" : "divisas"}
              </Badge>
            )}
          </CardHeader>
          <CardContent className="p-0">
            {byCurrency.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-white/5 bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-5 py-3 text-left">Divisa</th>
                      <th className="px-4 py-3 text-right">Operaciones</th>
                      <th className="px-4 py-3 text-right">Volumen</th>
                      <th className="px-4 py-3 text-right">Comisiones</th>
                      <th className="px-4 py-3 text-right">Agentes</th>
                      <th className="px-5 py-3 text-right">Margen Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {byCurrency.map((c) => {
                      const meta = CURRENCY_META[c.currency];
                      return (
                        <tr key={c.currency} className="hover:bg-white/[0.02] transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-base">{meta?.flag ?? "🌐"}</span>
                              <div>
                                <span className="font-bold text-white tracking-wide">{c.currency}</span>
                                <span className="block text-[11px] text-muted-foreground">
                                  {meta?.name ?? "Internacional"}
                                </span>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-slate-300">
                            {c.count.toLocaleString()}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold text-white tabular-nums">
                            {money(c.volume, c.currency)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-amber-400 tabular-nums">
                            {money(c.fees, c.currency)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-medium text-blue-400 tabular-nums">
                            {money(c.agent, c.currency)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-400 tabular-nums">
                            {money(c.net, c.currency)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center p-10 text-center space-y-3">
                <div className="size-12 rounded-2xl bg-secondary/60 flex items-center justify-center text-muted-foreground border border-white/5">
                  <FileSpreadsheet className="size-6 text-slate-400" />
                </div>
                <div className="space-y-1">
                  <p className="font-semibold text-white text-sm">Aún no hay operaciones liquidadas en este periodo</p>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Las transacciones completadas o pagadas aparecerán desglosadas por moneda automáticamente.
                  </p>
                </div>
                {period !== "all" && (
                  <Button variant="ghost" size="sm" className="text-xs text-primary underline" onClick={() => setPeriod("all")}>
                    Ver todo el histórico
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Estado de la Cartera */}
        <Card className="border-white/10 bg-card/80 shadow-md flex flex-col justify-between">
          <div>
            <CardHeader className="border-b border-white/5 pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-bold text-white flex items-center gap-2">
                  <Wallet className="size-4 text-emerald-400" />
                  Estado de la Cartera
                </CardTitle>
                <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-400">
                  {successRate}% efectividad
                </Badge>
              </div>
              <CardDescription className="text-xs mt-0.5">
                Distribución y ciclo de vida de los envíos
              </CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              {/* Barra de Distribución Visual */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Balance de estados</span>
                  <span>{totalOps} en total</span>
                </div>
                <div className="h-2.5 w-full bg-secondary/80 rounded-full overflow-hidden flex gap-0.5 p-0.5 border border-white/5">
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

              {/* Lista Detallada de Estados */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                    <span className="size-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500" />
                    Envíos Liquidados
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-bold text-xs">
                      {settled.length}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground w-10 text-right">
                      {totalOps > 0 ? `${Math.round((settled.length / totalOps) * 100)}%` : "0%"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                    <span className="size-2 rounded-full bg-amber-500 shadow-sm shadow-amber-500" />
                    Pendientes de pago
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-amber-500/10 text-amber-400 border-amber-500/20 font-bold text-xs">
                      {pending.length}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground w-10 text-right">
                      {totalOps > 0 ? `${Math.round((pending.length / totalOps) * 100)}%` : "0%"}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                  <span className="flex items-center gap-2.5 text-xs text-slate-300 font-medium">
                    <span className="size-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
                    Cancelados / Expirados
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="bg-rose-500/10 text-rose-400 border-rose-500/20 font-bold text-xs">
                      {cancelled.length}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground w-10 text-right">
                      {totalOps > 0 ? `${Math.round((cancelled.length / totalOps) * 100)}%` : "0%"}
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
          <div className="p-4 border-t border-white/5 bg-secondary/20 rounded-b-xl">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              💡 <strong>Criterio de liquidación:</strong> Envíos pagados, en proceso, listos para retiro y completados.
            </p>
          </div>
        </Card>
      </div>

      {/* Sección Inferior: Libro Contable Mensual */}
      <Card className="border-white/10 bg-card/80 shadow-md">
        <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2 text-white">
              <Calendar className="size-4 text-primary" />
              Libro Contable Mensual
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Historial cronológico de facturación, comisiones y costos por periodo mensual
            </CardDescription>
          </div>
          {byMonth.length > 0 && (
            <Badge variant="outline" className="text-xs border-white/10">
              {byMonth.length} {byMonth.length === 1 ? "cierre" : "cierres"}
            </Badge>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {byMonth.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-white/5 bg-secondary/40 text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                  <tr>
                    <th className="px-5 py-3 text-left">Periodo</th>
                    <th className="px-4 py-3 text-left">Divisa</th>
                    <th className="px-4 py-3 text-right">Operaciones</th>
                    <th className="px-4 py-3 text-right">Volumen</th>
                    <th className="px-4 py-3 text-right">Comisiones</th>
                    <th className="px-4 py-3 text-right">Agentes</th>
                    <th className="px-5 py-3 text-right">Margen Neto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {byMonth.map((m) => {
                    const meta = CURRENCY_META[m.currency];
                    return (
                      <tr key={m.month + m.currency} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-5 py-3.5 font-medium text-white">
                          <Badge variant="secondary" className="font-semibold text-xs py-0.5">
                            {formatMonth(m.month)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-1.5 font-bold text-white">
                            <span>{meta?.flag ?? "🌐"}</span> {m.currency}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-slate-300">
                          {m.count.toLocaleString()}
                        </td>
                        <td className="px-4 py-3.5 text-right font-semibold text-white tabular-nums">
                          {money(m.volume, m.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-amber-400 tabular-nums">
                          {money(m.fees, m.currency)}
                        </td>
                        <td className="px-4 py-3.5 text-right font-medium text-blue-400 tabular-nums">
                          {money(m.agent, m.currency)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-bold text-emerald-400 tabular-nums">
                          {money(m.net, m.currency)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-10 text-center space-y-3">
              <div className="size-12 rounded-2xl bg-secondary/60 flex items-center justify-center text-muted-foreground border border-white/5">
                <Calendar className="size-6 text-slate-400" />
              </div>
              <div className="space-y-1">
                <p className="font-semibold text-white text-sm">Sin movimientos contables en este periodo</p>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Al completar transferencias se generará el balance mensual consolidado con sus márgenes netos.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
