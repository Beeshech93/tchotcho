import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCountries } from "@/hooks/useCorridors";
import { adminSaveTopupRate } from "@/lib/exchange-rates.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TopupRateRow = {
  id: string;
  from_currency: string;
  to_currency: string;
  rate: number;
  is_active: boolean;
};

export function TopupRatesPanel() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState("MXN");
  const [to, setTo] = useState("HTG");

  const { data: countries } = useCountries();
  const originCountries = (countries ?? []).filter((c) => c.is_origin);
  const destCountries = (countries ?? []).filter(
    (c) =>
      c.is_destination ||
      c.code === "HT" ||
      c.currency === "HTG" ||
      c.currency === "DOP" ||
      c.currency === "USD",
  );

  const selectedOriginCountry = originCountries.find((c) => c.currency === from);
  const selectedDestCountry = destCountries.find((c) => c.currency === to);

  const { data: rates } = useQuery({
    queryKey: ["all-topup-rates"],
    queryFn: async () =>
      ((await supabase.from("topup_rates").select("*").eq("is_active", true).order("from_currency"))
        .data ?? []) as TopupRateRow[],
  });

  const rate = (rates ?? []).find(
    (r) => r.from_currency === from.toUpperCase() && r.to_currency === to.toUpperCase(),
  );

  const saveTopupRateFn = useServerFn(adminSaveTopupRate);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const value = Number(f.get("rate"));

    if (!Number.isFinite(value) || value <= 0) {
      toast.error("La tasa de recarga debe ser un número mayor a 0 (ej. 7.20)");
      return;
    }

    setSaving(true);
    try {
      // 1. Guardar a través de la server function con service role
      await saveTopupRateFn({
        data: {
          from_currency: from,
          to_currency: to,
          rate: value,
        },
      });
      toast.success("Tasa de recarga DingConnect actualizada correctamente");
    } catch (serverErr: any) {
      console.warn("[TopupRatesPanel] Error en server fn, intentando cliente upsert:", serverErr);
      // 2. Fallback cliente upsert
      const { error } = await supabase.from("topup_rates").upsert(
        {
          ...(rate ? { id: rate.id } : {}),
          from_currency: from.toUpperCase(),
          to_currency: to.toUpperCase(),
          rate: value,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "from_currency,to_currency" },
      );
      if (error) {
        console.error("[topup_rates error]", error);
        toast.error(error.message || serverErr?.message || "No se pudo guardar la tasa");
        setSaving(false);
        return;
      }
      toast.success("Tasa de recarga DingConnect actualizada correctamente");
    } finally {
      setSaving(false);
      qc.invalidateQueries({ queryKey: ["all-topup-rates"] });
      qc.invalidateQueries({ queryKey: ["topup_rate"] });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasas de recarga por corredor (DingConnect)</CardTitle>
          <p className="text-xs text-muted-foreground">
            Configuración de tipo de cambio para recargas móviles de DingConnect. Define cuánto
            saldo recibe el número en la moneda de destino por cada unidad pagada en la moneda de
            origen. Funciona de manera independiente a las tarifas de envíos de dinero.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Moneda de origen (Pago del cliente)</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedOriginCountry
                        ? `${selectedOriginCountry.flag} ${selectedOriginCountry.name} · ${selectedOriginCountry.currency}`
                        : "Seleccionar país de origen"
                    }
                  >
                    {selectedOriginCountry
                      ? `${selectedOriginCountry.flag} ${selectedOriginCountry.name} · ${selectedOriginCountry.currency}`
                      : from}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {originCountries.map((c) => (
                    <SelectItem key={`${c.code}-${c.currency}`} value={c.currency}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Moneda de destino (Operador telefónico)</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedDestCountry
                        ? `${selectedDestCountry.flag} ${selectedDestCountry.name} · ${selectedDestCountry.currency}`
                        : "Seleccionar país de destino"
                    }
                  >
                    {selectedDestCountry
                      ? `${selectedDestCountry.flag} ${selectedDestCountry.name} · ${selectedDestCountry.currency}`
                      : to}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {destCountries.map((c) => (
                    <SelectItem key={`${c.code}-${c.currency}`} value={c.currency}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <form
            onSubmit={save}
            className="space-y-4"
            key={`${from}-${to}-${rate?.id ?? "new"}-${rate?.rate ?? ""}`}
          >
            <div className="space-y-1.5">
              <Label htmlFor="topup-rate">
                Tasa de recarga ({to} recibidos por cada 1 {from} pagado)
              </Label>
              <Input
                id="topup-rate"
                name="rate"
                type="number"
                step="0.0001"
                min="0.0001"
                defaultValue={
                  rate && Number(rate.rate) > 0
                    ? Number(rate.rate)
                    : from === "MXN" && to === "HTG"
                      ? 7.2
                      : undefined
                }
                placeholder="Ej. 7.20"
                required
              />
              <p className="text-xs text-muted-foreground">
                Define cuánto recibe el saldo del teléfono en {to} por cada 1 {from} pagado.
              </p>
            </div>

            <Button type="submit" disabled={saving} className="w-full">
              {saving ? "Guardando…" : rate ? "Actualizar tasa Ding" : "Crear tasa Ding"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tasas DingConnect configuradas</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {(rates ?? []).length === 0 && (
            <p className="py-4 text-sm text-muted-foreground sm:col-span-2">
              Sin tasas configuradas todavía.
            </p>
          )}
          {(rates ?? []).map((r) => {
            const originC = originCountries.find((c) => c.currency === r.from_currency);
            const destC = destCountries.find((c) => c.currency === r.to_currency);
            const isSelected = from === r.from_currency && to === r.to_currency;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setFrom(r.from_currency);
                  setTo(r.to_currency);
                }}
                className={`flex flex-col gap-1.5 rounded-xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/30"
                    : "border-border hover:bg-secondary/60 hover:border-border/80"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-sm flex items-center gap-1.5">
                    <span>
                      {originC?.flag ?? "🌐"} {r.from_currency}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span>
                      {destC?.flag ?? "🌐"} {r.to_currency}
                    </span>
                  </span>
                  <Badge variant={r.is_active ? "default" : "secondary"} className="text-[10px]">
                    {r.is_active ? "Activa" : "Inactiva"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  1 {r.from_currency} ={" "}
                  <strong className="text-foreground">{Number(r.rate).toFixed(4)}</strong>{" "}
                  {r.to_currency}
                </p>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
