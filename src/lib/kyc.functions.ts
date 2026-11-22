import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const submitKycSchema = z.object({
  document_type: z.string().min(2),
  document_number: z.string().trim().min(3).max(50),
  birth_date: z.string().min(4),
  address: z.string().trim().min(5).max(250),
  front_base64: z.string().min(10),
  front_name: z.string().default("frente.jpg"),
  back_base64: z.string().optional().nullable(),
  back_name: z.string().optional().nullable(),
});

const getDocUrlsSchema = z.object({
  submissionId: z.string().uuid(),
});

const reviewKycSchema = z.object({
  submissionId: z.string().uuid(),
  status: z.enum(["approved", "rejected"]),
  notes: z.string().trim().max(500).optional().nullable(),
});

function decodeBase64File(base64Str: string): { buffer: Buffer; contentType: string } {
  let cleanBase64 = base64Str;
  let contentType = "image/jpeg";

  const match = base64Str.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
  if (match) {
    contentType = match[1] || "image/jpeg";
    cleanBase64 = match[2] || "";
  }

  const buffer = Buffer.from(cleanBase64, "base64");
  return { buffer, contentType };
}

/**
 * Envío de solicitud de verificación KYC por parte del usuario autenticado.
 * Usa supabaseAdmin para crear bucket si no existe, subir los archivos y
 * actualizar tanto kyc_submissions como profiles.kyc_status = 'pending'.
 */
export const submitKycVerification = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof submitKycSchema>) => submitKycSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const userId = context.userId;

    // Verificar si el usuario ya tiene KYC aprobado
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("kyc_status")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.kyc_status === "approved") {
      throw new Error("Tu cuenta ya está verificada. Las cuentas con identidad aprobada no pueden cambiar ni reemplazar las fotos de sus documentos.");
    }

    // Asegurar que el bucket kyc-documents exista
    try {
      await supabaseAdmin.storage.createBucket("kyc-documents", {
        public: false,
        fileSizeLimit: 15 * 1024 * 1024,
      });
    } catch {
      // Ignorar si ya existe
    }

    const timestamp = Date.now();
    const frontDecoded = decodeBase64File(data.front_base64);
    const frontExt = (data.front_name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
    const frontPath = `${userId}/${timestamp}-frente.${frontExt}`;

    const { error: frontUploadError } = await supabaseAdmin.storage
      .from("kyc-documents")
      .upload(frontPath, frontDecoded.buffer, {
        contentType: frontDecoded.contentType,
        upsert: true,
      });

    if (frontUploadError) {
      console.error("[KYC Server] Error subiendo foto frontal:", frontUploadError);
      throw new Error("No se pudo subir la foto frontal del documento. Intenta nuevamente.");
    }

    let backPath: string | null = null;
    if (data.back_base64) {
      const backDecoded = decodeBase64File(data.back_base64);
      const backExt = ((data.back_name || "reverso.jpg").split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
      backPath = `${userId}/${timestamp}-reverso.${backExt}`;

      const { error: backUploadError } = await supabaseAdmin.storage
        .from("kyc-documents")
        .upload(backPath, backDecoded.buffer, {
          contentType: backDecoded.contentType,
          upsert: true,
        });

      if (backUploadError) {
        console.error("[KYC Server] Error subiendo foto trasera:", backUploadError);
      }
    }

    // Insertar registro de solicitud
    const { data: submission, error: insertError } = await supabaseAdmin
      .from("kyc_submissions")
      .insert({
        user_id: userId,
        document_type: data.document_type,
        document_number: data.document_number,
        birth_date: data.birth_date,
        address: data.address,
        status: "pending",
        document_photo_path: frontPath,
        document_back_path: backPath,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("[KYC Server] Error insertando submission:", insertError);
      throw new Error(`Error registrando solicitud: ${insertError.message}`);
    }

    // Actualizar estado en perfil a 'pending'
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .update({ kyc_status: "pending" })
      .eq("id", userId);

    if (profileError) {
      console.warn("[KYC Server] Advertencia al actualizar profiles.kyc_status:", profileError);
    }

    // Registrar evento de auditoría
    try {
      await supabaseAdmin.from("security_events").insert({
        user_id: userId,
        event_type: "kyc_submitted",
        severity: "info",
        detail: {
          submission_id: submission.id,
          document_type: data.document_type,
          document_number: data.document_number,
        },
      });
    } catch {
      // Ignorar si la tabla security_events no está disponible
    }

    return {
      success: true,
      submissionId: submission.id,
      message: "Verificación enviada con éxito. Nuestro equipo la revisará en breve.",
    };
  });

/**
 * Obtener lista completa de solicitudes KYC para el panel de administración
 * Enriquecido con nombre, correo, teléfono y estado actual de cada usuario.
 */
export const adminGetKycSubmissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No tienes permisos para ver el panel de KYC.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Obtener todas las solicitudes ordenadas por fecha más reciente
    const { data: submissions, error: subError } = await supabaseAdmin
      .from("kyc_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (subError) {
      console.error("[KYC Admin] Error obteniendo submissions:", subError);
      throw new Error(`Error obteniendo solicitudes: ${subError.message}`);
    }

    const rows = submissions || [];
    const userIds = [...new Set(rows.map((r) => r.user_id).filter(Boolean))];

    // 2. Obtener perfiles para enriquecer con datos del cliente
    let profilesMap: Record<string, { full_name: string | null; phone: string | null; kyc_status: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, phone, kyc_status")
        .in("id", userIds);

      if (profiles) {
        profilesMap = Object.fromEntries((profiles as any[]).map((p) => [p.id, p]));
      }
    }

    const enriched = rows.map((sub) => {
      const p = profilesMap[sub.user_id];
      return {
        ...sub,
        user_full_name: p?.full_name || "Usuario sin nombre",
        user_phone: p?.phone || "Sin teléfono",
        user_email: null,
        current_kyc_status: p?.kyc_status || sub.status,
      };
    });

    return { submissions: enriched };
  });

/**
 * Generar URLs firmadas seguras para ver los documentos adjuntos de una solicitud.
 */
export const adminGetKycDocumentUrls = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof getDocUrlsSchema>) => getDocUrlsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No autorizado para ver documentos.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: sub, error } = await supabaseAdmin
      .from("kyc_submissions")
      .select("document_photo_path, document_back_path")
      .eq("id", data.submissionId)
      .maybeSingle();

    if (error || !sub) {
      throw new Error("Solicitud no encontrada.");
    }

    let frontUrl: string | null = null;
    let backUrl: string | null = null;

    if (sub.document_photo_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("kyc-documents")
        .createSignedUrl(sub.document_photo_path, 3600);
      if (signed?.signedUrl) frontUrl = signed.signedUrl;
    }

    if (sub.document_back_path) {
      const { data: signed } = await supabaseAdmin.storage
        .from("kyc-documents")
        .createSignedUrl(sub.document_back_path, 3600);
      if (signed?.signedUrl) backUrl = signed.signedUrl;
    }

    return { frontUrl, backUrl };
  });

/**
 * Revisar (aprobar o rechazar) una solicitud KYC.
 * Actualiza kyc_submissions y profiles.kyc_status con supabaseAdmin.
 */
export const adminReviewKycSubmission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: z.infer<typeof reviewKycSchema>) => reviewKycSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { verifyIsAdmin } = await import("@/lib/admin.server");
    const isAdmin = await verifyIsAdmin(context);
    if (!isAdmin) {
      throw new Error("No autorizado para aprobar o rechazar solicitudes.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Obtener la solicitud
    const { data: sub, error: fetchErr } = await supabaseAdmin
      .from("kyc_submissions")
      .select("id, user_id")
      .eq("id", data.submissionId)
      .maybeSingle();

    if (fetchErr || !sub) {
      throw new Error("Solicitud no encontrada.");
    }

    // 2. Actualizar kyc_submissions
    const { error: updateSubErr } = await supabaseAdmin
      .from("kyc_submissions")
      .update({
        status: data.status,
        review_notes: data.notes || null,
        reviewed_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.submissionId);

    if (updateSubErr) {
      console.error("[KYC Admin] Error actualizando submission:", updateSubErr);
      throw new Error(`Error actualizando solicitud: ${updateSubErr.message}`);
    }

    // 3. Actualizar profiles.kyc_status
    const { error: updateProfileErr } = await supabaseAdmin
      .from("profiles")
      .update({ kyc_status: data.status })
      .eq("id", sub.user_id);

    if (updateProfileErr) {
      console.error("[KYC Admin] Error actualizando profiles:", updateProfileErr);
      throw new Error(`Error actualizando perfil del usuario: ${updateProfileErr.message}`);
    }

    // 4. Registrar evento de auditoría
    try {
      await supabaseAdmin.from("security_events").insert({
        user_id: sub.user_id,
        event_type: data.status === "approved" ? "kyc_approved" : "kyc_rejected",
        severity: "info",
        detail: {
          submission_id: data.submissionId,
          reviewer_id: context.userId,
          notes: data.notes,
        },
      });
    } catch {
      // Ignorar si no existe
    }

    return {
      success: true,
      status: data.status,
      message: data.status === "approved" ? "KYC aprobado exitosamente." : "KYC rechazado.",
    };
  });
