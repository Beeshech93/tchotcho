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
  addSubordinateAgent,
  searchAvailableUsersForAgent,
} from "@/lib/super-agent.functions";

interface AddSubordinateAgentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddSubordinateAgentModal({
  isOpen,
  onClose,
  onSuccess,
}: AddSubordinateAgentModalProps) {
  const qc = useQueryClient();
  const addAgent = useServerFn(addSubordinateAgent);
  const searchUsers = useServerFn(searchAvailableUsersForAgent);

  const [selectedUser, setSelectedUser] = useState<{
    id: string;
    fullName: string;
    phone: string | null;
  } | null>(null);
  const [commissionPercent, setCommissionPercent] = useState<string>("0.5");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: usersData, isLoading: isLoadingUsers } = useQuery({
    queryKey: ["available-users-for-agent"],
    queryFn: () => searchUsers(),
    enabled: isOpen,
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

  const handleSave = async () => {
    if (!selectedUser) {
      toast.error("Por favor selecciona un usuario para agregarlo a tu red.");
      return;
    }

    const commNum = Number(commissionPercent);
    if (isNaN(commNum) || commNum <= 0 || commNum > 5) {
      toast.error("La comisión para el Super Agente debe ser entre 0.1% y 5%.");
      return;
    }

    setIsSubmitting(true);
    try {
      await addAgent({
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
      qc.invalidateQueries({ queryKey: ["admin-users-list"] });
      setSelectedUser(null);
      setSearchQuery("");
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo agregar el agente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Sparkles className="size-5 text-indigo-600" />
            Adicionar Agente a mi Red
          </DialogTitle>
          <DialogDescription>
            Selecciona un cliente para promoverlo a tu red de agentes. Recibirás una comisión automática por cada transacción que este agente procese.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Comisión de Red */}
          <div className="space-y-2 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 p-4">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-indigo-950 uppercase tracking-wider flex items-center gap-1.5">
                <Percent className="size-3.5 text-indigo-600" />
                Tu Comisión por cada Transacción del Agente
              </Label>
              <Badge className="bg-indigo-600 text-white font-bold text-xs">
                {commissionPercent}%
              </Badge>
            </div>
            <p className="text-xs text-indigo-800 leading-snug">
              Porcentaje que se acreditará a tu cuenta por cada envío en efectivo que este agente realice.
            </p>
            <div className="flex items-center gap-2 pt-1">
              {["0.3", "0.5", "0.8", "1.0", "1.5"].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => setCommissionPercent(pct)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${
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
                  className="h-8 text-xs bg-white border-indigo-200 font-bold text-indigo-950 text-right pr-6"
                />
                <span className="absolute right-2 top-2 text-xs font-bold text-indigo-400">
                  %
                </span>
              </div>
            </div>
          </div>

          {/* Buscador de Usuarios */}
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

            <div className="border border-border rounded-xl max-h-56 overflow-y-auto divide-y divide-border/60">
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
                    className={`w-full p-3 flex items-center justify-between text-left transition-colors cursor-pointer ${
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
          </div>

          {selectedUser && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-xs text-emerald-950 flex items-start gap-2.5">
              <ShieldCheck className="size-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">
                  {selectedUser.fullName} se activará como Agente en tu red
                </p>
                <p className="text-[11px] text-emerald-800 mt-0.5">
                  Podrá operar en ventanilla y tú recibirás automáticamente el{" "}
                  <strong>{commissionPercent}%</strong> de cada envío procesado.
                </p>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={!selectedUser || isSubmitting}
            className="bg-indigo-700 hover:bg-indigo-800 text-white font-bold gap-2"
          >
            <Sparkles className="size-4" />
            {isSubmitting ? "Asignando..." : "Asignar Agente a mi Red"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
