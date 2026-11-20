import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SocialNetworksConfig {
  whatsapp: string;
  facebook: string;
  instagram: string;
  tiktok: string;
  telegram: string;
  youtube: string;
  twitter: string;
}

const SOCIAL_KEYS = {
  whatsapp: "SOCIAL_WHATSAPP",
  facebook: "SOCIAL_FACEBOOK",
  instagram: "SOCIAL_INSTAGRAM",
  tiktok: "SOCIAL_TIKTOK",
  telegram: "SOCIAL_TELEGRAM",
  youtube: "SOCIAL_YOUTUBE",
  twitter: "SOCIAL_TWITTER",
} as const;

export function normalizeSocialUrl(network: keyof SocialNetworksConfig, value: string): string {
  const val = (value || "").trim();
  if (!val) return "";
  if (val.startsWith("http://") || val.startsWith("https://")) return val;

  switch (network) {
    case "whatsapp": {
      const cleanDigits = val.replace(/\D/g, "");
      return cleanDigits ? `https://wa.me/${cleanDigits}` : "";
    }
    case "facebook":
      return `https://facebook.com/${val.replace(/^@/, "").replace(/^\/+/, "")}`;
    case "instagram":
      return `https://instagram.com/${val.replace(/^@/, "").replace(/^\/+/, "")}`;
    case "tiktok":
      return `https://tiktok.com/@${val.replace(/^@/, "").replace(/^\/+/, "")}`;
    case "telegram":
      return `https://t.me/${val.replace(/^@/, "").replace(/^\/+/, "")}`;
    case "youtube":
      return val.startsWith("@") ? `https://youtube.com/${val}` : `https://youtube.com/@${val.replace(/^\/+/, "")}`;
    case "twitter":
      return `https://x.com/${val.replace(/^@/, "").replace(/^\/+/, "")}`;
    default:
      return `https://${val}`;
  }
}

export const getSocialNetworksConfig = createServerFn({ method: "GET" }).handler(
  async (): Promise<SocialNetworksConfig> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data, error } = await supabaseAdmin
        .from("integration_credentials")
        .select("name, value")
        .in("name", [...Object.values(SOCIAL_KEYS), "SUPPORT_WHATSAPP_NUMBER"]);

      if (error) {
        console.error("Error al obtener redes sociales:", error.message);
      }

      const map = new Map((data ?? []).map((r) => [r.name, r.value || ""]));

      // Si no hay SOCIAL_WHATSAPP específico, usar SUPPORT_WHATSAPP_NUMBER como respaldo
      const whatsappVal =
        map.get(SOCIAL_KEYS.whatsapp) || map.get("SUPPORT_WHATSAPP_NUMBER") || "";

      return {
        whatsapp: whatsappVal,
        facebook: map.get(SOCIAL_KEYS.facebook) || "",
        instagram: map.get(SOCIAL_KEYS.instagram) || "",
        tiktok: map.get(SOCIAL_KEYS.tiktok) || "",
        telegram: map.get(SOCIAL_KEYS.telegram) || "",
        youtube: map.get(SOCIAL_KEYS.youtube) || "",
        twitter: map.get(SOCIAL_KEYS.twitter) || "",
      };
    } catch (err) {
      console.error("Fallo inesperado al cargar redes sociales:", err);
      return {
        whatsapp: "",
        facebook: "",
        instagram: "",
        tiktok: "",
        telegram: "",
        youtube: "",
        twitter: "",
      };
    }
  },
);

export const updateSocialNetworksConfig = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: Partial<SocialNetworksConfig>) => input)
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin, verifyIsStaff } = await import("@/lib/admin.server");
    const isAdmin = (await verifyIsAdmin(context)) || (await verifyIsStaff(context));
    if (!isAdmin) throw new Error("No tienes permisos para actualizar redes sociales");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();

    const keys = Object.keys(SOCIAL_KEYS) as (keyof SocialNetworksConfig)[];
    const upsertRows = keys
      .filter((k) => typeof data[k] === "string")
      .map((k) => ({
        name: SOCIAL_KEYS[k],
        value: (data[k] ?? "").trim(),
        updated_at: now,
        updated_by: context.userId,
      }));

    if (upsertRows.length === 0) return { ok: true, count: 0 };

    const { error } = await supabaseAdmin
      .from("integration_credentials")
      .upsert(upsertRows, { onConflict: "name" });

    if (error) {
      console.error("Error al guardar redes sociales:", error);
      throw new Error(`Error al guardar en base de datos: ${error.message}`);
    }

    return { ok: true, count: upsertRows.length };
  });
