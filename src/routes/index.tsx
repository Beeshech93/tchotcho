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
} from "lucide-react";

import logoAsset from "@/assets/tchotcho-icon.png";
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
          "Tipo de cambio claro, comisión visible antes de pagar y seguimiento en tiempo real hasta que tu familia recibe el dinero en Haití o República Dominicana.",
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
          "Tipo de cambio claro, comisión visible antes de pagar y seguimiento en tiempo real hasta que tu familia recibe el dinero en Haití o República Dominicana.",
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
    rate: 7.20,
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
    : (topupRateData?.rate ?? fallbackRateData?.rate ?? 7.20);

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
          background: "radial-gradient(ellipse 95% 70% at 50% -5%, #036B25 0%, #013D14 40%, #000000 85%)",
        }}
      />

      {/* TOP HEADER ELEGANTE */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-5 py-6 sm:px-8">
        {/* Logo en cápsula de cristal redondeada */}
        <Link
          to="/"
          className="inline-flex items-center gap-2.5 rounded-full bg-white/[0.08] border border-white/15 px-4 py-2 backdrop-blur-md shadow-sm hover:bg-white/[0.12] transition-all"
        >
          <span className="grid size-6 place-items-center rounded-full bg-[#02531C] border border-[#F2AC00]/40 text-[#F2AC00] font-black text-xs shadow-sm">
            T
          </span>
          <span className="font-display font-bold text-sm tracking-tight text-white">
            Tcho-Tcho
          </span>
        </Link>

        {/* Acciones de cabecera: Idioma, Iniciar sesión y Crear cuenta */}
        <div className="flex items-center gap-3 sm:gap-4">
          <LanguageSwitcher className="h-9 rounded-full bg-white/[0.08] border border-white/15 px-3.5 text-xs font-semibold text-white backdrop-blur-md hover:bg-white/[0.12] transition-all" />

          <Link
            to="/auth"
            className="text-xs sm:text-sm font-semibold text-white/90 hover:text-white transition-colors px-2 py-1"
          >
            Iniciar sesión
          </Link>

          <Link
            to="/auth"
            search={{ modo: "registro" }}
            className="rounded-full bg-white text-black font-extrabold px-5 py-2 text-xs sm:text-sm shadow-lg hover:bg-slate-100 hover:scale-[1.02] active:scale-[0.98] transition-all"
          >
            Crear cuenta
          </Link>
        </div>
      </header>

      {/* HERO SECTION DE 2 COLUMNAS */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-10 px-5 pt-8 pb-16 sm:px-8 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:pt-14 lg:pb-24">
        
        {/* COLUMNA IZQUIERDA: Titular, Subtítulo, Botones y Píldoras de Confianza */}
        <div className="space-y-6 sm:space-y-8">
          {/* Badge superior */}
          <div className="inline-flex items-center gap-2 rounded-full bg-white/[0.08] border border-white/15 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-md shadow-sm">
            <span className="text-[#F2AC00] font-black">~</span>
            <span>América y Europa → Haití y R. Dominicana</span>
          </div>

          {/* Titular Principal */}
          <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.6rem] font-black tracking-tight text-white leading-[1.08] max-w-xl">
            Envía dinero a casa sin sorpresas
          </h1>

          {/* Subtítulo descriptivo */}
          <p className="max-w-xl text-base sm:text-lg text-slate-200/90 leading-relaxed font-normal">
            Tipo de cambio claro, comisión visible antes de pagar y seguimiento en tiempo real hasta que tu familia recibe el dinero en Haití o República Dominicana.
          </p>

          {/* Botones de acción CTA */}
          <div className="flex flex-wrap items-center gap-4 pt-2">
            <Link
              to="/auth"
              search={{ modo: "registro" }}
              className="inline-flex items-center gap-2 rounded-full bg-white text-black font-black px-7 py-3.5 text-sm sm:text-base shadow-[0_10px_30px_rgba(255,255,255,0.25)] hover:bg-slate-100 hover:scale-[1.03] active:scale-[0.98] transition-all"
            >
              <span>Enviar dinero</span>
              <ArrowRight className="size-4" />
            </Link>

            <Link
              to="/auth"
              className="inline-flex items-center rounded-full border border-white/30 bg-white/[0.04] text-white font-bold px-7 py-3.5 text-sm sm:text-base backdrop-blur-md hover:bg-white/15 transition-all"
            >
              Ya tengo cuenta
            </Link>
          </div>

          {/* 3 Tarjetas de Beneficios (En minutos, 100% Seguro, Tasa clara) */}
          <div className="grid grid-cols-3 gap-3 pt-3">
            <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-3.5 backdrop-blur-md shadow-sm space-y-1">
              <span className="font-extrabold text-xs sm:text-sm block text-white flex items-center gap-1.5">
                <span className="text-[#F2AC00]">⚡</span> En minutos
              </span>
              <span className="text-[11px] text-slate-300 block leading-tight">MonCash & NatCash</span>
            </div>

            <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-3.5 backdrop-blur-md shadow-sm space-y-1">
              <span className="font-extrabold text-xs sm:text-sm block text-white flex items-center gap-1.5">
                <span className="text-emerald-400">🔒</span> 100% Seguro
              </span>
              <span className="text-[11px] text-slate-300 block leading-tight">Cifrado punta a punta</span>
            </div>

            <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-3.5 backdrop-blur-md shadow-sm space-y-1">
              <span className="font-extrabold text-xs sm:text-sm block text-white flex items-center gap-1.5">
                <span className="text-[#F2AC00]">💸</span> Tasa clara
              </span>
              <span className="text-[11px] text-slate-300 block leading-tight">Sin costos ocultos</span>
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
                  activeTab === "envios"
                    ? "text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Send className={cn("size-4", activeTab === "envios" ? "text-[#F2AC00]" : "text-slate-400")} />
                <span>Enviar</span>
                {activeTab === "envios" && (
                  <span className="absolute -bottom-4 inset-x-8 h-0.5 bg-[#F2AC00] rounded-full shadow-[0_0_8px_#F2AC00]" />
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("recargas")}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 pb-1 text-sm font-extrabold transition-all relative",
                  activeTab === "recargas"
                    ? "text-white"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Smartphone className={cn("size-4", activeTab === "recargas" ? "text-[#F2AC00]" : "text-slate-400")} />
                <span>Recargas</span>
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
                      Desde
                    </span>
                    <Select value={origin} onValueChange={setOrigin}>
                      <SelectTrigger className="h-11 rounded-2xl bg-[#161D18] border border-white/15 text-xs font-bold text-white focus:ring-1 focus:ring-[#F2AC00]">
                        <SelectValue
                          placeholder={originCountry ? `${originCountry.flag} ${originCountry.name}` : "🇲🇽 México"}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121714] border border-white/15 text-white">
                        {origins.map((c) => (
                          <SelectItem key={c.code} value={c.code} className="text-xs font-semibold focus:bg-[#02531C] focus:text-white">
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Hacia
                    </span>
                    <Select value={destination} onValueChange={setDestination}>
                      <SelectTrigger className="h-11 rounded-2xl bg-[#161D18] border border-white/15 text-xs font-bold text-white focus:ring-1 focus:ring-[#F2AC00]">
                        <SelectValue
                          placeholder={destCountry ? `${destCountry.flag} ${destCountry.name}` : "🇭🇹 Haití"}
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121714] border border-white/15 text-white">
                        {destinations.map((c) => (
                          <SelectItem key={c.code} value={c.code} className="text-xs font-semibold focus:bg-[#02531C] focus:text-white">
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
                    Tú envías ({sendCurrency})
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
                    <span>Tipo de cambio</span>
                    <span className="font-bold text-white font-mono">
                      1 {sendCurrency} = {Number(effectiveCfg.rate).toFixed(4)} {receiveCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Comisión</span>
                    <span className="font-bold text-white font-mono">
                      {sendCurrency} 0.00
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300 pt-1 border-t border-white/5">
                    <span className="font-bold text-white">Total a pagar</span>
                    <span className="font-black text-white font-mono text-sm">
                      {money(Number(amount) || 0, sendCurrency)}
                    </span>
                  </div>
                </div>

                {/* DESTACADO INFERIOR: TU FAMILIA RECIBE (BANNER VERDE ESMERALDA VIVO) */}
                <div className="rounded-2xl bg-[#00D084] p-4 text-black shadow-[0_12px_28px_rgba(0,208,132,0.45)] flex flex-col justify-center">
                  <p className="text-[10px] font-black uppercase tracking-wider text-black/80">
                    Tu familia recibe
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
                      País de pago
                    </span>
                    <Select value={topupOrigin} onValueChange={setTopupOrigin}>
                      <SelectTrigger className="h-11 rounded-2xl bg-[#161D18] border border-white/15 text-xs font-bold text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121714] border border-white/15 text-white">
                        {origins.map((c) => (
                          <SelectItem key={c.code} value={c.code} className="text-xs font-semibold focus:bg-[#02531C]">
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      País de recarga
                    </span>
                    <Select value={topupDestination} onValueChange={setTopupDestination}>
                      <SelectTrigger className="h-11 rounded-2xl bg-[#161D18] border border-white/15 text-xs font-bold text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#121714] border border-white/15 text-white">
                        {TOPUP_COUNTRIES.map((c) => (
                          <SelectItem key={c.code} value={c.code} className="text-xs font-semibold focus:bg-[#02531C]">
                            {c.flag} {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Monto a recargar ({topupSendCurrency})
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
                    <span>Tasa de recarga</span>
                    <span className="font-bold text-white font-mono">
                      1 {topupSendCurrency} = {Number(effectiveTopupRate).toFixed(4)} {topupDestCurrency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-300">
                    <span>Comisión</span>
                    <span className="font-bold text-white font-mono">0.00 {topupSendCurrency}</span>
                  </div>
                </div>

                <div className="rounded-2xl bg-[#00D084] p-4 text-black shadow-[0_12px_28px_rgba(0,208,132,0.45)]">
                  <p className="text-[10px] font-black uppercase tracking-wider text-black/80">
                    El número recibe
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

      {/* SECCIÓN DE 3 TARJETAS GRANDES INFERIORES (Minutos, KYC, +30 países) */}
      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-16 sm:px-8">
        <div className="grid gap-5 sm:grid-cols-3">
          {/* Card 1: Minutos */}
          <div className="rounded-3xl bg-[#0D120E] border border-white/10 p-6 space-y-3 shadow-xl hover:border-emerald-500/40 transition group">
            <div className="grid size-12 place-items-center rounded-2xl bg-black/50 border border-[#F2AC00]/30 text-[#F2AC00] shadow-inner group-hover:scale-110 transition">
              <Timer className="size-6" />
            </div>
            <div>
              <h3 className="font-display text-xl font-black text-white">Minutos</h3>
              <p className="text-xs text-slate-400 mt-1">Entrega típica en MonCash & NatCash</p>
            </div>
          </div>

          {/* Card 2: KYC */}
          <div className="rounded-3xl bg-[#0D120E] border border-white/10 p-6 space-y-3 shadow-xl hover:border-emerald-500/40 transition group">
            <div className="grid size-12 place-items-center rounded-2xl bg-black/50 border border-emerald-500/30 text-emerald-400 shadow-inner group-hover:scale-110 transition">
              <ShieldCheck className="size-6" />
            </div>
            <div>
              <h3 className="font-display text-xl font-black text-white">KYC</h3>
              <p className="text-xs text-slate-400 mt-1">Identidad verificada y protección bancaria</p>
            </div>
          </div>

          {/* Card 3: +30 países */}
          <div className="rounded-3xl bg-[#0D120E] border border-white/10 p-6 space-y-3 shadow-xl hover:border-emerald-500/40 transition group">
            <div className="grid size-12 place-items-center rounded-2xl bg-black/50 border border-[#F2AC00]/30 text-[#F2AC00] shadow-inner group-hover:scale-110 transition">
              <Wallet className="size-6" />
            </div>
            <div>
              <h3 className="font-display text-xl font-black text-white">+30 países</h3>
              <p className="text-xs text-slate-400 mt-1">De origen en América, el Caribe y Europa</p>
            </div>
          </div>
        </div>
      </section>

      {/* INSTALADOR DE APLICACIÓN */}
      <section id="install-app" className="relative z-10 mx-auto max-w-2xl px-5 pb-20">
        <InstallAppCard />
      </section>

      {/* FOOTER ELEGANTE */}
      <footer className="relative z-10 border-t border-white/10 py-8 text-center text-xs text-slate-400 space-y-2">
        <p>© {new Date().getFullYear()} Tcho-Tcho. Todos los derechos reservados.</p>
        <p>
          <Link to="/privacidad" className="underline hover:text-white transition-colors">
            Política de Privacidad
          </Link>
        </p>
      </footer>
    </div>
  );
}
