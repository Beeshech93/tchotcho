import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { parseResendCredentialsInput, type ResendCredentialsInput } from "@/lib/resend.schemas";

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { verifyIsAdmin } = await import("@/lib/admin.server");
  const isAdmin = await verifyIsAdmin(context);
  if (!isAdmin) throw new Error("No autorizado");
}

/** Estado de configuración de Resend (solo administradores). */
export const resendStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { resendStatusInfo } = await import("@/lib/resend.server");
    return resendStatusInfo();
  });

/** Guarda manualmente las credenciales de Resend (solo administradores). */
export const resendSaveCredentials = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: ResendCredentialsInput) => parseResendCredentialsInput(input))
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { saveResendCred } = await import("@/lib/resend.server");
    for (const [name, value] of Object.entries(data)) {
      if (value === undefined) continue;
      await saveResendCred(name, value.trim(), context.userId, context.supabase);
    }
    return { ok: true };
  });

/** Genera un secreto aleatorio para el webhook de bienvenida (solo administradores). */
export const resendGenerateWebhookSecret = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { saveResendCred } = await import("@/lib/resend.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const secret = crypto.randomUUID().replace(/-/g, "");
    await saveResendCred("WELCOME_EMAIL_WEBHOOK_SECRET", secret, context.userId, supabaseAdmin);
    return { ok: true, secret };
  });

/** Envía un correo de prueba al propio administrador (solo administradores). */
export const resendSendTest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);

    const email = context.claims?.email as string | undefined;
    if (!email) throw new Error("Tu cuenta de administrador no tiene correo");

    const { resendSendEmail } = await import("@/lib/resend.server");
    const { render } = await import("@react-email/render");
    const { AccountReadyEmail } = await import("@/lib/email-templates/account-ready");
    const base = process.env["PUBLIC_URL"] || "https://tchotcho.app";
    const html = await render(
      AccountReadyEmail({ siteName: "Tcho-Tcho", siteUrl: base, fullName: "Prueba" }),
    );
    return resendSendEmail({ to: email, subject: "Prueba: correo de bienvenida", html });
  });

/** Envía un anuncio a todos los usuarios con correo confirmado, uno por uno para no revelar destinatarios. */
export const resendSendAnnouncement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { subject: string; message: string }) => {
    const subject = typeof input?.subject === "string" ? input.subject.trim() : "";
    const message = typeof input?.message === "string" ? input.message.trim() : "";
    if (subject.length < 3 || subject.length > 150) {
      throw new Error("El asunto debe tener entre 3 y 150 caracteres.");
    }
    if (message.length < 2 || message.length > 5000) {
      throw new Error("El mensaje debe tener entre 2 y 5000 caracteres.");
    }
    return { subject, message };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resendSendBulkEmails } = await import("@/lib/resend.server");

    const escapeHtml = (value: string) =>
      value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
    const html = `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#222;max-width:640px;margin:0 auto">
      <h2 style="margin-bottom:20px">Tcho-Tcho</h2>
      <div style="white-space:pre-wrap">${escapeHtml(data.message)}</div>
      <hr style="margin-top:32px;border:0;border-top:1px solid #ddd"/>
      <p style="font-size:12px;color:#666">Mensaje enviado por Tcho-Tcho.</p>
    </div>`;

    let page = 1;
    const perPage = 1000;
    const emails: string[] = [];
    while (true) {
      const { data: result, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (error) throw new Error("No se pudieron consultar los usuarios: " + error.message);
      for (const user of result.users) {
        if (user.email && user.email_confirmed_at) emails.push(user.email);
      }
      if (result.users.length < perPage || emails.length >= 5000) break;
      page += 1;
    }

    if (emails.length === 0) {
      return {
        ok: true,
        total: 0,
        sent: 0,
        failed: 0,
        message: "No hay usuarios con correo confirmado.",
      };
    }

    const { sent, failed } = await resendSendBulkEmails(
      emails.map((to) => ({ to, subject: data.subject, html })),
    );

    return {
      ok: failed === 0,
      total: emails.length,
      sent,
      failed,
      message:
        failed === 0
          ? `Correo enviado a ${sent} usuarios.`
          : `Envío terminado: ${sent} enviados y ${failed} fallidos.`,
    };
  });

const resetInputSchema = z.object({
  email: z.string().trim().email(),
  origin: z.string().optional(),
});

/** Solicita el restablecimiento de contraseña enviando correo oficial vía Resend (no Supabase directo). */
export const requestPasswordResetEmail = createServerFn({ method: "POST" })
  .validator((input: z.infer<typeof resetInputSchema>) => resetInputSchema.parse(input))
  .handler(async ({ data }) => {
    const cleanEmail = data.email.toLowerCase().trim();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { resendSendEmail } = await import("@/lib/resend.server");
    const { render } = await import("@react-email/render");
    const { RecoveryEmail } = await import("@/lib/email-templates/recovery");

    const publicUrl =
      data.origin ||
      process.env["PUBLIC_URL"] ||
      process.env["VITE_PUBLIC_URL"] ||
      "https://tchotcho.app";
    const cleanPublicUrl = publicUrl.replace(/\/$/, "");
    const redirectUrl = `${cleanPublicUrl}/restablecer-password`;

    // 1. Generar enlace seguro de recuperación
    let actionLink = redirectUrl;
    try {
      const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email: cleanEmail,
        options: { redirectTo: redirectUrl },
      });

      if (linkErr) {
        console.warn("[requestPasswordResetEmail] generateLink error:", linkErr.message);
        // Por seguridad no revelamos si el correo existe o no
        return { ok: true };
      }

      if (linkData?.properties?.action_link) {
        actionLink = linkData.properties.action_link;
      }
    } catch (err: any) {
      console.warn("[requestPasswordResetEmail] generateLink exception:", err?.message);
      return { ok: true };
    }

    // 2. Renderizar correo elegante con React Email
    const html = await render(
      RecoveryEmail({
        siteName: "Tcho-Tcho",
        confirmationUrl: actionLink,
      }),
    );

    // 3. Enviar correo vía Resend
    const sendRes = await resendSendEmail({
      to: cleanEmail,
      subject: "Restablece tu contraseña — Tcho-Tcho",
      html,
    });

    if (!sendRes.ok) {
      console.warn("[requestPasswordResetEmail] Resend send error:", sendRes.error);

      // Si Resend falló (ej. modo sandbox onboarding@resend.dev que solo permite enviar al correo del dueño de Resend),
      // enviamos mediante el servicio de autenticación de Supabase como respaldo inmediato para que el usuario no quede bloqueado.
      try {
        const { error: sbFallbackErr } = await supabaseAdmin.auth.resetPasswordForEmail(cleanEmail, {
          redirectTo: redirectUrl,
        });
        if (!sbFallbackErr) {
          console.info("[requestPasswordResetEmail] Enviado exitosamente mediante respaldo de Supabase");
          return { ok: true, via: "fallback" };
        }
      } catch (fbErr: any) {
        console.warn("[requestPasswordResetEmail] Fallback de Supabase también falló:", fbErr?.message);
      }

      return {
        ok: false,
        error: sendRes.error.includes("verify a domain")
          ? "El dominio tchotcho.app aún se está verificando en Resend. Si tu dominio ya fue verificado, cambia el remitente en Admin > Correo a 'Tcho-Tcho <bienvenida@tchotcho.app>'."
          : sendRes.error,
      };
    }

    return { ok: true };
  });

