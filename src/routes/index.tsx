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
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#02531C] selection:text-[#F2AC00] relative overflow-hidden">
      {/* Lujoso fondo con resplandor radial esmeralda profundo idéntico al diseño */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[850px] z-0"
        style={{
          background:
            "radial-gradient(ellipse 95% 70% at 50% -5%, #036B25 0%, #013D14 40%, #000000 85%)",
        }}
      />

      {/* TOP HEADER ELEGANTE */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        {/* Logo Tcho-Tcho Oficial bien destacado */}
        <Link
          to="/"
          className="group inline-flex items-center gap-2.5 sm:gap-3 rounded-full bg-white px-3.5 sm:px-4 py-2 shadow-[0_0_28px_rgba(242,172,0,0.4),0_6px_20px_rgba(0,0,0,0.35)] border-2 border-white hover:scale-105 active:scale-95 transition-all"
          aria-label="Tcho-Tcho — Ir a Inicio"
        >
          <img
            src={iconAsset}
            alt="Tcho-Tcho"
            className="size-7 sm:size-8 object-contain shrink-0 group-hover:rotate-6 transition-transform"
          />
          <img
            src={logoAsset}
            alt="Tcho-Tcho"
            className="h-6 sm:h-7 w-auto object-contain shrink-0"
          />
        </Link>

        {/* Acciones de cabecera: Idioma, Iniciar sesión y Crear cuenta */}
        <div className="flex items-center gap-3 sm:gap-4">
          <LanguageSwitcher className="h-9 rounded-full bg-white/[0.08] border border-white/15 px-3.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/[0.12] transition-all" />

          <Link
            to="/auth"
            className="text-xs sm:text-sm font-semibold text-white/90 hover:text-white transition-colors px-2 py-1"
          >
            {t("landing.signin")}
          </Link>

          <Link
            to="/auth"
            search={{ modo: "registro" }}
            className="rounded-full bg-white text-black font-extrabold px-5 py-2 text-xs sm:text-sm shadow-lg hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            {t("landing.signup")}
          </Link>
        </div>
      </header>

      {/* HERO SECTION DE 2 COLUMNAS */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pt-14 lg:pb-24">
        {/* COLUMNA IZQUIERDA: Titular, Subtítulo, Botones y Píldoras de Confianza */}
        <div className="space-y-6 sm:space-y-7">
          {/* Badge superior ultra-moderno con punto pulsante */}
          <div className="inline-flex items-center gap-2.5 rounded-full bg-gradient-to-r from-emerald-950/70 via-black/80 to-black/60 border border-emerald-500/35 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300 backdrop-blur-xl shadow-[0_0_20px_rgba(2,83,28,0.25)]">
            <span className="flex size-2 rounded-full bg-[#10B981] animate-ping" />
            <span className="font-semibold text-slate-200">{t("landing.badge_fintech")}</span>
            <span className="text-[#F2AC00] font-black">·</span>
            <span>{t("landing.badge_route")}</span>
          </div>



          {/* Botones de acción CTA modernos */}
          <div className="flex flex-wrap items-center gap-4 pt-1">
            <Link
              to="/auth"
              search={{ modo: "registro" }}
              className="group inline-flex items-center gap-3 rounded-full bg-white text-black font-black px-8 py-4 text-sm sm:text-base shadow-[0_12px_32px_rgba(255,255,255,0.25),0_0_40px_rgba(2,83,28,0.35)] hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              <span>{t("landing.start_now")}</span>
              <div className="grid size-6 place-items-center rounded-full bg-black text-white group-hover:translate-x-0.5 transition-transform">
                <ArrowRight className="size-3.5" />
              </div>
            </Link>

            <Link
              to="/auth"
              className="inline-flex items-center rounded-full border border-white/20 bg-white/[0.05] text-white font-bold px-7 py-4 text-sm sm:text-base backdrop-blur-xl hover:bg-white/[0.12] hover:border-white/35 transition-all"
            >
              {t("landing.signin")}
            </Link>
          </div>

          {/* 3 Tarjetas de Beneficios estilo Fintech Moderno */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/12 p-4 backdrop-blur-xl shadow-sm space-y-2 hover:border-[#F2AC00]/40 transition-all group">
              <div className="grid size-8 place-items-center rounded-xl bg-[#02531C] border border-[#F2AC00]/30 text-[#F2AC00] group-hover:scale-110 transition shadow-sm">
                <Zap className="size-4" />
              </div>
              <div>
                <p className="font-extrabold text-sm text-white">{t("landing.benefit_flash")}</p>
                <p className="text-[11px] text-slate-300 mt-0.5">{t("landing.benefit_flash_desc")}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/12 p-4 backdrop-blur-xl shadow-sm space-y-2 hover:border-emerald-400/40 transition-all group">
              <div className="grid size-8 place-items-center rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 group-hover:scale-110 transition shadow-sm">
                <ShieldCheck className="size-4" />
              </div>
              <div>
                <p className="font-extrabold text-sm text-white">{t("landing.benefit_security")}</p>
                <p className="text-[11px] text-slate-300 mt-0.5">{t("landing.benefit_security_desc")}</p>
              </div>
            </div>

            <div className="rounded-2xl bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/12 p-4 backdrop-blur-xl shadow-sm space-y-2 hover:border-[#F2AC00]/40 transition-all group">
              <div className="grid size-8 place-items-center rounded-xl bg-[#02531C] border border-[#F2AC00]/30 text-[#F2AC00] group-hover:scale-110 transition shadow-sm">
                <BadgePercent className="size-4" />
              </div>
              <div>
                <p className="font-extrabold text-sm text-white">{t("landing.benefit_rate")}</p>
                <p className="text-[11px] text-slate-300 mt-0.5">{t("landing.benefit_rate_desc")}</p>
              </div>
            </div>
          </div>

          {/* Social Proof y confianza */}
          <div className="flex items-center gap-3 pt-1 text-xs text-slate-300">
            <div className="flex -space-x-2">
              <div className="grid size-7 place-items-center rounded-full bg-slate-800 border-2 border-black text-xs shadow-sm">
                🇭🇹
              </div>
              <div className="grid size-7 place-items-center rounded-full bg-slate-700 border-2 border-black text-xs shadow-sm">
                🇩🇴
              </div>
              <div className="grid size-7 place-items-center rounded-full bg-slate-800 border-2 border-black text-xs shadow-sm">
                🇲🇽
              </div>
              <div className="grid size-7 place-items-center rounded-full bg-[#02531C] border-2 border-black text-[10px] font-black text-[#F2AC00]">
                ★
              </div>
            </div>
            <div className="leading-tight">
              <p className="font-bold text-white text-[12px] flex items-center gap-1.5">
                <span>4.9 / 5</span>
                <span className="text-[#F2AC00]">★★★★★</span>
              </p>
              <p className="text-[11px] text-slate-400">
                {t("landing.social_proof")}
              </p>
            </div>
          </div>
        </div>

        {/* COLUMNA DERECHA: LA CALCULADORA DE REMESAS Y RECARGAS */}
        <div className="relative">
          {/* Sombra de fondo para profundidad */}
          <div className="absolute -inset-4 rounded-[40px] bg-[#02531C]/30 blur-3xl pointer-events-none" />

          <div className="relative mx-auto w-full max-w-lg rounded-[36px] bg-[#0E1310]/95 border border-white/15 p-6 sm:p-7 shadow-[0_24px_64px_rgba(0,0,0,0.9)] backdrop-blur-2xl space-y-5">
            {/* Tabs Enviar / Recargas con diseño estilizado */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <button
                type="button"
                onClick={() => setActiveTab("envios")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 pb-1 text-sm font-extrabold transition-all relative",
                  activeTab === "envios" ? "text-white" : "text-slate-400 hover:text-white",
                )}
              >
                <Send
                  className={cn(
                    "size-4",
                    activeTab === "envios" ? "text-[#F2AC00]" : "text-slate-400",
                  )}
                />
                <span>{t("landing.tab_send")}</span>
                {activeTab === "envios" && (
                  <span className="absolute -bottom-4 inset-x-8 h-0.5 bg-[#F2AC00] rounded-full shadow-[0_0_8px_#F2AC00]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("recargas")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 pb-1 text-sm font-extrabold transition-all relative",
                  activeTab === "recargas" ? "text-white" : "text-slate-400 hover:text-white",
                )}
              >
                <Smartphone
                  className={cn(
                    "size-4",
                    activeTab === "recargas" ? "text-[#F2AC00]" : "text-slate-400",
                  )}
                />
                <span>{t("landing.tab_topups")}</span>
                {activeTab === "recargas" && (
                  <span className="absolute -bottom-4 inset-x-8 h-0.5 bg-[#F2AC00] rounded-full shadow-[0_0_8px_#F2AC00]" />
                )}
              </button>
            </div>

            {/* CONTENIDO TAB ENVIAR */}
            {activeTab === "envios" && (
              <div className="space-y-4 pt-1">
                {/* SELECTORES DESDE Y HACIA EN 2 COLUMNAS */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t("landing.origin_country")}
                    </span>
                    <Select value={origin} onValueChange={setOrigin}>
                      <SelectTrigger className="h-11 rounded-2xl bg-[#161D18] border border-white/15 text-xs font-bold text-white focus:ring-1 focus:ring-[#F2AC00]">
                        <SelectValue
                          placeholder={
                            originCountry
                              ? `${originCountry.flag} ${originCountry.name}`
                              : "🇲🇽 México"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121714] border border-white/15 text-white">
                        {origins.map((c) => (
                          <SelectItem
                            key={c.code}
                            value={c.code}
                            className="text-xs font-semibold focus:bg-[#02531C] focus:text-white"
                          >
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t("landing.dest_country")}
                    </span>
                    <Select value={destination} onValueChange={setDestination}>
                      <SelectTrigger className="h-11 rounded-2xl bg-[#161D18] border border-white/15 text-xs font-bold text-white focus:ring-1 focus:ring-[#F2AC00]">
                        <SelectValue
                          placeholder={
                            destCountry ? `${destCountry.flag} ${destCountry.name}` : "🇭🇹 Haití"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121714] border border-white/15 text-white">
                        {destinations.map((c) => (
                          <SelectItem
                            key={c.code}
                            value={c.code}
                            className="text-xs font-semibold focus:bg-[#02531C] focus:text-white"
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
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t("landing.you_send_cur")} ({sendCurrency})
                  </span>
                  <div className="relative">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                      className="w-full h-14 rounded-2xl bg-[#161D18] border border-white/15 px-4 font-display text-2xl font-black text-white focus:outline-none focus:border-[#F2AC00] focus:ring-1 focus:ring-[#F2AC00] transition"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      {sendCurrency}
                    </span>
                  </div>
                </div>

                {/* DESGLOSE DE COSTOS */}
                <div className="space-y-2 rounded-2xl bg-black/40 border border-white/5 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>{t("landing.exchange_rate")}</span>
                    <span className="font-bold text-white font-mono">
                      1 {sendCurrency} = {Number(effectiveCfg.rate).toFixed(4)} {receiveCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>{t("landing.fee_label")}</span>
                    <span className="font-bold text-white font-mono">{sendCurrency} 0.00</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-white/5">
                    <span className="font-bold text-white">{t("landing.total_to_pay")}</span>
                    <span className="font-black text-white font-mono text-sm">
                      {money(Number(amount) || 0, sendCurrency)}
                    </span>
                  </div>
                </div>

                {/* DESTACADO INFERIOR: TU FAMILIA RECIBE (BANNER VERDE ESMERALDA VIVO) */}
                <div className="rounded-2xl bg-[#00D084] p-4 text-black shadow-[0_12px_28px_rgba(0,208,132,0.45)] flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-black/80">
                    {t("landing.family_receives")}
                  </p>
                  <p className="mt-0.5 font-display text-3xl font-black tracking-tight text-black">
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
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t("landing.topup_pay_country")}
                    </span>
                    <Select value={topupOrigin} onValueChange={setTopupOrigin}>
                      <SelectTrigger className="h-11 rounded-2xl bg-[#161D18] border border-white/15 text-xs font-bold text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121714] border border-white/15 text-white">
                        {origins.map((c) => (
                          <SelectItem
                            key={c.code}
                            value={c.code}
                            className="text-xs font-semibold focus:bg-[#02531C]"
                          >
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {t("landing.topup_recharge_country")}
                    </span>
                    <Select value={topupDestination} onValueChange={setTopupDestination}>
                      <SelectTrigger className="h-11 rounded-2xl bg-[#161D18] border border-white/15 text-xs font-bold text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121714] border border-white/15 text-white">
                        {TOPUP_COUNTRIES.map((c) => (
                          <SelectItem
                            key={c.code}
                            value={c.code}
                            className="text-xs font-semibold focus:bg-[#02531C]"
                          >
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {t("landing.topup_amount")} ({topupSendCurrency})
                  </span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={topupAmount}
                    onChange={(e) => setTopupAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="w-full h-14 rounded-2xl bg-[#161D18] border border-white/15 px-4 font-display text-2xl font-black text-white focus:outline-none focus:border-[#F2AC00] transition"
                  />
                </div>

                <div className="space-y-2 rounded-2xl bg-black/40 border border-white/5 p-4 text-xs">
                  <div className="flex items-center justify-between text-slate-300">
                    <span>{t("landing.topup_rate")}</span>
                    <span className="font-bold text-white font-mono">
                      1 {topupSendCurrency} = {Number(effectiveTopupRate).toFixed(4)}{" "}
                      {topupDestCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>{t("landing.fee_label")}</span>
                    <span className="font-bold text-white font-mono">0.00 {topupSendCurrency}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#00D084] p-4 text-black shadow-[0_12px_28px_rgba(0,208,132,0.45)]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-black/80">
                    {t("landing.phone_receives")}
                  </p>
                  <p className="mt-0.5 font-display text-3xl font-black tracking-tight text-black">
                    {money(topupReceived, topupDestCurrency)}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECCIÓN BENTO GRID DE TECNOLOGÍA & EXPERIENCIA MODERNA */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8 space-y-10">
        {/* Encabezado de la Sección */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-emerald-950/60 border border-emerald-500/35 px-4 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300 backdrop-blur-xl shadow-sm">
            <Sparkles className="size-3 text-[#F2AC00]" />
            <span>{t("landing.infra_badge")}</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight">
            {t("landing.infra_title_1")}{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-[#F2AC00] to-white bg-clip-text text-transparent">
              {t("landing.infra_title_2")}
            </span>
          </h2>
          <p className="text-sm sm:text-base text-slate-300">
            {t("landing.infra_desc")}
          </p>
        </div>

        {/* Bento Grid: 4 Cajas Ricas e Interactivas */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Bento Card 1 (7 cols): Acreditación Flash MonCash & NatCash con simulador */}
          <div className="lg:col-span-7 rounded-[32px] bg-gradient-to-b from-[#131B15] to-[#0A0E0C] border border-emerald-500/25 p-7 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="absolute top-0 right-0 size-60 rounded-full bg-[#10B981]/15 blur-3xl pointer-events-none" />

            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-1">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#10B981] bg-[#02531C]/60 border border-[#10B981]/30 px-3 py-1 rounded-full shadow-sm">
                  <Zap className="size-3.5 text-[#F2AC00]" />
                  <span>{t("landing.card1_speed")}</span>
                </div>
                <h3 className="font-display text-2xl font-black text-white pt-2">
                  {t("landing.card1_title")}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-md">
                  {t("landing.card1_desc")}
                </p>
              </div>
            </div>

            {/* Simulador visual de entrega en tiempo real */}
            <div className="rounded-2xl bg-black/60 border border-white/10 p-4 space-y-3 relative z-10">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-slate-400">{t("landing.card1_sim_origin")}</span>
                <span className="text-[#10B981] font-bold flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-[#10B981] animate-ping" />
                  {t("landing.card1_sim_status")}
                </span>
              </div>

              <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#02531C] via-[#10B981] to-[#F2AC00] w-full rounded-full animate-pulse" />
              </div>

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-red-500 shadow-[0_0_8px_#ef4444]" />
                  <span className="text-xs font-bold text-white">MonCash Digicel</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="size-3 rounded-full bg-blue-500 shadow-[0_0_8px_#3b82f6]" />
                  <span className="text-xs font-bold text-white">NatCash Natcom</span>
                </div>
                <span className="text-xs font-extrabold text-[#F2AC00]">{t("landing.card1_sim_fee")}</span>
              </div>
            </div>
          </div>

          {/* Bento Card 2 (5 cols): Seguridad de Grado Bancario 100% Protegido */}
          <div className="lg:col-span-5 rounded-[32px] bg-gradient-to-b from-[#181E19] to-[#0A0D0B] border border-white/12 p-7 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden group hover:border-[#F2AC00]/40 transition-all">
            <div className="absolute top-0 right-0 size-48 rounded-full bg-[#F2AC00]/10 blur-3xl pointer-events-none" />

            <div className="space-y-2 relative z-10">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-[#F2AC00] bg-amber-500/10 border border-[#F2AC00]/30 px-3 py-1 rounded-full">
                <ShieldCheck className="size-3.5" />
                <span>{t("landing.card2_badge")}</span>
              </div>
              <h3 className="font-display text-2xl font-black text-white">
                {t("landing.card2_title")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300">
                {t("landing.card2_desc")}
              </p>
            </div>

            <div className="space-y-2.5 relative z-10 pt-1">
              <div className="flex items-center gap-3 rounded-xl bg-black/40 border border-white/5 p-3 text-xs">
                <div className="grid size-7 place-items-center rounded-lg bg-[#02531C] text-[#F2AC00] font-black">
                  ✓
                </div>
                <span className="text-slate-200 font-semibold">
                  {t("landing.card2_point1")}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-black/40 border border-white/5 p-3 text-xs">
                <div className="grid size-7 place-items-center rounded-lg bg-[#02531C] text-[#F2AC00] font-black">
                  ✓
                </div>
                <span className="text-slate-200 font-semibold">
                  {t("landing.card2_point2")}
                </span>
              </div>
              <div className="flex items-center gap-3 rounded-xl bg-black/40 border border-white/5 p-3 text-xs">
                <div className="grid size-7 place-items-center rounded-lg bg-[#02531C] text-[#F2AC00] font-black">
                  ✓
                </div>
                <span className="text-slate-200 font-semibold">
                  {t("landing.card2_point3")}
                </span>
              </div>
            </div>
          </div>

          {/* Bento Card 3 (5 cols): Cobertura Global Sin Fronteras */}
          <div className="lg:col-span-5 rounded-[32px] bg-gradient-to-b from-[#181E19] to-[#0A0D0B] border border-white/12 p-7 sm:p-8 space-y-5 shadow-2xl group hover:border-emerald-500/40 transition-all">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 rounded-full">
                <Globe className="size-3.5" />
                <span>{t("landing.card3_badge")}</span>
              </div>
              <h3 className="font-display text-2xl font-black text-white">
                {t("landing.card3_title")}
              </h3>
              <p className="text-xs sm:text-sm text-slate-300">
                {t("landing.card3_desc")}
              </p>
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
                  className="inline-flex items-center gap-1.5 rounded-xl bg-black/50 border border-white/10 px-3 py-1.5 text-xs font-semibold text-white shadow-sm"
                >
                  <span>{c.flag}</span>
                  <span>{c.name}</span>
                  <span className="text-[10px] font-mono text-emerald-400 font-bold">{c.cur}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Bento Card 4 (7 cols): App Móvil Ultra-Moderna (PWA One-Click) */}
          <div className="lg:col-span-7 rounded-[32px] bg-gradient-to-b from-[#131B15] to-[#0A0E0C] border border-emerald-500/25 p-7 sm:p-8 shadow-2xl relative overflow-hidden group hover:border-emerald-500/50 transition-all">
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-between relative z-10">
              <div className="space-y-3 text-center sm:text-left">
                <div className="inline-flex items-center gap-2 text-xs font-bold text-[#F2AC00] bg-amber-500/10 border border-[#F2AC00]/30 px-3 py-1 rounded-full">
                  <Smartphone className="size-3.5" />
                  <span>{t("landing.card4_badge")}</span>
                </div>
                <h3 className="font-display text-2xl font-black text-white">
                  {t("landing.card4_title")}
                </h3>
                <p className="text-xs sm:text-sm text-slate-300 max-w-sm">
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
                    className="inline-flex items-center gap-2.5 rounded-full bg-[#F2AC00] text-black font-black px-6 py-3 text-xs sm:text-sm shadow-[0_0_20px_rgba(242,172,0,0.35)] hover:bg-[#FBBF24] hover:scale-105 active:scale-95 transition-all"
                  >
                    <Download className="size-4" />
                    <span>{t("landing.card4_install_btn")}</span>
                  </button>

                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="inline-block size-2 rounded-full bg-emerald-400" />
                    <span>{t("landing.card4_devices")}</span>
                  </div>
                </div>
              </div>

              {/* Mockup visual de la app en miniatura */}
              <div className="shrink-0 w-36 sm:w-44 rounded-2xl bg-gradient-to-tr from-black to-[#052B11] border-2 border-[#F2AC00]/50 p-3 shadow-2xl text-center space-y-2 rotate-2 hover:rotate-0 transition-transform">
                <div className="size-11 mx-auto rounded-xl bg-white p-1 border border-white shadow-md flex items-center justify-center">
                  <img src={iconAsset} alt="Tcho-Tcho" className="size-9 object-contain" />
                </div>
                <p className="text-xs font-bold text-white">Tcho-Tcho</p>
                <div className="rounded-xl bg-black/60 p-2 space-y-1">
                  <p className="text-[9px] text-slate-400">{t("landing.card4_balance")}</p>
                  <p className="text-xs font-extrabold text-[#10B981]">$ 23,094.57</p>
                </div>
                <span className="inline-block text-[9px] text-[#F2AC00] font-semibold">
                  {t("landing.card4_ready")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER ELEGANTE */}
      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs text-slate-400 space-y-2">
        <p>© {new Date().getFullYear()} Tcho-Tcho. {t("landing.rights_reserved")}</p>
        <p>
          <Link to="/privacidad" className="underline hover:text-white transition-colors">
            {t("landing.privacy_policy")}
          </Link>
        </p>
      </footer>
    </div>
  );
}
