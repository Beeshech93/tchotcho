import { createFileRoute } from "@tanstack/react-router";

/**
 * Llamado por triggers de la base de datos (pg_net) cuando detectan un
 * intento de acción no autorizada (ej. auto-aprobar el propio KYC). Reutiliza
 * el secreto del webhook de correo de bienvenida para no duplicar credenciales
 * internas.
 */
export const Route = createFileRoute("/api/public/security/alert")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { logAndAlertSecurityEvent, checkRateLimit, getClientIp } =
          await import("@/lib/security.server");

        const ip = getClientIp(request);
        const rl = checkRateLimit(`security_alert:${ip}`, { maxRequests: 60, windowMs: 60 * 1000 });
        if (!rl.ok) {
          return new Response("Too Many Requests", { status: 429 });
        }

        const { verifyWelcomeWebhookSecret } = await import("@/lib/resend.server");
        const url = new URL(request.url);
        const secret =
          request.headers.get("x-webhook-secret") ?? url.searchParams.get("secret");
        const validSecret = await verifyWelcomeWebhookSecret(secret);
        if (!validSecret) {
          return new Response("Invalid signature", { status: 401 });
        }

        let body: { event_type?: string; detail?: Record<string, unknown> } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          return Response.json({ received: true, ignored: "payload inválido" });
        }

        await logAndAlertSecurityEvent({
          eventType: (body.event_type as "kyc_self_approve_attempt") ?? "unauthorized_action",
          severity: "critical",
          detail: body.detail ?? {},
          userId: (body.detail?.["user_id"] as string | undefined) ?? null,
        });

        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "security-alert", status: "ready" }),
    },
  },
});
