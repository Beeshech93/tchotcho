import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const adjustAgentBalanceSchema = z.object({
  agentUserId: z.string().uuid("ID de usuario inválido"),
  amount: z.number().refine((val) => val !== 0, "El monto debe ser diferente de cero"),
  currency: z.string().trim().default("HTG"),
  walletType: z.enum(["transfers", "topups"]).default("transfers"),
  description: z.string().trim().optional(),
});

export type AdjustAgentBalanceInput = z.infer<typeof adjustAgentBalanceSchema>;

/**
 * Permite a los administradores adicionar o ajustar saldo a la billetera de un agente.
 * Soporta de forma separada:
 * - walletType "transfers": Billetera de Envíos de Dinero (MonCash/NatCash/Efectivo) -> currency: 'HTG'
 * - walletType "topups": Billetera de Recargas Telefónicas (DingConnect) -> currency: 'HTG_RECARGAS'
 */
export const adminAdjustAgentBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: AdjustAgentBalanceInput) => adjustAgentBalanceSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("Solo administradores pueden adicionar saldo a los agentes.");
    }

    const { isMasterSuperAdmin } = await import("@/lib/admin-permissions.functions");
    if (isMasterSuperAdmin({ id: input.agentUserId }) && !isMasterSuperAdmin({ id: context.userId })) {
      throw new Error("No tienes permisos para modificar el saldo del Super Administrador.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Verificar si el usuario tiene rol de agente o super agente en user_roles
    const { data: roleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", input.agentUserId);

    let hasAgentRole = (roleRows ?? []).some(
      (r) => r.role === "agent" || r.role === "super_agent",
    );

    // 2. Verificar marca de Super Agente en integration_credentials
    const { data: saCred } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", `SUPER_AGENT_ROLE_${input.agentUserId}`)
      .maybeSingle();

    const isSuperAgentCredential =
      saCred?.value === "true" || saCred?.value === "active";

    // 3. Verificar si es agente subordinado en la red de un Super Agente
    const { data: parentCred } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", `AGENT_PARENT_SUPER_AGENT_${input.agentUserId}`)
      .maybeSingle();

    const isSubordinateAgent = Boolean(parentCred?.value);

    // 4. Verificar metadatos de auth.users como respaldo
    let isMetadataAgent = false;
    try {
      const { data: uData } = await supabaseAdmin.auth.admin.getUserById(input.agentUserId);
      const meta = uData?.user?.user_metadata as any;
      if (
        meta?.role === "agent" ||
        meta?.role === "super_agent" ||
        meta?.is_super_agent === true ||
        Boolean(meta?.parent_super_agent_id)
      ) {
        isMetadataAgent = true;
      }
    } catch {}

    // Si el usuario aún no tiene rol de agente ni super agente, al acreditarle saldo el administrador
    // lo promueve automáticamente a rol 'agent' para que pueda operar de inmediato sin fricciones.
    if (!hasAgentRole && !isSuperAgentCredential) {
      try {
        await supabaseAdmin
          .from("user_roles")
          .delete()
          .eq("user_id", input.agentUserId)
          .eq("role", "client" as any);
        await supabaseAdmin.from("user_roles").upsert({
          user_id: input.agentUserId,
          role: "agent" as any,
        });
        hasAgentRole = true;
      } catch (errSync) {
        console.warn("[adminAdjustAgentBalance] auto-sync agent role failed:", errSync);
      }
    }

    const targetIsAdmin = (roleRows ?? []).some((r) => r.role === "admin");
    if (targetIsAdmin && !hasAgentRole && !isSuperAgentCredential) {
      throw new Error(
        "Los administradores no requieren saldo para operar. La opción de adicionar saldo está disponible para agentes y Super Agentes.",
      );
    }

    let userCountryCurrency = "HTG";
    try {
      const { data: prof } = await supabaseAdmin
        .from("profiles")
        .select("phone, country")
        .eq("id", input.agentUserId)
        .maybeSingle();
      const { getCurrencyFromPhone } = await import("@/lib/phone");
      userCountryCurrency = getCurrencyFromPhone(prof?.phone, prof?.country);
    } catch {}

    const baseCurrency = (input.currency || userCountryCurrency || "HTG").toUpperCase();
    const targetCurrency =
      input.walletType === "topups"
        ? (baseCurrency === "HTG" ? "HTG_RECARGAS" : `${baseCurrency}_RECARGAS`)
        : baseCurrency;
    const walletLabel =
      input.walletType === "topups"
        ? `Billetera de Recargas Telefónicas (${baseCurrency})`
        : `Billetera de Envíos de Dinero (${baseCurrency})`;

    // 1. Obtener o crear billetera específica para el agente
    const { data: existingWallet, error: fetchErr } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", input.agentUserId)
      .eq("currency", targetCurrency)
      .maybeSingle();

    if (fetchErr) {
      throw new Error(fetchErr.message);
    }

    let wallet = existingWallet;
    let isVirtual = false;
    const virtualCredKey = `AGENT_VIRTUAL_WALLET_${input.agentUserId}_${targetCurrency}`;

    if (!wallet) {
      // Verificar si existe como billetera virtual en integration_credentials
      const { data: vCred } = await supabaseAdmin
        .from("integration_credentials")
        .select("value")
        .eq("name", virtualCredKey)
        .maybeSingle();

      let vWalletData: any = null;
      if (vCred?.value) {
        try {
          vWalletData = JSON.parse(vCred.value);
        } catch {}
      }

      // Intentar insertar en la tabla real wallets
      const { data: created, error: createError } = await supabaseAdmin
        .from("wallets")
        .insert({
          user_id: input.agentUserId,
          currency: targetCurrency,
          balance: 0,
          status: "active",
        })
        .select("*")
        .single();

      if (createError) {
        // Si falla por el check constraint wallets_currency_check, usar almacenamiento virtual resiliente
        if (createError.message?.includes("wallets_currency_check")) {
          isVirtual = true;
          wallet = vWalletData || {
            id: `virt-${Date.now()}`,
            user_id: input.agentUserId,
            currency: targetCurrency,
            balance: 0,
            status: "active",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        } else {
          throw new Error(createError?.message || `No se pudo crear la ${walletLabel} para el agente.`);
        }
      } else {
        wallet = created;
      }
    }

    if (!wallet) {
      throw new Error(`No se pudo inicializar la billetera ${walletLabel} para el agente.`);
    }

    const currentBalance = Number(wallet.balance) || 0;
    const newBalance = Math.round((currentBalance + input.amount) * 100) / 100;
    if (newBalance < 0) {
      throw new Error(
        `El saldo resultante no puede ser negativo. Saldo actual en ${walletLabel}: ${currentBalance.toLocaleString()} ${baseCurrency}.`,
      );
    }

    // 2. Actualizar saldo en la billetera
    const now = new Date().toISOString();
    if (isVirtual || wallet.id.startsWith("virt-")) {
      await supabaseAdmin.from("integration_credentials").upsert({
        name: virtualCredKey,
        value: JSON.stringify({
          id: wallet.id,
          user_id: input.agentUserId,
          currency: targetCurrency,
          balance: newBalance,
          status: "active",
          updated_at: now,
        }),
        updated_at: now,
      });
    } else {
      const { error: updateError } = await supabaseAdmin
        .from("wallets")
        .update({
          balance: newBalance,
          updated_at: now,
        })
        .eq("id", wallet.id);

      if (updateError) {
        if (updateError.message?.includes("wallets_currency_check")) {
          await supabaseAdmin.from("integration_credentials").upsert({
            name: virtualCredKey,
            value: JSON.stringify({
              id: wallet.id,
              user_id: input.agentUserId,
              currency: targetCurrency,
              balance: newBalance,
              status: "active",
              updated_at: now,
            }),
            updated_at: now,
          });
        } else {
          throw new Error(updateError.message);
        }
      }
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
      ? `${customNote} (${walletLabel} · Por: ${adminName})`
      : `Saldo ${input.amount > 0 ? "acreditado" : "ajustado"} (${actionLabel} ${baseCurrency}) en ${walletLabel} por Admin: ${adminName}`;

    try {
      await (supabaseAdmin.from("wallet_transactions") as any).insert({
        wallet_id: wallet.id,
        user_id: input.agentUserId,
        kind: input.amount > 0 ? "admin_deposit" : "admin_deduct",
        amount: input.amount,
        currency: targetCurrency,
        description: desc,
      });
    } catch (txErr) {
      console.warn("[adminAdjustAgentBalance] Non-fatal transaction log error:", txErr);
    }

    return {
      ok: true,
      walletId: wallet.id,
      previousBalance: currentBalance,
      newBalance,
      currency: targetCurrency,
      walletType: input.walletType,
      message: `Saldo ${input.amount > 0 ? "adicionado" : "ajustado"} con éxito en ${walletLabel}. Nuevo balance: ${newBalance.toLocaleString()} ${baseCurrency}.`,
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
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    const targetUserId = input.agentUserId || (!isAdmin ? context.userId : undefined);
    const isSelf = Boolean(targetUserId && context.userId === targetUserId);

    if (!isAdmin && !isSelf) {
      throw new Error("No autorizado para consultar el historial de saldos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let query = supabaseAdmin
      .from("wallet_transactions")
      .select("id, user_id, amount, currency, kind, description, created_at")
      .in("kind", ["admin_deposit", "admin_deduct", "agent_deposit"])
      .order("created_at", { ascending: false })
      .limit(input.limit || 150);

    if (targetUserId) {
      query = query.eq("user_id", targetUserId);
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
 * Garantiza que existan las billeteras de Envíos de Dinero y Recargas en la moneda de su país.
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

    // Detectar la moneda de su país según su perfil y teléfono
    let agentCountryCurrency = "HTG";
    let isHaiti = true;
    try {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("phone, country")
        .eq("id", input.userId)
        .maybeSingle();
      const { getCountryInfoFromPhone } = await import("@/lib/phone");
      const cInfo = getCountryInfoFromPhone(p?.phone, p?.country);
      agentCountryCurrency = cInfo.currency;
      isHaiti = cInfo.code === "HT";
    } catch {}

    const primaryCurrency = agentCountryCurrency || "HTG";
    const primaryTopupCurrency =
      primaryCurrency === "HTG" ? "HTG_RECARGAS" : `${primaryCurrency}_RECARGAS`;

    // 1. Consultar billeteras en la tabla real wallets
    const { data: existingWallets } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", input.userId);

    const hasPrimaryTransfers = existingWallets?.some((w) => w.currency === primaryCurrency);
    const hasPrimaryTopups = existingWallets?.some((w) => w.currency === primaryTopupCurrency);

    if (!hasPrimaryTransfers) {
      try {
        await supabaseAdmin.from("wallets").insert({
          user_id: input.userId,
          currency: primaryCurrency,
          balance: 0,
          status: "active",
        });
      } catch {}
    }

    if (!hasPrimaryTopups) {
      try {
        await supabaseAdmin.from("wallets").insert({
          user_id: input.userId,
          currency: primaryTopupCurrency,
          balance: 0,
          status: "active",
        });
      } catch {}
    }

    // Si el usuario es de Haití, asegurar HTG y HTG_RECARGAS
    if (isHaiti) {
      const hasHtg = existingWallets?.some((w) => w.currency === "HTG");
      const hasHtgTopups = existingWallets?.some((w) => w.currency === "HTG_RECARGAS");
      if (!hasHtg) {
        try {
          await supabaseAdmin.from("wallets").insert({
            user_id: input.userId,
            currency: "HTG",
            balance: 0,
            status: "active",
          });
        } catch {}
      }
      if (!hasHtgTopups) {
        try {
          await supabaseAdmin.from("wallets").insert({
            user_id: input.userId,
            currency: "HTG_RECARGAS",
            balance: 0,
            status: "active",
          });
        } catch {}
      }
    }

    const { data: dbWallets, error } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", input.userId)
      .order("currency");

    if (error) throw new Error(error.message);

    // 2. Consultar billeteras virtuales almacenadas en integration_credentials
    const { data: vCreds } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .like("name", `AGENT_VIRTUAL_WALLET_${input.userId}_%`);

    const result = [...(dbWallets ?? [])];
    const existingCurrencies = new Set(result.map((w) => w.currency));

    for (const vc of vCreds ?? []) {
      try {
        const parsed = JSON.parse(vc.value);
        if (parsed?.currency && !existingCurrencies.has(parsed.currency)) {
          result.push({
            id: parsed.id || vc.name,
            user_id: input.userId,
            currency: parsed.currency,
            balance: Number(parsed.balance) || 0,
            status: parsed.status || "active",
            created_at: parsed.created_at || new Date().toISOString(),
            updated_at: parsed.updated_at || new Date().toISOString(),
          } as any);
          existingCurrencies.add(parsed.currency);
        }
      } catch {}
    }

    return result;
  });

/**
 * Asegura que el agente autenticado tenga activas sus billeteras en la moneda de su país:
 * 1. Envíos de Dinero (moneda de su país, ej: MXN, DOP, USD, CLP)
 * 2. Recargas Telefónicas (ej: MXN_RECARGAS, DOP_RECARGAS)
 */
export const ensureMyAgentWallets = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let agentCountryCurrency = "HTG";
    let isHaiti = true;
    try {
      const { data: p } = await supabaseAdmin
        .from("profiles")
        .select("phone, country")
        .eq("id", context.userId)
        .maybeSingle();
      const { getCountryInfoFromPhone } = await import("@/lib/phone");
      const cInfo = getCountryInfoFromPhone(p?.phone, p?.country);
      agentCountryCurrency = cInfo.currency;
      isHaiti = cInfo.code === "HT";
    } catch {}

    const primaryCurrency = agentCountryCurrency || "HTG";
    const primaryTopupCurrency =
      primaryCurrency === "HTG" ? "HTG_RECARGAS" : `${primaryCurrency}_RECARGAS`;

    const { data: existing } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", context.userId);

    const hasTransfers = existing?.some((w) => w.currency === primaryCurrency);
    const hasTopups = existing?.some((w) => w.currency === primaryTopupCurrency);

    if (!hasTransfers) {
      try {
        await supabaseAdmin.from("wallets").insert({
          user_id: context.userId,
          currency: primaryCurrency,
          balance: 0,
          status: "active",
        });
      } catch {}
    }

    if (!hasTopups) {
      try {
        await supabaseAdmin.from("wallets").insert({
          user_id: context.userId,
          currency: primaryTopupCurrency,
          balance: 0,
          status: "active",
        });
      } catch {}
    }

    if (isHaiti) {
      const hasHtg = existing?.some((w) => w.currency === "HTG");
      const hasHtgTopups = existing?.some((w) => w.currency === "HTG_RECARGAS");
      if (!hasHtg) {
        try {
          await supabaseAdmin.from("wallets").insert({
            user_id: context.userId,
            currency: "HTG",
            balance: 0,
            status: "active",
          });
        } catch {}
      }
      if (!hasHtgTopups) {
        try {
          await supabaseAdmin.from("wallets").insert({
            user_id: context.userId,
            currency: "HTG_RECARGAS",
            balance: 0,
            status: "active",
          });
        } catch {}
      }
    }

    const { data: dbWallets } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", context.userId)
      .order("currency");

    // Incluir también cualquier billetera virtual
    const { data: vCreds } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .like("name", `AGENT_VIRTUAL_WALLET_${context.userId}_%`);

    const result = [...(dbWallets ?? [])];
    const existingCurrencies = new Set(result.map((w) => w.currency));

    for (const vc of vCreds ?? []) {
      try {
        const parsed = JSON.parse(vc.value);
        if (parsed?.currency && !existingCurrencies.has(parsed.currency)) {
          result.push({
            id: parsed.id || vc.name,
            user_id: context.userId,
            currency: parsed.currency,
            balance: Number(parsed.balance) || 0,
            status: parsed.status || "active",
            created_at: parsed.created_at || new Date().toISOString(),
            updated_at: parsed.updated_at || new Date().toISOString(),
          } as any);
          existingCurrencies.add(parsed.currency);
        }
      } catch {}
    }

    return result;
  });

/**
 * Asegura que el usuario tenga creada la billetera correspondiente a la moneda de su número de teléfono / país.
 */
export const ensureUserCountryWallet = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getCurrencyFromPhone } = await import("@/lib/phone");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("phone, country")
      .eq("id", context.userId)
      .maybeSingle();

    let userPhone = profile?.phone;
    let userCountry = profile?.country;

    if (!userPhone) {
      try {
        const { data: uData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
        userPhone = uData?.user?.phone || (uData?.user?.user_metadata as any)?.phone;
        userCountry = userCountry || (uData?.user?.user_metadata as any)?.country;
      } catch {}
    }

    const targetCurrency = getCurrencyFromPhone(userPhone, userCountry);

    const { data: existing } = await supabaseAdmin
      .from("wallets")
      .select("currency")
      .eq("user_id", context.userId);

    const hasTargetWallet = existing?.some((w) => w.currency === targetCurrency);
    if (!hasTargetWallet) {
      await supabaseAdmin.from("wallets").insert({
        user_id: context.userId,
        currency: targetCurrency,
        balance: 0,
        status: "active",
      });
    }

    const { data: allWallets } = await supabaseAdmin
      .from("wallets")
      .select("*")
      .eq("user_id", context.userId)
      .order("created_at");

    return {
      primaryCurrency: targetCurrency,
      wallets: allWallets ?? [],
    };
  });
