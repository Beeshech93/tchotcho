import { createFileRoute } from "@tanstack/react-router";
import { render } from "@react-email/render";

/**
 * Llamado por un trigger de la base de datos (pg_net) cuando un usuario
 * confirma su correo por primera vez (auth.users.email_confirmed_at pasa de
 * NULL a un valor). Envía el correo de bienvenida real vía Resend, separado
 * del correo de confirmación que ya envía Supabase Auth.
 */
export const Route = createFileRoute("/api/public/auth/welcome")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { logAndAlertSecurityEvent, checkRateLimit, getClientIp } =
          await import("@/lib/security.server");

        const ip = getClientIp(request);
        const rl = checkRateLimit(`welcome_webhook:${ip}`, { maxRequests: 60, windowMs: 60 * 1000 });
        if (!rl.ok) {
          await logAndAlertSecurityEvent({
            eventType: "rate_limit_exceeded",
            severity: "warning",
            detail: { webhook: "welcome-email", ip },
          });
          return new Response("Too Many Requests", { status: 429 });
        }

        const { verifyWelcomeWebhookSecret, resendSendEmail } = await import("@/lib/resend.server");

        const url = new URL(request.url);
        const secret =
          request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret");
        const validSecret = await verifyWelcomeWebhookSecret(secret);
        if (!validSecret) {
          await logAndAlertSecurityEvent({
            eventType: "webhook_invalid_signature",
            detail: { webhook: "welcome-email", ip },
          });
          return new Response("Invalid signature", { status: 401 });
        }

        let body: { email?: string; full_name?: string } = {};
        try {
          body = (await request.json()) as { email?: string; full_name?: string };
        } catch {
          return Response.json({ received: true, ignored: "payload inválido" });
        }

        const email = body.email?.trim();
        if (!email) {
          return Response.json({ received: true, ignored: "sin correo" });
        }

        const { AccountReadyEmail } = await import("@/lib/email-templates/account-ready");
        const base = process.env["PUBLIC_URL"] || "https://tchotcho.app";
        const html = await render(
          AccountReadyEmail({
            siteName: "Tcho-Tcho",
            siteUrl: base,
            ...(body.full_name ? { fullName: body.full_name } : {}),
          }),
        );

        const result = await resendSendEmail({
          to: email,
          subject: "¡Tu cuenta de Tcho-Tcho ya está lista! 🚀",
          html,
        });

        if (!result.ok) console.warn("Correo de bienvenida:", result.error);

        return Response.json({ received: true, sent: result.ok });
      },
      GET: () => Response.json({ endpoint: "welcome-email", status: "ready" }),
    },
  },
});
