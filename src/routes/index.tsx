import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import {
  ArrowRight,
  ShieldCheck,
  Timer,
  Wallet,
  TrendingUp,
  Send,
  Smartphone,
  AlertTriangle,
  Search,
  LayoutDashboard,
  BarChart3,
  Receipt,
  Users,
  Shield,
  ArrowRightLeft,
  Sparkles,
  ChevronRight,
  CheckCircle2,
} from "lucide-react";

import logoAsset from "@/assets/tchotcho-logo.png";
import faviconAsset from "@/assets/tchotcho-icon.png";
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
        title: "Tcho-Tcho | AI Fintech & Digital Banking App",
      },
      {
        name: "description",
        content:
          "Tcho-Tcho es tu billetera digital inteligente. Envía dinero a Haití y República Dominicana, gestiona tarjetas virtuales y realiza recargas en minutos.",
      },
      {
        name: "keywords",
        content:
          "Tcho-Tcho, digital banking, AI fintech, enviar dinero a Haiti, remesas Haiti, MonCash, NatCash",
      },
      { name: "robots", content: "index, follow, max-image-preview:large" },
      {
        property: "og:title",
        content: "Tcho-Tcho | AI Fintech & Digital Banking App",
      },
      {
        property: "og:description",
        content:
          "Tcho-Tcho es tu billetera digital inteligente. Envía dinero a Haití y República Dominicana, gestiona tarjetas virtuales y realiza recargas en minutos.",
      },
    ],
    links: [
      { rel: "canonical", href: "https://lajanrapid.app/" },
      { rel: "alternate", hreflang: "en", href: "https://lajanrapid.app/" },
      { rel: "alternate", hreflang: "es", href: "https://lajanrapid.app/es/" },
      { rel: "alternate", hreflang: "fr", href: "https://lajanrapid.app/fr/" },
      { rel: "alternate", hreflang: "ht", href: "https://lajanrapid.app/ht/" },
      { rel: "alternate", hreflang: "x-default", href: "https://lajanrapid.app/" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Lajan Rapid",
          url: "https://lajanrapid.app/",
          description:
            "Lajan Rapid is an international money transfer and remittance service connecting customers with recipients in Haiti.",
          knowsAbout: [
            "Money transfers",
            "Remittances",
            "Haiti money transfers",
            "USA to Haiti money transfer",
            "Canada to Haiti money transfer",
            "Mexico to Haiti money transfer",
            "Brazil to Haiti money transfer",
            "Chile to Haiti money transfer",
            "France to Haiti money transfer",
          ],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "Lajan Rapid",
          url: "https://lajanrapid.app/",
          // Solo los idiomas que la app realmente soporta (ver src/lib/i18n.tsx).
          inLanguage: ["en", "es", "fr", "ht"],
        }),
      },
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Service",
          name: "Lajan Rapid International Money Transfer",
          provider: {
            "@type": "Organization",
            name: "Lajan Rapid",
            url: "https://lajanrapid.app/",
          },
          serviceType: "Money transfer and remittance service",
          areaServed: ["United States", "Canada", "Mexico", "Brazil", "Chile", "France", "Haiti"],
          url: "https://lajanrapid.app/",
        }),
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
  const effectiveTab = activeTab;

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
    fee_percent: 1.5,
    fee_fixed: 15,
    agent_commission_percent: 0.8,
  };
  const effectiveCfg = cfg && Number(cfg.rate) > 0 ? cfg : fbRate;

  const q = quote(Number(amount), effectiveCfg, {
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
            : topupDestination === "JM"
              ? "JMD"
              : topupDestination === "BR"
                ? "BRL"
                : topupDestination === "CO"
                  ? "COP"
                  : "HTG");
  const topupCountryInfo = findTopupCountry(topupDestination);

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
    : (topupRateData?.rate ?? fallbackRateData?.rate ?? 0);

  const topupAmountNum = Number(topupAmount) || 0;
  const topupReceived = effectiveTopupRate
    ? Math.round(topupAmountNum * Number(effectiveTopupRate) * 100) / 100
    : 0;

  return (
    <div className="min-h-screen bg-[#000000] text-white selection:bg-[#02531C] selection:text-white relative overflow-hidden">
      {/* Tech Grid Background idéntico al diseño */}
      <div
        className="pointer-events-none absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(255, 255, 255, 0.07) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(255, 255, 255, 0.07) 1px, transparent 1px)
          `,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Radiant Vertical Energy Beam (Colores de marca: Oro Cálido #F2AC00 & Esmeralda #02531C) */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 flex flex-col items-center z-0">
        <div className="w-[3px] h-[450px] bg-gradient-to-b from-transparent via-[#F2AC00] to-white shadow-[0_0_40px_#F2AC00,0_0_90px_#02531C]" />
        <div className="w-80 h-80 -mt-40 rounded-full bg-[#F2AC00]/30 blur-[100px]" />
        <div className="w-[500px] h-32 -mt-16 rounded-full bg-[#02531C]/40 blur-[80px]" />
      </div>

      {/* Resplandor del horizonte horizontal sobre el marco del dashboard */}
      <div className="pointer-events-none absolute left-1/2 top-[520px] -translate-x-1/2 w-full max-w-5xl h-[120px] bg-gradient-to-t from-[#F2AC00]/25 via-[#02531C]/35 to-transparent blur-3xl opacity-80 z-0" />

      {/* Header / Nav idéntico a la imagen */}
      <header className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-6">
        {/* Logo de marca */}
        <Link to="/" className="flex items-center gap-3">
          <div className="grid size-9 place-items-center rounded-xl bg-white/[0.08] border border-white/10 p-1.5 shadow-md">
            <img src={faviconAsset} alt="Tcho-Tcho" className="size-full object-contain" />
          </div>
          <span className="font-display font-bold text-lg tracking-tight text-white">
            Tcho-Tcho
          </span>
        </Link>

        {/* Floating Glass Pill Navigation Bar en el centro */}
        <nav className="hidden md:flex items-center gap-1 rounded-full bg-white/[0.05] border border-white/10 px-3 py-1.5 backdrop-blur-xl shadow-lg">
          <Link
            to="/"
            className="rounded-full bg-white/[0.12] px-4 py-1 text-xs font-semibold text-white shadow-sm transition-all"
          >
            Home
          </Link>
          <a
            href="#features"
            className="rounded-full px-4 py-1 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Features
          </a>
          <a
            href="#calculator"
            className="rounded-full px-4 py-1 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            Rates
          </a>
          <Link
            to="/faq"
            className="rounded-full px-4 py-1 text-xs font-medium text-slate-300 hover:text-white transition-colors"
          >
            FAQ
          </Link>
        </nav>

        {/* Acciones de usuario */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher className="hidden sm:inline-flex h-9 border-white/10 bg-white/[0.05] text-xs text-white rounded-full px-2.5" />
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="text-xs font-medium text-slate-300 hover:text-white hover:bg-white/[0.08] rounded-full px-3"
          >
            <Link to="/auth">{t("auth.signin")}</Link>
          </Button>
          <Button
            asChild
            size="sm"
            className="text-xs font-bold bg-gradient-to-r from-[#F2AC00] to-[#FBBF24] hover:from-[#E09E00] hover:to-[#F59E0B] text-black rounded-full px-4 shadow-lg shadow-[#F2AC00]/25 transition-all"
          >
            <Link to="/auth" search={{ modo: "registro" }}>
              Sign up
            </Link>
          </Button>
        </div>
      </header>

      {/* Hero Content Section */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 pt-12 pb-6 text-center space-y-6">
        {/* Pill Tagline */}
        <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] px-4 py-1.5 text-xs font-medium text-slate-300 backdrop-blur-md">
          <span>Finance Solution in One Platform</span>
          <ArrowRight className="size-3.5 text-[#F2AC00]" />
        </div>

        {/* Título Principal Fiel al Mockup */}
        <h1 className="font-display text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight text-white max-w-4xl mx-auto leading-[1.08]">
          Unlock The Power <br />
          <span className="text-white/95">Of Finance Analytics</span>
        </h1>

        {/* Subtítulo */}
        <p className="max-w-2xl mx-auto text-sm sm:text-base text-slate-400 leading-relaxed">
          Gain deep insights into your financial data and make smarter decisions.
          Turn numbers into strategies that drive growth and efficiency.
        </p>

        {/* Botón CTA Let's Get Started */}
        <div className="pt-2">
          <Button
            asChild
            size="lg"
            className="h-12 px-8 rounded-full bg-gradient-to-r from-[#F2AC00] via-[#FBBF24] to-[#F59E0B] text-black font-bold text-sm shadow-[0_10px_30px_rgba(242,172,0,0.35)] hover:scale-105 active:scale-95 transition-all"
          >
            <Link to="/auth" search={{ modo: "registro" }}>
              Let's Get Started
            </Link>
          </Button>
        </div>
      </section>

      {/* Dual Device Showcase (Laptop Dashboard + Mobile Mockup) Exacto a la imagen */}
      <section className="relative z-10 mx-auto max-w-6xl px-4 pt-4 pb-20">
        <div className="grid lg:grid-cols-[1fr_320px] gap-8 items-end">
          {/* 1. LAPTOP MOCKUP DASHBOARD */}
          <div className="relative rounded-t-[32px] border border-white/20 bg-[#121212] p-2.5 sm:p-3.5 shadow-[0_30px_80px_rgba(0,0,0,0.95)]">
            {/* Cámara y detalles de bisel de laptop */}
            <div className="mx-auto mb-2 flex items-center justify-center gap-1.5">
              <span className="size-1.5 rounded-full bg-white/20" />
            </div>

            {/* Pantalla interior del dashboard */}
            <div className="rounded-2xl border border-white/10 bg-[#0B0B0B] p-4 text-white overflow-hidden shadow-inner">
              {/* Barra superior de la pantalla */}
              <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-4 text-xs">
                <div className="flex items-center gap-2 text-slate-400">
                  <span>Pages</span>
                  <span>&gt;</span>
                  <span className="text-white font-semibold">Dashboard</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-slate-500" />
                    <input
                      type="text"
                      readOnly
                      placeholder="Search..."
                      className="h-7 w-32 rounded-lg bg-white/[0.06] border border-white/10 pl-7 text-[10px] text-white placeholder:text-slate-500"
                    />
                  </div>
                  <div className="size-6 rounded-full bg-gradient-to-br from-[#02531C] to-[#10B981] p-0.5">
                    <div className="size-full rounded-full bg-[#000000] grid place-items-center text-[10px] font-bold text-[#F2AC00]">
                      T
                    </div>
                  </div>
                </div>
              </div>

              {/* Layout interior: Mini Sidebar + Contenido */}
              <div className="grid grid-cols-[140px_1fr] gap-4">
                {/* Mini Sidebar */}
                <div className="space-y-1 border-r border-white/10 pr-3 text-[11px]">
                  <div className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-[#02531C] to-[#043E16] px-2.5 py-1.5 text-white font-semibold shadow-sm">
                    <LayoutDashboard className="size-3.5 text-[#F2AC00]" />
                    <span>Dashboard</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-white">
                    <BarChart3 className="size-3.5" />
                    <span>Analytics</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-white">
                    <Receipt className="size-3.5" />
                    <span>Receipts</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-white">
                    <Users className="size-3.5" />
                    <span>Payers</span>
                  </div>
                  <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-slate-400 hover:text-white">
                    <Shield className="size-3.5" />
                    <span>Trade</span>
                  </div>
                </div>

                {/* Dashboard Cards Row con Sparklines fieles a la imagen */}
                <div className="space-y-3">
                  <div>
                    <h4 className="text-xs font-bold text-white">Overview</h4>
                    <p className="text-[10px] text-slate-400">Here is the summary of overall data</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {/* Card 1: My Balance (Destacada en Radiant Gradient) */}
                    <div className="rounded-xl bg-gradient-to-br from-[#02531C] via-[#056824] to-[#043314] border border-[#F2AC00]/40 p-3 text-white shadow-lg space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-white/80">My balance</span>
                        <Wallet className="size-3 text-[#F2AC00]" />
                      </div>
                      <p className="text-sm font-extrabold tracking-tight">$7,828.88</p>
                      {/* Sparkline SVG */}
                      <svg className="w-full h-5 mt-1" viewBox="0 0 100 25" fill="none">
                        <path
                          d="M0 20 Q 20 8, 40 14 T 80 5 T 100 2"
                          stroke="#F2AC00"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    {/* Card 2: Savings Account */}
                    <div className="rounded-xl bg-[#141414] border border-white/10 p-3 text-white space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-slate-400">Savings account</span>
                        <Smartphone className="size-3 text-slate-400" />
                      </div>
                      <p className="text-sm font-extrabold tracking-tight text-white">$1,360.60</p>
                      {/* Sparkline SVG */}
                      <svg className="w-full h-5 mt-1" viewBox="0 0 100 25" fill="none">
                        <path
                          d="M0 18 Q 30 15, 60 8 T 100 4"
                          stroke="#10B981"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>

                    {/* Card 3: Investment Portfolio */}
                    <div className="rounded-xl bg-[#141414] border border-white/10 p-3 text-white space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-medium text-slate-400">Investment</span>
                        <TrendingUp className="size-3 text-slate-400" />
                      </div>
                      <p className="text-sm font-extrabold tracking-tight text-white">$31,258.85</p>
                      {/* Sparkline SVG */}
                      <svg className="w-full h-5 mt-1" viewBox="0 0 100 25" fill="none">
                        <path
                          d="M0 22 Q 25 18, 50 10 T 100 6"
                          stroke="#FBBF24"
                          strokeWidth="2"
                          fill="none"
                          strokeLinecap="round"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 2. MOBILE PHONE MOCKUP STANDING BESIDE IT */}
          <div className="relative mx-auto w-full max-w-[300px] rounded-[38px] border-4 border-white/20 bg-[#0E0E0E] p-3 shadow-[0_25px_60px_rgba(0,0,0,0.9)] text-white">
            {/* Dynamic Island / Bocina */}
            <div className="mx-auto mb-3 h-4 w-20 rounded-full bg-black flex items-center justify-between px-2">
              <span className="size-2 rounded-full bg-slate-800" />
              <span className="size-2 rounded-full bg-slate-900" />
            </div>

            <div className="space-y-3 px-1">
              {/* Badge */}
              <div className="inline-block rounded-full bg-white/[0.08] px-3 py-1 text-[10px] font-medium text-slate-300">
                Some of features
              </div>

              {/* Título Mobile */}
              <h3 className="text-sm font-bold tracking-tight text-white leading-tight">
                Transforming your financial operations effortlessly.
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Streamline and master your finances with Tcho-Tcho, built to make financial management effortless.
              </p>

              {/* Currency Swap Card Widget */}
              <div className="rounded-2xl bg-[#161616] border border-white/10 p-3 space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">You Send (USD)</span>
                  <span className="font-bold text-white">0.073986</span>
                </div>

                {/* Circular Swap Button */}
                <div className="flex justify-center -my-1">
                  <div className="grid size-6 place-items-center rounded-full bg-[#02531C] border border-[#F2AC00]/40 text-[#F2AC00] shadow-md">
                    <ArrowRightLeft className="size-3" />
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Receive (HTG)</span>
                  <span className="font-bold text-[#F2AC00]">12,450.00</span>
                </div>

                <button
                  type="button"
                  className="w-full h-8 rounded-xl bg-gradient-to-r from-[#F2AC00] to-[#FBBF24] text-black font-bold text-xs shadow-md mt-1"
                >
                  Send Now
                </button>
              </div>

              {/* Feature card */}
              <div className="rounded-2xl bg-[#141414] border border-white/5 p-2.5 text-[10px] space-y-1">
                <p className="font-bold text-white">Keep Smart Asset Tracking</p>
                <p className="text-slate-400 text-[9px]">
                  Empower your portfolio insights with automated real-time updates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CALCULATOR / INTERACTIVE REMITTANCE SECTION */}
      <section id="calculator" className="relative z-10 mx-auto max-w-4xl px-4 pb-20">
        <div className="text-center mb-6 space-y-1">
          <h2 className="text-2xl font-bold text-white">Envía dinero o Recarga en segundos</h2>
          <p className="text-xs text-slate-400">Calcula tu remesa a Haití y República Dominicana con las mejores tasas garantizadas.</p>
        </div>

        <Card className="relative mx-auto w-full border-white/10 shadow-2xl bg-[#0D0D0D]/95 backdrop-blur-xl rounded-3xl">
              <CardContent className="space-y-4 p-5 sm:p-6">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="grid w-full grid-cols-2 rounded-xl bg-secondary/80 p-1 mb-4">
                    <TabsTrigger
                      value="envios"
                      className="gap-2 rounded-lg py-2 font-semibold text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-soft"
                    >
                      <Send className="size-4 text-accent" />
                      <span>{t("nav.send")}</span>
                      {!transfersEnabled && (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] px-1.5 py-0 leading-none">
                          {t("services.disabled_badge")}
                        </Badge>
                      )}
                    </TabsTrigger>
                    <TabsTrigger
                      value="recargas"
                      className="gap-2 rounded-lg py-2 font-semibold text-xs sm:text-sm data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-soft"
                    >
                      <Smartphone className="size-4 text-accent" />
                      <span>{t("nav.topups")}</span>
                      {!topupsEnabled && (
                        <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] px-1.5 py-0 leading-none">
                          {t("services.disabled_badge")}
                        </Badge>
                      )}
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="envios" className="space-y-4 mt-0">
                    {!transfersEnabled ? (
                      <div className="space-y-4 py-8 text-center animate-in fade-in duration-200">
                        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
                          <AlertTriangle className="size-7" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                            {t("services.disabled_badge")}
                          </h3>
                          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
                            {getMessage("transfers") || t("services.disabled_alert")}
                          </p>
                        </div>
                        <Button disabled className="w-full bg-muted text-muted-foreground cursor-not-allowed">
                          {t("services.disabled_btn")}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("landing.from")}
                            </span>
                            <Select value={origin} onValueChange={setOrigin}>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    originCountry
                                      ? `${originCountry.flag} ${originCountry.name}`
                                      : "🇲🇽 México"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {origins.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.flag} {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("landing.to")}
                            </span>
                            <Select value={destination} onValueChange={setDestination}>
                              <SelectTrigger>
                                <SelectValue
                                  placeholder={
                                    destCountry ? `${destCountry.flag} ${destCountry.name}` : "🇭🇹 Haití"
                                  }
                                />
                              </SelectTrigger>
                              <SelectContent>
                                {destinations.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.flag} {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div>
                          <label
                            htmlFor="monto"
                            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {t("landing.you_send")} ({sendCurrency})
                          </label>
                          <Input
                            id="monto"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                            className="mt-1 h-14 font-display text-2xl font-bold"
                          />
                        </div>
                        <div className="space-y-1.5 rounded-xl bg-secondary p-4 text-sm">
                          <Row
                            label={t("landing.rate")}
                            value={`1 ${sendCurrency} = ${Number(effectiveCfg.rate).toFixed(4)} ${receiveCurrency}`}
                          />
                          <Row label={t("landing.fee")} value={money(q.fee, sendCurrency)} />
                          <Row label={t("landing.total")} value={money(q.total, sendCurrency)} strong />
                        </div>
                        <div className="relative overflow-hidden rounded-2xl bg-mint p-4 text-white shadow-lg shadow-emerald-950/25 border border-emerald-400/25">
                          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100/90">
                            {t("landing.family_gets")}
                          </p>
                          <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white">
                            {money(q.receives, receiveCurrency)}
                          </p>
                        </div>
                      </>
                    )}
                  </TabsContent>

                  <TabsContent value="recargas" className="space-y-4 mt-0">
                    {!topupsEnabled ? (
                      <div className="space-y-4 py-8 text-center animate-in fade-in duration-200">
                        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-amber-500/15 text-amber-500">
                          <AlertTriangle className="size-7" />
                        </div>
                        <div className="space-y-2">
                          <h3 className="font-display text-xl font-bold tracking-tight text-foreground">
                            {t("services.disabled_badge")}
                          </h3>
                          <p className="mx-auto max-w-sm text-sm leading-relaxed text-muted-foreground">
                            {getMessage("topups") || t("services.disabled_alert")}
                          </p>
                        </div>
                        <Button disabled className="w-full bg-muted text-muted-foreground cursor-not-allowed">
                          {t("services.disabled_btn")}
                        </Button>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("topup.pay_country")}
                            </span>
                            <Select value={topupOrigin} onValueChange={setTopupOrigin}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {origins.map((c) => (
                                  <SelectItem key={c.code} value={c.code}>
                                    {c.flag} {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("topup.number_country")}
                            </span>
                            <Select
                              value={topupDestination}
                              onValueChange={(val) => {
                                setTopupDestination(val);
                                const info = findTopupCountry(val);
                                if (info?.operators[0]) setTopupOperator(info.operators[0]);
                              }}
                            >
                              <SelectTrigger>
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
                        </div>

                        {topupCountryInfo?.operators && topupCountryInfo.operators.length > 0 && (
                          <div className="space-y-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {t("topup.choose_operator")}
                            </span>
                            <Select value={topupOperator} onValueChange={setTopupOperator}>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {topupCountryInfo.operators.map((op) => (
                                  <SelectItem key={op} value={op}>
                                    {op}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div>
                          <label
                            htmlFor="monto-recarga"
                            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                          >
                            {t("topup.amount_to_pay")} ({topupSendCurrency})
                          </label>
                          <Input
                            id="monto-recarga"
                            inputMode="decimal"
                            value={topupAmount}
                            onChange={(e) => setTopupAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                            className="mt-1 h-14 font-display text-2xl font-bold"
                          />
                        </div>

                        <div className="space-y-1.5 rounded-xl bg-secondary p-4 text-sm">
                          <Row
                            label={t("landing.rate")}
                            value={
                              effectiveTopupRate
                                ? `1 ${topupSendCurrency} = ${Number(effectiveTopupRate).toFixed(4)} ${topupDestCurrency}`
                                : t("landing.unavailable")
                            }
                          />
                          <Row label={t("landing.fee")} value={money(0, topupSendCurrency)} />
                          <Row
                            label={t("landing.total")}
                            value={money(topupAmountNum, topupSendCurrency)}
                            strong
                          />
                        </div>

                        <div className="relative overflow-hidden rounded-2xl bg-mint p-4 text-white shadow-lg shadow-emerald-950/25 border border-emerald-400/25">
                          <p className="text-xs font-semibold uppercase tracking-wider text-emerald-100/90">
                            {t("topup.recipient_gets")}
                          </p>
                          <p className="mt-1 font-display text-3xl font-extrabold tracking-tight text-white">
                            {money(topupReceived, topupDestCurrency)}
                          </p>
                        </div>
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </section>

      <section className="mx-auto -mt-12 max-w-6xl px-5 pb-20">
        <dl className="grid gap-4 sm:grid-cols-3">
          <Stat
            icon={Timer}
            title={t("landing.stat_minutes")}
            desc={t("landing.stat_minutes_desc")}
          />
          <Stat icon={ShieldCheck} title="KYC" desc={t("landing.stat_kyc_desc")} />
          <Stat
            icon={Wallet}
            title={t("landing.stat_countries")}
            desc={t("landing.stat_countries_desc")}
          />
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-10">
        <AdBanner />
      </section>

      <section id="install-app" className="mx-auto max-w-2xl px-5 pb-20">
        <InstallAppCard />
      </section>

      <footer className="border-t border-white/10 py-8 text-center text-xs text-slate-400 space-y-2">
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

function Stat({ icon: Icon, title, desc }: { icon: typeof Timer; title: string; desc: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <span className="grid size-10 place-items-center rounded-xl bg-accent/15 text-accent">
        <Icon className="size-5" />
      </span>
      <dt className="mt-4 font-display text-lg font-semibold">{title}</dt>
      <dd className="mt-1 text-sm text-muted-foreground">{desc}</dd>
    </div>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={strong ? "font-semibold" : ""}>{value}</span>
    </div>
  );
}
