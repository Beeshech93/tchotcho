import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseBazikCredentialsInput, type BazikCredentialsInput } from "@/lib/bazik.schemas";

const syncBalanceSchema = z.object({
  manualBalance: z.number().nonnegative().optional(),
});

async function requireAdmin(context: { supabase: unknown; userId: string }) {
  const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
  const isAdmin = await verifyIsAdmin(context as any);
  const isStaff = await verifyIsStaff(context as any);
  if (!isAdmin && !isStaff) throw new Error("No autorizado");
}

/** Estado de configuración y autenticación del conector Bazik (solo administradores). */
export const bazikStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { bazikStatusInfo } = await import("@/lib/bazik.server");
    return bazikStatusInfo(context.supabase, context.userId);
  });

/** Consulta el saldo de Bazik vía API o lee el último saldo disponible. */
export const bazikGetBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { bazikFetchBalance } = await import("@/lib/bazik.server");
    return bazikFetchBalance(context.supabase);
  });

/** Consulta y sincroniza el saldo operativo real de Bazik. */
export const bazikSyncBalance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input?: z.infer<typeof syncBalanceSchema>) =>
    input ? syncBalanceSchema.parse(input) : {},
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { bazikFetchBalance, saveStoredCred } = await import("@/lib/bazik.server");
    let balance: number;
    let source = "api";

    if (typeof data?.manualBalance === "number" && !isNaN(data.manualBalance)) {
      balance = Math.max(0, Math.round(data.manualBalance * 100) / 100);
      source = "manual";
    } else {
      const res = await bazikFetchBalance(context.supabase);
      if (!res.ok) throw new Error(res.error);
      balance = res.balance;
      source = res.source;
    }

    try {
      await saveStoredCred("BAZIK_LAST_SYNCED_BALANCE", String(balance), context.userId, context.supabase);
      await saveStoredCred("BAZIK_LAST_SYNCED_AT", new Date().toISOString(), context.userId, context.supabase);
    } catch (saveErr) {
      console.warn("No se pudo cachear el saldo:", saveErr);
    }

    return {
      ok: true,
      balance,
      source,
      message: `Saldo operativo de Bazik (${balance.toLocaleString()} HTG) sincronizado exitosamente.`,
    };
  });

/** Prueba la autenticación contra Bazik forzando un nuevo token (solo administradores). */
export const bazikTestAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { bazikAuthenticate } = await import("@/lib/bazik.server");
    return bazikAuthenticate(true, context.supabase);
  });

/** Guarda manualmente las credenciales de Bazik (solo administradores). */
export const bazikSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: BazikCredentialsInput) => parseBazikCredentialsInput(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { saveStoredCred } = await import("@/lib/bazik.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveStoredCred(name, value.trim(), context.userId, context.supabase);
    }
    return { ok: true };
  });
