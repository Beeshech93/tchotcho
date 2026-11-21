import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sparkles,
  User,
  Mail,
  Phone,
  Globe,
  Copy,
  Check,
  Send,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { registerSuperAgent } from "@/lib/super-agent.functions";

interface RegisterSuperAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const COUNTRIES = [
  { code: "HT", name: "🇭🇹 Haití (+509)" },
  { code: "DO", name: "🇩🇴 Rep. Dominicana (+1)" },
  { code: "MX", name: "🇲🇽 México (+52)" },
  { code: "US", name: "🇺🇸 Estados Unidos (+1)" },
  { code: "CA", name: "🇨🇦 Canadá (+1)" },
  { code: "CL", name: "🇨🇱 Chile (+56)" },
  { code: "BR", name: "🇧🇷 Brasil (+55)" },
];

export function RegisterSuperAgentModal({
  isOpen,
  onClose,
  onSuccess,
}: RegisterSuperAgentModalProps) {
  const qc = useQueryClient();
  const registerFn = useServerFn(registerSuperAgent);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("HT");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Resultado exitoso
  const [result, setResult] = useState<{
    ok: boolean;
    userId: string;
    email: string;
    actionLink: string;
    emailSent: boolean;
    message: string;
  } | null>(null);

  const handleReset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setCountry("HT");
    setResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleCopyLink = async () => {
    if (!result?.actionLink) return;
    try {
      await navigator.clipboard.writeText(result.actionLink);
      setCopied(true);
      toast.success("Enlace de contraseña copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No se pudo copiar el enlace al portapapeles.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || fullName.trim().length < 2) {
      toast.error("Por favor ingresa el nombre completo del Super Agente.");
      return;
    }

    if (!email.trim() || !email.includes("@")) {
      toast.error("Por favor ingresa un correo electrónico válido.");
      return;
    }

    if (!phone.trim() || phone.trim().length < 6) {
      toast.error("Por favor ingresa un número de celular o teléfono válido.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await registerFn({
        data: {
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          country,
        },
      });

      if (res.ok) {
        setResult(res);
        toast.success(res.message);
        qc.invalidateQueries({ queryKey: ["admin-users-list"] });
        qc.invalidateQueries({ queryKey: ["admin-profiles"] });
        if (onSuccess) onSuccess();
      } else {
        toast.error("No se pudo completar el registro del Super Agente.");
      }
    } catch (err: any) {
      toast.error(err?.message || "Error al registrar el Super Agente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : null)}>
      <DialogContent className="sm:max-w-md w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
              <Sparkles className="size-4" />
            </span>
            Registrar Super Agente
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Registra los datos del Super Agente. El sistema creará su cuenta con permisos
            operativos y le enviará un correo para que establezca su contraseña.
          </DialogDescription>
        </DialogHeader>

        {result ? (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-4 text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                ¡Super Agente Registrado Exitosamente!
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                Se han configurado las billeteras operativas y los privilegios de Super Agente para{" "}
                <strong>{result.email}</strong>.
              </p>
              {result.emailSent ? (
                <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Send className="size-3.5" />
                  Correo enviado con el enlace para crear su contraseña.
                </div>
              ) : (
                <div className="text-[11px] font-semibold text-amber-800 bg-amber-100/80 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <AlertCircle className="size-3.5 text-amber-600 shrink-0" />
                  No se pudo despachar el correo automático. Puedes copiar el enlace abajo y enviárselo directamente.
                </div>
              )}
            </div>

            {/* Enlace para configurar contraseña */}
            <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <Label className="text-xs font-bold text-slate-700">
                Enlace para crear / restablecer contraseña:
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={result.actionLink}
                  className="font-mono text-xs bg-white select-all"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1 font-semibold text-xs border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                  onClick={handleCopyLink}
                >
                  {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copied ? "Copiado" : "Copiar"}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Puedes compartir este enlace por WhatsApp o SMS para que el Super Agente establezca su clave de inmediato.
              </p>
            </div>

            <DialogFooter className="pt-2 flex sm:justify-between items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleReset}
              >
                Registrar otro
              </Button>
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                onClick={handleClose}
              >
                Cerrar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3.5 py-2">
            {/* Nombre completo */}
            <div className="space-y-1.5">
              <Label htmlFor="super-agent-name" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <User className="size-3.5 text-slate-500" />
                Nombre Completo *
              </Label>
              <Input
                id="super-agent-name"
                required
                placeholder="Ej. Jean Pierre Duval"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="text-sm font-medium"
                disabled={isSubmitting}
              />
            </div>

            {/* Correo electrónico */}
            <div className="space-y-1.5">
              <Label htmlFor="super-agent-email" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Mail className="size-3.5 text-slate-500" />
                Correo Electrónico *
              </Label>
              <Input
                id="super-agent-email"
                type="email"
                required
                placeholder="superagente@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="text-sm font-medium"
                disabled={isSubmitting}
              />
              <p className="text-[11px] text-muted-foreground">
                A este correo se le enviará la invitación para crear su contraseña segura.
              </p>
            </div>

            {/* Teléfono / Celular */}
            <div className="space-y-1.5">
              <Label htmlFor="super-agent-phone" className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Phone className="size-3.5 text-slate-500" />
                Número de Celular *
              </Label>
              <Input
                id="super-agent-phone"
                type="tel"
                required
                placeholder="Ej. +509 3412 3456"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="text-sm font-mono font-medium"
                disabled={isSubmitting}
              />
            </div>

            {/* País */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                <Globe className="size-3.5 text-slate-500" />
                País de Operación
              </Label>
              <Select value={country} onValueChange={setCountry} disabled={isSubmitting}>
                <SelectTrigger className="w-full text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code} className="text-xs">
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 text-xs text-indigo-900 space-y-1">
              <span className="font-bold flex items-center gap-1">
                <Sparkles className="size-3.5 text-indigo-600" /> Beneficios de Super Agente:
              </span>
              <p className="text-[11px] text-indigo-800 leading-relaxed">
                Tendrá acceso al panel de agente con la función exclusiva de vincular agentes bajo su red y ganar comisiones automáticas sobre sus operaciones.
              </p>
            </div>

            <DialogFooter className="pt-2 flex items-center justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-xs"
                onClick={handleClose}
                disabled={isSubmitting}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs gap-1.5"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>Registrando...</>
                ) : (
                  <>
                    <Send className="size-3.5" />
                    Registrar y Enviar Email
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
