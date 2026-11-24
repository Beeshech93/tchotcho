import { createFileRoute } from "@tanstack/react-router";

/**
 * Webhook de Mercado Pago (notificaciones IPN / Webhooks v2).
 * Verifica la firma `x-signature`, consulta el pago real en la API
 * y actualiza el estado del envío + notifica al usuario.
 */
export const Route = createFileRoute("/api/public/mercadopago/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { logAndAlertSecurityEvent, checkRateLimit, getClientIp } =
          await import("@/lib/security.server");

        const ip = getClientIp(request);
        const rl = checkRateLimit(`mp_webhook:${ip}`, { maxRequests: 120, windowMs: 60 * 1000 });
        if (!rl.ok) {
          await logAndAlertSecurityEvent({
            eventType: "rate_limit_exceeded",
            severity: "warning",
            detail: { webhook: "mercadopago", ip },
          });
          return new Response("Too Many Requests", { status: 429 });
        }

        const url = new URL(request.url);
        const raw = await request.text();

        let body: { type?: string; action?: string; data?: { id?: string | number } } = {};
        try {
          body = JSON.parse(raw) as typeof body;
        } catch {
          /* Mercado Pago también puede enviar solo query params */
        }

        const dataId =
          (body.data?.id !== undefined ? String(body.data.id) : null) ??
          url.searchParams.get("data.id") ??
          url.searchParams.get("id");

        const topic = body.type ?? url.searchParams.get("type") ?? url.searchParams.get("topic");

        const { verifyMpSignature, fetchMpPayment, applyMpPayment } =
          await import("@/lib/mercadopago.server");

        const verified = await verifyMpSignature({
          signatureHeader: request.headers.get("x-signature"),
          requestId: request.headers.get("x-request-id"),
          dataId,
        });
        if (!verified.ok) {
          console.error("Mercado Pago webhook rechazado:", verified.reason);
          await logAndAlertSecurityEvent({
            eventType: "webhook_invalid_signature",
            detail: { webhook: "mercadopago", reason: verified.reason, ip },
          });
          return new Response("Invalid signature", { status: 401 });
        }

        if (topic && topic !== "payment") {
          return Response.json({ received: true, ignored: topic });
        }
        if (!dataId) return Response.json({ received: true, ignored: "sin data.id" });

        const payment = await fetchMpPayment(dataId);
        if (!payment) {
          // Si el pago no existe en la API (ej. simulador de prueba en consola de Mercado Pago),
          // responder 200 para confirmar la disponibilidad del webhook sin fallar la prueba.
          return Response.json({ received: true, ignored: `pago ${dataId} no encontrado` });
        }

        const result = await applyMpPayment(payment);
        if (!result.ok)
          console.warn("Mercado Pago webhook:", "reason" in result ? result.reason : result);

        return Response.json({ received: true });
      },
      GET: () => Response.json({ endpoint: "mercadopago-webhook", status: "ready" }),
    },
  },
});
