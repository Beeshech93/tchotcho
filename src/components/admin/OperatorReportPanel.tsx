import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { money, shortDate } from "@/lib/remesa";

type TopupRow = {
  id: string;
  operator: string | null;
  sku_code: string;
  phone: string;
  amount: number;
  currency: string;
  status: string;
  reference: string;
  created_at: string;
};

const STATUS_TONE: Record<string, string> = {
  pending: "bg-amber-50 text-amber-900 border border-amber-300 font-bold",
  processing: "bg-blue-50 text-blue-900 border border-blue-300 font-bold",
  completed: "bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold",
  failed: "bg-rose-50 text-rose-900 border border-rose-300 font-bold",
  refunded: "bg-slate-100 text-slate-800 border border-slate-300 font-semibold",
};

export function OperatorReportPanel() {
  useRealtimeInvalidate("topups", ["admin-topups-by-operator"]);
  const { data } = useQuery({
    queryKey: ["admin-topups-by-operator"],
    queryFn: async () => {
      const { data } = await supabase
        .from("topups")
        .select("id, operator, sku_code, phone, amount, currency, status, reference, created_at")
        .order("created_at", { ascending: false })
        .limit(500);
      return (data ?? []) as TopupRow[];
    },
  });

  const [operatorFilter, setOperatorFilter] = useState<string>("all");

  const rows = useMemo(() => data ?? [], [data]);
  const operators = Array.from(new Set(rows.map((r) => r.operator || "Sin operador"))).sort();

  const summary = useMemo(() => {
    const byOperator: Record<string, Record<string, number>> = {};
    for (const r of rows) {
      const op = r.operator || "Sin operador";
      byOperator[op] ??= {};
      byOperator[op][r.status] = (byOperator[op][r.status] ?? 0) + 1;
    }
    return byOperator;
  }, [rows]);

  const filteredRows =
    operatorFilter === "all"
      ? rows
      : rows.filter((r) => (r.operator || "Sin operador") === operatorFilter);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Smartphone className="size-4" /> Recargas por operador
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Últimas 500 recargas, agrupadas por operador móvil para verificar que cada uno esté
            funcionando correctamente.
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {operators.length === 0 && (
              <p className="text-sm text-muted-foreground">Sin recargas todavía.</p>
            )}
            {operators.map((op) => {
              const counts = summary[op] ?? {};
              const total = Object.values(counts).reduce((a, b) => a + b, 0);
              return (
                <button
                  key={op}
                  type="button"
                  onClick={() => setOperatorFilter(op)}
                  className={`rounded-xl border p-3 text-left transition-colors hover:bg-secondary ${
                    operatorFilter === op ? "border-accent bg-accent/10" : ""
                  }`}
                >
                  <p className="font-medium">{op}</p>
                  <p className="text-xs text-muted-foreground">{total} recarga(s)</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {Object.entries(counts).map(([status, n]) => (
                      <Badge key={status} className={STATUS_TONE[status] ?? ""} variant="secondary">
                        {status}: {n}
                      </Badge>
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Detalle</CardTitle>
          <Select value={operatorFilter} onValueChange={setOperatorFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los operadores</SelectItem>
              {operators.map((op) => (
                <SelectItem key={op} value={op}>
                  {op}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent className="space-y-2">
          {filteredRows.length === 0 && (
            <p className="py-4 text-sm text-muted-foreground">Sin recargas para este filtro.</p>
          )}
          {filteredRows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {r.operator || "Sin operador"} · {r.phone}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.reference} · {r.sku_code} · {shortDate(r.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-semibold">{money(Number(r.amount), r.currency)}</span>
                <Badge className={STATUS_TONE[r.status] ?? ""} variant="secondary">
                  {r.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
