import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SubordinateAgentRecord {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  commissionPercent: number;
  addedAt: string;
  balanceHTG: number;
  balanceTopupsHTG: number;
  totalTransfersCount: number;
  totalVolumeSend: number;
  commissionsGenerated: number;
}

export interface SubordinateTransactionRecord {
  id: string;
  reference: string;
  createdAt: string;
  status: string;
  agentId: string;
  agentName: string;
  agentPhone: string | null;
  recipientName: string;
  recipientPhone: string;
  deliveryMethod: string;
  amountSend: number;
  sendCurrency: string;
  amountReceive: number;
  receiveCurrency: string;
  superAgentCommission: number;
}

const getSuperAgentKey = (superAgentId: string) => `SUPER_AGENT_NETWORK_${superAgentId}`;
const getAgentParentKey = (agentId: string) => `AGENT_PARENT_SUPER_AGENT_${agentId}`;

/**
 * Obtiene la lista de agentes bajo la red del Super Agente autenticado junto con métricas agregadas.
 */
export const getMySubordinateAgents = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    agents: SubordinateAgentRecord[];
    summary: {
      totalAgents: number;
      totalVolumeHTG: number;
      totalCommissionsHTG: number;
      totalOperations: number;
    };
  }> => {
    const { verifyIsStaff, verifyIsAdmin } = await import("@/lib/admin.server");
    const isStaff = await verifyIsStaff(context);
    const isAdmin = await verifyIsAdmin(context);
    if (!isStaff && !isAdmin) {
      throw new Error("No tienes permisos para acceder a la red de Super Agente.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Leer los agentes registrados bajo este Super Agente
    const networkKey = getSuperAgentKey(context.userId);
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", networkKey)
      .maybeSingle();

    let rawList: { id: string; commissionPercent?: number; addedAt?: string }[] = [];
    if (credRow?.value) {
      try {
        const parsed = JSON.parse(credRow.value);
        if (Array.isArray(parsed)) {
          rawList = parsed;
        } else if (Array.isArray(parsed.agents)) {
          rawList = parsed.agents;
        }
      } catch {
        rawList = [];
      }
    }

    if (rawList.length === 0) {
      return {
        agents: [],
        summary: {
          totalAgents: 0,
          totalVolumeHTG: 0,
          totalCommissionsHTG: 0,
          totalOperations: 0,
        },
      };
    }

    const agentIds = rawList.map((a) => a.id);

    // 2. Consultar perfiles, billeteras y transferencias de estos agentes
    const [{ data: profiles }, { data: wallets }, { data: transfers }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").in("id", agentIds),
      supabaseAdmin.from("wallets").select("user_id, currency, balance").in("user_id", agentIds),
      supabaseAdmin
        .from("transfers")
        .select("id, agent_id, amount_send, send_currency, amount_receive, receive_currency, status, agent_commission_send")
        .in("agent_id", agentIds),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));
    const walletList = wallets ?? [];
    const transferList = transfers ?? [];

    let totalVolumeHTG = 0;
    let totalCommissionsHTG = 0;
    let totalOperations = 0;

    const agents: SubordinateAgentRecord[] = rawList.map((item) => {
      const p = profMap.get(item.id);
      const agentWallets = walletList.filter((w) => w.user_id === item.id);
      const htgBal = Number(agentWallets.find((w) => w.currency === "HTG")?.balance ?? 0);
      const topupBal = Number(agentWallets.find((w) => w.currency === "HTG_RECARGAS")?.balance ?? 0);

      const agentTxs = transferList.filter((t) => t.agent_id === item.id && t.status !== "cancelled");
      const commPct = Number(item.commissionPercent ?? 0.5);

      let commGen = 0;
      let volSend = 0;
      for (const tx of agentTxs) {
        const amt = Number(tx.amount_send || 0);
        volSend += amt;
        commGen += Math.round(amt * (commPct / 100) * 100) / 100;
      }

      totalVolumeHTG += volSend;
      totalCommissionsHTG += commGen;
      totalOperations += agentTxs.length;

      return {
        id: item.id,
        fullName: p?.full_name || "Agente",
        email: null,
        phone: p?.phone || null,
        commissionPercent: commPct,
        addedAt: item.addedAt || new Date().toISOString(),
        balanceHTG: htgBal,
        balanceTopupsHTG: topupBal,
        totalTransfersCount: agentTxs.length,
        totalVolumeSend: Math.round(volSend * 100) / 100,
        commissionsGenerated: Math.round(commGen * 100) / 100,
      };
    });

    return {
      agents,
      summary: {
        totalAgents: agents.length,
        totalVolumeHTG: Math.round(totalVolumeHTG * 100) / 100,
        totalCommissionsHTG: Math.round(totalCommissionsHTG * 100) / 100,
        totalOperations,
      },
    };
  });

const addSubordinateSchema = z.object({
  targetUserId: z.string().uuid("ID de usuario inválido"),
  commissionPercent: z.number().min(0.1).max(5).default(0.5),
});

/**
 * Agrega un agente bajo la red del Super Agente y le otorga el rol de agente operativo.
 */
export const addSubordinateAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof addSubordinateSchema>) => addSubordinateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { verifyIsStaff, verifyIsAdmin } = await import("@/lib/admin.server");
    const isStaff = await verifyIsStaff(context);
    const isAdmin = await verifyIsAdmin(context);
    if (!isStaff && !isAdmin) {
      throw new Error("No tienes permisos para agregar agentes a tu red.");
    }

    if (input.targetUserId === context.userId) {
      throw new Error("No puedes agregarte a ti mismo como tu propio agente subordinado.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Asignar rol 'agent' si no lo tiene
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", input.targetUserId);

    const hasAgentRole = (existingRoles ?? []).some(
      (r) => r.role === "agent" || r.role === "super_agent",
    );

    if (!hasAgentRole) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: input.targetUserId,
        role: "agent" as any,
      });
    }

    // 2. Pre-crear billeteras operativas del agente si no existen
    const { data: existingWallets } = await supabaseAdmin
      .from("wallets")
      .select("currency")
      .eq("user_id", input.targetUserId);

    const existingCurrs = (existingWallets ?? []).map((w) => w.currency);
    if (!existingCurrs.includes("HTG")) {
      await supabaseAdmin.from("wallets").insert({
        user_id: input.targetUserId,
        currency: "HTG",
        balance: 0,
      });
    }
    if (!existingCurrs.includes("HTG_RECARGAS")) {
      await supabaseAdmin.from("wallets").insert({
        user_id: input.targetUserId,
        currency: "HTG_RECARGAS",
        balance: 0,
      });
    }

    // 3. Actualizar la lista en integration_credentials del Super Agente
    const networkKey = getSuperAgentKey(context.userId);
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", networkKey)
      .maybeSingle();

    let rawList: { id: string; commissionPercent: number; addedAt: string }[] = [];
    if (credRow?.value) {
      try {
        const parsed = JSON.parse(credRow.value);
        if (Array.isArray(parsed)) rawList = parsed;
        else if (Array.isArray(parsed.agents)) rawList = parsed.agents;
      } catch {}
    }

    // Remover si ya existía para actualizar
    rawList = rawList.filter((a) => a.id !== input.targetUserId);
    rawList.unshift({
      id: input.targetUserId,
      commissionPercent: input.commissionPercent,
      addedAt: new Date().toISOString(),
    });

    const now = new Date().toISOString();
    await supabaseAdmin.from("integration_credentials").upsert(
      {
        name: networkKey,
        value: JSON.stringify(rawList),
        updated_at: now,
        updated_by: context.userId,
      },
      { onConflict: "name" },
    );

    // 4. Guardar referencia inversa para búsqueda rápida durante las transacciones
    const parentKey = getAgentParentKey(input.targetUserId);
    await supabaseAdmin.from("integration_credentials").upsert(
      {
        name: parentKey,
        value: JSON.stringify({
          superAgentId: context.userId,
          commissionPercent: input.commissionPercent,
          addedAt: now,
        }),
        updated_at: now,
        updated_by: context.userId,
      },
      { onConflict: "name" },
    );

    return { ok: true, message: "Agente agregado exitosamente a tu red." };
  });

const removeSubordinateSchema = z.object({
  targetUserId: z.string().uuid("ID de usuario inválido"),
});

/**
 * Elimina a un agente de la red del Super Agente.
 */
export const removeSubordinateAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof removeSubordinateSchema>) => removeSubordinateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { verifyIsStaff, verifyIsAdmin } = await import("@/lib/admin.server");
    const isStaff = await verifyIsStaff(context);
    const isAdmin = await verifyIsAdmin(context);
    if (!isStaff && !isAdmin) {
      throw new Error("No tienes permisos para modificar tu red.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Remover de la lista del Super Agente
    const networkKey = getSuperAgentKey(context.userId);
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", networkKey)
      .maybeSingle();

    if (credRow?.value) {
      try {
        let rawList: any[] = JSON.parse(credRow.value);
        if (Array.isArray(rawList)) {
          rawList = rawList.filter((a) => a.id !== input.targetUserId);
          await supabaseAdmin.from("integration_credentials").upsert(
            {
              name: networkKey,
              value: JSON.stringify(rawList),
              updated_at: new Date().toISOString(),
              updated_by: context.userId,
            },
            { onConflict: "name" },
          );
        }
      } catch {}
    }

    // 2. Eliminar clave inversa
    const parentKey = getAgentParentKey(input.targetUserId);
    await supabaseAdmin.from("integration_credentials").delete().eq("name", parentKey);

    return { ok: true };
  });

/**
 * Lista las transacciones realizadas por los agentes de la red con el desglose de comisión para el Super Agente.
 */
export const getSubordinateTransactions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ transactions: SubordinateTransactionRecord[] }> => {
    const { verifyIsStaff, verifyIsAdmin } = await import("@/lib/admin.server");
    const isStaff = await verifyIsStaff(context);
    const isAdmin = await verifyIsAdmin(context);
    if (!isStaff && !isAdmin) {
      throw new Error("No tienes permisos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Leer lista de agentes subordinados
    const networkKey = getSuperAgentKey(context.userId);
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", networkKey)
      .maybeSingle();

    let rawList: { id: string; commissionPercent?: number }[] = [];
    if (credRow?.value) {
      try {
        const parsed = JSON.parse(credRow.value);
        if (Array.isArray(parsed)) rawList = parsed;
        else if (Array.isArray(parsed.agents)) rawList = parsed.agents;
      } catch {}
    }

    if (rawList.length === 0) {
      return { transactions: [] };
    }

    const agentIds = rawList.map((a) => a.id);
    const commPctMap = new Map(rawList.map((a) => [a.id, Number(a.commissionPercent ?? 0.5)]));

    const [{ data: profiles }, { data: transfers }] = await Promise.all([
      supabaseAdmin.from("profiles").select("id, full_name, phone").in("id", agentIds),
      supabaseAdmin
        .from("transfers")
        .select(
          "id, reference, created_at, status, agent_id, recipient_name, recipient_phone, delivery_method, amount_send, send_currency, amount_receive, receive_currency",
        )
        .in("agent_id", agentIds)
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    const profMap = new Map((profiles ?? []).map((p) => [p.id, p]));

    const transactions: SubordinateTransactionRecord[] = (transfers ?? []).map((t) => {
      const p = t.agent_id ? profMap.get(t.agent_id) : null;
      const commPct = t.agent_id ? (commPctMap.get(t.agent_id) ?? 0.5) : 0.5;
      const superComm = Math.round(Number(t.amount_send || 0) * (commPct / 100) * 100) / 100;

      return {
        id: t.id,
        reference: t.reference,
        createdAt: t.created_at,
        status: t.status,
        agentId: t.agent_id || "",
        agentName: p?.full_name || "Agente",
        agentPhone: p?.phone || null,
        recipientName: t.recipient_name,
        recipientPhone: t.recipient_phone,
        deliveryMethod: t.delivery_method,
        amountSend: Number(t.amount_send || 0),
        sendCurrency: t.send_currency,
        amountReceive: Number(t.amount_receive || 0),
        receiveCurrency: t.receive_currency,
        superAgentCommission: superComm,
      };
    });

    return { transactions };
  });

/**
 * Busca usuarios registrados (clientes) que no sean aún agentes subordinados de este Super Agente para poder seleccionarlos.
 */
export const searchAvailableUsersForAgent = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    users: { id: string; fullName: string; phone: string | null; email: string | null }[];
  }> => {
    const { verifyIsStaff, verifyIsAdmin } = await import("@/lib/admin.server");
    const isStaff = await verifyIsStaff(context);
    const isAdmin = await verifyIsAdmin(context);
    if (!isStaff && !isAdmin) {
      throw new Error("No tienes permisos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Leer lista ya agregada
    const networkKey = getSuperAgentKey(context.userId);
    const { data: credRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", networkKey)
      .maybeSingle();

    let existingIds: string[] = [context.userId];
    if (credRow?.value) {
      try {
        const parsed = JSON.parse(credRow.value);
        if (Array.isArray(parsed)) existingIds.push(...parsed.map((a) => a.id));
      } catch {}
    }

    // Obtener perfiles de la base de datos
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, phone")
      .order("created_at", { ascending: false })
      .limit(100);

    const available = (profiles ?? [])
      .filter((p) => !existingIds.includes(p.id))
      .map((p) => ({
        id: p.id,
        fullName: p.full_name || "Usuario",
        phone: p.phone || null,
        email: null,
      }));

    return { users: available };
  });
