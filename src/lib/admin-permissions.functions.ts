import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminTabId =
  | "resumen"
  | "servicios"
  | "contabilidad"
  | "soporte"
  | "banner"
  | "mercadopago"
  | "stripe"
  | "resend"
  | "bulk-email"
  | "security"
  | "operators"
  | "topup-rates"
  | "dingconnect"
  | "cripto"
  | "bazik"
  | "kyc"
  | "tx"
  | "recargas"
  | "usuarios"
  | "tarifas"
  | "migracion"
  | "redes";

export interface AdminPermissionsConfig {
  isSuperAdmin: boolean;
  allowedTabs: AdminTabId[];
  tenantId?: string | undefined;
  tenantSlug?: string | undefined;
  tenantName?: string | undefined;
  updatedAt?: string | undefined;
  updatedBy?: string | undefined;
}

export const ALL_ADMIN_TAB_IDS: AdminTabId[] = [
  "resumen",
  "servicios",
  "contabilidad",
  "soporte",
  "banner",
  "mercadopago",
  "stripe",
  "resend",
  "bulk-email",
  "security",
  "operators",
  "topup-rates",
  "dingconnect",
  "cripto",
  "bazik",
  "kyc",
  "tx",
  "recargas",
  "usuarios",
  "tarifas",
  "migracion",
  "redes",
];

const MASTER_ADMIN_EMAILS = ["charlesagency4@gmail.com", "lajanrapid26@gmail.com"];

const MASTER_ADMIN_USER_IDS = [
  "cca63804-b4c1-4221-bbd3-82258545f228",
  "9b729a8e-b91c-430a-907c-969652b89f3b",
  "0a1fec01-21c2-4af6-8e54-4b7ce6e2913c",
];

export function isMasterSuperAdmin(user: {
  id?: string;
  email?: string | null;
  phone?: string | null;
}): boolean {
  if (!user) return false;
  const email = String(user.email ?? "")
    .toLowerCase()
    .trim();
  const phone = String(user.phone ?? "").replace(/\D/g, "");
  return (
    MASTER_ADMIN_EMAILS.includes(email) ||
    (Boolean(user.id) && MASTER_ADMIN_USER_IDS.includes(String(user.id))) ||
    phone === "529988100395"
  );
}

export function getAdminPermissionsStorageKey(userId: string): string {
  return `ADMIN_PERMISSIONS_${userId}`;
}

/**
 * Obtiene los permisos del administrador actual autenticado.
 */
export const getMyPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPermissionsConfig> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Verificar si es el Super Admin maestro por correo, teléfono o ID
    const email = String(context.claims?.email ?? "")
      .toLowerCase()
      .trim();
    const phone = String(context.claims?.phone ?? "").replace(/\D/g, "");
    if (
      MASTER_ADMIN_EMAILS.includes(email) ||
      MASTER_ADMIN_USER_IDS.includes(context.userId) ||
      phone === "529988100395"
    ) {
      return { isSuperAdmin: true, allowedTabs: ALL_ADMIN_TAB_IDS };
    }

    // Verificar si tiene rol admin en user_roles
    const { data: roleRow } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      return { isSuperAdmin: false, allowedTabs: [] };
    }

    // Leer restricciones de integration_credentials
    const key = getAdminPermissionsStorageKey(context.userId);
    const { data: permRow } = await supabaseAdmin
      .from("integration_credentials")
      .select("value")
      .eq("name", key)
      .maybeSingle();

    if (!permRow?.value) {
      // Si no tiene restricciones guardadas pero es admin, acceso operativo por defecto (NUNCA super admin)
      return { isSuperAdmin: false, allowedTabs: ["tx", "recargas", "kyc", "soporte"] };
    }

    try {
      const parsed = JSON.parse(permRow.value) as Partial<AdminPermissionsConfig>;
      const allowed = Array.isArray(parsed.allowedTabs)
        ? (parsed.allowedTabs.filter((t) =>
            ALL_ADMIN_TAB_IDS.includes(t as AdminTabId),
          ) as AdminTabId[])
        : [];
      return {
        isSuperAdmin: false,
        allowedTabs: allowed,
        tenantId: parsed.tenantId,
        tenantSlug: parsed.tenantSlug,
        tenantName: parsed.tenantName,
        updatedAt: parsed.updatedAt,
        updatedBy: parsed.updatedBy,
      };
    } catch {
      return { isSuperAdmin: false, allowedTabs: ["tx", "recargas", "kyc", "soporte"] };
    }
  });

/**
 * Obtiene el mapa de permisos de todos los administradores.
 */
export const getAllAdminsPermissionsMap = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Record<string, AdminPermissionsConfig>> => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    if (!(await verifyIsAdmin(context))) throw new Error("No autorizado");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("integration_credentials")
      .select("name, value")
      .like("name", "ADMIN_PERMISSIONS_%");

    const result: Record<string, AdminPermissionsConfig> = {};
    for (const r of rows ?? []) {
      const userId = r.name.replace("ADMIN_PERMISSIONS_", "");
      try {
        const parsed = JSON.parse(r.value);
        result[userId] = {
          isSuperAdmin: Boolean(parsed.isSuperAdmin),
          allowedTabs: Array.isArray(parsed.allowedTabs) ? parsed.allowedTabs : [],
          tenantId: parsed.tenantId,
          tenantSlug: parsed.tenantSlug,
          tenantName: parsed.tenantName,
          updatedAt: parsed.updatedAt,
          updatedBy: parsed.updatedBy,
        };
      } catch {
        result[userId] = { isSuperAdmin: true, allowedTabs: ALL_ADMIN_TAB_IDS };
      }
    }
    return result;
  });

export interface SetUserRoleAndPermissionsInput {
  targetUserId: string;
  role: "admin" | "agent" | "client";
  isSuperAdmin?: boolean | undefined;
  allowedTabs?: AdminTabId[] | undefined;
  tenantId?: string | undefined;
  tenantSlug?: string | undefined;
  tenantName?: string | undefined;
}

/**
 * Guarda o modifica el rol de un usuario y sus permisos/restricciones si es admin.
 */
export const setUserRoleAndPermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: SetUserRoleAndPermissionsInput) => input)
  .handler(async ({ data: input, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Exclusivo para Super Administradores: solo el Super Admin puede asignar rol de Administrador o modificar administradores
    const callerEmail = String(context.claims?.email ?? "")
      .toLowerCase()
      .trim();
    let isCallerSuperAdmin =
      MASTER_ADMIN_EMAILS.includes(callerEmail) ||
      isMasterSuperAdmin({ id: context.userId, email: callerEmail });

    if (!isCallerSuperAdmin) {
      const { data: callerRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", context.userId)
        .eq("role", "admin")
        .maybeSingle();

      if (callerRole) {
        const callerPermKey = getAdminPermissionsStorageKey(context.userId);
        const { data: callerPermRow } = await supabaseAdmin
          .from("integration_credentials")
          .select("value")
          .eq("name", callerPermKey)
          .maybeSingle();

        if (callerPermRow?.value) {
          try {
            const parsed = JSON.parse(callerPermRow.value);
            isCallerSuperAdmin = Boolean(parsed.isSuperAdmin);
          } catch {
            isCallerSuperAdmin = false;
          }
        }
      }
    }

    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isStaffOrAdmin = (await verifyIsAdmin(context)) || (await verifyIsStaff(context));
    if (!isStaffOrAdmin) {
      throw new Error("No tienes permisos para gestionar roles de usuarios.");
    }

    // 1. Proteger al Super Administrador: su cuenta no puede ser modificada por nadie
    if (isMasterSuperAdmin({ id: input.targetUserId })) {
      throw new Error("La cuenta del Super Administrador no puede ser modificada.");
    }

    // 2. Obtener las opciones permitidas del administrador que ejecuta la acción (caller)
    let callerAllowedTabs: AdminTabId[] = ALL_ADMIN_TAB_IDS;
    if (!isCallerSuperAdmin) {
      const callerPermKey = getAdminPermissionsStorageKey(context.userId);
      const { data: callerPermRow } = await supabaseAdmin
        .from("integration_credentials")
        .select("value")
        .eq("name", callerPermKey)
        .maybeSingle();

      if (callerPermRow?.value) {
        try {
          const parsed = JSON.parse(callerPermRow.value);
          callerAllowedTabs = Array.isArray(parsed.allowedTabs)
            ? (parsed.allowedTabs as AdminTabId[])
            : ["tx", "recargas", "kyc", "soporte", "redes"];
        } catch {
          callerAllowedTabs = ["tx", "recargas", "kyc", "soporte", "redes"];
        }
      } else {
        callerAllowedTabs = ["tx", "recargas", "kyc", "soporte", "redes"];
      }
    }

    // 3. Verificar si el usuario objetivo es Administrador y sus permisos previos
    const permKey = getAdminPermissionsStorageKey(input.targetUserId);
    const { data: targetAdminRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", input.targetUserId)
      .eq("role", "admin")
      .maybeSingle();

    const isTargetAdmin = Boolean(targetAdminRole);
    let targetExistingTabs: AdminTabId[] = [];
    if (isTargetAdmin) {
      const { data: targetPermRow } = await supabaseAdmin
        .from("integration_credentials")
        .select("value")
        .eq("name", permKey)
        .maybeSingle();

      if (targetPermRow?.value) {
        try {
          const parsed = JSON.parse(targetPermRow.value);
          if (Array.isArray(parsed.allowedTabs)) {
            targetExistingTabs = parsed.allowedTabs as AdminTabId[];
          }
        } catch {}
      }
    }

    // 4. Delegación de permisos según la regla:
    // Los administradores pueden nombrar administradores con todos los accesos que poseen.
    // Los demás accesos solo pueden ser otorgados con la autorización del Super Administrador.
    let finalTabs: AdminTabId[] = [];
    if (input.role === "admin") {
      if (isCallerSuperAdmin) {
        finalTabs =
          input.allowedTabs && input.allowedTabs.length > 0
            ? input.allowedTabs
            : ALL_ADMIN_TAB_IDS;
      } else {
        // Administrador normal delegando:
        // Si no especificó pestañas, hereda todas las que el caller tiene
        const requested =
          input.allowedTabs && input.allowedTabs.length > 0
            ? input.allowedTabs
            : callerAllowedTabs;

        // Comprobar si intenta otorgar módulos que NO tiene y que el usuario objetivo tampoco tenía por Super Admin
        const unauthorizedExtra = requested.filter(
          (t) => !callerAllowedTabs.includes(t) && !targetExistingTabs.includes(t),
        );
        if (unauthorizedExtra.length > 0) {
          throw new Error(
            "No tienes autorización para conceder estos accesos adicionales. Solo el Super Administrador puede otorgarlos.",
          );
        }

        // Pestañas permitidas dentro de las que tiene el caller + pestañas previas del Super Admin
        const allowedWithinCaller = requested.filter((t) => callerAllowedTabs.includes(t));
        const preservedSuperAdminTabs = targetExistingTabs.filter(
          (t) => !callerAllowedTabs.includes(t),
        );
        finalTabs = Array.from(new Set([...allowedWithinCaller, ...preservedSuperAdminTabs]));
      }
    }

    const now = new Date().toISOString();

    // 1. Manejo del rol en user_roles
    if (input.role === "client") {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", input.targetUserId)
        .in("role", ["admin", "agent"] as any);

      // Eliminar registro de permisos
      await supabaseAdmin
        .from("integration_credentials")
        .delete()
        .eq("name", getAdminPermissionsStorageKey(input.targetUserId));
    } else if (input.role === "agent") {
      // Asegurar que tenga agent y no admin
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", input.targetUserId)
        .eq("role", "admin" as any);

      const { data: existingAgent } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", input.targetUserId)
        .eq("role", "agent" as any)
        .maybeSingle();

      if (!existingAgent) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: input.targetUserId,
          role: "agent" as any,
        });
      }

      await supabaseAdmin
        .from("integration_credentials")
        .delete()
        .eq("name", getAdminPermissionsStorageKey(input.targetUserId));
    } else if (input.role === "admin") {
      // Asegurar que tenga el rol admin en user_roles
      const { data: existingAdmin } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", input.targetUserId)
        .eq("role", "admin" as any)
        .maybeSingle();

      if (!existingAdmin) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: input.targetUserId,
          role: "admin" as any,
        });
      }

      // 2. Guardar permisos en integration_credentials
      // Solo existe UNA cuenta Super Admin maestra en el sistema
      const permKey = getAdminPermissionsStorageKey(input.targetUserId);
      const isTargetMaster = isMasterSuperAdmin({ id: input.targetUserId });
      const isSuper = isTargetMaster;
      const tabs = isSuper ? ALL_ADMIN_TAB_IDS : finalTabs;

      const permConfig: AdminPermissionsConfig = {
        isSuperAdmin: isSuper,
        allowedTabs: tabs,
        tenantId:
          input.tenantId?.trim() && input.tenantId !== "global" ? input.tenantId.trim() : undefined,
        tenantSlug:
          input.tenantSlug?.trim() && input.tenantSlug !== "global"
            ? input.tenantSlug.trim()
            : undefined,
        tenantName: input.tenantName?.trim() ? input.tenantName.trim() : undefined,
        updatedAt: now,
        updatedBy: context.userId,
      };

      await supabaseAdmin.from("integration_credentials").upsert(
        {
          name: permKey,
          value: JSON.stringify(permConfig),
          updated_at: now,
          updated_by: context.userId,
        },
        { onConflict: "name" },
      );

      // 3. Asociar tenant_id en profiles para consistencia multiempresa
      try {
        const assignedTenantId =
          input.tenantId && input.tenantId !== "global" && input.tenantId !== "default"
            ? input.tenantId
            : null;
        await (supabaseAdmin as any)
          .from("profiles")
          .update({ tenant_id: assignedTenantId })
          .eq("id", input.targetUserId);
      } catch {
        // ignore
      }
    }

    return { ok: true };
  });

export interface AdminUserListItem {
  id: string;
  email: string | null;
  full_name: string;
  phone: string | null;
  country: string;
  language: string;
  kyc_status: string;
  created_at?: string;
  roles: string[];
  balanceHTG: number;
  balanceTopupsHTG?: number;
}

/**
 * Retorna todos los usuarios registrados para el panel de administración y Super Admin.
 */
export const getAdminUsersList = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ users: AdminUserListItem[] }> => {
    const { verifyIsStaff } = await import("@/lib/admin.server");
    if (!(await verifyIsStaff(context))) {
      throw new Error("No autorizado");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Obtener lista completa de usuarios directamente desde auth.users (Supabase Admin)
    let authUsers: any[] = [];
    try {
      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.listUsers({
        perPage: 1000,
      });
      if (!authErr && authData?.users) {
        authUsers = authData.users;
      }
    } catch (e) {
      console.warn("[getAdminUsersList] auth.admin.listUsers failed:", e);
    }

    // 2. Obtener datos complementarios de profiles, user_roles y wallets (con tolerancia a fallos)
    let pRows: any[] = [];
    let rRows: any[] = [];
    let wRows: any[] = [];

    try {
      const { data } = await supabaseAdmin.from("profiles").select("*");
      if (data) pRows = data;
    } catch (e) {
      console.warn("[getAdminUsersList] profiles fetch failed:", e);
    }

    try {
      const { data } = await supabaseAdmin.from("user_roles").select("*");
      if (data) rRows = data;
    } catch (e) {
      console.warn("[getAdminUsersList] user_roles fetch failed:", e);
    }

    try {
      const { data } = await supabaseAdmin.from("wallets").select("user_id, currency, balance");
      if (data) wRows = data;
    } catch (e) {
      console.warn("[getAdminUsersList] wallets fetch failed:", e);
    }

    const usersMap = new Map<string, AdminUserListItem>();

    // 3. Procesar todos los usuarios de auth.users como fuente primaria
    for (const u of authUsers) {
      if (!u.id) continue;
      const email = String(u.email || "")
        .toLowerCase()
        .trim();
      const p = pRows.find((row) => row.id === u.id);
      const userRoles = rRows.filter((r) => r.user_id === u.id).map((r) => r.role);
      const userWallets = wRows.filter((w) => w.user_id === u.id);
      const htgBal = userWallets.find((w) => w.currency === "HTG")?.balance ?? 0;
      const topupBal = userWallets.find((w) => w.currency === "HTG_RECARGAS")?.balance ?? 0;

      // Asegurar que administradores principales siempre tengan rol 'admin'
      const finalRoles = [...userRoles];
      const isMaster = isMasterSuperAdmin({ id: u.id, email, phone: u.phone || p?.phone });
      if (isMaster && !finalRoles.includes("admin")) {
        finalRoles.unshift("admin");
      }

      usersMap.set(u.id, {
        id: u.id,
        email: u.email || null,
        full_name:
          p?.full_name ||
          (u.user_metadata as any)?.full_name ||
          (u.email ? u.email.split("@")[0] : "") ||
          "Usuario",
        phone: p?.phone || (u.user_metadata as any)?.phone || u.phone || null,
        country: p?.country || "HT",
        language: p?.language || "es",
        kyc_status: p?.kyc_status || (isMaster ? "approved" : "none"),
        created_at: p?.created_at || u.created_at,
        roles: finalRoles.length > 0 ? finalRoles : ["client"],
        balanceHTG: Number(htgBal),
        balanceTopupsHTG: Number(topupBal),
      });
    }

    // 4. Si hay profiles que no estaban en authUsers (o si listUsers no estaba disponible)
    for (const p of pRows) {
      if (!usersMap.has(p.id)) {
        const userRoles = rRows.filter((r) => r.user_id === p.id).map((r) => r.role);
        const userWallets = wRows.filter((w) => w.user_id === p.id);
        const htgBal = userWallets.find((w) => w.currency === "HTG")?.balance ?? 0;
        const topupBal = userWallets.find((w) => w.currency === "HTG_RECARGAS")?.balance ?? 0;

        usersMap.set(p.id, {
          id: p.id,
          email: (p as any).email || null,
          full_name: p.full_name || "Usuario",
          phone: p.phone || null,
          country: p.country || "HT",
          language: p.language || "es",
          kyc_status: p.kyc_status || "none",
          created_at: p.created_at,
          roles: userRoles.length > 0 ? userRoles : ["client"],
          balanceHTG: Number(htgBal),
          balanceTopupsHTG: Number(topupBal),
        });
      }
    }

    // 5. Intentar RPC admin_get_all_users si por alguna razón no tenemos usuarios todavía
    if (usersMap.size === 0) {
      try {
        const { data: rpcUsers } = await (supabaseAdmin as any).rpc("admin_get_all_users");
        if (Array.isArray(rpcUsers) && rpcUsers.length > 0) {
          for (const u of rpcUsers) {
            usersMap.set(u.id, {
              id: u.id,
              email: u.email || null,
              full_name: u.full_name || "",
              phone: u.phone || null,
              country: u.country || "HT",
              language: u.language || "es",
              kyc_status: u.kyc_status || "none",
              created_at: u.created_at,
              roles: Array.isArray(u.roles) ? u.roles : ["client"],
              balanceHTG: Number(u.balance_htg || 0),
            });
          }
        }
      } catch (err) {
        console.warn("Could not fetch user list via rpc:", err);
      }
    }

    const callerIsMaster = isMasterSuperAdmin({ id: context.userId });
    let list = Array.from(usersMap.values());
    if (!callerIsMaster) {
      // Excluir la cuenta del Super Admin para que otros administradores no tengan acceso a ella
      list = list.filter((u) => !isMasterSuperAdmin({ id: u.id, email: u.email, phone: u.phone }));
    }

    return {
      users: list,
    };
  });

/**
 * Permite al Super Administrador establecer o resetear la contraseña de cualquier usuario
 * y confirmar su email inmediatamente.
 */
export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((data: { userId: string; newPassword: string }) => data)
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No autorizado para cambiar contraseñas de usuarios.");
    }

    if (!data.userId || !data.newPassword || data.newPassword.length < 8) {
      throw new Error("La contraseña debe tener al menos 8 caracteres.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, {
      password: data.newPassword,
      email_confirm: true,
    });

    if (error) {
      console.error("[adminSetUserPassword error]", error);
      throw new Error(error.message || "Error al actualizar contraseña.");
    }

    return { ok: true };
  });
