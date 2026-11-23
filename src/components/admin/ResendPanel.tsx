import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Mail, RefreshCw, Save, Send, Check, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  resendGenerateWebhookSecret,
  resendSaveCredentials,
  resendSendTest,
  resendStatus,
} from "@/lib/resend.functions";

const CRED_KEYS = ["RESEND_API_KEY", "RESEND_FROM_EMAIL", "ADMIN_ALERT_EMAIL"] as const;
type CredKey = (typeof CRED_KEYS)[number];

export function ResendPanel() {
  const status = useServerFn(resendStatus);
  const saveCreds = useServerFn(resendSaveCredentials);
  const generateSecret = useServerFn(resendGenerateWebhookSecret);
  const sendTest = useServerFn(resendSendTest);
  const queryClient = useQueryClient();

  const { data: info } = useQuery({
    queryKey: ["resend_status"],
    queryFn: () => status(),
  });

  const [creds, setCreds] = useState<Record<CredKey, string>>({
    RESEND_API_KEY: "",
    RESEND_FROM_EMAIL: "",
    ADMIN_ALERT_EMAIL: "",
  });
  const setCred = (k: CredKey, v: string) => setCreds((p) => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Partial<Record<CredKey, string>> = {};
      for (const k of CRED_KEYS) if (creds[k].trim()) payload[k] = creds[k].trim();
      if (Object.keys(payload).length === 0) throw new Error("Nada para guardar");
      return saveCreds({ data: payload });
    },
    onSuccess: () => {
      toast.success("Credenciales guardadas");
      setCreds({ RESEND_API_KEY: "", RESEND_FROM_EMAIL: "", ADMIN_ALERT_EMAIL: "" });
      void queryClient.invalidateQueries({ queryKey: ["resend_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const secretMut = useMutation({
    mutationFn: () => generateSecret(),
    onSuccess: () => {
      toast.success("Secreto generado y guardado");
      void queryClient.invalidateQueries({ queryKey: ["resend_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => sendTest(),
    onSuccess: (r) => {
      if (r.ok) toast.success("Correo de prueba enviado a tu cuenta");
      else toast.error(r.error);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="size-4" /> Correo de bienvenida
            <Badge variant={info?.hasApiKey && info?.hasFromEmail ? "default" : "secondary"}>
              {info?.hasApiKey && info?.hasFromEmail ? "Configurado" : "Falta configurar"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cuando un usuario confirma su cuenta por primera vez, la base de datos avisa
            automáticamente a la app, que envía un correo de bienvenida real vía Resend (distinto
            del correo de confirmación que ya envía Supabase).
          </p>
          <div className="space-y-1.5">
            <Label>Secreto del webhook interno</Label>
            <div className="flex items-center gap-2">
              <Badge variant={info?.hasWebhookSecret ? "default" : "secondary"}>
                {info?.hasWebhookSecret ? "Generado" : "Sin generar"}
              </Badge>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="gap-2"
                disabled={secretMut.isPending}
                onClick={() => secretMut.mutate()}
              >
                <RefreshCw className="size-4" />
                {info?.hasWebhookSecret ? "Regenerar" : "Generar"}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Necesario antes de activar el trigger de la base de datos.
            </p>
          </div>
          <div className="space-y-1.5 pt-1">
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2 border-emerald-300 text-emerald-950 font-bold hover:bg-emerald-50"
              disabled={testMut.isPending || !info?.hasApiKey || !info?.hasFromEmail}
              onClick={() => testMut.mutate()}
            >
              <Send className="size-4 text-emerald-600" />
              {testMut.isPending ? "Enviando..." : "Enviarme un correo de prueba"}
            </Button>
            {(!info?.hasApiKey || !info?.hasFromEmail) && (
              <p className="text-[11px] text-amber-700 font-medium text-center">
                Guarda la API Key y el correo remitente en el panel derecho antes de enviar la prueba.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Credenciales de Resend</span>
            <Badge variant={info?.hasApiKey && info?.hasFromEmail ? "default" : "secondary"} className="text-xs">
              {info?.hasApiKey && info?.hasFromEmail ? "Conectado" : "Pendiente"}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="resend-key">API Key</Label>
              {info?.hasApiKey ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <Check className="size-3" /> Configurada (re_••••)
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <AlertCircle className="size-3" /> Sin configurar
                </span>
              )}
            </div>
            <Input
              id="resend-key"
              type="password"
              placeholder="re_..."
              value={creds.RESEND_API_KEY}
              onChange={(e) => setCred("RESEND_API_KEY", e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="resend-from">Correo remitente</Label>
              {info?.hasFromEmail ? (
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700">
                  <Check className="size-3" /> Configurado
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                  <AlertCircle className="size-3" /> Sin configurar
                </span>
              )}
            </div>
            <Input
              id="resend-from"
              type="email"
              placeholder="Tcho-Tcho <bienvenida@tchotcho.app>"
              value={creds.RESEND_FROM_EMAIL}
              onChange={(e) => setCred("RESEND_FROM_EMAIL", e.target.value)}
            />
            {info?.fromEmail && (
              <p className="text-xs text-muted-foreground font-semibold">Remitente actual: {info.fromEmail}</p>
            )}
            <p className="text-xs text-muted-foreground">
              El dominio de este correo debe estar verificado en tu cuenta de Resend.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="resend-alert">Correo de alertas de seguridad</Label>
            <Input
              id="resend-alert"
              type="email"
              placeholder="admin@tchotcho.app"
              value={creds.ADMIN_ALERT_EMAIL}
              onChange={(e) => setCred("ADMIN_ALERT_EMAIL", e.target.value)}
            />
            {info?.alertEmail && (
              <p className="text-xs text-muted-foreground">Actual: {info.alertEmail}</p>
            )}
            <p className="text-xs text-muted-foreground">
              Aquí llegan las alertas cuando se detecta actividad sospechosa (firmas de webhook
              inválidas, intentos de auto-aprobar KYC, etc.).
            </p>
          </div>
          <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
            <Save className="mr-2 size-4" />
            {saveMut.isPending ? "Guardando..." : "Guardar credenciales"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
