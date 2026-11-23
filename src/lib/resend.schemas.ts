import { z } from "zod";

export function isValidResendFromEmail(val?: string | null): boolean {
  if (!val) return false;
  const trimmed = val.trim();
  const plainEmailRegex = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
  const namedEmailRegex = /^[^<>]+<[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+>$/;
  return plainEmailRegex.test(trimmed) || namedEmailRegex.test(trimmed);
}

const credField = z.string().trim().optional();

export const resendCredentialsSchema = z.object({
  RESEND_API_KEY: credField,
  RESEND_FROM_EMAIL: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || isValidResendFromEmail(val), {
      message:
        "El correo remitente debe tener formato 'email@tudominio.com' o 'Nombre <email@tudominio.com>' (o 'onboarding@resend.dev' para pruebas).",
    }),
  WELCOME_EMAIL_WEBHOOK_SECRET: credField,
  ADMIN_ALERT_EMAIL: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), {
      message: "El correo de alertas debe tener un formato de email válido.",
    }),
});

export type ResendCredentialsInput = z.infer<typeof resendCredentialsSchema>;

export function parseResendCredentialsInput(input: unknown): ResendCredentialsInput {
  return resendCredentialsSchema.parse(input);
}
