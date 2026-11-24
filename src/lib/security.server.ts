// Registro y alerta de eventos de seguridad (firmas de webhook inválidas,
// intentos de escalar privilegios, etc.). Usado tanto por los webhooks
// públicos (llamada directa) como por triggers de la base de datos (vía el
// endpoint /api/public/security/alert).

export type SecurityEventType =
  | "webhook_invalid_signature"
  | "webhook_not_configured"
  | "rate_limit_exceeded"
  | "kyc_self_approve_attempt"
  | "unauthorized_action";

/** Comparación en tiempo constante para evitar ataques de temporización (timing attacks). */
export function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const enc = new TextEncoder();
  const bufA = enc.encode(a);
  const bufB = enc.encode(b);
  if (bufA.byteLength !== bufB.byteLength) return false;

  let diff = 0;
  for (let i = 0; i < bufA.byteLength; i++) {
    diff |= (bufA[i] ?? 0) ^ (bufB[i] ?? 0);
  }
  return diff === 0;
}

/** Rate limiter en memoria por IP/clave con ventana deslizante. */
type RateLimitOptions = {
  maxRequests: number;
  windowMs: number;
};

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): { ok: boolean; remaining: number; resetInMs: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, remaining: opts.maxRequests - 1, resetInMs: opts.windowMs };
  }

  if (entry.count >= opts.maxRequests) {
    return { ok: false, remaining: 0, resetInMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { ok: true, remaining: opts.maxRequests - entry.count, resetInMs: entry.resetAt - now };
}

/** Obtiene la IP cliente de forma segura considerando proxies de Cloudflare y reverse proxies. */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    "127.0.0.1"
  );
}

/** Registra el evento y, si hay correo de alerta configurado, avisa de inmediato. */
export async function logAndAlertSecurityEvent(opts: {
  eventType: SecurityEventType;
  severity?: "info" | "warning" | "critical";
  detail: Record<string, unknown>;
  userId?: string | null;
}): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("security_events").insert({
      event_type: opts.eventType,
      severity: opts.severity ?? "warning",
      detail: opts.detail as never,
      user_id: opts.userId ?? null,
    });
  } catch (e) {
    console.error("No se pudo registrar el evento de seguridad", e);
  }

  try {
    const { resendSendEmail, loadResendCreds } = await import("@/lib/resend.server");
    const stored = await loadResendCreds();
    const alertEmail = process.env["ADMIN_ALERT_EMAIL"] ?? stored["ADMIN_ALERT_EMAIL"];
    if (!alertEmail) return;

    await resendSendEmail({
      to: alertEmail,
      subject: `⚠️ Alerta de seguridad: ${opts.eventType}`,
      html: `
        <h2>Se detectó actividad sospechosa en Tcho-Tcho</h2>
        <p><strong>Tipo:</strong> ${opts.eventType}</p>
        <p><strong>Severidad:</strong> ${opts.severity ?? "warning"}</p>
        <p><strong>Usuario:</strong> ${opts.userId ?? "no autenticado"}</p>
        <pre>${JSON.stringify(opts.detail, null, 2)}</pre>
      `,
    });
  } catch (e) {
    console.error("No se pudo enviar la alerta de seguridad por correo", e);
  }
}
