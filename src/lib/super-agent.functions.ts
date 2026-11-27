import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SubordinateAgentRecord {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  country?: string | null;
  currency?: string | null;
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
 * Valida si el usuario actual es Super Agente, Administrador o Staff autorizado.
 */
export async function verifyIsSuperAgentOrAdmin(context: any): Promise<boolean> {
  if (!context?.userId) return false;

  // 1. Admin del sistema
  const { verifyIsAdmin } = await import("@/lib/admin.server");
  if (await verifyIsAdmin(context)) return true;

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 2. Credencial en integration_credentials: SUPER_AGENT_ROLE_<userId>
  const { data: saCred } = await supabaseAdmin
    .from("integration_credentials")
    .select("value")
    .eq("name", `SUPER_AGENT_ROLE_${context.userId}`)
    .maybeSingle();

  if (saCred?.value === "true" || saCred?.value === "active") {
    return true;
  }

  // 3. Red existente de agentes en integration_credentials
  const { data: netCred } = await supabaseAdmin
    .from("integration_credentials")
    .select("value")
    .eq("name", `SUPER_AGENT_NETWORK_${context.userId}`)
    .maybeSingle();

  if (netCred?.value) {
    return true;
  }

  // 4. user_roles: super_agent verificado en BD
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", context.userId);

  if ((roles ?? []).some((r) => (r.role as string) === "super_agent")) {
    return true;
  }

  return false;
}

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
    const isAllowed = await verifyIsSuperAgentOrAdmin(context);
    if (!isAllowed) {
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

    const { getCurrencyFromPhone } = await import("@/lib/phone");

    const agents: SubordinateAgentRecord[] = rawList.map((item) => {
      const p = profMap.get(item.id);
      const agentWallets = walletList.filter((w) => w.user_id === item.id);
      const targetCur = getCurrencyFromPhone(p?.phone, p?.country);
      const targetW = agentWallets.find((w) => w.currency === targetCur);
      const htgW = agentWallets.find((w) => w.currency === "HTG");
      const activeW =
        targetW && Number(targetW.balance) > 0
          ? targetW
          : htgW && Number(htgW.balance) > 0
            ? htgW
            : targetW || htgW;

      const opsBal = activeW ? Number(activeW.balance) : 0;
      const opsCur = activeW?.currency || targetCur;
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
        country: p?.country || "HT",
        currency: opsCur,
        commissionPercent: commPct,
        addedAt: item.addedAt || new Date().toISOString(),
        balanceHTG: opsBal,
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
  targetUserId: z.string().uuid("ID de usuario inválido").optional(),
  newAgent: z
    .object({
      fullName: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
      email: z.string().email("Correo electrónico inválido"),
      phone: z.string().min(6, "Número de teléfono inválido"),
      country: z.string().default("HT"),
    })
    .optional(),
  commissionPercent: z.number().min(0.1).max(5).default(0.5),
});

/**
 * Agrega un agente bajo la red del Super Agente y le otorga el rol de agente operativo.
 * Permite tanto seleccionar un usuario existente como registrar a uno nuevo directamente.
 */
export const addSubordinateAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof addSubordinateSchema>) => addSubordinateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const isAllowed = await verifyIsSuperAgentOrAdmin(context);
    if (!isAllowed) {
      throw new Error("No tienes permisos para agregar agentes a tu red.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let finalTargetUserId = input.targetUserId;
    let actionLink: string | undefined;
    let emailSent = false;

    // A. Si se envían datos para registrar un agente nuevo
    if (input.newAgent) {
      const cleanEmail = input.newAgent.email.toLowerCase().trim();
      const cleanPhone = input.newAgent.phone.trim();
      const cleanName = input.newAgent.fullName.trim();

      // Buscar si el usuario ya existe
      let foundUserId = "";
      try {
        const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        const found = (userList?.users ?? []).find(
          (u) =>
            (u.email && u.email.toLowerCase().trim() === cleanEmail) ||
            (u.phone && u.phone === cleanPhone),
        );
        if (found) foundUserId = found.id;
      } catch (e) {
        console.warn("[addSubordinateAgent] listUsers check:", e);
      }

      if (!foundUserId) {
        const createRes = await supabaseAdmin.auth.admin.createUser({
          email: cleanEmail,
          email_confirm: true,
          user_metadata: {
            full_name: cleanName,
            phone: cleanPhone,
            role: "agent",
            is_super_agent: false,
            parent_super_agent_id: context.userId,
          },
        });
        if (createRes.error) {
          throw new Error(`Error al registrar el agente: ${createRes.error.message}`);
        }
        foundUserId = createRes.data.user.id;
      }

      finalTargetUserId = foundUserId;

      // Actualizar perfil
      const now = new Date().toISOString();
      await supabaseAdmin.from("profiles").upsert({
        id: foundUserId,
        full_name: cleanName,
        phone: cleanPhone,
        country: input.newAgent.country || "HT",
        language: "es",
        kyc_status: "none",
        updated_at: now,
      });

      // Generar enlace de contraseña
      const publicUrl =
        process.env["PUBLIC_URL"] ||
        process.env["VITE_PUBLIC_URL"] ||
        "https://tchotcho.app";
      const cleanPublicUrl = publicUrl.replace(/\/$/, "");
      const redirectUrl = `${cleanPublicUrl}/restablecer-password`;

      actionLink = redirectUrl;
      try {
        const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email: cleanEmail,
          options: { redirectTo: redirectUrl },
        });
        if (linkData?.properties?.action_link) {
          actionLink = linkData.properties.action_link;
        }
      } catch (e) {
        console.warn("[addSubordinateAgent] generateLink failed:", e);
      }

      // Enviar correo de bienvenida al agente
      try {
        const { resendSendEmail } = await import("@/lib/resend.server");
        const html = `
        <!DOCTYPE html>
        <html>
        <head><meta charset="utf-8"><title>Bienvenido como Agente</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b;">
          <div style="background-color: #ffffff; max-width: 520px; margin: 0 auto; border-radius: 16px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <div style="text-align: center; margin-bottom: 20px;">
              <span style="display: inline-block; background-color: #dcfce7; color: #166534; font-weight: 800; font-size: 11px; padding: 4px 12px; border-radius: 9999px; text-transform: uppercase;">Agente Oficial</span>
              <h2 style="color: #0f172a; margin: 12px 0 6px;">¡Bienvenido al equipo, ${cleanName}!</h2>
            </div>
            <p style="color: #475569; font-size: 14px; line-height: 1.6;">Has sido registrado como <strong>Agente Oficial</strong>. Para acceder a tu panel de ventanilla y configurar tu contraseña de acceso, haz clic en el siguiente botón:</p>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${actionLink}" style="display: inline-block; background: #059669; color: #ffffff !important; font-weight: 800; font-size: 14px; text-decoration: none; padding: 12px 28px; border-radius: 10px;">Crear mi Contraseña</a>
            </div>
            <p style="font-size: 12px; color: #64748b; line-height: 1.5;">O copia este enlace en tu navegador:<br/><a href="${actionLink}" style="color: #059669; word-break: break-all;">${actionLink}</a></p>
          </div>
        </body>
        </html>
        `;
        const sendRes = await resendSendEmail({
          to: cleanEmail,
          subject: `Bienvenido a Tcho-Tcho — Activa tu cuenta de Agente`,
          html,
        });
        if (sendRes.ok) emailSent = true;
      } catch {}

      if (!emailSent) {
        try {
          await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
            redirectTo: redirectUrl,
          });
          emailSent = true;
        } catch {}
      }
    } else if (input.targetUserId) {
      // Para usuarios existentes agregados como agentes, generar también enlace de acceso
      try {
        const { data: userData } = await supabaseAdmin.auth.admin.getUserById(input.targetUserId);
        const existingEmail = userData?.user?.email;
        if (existingEmail) {
          const publicUrl =
            process.env["PUBLIC_URL"] ||
            process.env["VITE_PUBLIC_URL"] ||
            "https://tchotcho.app";
          const cleanPublicUrl = publicUrl.replace(/\/$/, "");
          const redirectUrl = `${cleanPublicUrl}/restablecer-password`;
          const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email: existingEmail,
            options: { redirectTo: redirectUrl },
          });
          if (linkData?.properties?.action_link) {
            actionLink = linkData.properties.action_link;
          }
        }
      } catch (e) {
        console.warn("[addSubordinateAgent] generateLink for existing user:", e);
      }
    }

    if (!finalTargetUserId) {
      throw new Error("Debes seleccionar un usuario existente o registrar los datos del nuevo agente.");
    }

    if (finalTargetUserId === context.userId) {
      throw new Error("No puedes agregarte a ti mismo como tu propio agente subordinado.");
    }

    // 1. Validar que el usuario objetivo NO sea un Super Agente ni Administrador
    const { data: existingRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", finalTargetUserId);

    const isTargetAdmin = (existingRoles ?? []).some((r) => r.role === "admin");
    if (isTargetAdmin) {
      throw new Error("Un Administrador no puede ser asignado como agente regular en tu red.");
    }

    const { data: targetSaCred } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", `SUPER_AGENT_ROLE_${finalTargetUserId}`)
      .maybeSingle();

    const isTargetSuperAgent =
      (existingRoles ?? []).some((r) => (r.role as string) === "super_agent") ||
      targetSaCred?.value === "true" ||
      targetSaCred?.value === "active";

    if (isTargetSuperAgent) {
      throw new Error(
        "Un Super Agente no puede ser asignado como agente regular en tu red. Los Super Agentes solo pueden agregar agentes regulares (no Super Agentes).",
      );
    }

    // Asegurar que el usuario tenga estrictamente rol 'agent' (no super_agent ni admin)
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", finalTargetUserId)
      .in("role", ["super_agent" as any, "admin" as any]);

    const hasAgentRole = (existingRoles ?? []).some((r) => r.role === "agent");
    if (!hasAgentRole) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: finalTargetUserId,
        role: "agent" as any,
      });
    }

    // Remover credenciales de Super Agente si existieran
    await supabaseAdmin
      .from("integration_credentials")
      .delete()
      .eq("name", `SUPER_AGENT_ROLE_${finalTargetUserId}`);

    // Asegurar metadatos en auth.users
    try {
      await supabaseAdmin.auth.admin.updateUserById(finalTargetUserId, {
        user_metadata: {
          role: "agent",
          is_super_agent: false,
          parent_super_agent_id: context.userId,
        },
      });
    } catch {}

    // 2. Pre-crear billeteras operativas del agente con saldo inicial CERO (0 HTG)
    const { data: existingWallets } = await supabaseAdmin
      .from("wallets")
      .select("currency")
      .eq("user_id", finalTargetUserId);

    const existingCurrs = (existingWallets ?? []).map((w) => w.currency);
    if (!existingCurrs.includes("HTG")) {
      await supabaseAdmin.from("wallets").insert({
        user_id: finalTargetUserId,
        currency: "HTG",
        balance: 0,
        status: "active",
      });
    }
    if (!existingCurrs.includes("HTG_RECARGAS")) {
      await supabaseAdmin.from("wallets").insert({
        user_id: finalTargetUserId,
        currency: "HTG_RECARGAS",
        balance: 0,
        status: "active",
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
    rawList = rawList.filter((a) => a.id !== finalTargetUserId);
    rawList.unshift({
      id: finalTargetUserId,
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
    const parentKey = getAgentParentKey(finalTargetUserId);
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

    return {
      ok: true,
      agentId: finalTargetUserId,
      actionLink,
      emailSent,
      message: actionLink
        ? "Agente regular registrado exitosamente en tu red con saldo inicial 0 HTG. Se ha generado su enlace de acceso."
        : "Agente regular vinculado exitosamente a tu red con saldo inicial 0 HTG.",
    };
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
    const isAllowed = await verifyIsSuperAgentOrAdmin(context);
    if (!isAllowed) {
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
    const isAllowed = await verifyIsSuperAgentOrAdmin(context);
    if (!isAllowed) {
      throw new Error("No tienes permisos para ver transacciones de la red.");
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
    const isAllowed = await verifyIsSuperAgentOrAdmin(context);
    if (!isAllowed) {
      throw new Error("No tienes permisos para buscar usuarios.");
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

const registerSuperAgentSchema = z.object({
  fullName: z.string().min(2, "El nombre debe tener al menos 2 caracteres").max(100),
  email: z.string().email("Correo electrónico inválido"),
  phone: z.string().min(6, "Número de teléfono inválido").max(25),
  country: z.string().default("HT"),
});

export type RegisterSuperAgentInput = z.infer<typeof registerSuperAgentSchema>;

/**
 * Registra un nuevo Super Agente capturando nombre, email y celular,
 * le asigna el rol y privilegios operativos, y le envía un correo para crear su contraseña.
 */
export const registerSuperAgent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: RegisterSuperAgentInput) => registerSuperAgentSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No tienes permisos para registrar Super Agentes.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const cleanEmail = input.email.toLowerCase().trim();
    const cleanPhone = input.phone.trim();
    const cleanName = input.fullName.trim();

    // 1. Verificar si el usuario ya existe en auth.users
    let targetUserId = "";
    try {
      const { data: userList } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const found = (userList?.users ?? []).find(
        (u) =>
          (u.email && u.email.toLowerCase().trim() === cleanEmail) ||
          (u.phone && u.phone === cleanPhone),
      );
      if (found) {
        targetUserId = found.id;
      }
    } catch (e) {
      console.warn("[registerSuperAgent] listUsers check failed:", e);
    }

    // 2. Si no existe, crearlo
    if (!targetUserId) {
      const createRes = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        email_confirm: true,
        user_metadata: {
          full_name: cleanName,
          phone: cleanPhone,
          role: "super_agent",
          is_super_agent: true,
        },
      });

      if (createRes.error) {
        throw new Error(`Error al crear usuario en el sistema: ${createRes.error.message}`);
      }
      targetUserId = createRes.data.user.id;
    } else {
      // Si ya existía, actualizar metadatos
      await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
        user_metadata: {
          full_name: cleanName,
          phone: cleanPhone,
          role: "super_agent",
          is_super_agent: true,
        },
      });
    }

    const now = new Date().toISOString();

    // 3. Asignar rol base 'agent' en user_roles para compatibilidad con PostgreSQL enum
    await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", targetUserId)
      .eq("role", "admin" as any);

    const { data: existingAgent } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", targetUserId)
      .eq("role", "agent" as any)
      .maybeSingle();

    if (!existingAgent) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: targetUserId,
        role: "agent" as any,
      });
    }

    // 4. Guardar rol de Super Agente en integration_credentials
    await supabaseAdmin.from("integration_credentials").upsert(
      {
        name: `SUPER_AGENT_ROLE_${targetUserId}`,
        value: "true",
        updated_at: now,
        updated_by: context.userId,
      },
      { onConflict: "name" },
    );

    // 5. Guardar/actualizar perfil en profiles
    await supabaseAdmin.from("profiles").upsert({
      id: targetUserId,
      full_name: cleanName,
      phone: cleanPhone,
      country: input.country || "HT",
      language: "es",
      kyc_status: "none",
      updated_at: now,
    });

    // 6. Pre-crear billeteras operativas
    for (const curr of ["HTG", "HTG_RECARGAS"]) {
      const { data: w } = await supabaseAdmin
        .from("wallets")
        .select("id")
        .eq("user_id", targetUserId)
        .eq("currency", curr)
        .maybeSingle();
      if (!w) {
        await supabaseAdmin.from("wallets").insert({
          user_id: targetUserId,
          currency: curr,
          balance: 0,
        });
      }
    }

    // 7. Generar enlace de creación / restablecimiento de contraseña
    const publicUrl =
      process.env["PUBLIC_URL"] ||
      process.env["VITE_PUBLIC_URL"] ||
      "https://tchotcho.app";
    const cleanPublicUrl = publicUrl.replace(/\/$/, "");
    const redirectUrl = `${cleanPublicUrl}/restablecer-password`;

    let actionLink = redirectUrl;
    try {
      const { data: linkData } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: cleanEmail,
        options: {
          redirectTo: redirectUrl,
        },
      });
      if (linkData?.properties?.action_link) {
        actionLink = linkData.properties.action_link;
      }
    } catch (e) {
      console.warn("[registerSuperAgent] generateLink failed:", e);
    }

    // 8. Enviar correo electrónico mediante Resend con plantilla elegante
    let emailSent = false;
    let emailError = "";
    try {
      const { resendSendEmail } = await import("@/lib/resend.server");
      const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Bienvenido como Super Agente</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 24px; color: #1e293b; }
          .card { background-color: #ffffff; max-width: 540px; margin: 0 auto; border-radius: 20px; border: 1px solid #e2e8f0; padding: 36px; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05); }
          .badge { display: inline-block; background-color: #e0e7ff; color: #4338ca; font-weight: 800; font-size: 11px; padding: 5px 14px; border-radius: 9999px; text-transform: uppercase; letter-spacing: 0.05em; }
          h1 { color: #0f172a; font-size: 22px; font-weight: 900; margin: 16px 0 8px; }
          p { color: #475569; font-size: 14px; line-height: 1.6; margin: 10px 0; }
          .btn-container { text-align: center; margin: 32px 0; }
          .btn { display: inline-block; background: linear-gradient(135deg, #4f46e5 0%, #4338ca 100%); color: #ffffff !important; font-weight: 800; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 14px; box-shadow: 0 4px 6px -1px rgba(79, 70, 229, 0.3); }
          .info-box { background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 16px; margin: 20px 0; font-size: 13px; color: #334155; }
          .footer { font-size: 12px; color: #94a3b8; text-align: center; margin-top: 28px; border-top: 1px solid #f1f5f9; padding-top: 20px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div style="text-align: center; margin-bottom: 20px;">
            <span class="badge">⭐ Acceso de Super Agente</span>
            <h1>¡Bienvenido, ${cleanName}!</h1>
          </div>
          <p>Has sido registrado como <strong>Super Agente</strong> en la plataforma. Tu cuenta ya está aprobada y lista para operar.</p>
          <p>Para comenzar a utilizar tu panel y configurar tu contraseña de acceso segura, haz clic en el siguiente botón:</p>
          
          <div class="btn-container">
            <a href="${actionLink}" class="btn">Crear mi Contraseña</a>
          </div>

          <div class="info-box">
            <strong>Tus datos registrados:</strong><br>
            • Correo: <strong>${cleanEmail}</strong><br>
            • Celular: <strong>${cleanPhone}</strong>
          </div>

          <p style="font-size: 12px; color: #64748b; line-height: 1.5;">
            Si el botón no abre automáticamente, copia y pega este enlace en tu navegador:<br>
            <a href="${actionLink}" style="color: #4f46e5; word-break: break-all;">${actionLink}</a>
          </p>

          <div class="footer">
            Tcho-Tcho — Plataforma Oficial de Remesas y Recargas
          </div>
        </div>
      </body>
      </html>
      `;

      const sendRes = await resendSendEmail({
        to: cleanEmail,
        subject: `Bienvenido a Tcho-Tcho — Activa tu cuenta de Super Agente`,
        html,
      });

      if (sendRes.ok) {
        emailSent = true;
      } else {
        emailError = sendRes.error;
      }
    } catch (e: any) {
      emailError = e?.message || "No se pudo contactar al servicio de correo";
    }

    // Fallback con invitación nativa de Supabase si Resend no envió
    if (!emailSent) {
      try {
        await supabaseAdmin.auth.admin.inviteUserByEmail(cleanEmail, {
          redirectTo: redirectUrl,
        });
        emailSent = true;
      } catch (inviteErr) {
        console.warn("[registerSuperAgent] Supabase invite fallback error:", inviteErr);
      }
    }

    return {
      ok: true,
      userId: targetUserId,
      email: cleanEmail,
      actionLink,
      emailSent,
      emailError: emailSent ? undefined : emailError,
      message: emailSent
        ? "Super Agente registrado exitosamente con saldo inicial 0 HTG. Se ha enviado el correo para configurar su contraseña."
        : "Super Agente registrado con saldo inicial 0 HTG. El correo no pudo enviarse automáticamente, pero puedes compartir el enlace de activación.",
    };
  });

const transferToSubordinateSchema = z.object({
  targetUserId: z.string().uuid("ID de agente inválido"),
  amount: z.number().positive("El monto a transferir debe ser mayor a 0"),
  walletType: z.enum(["transfers", "topups"]).default("transfers"),
  note: z.string().trim().optional(),
});

export type TransferToSubordinateInput = z.infer<typeof transferToSubordinateSchema>;

/**
 * Permite a un Super Agente recargar saldo a un agente de su red.
 * Regla: El monto se descuenta inmediatamente del saldo del Super Agente ("diminua en su saldo").
 * Si el Super Agente no tiene saldo suficiente, no puede recargar a sus agentes ("si no tienen saldo tambien no pueden recargar").
 */
export const superAgentTransferBalanceToSubordinate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: TransferToSubordinateInput) => transferToSubordinateSchema.parse(input))
  .handler(async ({ data: input, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);

    // REGLA ESTRICTA TCHOTCHO:
    // Los Super Agentes NO pueden adicionar saldo a los agentes.
    // SOLO los administradores pueden adicionar saldo a los agentes y Super Agentes.
    if (!isAdmin) {
      throw new Error(
        "Solo los administradores pueden adicionar saldo a los agentes. Los Super Agentes no tienen autorización para recargar saldo a otros agentes.",
      );
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // REGLA: Los Super Agentes solo pueden recargar a agentes ordinarios subordinados de su red.
    // Solo los administradores pueden asignar saldo a los Super Agentes y a agentes independientes.
    const { data: targetRoleRows } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", input.targetUserId);

    const targetIsSuperAgent =
      (targetRoleRows ?? []).some((r) => r.role === "super_agent") ||
      Boolean(
        (
          await supabaseAdmin
            .from("integration_credentials")
            .select("value")
            .eq("name", `SUPER_AGENT_ROLE_${input.targetUserId}`)
            .maybeSingle()
        ).data?.value,
      );

    if (targetIsSuperAgent) {
      throw new Error(
        "Solo los administradores pueden adicionar saldo a los Super Agentes. Un Super Agente no puede transferir saldo a otro Super Agente.",
      );
    }

    // 1. Verificar pertenencia del agente a la red del Super Agente (a menos que sea admin global)
    if (!isAdmin) {
      // Regla de verificación: Super Agentes deben verificar su identidad antes de operar
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("kyc_status")
        .eq("id", context.userId)
        .maybeSingle();

      if (callerProfile?.kyc_status !== "approved") {
        throw new Error(
          "Debes verificar tu identidad (KYC aprobado) antes de poder transferir saldo a tus agentes.",
        );
      }

      const parentKey = getAgentParentKey(input.targetUserId);
      const { data: parentCred } = await supabaseAdmin
        .from("integration_credentials")
        .select("value")
        .eq("name", parentKey)
        .maybeSingle();

      let isSubordinate = false;
      if (parentCred?.value) {
        try {
          const pData = JSON.parse(parentCred.value);
          if (pData.superAgentId === context.userId) isSubordinate = true;
        } catch {}
      }

      if (!isSubordinate) {
        const networkKey = getSuperAgentKey(context.userId);
        const { data: netCred } = await supabaseAdmin
          .from("integration_credentials")
          .select("value")
          .eq("name", networkKey)
          .maybeSingle();

        if (netCred?.value) {
          try {
            const list = JSON.parse(netCred.value);
            if (Array.isArray(list) && list.some((a) => a.id === input.targetUserId)) {
              isSubordinate = true;
            }
          } catch {}
        }
      }

      if (!isSubordinate) {
        throw new Error(
          "Este agente no pertenece a tu red. Solo puedes recargar saldo a agentes asignados bajo tu supervisión.",
        );
      }
    }

    // 2. Determinar tipo de billetera y moneda objetivo
    const targetCurrency = input.walletType === "topups" ? "HTG_RECARGAS" : "HTG";
    const walletLabel =
      input.walletType === "topups"
        ? "Billetera de Recargas Telefónicas"
        : "Billetera de Envíos de Dinero";

    // 3. Obtener nombres para auditoría y comprobante
    const { data: subProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", input.targetUserId)
      .maybeSingle();
    const subAgentName = subProfile?.full_name || subProfile?.phone || "Agente";

    const { data: superProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, phone")
      .eq("id", context.userId)
      .maybeSingle();
    const superAgentName = superProfile?.full_name || superProfile?.phone || "Super Agente";

    // 4. VERIFICAR SALDO DEL SUPER AGENTE:
    // "si no tienen saldo tambien no pueden recargar sus agentes"
    let superWallet: { id: string; balance: number; currency: string } | null = null;
    let currentSuperBal = 0;

    if (!isAdmin) {
      const { data: sw } = await supabaseAdmin
        .from("wallets")
        .select("id, balance, currency")
        .eq("user_id", context.userId)
        .eq("currency", targetCurrency)
        .maybeSingle();

      superWallet = sw;
      currentSuperBal = Number(superWallet?.balance) || 0;

      if (!superWallet || currentSuperBal < input.amount || currentSuperBal <= 0) {
        throw new Error(
          `Saldo insuficiente en tu ${walletLabel}. Tu saldo actual es de ${currentSuperBal.toLocaleString()} HTG y requieres ${input.amount.toLocaleString()} HTG para recargar a tu agente. Como Super Agente, no puedes recargar a tus agentes sin saldo suficiente. Contacta a un administrador para recargar tu cuenta.`,
        );
      }
    }

    // 5. Obtener o crear la billetera del agente subordinado
    const { data: existingSubWallet } = await supabaseAdmin
      .from("wallets")
      .select("id, balance, currency")
      .eq("user_id", input.targetUserId)
      .eq("currency", targetCurrency)
      .maybeSingle();

    let subWallet = existingSubWallet;
    if (!subWallet) {
      const { data: createdSub, error: createSubErr } = await supabaseAdmin
        .from("wallets")
        .insert({
          user_id: input.targetUserId,
          currency: targetCurrency,
          balance: 0,
          status: "active",
        })
        .select("id, balance, currency")
        .single();

      if (createSubErr || !createdSub) {
        throw new Error("No se pudo inicializar la billetera del agente subordinado.");
      }
      subWallet = createdSub;
    }

    const now = new Date().toISOString();

    // 6. DESCONTAR SALDO DEL SUPER AGENTE:
    // "diminua en su saldo"
    let newSuperBal = currentSuperBal;
    if (!isAdmin && superWallet) {
      newSuperBal = Math.round((currentSuperBal - input.amount) * 100) / 100;
      const { error: superUpdErr } = await supabaseAdmin
        .from("wallets")
        .update({ balance: newSuperBal, updated_at: now })
        .eq("id", superWallet.id);

      if (superUpdErr) {
        throw new Error("Error al descontar saldo de tu billetera: " + superUpdErr.message);
      }

      await supabaseAdmin.from("wallet_transactions").insert({
        wallet_id: superWallet.id,
        user_id: context.userId,
        kind: "super_agent_transfer_to_subordinate",
        amount: -input.amount,
        currency: targetCurrency,
        description: `Recarga de saldo transferida a agente ${subAgentName} (${walletLabel})${input.note ? ` - Nota: ${input.note}` : ""}`,
      });
    }

    // 7. ACREDITAR SALDO AL AGENTE SUBORDINADO:
    const currentSubBal = Number(subWallet.balance) || 0;
    const newSubBal = Math.round((currentSubBal + input.amount) * 100) / 100;

    const { error: subUpdErr } = await supabaseAdmin
      .from("wallets")
      .update({ balance: newSubBal, updated_at: now })
      .eq("id", subWallet.id);

    if (subUpdErr) {
      // Revertir descuento al Super Agente si falló la acreditación
      if (!isAdmin && superWallet) {
        await supabaseAdmin
          .from("wallets")
          .update({ balance: currentSuperBal, updated_at: new Date().toISOString() })
          .eq("id", superWallet.id);
      }
      throw new Error("Error al acreditar saldo al agente: " + subUpdErr.message);
    }

    await supabaseAdmin.from("wallet_transactions").insert({
      wallet_id: subWallet.id,
      user_id: input.targetUserId,
      kind: "subordinate_received_from_super",
      amount: input.amount,
      currency: targetCurrency,
      description: `Saldo operativo recibido de Super Agente ${superAgentName} (${walletLabel})${input.note ? ` - Nota: ${input.note}` : ""}`,
    });

    // 8. Notificar al agente subordinado
    try {
      await supabaseAdmin.from("notifications").insert({
        user_id: input.targetUserId,
        title: `Saldo recibido: +${input.amount.toLocaleString()} HTG`,
        body: `Tu Super Agente ${superAgentName} te ha recargado ${input.amount.toLocaleString()} HTG en tu ${walletLabel}. Saldo actual: ${newSubBal.toLocaleString()} HTG.`,
      });
    } catch {}

    return {
      ok: true,
      message: `¡Recarga de ${input.amount.toLocaleString()} HTG completada con éxito para ${subAgentName}!`,
      subAgentNewBalance: newSubBal,
      superAgentNewBalance: isAdmin ? undefined : newSuperBal,
    };
  });
