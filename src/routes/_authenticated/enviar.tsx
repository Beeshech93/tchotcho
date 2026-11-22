import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, AlertTriangle, Banknote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useWallets } from "@/hooks/useWallet";
import { useCountries, useRate, fallbackRate } from "@/hooks/useCorridors";
import { useServicesConfig } from "@/hooks/useServicesConfig";
import { agentCreateCashTransfer } from "@/lib/transfers.functions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { quote, money, paymentMethods, deliveryMethods, citiesFor, ZERO_RATE } from "@/lib/remesa";
import { KycRequiredGate } from "@/components/KycRequiredGate";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/enviar")({
  head: () => ({
    meta: [
      { title: "Enviar dinero — Tcho-Tcho" },
      {
        name: "description",
        content:
          "Envía dinero desde América o Europa hacia Haití con comisión transparente.",
      },
      { property: "og:title", content: "Enviar dinero — Tcho-Tcho" },
      {
        property: "og:description",
        content: "Calcula, elige método de pago y envía a Haití.",
      },
    ],
  }),
  component: Enviar,
});

function Enviar() {
  const router = useRouter();
  const { user, profile, isAdmin, isAgent } = useProfile();
  const createCashTransfer = useServerFn(agentCreateCashTransfer);
  const { t } = useI18n();
  const { data: countries } = useCountries();
  const { data: wallets } = useWallets();

  const transfersWallet = useMemo(
    () => (wallets ?? []).find((w) => w.currency === "HTG"),
    [wallets],
  );
  const transfersBalance = Number(transfersWallet?.balance) || 0;

  const schema = useMemo(
    () =>
      z.object({
        recipient_name: z.string().trim().min(3, t("send.error_name")).max(100),
        recipient_phone: z.string().trim().min(6, t("send.error_phone")).max(25),
        recipient_city: z.string().trim().min(2, t("send.error_city")).max(60),
        amount: z
          .number()
          .positive(t("send.error_amount"))
          .max(5_000_000, t("send.error_amount_high")),
        note: z.string().trim().max(300).optional(),
      }),
    [t],
  );

  const [origin, setOrigin] = useState("MX");
  const [destination, setDestination] = useState("HT");
  const [amount, setAmount] = useState("2000");
  const [payment, setPayment] = useState("card");
  const [delivery, setDelivery] = useState("moncash");
  const [city, setCity] = useState("Port-au-Prince");
  const [saving, setSaving] = useState(false);

  const { isEnabled, getMessage, isLoading: isServicesLoading } = useServicesConfig();
  const transfersEnabled = isEnabled("transfers");
  const transfersMessage = getMessage("transfers") || t("services.disabled_alert");

  useEffect(() => {
    if (!isServicesLoading && !transfersEnabled && !isAdmin) {
      router.navigate({ to: "/dashboard", replace: true });
    }
  }, [isServicesLoading, transfersEnabled, isAdmin, router]);

  const origins = (countries ?? []).filter((c) => c.is_origin);
  const destinations = (countries ?? []).filter((c) => c.is_destination && c.code !== "DO");
  const originCountry = origins.find((c) => c.code === origin);
  const destCountry = destinations.find((c) => c.code === destination);

  const { data: cfg } = useRate(originCountry?.currency, destCountry?.currency);

  const payments = useMemo(() => paymentMethods(origin), [origin]);
  const deliveries = useMemo(() => deliveryMethods(destination), [destination]);
  const cities = useMemo(() => citiesFor(destination), [destination]);

  const sendCur = originCountry?.currency ?? "MXN";
  const recvCur = destCountry?.currency ?? "HTG";
  const fbRate = fallbackRate(sendCur, recvCur) ?? {
    rate: 7.2,
    fee_percent: 1.5,
    fee_fixed: 15,
    agent_commission_percent: 0.8,
  };
  const effectiveCfg = cfg && Number(cfg.rate) > 0 ? cfg : fbRate;
  const q = quote(Number(amount), effectiveCfg);

  const changeOrigin = (code: string) => {
    setOrigin(code);
    setPayment(paymentMethods(code)[0]?.value ?? "card");
  };

  const changeDestination = (code: string) => {
    setDestination(code);
    setDelivery(deliveryMethods(code)[0]?.value ?? "moncash");
    setCity(citiesFor(code)[0] ?? "");
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user) return;
    if (!transfersEnabled) {
      toast.error(transfersMessage);
      return;
    }
    if (!isAdmin && profile?.kyc_status !== "approved") {
      toast.error(t("send.kyc_none"));
      return;
    }
    const form = new FormData(e.currentTarget);
    const parsed = schema.safeParse({
      recipient_name: String(form.get("recipient_name") ?? ""),
      recipient_phone: String(form.get("recipient_phone") ?? ""),
      recipient_city: city,
      amount: Number(amount),
      note: String(form.get("note") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? t("send.error_generic"));
      return;
    }

    // Límites del monto recibido en Haití (HTG), según la billetera elegida.
    const amountReceiveHtg = q.receives;
    if (destination === "HT" && delivery === "moncash" && amountReceiveHtg > 75_000) {
      toast.error("MonCash permite un máximo de 75,000 HTG por transacción.");
      return;
    }
    if (destination === "HT" && delivery === "natcash") {
      if (amountReceiveHtg < 3_998 || amountReceiveHtg > 75_000) {
        toast.error(
          "Natcom (NatCash): Min 3,998 HTG · Max 75,000 HTG per transaction · whole numbers only",
        );
        return;
      }
      if (!Number.isInteger(amountReceiveHtg)) {
        toast.error(
          "Natcom (NatCash): Solo números enteros en HTG (whole numbers only). Ajusta el monto enviado.",
        );
        return;
      }
    }

    // Las cuentas de agente y administradores envían directamente sin pasar por pasarelas externas (Stripe, Mercado Pago)
    if (isAgent || isAdmin) {
      setSaving(true);
      try {
        const res = await createCashTransfer({
          data: {
            originCountry: origin,
            destinationCountry: destination,
            recipientName: parsed.data.recipient_name,
            recipientPhone: parsed.data.recipient_phone,
            recipientCity: city,
            deliveryMethod: delivery,
            amountSend: parsed.data.amount,
            note: parsed.data.note || undefined,
          },
        });
        setSaving(false);
        if (res.ok) {
          toast.success(
            isAdmin
              ? "¡Transacción directa procesada exitosamente!"
              : "¡Transacción enviada correctamente!",
          );
          router.navigate({ to: "/transferencia/$id", params: { id: res.transferId } });
          return;
        }
      } catch (err) {
        setSaving(false);
        toast.error(err instanceof Error ? err.message : t("send.error_create"));
        return;
      }
    }

    setSaving(true);
    const transferPayload: Record<string, any> = {
      user_id: user.id,
      recipient_name: parsed.data.recipient_name,
      recipient_phone: parsed.data.recipient_phone,
      recipient_city: parsed.data.recipient_city,
      delivery_method: delivery,
      payment_method: payment,
      amount_send: parsed.data.amount,
      rate: effectiveCfg.rate,
      note: parsed.data.note || null,
      status: "awaiting_payment",
      origin_country: origin,
      destination_country: destination,
    };

    let { data, error } = await supabase
      .from("transfers")
      .insert(transferPayload)
      .select("id")
      .single();

    if (error && (error.message.includes("schema cache") || error.message.includes("column"))) {
      delete transferPayload["destination_country"];
      delete transferPayload["origin_country"];
      const retry = await supabase
        .from("transfers")
        .insert(transferPayload)
        .select("id")
        .single();
      data = retry.data;
      error = retry.error;
    }

    setSaving(false);
    if (error || !data) {
      toast.error(t("send.error_create"));
      return;
    }
    toast.success(t("send.success_create"));
    router.navigate({ to: "/transferencia/$id", params: { id: data.id } });
  };

  if (!isServicesLoading && !transfersEnabled && !isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-slate-300">
        <p>{transfersMessage}</p>
      </div>
    );
  }

  if (!isAdmin && profile?.kyc_status !== "approved") {
    return (
      <div className="mx-auto max-w-3xl space-y-5">
        <div className="flex items-center gap-2">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Volver al inicio"
          >
            <Link to="/dashboard">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <h1 className="text-2xl font-bold">{t("send.title")}</h1>
        </div>

        <KycRequiredGate operationName="enviar dinero y transferencias" />
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-3xl space-y-4 sm:space-y-5 w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="icon"
          className="shrink-0"
          aria-label="Volver al inicio"
        >
          <Link to="/dashboard">
            <ArrowLeft className="size-5" />
          </Link>
        </Button>
        <h1 className="text-2xl font-bold">{t("send.title")}</h1>
      </div>

      {!transfersEnabled && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="font-medium">{transfersMessage}</p>
        </div>
      )}

      {!isAdmin && isAgent && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-4 text-sm text-emerald-950 shadow-2xs">
          <div className="flex items-center gap-3">
            <Banknote className="size-5 shrink-0 text-emerald-700" />
            <div>
              <p className="font-black text-emerald-950">
                Modo Agente: Cobro de efectivo en ventanilla física.
              </p>
              <p className="text-xs text-emerald-800 font-medium mt-0.5">
                La remesa se descuenta de tu Billetera de Envíos de Dinero ({transfersBalance.toLocaleString()} HTG disponibles).
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 font-bold text-xs shrink-0">
            <span className="text-emerald-800 font-semibold">Saldo Envíos:</span>
            <span className="text-emerald-950 text-sm font-black bg-white px-2.5 py-1 rounded-xl border border-emerald-200 shadow-2xs">
              {transfersBalance.toLocaleString()} HTG
            </span>
          </div>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("send.step1")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>{t("send.from")}</Label>
              <Select value={origin} onValueChange={changeOrigin}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      originCountry
                        ? `${originCountry.flag} ${originCountry.name} · ${originCountry.currency}`
                        : "🇲🇽 México · MXN"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {origins.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t("send.to")}</Label>
              <Select value={destination} onValueChange={changeDestination}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      destCountry
                        ? `${destCountry.flag} ${destCountry.name} · ${destCountry.currency}`
                        : "🇭🇹 Haití · HTG"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {destinations.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="monto">
              {t("send.you_send")} ({sendCur || "—"})
            </Label>
            <Input
              id="monto"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
              className="h-12 text-lg font-semibold"
            />
          </div>

          <div className="space-y-1.5 rounded-xl bg-secondary p-4 text-sm">
            <Line
              label={t("send.rate")}
              value={`1 ${sendCur} = ${Number(effectiveCfg.rate).toFixed(4)} ${recvCur}`}
            />
            <Line label={t("send.fee")} value={money(q.fee, sendCur)} />
            <Line label={t("send.total")} value={money(q.total, sendCur)} strong />
          </div>
          {destination === "HT" && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-xs text-slate-700">
              {delivery === "natcash" ? (
                <p className="font-semibold text-emerald-800">
                  ⚡ Natcom (NatCash): Min 3,998 HTG · Max 75,000 HTG per transaction · whole numbers only
                </p>
              ) : (
                <p className="text-slate-600">
                  MonCash: máximo 75,000 HTG por transacción.
                </p>
              )}
            </div>
          )}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-600 via-emerald-700 to-emerald-800 p-5 text-white shadow-lg shadow-emerald-950/20 border-2 border-emerald-500">
            <p className="text-xs font-black uppercase tracking-wider text-emerald-100">
              {t("send.family_gets")}
            </p>
            <p className="mt-1 font-display text-3xl font-black tracking-tight text-white drop-shadow-xs">
              {money(q.receives, recvCur)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {t("send.step2")} {destCountry?.name ?? t("send.step2_fallback")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="recipient_name">{t("send.recipient_name")}</Label>
            <Input id="recipient_name" name="recipient_name" required maxLength={100} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="recipient_phone">{t("send.recipient_phone")}</Label>
            <Input id="recipient_phone" name="recipient_phone" type="tel" required maxLength={25} />
          </div>
          <div className="space-y-1.5">
            <Label>{t("send.city")}</Label>
            <Select value={city} onValueChange={setCity}>
              <SelectTrigger>
                <SelectValue placeholder={t("send.city_placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{t("send.delivery")}</Label>
            <Select value={delivery} onValueChange={setDelivery}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {deliveries.map((d) => (
                  <SelectItem key={d.value} value={d.value}>
                    {d.label} — {d.hint}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="note">{t("send.note")}</Label>
            <Textarea id="note" name="note" maxLength={300} rows={2} />
          </div>
        </CardContent>
      </Card>

      {isAdmin ? null : isAgent ? (
        <Card className="border-2 border-emerald-200 bg-emerald-50/50 shadow-2xs rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-emerald-800 font-extrabold">
              <Banknote className="size-5 text-emerald-700" />
              <span>Pago en Efectivo en Ventanilla (Agente)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-2xs">
              <p className="font-extrabold text-sm text-slate-900">Cobro en ventanilla física</p>
              <p className="text-xs text-slate-600 font-medium mt-1">
                El cliente te entrega el efectivo directamente. La transferencia se procesa
                inmediatamente y se descuenta de tu saldo de agente.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{t("send.step3")}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {payments.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => setPayment(m.value)}
                className={`rounded-xl border p-4 text-left transition-colors ${
                  payment === m.value ? "border-accent bg-accent/10" : "hover:bg-secondary"
                }`}
              >
                <p className="font-medium">{m.label}</p>
                <p className="text-xs text-muted-foreground">{m.hint}</p>
              </button>
            ))}
          </CardContent>
        </Card>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full text-base font-semibold"
        disabled={
          saving ||
          !cfg ||
          (!isAdmin && !isAgent && profile?.kyc_status !== "approved") ||
          !transfersEnabled ||
          (!isAdmin && isAgent && (transfersBalance <= 0 || q.receives > transfersBalance))
        }
      >
        {!transfersEnabled
          ? t("services.disabled_btn")
          : saving
            ? t("send.creating")
            : isAdmin
              ? `⚡ Enviar transferencia directa (${money(q.total, sendCur)})`
              : !isAdmin && isAgent && (transfersBalance <= 0 || q.receives > transfersBalance)
                ? "Saldo insuficiente en Billetera de Envíos"
                : `${t("send.confirm")} ${money(q.total, sendCur)}`}
      </Button>
    </form>
  );
}

function Line({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : "font-medium"}>{value}</span>
    </div>
  );
}
