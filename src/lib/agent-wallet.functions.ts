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

    // Las cuentas clientes no necesitan saldo operativo. Solo las cuentas de agentes pueden recibir saldo.
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", input.agentUserId)
      .in("role", ["agent", "admin"]);

    if (!roleRows || roleRows.length === 0) {
      throw new Error(
        "Las cuentas clientes no necesitan saldo. Solo las cuentas de agentes pueden recibir asignación de saldo operativo.",
      );
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

    // 3. Registrar movimiento en wallet_transactions con identificación del admin
    const { data: adminProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", context.userId)
      .maybeSingle();

    const adminName = adminProfile?.full_name || adminProfile?.phone || "Admin";
    const customNote = input.description?.trim();
    const actionLabel = input.amount > 0 ? `+${input.amount}` : `${input.amount}`;
    const desc = customNote
      ? `${customNote} (Por: ${adminName})`
      : `Saldo ${input.amount > 0 ? "acreditado" : "ajustado"} (${actionLabel} ${currency}) por Admin: ${adminName}`;

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

export interface AgentBalanceHistoryItem {
  id: string;
  agentUserId: string;
  agentName: string;
  agentPhone: string;
  agentEmail: string;
  amount: number;
  currency: string;
  kind: string;
  description: string;
  createdAt: string;
}

/**
 * Consulta el historial de adiciones y ajustes de saldo realizados a los agentes.
 */
export const getAgentBalanceHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { agentUserId?: string | undefined; limit?: number | undefined }) => input)
  .handler(async ({ data: input, context }): Promise<AgentBalanceHistoryItem[]> => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    const isStaff = await verifyIsStaff(context);
    const isSelf = Boolean(input.agentUserId && context.userId === input.agentUserId);

    if (!isAdmin && !isStaff && !isSelf) {
      throw new Error("No autorizado para consultar el historial de saldos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("wallet_transactions")
      .select("id, user_id, amount, currency, kind, description, created_at")
      .in("kind", ["admin_deposit", "admin_deduct", "agent_deposit"])
      .order("created_at", { ascending: false })
      .limit(input.limit || 150);

    if (input.agentUserId) {
      query = query.eq("user_id", input.agentUserId);
    }

    const { data: txs, error } = await query;
    if (error) {
      console.error("Error al consultar histórico de adiciones:", error);
      throw new Error(error.message);
    }

    if (!txs || txs.length === 0) return [];

    const userIds = Array.from(new Set(txs.map((t) => t.user_id)));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .in("id", userIds);

    const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    return txs.map((t) => {
      const p = profileMap.get(t.user_id);
      return {
        id: t.id,
        agentUserId: t.user_id,
        agentName: p?.full_name || p?.phone || "Agente",
        agentPhone: p?.phone || "",
        agentEmail: "",
        amount: Number(t.amount),
        currency: t.currency,
        kind: t.kind,
        description: t.description || "",
        createdAt: t.created_at,
      };
    });
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
