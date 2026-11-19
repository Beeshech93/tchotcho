import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { verifyIsAdmin } from "@/lib/admin.server";

export type SaveExchangeRateInput = {
  from_currency: string;
  to_currency: string;
  rate: number;
  fee_percent: number;
  fee_fixed: number;
  agent_commission_percent: number;
};

export const adminSaveExchangeRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SaveExchangeRateInput) => data)
  .handler(async ({ data, context }) => {
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No autorizado para modificar tarifas.");
    }

    const { from_currency, to_currency, rate, fee_percent, fee_fixed, agent_commission_percent } =
      data;

    if (!from_currency || !to_currency) {
      throw new Error("Moneda de origen y destino requeridas.");
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("El tipo de cambio debe ser un número mayor a 0.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      from_currency: from_currency.toUpperCase().trim(),
      to_currency: to_currency.toUpperCase().trim(),
      rate: Number(rate),
      fee_percent: Math.max(0, Number(fee_percent) || 0),
      fee_fixed: Math.max(0, Number(fee_fixed) || 0),
      agent_commission_percent: Math.max(0, Number(agent_commission_percent) || 0),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await supabaseAdmin
      .from("exchange_rates")
      .upsert(payload, { onConflict: "from_currency,to_currency" })
      .select()
      .single();

    if (error) {
      console.error("[adminSaveExchangeRate] Error saving exchange rate:", error);
      throw new Error(error.message || "Error al guardar el corredor.");
    }

    return { ok: true, rate: saved };
  });

export type SaveTopupRateInput = {
  from_currency: string;
  to_currency: string;
  rate: number;
};

export const adminSaveTopupRate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: SaveTopupRateInput) => data)
  .handler(async ({ data, context }) => {
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No autorizado para modificar tasas Ding.");
    }

    const { from_currency, to_currency, rate } = data;

    if (!from_currency || !to_currency) {
      throw new Error("Moneda de origen y destino requeridas.");
    }
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new Error("La tasa debe ser un número mayor a 0.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const payload = {
      from_currency: from_currency.toUpperCase().trim(),
      to_currency: to_currency.toUpperCase().trim(),
      rate: Number(rate),
      is_active: true,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await supabaseAdmin
      .from("topup_rates")
      .upsert(payload, { onConflict: "from_currency,to_currency" })
      .select()
      .single();

    if (error) {
      console.error("[adminSaveTopupRate] Error saving topup rate:", error);
      throw new Error(error.message || "Error al guardar la tasa de recarga.");
    }

    return { ok: true, rate: saved };
  });
