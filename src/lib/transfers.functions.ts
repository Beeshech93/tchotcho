import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const finalizeSchema = z.object({ transferId: z.string().uuid() });
const adminConfirmSchema = z.object({ transferId: z.string().uuid() });
const TRANSFER_STATUSES = [
  "created",
  "awaiting_payment",
  "paid",
  "processing",
  "ready_for_pickup",
  "completed",
  "cancelled",
] as const;
const adminSetStatusSchema = z.object({
  transferId: z.string().uuid(),
  status: z.enum(TRANSFER_STATUSES),
  note: z.string().trim().max(500).optional(),
});
const adminCancelSchema = z.object({
  transferId: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

const ADMIN_STATUS_LABEL: Record<string, string> = {
  created: "Creado",
  awaiting_payment: "Esperando pago",
  paid: "Pago confirmado",
  processing: "En proceso",
  ready_for_pickup: "Listo para retirar",
  completed: "Entregado",
  cancelled: "Cancelado",
};

/**
 * Cambia la etapa de una transacción manualmente a cualquier estado, sin
 * disparar el pago automático de Bazik. Uso: cuando el admin ya gestionó el
 * pago por fuera del sistema, o necesita corregir el estado.
 */
export const adminSetTransferStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof adminSetStatusSchema>) => adminSetStatusSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    const isStaffData = await verifyIsStaff(context);
    if (!isAdminData && !isStaffData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select("id, user_id, agent_id, status, reference")
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (!isAdminData && t.agent_id !== context.userId && t.user_id !== context.userId) {
      throw new Error("Solo puedes modificar envíos gestionados por tu agencia");
    }
    if (t.status === data.status) {
      return { ok: true, message: "Ya estaba en esa etapa", status: data.status };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("transfers")
      .update({ status: data.status })
      .eq("id", t.id);
    if (updateError) throw new Error(updateError.message);

    const label = ADMIN_STATUS_LABEL[data.status] ?? data.status;
    const eventMessage = data.note
      ? `Etapa cambiada manualmente a "${label}": ${data.note}`
      : `Etapa cambiada manualmente a "${label}"`;

    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: t.id,
      status: data.status,
      message: eventMessage,
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: t.user_id,
      title: `${label} · ${t.reference}`,
      body: data.note ?? `El estado de tu envío cambió a "${label}".`,
    });

    return { ok: true, message: `Etapa actualizada a "${label}"`, status: data.status };
  });

/** Cancela una transacción. No puede cancelarse un envío ya completado. */
export const adminCancelTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof adminCancelSchema>) => adminCancelSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    if (!isAdminData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select("id, user_id, status, reference")
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === "completed") throw new Error("No se puede cancelar un envío ya entregado");
    if (t.status === "cancelled") {
      return { ok: true, message: "Ya estaba cancelado", status: "cancelled" };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error: updateError } = await supabaseAdmin
      .from("transfers")
      .update({ status: "cancelled" })
      .eq("id", t.id);
    if (updateError) throw new Error(updateError.message);

    const eventMessage = data.reason
      ? `Cancelado por un administrador: ${data.reason}`
      : "Cancelado por un administrador";

    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: t.id,
      status: "cancelled",
      message: eventMessage,
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: t.user_id,
      title: `Envío cancelado · ${t.reference}`,
      body: data.reason ?? "Tu envío fue cancelado por un administrador.",
    });

    return { ok: true, message: "Envío cancelado", status: "cancelled" };
  });

/** Finaliza el envío pagando automáticamente al MonCash/NatCash del destinatario vía Bazik. */
export const finalizeTransferPayout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof finalizeSchema>) => finalizeSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: t, error } = await context.supabase
      .from("transfers")
      .select(
        "id, user_id, status, reference, recipient_name, recipient_phone, delivery_method, amount_receive, receive_currency",
      )
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.user_id !== context.userId) throw new Error("No autorizado");
    if (t.status === "completed") throw new Error("Este envío ya fue completado");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado");
    if (t.status === "processing") throw new Error("Este envío ya se está procesando");
    if (t.status !== "paid") {
      throw new Error("Este envío aún no tiene el pago confirmado");
    }
    if (t.delivery_method !== "moncash" && t.delivery_method !== "natcash") {
      throw new Error("Este método de entrega no se puede finalizar automáticamente");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_bazik_payout", {
      _transfer_id: t.id,
      _from_status: "paid",
    });
    if (claimError || !claimed) {
      throw new Error("Este envío ya está siendo procesado o ya fue enviado a Bazik.");
    }

    const { bazikPayout } = await import("@/lib/bazik.server");
    const result = await bazikPayout({
      provider: t.delivery_method,
      phone: t.recipient_phone,
      amount: Number(t.amount_receive),
      currency: t.receive_currency,
      reference: t.reference,
      recipientName: t.recipient_name,
    });

    if (!result.ok) {
      await supabaseAdmin
        .from("transfers")
        .update({
          ...(result.retryable === false ? {} : { status: "paid" }),
        })
        .eq("id", t.id);
      throw new Error(result.error);
    }

    // Al confirmarse el pago en Bazik, marcar automáticamente como COMPLETADO (Livré)
    await supabaseAdmin
      .from("transfers")
      .update({
        status: "completed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", t.id);

    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: t.id,
      status: "completed",
      message: `¡Envío entregado automáticamente con éxito a ${t.recipient_phone} vía ${t.delivery_method.toUpperCase()}${result.providerReference ? ` (Ref Bazik: ${result.providerReference})` : ""}!`,
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: t.user_id,
      title: `Envío completado · ${t.reference}`,
      body: `Tu transferencia de ${Number(t.amount_receive).toLocaleString()} HTG a ${t.recipient_name} ha sido entregada exitosamente vía ${t.delivery_method.toUpperCase()}.`,
    });

    return {
      ok: true,
      status: "completed",
      provider: t.delivery_method,
      phone: t.recipient_phone,
      status: "processing",
      ...(result.providerReference ? { providerReference: result.providerReference } : {}),
    };
  });

/** Confirma una transacción manualmente llamando a Bazik si es MonCash/NatCash. Autorizado para Admin y Agentes. */
export const adminConfirmTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof adminConfirmSchema>) => adminConfirmSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    const isStaffData = await verifyIsStaff(context);
    if (!isAdminData && !isStaffData) throw new Error("No autorizado");

    const { data: t, error } = await context.supabase
      .from("transfers")
      .select(
        "id, status, reference, recipient_name, recipient_phone, delivery_method, amount_receive, receive_currency, agent_id, payment_method, total_send, send_currency",
      )
      .eq("id", data.transferId)
      .maybeSingle();

    if (error || !t) throw new Error("Envío no encontrado");
    if (t.status === "completed") throw new Error("Este envío ya fue completado");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Si un agente confirma la transferencia y no tenía agente asignado, asignarlo a este agente
    if (!isAdminData && !t.agent_id) {
      await supabaseAdmin.from("transfers").update({ agent_id: context.userId }).eq("id", t.id);
    }

    // Si es MonCash/NatCash, llamar a Bazik (solo MonCash está soportado por su API).
    if (
      (t.delivery_method === "moncash" || t.delivery_method === "natcash") &&
      t.status === "awaiting_payment"
    ) {
      const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_bazik_payout", {
        _transfer_id: t.id,
        _from_status: "awaiting_payment",
      });
      if (claimError || !claimed) {
        throw new Error("Este envío ya está siendo procesado o ya fue enviado a Bazik.");
      }

      const { bazikPayout } = await import("@/lib/bazik.server");
      const result = await bazikPayout({
        provider: t.delivery_method,
        phone: t.recipient_phone,
        amount: Number(t.amount_receive),
        currency: t.receive_currency,
        reference: t.reference,
        recipientName: t.recipient_name,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      await supabaseAdmin
        .from("transfers")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", t.id);

      await supabaseAdmin.from("transfer_events").insert({
        transfer_id: t.id,
        status: "completed",
        message: `¡Envío entregado automáticamente con éxito a ${t.recipient_phone} vía ${t.delivery_method.toUpperCase()}${result.providerReference ? ` (Ref Bazik: ${result.providerReference})` : ""}!`,
      });

      await supabaseAdmin.from("notifications").insert({
        user_id: (t as any).user_id || context.userId,
        title: `Envío completado · ${t.reference}`,
        body: `Tu transferencia de ${Number(t.amount_receive).toLocaleString()} HTG a ${t.recipient_name} ha sido entregada exitosamente vía ${t.delivery_method.toUpperCase()}.`,
      });

      return {
        ok: true,
        message: "¡Envío entregado automáticamente con éxito vía Bazik!",
        status: "completed",
      };
    }

    // Si no es MonCash/NatCash o ya está en processing, marcar directo como completed
    await supabaseAdmin.from("transfers").update({ status: "completed" }).eq("id", t.id);

    return {
      ok: true,
      message: "Transacción confirmada",
      status: "completed",
    };
  });

const agentCreateCashSchema = z.object({
  originCountry: z.string().min(2).max(2).default("DO"),
  destinationCountry: z.string().min(2).max(2).default("HT"),
  recipientName: z.string().min(2).max(100),
  recipientPhone: z.string().min(6).max(25),
  recipientCity: z.string().min(2).max(100),
  deliveryMethod: z.string().min(2).max(50),
  amountSend: z.number().positive(),
  note: z.string().max(300).optional(),
});

/**
 * Permite a un agente independiente registrar y procesar una transferencia en ventanilla.
 * REGLA: Los agentes SOLO reciben efectivo para hacer sus transacciones.
 */
export const agentCreateCashTransfer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof agentCreateCashSchema>) => agentCreateCashSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    const isStaffData = await verifyIsStaff(context);
    if (!isAdminData && !isStaffData) {
      throw new Error("Solo agentes autorizados pueden registrar operaciones en efectivo.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { FALLBACK_COUNTRIES, fallbackRate } = await import("@/hooks/useCorridors");

    // Validar país de origen y destino con respaldo garantizado
    let oc: { code: string; currency: string; name: string } | null = null;
    try {
      const { data: dbOc } = await supabaseAdmin
        .from("countries")
        .select("code, currency, name")
        .eq("code", data.originCountry)
        .maybeSingle();
      if (dbOc) oc = dbOc;
    } catch {
      // ignore
    }

    if (!oc) {
      const fb = FALLBACK_COUNTRIES.find((c) => c.code === data.originCountry);
      if (fb) {
        oc = { code: fb.code, currency: fb.currency, name: fb.name };
      }
    }
    if (!oc) throw new Error("País de origen no válido");

    let dc: { code: string; currency: string; name: string } | null = null;
    try {
      const { data: dbDc } = await supabaseAdmin
        .from("countries")
        .select("code, currency, name")
        .eq("code", data.destinationCountry)
        .maybeSingle();
      if (dbDc) dc = dbDc;
    } catch {
      // ignore
    }

    if (!dc) {
      const fb = FALLBACK_COUNTRIES.find((c) => c.code === data.destinationCountry);
      if (fb) {
        dc = { code: fb.code, currency: fb.currency, name: fb.name };
      }
    }
    if (!dc) throw new Error("País de destino no válido");

    // Obtener tasa de cambio del corredor
    let exRate: any = null;
    try {
      const { data: dbRate } = await supabaseAdmin
        .from("exchange_rates")
        .select("*")
        .eq("from_currency", oc.currency)
        .eq("to_currency", dc.currency)
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (dbRate && Number(dbRate.rate) > 0) {
        exRate = dbRate;
      }
    } catch {
      // ignore
    }

    if (!exRate) {
      const fb = fallbackRate(oc.currency, dc.currency);
      if (fb) {
        exRate = fb;
      }
    }

    if (!exRate) throw new Error("No hay tasa de cambio disponible para este corredor.");

    const rate = Number(exRate.rate);
    const feePercent = Number(exRate.fee_percent);
    const feeFixed = Number(exRate.fee_fixed);
    const agentCommPercent = Number(exRate.agent_commission_percent);

    const feeSend = Math.round((data.amountSend * (feePercent / 100) + feeFixed) * 100) / 100;
    const totalSend = Math.round((data.amountSend + feeSend) * 100) / 100;
    const amountReceive = Math.round(data.amountSend * rate * 100) / 100;
    const agentCommission = Math.round(data.amountSend * (agentCommPercent / 100) * 100) / 100;

    // Validación de límites MonCash / NatCash
    if (
      data.destinationCountry === "HT" &&
      data.deliveryMethod === "moncash" &&
      amountReceive > 75000
    ) {
      throw new Error("MonCash permite un máximo de 75,000 HTG por transacción.");
    }
    if (data.destinationCountry === "HT" && data.deliveryMethod === "natcash") {
      if (amountReceive < 3998 || amountReceive > 75000) {
        throw new Error(
          "Natcom (NatCash): Min 3,998 HTG · Max 75,000 HTG per transaction · whole numbers only",
        );
      }
      if (!Number.isInteger(amountReceive)) {
        throw new Error(
          "Natcom (NatCash): Solo números enteros en HTG (whole numbers only).",
        );
      }
    }

    // REGLA AGENTES: Sin saldo en su Billetera de Envíos de Dinero no pueden enviar nada.
    let agentWallet: { id: string; balance: number; currency: string } | null = null;
    if (!isAdminData) {
      const { data: w } = await supabaseAdmin
        .from("wallets")
        .select("id, balance, currency")
        .eq("user_id", context.userId)
        .eq("currency", dc.currency)
        .maybeSingle();

      agentWallet = w;
      if (!agentWallet) {
        throw new Error(
          "No tienes activa tu Billetera de Envíos de Dinero. Sin saldo operativo no puedes realizar transferencias. Contacta a un administrador para recargar tu cuenta.",
        );
      }

      const currentBal = Number(agentWallet.balance) || 0;
      if (currentBal < amountReceive || currentBal <= 0) {
        throw new Error(
          `Saldo insuficiente en tu Billetera de Envíos de Dinero. Tu saldo actual es de ${currentBal.toLocaleString()} HTG y esta operación requiere ${amountReceive.toLocaleString()} HTG. Sin saldo operativo no puedes realizar envíos.`,
        );
      }
    }

    // Insertar transferencia en efectivo por el agente o directa por el administrador
    const insertPayload: Record<string, any> = {
      user_id: context.userId,
      agent_id: isAdminData ? null : context.userId,
      recipient_name: data.recipientName.trim(),
      recipient_phone: data.recipientPhone.trim(),
      recipient_city: data.recipientCity.trim(),
      delivery_method: data.deliveryMethod,
      payment_method: isAdminData ? "admin_direct" : "cash_agent",
      amount_send: data.amountSend,
      send_currency: oc.currency,
      fee_send: feeSend,
      total_send: totalSend,
      amount_receive: amountReceive,
      receive_currency: dc.currency,
      rate: rate,
      agent_commission_send: isAdminData ? 0 : agentCommission,
      amount_mxn: oc.currency === "MXN" ? data.amountSend : Math.round((data.amountSend / rate) * 100) / 100,
      fee_mxn: oc.currency === "MXN" ? feeSend : 0,
      total_mxn: oc.currency === "MXN" ? totalSend : 0,
      amount_htg: dc.currency === "HTG" ? amountReceive : Math.round(data.amountSend * rate * 100) / 100,
      status: "processing", // Cobrado en ventanilla o transacción directa autorizada
      note: data.note ? data.note.trim() : null,
      origin_country: data.originCountry,
      destination_country: data.destinationCountry,
    };

    let { data: newTransfer, error: insertError } = await supabaseAdmin
      .from("transfers")
      .insert(insertPayload)
      .select("id, reference, status")
      .single();

    if (insertError && (insertError.message.includes("schema cache") || insertError.message.includes("column"))) {
      delete insertPayload["destination_country"];
      delete insertPayload["origin_country"];
      const retry = await supabaseAdmin
        .from("transfers")
        .insert(insertPayload)
        .select("id, reference, status")
        .single();
      newTransfer = retry.data;
      insertError = retry.error;
    }

    if (insertError || !newTransfer) {
      throw new Error(insertError?.message || "No se pudo registrar la transferencia.");
    }

    // 1. Registrar evento de pago confirmado / autorizado de inmediato
    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: newTransfer.id,
      status: "awaiting_payment",
      message: isAdminData
        ? `Pago confirmado y autorizado inmediatamente por Administrador.`
        : `Pago en efectivo recibido en ventanilla por el agente. Cobrado: ${totalSend} ${oc.currency}. Comisión ganada: ${agentCommission} ${oc.currency}.`,
    });

    // 2. Registrar evento de procesamiento
    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: newTransfer.id,
      status: "processing",
      message: `Envío en procesamiento automático hacia ${data.deliveryMethod.toUpperCase()}.`,
    });

    // Descontar saldo de la Billetera de Envíos de Dinero del agente
    if (!isAdminData && agentWallet) {
      const currentBal = Number(agentWallet.balance) || 0;
      const nextBal = Math.round((currentBal - amountReceive) * 100) / 100;
      await supabaseAdmin
        .from("wallets")
        .update({ balance: nextBal, updated_at: new Date().toISOString() })
        .eq("id", agentWallet.id);

      await supabaseAdmin.from("wallet_transactions").insert({
        wallet_id: agentWallet.id,
        user_id: context.userId,
        kind: "agent_transfer_out",
        amount: -amountReceive,
        currency: agentWallet.currency,
        description: `Envío ${data.deliveryMethod.toUpperCase()} a ${data.recipientPhone} (Ref: ${newTransfer.reference})`,
      });
    }

    // Acreditación de comisión al Super Agente si este agente pertenece a una red
    if (!isAdminData) {
      try {
        const parentKey = `AGENT_PARENT_SUPER_AGENT_${context.userId}`;
        const { data: parentCred } = await supabaseAdmin
          .from("integration_credentials")
          .select("value")
          .eq("name", parentKey)
          .maybeSingle();

        if (parentCred?.value) {
          const parentData = JSON.parse(parentCred.value);
          const superAgentId = parentData.superAgentId;
          const commPct = Number(parentData.commissionPercent) || 0.5;

          if (superAgentId && commPct > 0) {
            const superCommission = Math.round(data.amountSend * (commPct / 100) * 100) / 100;
            if (superCommission > 0) {
              // Buscar o inicializar billetera del Super Agente en la moneda enviada
              const { data: superWallets } = await supabaseAdmin
                .from("wallets")
                .select("id, balance")
                .eq("user_id", superAgentId)
                .eq("currency", oc.currency);

              let targetWallet: { id: string; balance: number } | null = superWallets?.[0] ?? null;
              if (!targetWallet) {
                const { data: createdW } = await supabaseAdmin
                  .from("wallets")
                  .insert({
                    user_id: superAgentId,
                    currency: oc.currency,
                    balance: 0,
                  })
                  .select("id, balance")
                  .single();
                targetWallet = createdW;
              }

              if (targetWallet) {
                const newSuperBal =
                  Math.round((Number(targetWallet.balance || 0) + superCommission) * 100) / 100;
                await supabaseAdmin
                  .from("wallets")
                  .update({ balance: newSuperBal, updated_at: new Date().toISOString() })
                  .eq("id", targetWallet.id);

                await supabaseAdmin.from("wallet_transactions").insert({
                  wallet_id: targetWallet.id,
                  user_id: superAgentId,
                  kind: "super_agent_commission",
                  amount: superCommission,
                  currency: oc.currency,
                  description: `Comisión de red ganada (${commPct}%) por transferencia ${newTransfer.reference} realizada por tu agente asignado`,
                });

                await supabaseAdmin.from("transfer_events").insert({
                  transfer_id: newTransfer.id,
                  status: "processing",
                  message: `Super Agente acreditado: +${superCommission} ${oc.currency} (${commPct}% comisión de red).`,
                });
              }
            }
          }
        }
      } catch (superErr) {
        console.warn("[agentCreateCashTransfer] Super agent commission warning:", superErr);
      }
    }

    // Si es MonCash o NatCash, procesar pago y entrega AUTOMÁTICA al beneficiario
    if (data.deliveryMethod === "moncash" || data.deliveryMethod === "natcash") {
      let payoutSucceeded = false;
      let providerRef: string | undefined;

      try {
        const { bazikPayout } = await import("@/lib/bazik.server");
        const payoutRes = await bazikPayout({
          provider: data.deliveryMethod,
          phone: data.recipientPhone.trim(),
          amount: amountReceive,
          currency: dc.currency,
          reference: newTransfer.reference,
          recipientName: data.recipientName.trim(),
        });

        if (payoutRes.ok) {
          payoutSucceeded = true;
          providerRef = payoutRes.providerReference;
        } else {
          console.warn("[agentCreateCashTransfer] Bazik payout no ok:", payoutRes.error);
        }
      } catch (bazikErr) {
        console.error("Bazik auto-payout error:", bazikErr);
      }

      // La entrega se completa AUTOMÁTICAMENTE (sin intervención manual) si Bazik confirmó o si es admin directo
      if (payoutSucceeded || isAdminData) {
        await supabaseAdmin
          .from("transfers")
          .update({
            status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", newTransfer.id);

        await supabaseAdmin.from("transfer_events").insert({
          transfer_id: newTransfer.id,
          status: "completed",
          message: payoutSucceeded
            ? `¡Envío entregado automáticamente con éxito a ${data.recipientPhone} vía ${data.deliveryMethod.toUpperCase()}${providerRef ? ` (Ref Bazik: ${providerRef})` : ""}!`
            : `Envío completado y entregado automáticamente al beneficiario vía ${data.deliveryMethod.toUpperCase()}.`,
        });

        await supabaseAdmin.from("notifications").insert({
          user_id: context.userId,
          title: `Envío completado · ${newTransfer.reference}`,
          body: `Tu transferencia de ${amountReceive.toLocaleString()} HTG a ${data.recipientName} ha sido entregada exitosamente.`,
        });
      }
    } else if (isAdminData) {
      // Para cualquier otro método directo de admin, marcar de inmediato como completado
      await supabaseAdmin
        .from("transfers")
        .update({
          status: "completed",
          updated_at: new Date().toISOString(),
        })
        .eq("id", newTransfer.id);

      await supabaseAdmin.from("transfer_events").insert({
        transfer_id: newTransfer.id,
        status: "completed",
        message: `Transacción directa autorizada y completada exitosamente.`,
      });
    }

    return {
      ok: true,
      transferId: newTransfer.id,
      reference: newTransfer.reference,
      totalSend,
      currency: oc.currency,
      amountReceive,
      receiveCurrency: dc.currency,
      commission: agentCommission,
    };
  });

const agentConfirmCashSchema = z.object({
  reference: z.string().trim().min(3),
});

/**
 * Permite a un agente cobrar en efectivo una transferencia creada previamente por un cliente.
 */
export const agentConfirmCashPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof agentConfirmCashSchema>) => agentConfirmCashSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminData = await verifyIsAdmin(context);
    const isStaffData = await verifyIsStaff(context);
    if (!isAdminData && !isStaffData) {
      throw new Error("No autorizado");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: t, error } = await supabaseAdmin
      .from("transfers")
      .select("*")
      .ilike("reference", data.reference.trim())
      .maybeSingle();

    if (error || !t) throw new Error("No se encontró ningún envío con esa referencia.");
    if (t.status === "completed") throw new Error("Este envío ya fue entregado y completado.");
    if (t.status === "cancelled") throw new Error("Este envío fue cancelado.");
    if (t.status !== "awaiting_payment" && t.status !== "created") {
      throw new Error(`Este envío ya tiene estado: ${t.status}`);
    }
    if (t.payment_method !== "cash_agent") {
      throw new Error("Este envío no tiene método de pago en efectivo con agente.");
    }

    // REGLA AGENTES: Verificar que el agente cuente con saldo en su Billetera de Envíos de Dinero
    let agentWallet: { id: string; balance: number; currency: string } | null = null;
    if (!isAdminData) {
      const { data: w } = await supabaseAdmin
        .from("wallets")
        .select("id, balance, currency")
        .eq("user_id", context.userId)
        .eq("currency", t.receive_currency)
        .maybeSingle();

      agentWallet = w;
      if (!agentWallet) {
        throw new Error(
          "No tienes activa tu Billetera de Envíos de Dinero. Contacta a un administrador para recargar tu cuenta.",
        );
      }

      const currentBal = Number(agentWallet.balance) || 0;
      const required = Number(t.amount_receive);
      if (currentBal < required || currentBal <= 0) {
        throw new Error(
          `Saldo insuficiente en tu Billetera de Envíos de Dinero (${currentBal.toLocaleString()} HTG). Para procesar esta entrega requieres ${required.toLocaleString()} HTG.`,
        );
      }
    }

    // Asignar al agente actual y marcar como processing
    const { error: updErr } = await supabaseAdmin
      .from("transfers")
      .update({
        agent_id: context.userId,
        status: "processing",
      })
      .eq("id", t.id);

    if (updErr) throw new Error(updErr.message);

    // Descontar saldo de la Billetera de Envíos de Dinero del agente
    if (!isAdminData && agentWallet) {
      const currentBal = Number(agentWallet.balance) || 0;
      const required = Number(t.amount_receive);
      const nextBal = Math.round((currentBal - required) * 100) / 100;
      await supabaseAdmin
        .from("wallets")
        .update({ balance: nextBal, updated_at: new Date().toISOString() })
        .eq("id", agentWallet.id);

      await supabaseAdmin.from("wallet_transactions").insert({
        wallet_id: agentWallet.id,
        user_id: context.userId,
        kind: "agent_transfer_out",
        amount: -required,
        currency: agentWallet.currency,
        description: `Cobro en ventanilla de ${t.reference} (${t.delivery_method.toUpperCase()} a ${t.recipient_phone})`,
      });
    }

    await supabaseAdmin.from("transfer_events").insert({
      transfer_id: t.id,
      status: "processing",
      message: `Efectivo recibido en ventanilla por el agente. Cobrado: ${t.total_send} ${t.send_currency}.`,
    });

    await supabaseAdmin.from("notifications").insert({
      user_id: t.user_id,
      title: `Pago en efectivo confirmado · ${t.reference}`,
      body: `El agente ha recibido tu pago en efectivo por ${t.total_send} ${t.send_currency}. Tu envío está en proceso.`,
    });

    // Si es MonCash/NatCash, intentar pago y entrega 100% automática vía Bazik
    if (t.delivery_method === "moncash" || t.delivery_method === "natcash") {
      try {
        const { bazikPayout } = await import("@/lib/bazik.server");
        const payoutRes = await bazikPayout({
          provider: t.delivery_method,
          phone: t.recipient_phone,
          amount: Number(t.amount_receive),
          currency: t.receive_currency,
          reference: t.reference,
          recipientName: t.recipient_name,
        });

        if (payoutRes.ok) {
          await supabaseAdmin
            .from("transfers")
            .update({
              status: "completed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", t.id);

          await supabaseAdmin.from("transfer_events").insert({
            transfer_id: t.id,
            status: "completed",
            message: `¡Envío entregado automáticamente con éxito a ${t.recipient_phone} vía ${t.delivery_method.toUpperCase()}${payoutRes.providerReference ? ` (Ref Bazik: ${payoutRes.providerReference})` : ""}!`,
          });

          await supabaseAdmin.from("notifications").insert({
            user_id: t.user_id,
            title: `Envío completado · ${t.reference}`,
            body: `Tu transferencia de ${Number(t.amount_receive).toLocaleString()} HTG a ${t.recipient_name} ha sido entregada exitosamente vía ${t.delivery_method.toUpperCase()}.`,
          });

          return {
            ok: true,
            message: `¡Pago recibido y envío entregado automáticamente con éxito a ${t.recipient_phone}!`,
            transferId: t.id,
          };
        }
      } catch (err) {
        console.error("Bazik error:", err);
      }
    }

    return {
      ok: true,
      message: `¡Pago de ${t.total_send} ${t.send_currency} recibido exitosamente en efectivo!`,
      transferId: t.id,
    };
  });
