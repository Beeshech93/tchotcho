import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  parseDingCredentialsInput,
  parseDingProductsInput,
  parseDingTopupInput,
  type DingCredentialsInput,
  type DingProductsInput,
  type DingTopupInput,
} from "@/lib/dingconnect.schemas";

/** Catálogo de operadores y montos disponibles por país. */
export const dingListProducts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: DingProductsInput) => parseDingProductsInput(input))
  .handler(async ({ data }) => {
    const { dingProducts } = await import("@/lib/dingconnect.server");
    try {
      return { ok: true as const, items: await dingProducts(data.countryCode) };
    } catch (e) {
      return { ok: false as const, items: [], error: (e as Error).message };
    }
  });

/** Envía una recarga de saldo móvil descontando el monto de la billetera. */
export const dingSendTopup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: DingTopupInput) => parseDingTopupInput(input))
  .handler(async ({ data, context }) => {
    const { dingValidateAccountNumber } = await import("@/lib/dingconnect.server");
    const validation = await dingValidateAccountNumber({
      skuCode: data.skuCode,
      sendValue: data.topupAmount ?? data.amount,
      sendCurrency: data.topupCurrency ?? "",
      accountNumber: data.phone,
    });
    if (!validation.ok) throw new Error(validation.reason);

    const { data: topup, error } = await context.supabase.rpc("create_topup", {
      _wallet_id: data.walletId,
      _sku_code: data.skuCode,
      _operator: data.operator ?? "",
      _country_code: data.countryCode ?? "",
      _phone: data.phone,
      _amount: data.amount,
      _topup_amount: data.topupAmount ?? null,
      _topup_currency: data.topupCurrency ?? null,
    });
    if (error || !topup) throw new Error(error?.message ?? "No se pudo crear la recarga");

    const row = topup as unknown as {
      id: string;
      reference: string;
      amount: number;
      currency: string;
    };

    const { dingSendTransfer, applyDingResult } = await import("@/lib/dingconnect.server");
    try {
      const res = await dingSendTransfer({
        skuCode: data.skuCode,
        sendValue: data.topupAmount ?? Number(row.amount),
        sendCurrency: data.topupCurrency ?? row.currency,
        accountNumber: data.phone,
        distributorRef: row.reference,
      });
      await applyDingResult({
        reference: row.reference,
        state: res.processingState,
        providerRef: res.providerRef,
      });
      return { ok: true as const, reference: row.reference, status: res.processingState };
    } catch (e) {
      await applyDingResult({
        reference: row.reference,
        state: "failed",
        detail: (e as Error).message,
      });
      throw new Error((e as Error).message);
    }
  });

const TOPUP_CARD_METHODS = ["card", "tarjeta", "mercado_pago", "mercadopago"];

/**
 * Crea una recarga pendiente pagada con un proveedor externo (tarjeta vía
 * Mercado Pago/Stripe, o OXXO/SPEI en México) en vez de la billetera interna.
 * El envío real a DingConnect se dispara cuando el webhook del proveedor
 * confirma el pago (ver applyExternalTopupPayment en dingconnect.server.ts).
 */
export const dingCreateTopupCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    (input: {
      skuCode: string;
      operator?: string;
      countryCode?: string;
      phone: string;
      // Monto/moneda que se le cobra al pagador (checkout de Mercado Pago/Stripe).
      payAmount: number;
      payCurrency: string;
      // Monto/moneda real que se envía al operador (DingConnect), calculado con
      // la tasa manual configurada en /admin.
      topupAmount: number;
      topupCurrency: string;
      paymentMethod: string;
      originCountry: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const { dingValidateAccountNumber } = await import("@/lib/dingconnect.server");
    const validation = await dingValidateAccountNumber({
      skuCode: data.skuCode,
      sendValue: data.topupAmount,
      sendCurrency: data.topupCurrency,
      accountNumber: data.phone,
    });
    if (!validation.ok) throw new Error(validation.reason);

    const { data: row, error } = await context.supabase.rpc("create_topup_pending", {
      _sku_code: data.skuCode,
      _operator: data.operator ?? "",
      _country_code: data.countryCode ?? "",
      _phone: data.phone,
      _amount: data.topupAmount,
      _currency: data.topupCurrency,
      _payment_method: data.paymentMethod,
      _origin_country: data.originCountry,
    });
    if (error || !row) throw new Error(error?.message ?? "No se pudo crear la recarga");

    const topup = row as unknown as { id: string; reference: string; currency: string };

    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminUser = (await verifyIsAdmin(context)) || (await verifyIsStaff(context));

    if (data.paymentMethod === "direct") {
      if (!isAdminUser) {
        throw new Error("Solo administradores pueden realizar transacciones directas.");
      }

      const { dingSendTransfer, applyDingResult } = await import("@/lib/dingconnect.server");
      try {
        const res = await dingSendTransfer({
          skuCode: data.skuCode,
          sendValue: data.topupAmount,
          sendCurrency: data.topupCurrency,
          accountNumber: data.phone,
          distributorRef: topup.reference,
        });

        await applyDingResult({
          reference: topup.reference,
          state: res.processingState,
          providerRef: res.providerRef,
        });

        return {
          mode: "direct" as const,
          reference: topup.reference,
          status: res.processingState,
        };
      } catch (err: any) {
        await applyDingResult({
          reference: topup.reference,
          state: "failed",
          detail: err?.message,
        });
        throw err;
      }
    }

    // BILLETERA DE RECARGAS DE AGENTE: Descuento directo de saldo operativo
    if (data.paymentMethod === "agent_wallet") {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Verificar que el usuario tenga rol de agente o admin
      const { data: roleRows } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", context.userId)
        .in("role", ["agent", "admin"]);

      if (!roleRows || roleRows.length === 0) {
        throw new Error("Solo agentes autorizados pueden enviar recargas desde su Billetera de Recargas.");
      }

      // Buscar Billetera de Recargas (HTG_RECARGAS)
      let { data: topupWallet } = await supabaseAdmin
        .from("wallets")
        .select("*")
        .eq("user_id", context.userId)
        .eq("currency", "HTG_RECARGAS")
        .maybeSingle();

      if (!topupWallet) {
        // Fallback si aún no tiene HTG_RECARGAS
        const { data: generalWallet } = await supabaseAdmin
          .from("wallets")
          .select("*")
          .eq("user_id", context.userId)
          .eq("currency", "HTG")
          .maybeSingle();
        topupWallet = generalWallet;
      }

      if (!topupWallet) {
        throw new Error(
          "No tienes una Billetera de Recargas configurada. Sin saldo operativo no puedes enviar recargas. Contacta a un administrador para recargar tu cuenta.",
        );
      }

      const currentBal = Number(topupWallet.balance) || 0;
      const requiredAmount = data.topupAmount; // Monto HTG a enviar a Haití

      if (currentBal < requiredAmount || currentBal <= 0) {
        throw new Error(
          `Saldo insuficiente en tu Billetera de Recargas. Tu saldo actual es de ${currentBal.toLocaleString()} HTG y esta recarga requiere ${requiredAmount.toLocaleString()} HTG. Sin saldo no puedes realizar envíos.`,
        );
      }

      // Descontar saldo de la billetera de recargas
      const nextBal = Math.round((currentBal - requiredAmount) * 100) / 100;
      await supabaseAdmin
        .from("wallets")
        .update({ balance: nextBal, updated_at: new Date().toISOString() })
        .eq("id", topupWallet.id);

      await supabaseAdmin.from("wallet_transactions").insert({
        wallet_id: topupWallet.id,
        user_id: context.userId,
        kind: "agent_topup_out",
        amount: -requiredAmount,
        currency: topupWallet.currency,
        description: `Recarga de saldo a ${data.phone} · ${data.operator ?? ""} (Ref: ${topup.reference})`,
      });

      // Disparar envío real a DingConnect
      const { dingSendTransfer, applyDingResult } = await import("@/lib/dingconnect.server");
      try {
        const res = await dingSendTransfer({
          skuCode: data.skuCode,
          sendValue: data.topupAmount,
          sendCurrency: data.topupCurrency,
          accountNumber: data.phone,
          distributorRef: topup.reference,
        });

        await applyDingResult({
          reference: topup.reference,
          state: res.processingState,
          providerRef: res.providerRef,
        });

        return {
          mode: "direct" as const,
          reference: topup.reference,
          status: res.processingState,
        };
      } catch (err: any) {
        // Revertir y reembolsar a la Billetera de Recargas si falla DingConnect
        await supabaseAdmin
          .from("wallets")
          .update({ balance: currentBal, updated_at: new Date().toISOString() })
          .eq("id", topupWallet.id);

        await supabaseAdmin.from("wallet_transactions").insert({
          wallet_id: topupWallet.id,
          user_id: context.userId,
          kind: "agent_topup_refund",
          amount: requiredAmount,
          currency: topupWallet.currency,
          description: `Reembolso por error de proveedor en recarga ${topup.reference}: ${err?.message || "Fallo técnico"}`,
        });

        await applyDingResult({
          reference: topup.reference,
          state: "failed",
          detail: err?.message,
        });
        throw err;
      }
    }

    const email = context.claims?.email as string | undefined;
    const base = process.env["PUBLIC_URL"] || "https://tchotcho.app";
    const description = `Recarga ${data.phone} · ${data.operator ?? ""}`;

    const { data: profile } = await context.supabase
      .from("profiles")
      .select("full_name")
      .eq("id", context.userId)
      .maybeSingle();
    const [firstNameRaw, ...rest] = (profile?.full_name || "Cliente Lajan").split(" ");
    const firstName = firstNameRaw || "Cliente";
    const lastName = rest.join(" ") || "Rapid";

    if (data.originCountry === "MX") {
      if (data.paymentMethod === "oxxo") {
        if (!email) throw new Error("Necesitamos un correo en tu cuenta para emitir la ficha");
        const { createOxxoVoucher } = await import("@/lib/mercadopago.server");
        const result = await createOxxoVoucher({
          reference: topup.reference,
          amount: data.payAmount,
          description,
          payerEmail: email,
          payerFirstName: firstName,
          payerLastName: lastName,
        });
        if (!result.ok) throw new Error(result.error);
        return { mode: "voucher" as const, voucher: result.voucher, reference: topup.reference };
      }

      if (data.paymentMethod === "spei") {
        if (!email) throw new Error("Necesitamos un correo en tu cuenta para emitir la CLABE");
        const { createSpeiReference } = await import("@/lib/mercadopago.server");
        const result = await createSpeiReference({
          reference: topup.reference,
          amount: data.payAmount,
          description,
          payerEmail: email,
          payerFirstName: firstName,
          payerLastName: lastName,
        });
        if (!result.ok) throw new Error(result.error);
        return { mode: "spei" as const, spei: result.spei, reference: topup.reference };
      }

      // Tarjeta en México vía Mercado Pago.
      const { createMpPreference } = await import("@/lib/mercadopago.server");
      const result = await createMpPreference({
        transferId: topup.id,
        reference: topup.reference,
        amount: data.payAmount,
        currency: data.payCurrency,
        description,
        ...(email ? { buyerEmail: email } : {}),
        cardOnly: true,
        successUrl: `${base}/recargas?payment=success`,
        pendingUrl: `${base}/recargas?payment=pending`,
        failureUrl: `${base}/recargas?payment=failure`,
      });
      if (!result.ok) throw new Error(result.error);
      return {
        mode: "checkout" as const,
        checkoutUrl: result.checkoutUrl,
        reference: topup.reference,
      };
    }

    // Tarjeta fuera de México vía Stripe.
    if (!TOPUP_CARD_METHODS.includes(data.paymentMethod)) {
      throw new Error("Este método de pago no está disponible fuera de México");
    }
    const { createStripeCheckoutSession } = await import("@/lib/stripe.server");
    const result = await createStripeCheckoutSession({
      transferId: topup.id,
      reference: topup.reference,
      amount: data.payAmount,
      currency: data.payCurrency,
      description,
      ...(email ? { buyerEmail: email } : {}),
      successUrl: `${base}/recargas?payment=success`,
      cancelUrl: `${base}/recargas?payment=failure`,
    });
    if (!result.ok) throw new Error(result.error);
    return {
      mode: "checkout" as const,
      checkoutUrl: result.checkoutUrl,
      reference: topup.reference,
    };
  });

/** Estado de configuración de DingConnect (solo administradores). */
export const dingStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) throw new Error("No autorizado");
    const { dingStatusInfo } = await import("@/lib/dingconnect.server");
    return dingStatusInfo();
  });

/** Guardar manualmente las credenciales de DingConnect (solo administradores). */
export const dingSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: DingCredentialsInput) => parseDingCredentialsInput(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) throw new Error("No autorizado");
    const { saveDingCred } = await import("@/lib/dingconnect.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveDingCred(name, value.trim(), context.userId, context.supabase);
    }
    return { ok: true };
  });
