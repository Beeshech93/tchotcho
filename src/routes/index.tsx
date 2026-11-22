import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Timer,
  Wallet,
  Send,
  Smartphone,
  AlertTriangle,
  Lock,
  Zap,
  BadgePercent,
  Globe,
  Sparkles,
  ChevronDown,
  Download,
} from "lucide-react";

import logoAsset from "@/assets/tchotcho-logo.png";
import iconAsset from "@/assets/tchotcho-icon.png";
import { SocialLinks } from "@/components/SocialLinks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { quote, money } from "@/lib/remesa";
import { useCountries, useRate, useTopupRate, fallbackRate } from "@/hooks/useCorridors";
import { TOPUP_COUNTRIES, findTopupCountry } from "@/lib/topup-operators";
import { useI18n } from "@/lib/i18n";
import { useServicesConfig } from "@/hooks/useServicesConfig";
import { useBrand } from "@/hooks/useBrand";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { InstallAppCard } from "@/components/InstallAppCard";
import { AdBanner } from "@/components/AdBanner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      {
        title: "Tcho-Tcho — Envía dinero a casa sin sorpresas",
      },
      {
        name: "description",
        content:
          "Tipo de cambio claro, comisión visible antes de pagar y seguimiento en tiempo real hasta que tu familia recibe el dinero en Haití.",
      },
      {
        name: "keywords",
        content:
          "Tcho-Tcho, digital banking, remesas Haiti, enviar dinero a Haiti, MonCash, NatCash, recargas Digicel, Natcom",
      },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      {
        property: "og:title",
        content: "Tcho-Tcho — Envía dinero a casa sin sorpresas",
      },
      {
        property: "og:description",
        content:
          "Tipo de cambio claro, comisión visible antes de pagar y seguimiento en tiempo real hasta que tu familia recibe el dinero en Haití.",
      },
    ],
  }),
  component: Landing,
});

export function Landing() {
  const { t } = useI18n();
  const { currentBrand, logoSrc, isCustomBrand } = useBrand();
  const { isEnabled, getMessage } = useServicesConfig();
  const transfersEnabled = isEnabled("transfers");
  const topupsEnabled = isEnabled("topups");

  const [activeTab, setActiveTab] = useState("envios");

  useEffect(() => {
    if (!transfersEnabled && topupsEnabled && activeTab === "envios") {
      setActiveTab("recargas");
    } else if (transfersEnabled && !topupsEnabled && activeTab === "recargas") {
      setActiveTab("envios");
    }
  }, [transfersEnabled, topupsEnabled, activeTab]);

  const [origin, setOrigin] = useState("MX");
  const [destination, setDestination] = useState("HT");
  const [amount, setAmount] = useState("2000");

  const [topupOrigin, setTopupOrigin] = useState("MX");
  const [topupDestination, setTopupDestination] = useState("HT");
  const [topupOperator, setTopupOperator] = useState("Digicel");
  const [topupAmount, setTopupAmount] = useState("200");

  const { data: countries } = useCountries();

  const origins = (countries ?? []).filter((c) => c.is_origin);
  const destinations = (countries ?? []).filter((c) => c.is_destination && c.code !== "DO");
  const originCountry = origins.find((c) => c.code === origin);
  const destCountry = destinations.find((c) => c.code === destination);
  const sendCurrency = originCountry?.currency ?? "MXN";
  const receiveCurrency = destCountry?.currency ?? "HTG";
  const { data: cfg } = useRate(sendCurrency, receiveCurrency);

  const fbRate = fallbackRate(sendCurrency, receiveCurrency) ?? {
    rate: 7.2,
    fee_percent: 0,
    fee_fixed: 0,
    agent_commission_percent: 0.8,
  };
  const effectiveCfg = cfg && Number(cfg.rate) > 0 ? cfg : fbRate;

  const q = quote(Number(amount) || 0, effectiveCfg, {
    percent: currentBrand.settings?.feeMarkupPercent,
    fixed: currentBrand.settings?.feeMarkupFixed,
  });

  // Recargas
  const topupOriginCountry = origins.find((c) => c.code === topupOrigin);
  const topupSendCurrency = topupOriginCountry?.currency ?? "MXN";
  const topupDestCurrency =
    destinations.find((c) => c.code === topupDestination)?.currency ||
    (topupDestination === "HT"
      ? "HTG"
      : topupDestination === "DO"
        ? "DOP"
        : topupDestination === "CU"
          ? "CUP"
          : topupDestination === "US"
            ? "USD"
            : "HTG");

  const sameTopupCurrency = topupSendCurrency === topupDestCurrency;
  const { data: topupRateData } = useTopupRate(
    sameTopupCurrency ? undefined : topupSendCurrency,
    sameTopupCurrency ? undefined : topupDestCurrency,
  );
  const { data: fallbackRateData } = useRate(
    sameTopupCurrency ? undefined : topupSendCurrency,
    sameTopupCurrency ? undefined : topupDestCurrency,
  );
  const effectiveTopupRate = sameTopupCurrency
    ? 1
    : (topupRateData?.rate ?? fallbackRateData?.rate ?? 7.2);

  const topupAmountNum = Number(topupAmount) || 0;
  const topupReceived = effectiveTopupRate
    ? Math.round(topupAmountNum * Number(effectiveTopupRate) * 100) / 100
    : 0;

  return (
    <div className="min-h-screen bg-[#F8FAF9] text-slate-900 selection:bg-emerald-600 selection:text-white relative overflow-hidden pb-20 sm:pb-24">
      {/* Fondo con resplandor radial suave y luminoso */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[650px] z-0"
        style={{
          background:
            "radial-gradient(ellipse 95% 60% at 50% -10%, rgba(16, 185, 129, 0.12) 0%, rgba(248, 250, 249, 0) 75%)",
        }}
      />

      {/* TOP HEADER FIJO LUMINOSO Y ELEGANTE */}
      <header className="fixed top-0 inset-x-0 z-50 w-full bg-[#A7F3D0]/95 backdrop-blur-2xl border-b border-emerald-400/80 shadow-xs transition-all">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-3.5 py-2.5 sm:px-8 sm:py-3.5">
          {/* Logo Tcho-Tcho Oficial */}
          <Link
            to="/"
            className="group inline-flex items-center gap-2.5 sm:gap-3.5 rounded-2xl bg-white px-3 sm:px-5 py-2 sm:py-2.5 shadow-md shadow-emerald-950/10 border-2 border-emerald-400/80 hover:border-emerald-600 hover:shadow-lg hover:scale-105 active:scale-95 transition-all shrink-0"
            aria-label="Tcho-Tcho — Ir a Inicio"
          >
            <img
              src={iconAsset}
              alt="Tcho-Tcho"
              className="size-9 sm:size-11 object-contain shrink-0 group-hover:rotate-6 transition-transform"
            />
            <img
              src={logoAsset}
              alt="Tcho-Tcho"
              className="h-8 sm:h-10 w-auto object-contain shrink-0"
            />
          </Link>

          {/* Acciones de cabecera: Idioma, Iniciar sesión y Crear cuenta */}
          <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
            <LanguageSwitcher className="h-8 sm:h-9 rounded-full bg-white/95 border border-emerald-400/70 text-slate-900 hover:bg-white transition-all shadow-xs" />

            <Link
              to="/auth"
              className="hidden sm:inline-block text-xs sm:text-sm font-extrabold text-emerald-950 hover:text-emerald-800 transition-colors px-2 py-1"
            >
              {t("landing.signin")}
            </Link>

            <Link
              to="/auth"
              search={{ modo: "registro" }}
              className="rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black px-3.5 sm:px-5 py-1.5 sm:py-2 text-[11px] sm:text-sm shadow-sm hover:scale-[1.02] active:scale-[0.98] transition-all whitespace-nowrap"
            >
              {t("landing.signup")}
            </Link>
          </div>
        </div>
      </header>

      {/* HERO SECTION DE 2 COLUMNAS */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-6 sm:gap-10 px-4 pt-20 pb-12 sm:px-8 sm:pt-28 sm:pb-20 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pt-32 lg:pb-24">
        {/* COLUMNA IZQUIERDA: Titular, Subtítulo, Botones y Beneficios */}
        <div className="space-y-4 sm:space-y-6 flex flex-col items-center lg:items-start text-center lg:text-left">
          {/* Badge superior con punto pulsante */}
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200/90 px-3.5 py-1 sm:px-4 sm:py-1.5 text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-800 shadow-2xs">
            <span className="flex size-1.5 sm:size-2 rounded-full bg-emerald-500 animate-ping" />
            <span className="font-semibold text-slate-700">{t("landing.badge_fintech")}</span>
            <span className="text-emerald-600 font-black">·</span>
            <span className="text-emerald-700">{t("landing.badge_route")}</span>
          </div>

          {/* Botones de acción CTA modernos */}
          <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2.5 sm:gap-4 pt-0.5">
            <Link
              to="/auth"
              search={{ modo: "registro" }}
              className="group inline-flex items-center gap-2 sm:gap-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black px-5 py-2.5 sm:px-8 sm:py-4 text-xs sm:text-base shadow-md hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>{t("landing.start_now")}</span>
              <div className="grid size-5 sm:size-6 place-items-center rounded-full bg-white text-emerald-700 group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="size-3 sm:size-3.5" />
              </div>
            </Link>

            <Link
              to="/auth"
              className="inline-flex items-center rounded-full border-2 border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-bold px-4 py-2.5 sm:px-7 sm:py-4 text-xs sm:text-base shadow-2xs hover:border-slate-400 transition-all"
            >
              {t("landing.signin")}
            </Link>
          </div>

          {/* 3 Tarjetas de Beneficios compactas, limpias y claras */}
          <div className="grid grid-cols-3 gap-2 sm:gap-3 pt-1 w-full">
            <div className="rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 p-2 sm:p-4 shadow-xs space-y-1 sm:space-y-2 hover:border-emerald-500/50 hover:shadow-md transition-all group flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="grid size-7 sm:size-8 place-items-center rounded-lg sm:rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 group-hover:scale-110 transition shadow-2xs">
                <Zap className="size-3.5 sm:size-4" />
              </div>
              <div>
                <p className="font-black text-[11px] sm:text-sm text-slate-900 leading-tight">
                  {t("landing.benefit_flash")}
                </p>
                <p className="text-[9px] sm:text-[11px] text-slate-500 font-medium mt-0.5 hidden xs:block">
                  {t("landing.benefit_flash_desc")}
                </p>
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 p-2 sm:p-4 shadow-xs space-y-1 sm:space-y-2 hover:border-emerald-500/50 hover:shadow-md transition-all group flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="grid size-7 sm:size-8 place-items-center rounded-lg sm:rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 group-hover:scale-110 transition shadow-2xs">
                <ShieldCheck className="size-3.5 sm:size-4" />
              </div>
              <div>
                <p className="font-black text-[11px] sm:text-sm text-slate-900 leading-tight">
                  {t("landing.benefit_security")}
                </p>
                <p className="text-[9px] sm:text-[11px] text-slate-500 font-medium mt-0.5 hidden xs:block">
                  {t("landing.benefit_security_desc")}
                </p>
              </div>
            </div>

            <div className="rounded-xl sm:rounded-2xl bg-white border border-slate-200/90 p-2 sm:p-4 shadow-xs space-y-1 sm:space-y-2 hover:border-emerald-500/50 hover:shadow-md transition-all group flex flex-col items-center sm:items-start text-center sm:text-left">
              <div className="grid size-7 sm:size-8 place-items-center rounded-lg sm:rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 group-hover:scale-110 transition shadow-2xs">
                <BadgePercent className="size-3.5 sm:size-4" />
              </div>
              <div>
                <p className="font-black text-[11px] sm:text-sm text-slate-900 leading-tight">
                  {t("landing.benefit_rate")}
                </p>
                <p className="text-[9px] sm:text-[11px] text-slate-500 font-medium mt-0.5 hidden xs:block">
                  {t("landing.benefit_rate_desc")}
                </p>
              </div>
            </div>
          </div>

          {/* Social Proof y confianza */}
          <div className="flex items-center justify-center lg:justify-start gap-2.5 sm:gap-3 pt-0.5 text-xs text-slate-600">
            <div className="flex -space-x-1.5 sm:-space-x-2">
              <div className="grid size-6 sm:size-7 place-items-center rounded-full bg-slate-100 border-2 border-white text-[10px] sm:text-xs shadow-2xs">
                🇭🇹
              </div>
              <div className="grid size-6 sm:size-7 place-items-center rounded-full bg-slate-100 border-2 border-white text-[10px] sm:text-xs shadow-2xs">
                🇩🇴
              </div>
              <div className="grid size-6 sm:size-7 place-items-center rounded-full bg-slate-100 border-2 border-white text-[10px] sm:text-xs shadow-2xs">
                🇲🇽
              </div>
              <div className="grid size-6 sm:size-7 place-items-center rounded-full bg-emerald-100 border-2 border-white text-[9px] sm:text-[10px] font-black text-emerald-700 shadow-2xs">
                ★
              </div>
            </div>
            <div className="leading-tight text-left">
              <p className="font-black text-slate-900 text-[11px] sm:text-[12px] flex items-center gap-1.5">
                <span>4.9 / 5</span>
                <span className="text-emerald-600">★★★★★</span>
              </p>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium">{t("landing.social_proof")}</p>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: LA CALCULADORA DE REMESAS Y RECARGAS */}
        <div className="relative w-full">
          <div className="relative mx-auto w-full max-w-lg rounded-[28px] sm:rounded-[36px] bg-white border-2 border-slate-200/90 p-5 sm:p-7 shadow-xl backdrop-blur-2xl space-y-4 sm:space-y-5">
            {/* Tabs Enviar / Recargas con diseño claro, simple y limpio */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <button
                type="button"
                onClick={() => setActiveTab("envios")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 pb-2 text-sm font-extrabold transition-all relative",
                  activeTab === "envios" ? "text-emerald-700" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Send
                  className={cn(
                    "size-4",
                    activeTab === "envios" ? "text-emerald-600" : "text-slate-400",
                  )}
                />
                <span>{t("landing.tab_send")}</span>
                {activeTab === "envios" && (
                  <span className="absolute -bottom-3 inset-x-8 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("recargas")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 pb-2 text-sm font-extrabold transition-all relative",
                  activeTab === "recargas" ? "text-emerald-700" : "text-slate-500 hover:text-slate-800",
                )}
              >
                <Smartphone
                  className={cn(
                    "size-4",
                    activeTab === "recargas" ? "text-emerald-600" : "text-slate-400",
                  )}
                />
                <span>{t("landing.tab_topups")}</span>
                {activeTab === "recargas" && (
                  <span className="absolute -bottom-3 inset-x-8 h-0.5 bg-emerald-600 rounded-full" />
                )}
              </button>
            </div>

            {/* CONTENIDO TAB ENVIAR */}
            {activeTab === "envios" && (
              <div className="space-y-4 pt-1">
                {/* SELECTORES DESDE Y HACIA EN 2 COLUMNAS */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {t("landing.origin_country")}
                    </span>
                    <Select value={origin} onValueChange={setOrigin}>
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-2 border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600">
                        <SelectValue
                          placeholder={
                            originCountry
                              ? `${originCountry.flag} ${originCountry.name}`
                              : "🇲🇽 México"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-slate-200 text-slate-900">
                        {origins.map((c) => (
                          <SelectItem
                            key={c.code}
                            value={c.code}
                            className="text-xs font-semibold focus:bg-emerald-50 focus:text-emerald-900"
                          >
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {t("landing.dest_country")}
                    </span>
                    <Select value={destination} onValueChange={setDestination}>
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-2 border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600">
                        <SelectValue
                          placeholder={
                            destCountry ? `${destCountry.flag} ${destCountry.name}` : "🇭🇹 Haití"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-slate-200 text-slate-900">
                        {destinations.map((c) => (
                          <SelectItem
                            key={c.code}
                            value={c.code}
                            className="text-xs font-semibold focus:bg-emerald-50 focus:text-emerald-900"
                          >
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* CAMPO DE MONTO TÚ ENVÍAS */}
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t("landing.you_send_cur")} ({sendCurrency})
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="w-full h-14 rounded-xl bg-slate-50 border-2 border-slate-200 px-4 font-display text-2xl font-black text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                      {sendCurrency}
                    </span>
                  </div>
                </div>

                {/* DESGLOSE DE COSTOS */}
                <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-200/90 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium">{t("landing.exchange_rate")}</span>
                    <span className="font-bold text-slate-900 font-mono">
                      1 {sendCurrency} = {Number(effectiveCfg.rate).toFixed(4)} {receiveCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium">{t("landing.fee_label")}</span>
                    <span className="font-bold text-slate-900 font-mono">{sendCurrency} 0.00</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 pt-1.5 border-t border-slate-200">
                    <span className="font-bold text-slate-900">{t("landing.total_to_pay")}</span>
                    <span className="font-black text-slate-900 font-mono text-sm">
                      {money(Number(amount) || 0, sendCurrency)}
                    </span>
                  </div>
                </div>

                {/* DESTACADO INFERIOR: TU FAMILIA RECIBE (BANNER VERDE ESMERALDA VIVO DE ALTO CONTRASTE) */}
                <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 p-4 text-white shadow-md border border-emerald-500/30 flex flex-col justify-center">
                  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-100">
                    {t("landing.family_receives")}
                  </p>
                  <p className="mt-0.5 font-display text-3xl font-black tracking-tight text-white drop-shadow-xs">
                    {money(q.receives, receiveCurrency)}
                  </p>
                </div>
              </div>
            )}

            {/* CONTENIDO TAB RECARGAS */}
            {activeTab === "recargas" && (
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {t("landing.topup_pay_country")}
                    </span>
                    <Select value={topupOrigin} onValueChange={setTopupOrigin}>
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-2 border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-slate-200 text-slate-900">
                        {origins.map((c) => (
                          <SelectItem
                            key={c.code}
                            value={c.code}
                            className="text-xs font-semibold focus:bg-emerald-50 focus:text-emerald-900"
                          >
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {t("landing.topup_recharge_country")}
                    </span>
                    <Select value={topupDestination} onValueChange={setTopupDestination}>
                      <SelectTrigger className="h-11 rounded-xl bg-slate-50 border-2 border-slate-200 text-xs font-bold text-slate-900 focus:bg-white focus:ring-1 focus:ring-emerald-600 focus:border-emerald-600">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-2 border-slate-200 text-slate-900">
                        {TOPUP_COUNTRIES.map((c) => (
                          <SelectItem
                            key={c.code}
                            value={c.code}
                            className="text-xs font-semibold focus:bg-emerald-50 focus:text-emerald-900"
                          >
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    {t("landing.topup_amount")} ({topupSendCurrency})
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full h-14 rounded-xl bg-slate-50 border-2 border-slate-200 px-4 font-display text-2xl font-black text-slate-900 focus:bg-white focus:outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 transition"
                  />
                </div>

                <div className="space-y-2 rounded-xl bg-slate-50 border border-slate-200/90 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium">{t("landing.topup_rate")}</span>
                    <span className="font-bold text-slate-900 font-mono">
                      1 {topupSendCurrency} = {Number(effectiveTopupRate).toFixed(4)}{" "}
                      {topupDestCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="font-medium">{t("landing.fee_label")}</span>
                    <span className="font-bold text-slate-900 font-mono">0.00 {topupSendCurrency}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-800 p-4 text-white shadow-md border border-emerald-500/30">
                  <p className="text-[11px] font-black uppercase tracking-wider text-emerald-100">
                    {t("landing.phone_receives")}
                  </p>
                  <p className="mt-0.5 font-display text-3xl font-black tracking-tight text-white drop-shadow-xs">
                    {money(topupReceived, topupDestCurrency)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECCIÓN BENTO GRID DE TECNOLOGÍA & EXPERIENCIA CLARA Y MODERNA */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8 space-y-10">
        {/* Encabezado de la Sección */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-50 border border-emerald-200 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-800 shadow-2xs">
            <Sparkles className="size-3 text-emerald-600" />
            <span>{t("landing.infra_badge")}</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-slate-900 tracking-tight">
            {t("landing.infra_title_1")}{" "}
            <span className="bg-gradient-to-r from-emerald-600 to-emerald-800 bg-clip-text text-transparent">
              {t("landing.infra_title_2")}
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-600 font-medium">{t("landing.infra_desc")}</p>
        </div>

        {/* Bento Grid: 4 Cajas Ricas, Luminosas y Claras */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Bento Card 1 (7 cols): Acreditación Flash MonCash & NatCash con simulador */}
          <div className="lg:col-span-7 rounded-[32px] bg-white border-2 border-slate-200/90 p-7 sm:p-8 space-y-6 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                <Zap className="size-3.5 text-emerald-600" />
                <span>{t("landing.card1_speed")}</span>
              </div>
              <h3 className="font-display text-2xl font-black text-slate-900 pt-2">
                {t("landing.card1_title")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 max-w-md font-medium">
                {t("landing.card1_desc")}
              </p>
            </div>

            {/* Simulador visual de entrega en tiempo real */}
            <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-500">{t("landing.card1_sim_origin")}</span>
                <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                  {t("landing.card1_sim_status")}
                </span>
              </div>

              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 w-full rounded-full animate-pulse" />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-500" />
                  <span className="text-xs font-bold text-slate-800">MonCash Digicel</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-blue-500" />
                  <span className="text-xs font-bold text-slate-800">NatCash Natcom</span>
                </div>
                <span className="text-xs font-black text-emerald-700">
                  {t("landing.card1_sim_fee")}
                </span>
              </div>
            </div>
          </div>

          {/* Bento Card 2 (5 cols): Seguridad de Grado Bancario 100% Protegido */}
          <div className="lg:col-span-5 rounded-[32px] bg-white border-2 border-slate-200/90 p-7 sm:p-8 space-y-6 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                <span>{t("landing.card2_badge")}</span>
              </div>
              <h3 className="font-display text-2xl font-black text-slate-900">
                {t("landing.card2_title")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">{t("landing.card2_desc")}</p>
            </div>

            <div className="space-y-2.5 pt-1">
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
                <div className="grid size-7 place-items-center rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 font-black">
                  ✓
                </div>
                <span className="text-slate-800 font-semibold">{t("landing.card2_point1")}</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
                <div className="grid size-7 place-items-center rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 font-black">
                  ✓
                </div>
                <span className="text-slate-800 font-semibold">{t("landing.card2_point2")}</span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs">
                <div className="grid size-7 place-items-center rounded-lg bg-emerald-100 border border-emerald-300 text-emerald-800 font-black">
                  ✓
                </div>
                <span className="text-slate-800 font-semibold">{t("landing.card2_point3")}</span>
              </div>
            </div>
          </div>

          {/* Bento Card 3 (5 cols): Cobertura Global Sin Fronteras */}
          <div className="lg:col-span-5 rounded-[32px] bg-white border-2 border-slate-200/90 p-7 sm:p-8 space-y-5 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                <Globe className="size-3.5 text-emerald-600" />
                <span>{t("landing.card3_badge")}</span>
              </div>
              <h3 className="font-display text-2xl font-black text-slate-900">
                {t("landing.card3_title")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-600 font-medium">{t("landing.card3_desc")}</p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {[
                { name: "Estados Unidos", flag: "🇺🇸", cur: "USD" },
                { name: "México", flag: "🇲🇽", cur: "MXN" },
                { name: "Chile", flag: "🇨🇱", cur: "CLP" },
                { name: "Brasil", flag: "🇧🇷", cur: "BRL" },
                { name: "Canadá", flag: "🇨🇦", cur: "CAD" },
                { name: "Francia / Europa", flag: "🇫🇷", cur: "EUR" },
              ].map((c) => (
                <span
                  key={c.name}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-50 border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 shadow-2xs"
                >
                  <span>{c.flag}</span>
                  <span>{c.name}</span>
                  <span className="text-[10px] font-mono text-emerald-700 font-bold">{c.cur}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Bento Card 4 (7 cols): App Móvil Ultra-Moderna (PWA One-Click) */}
          <div className="lg:col-span-7 rounded-[32px] bg-white border-2 border-slate-200/90 p-7 sm:p-8 shadow-sm hover:border-emerald-500/50 hover:shadow-md transition-all">
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-between">
              <div className="space-y-3 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-3 py-1 rounded-full">
                  <Smartphone className="size-3.5 text-emerald-600" />
                  <span>{t("landing.card4_badge")}</span>
                </div>
                <h3 className="font-display text-2xl font-black text-slate-900">
                  {t("landing.card4_title")}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 max-w-sm font-medium">
                  {t("landing.card4_desc")}
                </p>

                <div className="flex flex-wrap items-center gap-3 pt-2 justify-center sm:justify-start">
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        const event = new CustomEvent("open-install-prompt");
                        window.dispatchEvent(event);
                      }
                    }}
                    className="inline-flex items-center gap-2.5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 text-xs sm:text-sm shadow-sm hover:scale-105 active:scale-95 transition-all"
                  >
                    <Download className="size-4" />
                    <span>{t("landing.card4_install_btn")}</span>
                  </button>

                  <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                    <span className="inline-block size-2 rounded-full bg-emerald-600" />
                    <span>{t("landing.card4_devices")}</span>
                  </div>
                </div>
              </div>

              {/* Mockup visual de la app en miniatura */}
              <div className="shrink-0 w-36 sm:w-44 rounded-2xl bg-slate-900 text-white border border-slate-800 p-3 shadow-xl text-center space-y-2 rotate-2 hover:rotate-0 transition-transform">
                <div className="size-11 mx-auto rounded-xl bg-white p-1 border border-white shadow-md flex items-center justify-center">
                  <img src={iconAsset} alt="Tcho-Tcho" className="size-9 object-contain" />
                </div>
                <p className="text-xs font-bold text-white">Tcho-Tcho</p>
                <div className="rounded-xl bg-black/60 p-2 space-y-1">
                  <p className="text-[9px] text-slate-400">{t("landing.card4_balance")}</p>
                  <p className="text-xs font-black text-emerald-400">$ 23,094.57</p>
                </div>
                <span className="inline-block text-[9px] text-emerald-400 font-bold">
                  {t("landing.card4_ready")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER FIJO VERDE ELEGANTE */}
      <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-emerald-400/80 bg-[#A7F3D0]/95 backdrop-blur-2xl py-2 px-3 text-center text-[11px] sm:text-xs text-emerald-950 shadow-md space-y-1">
        <div className="flex items-center justify-center gap-2">
          <SocialLinks iconSize="size-3.5" className="gap-1.5" />
        </div>
        <p className="font-bold">
          © {new Date().getFullYear()} Tcho-Tcho. {t("landing.rights_reserved")}
          <span className="mx-2 text-emerald-600 font-normal">|</span>
          <Link to="/privacidad" className="underline hover:text-emerald-800 font-extrabold transition-colors">
            {t("landing.privacy_policy")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
