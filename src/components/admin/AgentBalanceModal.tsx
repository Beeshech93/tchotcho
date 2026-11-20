import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Coins, Plus, Wallet, ShieldAlert, CheckCircle2, History, Banknote, Smartphone, Send } from "lucide-react";
import { AgentBalanceHistoryModal } from "@/components/admin/AgentBalanceHistoryModal";
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
import { adminAdjustAgentBalance, getAgentWallets } from "@/lib/agent-wallet.functions";

interface AgentBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
  } | null;
  onSuccess?: () => void;
}

const QUICK_AMOUNTS = [1000, 5000, 10000, 25000, 50000];

export function AgentBalanceModal({ isOpen, onClose, user, onSuccess }: AgentBalanceModalProps) {
  const qc = useQueryClient();
  const adjustBalance = useServerFn(adminAdjustAgentBalance);
  const fetchWallets = useServerFn(getAgentWallets);

  const [walletType, setWalletType] = useState<"transfers" | "topups">("transfers");
  const [amount, setAmount] = useState<string>("5000");
  const [description, setDescription] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [userWallets, setUserWallets] = useState<Array<{ currency: string; balance: number }>>([]);
  const [isLoadingWallets, setIsLoadingWallets] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);

  useEffect(() => {
    if (user?.id && isOpen) {
      setIsLoadingWallets(true);
      fetchWallets({ data: { userId: user.id } })
        .then((w) => setUserWallets(w as any))
        .catch(() => setUserWallets([]))
        .finally(() => setIsLoadingWallets(false));
    }
  }, [user?.id, isOpen, fetchWallets]);

  if (!user) return null;

  const transfersWallet = userWallets.find((w) => w.currency === "HTG");
  const topupsWallet = userWallets.find((w) => w.currency === "HTG_RECARGAS");
  const transfersBalance = transfersWallet ? Number(transfersWallet.balance) : 0;
  const topupsBalance = topupsWallet ? Number(topupsWallet.balance) : 0;

  const currentBalance = walletType === "topups" ? topupsBalance : transfersBalance;
  const numAmount = Number(amount) || 0;
  const expectedNewBalance = Math.max(0, currentBalance + numAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numAmount || numAmount <= 0) {
      toast.error("Por favor ingresa un monto válido mayor a 0.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await adjustBalance({
        data: {
          agentUserId: user.id,
          amount: numAmount,
          currency: "HTG",
          walletType,
          description: description.trim() || undefined,
        },
      });

      if (res.ok) {
        toast.success(res.message);
        qc.invalidateQueries({ queryKey: ["admin-profiles"] });
        qc.invalidateQueries({ queryKey: ["wallets"] });
        qc.invalidateQueries({ queryKey: ["admin-wallets"] });
        qc.invalidateQueries({ queryKey: ["admin-users-list"] });
        if (onSuccess) onSuccess();
        onClose();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al adicionar saldo");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md bg-[#101713] border-white/10 text-white">
        <DialogHeader>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="grid size-9 place-items-center rounded-xl bg-emerald-500/15 border border-emerald-500/30">
              <Coins className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-bold text-white">
                Billeteras de Agente · Asignar Saldo
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-300">
                Selecciona la billetera específica (Envíos de Dinero o Recargas) para recargar saldo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Tarjeta de Información del Usuario */}
          <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Agente:</span>
              <span className="font-bold text-white">{user.full_name || "Sin nombre"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400 font-medium">Teléfono:</span>
              <span className="font-semibold text-emerald-300">{user.phone || "Sin teléfono"}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-1 border-t border-white/10">
              <span className="text-slate-400 font-medium">Historial de movimientos:</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpenHistory(true)}
                className="h-6 px-2 text-[11px] text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 gap-1"
              >
                <History className="size-3" />
                Ver Historial Completo
              </Button>
            </div>
          </div>

          {/* Selector de Billetera a Acreditar (Envíos vs Recargas) */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-300 font-bold">Selecciona la Billetera a Acreditar</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWalletType("transfers")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  walletType === "transfers"
                    ? "border-emerald-500 bg-emerald-500/15 ring-2 ring-emerald-500/30"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs">
                    <Banknote className="size-4" />
                    <span>Envíos de Dinero</span>
                  </div>
                  {walletType === "transfers" && <span className="size-2 rounded-full bg-emerald-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">Remesas MonCash / NatCash</p>
                <p className="text-sm font-extrabold text-[#F2AC00] mt-1.5">
                  {isLoadingWallets ? "..." : `${transfersBalance.toLocaleString()} HTG`}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWalletType("topups")}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  walletType === "topups"
                    ? "border-cyan-500 bg-cyan-500/15 ring-2 ring-cyan-500/30"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold text-xs">
                    <Smartphone className="size-4" />
                    <span>Recargas Haití</span>
                  </div>
                  {walletType === "topups" && <span className="size-2 rounded-full bg-cyan-400" />}
                </div>
                <p className="text-[10px] text-slate-400 mt-1">DingConnect / Telefonía</p>
                <p className="text-sm font-extrabold text-[#F2AC00] mt-1.5">
                  {isLoadingWallets ? "..." : `${topupsBalance.toLocaleString()} HTG`}
                </p>
              </button>
            </div>
          </div>

          {/* Campo de Monto a Acreditar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-300 font-semibold">
                Monto a Acreditar ({walletType === "topups" ? "Billetera Recargas" : "Billetera Envíos"})
              </Label>
              <span className="text-[11px] text-slate-400">
                Saldo actual: <strong className="text-white">{currentBalance.toLocaleString()} HTG</strong>
              </span>
            </div>
            <div className="relative">
              <Input
                type="number"
                min="1"
                step="any"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej. 10000"
                className="bg-black/40 border-white/15 text-white font-bold pl-3 pr-14"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-400">
                HTG
              </span>
            </div>
          </div>

          {/* Botones de Monto Rápido */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-400">Montos rápidos sugeridos</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String(val))}
                  className="rounded-lg bg-white/[0.06] hover:bg-emerald-500/20 border border-white/10 hover:border-emerald-500/40 px-2.5 py-1 text-xs font-semibold text-slate-200 transition cursor-pointer"
                >
                  +{val.toLocaleString()} HTG
                </button>
              ))}
            </div>
          </div>

          {/* Concepto / Nota */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-300">Nota / Motivo (Opcional)</Label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Ej. Asignación de saldo para ${walletType === "topups" ? "recargas DingConnect" : "remesas MonCash"}`}
              className="bg-black/40 border-white/15 text-white text-xs"
              maxLength={150}
            />
          </div>

          {/* Vista previa del nuevo balance */}
          <div className="rounded-xl bg-emerald-950/30 border border-emerald-500/30 p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              <span className="text-xs text-emerald-200 font-medium">
                Nuevo balance estimado ({walletType === "topups" ? "Recargas" : "Envíos"}):
              </span>
            </div>
            <span className="text-sm font-black text-emerald-400">
              {expectedNewBalance.toLocaleString()} HTG
            </span>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isSubmitting}
              className="text-slate-400 hover:text-white"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || numAmount <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-2"
            >
              <Coins className="size-4" />
              {isSubmitting
                ? "Acreditando..."
                : `Acreditar +${numAmount ? numAmount.toLocaleString() : ""} HTG`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>

    {openHistory && (
      <AgentBalanceHistoryModal
        isOpen={openHistory}
        onClose={() => setOpenHistory(false)}
        agentUser={user}
      />
    )}
    </>
  );
}
