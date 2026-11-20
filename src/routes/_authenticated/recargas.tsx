import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { celebrateLogo } from "@/components/LogoAnimation";
import {
  Smartphone,
  Send,
  Copy,
  Check,
  ArrowLeft,
  AlertTriangle,
  Banknote,
  ShieldCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCountries, useTopupRate } from "@/hooks/useCorridors";
import { useProfile } from "@/hooks/useProfile";
import { useServicesConfig } from "@/hooks/useServicesConfig";
import { KycRequiredGate } from "@/components/KycRequiredGate";
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
import { useWallets, useRefreshWallet } from "@/hooks/useWallet";
import {
  dingCreateTopupCheckout,
  dingListProducts,
  dingSendTopup,
} from "@/lib/dingconnect.functions";
import type { OxxoVoucher, SpeiReference } from "@/lib/mercadopago.server";
import { money, paymentMethods, paymentLabel, shortDate } from "@/lib/remesa";
import { TOPUP_COUNTRIES, findTopupCountry, prettyOperator } from "@/lib/topup-operators";
import { validatePhone, formatNational, expectedLengths, normalizeLocal } from "@/lib/phone";
import { interpolate, useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/_authenticated/recargas")({
  head: () => ({
    meta: [
      { title: "Recargas de saldo móvil — Tcho-Tcho" },
      {
        name: "description",
        content:
          "Envía recargas de saldo móvil a Haití y otros países desde tu billetera Tcho-Tcho.",
      },
      { property: "og:title", content: "Recargas de saldo móvil — Tcho-Tcho" },
      {
        property: "og:description",
        content: "Top-up internacional instantáneo desde tu billetera.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Recargas,
});

function Recargas() {
  const qc = useQueryClient();
  const router = useRouter();
  const refreshWallet = useRefreshWallet();
  const { profile, isAdmin, isAgent } = useProfile();
  const { t } = useI18n();
  const STATUS_LABEL: Record<string, string> = {
    pending: t("topup.status_pending"),
    processing: t("topup.status_processing"),
    completed: t("topup.status_completed"),
    failed: t("topup.status_failed"),
    refunded: t("topup.status_refunded"),
  };
  const { data: wallets } = useWallets();
  const { data: countries } = useCountries();
  const listProducts = useServerFn(dingListProducts);
  const sendTopup = useServerFn(dingSendTopup);
  const createCheckout = useServerFn(dingCreateTopupCheckout);

  const [country, setCountry] = useState("HT");
  const [operator, setOperator] = useState("");
  const [sku, setSku] = useState("");
  const [phone, setPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [payOrigin, setPayOrigin] = useState("MX");
  const [payMethod, setPayMethod] = useState(isAdmin ? "direct" : "card");
  const [payCurrency, setPayCurrency] = useState("");
  const [pendingResult, setPendingResult] = useState<
    | { mode: "voucher"; voucher: OxxoVoucher }
    | { mode: "spei"; spei: SpeiReference }
    | { mode: "checkout"; checkoutUrl: string }
    | { mode: "direct"; reference: string; status: string }
    | null
  >(null);

  const { isEnabled, getMessage, isLoading: isServicesLoading } = useServicesConfig();
  const topupsEnabled = isEnabled("topups");
  const topupsMessage = getMessage("topups") || t("services.disabled_alert");

  useEffect(() => {
    if (!isServicesLoading && !topupsEnabled && !isAdmin) {
      router.navigate({ to: "/dashboard", replace: true });
    }
  }, [isServicesLoading, topupsEnabled, isAdmin, router]);

  const payOrigins = (countries ?? []).filter((c) => c.is_origin);
  const topupWallet = useMemo(
    () =>
      (wallets ?? []).find((w) => w.currency === "HTG_RECARGAS") ??
      (wallets ?? []).find((w) => w.currency === "HTG"),
    [wallets],
  );
  const topupBalance = Number(topupWallet?.balance) || 0;

  const payMethods = useMemo(() => {
    const gatewayMethods = paymentMethods(payOrigin).filter((m) => m.value !== "cash_agent");
    if (isAdmin) {
      return [
        {
          value: "direct",
          label: "⚡ Recarga Directa (Admin)",
          hint: "Envío inmediato sin cobro",
        },
        ...gatewayMethods,
      ];
    }
    if (isAgent) {
      return [
        {
          value: "agent_wallet",
          label: `📱 Billetera Recargas (${topupBalance.toLocaleString()} HTG)`,
          hint: "Saldo operativo para recargas",
        },
      ];
    }
    return gatewayMethods;
  }, [payOrigin, isAdmin, isAgent, topupBalance]);

  useEffect(() => {
    if (isAdmin) {
      setPayMethod("direct");
    } else if (isAgent) {
      setPayMethod("agent_wallet");
    } else if (!payMethods.some((m) => m.value === payMethod)) {
      setPayMethod(payMethods[0]?.value ?? "card");
    }
  }, [payMethods, payMethod, isAdmin, isAgent]);

  // Usar la primera billetera disponible como defecto
  const wallet = useMemo(() => (wallets ?? [])[0], [wallets]);
  const walletId = wallet?.id ?? "";

  // Convierte el monto automáticamente cuando cambia el país o el método de
  // pago (por lo tanto la moneda con la que se paga), para que la cifra
  // escrita siga representando el mismo valor real.
  useEffect(() => {
    const originInfo = (countries ?? []).find((c) => c.is_origin && c.code === payOrigin);
    const nextCurrency = originInfo?.currency ?? "USD";
    if (!nextCurrency || nextCurrency === payCurrency) return;

    const value = Number(amount);
    const hasAmount = amount.trim() !== "" && Number.isFinite(value) && value > 0;
    if (!payCurrency || !hasAmount) {
      setPayCurrency(nextCurrency);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("exchange_rates")
        .select("rate")
        .eq("is_active", true)
        .eq("from_currency", payCurrency)
        .eq("to_currency", nextCurrency)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (data?.rate) {
        const converted = Math.round(value * Number(data.rate) * 100) / 100;
        setAmount(String(converted));
        toast(`Monto convertido a ${nextCurrency}: ${converted}`);
      } else {
        setAmount("");
        toast(`Ahora pagas en ${nextCurrency}: vuelve a escribir el monto`);
      }
      setPayCurrency(nextCurrency);
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payOrigin, payMethod, wallet?.currency, countries]);

  const { data: products, isFetching } = useQuery({
    queryKey: ["ding_products", country],
    queryFn: () => listProducts({ data: { countryCode: country } }),
  });

  const { data: topups } = useQuery({
    queryKey: ["topups"],
    queryFn: async () => {
      const { data } = await supabase
        .from("topups")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
  });

  const countryInfo = findTopupCountry(country);
  const dial = countryInfo?.dialCode ?? "+509";
  // DO/JM/PR usan +1 con 10 dígitos (código de área incluido), como US.
  const validationCode = ["DO", "JM", "PR"].includes(country) ? "US" : country;

  const phoneCheck = useMemo(
    () => validatePhone(validationCode, dial, phone),
    [validationCode, dial, phone],
  );
  const phoneDigits = normalizeLocal(phone, dial);
  const lengths = expectedLengths(validationCode);
  const phoneError =
    phone.trim() === "" || phoneCheck.ok
      ? null
      : phoneCheck.error === "short"
        ? interpolate(t("topup.phone_short"), {
            country: countryInfo?.label ?? country,
            digits: lengths.join(" o "),
            have: phoneDigits.length,
          })
        : phoneCheck.error === "long"
          ? interpolate(t("topup.phone_long"), {
              country: countryInfo?.label ?? country,
              digits: lengths.join(" o "),
              have: phoneDigits.length,
            })
          : interpolate(t("topup.phone_invalid"), {
              country: countryInfo?.label ?? country,
              digits: lengths.join(" o "),
            });

  // Operadores del país: del catálogo del proveedor si hay, si no del catálogo local.
  const operators = useMemo(() => {
    const items = products?.items ?? [];
    const fromProvider = Array.from(
      new Set(items.map((p) => prettyOperator(country, p.operator || p.skuCode))),
    ).filter(Boolean);
    // Nunca mostrar operadores del catálogo local como si estuvieran disponibles en DingConnect.
    // Solo productos reales del proveedor pueden habilitar una recarga.
    return fromProvider;
  }, [products, country]);

  // Planes/SKUs del operador elegido.
  const plans = useMemo(
    () =>
      (products?.items ?? []).filter(
        (p) => prettyOperator(country, p.operator || p.skuCode) === operator,
      ),
    [products, country, operator],
  );

  // Prioriza un producto de importe variable cuando DingConnect lo ofrece.
  // Si hay varios, elige el de mayor rango permitido; si todos son fijos,
  // conserva el primer producto disponible. Nunca se inventa un SKU.
  const preferredPlan = useMemo(() => {
    return [...plans].sort((a, b) => {
      const aHasRange = a.minValue != null && a.maxValue != null;
      const bHasRange = b.minValue != null && b.maxValue != null;
      const aMin = Number(a.minValue ?? 0);
      const aMax = Number(a.maxValue ?? a.minValue ?? 0);
      const bMin = Number(b.minValue ?? 0);
      const bMax = Number(b.maxValue ?? b.minValue ?? 0);
      const aFlexible = aHasRange && aMax > aMin;
      const bFlexible = bHasRange && bMax > bMin;

      if (aFlexible !== bFlexible) return aFlexible ? -1 : 1;
      if (aFlexible && bFlexible) return bMax - bMin - (aMax - aMin);
      if (aHasRange !== bHasRange) return aHasRange ? 1 : -1;
      return 0;
    })[0];
  }, [plans]);

  useEffect(() => {
    setSku(preferredPlan?.skuCode ?? "");
  }, [preferredPlan]);

  const selected = (products?.items ?? []).find((p) => p.skuCode === sku);

  // Tasa manual (configurada en /admin) de la moneda de pago a la moneda del
  // operador, para calcular cuánto recibe realmente el destinatario.
  // Moneda real del destinatario: para Haití siempre es HTG; si no, la del país de destino.
  const destinationCurrency =
    (countries ?? []).find((c) => c.is_destination && c.code === country)?.currency ||
    (country === "HT" ? "HTG" : "");
  const operatorCurrency =
    country === "HT" ? "HTG" : selected?.currency || destinationCurrency || "HTG";
  const sameCurrency = !!payCurrency && !!operatorCurrency && payCurrency === operatorCurrency;
  const { data: topupRate } = useTopupRate(
    sameCurrency ? undefined : payCurrency || undefined,
    sameCurrency ? undefined : operatorCurrency || undefined,
  );
  const amountValue = Number(amount);
  const hasAmount = amount.trim() !== "" && Number.isFinite(amountValue) && amountValue > 0;
  const receivedAmount = !hasAmount
    ? null
    : sameCurrency
      ? amountValue
      : topupRate
        ? Math.round(amountValue * Number(topupRate.rate) * 100) / 100
        : null;
  const receivedCurrency = operatorCurrency || destinationCurrency || "HTG";
  const missingRate = Boolean(hasAmount && !sameCurrency && operatorCurrency && !topupRate);

  // Rangos del proveedor ajustados a la moneda que recibe el destinatario (HTG para Haití)
  const isHaitiTarget = country === "HT";
  const rawMin = Number(selected?.minValue ?? 0);
  const rawMax = Number(selected?.maxValue ?? selected?.minValue ?? 0);
  const isUsdProductForHaiti =
    isHaitiTarget && selected?.currency === "USD" && rawMin > 0 && rawMin < 200;

  const providerMin = isUsdProductForHaiti ? Math.round(rawMin * 130) : rawMin;
  const providerMax = isUsdProductForHaiti ? Math.round(rawMax * 130) : rawMax;
  const providerCurrency = isHaitiTarget ? "HTG" : selected?.currency || "HTG";
  const providerRangeKnown = selected?.minValue != null;

  const providerAmountValid =
    !providerRangeKnown ||
    (receivedAmount != null && receivedAmount >= providerMin && receivedAmount <= providerMax);
  const suggestedPayAmount =
    topupRate && Number(topupRate.rate) > 0 && providerMin > 0
      ? Math.ceil((providerMin / Number(topupRate.rate)) * 100) / 100
      : null;

  const sendMut = useMutation({
    mutationFn: async () => {
      if (!topupsEnabled) throw new Error(topupsMessage);
      if (!isAdmin && profile?.kyc_status !== "approved") throw new Error(t("topup.err_kyc"));
      if (!operator) throw new Error(t("topup.err_operator"));
      if (!phone.trim()) throw new Error(t("topup.err_phone_empty"));
      if (!phoneCheck.ok || !phoneCheck.e164)
        throw new Error(phoneError ?? t("topup.err_phone_invalid"));
      const value = Number(amount);
      if (!Number.isFinite(value) || value <= 0) throw new Error(t("topup.err_amount"));
      if (missingRate)
        throw new Error(
          interpolate(t("topup.err_no_rate"), { from: payCurrency, to: operatorCurrency }),
        );
      if (receivedAmount == null) throw new Error(t("topup.err_no_received"));
      // DingConnect's product limits apply to the provider send amount and
      // currency, not to the MXN amount paid by the customer. Keep this guard
      // explicit and do not silently send an out-of-range amount.
      if (providerRangeKnown && (receivedAmount < providerMin || receivedAmount > providerMax)) {
        throw new Error(
          interpolate(t("topup.err_range"), {
            min: providerMin,
            max: providerMax,
            currency: providerCurrency,
          }),
        );
      }

      if (
        payMethod === "agent_wallet" &&
        (topupBalance <= 0 || (receivedAmount != null && topupBalance < receivedAmount))
      ) {
        throw new Error(
          `Saldo insuficiente en tu Billetera de Recargas (${topupBalance.toLocaleString()} HTG). Requieres ${receivedAmount?.toLocaleString()} HTG. Sin saldo no puedes realizar envíos.`,
        );
      }

      return {
        kind: "checkout" as const,
        result: await createCheckout({
          data: {
            skuCode: sku || operator,
            operator,
            countryCode: country,
            phone: phoneCheck.e164,
            payAmount: value,
            payCurrency: payCurrency || "USD",
            topupAmount: receivedAmount,
            topupCurrency: receivedCurrency,
            paymentMethod: payMethod,
            originCountry: payOrigin,
          },
        }),
      };
    },
    onSuccess: (r) => {
      if ((r.result as any).mode === "direct") {
        toast.success(
          payMethod === "agent_wallet"
            ? `¡Recarga procesada exitosamente con saldo de agente! Ref: ${(r.result as any).reference}`
            : `¡Recarga directa enviada con éxito! Referencia: ${(r.result as any).reference}`,
        );
        celebrateLogo();
        setPhone("");
        setAmount("");
        refreshWallet();
        void qc.invalidateQueries({ queryKey: ["wallets"] });
        void qc.invalidateQueries({ queryKey: ["topups"] });
        return;
      }

      setPendingResult(r.result);
      setPhone("");
      setAmount("");
      void qc.invalidateQueries({ queryKey: ["topups"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!isServicesLoading && !topupsEnabled && !isAdmin) {
    return (
      <div className="mx-auto max-w-lg p-6 text-center text-slate-300">
        <p>{topupsMessage}</p>
      </div>
    );
  }

  if (!isAdmin && profile?.kyc_status !== "approved") {
    return (
      <div className="mx-auto max-w-4xl space-y-5">
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
          <h1 className="text-2xl font-bold">{t("topup.title")}</h1>
        </div>

        <KycRequiredGate operationName="enviar recargas telefónicas" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 sm:space-y-5 w-full min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 min-w-0">
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
        <h1 className="text-xl sm:text-2xl font-bold truncate">{t("topup.title")}</h1>
      </div>

      {!topupsEnabled && (
        <div className="flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 p-3 sm:p-4 text-sm text-destructive">
          <AlertTriangle className="size-5 shrink-0" />
          <p className="font-medium text-xs sm:text-sm">{topupsMessage}</p>
        </div>
      )}

      <Card className="overflow-hidden border border-slate-200 shadow-sm w-full min-w-0">
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
            <Smartphone className="size-4 shrink-0 text-emerald-600" /> {t("topup.send_recharge")}
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3.5 sm:gap-4 sm:grid-cols-2 min-w-0 px-4 pb-5 pt-0 sm:px-6">
          <div className="space-y-1.5 min-w-0 w-full">
            <Label className="text-xs font-bold text-slate-800">{t("topup.pay_country")}</Label>
            <Select
              value={payOrigin}
              onValueChange={(v) => {
                setPayOrigin(v);
                const nextMethods = paymentMethods(v).filter((m) => m.value !== "cash_agent");
                setPayMethod(nextMethods[0]?.value ?? "card");
              }}
            >
              <SelectTrigger className="w-full min-w-0 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {payOrigins.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.name ?? c.code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0 w-full">
            <Label className="text-xs font-bold text-slate-800">{t("topup.pay_method")}</Label>
            <Select value={payMethod} onValueChange={setPayMethod}>
              <SelectTrigger className="w-full min-w-0 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {payMethods.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label || paymentLabel(m.value)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0 w-full">
            <Label className="text-xs font-bold text-slate-800">{t("topup.number_country")}</Label>
            <Select
              value={country}
              onValueChange={(v) => {
                setCountry(v);
                setOperator("");
                setSku("");
              }}
            >
              <SelectTrigger className="w-full min-w-0 max-w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TOPUP_COUNTRIES.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 min-w-0 w-full">
            <Label className="text-xs font-bold text-slate-800">
              {t("topup.operator_of")} {countryInfo?.label ?? country}
            </Label>
            <Select
              value={operator}
              onValueChange={(v) => {
                setOperator(v);
                setSku("");
              }}
            >
              <SelectTrigger className="w-full min-w-0 max-w-full">
                <SelectValue
                  placeholder={
                    isFetching ? t("topup.loading_operators") : t("topup.choose_operator")
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {operators.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {products && !products.ok && (
              <p role="alert" className="text-xs text-destructive">
                No se pudieron cargar los operadores de DingConnect.
                {products.error
                  ? ` Detalle: ${products.error}`
                  : " Revisa la configuración o los registros del servidor."}
              </p>
            )}
            {products?.ok && products.items.length === 0 && !isFetching && (
              <p role="status" className="text-xs text-amber-600">
                DingConnect respondió, pero no devolvió productos de recarga móvil para este país.
                Comprueba la disponibilidad del catálogo de Haití o el filtro de productos en el
                servidor.
              </p>
            )}
          </div>

          <div className="space-y-1.5 min-w-0 w-full">
            <Label htmlFor="tu-phone" className="text-xs font-bold text-slate-800">
              {t("topup.number_to_recharge")}
            </Label>
            <div className="flex items-center gap-2 min-w-0 w-full">
              <span className="shrink-0 rounded-md border bg-muted px-2.5 py-2 text-xs sm:text-sm text-muted-foreground font-mono">
                {dial}
              </span>
              <Input
                id="tu-phone"
                inputMode="tel"
                autoComplete="tel"
                maxLength={24}
                aria-invalid={phoneError ? true : undefined}
                placeholder={countryInfo?.placeholder ?? "+509 3412 3456"}
                value={phone}
                onChange={(e) => setPhone(formatNational(validationCode, e.target.value, dial))}
                className="min-w-0 flex-1 font-mono text-sm"
              />
            </div>
            {phoneError ? (
              <p className="text-xs text-destructive">{phoneError}</p>
            ) : phoneCheck.ok ? (
              <p className="text-xs text-muted-foreground">
                {t("topup.will_send_to")} {phoneCheck.e164}
              </p>
            ) : lengths.length ? (
              <p className="text-xs text-muted-foreground">
                {interpolate(t("topup.digits_for"), {
                  n: lengths.join(" o "),
                  country: countryInfo?.label ?? country,
                })}
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5 min-w-0 w-full">
            <Label htmlFor="tu-amount" className="text-xs font-bold text-slate-800">
              {t("topup.amount_to_pay")} {payCurrency ? `(${payCurrency})` : ""}
            </Label>
            <Input
              id="tu-amount"
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="font-mono text-base font-bold"
            />
            <div
              data-testid="recipient-amount"
              aria-live="polite"
              className="block w-full min-w-0 rounded-xl border-2 border-emerald-500 bg-emerald-50/80 p-3.5 sm:p-4 shadow-2xs overflow-hidden"
            >
              <p className="text-xs sm:text-sm font-bold text-slate-800 break-words">
                Monto que recibe el destinatario / Recipient receives
              </p>
              <p className="mt-1 text-xl sm:text-2xl font-black text-emerald-700 font-mono break-all">
                {hasAmount && receivedAmount != null
                  ? `${receivedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${receivedCurrency}`
                  : `— ${operatorCurrency || destinationCurrency || "HTG"}`}
              </p>
              {hasAmount && receivedAmount == null && (
                <p className="mt-1 text-xs text-slate-600">
                  Falta una tasa de recarga válida para calcular el importe en HTG.
                </p>
              )}
            </div>
            {missingRate && (
              <p className="text-xs text-destructive">
                {interpolate(t("topup.no_rate_configured"), {
                  from: payCurrency,
                  to: operatorCurrency,
                })}
              </p>
            )}
            {providerRangeKnown && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">
                  Recarga disponible con el proveedor: {providerMin} – {providerMax}{" "}
                  {providerCurrency}
                </p>
                {providerMin === providerMax && (
                  <p className="text-xs text-muted-foreground">
                    Esta es una recarga de importe fijo. Para comprarla, el importe pagado debe
                    equivaler a {providerMin} {providerCurrency}.
                    {suggestedPayAmount != null
                      ? ` Con la tasa configurada, el pago aproximado es ${suggestedPayAmount.toFixed(2)} ${payCurrency}.`
                      : ""}
                  </p>
                )}
                {!providerAmountValid && hasAmount && (
                  <p className="text-xs text-destructive">
                    El importe actual no coincide con una recarga admitida por el proveedor. Ajusta
                    el pago al importe compatible antes de continuar.
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="sm:col-span-2 min-w-0 w-full">
            {isAgent && (
              <div className="rounded-2xl border-2 border-cyan-300 bg-cyan-50/90 p-3.5 sm:p-4 text-xs space-y-2 mb-3 shadow-2xs min-w-0 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-1.5 min-w-0">
                  <span className="font-black text-cyan-950 flex items-center gap-1.5 text-xs truncate">
                    <Smartphone className="size-4 shrink-0 text-cyan-700" /> Billetera de Recargas
                  </span>
                  <span className="font-black text-xs sm:text-sm text-cyan-950 bg-white px-2.5 py-1 rounded-xl border border-cyan-200 shadow-2xs shrink-0 font-mono">
                    {topupBalance.toLocaleString()} HTG
                  </span>
                </div>
                {receivedAmount != null && receivedAmount > topupBalance ? (
                  <p className="text-rose-800 font-bold bg-rose-100/90 p-2.5 rounded-xl border border-rose-300 break-words">
                    ⚠️ Saldo insuficiente: Tienes {topupBalance.toLocaleString()} HTG y esta recarga requiere {receivedAmount.toLocaleString()} HTG. Sin saldo operativo no puedes enviar recargas.
                  </p>
                ) : (
                  <p className="text-cyan-800 font-semibold break-words">
                    Esta recarga se descontará directamente de tu Billetera de Recargas.
                  </p>
                )}
              </div>
            )}

            <Button
              className="w-full h-auto min-h-12 py-3 px-4 font-black text-xs sm:text-sm whitespace-normal text-center leading-snug break-words rounded-xl shadow-xs"
              disabled={
                !topupsEnabled ||
                sendMut.isPending ||
                !phoneCheck.ok ||
                (!isAdmin && !isAgent && profile?.kyc_status !== "approved") ||
                missingRate ||
                !providerAmountValid ||
                (isAgent && (topupBalance <= 0 || (receivedAmount != null && topupBalance < receivedAmount)))
              }
              onClick={() => sendMut.mutate()}
            >
              <Send className="mr-2 size-4 shrink-0" />
              <span>
                {!topupsEnabled
                  ? t("services.disabled_btn")
                  : sendMut.isPending
                    ? t("topup.sending")
                    : payMethod === "direct"
                      ? "⚡ Enviar recarga directa (Admin)"
                      : payMethod === "agent_wallet"
                        ? receivedAmount != null && topupBalance < receivedAmount
                          ? "Saldo insuficiente en Billetera de Recargas"
                          : `⚡ Enviar recarga con saldo (${receivedAmount?.toLocaleString() ?? amount} HTG)`
                        : payMethod === "oxxo"
                          ? t("topup.generate_oxxo")
                          : payMethod === "spei"
                            ? t("topup.generate_spei")
                            : t("topup.pay_card")}
              </span>
            </Button>
            <p className="mt-2 text-[11px] sm:text-xs text-slate-500 leading-relaxed break-words">
              {payMethod === "direct"
                ? "⚡ Transacción directa autorizada como Administrador: la recarga se procesa de inmediato en DingConnect sin cobro externo."
                : payMethod === "agent_wallet"
                  ? "📱 Modo Agente: La recarga se descontará de tu saldo operativo de recargas y se enviará de inmediato al teléfono de destino."
                  : t("topup.external_note")}
            </p>
          </div>
        </CardContent>
      </Card>

      {pendingResult?.mode === "checkout" && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle className="text-base">{t("topup.complete_payment")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">{t("topup.go_pay_desc")}</p>
            <Button asChild className="w-full">
              <a href={pendingResult.checkoutUrl} target="_blank" rel="noreferrer">
                {t("topup.go_pay")}
              </a>
            </Button>
          </CardContent>
        </Card>
      )}

      {pendingResult?.mode === "voucher" && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle className="text-base">{t("topup.oxxo_voucher_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("topup.oxxo_reference")}
              </p>
              <p className="mt-1 break-all font-display text-2xl font-bold tracking-wider">
                {pendingResult.voucher.reference}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => {
                  void navigator.clipboard.writeText(pendingResult.voucher.reference);
                  toast.success(t("topup.reference_copied"));
                }}
              >
                <Copy className="size-4" /> {t("topup.copy_reference")}
              </Button>
              {pendingResult.voucher.voucherUrl && (
                <Button size="sm" className="gap-2" asChild>
                  <a href={pendingResult.voucher.voucherUrl} target="_blank" rel="noreferrer">
                    {t("topup.view_receipt")}
                  </a>
                </Button>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{t("topup.oxxo_note")}</p>
          </CardContent>
        </Card>
      )}

      {pendingResult?.mode === "spei" && (
        <Card className="border-accent/40">
          <CardHeader>
            <CardTitle className="text-base">{t("topup.spei_title")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-xl bg-secondary p-4">
              <p className="text-xs font-semibold uppercase text-muted-foreground">
                {t("topup.clabe")}
              </p>
              <p className="mt-1 break-all font-display text-2xl font-bold tracking-wider">
                {pendingResult.spei.clabe}
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => {
                void navigator.clipboard.writeText(pendingResult.spei.clabe);
                toast.success(t("topup.clabe_copied"));
              }}
            >
              <Copy className="size-4" /> {t("topup.copy_clabe")}
            </Button>
            <p className="text-xs text-muted-foreground">{t("topup.spei_note")}</p>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border border-slate-200 shadow-sm w-full min-w-0">
        <CardHeader className="px-4 py-3 sm:px-6 sm:py-4">
          <CardTitle className="text-sm sm:text-base font-bold text-slate-900">{t("topup.history_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 px-4 pb-5 sm:px-6">
          {(topups ?? []).length === 0 && (
            <p className="py-4 text-xs sm:text-sm text-muted-foreground">{t("topup.no_history")}</p>
          )}
          {(topups ?? []).map((t2) => (
            <div
              key={t2.id}
              className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs sm:text-sm min-w-0 shadow-2xs"
            >
              <div className="min-w-0 flex-1">
                <p className="font-bold text-slate-900 truncate">
                  {t2.operator || t2.sku_code} · {t2.phone}
                </p>
                <p className="text-[11px] text-slate-500 truncate font-mono mt-0.5">
                  {t2.reference} · {shortDate(t2.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2.5 shrink-0 ml-auto sm:ml-0">
                <div className="text-right">
                  <p className="font-black text-slate-900 font-mono text-xs sm:text-sm">{money(Number(t2.amount), t2.currency)}</p>
                  <p className="text-[10px] text-slate-500">{t("topup.received")}</p>
                </div>
                <Badge variant={t2.status === "completed" ? "default" : "secondary"} className="shrink-0 text-[10px] sm:text-xs">
                  {STATUS_LABEL[t2.status] ?? t2.status}
                </Badge>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
