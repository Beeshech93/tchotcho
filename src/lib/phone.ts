export type DialCountry = {
  code: string;
  name: string;
  dial: string;
  flag: string;
  currency: string;
};

/** Códigos telefónicos internacionales y sus monedas oficiales. */
export const DIAL_COUNTRIES: DialCountry[] = [
  { code: "HT", name: "Haïti", dial: "+509", flag: "🇭🇹", currency: "HTG" },
  { code: "DO", name: "República Dominicana", dial: "+1", flag: "🇩🇴", currency: "DOP" },
  { code: "MX", name: "México", dial: "+52", flag: "🇲🇽", currency: "MXN" },
  { code: "US", name: "United States", dial: "+1", flag: "🇺🇸", currency: "USD" },
  { code: "CA", name: "Canada", dial: "+1", flag: "🇨🇦", currency: "CAD" },
  { code: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷", currency: "ARS" },
  { code: "BO", name: "Bolivia", dial: "+591", flag: "🇧🇴", currency: "BOB" },
  { code: "BR", name: "Brasil", dial: "+55", flag: "🇧🇷", currency: "BRL" },
  { code: "CL", name: "Chile", dial: "+56", flag: "🇨🇱", currency: "CLP" },
  { code: "CO", name: "Colombia", dial: "+57", flag: "🇨🇴", currency: "COP" },
  { code: "CR", name: "Costa Rica", dial: "+506", flag: "🇨🇷", currency: "CRC" },
  { code: "CU", name: "Cuba", dial: "+53", flag: "🇨🇺", currency: "CUP" },
  { code: "EC", name: "Ecuador", dial: "+593", flag: "🇪🇨", currency: "USD" },
  { code: "SV", name: "El Salvador", dial: "+503", flag: "🇸🇻", currency: "USD" },
  { code: "GT", name: "Guatemala", dial: "+502", flag: "🇬🇹", currency: "GTQ" },
  { code: "HN", name: "Honduras", dial: "+504", flag: "🇭🇳", currency: "HNL" },
  { code: "JM", name: "Jamaica", dial: "+1", flag: "🇯🇲", currency: "JMD" },
  { code: "NI", name: "Nicaragua", dial: "+505", flag: "🇳🇮", currency: "NIO" },
  { code: "PA", name: "Panamá", dial: "+507", flag: "🇵🇦", currency: "USD" },
  { code: "PY", name: "Paraguay", dial: "+595", flag: "🇵🇾", currency: "PYG" },
  { code: "PE", name: "Perú", dial: "+51", flag: "🇵🇪", currency: "PEN" },
  { code: "PR", name: "Puerto Rico", dial: "+1", flag: "🇵🇷", currency: "USD" },
  { code: "UY", name: "Uruguay", dial: "+598", flag: "🇺🇾", currency: "UYU" },
  { code: "VE", name: "Venezuela", dial: "+58", flag: "🇻🇪", currency: "USD" },
  { code: "ES", name: "España", dial: "+34", flag: "🇪🇸", currency: "EUR" },
  { code: "FR", name: "France", dial: "+33", flag: "🇫🇷", currency: "EUR" },
  { code: "DE", name: "Deutschland", dial: "+49", flag: "🇩🇪", currency: "EUR" },
  { code: "IT", name: "Italia", dial: "+39", flag: "🇮🇹", currency: "EUR" },
  { code: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹", currency: "EUR" },
  { code: "NL", name: "Nederland", dial: "+31", flag: "🇳🇱", currency: "EUR" },
  { code: "BE", name: "Belgique", dial: "+32", flag: "🇧🇪", currency: "EUR" },
  { code: "CH", name: "Schweiz", dial: "+41", flag: "🇨🇭", currency: "CHF" },
  { code: "AT", name: "Österreich", dial: "+43", flag: "🇦🇹", currency: "EUR" },
  { code: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧", currency: "GBP" },
  { code: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪", currency: "EUR" },
  { code: "SE", name: "Sverige", dial: "+46", flag: "🇸🇪", currency: "SEK" },
  { code: "NO", name: "Norge", dial: "+47", flag: "🇳🇴", currency: "NOK" },
  { code: "DK", name: "Danmark", dial: "+45", flag: "🇩🇰", currency: "DKK" },
  { code: "FI", name: "Suomi", dial: "+358", flag: "🇫🇮", currency: "EUR" },
  { code: "PL", name: "Polska", dial: "+48", flag: "🇵🇱", currency: "PLN" },
  { code: "CZ", name: "Česko", dial: "+420", flag: "🇨🇿", currency: "CZK" },
  { code: "RO", name: "România", dial: "+40", flag: "🇷🇴", currency: "RON" },
  { code: "GR", name: "Ελλάδα", dial: "+30", flag: "🇬🇷", currency: "EUR" },
  { code: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷", currency: "TRY" },
  { code: "MA", name: "Maroc", dial: "+212", flag: "🇲🇦", currency: "MAD" },
  { code: "SN", name: "Sénégal", dial: "+221", flag: "🇸🇳", currency: "XOF" },
  { code: "CI", name: "Côte d'Ivoire", dial: "+225", flag: "🇨🇮", currency: "XOF" },
  { code: "CD", name: "RD Congo", dial: "+243", flag: "🇨🇩", currency: "CDF" },
  { code: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬", currency: "NGN" },
  { code: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦", currency: "ZAR" },
  { code: "AE", name: "الإمارات", dial: "+971", flag: "🇦🇪", currency: "AED" },
  { code: "IN", name: "India", dial: "+91", flag: "🇮🇳", currency: "INR" },
  { code: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭", currency: "PHP" },
  { code: "CN", name: "中国", dial: "+86", flag: "🇨🇳", currency: "CNY" },
  { code: "JP", name: "日本", dial: "+81", flag: "🇯🇵", currency: "JPY" },
  { code: "AU", name: "Australia", dial: "+61", flag: "🇦🇺", currency: "AUD" },
];

/** Longitud (dígitos del número nacional) esperada por país. */
const NATIONAL_LENGTHS: Record<string, number[]> = {
  HT: [8],
  DO: [10, 7],
  PR: [10, 7],
  JM: [10, 7],
  US: [10],
  CA: [10],
  MX: [10],
  AR: [10],
  BO: [8],
  BR: [10, 11],
  CL: [9],
  CO: [10],
  CR: [8],
  CU: [8],
  EC: [9],
  SV: [8],
  GT: [8],
  HN: [8],
  NI: [8],
  PA: [8],
  PY: [9],
  PE: [9],
  UY: [8],
  VE: [10],
  ES: [9],
  FR: [9],
  DE: [10, 11],
  IT: [9, 10],
  PT: [9],
  NL: [9],
  BE: [9],
  CH: [9],
  AT: [10, 11],
  GB: [10],
  IE: [9],
  SE: [9],
  NO: [8],
  DK: [8],
  FI: [9],
  PL: [9],
  CZ: [9],
  RO: [9],
  GR: [10],
  TR: [10],
  MA: [9],
  SN: [9],
  CI: [10],
  CD: [9],
  NG: [10],
  ZA: [9],
  AE: [9],
  IN: [10],
  PH: [10],
  CN: [11],
  JP: [10],
  AU: [9],
};

/** Solo dígitos, sin ceros ni prefijo internacional al inicio. */
export function normalizeLocal(local: string, dial?: string): string {
  let digits = local.replace(/\D/g, "");
  const prefix = dial?.replace(/\D/g, "");
  if (prefix && digits.startsWith(prefix) && digits.length > prefix.length) {
    digits = digits.slice(prefix.length);
  }
  return digits.replace(/^0+/, "");
}

export function expectedLengths(countryCode: string): number[] {
  return NATIONAL_LENGTHS[countryCode] ?? [];
}

/** Formatea el número nacional en grupos legibles según el país. */
export function formatNational(countryCode: string, local: string, dial?: string): string {
  const d = normalizeLocal(local, dial);
  if (!d) return "";
  const groups: Record<string, number[]> = {
    HT: [4, 4],
    DO: d.length <= 7 ? [3, 4] : [3, 3, 4],
    PR: d.length <= 7 ? [3, 4] : [3, 3, 4],
    JM: d.length <= 7 ? [3, 4] : [3, 3, 4],
    US: [3, 3, 4],
    CA: [3, 3, 4],
    MX: [2, 4, 4],
    FR: [1, 2, 2, 2, 2],
    ES: [3, 3, 3],
  };
  const pattern = groups[countryCode] ?? [3, 3, 4];
  const out: string[] = [];
  let i = 0;
  for (const size of pattern) {
    if (i >= d.length) break;
    out.push(d.slice(i, i + size));
    i += size;
  }
  if (i < d.length) out.push(d.slice(i));
  return out.join(" ");
}

export type PhoneCheck = {
  ok: boolean;
  e164?: string;
  error?: "empty" | "short" | "long" | "invalid";
};

/** Valida el número nacional contra el país y devuelve E.164. */
export function validatePhone(countryCode: string, dial: string, local: string): PhoneCheck {
  const digits = normalizeLocal(local, dial);
  if (!digits) return { ok: false, error: "empty" };
  const lengths = expectedLengths(countryCode);
  if (lengths.length) {
    const min = Math.min(...lengths);
    const max = Math.max(...lengths);
    if (digits.length < min) return { ok: false, error: "short" };
    if (digits.length > max) return { ok: false, error: "long" };
    if (!lengths.includes(digits.length)) return { ok: false, error: "invalid" };
  } else if (digits.length < 5 || digits.length > 14) {
    return { ok: false, error: digits.length < 5 ? "short" : "long" };
  }
  const e164 = toE164(dial, digits);
  return e164 ? { ok: true, e164 } : { ok: false, error: "invalid" };
}

/** Une código de país y número local en formato E.164. */
export function toE164(dial: string, local: string): string | null {
  const digits = normalizeLocal(local, dial);
  const prefix = dial.replace(/\D/g, "");
  if (digits.length < 5 || digits.length > 14) return null;
  const full = `+${prefix}${digits}`;
  return /^\+[1-9]\d{6,15}$/.test(full) ? full : null;
}

/**
 * Obtiene la información oficial del país (código, nombre, bandera y moneda)
 * a partir del número de teléfono o código de país.
 */
export function getCountryInfoFromPhone(
  phone?: string | null,
  fallbackCountry?: string | null,
): DialCountry {
  const cleanPhone = (phone ?? "").replace(/\D/g, "");
  const upperCountry = (fallbackCountry ?? "").trim().toUpperCase();

  // 1. Deducir primero por el prefijo internacional del número de teléfono (regla prioritaria)
  if (cleanPhone.startsWith("509")) {
    return DIAL_COUNTRIES.find((c) => c.code === "HT")!;
  }
  if (
    cleanPhone.startsWith("1809") ||
    cleanPhone.startsWith("1829") ||
    cleanPhone.startsWith("1849") ||
    cleanPhone.startsWith("809") ||
    cleanPhone.startsWith("829") ||
    cleanPhone.startsWith("849")
  ) {
    return DIAL_COUNTRIES.find((c) => c.code === "DO")!;
  }
  if (cleanPhone.startsWith("52")) {
    return DIAL_COUNTRIES.find((c) => c.code === "MX")!;
  }
  if (cleanPhone.startsWith("56")) {
    return DIAL_COUNTRIES.find((c) => c.code === "CL")!;
  }
  if (cleanPhone.startsWith("55")) {
    return DIAL_COUNTRIES.find((c) => c.code === "BR")!;
  }
  if (cleanPhone.startsWith("57")) {
    return DIAL_COUNTRIES.find((c) => c.code === "CO")!;
  }
  if (cleanPhone.startsWith("54")) {
    return DIAL_COUNTRIES.find((c) => c.code === "AR")!;
  }
  if (cleanPhone.startsWith("51")) {
    return DIAL_COUNTRIES.find((c) => c.code === "PE")!;
  }
  if (cleanPhone.startsWith("506")) {
    return DIAL_COUNTRIES.find((c) => c.code === "CR")!;
  }
  if (cleanPhone.startsWith("502")) {
    return DIAL_COUNTRIES.find((c) => c.code === "GT")!;
  }
  if (cleanPhone.startsWith("504")) {
    return DIAL_COUNTRIES.find((c) => c.code === "HN")!;
  }
  if (cleanPhone.startsWith("505")) {
    return DIAL_COUNTRIES.find((c) => c.code === "NI")!;
  }
  if (cleanPhone.startsWith("503")) {
    return DIAL_COUNTRIES.find((c) => c.code === "SV")!;
  }
  if (cleanPhone.startsWith("507")) {
    return DIAL_COUNTRIES.find((c) => c.code === "PA")!;
  }
  if (cleanPhone.startsWith("593")) {
    return DIAL_COUNTRIES.find((c) => c.code === "EC")!;
  }
  if (cleanPhone.startsWith("34")) {
    return DIAL_COUNTRIES.find((c) => c.code === "ES")!;
  }
  if (cleanPhone.startsWith("33")) {
    return DIAL_COUNTRIES.find((c) => c.code === "FR")!;
  }
  if (cleanPhone.startsWith("44")) {
    return DIAL_COUNTRIES.find((c) => c.code === "GB")!;
  }
  if (cleanPhone.startsWith("1")) {
    if (upperCountry === "DO") return DIAL_COUNTRIES.find((c) => c.code === "DO")!;
    if (upperCountry === "CA") return DIAL_COUNTRIES.find((c) => c.code === "CA")!;
    return DIAL_COUNTRIES.find((c) => c.code === "US")!;
  }

  // 2. Si el teléfono no tiene prefijo reconocible, usar el código de país de fallback
  if (upperCountry) {
    const byCode = DIAL_COUNTRIES.find((c) => c.code === upperCountry);
    if (byCode) return byCode;
  }

  return (DIAL_COUNTRIES.find((c) => c.code === "HT") || DIAL_COUNTRIES[0])!;
}

/**
 * Obtiene el código de moneda oficial (ej. DOP, MXN, USD, HTG, CLP) según el número de teléfono del usuario.
 */
export function getCurrencyFromPhone(
  phone?: string | null,
  fallbackCountry?: string | null,
): string {
  const info = getCountryInfoFromPhone(phone, fallbackCountry);
  return info.currency || "HTG";
}
