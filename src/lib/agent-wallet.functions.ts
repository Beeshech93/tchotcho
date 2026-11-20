import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const adjustAgentBalanceSchema = z.object({
  agentUserId: z.string().uuid("ID de usuario inválido"),
  amount: z.number().refine((val) => val !== 0, "El monto debe ser diferente de cero"),
  currency: z.string().trim().default("HTG"),
  description: z.string().trim().optional(),
});

export type AdjustAgentBalanceInput = z.infer<typeof adjustAgentBalanceSchema>;

/**
 * Permite a los administradores adicionar o ajustar saldo a la billetera de un agente.
 */
export const adminAdjustAgentBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: AdjustAgentBalanceInput) => adjustAgentBalanceSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    const isStaff = await verifyIsStaff(context);
    if (!isAdmin && !isStaff) {
      throw new Error("Solo administradores pueden adicionar saldo a los agentes.");
    }

    const { isMasterSuperAdmin } = await import("@/lib/admin-permissions.functions");
    if (isMasterSuperAdmin({ id: input.agentUserId }) && !isMasterSuperAdmin({ id: context.userId })) {
      throw new Error("No tienes permisos para modificar el saldo del Super Administrador.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar que la cuenta de destino sea un agente o administrador
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", input.agentUserId)
      .in("role", ["agent", "admin"]);

    // Si aún no tiene rol de agente o admin, asignar automáticamente el rol de agente
    if (!roleRows || roleRows.length === 0) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: input.agentUserId,
        role: "agent" as any,
      });
    }

    const currency = (input.currency || "HTG").toUpperCase();

    // 1. Obtener o crear billetera para el agente
    const { data: existingWallet, error: fetchErr } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", input.agentUserId)
      .eq("currency", currency)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(fetchErr.message);
    }

    let wallet = existingWallet;

    if (!wallet) {
      const { data: created, error: createError } = await supabaseAdmin
        .from("wallets")
        .insert({
          user_id: input.agentUserId,
          currency,
          balance: 0,
          status: "active",
        })
        .select("*")
        .single();

      if (createError || !created) {
        throw new Error(createError?.message || "No se pudo crear la billetera para el agente.");
      }
      wallet = created;
    }

    const currentBalance = Number(wallet.balance) || 0;
    const newBalance = Math.round((currentBalance + input.amount) * 100) / 100;
    if (newBalance < 0) {
      throw new Error(
        `El saldo resultante no puede ser negativo. Saldo actual: ${currentBalance} ${currency}.`,
      );
    }

    // 2. Actualizar saldo en la billetera
    const now = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("wallets")
      .update({
        balance: newBalance,
        updated_at: now,
      })
      .eq("id", wallet.id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    // 3. Registrar movimiento en wallet_transactions
    const desc = input.description?.trim()
      ? input.description.trim()
      : input.amount > 0
        ? `Saldo acreditado por Administrador (+${input.amount} ${currency})`
        : `Ajuste de saldo por Administrador (${input.amount} ${currency})`;

    await supabaseAdmin.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: input.agentUserId,
      kind: input.amount > 0 ? "admin_deposit" : "admin_deduct",
      amount: input.amount,
      currency,
      description: desc,
    });

    return {
      ok: true,
      walletId: wallet.id,
      previousBalance: currentBalance,
      newBalance,
      currency,
      message: `Saldo ${input.amount > 0 ? "adicionado" : "ajustado"} con éxito. Nuevo balance: ${newBalance.toLocaleString()} ${currency}.`,
    };
  });

/**
 * Consulta las billeteras y saldos de un usuario específico (para el panel de administración).
 */
export const getAgentWallets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { userId: string }) => input)
  .handler(async ({ data: input, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    const isStaff = await verifyIsStaff(context);
    if (!isAdmin && !isStaff && context.userId !== input.userId) {
      throw new Error("No autorizado");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", input.userId)
      .order("currency");

    if (error) throw new Error(error.message);
    return data ?? [];
  });
