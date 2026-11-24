import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseMpCredentialsInput,
  parseOxxoVoucherInput,
  parseSpeiReferenceInput,
  type MpCredentialsInput,
} from "@/lib/mercadopago.schemas";

/** Estado de configuración de Mercado Pago (solo administradores). */
export const mercadoPagoStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    if (!(await verifyIsAdmin(context))) throw new Error("No autorizado");
    const { mpStatusInfo } = await import("@/lib/mercadopago.server");
    return mpStatusInfo();
  });

/** Guardar manualmente las credenciales de Mercado Pago (solo administradores). */
export const mercadoPagoSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: MpCredentialsInput) => parseMpCredentialsInput(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    if (!(await verifyIsAdmin(context))) throw new Error("No autorizado");
    const { saveMpCred } = await import("@/lib/mercadopago.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveMpCred(name, value.trim(), context.userId, context.supabase);
    }
    return { ok: true };
  });

const CARD_METHODS = ["mercado_pago", "mercadopago", "card", "tarjeta"];

async function getAuthorizedTransfer(
  transferId: string,
  context: { supabase: any; userId: string; claims?: any },
) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { verifyIsAdmin } = await import("@/lib/admin.server");
  const isAdmin = await verifyIsAdmin(context);

  let t: any = null;

  // 1. Intentar con context.supabase
  try {
    const { data: tClient } = await context.supabase
      .from("transfers")
      .select("*")
      .eq("id", transferId)
      .maybeSingle();
    if (tClient && (tClient.user_id === context.userId || isAdmin)) {
      t = tClient;
    }
  } catch {}

  // 2. Si no se encontró (o RLS en el servidor no devolvió la fila), buscar con supabaseAdmin
  if (!t) {
    try {
      const { data: tAdmin } = await supabaseAdmin
        .from("transfers")
        .select("*")
        .eq("id", transferId)
        .maybeSingle();
      if (tAdmin && (tAdmin.user_id === context.userId || isAdmin)) {
        t = tAdmin;
      }
    } catch {}
  }

  // 3. Auto-reparación inteligente de datos incompletos en la transferencia
  if (t) {
    const isMexicoMethod = ["oxxo", "spei", "mercado_pago", "mercadopago"].includes(t.payment_method);
    const updates: {
      origin_country?: string;
      send_currency?: string;
      amount_send?: number;
      fee_send?: number;
      total_send?: number;
    } = {};

    if (isMexicoMethod && t.origin_country !== "MX") {
      t.origin_country = "MX";
      updates.origin_country = "MX";
    }

    if (isMexicoMethod && (!t.send_currency || t.send_currency === "USD")) {
      t.send_currency = "MXN";
      updates.send_currency = "MXN";
    }

    // Si total_send es 0 o nulo, recalcularlo a partir de amount_send o amount_receive
    const currentTotal = Number(t.total_send) || 0;
    const currentSend = Number(t.amount_send) || 0;
    const currentReceive = Number(t.amount_receive) || 0;
    const currentFee = Number(t.fee_send) || 0;
    const rate = Number(t.rate) > 0 ? Number(t.rate) : 7.2;

    if (currentTotal <= 0) {
      let calcSend = currentSend;
      if (calcSend <= 0 && currentReceive > 0) {
        calcSend = Math.round((currentReceive / rate) * 100) / 100;
        t.amount_send = calcSend;
        updates.amount_send = calcSend;
      }

      let calcFee = currentFee;
      if (calcFee <= 0 && calcSend > 0) {
        calcFee = Math.round((calcSend * 0.015 + 15) * 100) / 100;
        t.fee_send = calcFee;
        updates.fee_send = calcFee;
      }

      const calcTotal = Math.round((calcSend + calcFee) * 100) / 100;
      if (calcTotal > 0) {
        t.total_send = calcTotal;
        updates.total_send = calcTotal;
      }
    }

    if (Object.keys(updates).length > 0) {
      try {
        await supabaseAdmin.from("transfers").update(updates as any).eq("id", t.id);
      } catch (err) {
        console.warn("[getAuthorizedTransfer] Error al auto-reparar transferencia:", err);
      }
    }
  }

  return t;
}

/** Inicia el pago en Mercado Pago y retorna la URL de checkout. */
export const mercadoPagoInitiatePayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { transferId: string }) => input)
  .handler(async ({ data, context }) => {
    const transfer = await getAuthorizedTransfer(data.transferId, context);

    if (!transfer) {
      throw new Error("Transferencia no encontrada");
    }

    const isMexico = transfer.origin_country === "MX" || transfer.send_currency === "MXN" || CARD_METHODS.includes(transfer.payment_method);
    if (!isMexico) {
      throw new Error(
        "Mercado Pago solo está disponible para transacciones en México. Los demás países procesan vía Stripe.",
      );
    }

    if (!CARD_METHODS.includes(transfer.payment_method)) {
      throw new Error("Este método de pago no usa Mercado Pago");
    }

    const effectiveTotal = Number(transfer.total_send) > 0 ? Number(transfer.total_send) : Number(transfer.amount_send);
    if (effectiveTotal <= 0) {
      throw new Error("El monto a pagar debe ser mayor a 0.");
    }

    const email = (context.claims?.email as string | undefined) || "cliente@lajanrapid.com";
    const base = process.env["PUBLIC_URL"] || "https://tchotcho.app";

    const { createMpPreference } = await import("@/lib/mercadopago.server");
    const result = await createMpPreference({
      transferId: transfer.id,
      reference: transfer.reference,
      amount: effectiveTotal,
      currency: transfer.send_currency || "MXN",
      description: `Envío ${transfer.reference} a ${transfer.recipient_name}`,
      buyerEmail: email,
      cardOnly: transfer.payment_method === "card" || transfer.payment_method === "tarjeta",
      successUrl: `${base}/transferencia/${transfer.id}?payment=success`,
      pendingUrl: `${base}/transferencia/${transfer.id}?payment=pending`,
      failureUrl: `${base}/transferencia/${transfer.id}?payment=failure`,
    });

    if (!result.ok) {
      throw new Error(result.error);
    }

    return { checkoutUrl: result.checkoutUrl };
  });

/** Genera (o recupera) una CLABE SPEI real para un envío propio. */
export const mercadoPagoSpeiReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { transferId: string }) => parseSpeiReferenceInput(input))
  .handler(async ({ data, context }) => {
    const transfer = await getAuthorizedTransfer(data.transferId, context);

    if (!transfer) throw new Error("Transferencia no encontrada");
    const isMexicoSpei = transfer.origin_country === "MX" || transfer.send_currency === "MXN" || transfer.payment_method === "spei";
    if (!isMexicoSpei) {
      throw new Error("SPEI solo está disponible para pagos originados en México.");
    }
    if (transfer.payment_method !== "spei") throw new Error("Este envío no se paga por SPEI");
    if (transfer.status !== "awaiting_payment" && transfer.status !== "created") {
      throw new Error("Este envío ya no está pendiente de pago");
    }

    const effectiveTotalSpei = Number(transfer.total_send) > 0 ? Number(transfer.total_send) : Number(transfer.amount_send);
    if (effectiveTotalSpei <= 0) {
      throw new Error("El monto a pagar debe ser mayor a 0.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", transfer.user_id)
      .maybeSingle();
    const [firstName, ...rest] = (profile?.full_name || "Cliente Lajan").split(" ");

    const email = (context.claims?.email as string | undefined) || "cliente@lajanrapid.com";

    const { createSpeiReference } = await import("@/lib/mercadopago.server");
    const result = await createSpeiReference({
      reference: transfer.reference,
      amount: effectiveTotalSpei,
      description: `Envío ${transfer.reference} a ${transfer.recipient_name}`,
      payerEmail: email,
      payerFirstName: firstName || "Cliente",
      payerLastName: rest.join(" ") || "Lajan",
    });

    if (!result.ok) throw new Error(result.error);
    return result.spei;
  });

/** Genera (o recupera) la ficha real de pago en OXXO para un envío propio. */
export const mercadoPagoOxxoVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { transferId: string }) => parseOxxoVoucherInput(input))
  .handler(async ({ data, context }) => {
    const transfer = await getAuthorizedTransfer(data.transferId, context);

    if (!transfer) throw new Error("Transferencia no encontrada");
    const isMexicoOxxo = transfer.origin_country === "MX" || transfer.send_currency === "MXN" || transfer.payment_method === "oxxo";
    if (!isMexicoOxxo) {
      throw new Error("OXXO solo está disponible para pagos originados en México.");
    }
    if (transfer.payment_method !== "oxxo") throw new Error("Este envío no se paga en OXXO");
    if (transfer.status !== "awaiting_payment" && transfer.status !== "created") {
      throw new Error("Este envío ya no está pendiente de pago");
    }

    const effectiveTotalOxxo = Number(transfer.total_send) > 0 ? Number(transfer.total_send) : Number(transfer.amount_send);
    if (effectiveTotalOxxo <= 0) {
      throw new Error("El monto a pagar debe ser mayor a 0.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", transfer.user_id)
      .maybeSingle();
    const [firstName, ...rest] = (profile?.full_name || "Cliente Lajan").split(" ");

    const email = (context.claims?.email as string | undefined) || "cliente@lajanrapid.com";

    const { createOxxoVoucher } = await import("@/lib/mercadopago.server");
    const result = await createOxxoVoucher({
      reference: transfer.reference,
      amount: effectiveTotalOxxo,
      description: `Envío ${transfer.reference} a ${transfer.recipient_name}`,
      payerEmail: email,
      payerFirstName: firstName || "Cliente",
      payerLastName: rest.join(" ") || "Lajan",
    });

    if (!result.ok) throw new Error(result.error);
    return result.voucher;
  });
