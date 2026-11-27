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

/** Envía una recarga de saldo móvil descontando el monto de la billetera (los administradores están exentos de saldo). */
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

    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminUser = (await verifyIsAdmin(context)) || (await verifyIsStaff(context));
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (!isAdminUser) {
      // Regla obligatoria: Todas las cuentas no-admin deben verificar su identidad antes de operar
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("kyc_status")
        .eq("id", context.userId)
        .maybeSingle();

      if (callerProfile?.kyc_status !== "approved") {
        throw new Error("Debes verificar tu identidad (KYC aprobado) antes de realizar recargas.");
      }
    }

    let topupRef = "TOP-" + Math.random().toString(36).substring(2, 10).toUpperCase();
    let topupRow: { id: string; reference: string; amount: number; currency: string } | null = null;
    let targetWallet: { id: string; balance: number; currency: string } | null = null;
    const requiredAmount = data.topupAmount ?? data.amount;

    if (!isAdminUser) {
      // Regla de Agentes: Obligatorio tener saldo operativo y disminuye por transacción
      // Buscar primero Billetera de Recargas ('HTG_RECARGAS') o billetera operativa 'HTG'
      let { data: w } = await supabaseAdmin
        .from("wallets")
        .select("id, balance, currency")
        .eq("user_id", context.userId)
        .eq("currency", "HTG_RECARGAS")
        .maybeSingle();

      if (!w || Number(w.balance) < requiredAmount) {
        const { data: generalW } = await supabaseAdmin
          .from("wallets")
          .select("id, balance, currency")
          .eq("user_id", context.userId)
          .eq("currency", "HTG")
          .maybeSingle();

        if (generalW && (Number(generalW.balance) >= requiredAmount || !w)) {
          w = generalW;
        }
      }

      targetWallet = w;
      const currentBal = Number(targetWallet?.balance) || 0;
      if (!targetWallet || currentBal < requiredAmount || currentBal <= 0) {
        throw new Error(
          `Saldo insuficiente en tu billetera (${currentBal.toLocaleString()} HTG). Esta recarga requiere ${requiredAmount.toLocaleString()} HTG. Como agente, no puedes realizar transacciones sin saldo suficiente. Contacta a tu Super Agente o a un administrador para recargar tu cuenta.`,
        );
      }

      // Descontar saldo
      const nextBal = Math.round((currentBal - requiredAmount) * 100) / 100;
      await supabaseAdmin
        .from("wallets")
        .update({ balance: nextBal, updated_at: new Date().toISOString() })
        .eq("id", targetWallet.id);

      await supabaseAdmin.from("wallet_transactions").insert({
        wallet_id: targetWallet.id,
        user_id: context.userId,
        kind: "agent_topup_out",
        amount: -requiredAmount,
        currency: targetWallet.currency,
        description: `Recarga móvil ${data.operator ?? ""} a ${data.phone}`,
      });
    }

    // Registrar registro de topup
    const { data: directTopup, error: insertError } = await supabaseAdmin
      .from("topups")
      .insert({
        user_id: context.userId,
        wallet_id: targetWallet?.id ?? null,
        sku_code: data.skuCode,
        operator: data.operator ?? "",
        country_code: data.countryCode ?? "",
        phone: data.phone,
        amount: data.amount,
        currency: data.topupCurrency || "HTG",
        pay_amount: data.topupAmount ?? data.amount,
        pay_currency: data.topupCurrency || "HTG",
        status: "pending",
        reference: topupRef,
      })
      .select("id, reference, amount, currency")
      .single();

    if (insertError || !directTopup) {
      // Revertir si hubo descuento
      if (targetWallet && !isAdminUser) {
        const { data: freshW } = await supabaseAdmin
          .from("wallets")
          .select("balance")
          .eq("id", targetWallet.id)
          .single();
        const cur = Number(freshW?.balance) || 0;
        await supabaseAdmin
          .from("wallets")
          .update({ balance: cur + requiredAmount })
          .eq("id", targetWallet.id);
      }
      throw new Error(insertError?.message ?? "No se pudo registrar la recarga");
    }

    topupRow = {
      id: directTopup.id,
      reference: directTopup.reference,
      amount: Number(directTopup.amount),
      currency: directTopup.currency,
    };

    const { dingSendTransfer, applyDingResult } = await import("@/lib/dingconnect.server");
    try {
      const res = await dingSendTransfer({
        skuCode: data.skuCode,
        sendValue: data.topupAmount ?? Number(topupRow.amount),
        sendCurrency: data.topupCurrency ?? topupRow.currency,
        accountNumber: data.phone,
        distributorRef: topupRow.reference,
      });
      await applyDingResult({
        reference: topupRow.reference,
        state: res.processingState,
        providerRef: res.providerRef,
      });
      return { ok: true as const, reference: topupRow.reference, status: res.processingState };
    } catch (e) {
      // Revertir saldo del agente en caso de fallo técnico del proveedor
      if (targetWallet && !isAdminUser) {
        const { data: freshW } = await supabaseAdmin
          .from("wallets")
          .select("balance")
          .eq("id", targetWallet.id)
          .single();
        const cur = Number(freshW?.balance) || 0;
        await supabaseAdmin
          .from("wallets")
          .update({ balance: cur + requiredAmount })
          .eq("id", targetWallet.id);

        await supabaseAdmin.from("wallet_transactions").insert({
          wallet_id: targetWallet.id,
          user_id: context.userId,
          kind: "agent_topup_refund",
          amount: requiredAmount,
          currency: targetWallet.currency,
          description: `Reembolso por error de proveedor en recarga ${topupRow.reference}`,
        });
      }

      await applyDingResult({
        reference: topupRow.reference,
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

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdminUser = (await verifyIsAdmin(context)) || (await verifyIsStaff(context));

    if (!isAdminUser) {
      // Regla obligatoria: Todas las cuentas no-admin deben verificar su identidad antes de operar
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("kyc_status")
        .eq("id", context.userId)
        .maybeSingle();

      if (callerProfile?.kyc_status !== "approved") {
        throw new Error("Debes verificar tu identidad (KYC aprobado) antes de realizar recargas.");
      }
    }

    let topup: { id: string; reference: string; currency: string } | null = null;
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

    if (row && !error) {
      topup = row as unknown as { id: string; reference: string; currency: string };
    } else {
      // Fallback si la función RPC no está en el schema cache
      const genRef = "TOP-" + Math.random().toString(36).substring(2, 10).toUpperCase();
      const { data: directTopup, error: directErr } = await supabaseAdmin
        .from("topups")
        .insert({
          user_id: context.userId,
          sku_code: data.skuCode,
          operator: data.operator ?? "",
          country_code: data.countryCode ?? "",
          phone: data.phone,
          amount: data.topupAmount,
          currency: data.topupCurrency || "HTG",
          pay_amount: data.payAmount,
          pay_currency: data.payCurrency || "USD",
          status: "pending",
          reference: genRef,
        })
        .select("id, reference, currency")
        .single();

      if (directErr || !directTopup) {
        throw new Error(directErr?.message ?? error?.message ?? "No se pudo registrar la recarga");
      }
      topup = directTopup;
    }

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
        .in("role", ["agent", "super_agent", "admin"]);

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
          `Saldo insuficiente en tu Billetera de Recargas. Tu saldo actual es de ${currentBal.toLocaleString()} HTG y esta recarga requiere ${requiredAmount.toLocaleString()} HTG. Como agente, no puedes realizar transacciones sin saldo suficiente. Contacta a un administrador para recargar tu cuenta.`,
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
