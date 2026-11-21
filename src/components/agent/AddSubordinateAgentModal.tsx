import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Users,
  Search,
  Check,
  UserCheck,
  Percent,
  Sparkles,
  Info,
  ShieldCheck,
  UserPlus,
  Mail,
  Phone,
  User,
  Globe,
  Copy,
  Send,
  CheckCircle2,
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
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addSubordinateAgent,
  searchAvailableUsersForAgent,
} from "@/lib/super-agent.functions";

interface AddSubordinateAgentModalProps {
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

export function AddSubordinateAgentModal({
  isOpen,
  onClose,
  onSuccess,
}: AddSubordinateAgentModalProps) {
  const qc = useQueryClient();
  const addAgent = useServerFn(addSubordinateAgent);
  const searchUsers = useServerFn(searchAvailableUsersForAgent);

  const [mode, setMode] = useState<"new" | "existing">("new");
  const [commissionPercent, setCommissionPercent] = useState<string>("0.5");

  // Formulario nuevo agente
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState("HT");

  // Selección de usuario existente
  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    fullName: string;
    phone: string | null;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  // Resultado de creación
  const [successResult, setSuccessResult] = useState<{
    message: string;
    actionLink?: string;
    emailSent?: boolean;
  } | null>(null);

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["available-users-for-agent"],
    queryFn: () => searchUsers(),
    enabled: isOpen && mode === "existing",
  });

  const availableUsers = (usersData?.users ?? []).filter((u) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      u.fullName.toLowerCase().includes(q) ||
      (u.phone && u.phone.includes(q)) ||
      u.id.toLowerCase().includes(q)
    );
  });

  const handleReset = () => {
    setFullName("");
    setEmail("");
    setPhone("");
    setCountry("HT");
    setSelectedUser(null);
    setSearchQuery("");
    setSuccessResult(null);
    setCopied(false);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const handleCopyLink = async () => {
    if (!successResult?.actionLink) return;
    try {
      await navigator.clipboard.writeText(successResult.actionLink);
      setCopied(true);
      toast.success("Enlace copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No se pudo copiar el enlace.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const commNum = Number(commissionPercent);
    if (isNaN(commNum) || commNum <= 0 || commNum > 5) {
      toast.error("La comisión para el Super Agente debe estar entre 0.1% y 5%.");
      return;
    }

    if (mode === "new") {
      if (!fullName.trim() || fullName.trim().length < 2) {
        toast.error("Por favor ingresa el nombre completo del agente.");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        toast.error("Por favor ingresa un correo electrónico válido.");
        return;
      }
      if (!phone.trim() || phone.trim().length < 6) {
        toast.error("Por favor ingresa un número de celular válido.");
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await addAgent({
          data: {
            newAgent: {
              fullName: fullName.trim(),
              email: email.trim().toLowerCase(),
              phone: phone.trim(),
              country,
            },
            commissionPercent: commNum,
          },
        });

        if (res.ok) {
          toast.success("¡Agente registrado y vinculado exitosamente!");
          qc.invalidateQueries({ queryKey: ["my-subordinate-agents"] });
          qc.invalidateQueries({ queryKey: ["subordinate-transactions"] });
          qc.invalidateQueries({ queryKey: ["available-users-for-agent"] });
          onSuccess?.();

          if (res.actionLink) {
            setSuccessResult({
              message: res.message,
              actionLink: res.actionLink,
              emailSent: res.emailSent,
            });
          } else {
            handleClose();
          }
        }
      } catch (err: any) {
        toast.error(err?.message || "Error al registrar el nuevo agente.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      // Modo existente
      if (!selectedUser) {
        toast.error("Por favor selecciona un usuario para agregarlo a tu red.");
        return;
      }

      setIsSubmitting(true);
      try {
        const res = await addAgent({
          data: {
            targetUserId: selectedUser.id,
            commissionPercent: commNum,
          },
        });

        toast.success(
          `¡${selectedUser.fullName || "Agente"} fue agregado exitosamente a tu red!`,
        );
        qc.invalidateQueries({ queryKey: ["my-subordinate-agents"] });
        qc.invalidateQueries({ queryKey: ["subordinate-transactions"] });
        qc.invalidateQueries({ queryKey: ["available-users-for-agent"] });
        onSuccess?.();
        handleClose();
      } catch (err: any) {
        toast.error(err?.message || "No se pudo agregar el agente.");
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? handleClose() : null)}>
      <DialogContent className="max-w-lg max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="size-5 text-indigo-600" />
            Adicionar Agente a mi Red
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Los agentes de tu red operan ventanillas de remesas y tú ganas una comisión automática por cada transacción que realicen.
          </DialogDescription>
        </DialogHeader>

        {successResult ? (
          <div className="space-y-4 py-2">
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-4 text-emerald-950 space-y-2">
              <div className="flex items-center gap-2 font-bold text-sm text-emerald-900">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                ¡Agente Registrado y Vinculado a tu Red!
              </div>
              <p className="text-xs text-emerald-800 leading-relaxed">
                El agente ya está activado en tu red con una comisión de{" "}
                <strong>{commissionPercent}%</strong> a tu favor por cada transacción.
              </p>
              {successResult.emailSent && (
                <div className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Send className="size-3.5" />
                  Se le envió un correo para que configure su contraseña de acceso.
                </div>
              )}
            </div>

            {successResult.actionLink && (
              <div className="space-y-1.5 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <Label className="text-xs font-bold text-slate-700">
                  Enlace directo para que el agente cree su contraseña:
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={successResult.actionLink}
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
                  Puedes compartir este enlace por WhatsApp o SMS para que el nuevo agente comience a operar de inmediato.
                </p>
              </div>
            )}

            <DialogFooter className="pt-2">
              <Button
                size="sm"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs"
                onClick={handleClose}
              >
                Entendido y Cerrar
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Pestañas de modo: Registrar Nuevo vs Vincular Existente */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`py-2 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  mode === "new"
                    ? "bg-white text-indigo-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <UserPlus className="size-3.5 text-indigo-600" />
                Registrar Nuevo Agente
              </button>
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`py-2 text-xs font-extrabold rounded-lg flex items-center justify-center gap-1.5 transition-all ${
                  mode === "existing"
                    ? "bg-white text-indigo-900 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Users className="size-3.5 text-indigo-600" />
                Vincular Usuario Existente
              </button>
            </div>

            {/* Comisión de Red */}
            <div className="space-y-2 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 p-3.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                  <Percent className="size-3.5 text-indigo-600" />
                  Tu Comisión por Transacción
                </Label>
                <Badge className="bg-indigo-600 text-white font-bold text-xs">
                  {commissionPercent}%
                </Badge>
              </div>
              <p className="text-[11px] text-indigo-800 leading-snug">
                Porcentaje que se acreditará a tu cuenta por cada envío en efectivo que este agente realice.
              </p>
              <div className="flex items-center gap-1.5 pt-1">
                {["0.3", "0.5", "0.8", "1.0", "1.5"].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setCommissionPercent(pct)}
                    className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                      commissionPercent === pct
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "bg-white text-indigo-900 border border-indigo-200 hover:bg-indigo-100"
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="5"
                    value={commissionPercent}
                    onChange={(e) => setCommissionPercent(e.target.value)}
                    className="h-7 text-xs bg-white border-indigo-200 font-bold text-indigo-950 text-right pr-6"
                  />
                  <span className="absolute right-2 top-1.5 text-xs font-bold text-indigo-400">
                    %
                  </span>
                </div>
              </div>
            </div>

            {mode === "new" ? (
              /* Modo: Registrar Nuevo Agente */
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <User className="size-3.5 text-slate-500" />
                    Nombre Completo del Agente *
                  </Label>
                  <Input
                    required
                    placeholder="Ej. Jean Duval"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="text-xs"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Mail className="size-3.5 text-slate-500" />
                    Correo Electrónico del Agente *
                  </Label>
                  <Input
                    type="email"
                    required
                    placeholder="agente@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="text-xs"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Phone className="size-3.5 text-slate-500" />
                    Número de Celular *
                  </Label>
                  <Input
                    type="tel"
                    required
                    placeholder="+509 3412 3456"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="text-xs font-mono"
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                    <Globe className="size-3.5 text-slate-500" />
                    País de Operación
                  </Label>
                  <Select value={country} onValueChange={setCountry} disabled={isSubmitting}>
                    <SelectTrigger className="w-full text-xs h-9">
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
              </div>
            ) : (
              /* Modo: Vincular Usuario Existente */
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Seleccionar Usuario Registrado
                </Label>
                <div className="relative">
                  <Search className="size-4 text-muted-foreground absolute left-3 top-3" />
                  <Input
                    placeholder="Buscar por nombre o teléfono..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 h-10 text-xs"
                  />
                </div>

                <div className="border border-border rounded-xl max-h-48 overflow-y-auto divide-y divide-border/60">
                  {isLoadingUsers && (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      Cargando usuarios registrados...
                    </div>
                  )}

                  {!isLoadingUsers && availableUsers.length === 0 && (
                    <div className="p-4 text-center text-xs text-muted-foreground">
                      No se encontraron usuarios disponibles.
                    </div>
                  )}

                  {availableUsers.map((u) => {
                    const isSelected = selectedUser?.id === u.id;
                    return (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => setSelectedUser(u)}
                        className={`w-full p-2.5 flex items-center justify-between text-left transition-colors cursor-pointer ${
                          isSelected
                            ? "bg-indigo-50/80 border-l-4 border-indigo-600"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <div>
                          <p className="text-xs font-bold text-foreground">
                            {u.fullName || "Usuario sin nombre"}
                          </p>
                          <p className="text-[11px] text-muted-foreground font-mono">
                            {u.phone || "Sin teléfono"}
                          </p>
                        </div>
                        {isSelected ? (
                          <Badge className="bg-indigo-600 text-white font-bold gap-1 text-[10px]">
                            <Check className="size-3" /> Seleccionado
                          </Badge>
                        ) : (
                          <UserCheck className="size-4 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>

                {selectedUser && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-2.5 text-xs text-emerald-950 flex items-start gap-2">
                    <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">
                        {selectedUser.fullName} se activará como Agente en tu red
                      </p>
                      <p className="text-[11px] text-emerald-800">
                        Ganarás el <strong>{commissionPercent}%</strong> de cada envío procesado por este agente.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <DialogFooter className="gap-2 sm:gap-0 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleClose} disabled={isSubmitting}>
                Cancelar
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting || (mode === "existing" && !selectedUser)}
                className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold gap-1.5"
              >
                <Sparkles className="size-4" />
                {isSubmitting
                  ? "Procesando..."
                  : mode === "new"
                    ? "Registrar y Activar Agente"
                    : "Asignar Agente a mi Red"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
