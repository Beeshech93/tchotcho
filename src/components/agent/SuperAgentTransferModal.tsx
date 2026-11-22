import { useState, useId } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wallet,
  ArrowRight,
  AlertTriangle,
  Banknote,
  Smartphone,
  CheckCircle2,
  Send,
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
  superAgentTransferBalanceToSubordinate,
  type SubordinateAgentRecord,
} from "@/lib/super-agent.functions";

interface SuperAgentTransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  agent: SubordinateAgentRecord | null;
  superTransfersBalance: number;
  superTopupsBalance: number;
  isAdmin: boolean;
  onSuccess?: () => void;
}

const QUICK_AMOUNTS = [1000, 2500, 5000, 10000, 25000, 50000];

export function SuperAgentTransferModal({
  isOpen,
  onClose,
  agent,
  superTransfersBalance,
  superTopupsBalance,
  isAdmin,
  onSuccess,
}: SuperAgentTransferModalProps) {
  const qc = useQueryClient();
  const transferBalance = useServerFn(superAgentTransferBalanceToSubordinate);

  const [walletType, setWalletType] = useState<"transfers" | "topups">("transfers");
  const [amount, setAmount] = useState<string>("5000");
  const [note, setNote] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const amountId = useId();
  const noteId = useId();

  if (!agent) return null;

  const currentSuperBalance = walletType === "topups" ? superTopupsBalance : superTransfersBalance;
  const agentCurrentBalance = walletType === "topups" ? agent.balanceTopupsHTG : agent.balanceHTG;
  const numAmount = Number(amount) || 0;

  const hasInsufficientBalance = !isAdmin && (currentSuperBalance <= 0 || numAmount > currentSuperBalance);
  const expectedSuperRemainder = isAdmin ? 999999999 : Math.max(0, currentSuperBalance - numAmount);
  const expectedAgentNewBal = agentCurrentBalance + numAmount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0) {
      toast.error("Por favor ingresa un monto válido mayor a 0 HTG.");
      return;
    }

    if (!isAdmin && numAmount > currentSuperBalance) {
      toast.error(
        `Saldo insuficiente en tu billetera. Solo dispones de ${currentSuperBalance.toLocaleString()} HTG. Como Super Agente, no puedes recargar a tus agentes sin saldo suficiente.`,
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await transferBalance({
        data: {
          targetUserId: agent.id,
          amount: numAmount,
          walletType,
          note: note.trim() || undefined,
        },
      });

      if (res.ok) {
        toast.success(res.message);
        void qc.invalidateQueries({ queryKey: ["my-subordinate-agents"] });
        void qc.invalidateQueries({ queryKey: ["subordinate-transactions"] });
        void qc.invalidateQueries({ queryKey: ["wallets"] });
        void qc.invalidateQueries({ queryKey: ["agent-wallet-txs"] });
        onSuccess?.();
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al recargar saldo al agente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-100 text-emerald-800 grid place-items-center shrink-0">
              <Send className="size-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900">
                Recargar Saldo a Agente
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Transfiere saldo operativo a {agent.fullName}. El monto se descontará de tu saldo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Resumen del Agente Destinatario */}
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/60 p-3 text-xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-indigo-950 text-sm">{agent.fullName}</span>
            <span className="bg-indigo-200/80 text-indigo-900 font-bold px-2 py-0.5 rounded-full text-[10px]">
              {agent.commissionPercent}% Comisión
            </span>
          </div>
          <p className="text-indigo-800/80 font-mono text-[11px]">{agent.phone || "Sin teléfono"}</p>
          <div className="flex items-center gap-2 pt-1 font-semibold text-slate-700">
            <span>Saldo Envíos: <strong className="text-emerald-800">{agent.balanceHTG.toLocaleString()} HTG</strong></span>
            <span>·</span>
            <span>Saldo Recargas: <strong className="text-cyan-800">{agent.balanceTopupsHTG.toLocaleString()} HTG</strong></span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Selector de Billetera a Recargar */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Billetera a Recargar
            </Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWalletType("transfers")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  walletType === "transfers"
                    ? "border-emerald-600 bg-emerald-50/80 text-emerald-950 ring-2 ring-emerald-500/30"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Banknote className="size-4 text-emerald-700" />
                  <span className="font-bold text-xs">Envíos de Dinero</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">MonCash / NatCash</p>
                <p className="text-xs font-black text-emerald-800 mt-1">
                  Tu saldo: {isAdmin ? "Ilimitado" : `${superTransfersBalance.toLocaleString()} HTG`}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWalletType("topups")}
                className={`p-3 rounded-xl border text-left transition-all ${
                  walletType === "topups"
                    ? "border-cyan-600 bg-cyan-50/80 text-cyan-950 ring-2 ring-cyan-500/30"
                    : "border-slate-200 hover:border-slate-300 text-slate-700 bg-white"
                }`}
              >
                <div className="flex items-center gap-2">
                  <Smartphone className="size-4 text-cyan-700" />
                  <span className="font-bold text-xs">Recargas Telefónicas</span>
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Digicel / Natcom</p>
                <p className="text-xs font-black text-cyan-800 mt-1">
                  Tu saldo: {isAdmin ? "Ilimitado" : `${superTopupsBalance.toLocaleString()} HTG`}
                </p>
              </button>
            </div>
          </div>

          {/* Advertencia si el Super Agente no tiene saldo */}
          {!isAdmin && currentSuperBalance <= 0 && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-red-950 flex items-start gap-2.5">
              <AlertTriangle className="size-5 text-red-600 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">Sin saldo disponible en esta billetera</p>
                <p className="text-red-800 mt-0.5">
                  Como Super Agente, no puedes recargar a los agentes de tu red si no tienes saldo suficiente. Contacta a un administrador para recargar tu cuenta.
                </p>
              </div>
            </div>
          )}

          {/* Input de Monto */}
          <div className="space-y-1.5">
            <Label htmlFor={amountId} className="text-xs font-bold text-slate-700">
              Monto a transferir (HTG)
            </Label>
            <div className="relative">
              <Input
                id={amountId}
                type="number"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej. 5000"
                className="text-lg font-black pl-3 pr-16 h-11"
                disabled={isSubmitting || (!isAdmin && currentSuperBalance <= 0)}
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                HTG
              </span>
            </div>

            {/* Botones de Montos Rápidos */}
            <div className="flex flex-wrap gap-1.5 pt-1">
              {QUICK_AMOUNTS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setAmount(String(amt))}
                  disabled={!isAdmin && amt > currentSuperBalance}
                  className={`text-[11px] font-bold px-2 py-1 rounded-lg border transition ${
                    amount === String(amt)
                      ? "border-emerald-600 bg-emerald-600 text-white"
                      : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:pointer-events-none"
                  }`}
                >
                  +{amt.toLocaleString()}
                </button>
              ))}
            </div>
          </div>

          {/* Desglose de Impacto de Saldo */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-1.5 text-xs">
            <div className="flex justify-between items-center text-slate-600">
              <span>Tu saldo actual:</span>
              <span className="font-bold text-slate-800">
                {isAdmin ? "Ilimitado" : `${currentSuperBalance.toLocaleString()} HTG`}
              </span>
            </div>
            <div className="flex justify-between items-center text-red-600 font-semibold">
              <span>Monto a debitar de tu saldo:</span>
              <span>-{numAmount.toLocaleString()} HTG</span>
            </div>
            {!isAdmin && (
              <div className="flex justify-between items-center text-slate-700 pt-1 border-t border-slate-200">
                <span>Tu saldo resultante:</span>
                <span className={`font-black ${hasInsufficientBalance ? "text-red-600" : "text-emerald-800"}`}>
                  {expectedSuperRemainder.toLocaleString()} HTG
                </span>
              </div>
            )}
            <div className="flex justify-between items-center text-indigo-900 pt-1 border-t border-slate-200">
              <span>Nuevo saldo del agente ({agent.fullName.split(" ")[0]}):</span>
              <span className="font-black text-indigo-800">
                {expectedAgentNewBal.toLocaleString()} HTG
              </span>
            </div>
          </div>

          {/* Nota Opcional */}
          <div className="space-y-1.5">
            <Label htmlFor={noteId} className="text-xs text-slate-600 font-medium">
              Nota o motivo (opcional)
            </Label>
            <Input
              id={noteId}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ej. Asignación de saldo para el fin de semana"
              maxLength={120}
              className="text-xs h-9"
              disabled={isSubmitting}
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full sm:w-auto text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || hasInsufficientBalance || numAmount <= 0}
              className="w-full sm:w-auto bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold text-xs shadow-sm gap-2"
            >
              {isSubmitting ? (
                <span>Procesando...</span>
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  <span>Transferir {numAmount > 0 ? `${numAmount.toLocaleString()} HTG` : "Saldo"}</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
