export type TransferStatus =
  | "created"
  | "awaiting_payment"
  | "paid"
  | "processing"
  | "ready_for_pickup"
  | "completed"
  | "cancelled";

export const STATUS_LABEL: Record<TransferStatus, string> = {
  created: "Creado",
  awaiting_payment: "Esperando pago",
  paid: "Pago confirmado",
  processing: "En proceso",
  ready_for_pickup: "Listo para retirar",
  completed: "Entregado",
  cancelled: "Cancelado",
};

export const STATUS_TONE: Record<TransferStatus, string> = {
  created: "bg-slate-100 text-slate-800 border border-slate-300 font-bold",
  awaiting_payment: "bg-amber-50 text-amber-900 border border-amber-300 font-bold",
  paid: "bg-blue-50 text-blue-900 border border-blue-300 font-bold",
  processing: "bg-purple-50 text-purple-900 border border-purple-300 font-bold",
  ready_for_pickup: "bg-cyan-50 text-cyan-900 border border-cyan-300 font-bold",
  completed: "bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold",
  cancelled: "bg-rose-50 text-rose-900 border border-rose-300 font-bold",
};

export const STATUS_FLOW: TransferStatus[] = ["awaiting_payment", "processing", "completed"];

export type KycStatus = "none" | "pending" | "approved" | "rejected";

export const KYC_LABEL: Record<KycStatus, string> = {
  none: "Sin verificar",
  pending: "En revisión",
  approved: "Verificado",
  rejected: "Rechazado",
};

export const KYC_TONE: Record<KycStatus, string> = {
  none: "bg-slate-100 text-slate-800 border border-slate-300 font-semibold",
  pending: "bg-amber-50 text-amber-900 border border-amber-300 font-bold",
  approved: "bg-emerald-50 text-emerald-900 border border-emerald-300 font-bold",
  rejected: "bg-rose-50 text-rose-900 border border-rose-300 font-bold",
};

export type Country = {
  code: string;
  name: string;
  currency: string;
  flag: string;
  is_origin: boolean;
  is_destination: boolean;
  is_active: boolean;
};

/* ---------- Métodos de pago por país de origen ---------- */

type Method = { value: string; label: string; hint: string };

export const PAYMENT_CATALOG: Record<string, Method> = {
  oxxo: { value: "oxxo", label: "OXXO", hint: "Pago en efectivo en tienda" },
  mercado_pago: { value: "mercado_pago", label: "Mercado Pago", hint: "Saldo o tarjeta" },
  spei: { value: "spei", label: "Transferencia SPEI", hint: "Desde tu banco" },
  card: { value: "card", label: "Tarjeta", hint: "Visa / Mastercard, pago seguro" },
  ach: { value: "ach", label: "Transferencia ACH", hint: "Desde tu banco en EE.UU." },
  zelle: { value: "zelle", label: "Zelle", hint: "Envío instantáneo" },
  interac: { value: "interac", label: "Interac e-Transfer", hint: "Bancos de Canadá" },
  pix: { value: "pix", label: "Pix", hint: "Instantáneo en Brasil" },
  sepa: { value: "sepa", label: "Transferencia SEPA", hint: "Bancos de la zona euro" },
  faster_payments: {
    value: "faster_payments",
    label: "Faster Payments",
    hint: "Bancos del Reino Unido",
  },
  bank_transfer: {
    value: "bank_transfer",
    label: "Transferencia bancaria",
    hint: "Desde tu banco",
  },
  cash_agent: {
    value: "cash_agent",
    label: "Efectivo con agente",
    hint: "Solo pago en efectivo en ventanilla de agente",
  },
};

// México procesa exclusivamente mediante Mercado Pago (tarjeta, SPEI, OXXO, saldo MP).
// Todos los demás países procesan exclusivamente mediante Stripe (tarjeta Visa / Mastercard).
const DEFAULT_PAYMENTS = ["card"];

const PAYMENTS_BY_COUNTRY: Record<string, string[]> = {
  MX: ["card", "spei", "oxxo", "mercado_pago"],
  DO: ["card"],
  US: ["card"],
  CA: ["card"],
  BR: ["card"],
  ES: ["card"],
  FR: ["card"],
  DE: ["card"],
  IT: ["card"],
  PT: ["card"],
  NL: ["card"],
  BE: ["card"],
  CH: ["card"],
  GB: ["card"],
  CL: ["card"],
};

export function paymentMethods(countryCode: string | undefined): Method[] {
  const keys = (countryCode && PAYMENTS_BY_COUNTRY[countryCode]) || DEFAULT_PAYMENTS;
  return keys.map((k) => PAYMENT_CATALOG[k]!).filter(Boolean);
}

export function paymentLabel(value: string): string {
  return PAYMENT_CATALOG[value]?.label ?? value;
}

/* ---------- Entrega y ciudades por país de destino ---------- */

export const DELIVERY_CATALOG: Record<string, Method> = {
  moncash: {
    value: "moncash",
    label: "MonCash",
    hint: "Billetera móvil Digicel (máx. 75,000 HTG)",
  },
  natcash: {
    value: "natcash",
    label: "NatCash (Natcom)",
    hint: "Min 3,998 HTG · Max 75,000 HTG per transaction · whole numbers only",
  },
};

export const DELIVERY_KEYS = ["moncash", "natcash"] as const;

export function deliveryMethods(_countryCode?: string | undefined): Method[] {
  return DELIVERY_KEYS.map((k) => DELIVERY_CATALOG[k]!);
}

export function deliveryLabel(value: string): string {
  return DELIVERY_CATALOG[value]?.label ?? value;
}

export const CITIES_BY_COUNTRY: Record<string, string[]> = {
  HT: [
    "Port-au-Prince",
    "Cap-Haïtien",
    "Gonaïves",
    "Les Cayes",
    "Jacmel",
    "Jérémie",
    "Hinche",
    "Port-de-Paix",
  ],
  DO: [
    "Santo Domingo",
    "Santiago de los Caballeros",
    "La Romana",
    "San Pedro de Macorís",
    "Puerto Plata",
    "San Cristóbal",
    "Higüey",
    "Barahona",
  ],
};

export function citiesFor(countryCode: string | undefined): string[] {
  return (countryCode && CITIES_BY_COUNTRY[countryCode]) || [];
}

/* ---------- Cotización ---------- */

export type RateConfig = {
  rate: number;
  fee_percent: number;
  fee_fixed: number;
  agent_commission_percent: number;
};

export type Quote = {
  amount: number;
  fee: number;
  total: number;
  receives: number;
  commission: number;
};

export const ZERO_RATE: RateConfig = {
  rate: 0,
  fee_percent: 0,
  fee_fixed: 0,
  agent_commission_percent: 0,
};

export function quote(
  amount: number,
  cfg: RateConfig,
  markup?: { percent?: number | undefined; fixed?: number | undefined } | undefined,
): Quote {
  const safe = Number.isFinite(amount) && amount > 0 ? amount : 0;
  const effectivePercent = Number(cfg.fee_percent) + (markup?.percent ? Number(markup.percent) : 0);
  const effectiveFixed = Number(cfg.fee_fixed) + (markup?.fixed ? Number(markup.fixed) : 0);
  const fee = round2(safe * (effectivePercent / 100) + (safe > 0 ? effectiveFixed : 0));
  return {
    amount: round2(safe),
    fee,
    total: round2(safe + fee),
    receives: round2(safe * Number(cfg.rate)),
    commission: round2(safe * (Number(cfg.agent_commission_percent) / 100)),
  };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

const ISO_CURRENCIES = new Set([
  "MXN",
  "USD",
  "CAD",
  "CLP",
  "BRL",
  "ARS",
  "COP",
  "PEN",
  "CRC",
  "GTQ",
  "EUR",
  "GBP",
  "CHF",
  "DOP",
  "HTG",
]);

export function money(n: number, currency: string): string {
  const value = Number.isFinite(n) ? n : 0;
  if (ISO_CURRENCIES.has(currency)) {
    try {
      return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency,
        currencyDisplay: "code",
      }).format(value);
    } catch {
      /* fallthrough */
    }
  }
  return `${new Intl.NumberFormat("es-MX", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)} ${currency}`;
}

export const shortDate = (iso: string) =>
  new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
