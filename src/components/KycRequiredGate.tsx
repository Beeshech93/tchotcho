import { Link } from "@tanstack/react-router";
import { ShieldAlert, Clock, XCircle, ArrowRight, ShieldCheck, Lock } from "lucide-react";
import { useProfile } from "@/hooks/useProfile";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface KycRequiredGateProps {
  operationName?: string;
  className?: string;
}

export function KycRequiredGate({
  operationName = "realizar operaciones",
  className = "",
}: KycRequiredGateProps) {
  const { profile } = useProfile();
  const { t } = useI18n();

  const status = profile?.kyc_status ?? "none";

  return (
    <Card className={`border-amber-500/30 bg-gradient-to-b from-[#161C14] to-[#0D120E] text-white shadow-2xl relative overflow-hidden ${className}`}>
      <div className="absolute top-0 right-0 size-48 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />
      
      <CardHeader className="text-center pb-2 relative z-10">
        <div className="mx-auto mb-3 grid size-16 place-items-center rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 text-amber-400 shadow-inner">
          {status === "pending" ? (
            <Clock className="size-8 animate-pulse text-amber-300" />
          ) : status === "rejected" ? (
            <XCircle className="size-8 text-rose-400" />
          ) : (
            <ShieldAlert className="size-8 text-amber-400" />
          )}
        </div>

        <div className="flex justify-center mb-1">
          {status === "pending" ? (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold gap-1 py-1 px-3">
              <Clock className="size-3.5" /> En revisión
            </Badge>
          ) : status === "rejected" ? (
            <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs font-bold gap-1 py-1 px-3">
              <XCircle className="size-3.5" /> Verificación rechazada
            </Badge>
          ) : (
            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/40 text-xs font-bold gap-1 py-1 px-3">
              <Lock className="size-3.5" /> Verificación obligatoria
            </Badge>
          )}
        </div>

        <CardTitle className="text-xl sm:text-2xl font-black text-white">
          {status === "pending"
            ? "Verificación de Identidad en Proceso"
            : status === "rejected"
            ? "Verificación de Identidad Rechazada"
            : "Verificación de Identidad Requerida (KYC)"}
        </CardTitle>

        <CardDescription className="text-xs sm:text-sm text-slate-300 max-w-md mx-auto mt-1.5">
          {status === "pending"
            ? `Tu solicitud de verificación fue recibida. Nuestro equipo está revisando tus documentos para habilitar tus permisos de ${operationName}.`
            : status === "rejected"
            ? `Tu documentación anterior no pudo ser validada. Por favor actualiza tus datos y sube documentos oficiales legibles para desbloquear tus operaciones.`
            : `Por normativas de seguridad financiera y prevención de fraude, las cuentas de clientes deben verificar su identidad antes de poder ${operationName}.`}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6 pt-2 relative z-10">
        {/* Pasos explicativos */}
        <div className="rounded-2xl bg-black/40 border border-white/10 p-4 space-y-3">
          <p className="text-xs font-bold text-slate-300 uppercase tracking-wider">
            ¿Por qué es necesario este paso?
          </p>
          <ul className="space-y-2 text-xs text-slate-300">
            <li className="flex items-start gap-2">
              <ShieldCheck className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>Cumplimiento con leyes de prevención de lavado de dinero (PLD/FT).</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>Protección contra fraude y suplantación de identidad en tus envíos.</span>
            </li>
            <li className="flex items-start gap-2">
              <ShieldCheck className="size-4 shrink-0 text-emerald-400 mt-0.5" />
              <span>Límites de envío y recargas ampliados para tu cuenta.</span>
            </li>
          </ul>
        </div>

        {/* Botones de acción */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button
            asChild
            size="lg"
            className="w-full sm:w-auto min-w-[200px] h-11 rounded-xl bg-[#02531C] text-[#F2AC00] border border-[#F2AC00]/40 font-bold hover:bg-[#036B25] shadow-lg gap-2 text-sm"
          >
            <Link to="/perfil">
              {status === "rejected" ? "Volver a enviar documentos" : "Completar verificación KYC"}
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            size="lg"
            className="w-full sm:w-auto h-11 rounded-xl border-white/20 bg-white/5 text-white hover:bg-white/10 text-sm font-semibold"
          >
            <Link to="/dashboard">Ir al Inicio</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
