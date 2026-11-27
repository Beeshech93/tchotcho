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
import { getCountryInfoFromPhone } from "@/lib/phone";

interface AgentBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
    roles?: string[];
    parentSuperAgentName?: string | null;
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
  const [selectedCurrency, setSelectedCurrency] = useState<string>("");

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

  const countryInfo = getCountryInfoFromPhone(user.phone, (user as any).country);
  const agentCurrency = countryInfo.currency;

  const activeCurrency =
    walletType === "topups" ? "HTG" : selectedCurrency || agentCurrency;

  const transfersWallet =
    userWallets.find((w) => w.currency === activeCurrency) ||
    userWallets.find((w) => w.currency === agentCurrency);
  const topupsWallet = userWallets.find((w) => w.currency === "HTG_RECARGAS");

  const transfersBalance =
    transfersWallet != null
      ? Number(transfersWallet.balance)
      : activeCurrency === agentCurrency
        ? Number((user as any).balanceHTG) || 0
        : 0;
  const topupsBalance =
    topupsWallet != null
      ? Number(topupsWallet.balance)
      : Number((user as any).balanceTopupsHTG) || 0;

  const isAgentOrSuper =
    user.roles?.includes("agent") ||
    user.roles?.includes("super_agent") ||
    Boolean(user.parentSuperAgentName);
  const isClient = !isAgentOrSuper && (user.roles?.includes("client") || !user.roles?.length);

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
          currency: activeCurrency,
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
      <DialogContent className="max-w-md bg-white border-2 border-slate-200 text-slate-900 shadow-2xl rounded-3xl">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-emerald-700">
            <span className="grid size-10 place-items-center rounded-xl bg-emerald-50 border-2 border-emerald-200 text-emerald-700 shadow-2xs">
              <Coins className="size-5" />
            </span>
            <div>
              <DialogTitle className="text-lg font-black text-slate-900">
                Billeteras de Agente · Asignar Saldo
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 font-medium">
                Selecciona la billetera específica (Envíos de Dinero o Recargas) para recargar saldo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {/* Alerta si es cuenta cliente */}
          {isClient && (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-3 text-emerald-950 flex items-start gap-2.5 shadow-2xs">
              <ShieldAlert className="size-4 text-emerald-700 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold text-emerald-900">Cuenta de tipo Cliente</p>
                <p className="text-emerald-800 text-[11px] mt-0.5">
                  Al acreditar saldo operativo, este usuario se convertirá automáticamente en Agente autorizado para operar envíos de inmediato.
                </p>
              </div>
            </div>
          )}

          {/* Información de Red si pertenece a un Super Agente */}
          {user.parentSuperAgentName && !user.roles?.includes("super_agent") && (
            <div className="rounded-2xl border-2 border-purple-200 bg-purple-50/70 p-3 text-purple-950 flex items-start gap-2.5 shadow-2xs">
              <ShieldAlert className="size-4 text-purple-700 shrink-0 mt-0.5" />
              <div className="text-xs">
                <p className="font-bold">
                  Agente en red de: <span className="font-extrabold text-purple-900">{user.parentSuperAgentName}</span>
                </p>
                <p className="text-purple-800 text-[11px] mt-0.5">
                  Como administrador, puedes adicionar saldo directamente a este agente, o su Super Agente puede transferirle saldo desde su panel.
                </p>
              </div>
            </div>
          )}

          {/* Tarjeta de Información del Usuario */}
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3.5 space-y-2 shadow-2xs">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-bold">Agente:</span>
              <span className="font-extrabold text-slate-900">{user.full_name || "Sin nombre"}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-bold">Teléfono:</span>
              <span className="font-extrabold text-emerald-700">{user.phone || "Sin teléfono"}</span>
            </div>
            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200">
              <span className="text-slate-600 font-medium">Historial de movimientos:</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setOpenHistory(true)}
                className="h-7 px-2.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-100/70 gap-1 rounded-lg"
              >
                <History className="size-3.5" />
                Ver Historial Completo
              </Button>
            </div>
          </div>

          {/* Selector de Billetera a Acreditar (Envíos vs Recargas) */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-800 font-extrabold">Selecciona la Billetera a Acreditar</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setWalletType("transfers")}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-2xs ${
                  walletType === "transfers"
                    ? "border-emerald-600 bg-emerald-50/90 ring-2 ring-emerald-500/20"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-emerald-800 font-black text-xs">
                    <Banknote className="size-4 text-emerald-700" />
                    <span>Envíos ({countryInfo.flag} {agentCurrency})</span>
                  </div>
                  {walletType === "transfers" && <span className="size-2 rounded-full bg-emerald-600 ring-2 ring-emerald-300" />}
                </div>
                <p className="text-[10px] text-slate-600 font-medium mt-1">Saldo en {countryInfo.name}</p>
                <p className="text-base font-black text-emerald-800 mt-1.5">
                  {isLoadingWallets ? "..." : `${transfersBalance.toLocaleString()} ${transfersWallet?.currency || agentCurrency}`}
                </p>
              </button>

              <button
                type="button"
                onClick={() => setWalletType("topups")}
                className={`p-3 rounded-2xl border-2 text-left transition-all cursor-pointer shadow-2xs ${
                  walletType === "topups"
                    ? "border-cyan-600 bg-cyan-50/90 ring-2 ring-cyan-500/20"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-cyan-800 font-black text-xs">
                    <Smartphone className="size-4 text-cyan-700" />
                    <span>Recargas Haití</span>
                  </div>
                  {walletType === "topups" && <span className="size-2 rounded-full bg-cyan-600 ring-2 ring-cyan-300" />}
                </div>
                <p className="text-[10px] text-slate-600 font-medium mt-1">DingConnect / Telefonía</p>
                <p className="text-base font-black text-cyan-800 mt-1.5">
                  {isLoadingWallets ? "..." : `${topupsBalance.toLocaleString()} HTG`}
                </p>
              </button>
            </div>

            {/* Selector de Moneda de Operación para Billetera de Envíos */}
            {walletType === "transfers" && (
              <div className="pt-1 space-y-1">
                <span className="text-[11px] font-bold text-slate-600 block">
                  Moneda a acreditar:
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { cur: agentCurrency, label: `${countryInfo.flag} ${agentCurrency} (${countryInfo.name})` },
                    ...(agentCurrency !== "DOP" ? [{ cur: "DOP", label: "🇩🇴 DOP" }] : []),
                    ...(agentCurrency !== "MXN" ? [{ cur: "MXN", label: "🇲🇽 MXN" }] : []),
                    ...(agentCurrency !== "USD" ? [{ cur: "USD", label: "🇺🇸 USD" }] : []),
                    ...(agentCurrency !== "CLP" ? [{ cur: "CLP", label: "🇨🇱 CLP" }] : []),
                    ...(agentCurrency !== "HTG" ? [{ cur: "HTG", label: "🇭🇹 HTG" }] : []),
                  ].map((item) => (
                    <button
                      key={item.cur}
                      type="button"
                      onClick={() => setSelectedCurrency(item.cur)}
                      className={`px-2 py-0.5 rounded-lg text-xs font-bold transition border cursor-pointer ${
                        activeCurrency === item.cur
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                          : "bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-200"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Campo de Monto a Acreditar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-slate-800 font-extrabold">
                Monto a Acreditar ({walletType === "topups" ? "Billetera Recargas (HTG)" : `Billetera Envíos (${activeCurrency})`})
              </Label>
              <span className="text-[11px] text-slate-600 font-medium">
                Saldo actual: <strong className="text-slate-900 font-black">{currentBalance.toLocaleString()} {activeCurrency}</strong>
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
                className="bg-white border-2 border-slate-300 focus:border-emerald-600 text-slate-900 font-black text-base rounded-xl pl-3 pr-16"
                required
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-black text-emerald-700">
                {activeCurrency}
              </span>
            </div>
          </div>

          {/* Botones de Monto Rápido */}
          <div className="space-y-1.5">
            <Label className="text-[11px] text-slate-600 font-bold">Montos rápidos sugeridos</Label>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setAmount(String(val))}
                  className="rounded-xl bg-slate-100 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 px-2.5 py-1 text-xs font-bold text-slate-800 hover:text-emerald-800 transition cursor-pointer"
                >
                  +{val.toLocaleString()} {activeCurrency}
                </button>
              ))}
            </div>
          </div>

          {/* Concepto / Nota */}
          <div className="space-y-1.5">
            <Label className="text-xs text-slate-700 font-semibold">Nota / Motivo (Opcional)</Label>
            <Input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={`Ej. Asignación de saldo para ${walletType === "topups" ? "recargas DingConnect" : "remesas MonCash"}`}
              className="bg-white border-2 border-slate-300 text-slate-900 text-xs rounded-xl"
              maxLength={150}
            />
          </div>

          {/* Vista previa del nuevo balance */}
          <div className="rounded-2xl bg-emerald-50 border-2 border-emerald-300 p-3.5 flex items-center justify-between shadow-2xs">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-700 shrink-0" />
              <span className="text-xs text-emerald-950 font-bold">
                Nuevo balance estimado ({walletType === "topups" ? "Recargas" : "Envíos"}):
              </span>
            </div>
            <span className="text-base font-black text-emerald-800">
              {expectedNewBalance.toLocaleString()} {activeCurrency}
            </span>
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
              className="border-2 border-slate-200 text-slate-700 hover:bg-slate-100 font-bold rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || numAmount <= 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black gap-2 rounded-xl shadow-md disabled:opacity-50"
            >
              <Coins className="size-4" />
              {isSubmitting
                ? "Acreditando..."
                : `Acreditar +${numAmount ? numAmount.toLocaleString() : ""} ${activeCurrency}`}
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
