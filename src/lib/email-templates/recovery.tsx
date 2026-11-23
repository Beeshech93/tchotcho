import * as React from "react";
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "@react-email/components";

interface RecoveryEmailProps {
  siteName: string;
  confirmationUrl: string;
}

export const RecoveryEmail = ({ siteName, confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="es" dir="ltr">
    <Head />
    <Preview>Restablece tu contraseña de {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={headerBadge}>
          <Text style={badgeText}>Seguridad de la Cuenta</Text>
        </div>
        <Heading style={h1}>Restablece tu contraseña</Heading>
        <Text style={text}>
          Recibimos una solicitud para restablecer la contraseña de tu cuenta en <strong>{siteName}</strong>. Haz clic en el botón a continuación para crear tu nueva clave de acceso:
        </Text>
        <div style={{ textAlign: "center", margin: "26px 0" }}>
          <Button style={button} href={confirmationUrl}>
            Crear Nueva Contraseña
          </Button>
        </div>
        <Text style={subtext}>
          O si el botón no abre, copia y pega el siguiente enlace seguro en tu navegador:
        </Text>
        <Text style={linkText}>
          <a href={confirmationUrl} style={{ color: "#059669", wordBreak: "break-all" }}>
            {confirmationUrl}
          </a>
        </Text>
        <hr style={hr} />
        <Text style={footer}>
          Si no solicitaste este cambio, no te preocupes: tu cuenta sigue protegida y puedes ignorar este mensaje.
        </Text>
      </Container>
    </Body>
  </Html>
);

export default RecoveryEmail;

const main = {
  backgroundColor: "#f8fafc",
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  padding: "30px 10px",
};
const container = {
  backgroundColor: "#ffffff",
  border: "1px solid #e2e8f0",
  borderRadius: "16px",
  padding: "32px 28px",
  maxWidth: "520px",
  margin: "0 auto",
  boxShadow: "0 4px 6px -1px rgba(0,0,0,0.05)",
};
const headerBadge = {
  textAlign: "center" as const,
  marginBottom: "16px",
};
const badgeText = {
  display: "inline-block" as const,
  backgroundColor: "#dcfce7",
  color: "#166534",
  fontWeight: "bold" as const,
  fontSize: "11px",
  padding: "4px 12px",
  borderRadius: "9999px",
  textTransform: "uppercase" as const,
  letterSpacing: "0.5px",
  margin: "0",
};
const h1 = {
  fontSize: "22px",
  fontWeight: "800" as const,
  color: "#0f172a",
  margin: "0 0 16px",
  textAlign: "center" as const,
};
const text = {
  fontSize: "14px",
  color: "#475569",
  lineHeight: "1.6",
  margin: "0 0 20px",
};
const button = {
  backgroundColor: "#059669",
  color: "#ffffff",
  fontSize: "14px",
  fontWeight: "bold" as const,
  borderRadius: "10px",
  padding: "14px 28px",
  textDecoration: "none",
  display: "inline-block" as const,
};
const subtext = {
  fontSize: "12px",
  color: "#64748b",
  lineHeight: "1.5",
  margin: "15px 0 6px",
};
const linkText = {
  fontSize: "11px",
  color: "#059669",
  margin: "0 0 20px",
  wordBreak: "break-all" as const,
};
const hr = {
  borderColor: "#f1f5f9",
  borderTop: "1px solid #e2e8f0",
  margin: "24px 0 16px",
};
const footer = {
  fontSize: "12px",
  color: "#94a3b8",
  lineHeight: "1.5",
  margin: "0",
};
