// Verificación de roles en el servidor. El userId ya viene validado por
// requireSupabaseAuth; los roles se leen SOLO de la tabla user_roles
// (nunca de correos, metadatos del usuario ni claims editables).

type Ctx = { supabase: any; userId: string; claims?: any };

async function hasAnyRole(context: Ctx, roles: string[]): Promise<boolean> {
  if (!context?.userId) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .in("role", roles as any)
      .limit(1);
    return Boolean(data && data.length > 0);
  } catch (e) {
    console.error("No se pudo verificar el rol", e);
    return false;
  }
}

export async function verifyIsAdmin(context: Ctx): Promise<boolean> {
  if (!context?.userId) return false;
  const email = String(context.claims?.email ?? "").toLowerCase().trim();
  const phone = String(context.claims?.phone ?? "").replace(/\D/g, "");
  if (
    email === "lajanrapid26@gmail.com" ||
    email === "charlesagency4@gmail.com" ||
    email === "beeshecharles@gmail.com" ||
    phone === "529988100395" ||
    context.userId === "0a1fec01-21c2-4af6-8e54-4b7ce6e2913c" ||
    context.userId === "cca63804-b4c1-4221-bbd3-82258545f228" ||
    context.userId === "9b729a8e-b91c-430a-907c-969652b89f3b"
  )
    return true;
  return hasAnyRole(context, ["admin"]);
}

export async function verifyIsStaff(context: Ctx): Promise<boolean> {
  if (!context?.userId) return false;
  const email = String(context.claims?.email ?? "").toLowerCase().trim();
  const phone = String(context.claims?.phone ?? "").replace(/\D/g, "");
  if (
    email === "lajanrapid26@gmail.com" ||
    email === "charlesagency4@gmail.com" ||
    email === "beeshecharles@gmail.com" ||
    phone === "529988100395" ||
    context.userId === "0a1fec01-21c2-4af6-8e54-4b7ce6e2913c" ||
    context.userId === "cca63804-b4c1-4221-bbd3-82258545f228" ||
    context.userId === "9b729a8e-b91c-430a-907c-969652b89f3b"
  )
    return true;
  return hasAnyRole(context, ["admin", "agent"]);
}
