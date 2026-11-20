import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  History,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  UserCheck,
  Coins,
  RefreshCw,
  Wallet,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getAgentBalanceHistory,
  type AgentBalanceHistoryItem,
} from "@/lib/agent-wallet.functions";

interface AgentBalanceHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Si se provee, filtra solo para este agente; si es nulo, muestra de todos los agentes.
  agentUser?: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
  } | null;
}

export function AgentBalanceHistoryModal({
  isOpen,
  onClose,
  agentUser,
}: AgentBalanceHistoryModalProps) {
  const fetchHistory = useServerFn(getAgentBalanceHistory);
  const [search, setSearch] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState("all");

  const { data: items, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["agent-balance-history", agentUser?.id],
    queryFn: () =>
      fetchHistory({
        data: {
          ...(agentUser?.id ? { agentUserId: agentUser.id } : {}),
          limit: 200,
        },
      }),
    enabled: isOpen,
  });

  const filteredItems = useMemo(() => {
    return (items ?? []).filter((item) => {
      if (currencyFilter !== "all" && item.currency !== currencyFilter) return false;

      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        item.agentName.toLowerCase().includes(q) ||
        item.agentPhone.toLowerCase().includes(q) ||
        item.agentEmail.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q) ||
        String(item.amount).includes(q)
      );
    });
  }, [items, search, currencyFilter]);

  const uniqueCurrencies = useMemo(() => {
    return Array.from(new Set((items ?? []).map((i) => i.currency))).filter(Boolean);
  }, [items]);

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString("es-ES", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 bg-white border-2 border-slate-200 text-slate-900 shadow-2xl rounded-3xl">
        <DialogHeader className="pb-3 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl font-black flex items-center gap-2 text-slate-900">
                <History className="size-5 text-emerald-700" />
                <span>
                  {agentUser
                    ? `Historial de Saldo: ${agentUser.full_name || "Agente"}`
                    : "Historial de Asignación de Saldo a Agentes"}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-600 font-medium">
                {agentUser
                  ? `Registro de todas las recargas y ajustes recibidos por ${agentUser.full_name || agentUser.phone}.`
                  : "Auditoría de asignaciones y ajustes de saldo operativo otorgados a las cuentas de agentes."}
              </DialogDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Actualizar datos"
              className="border-2 border-slate-200 text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Resumen rápido */}
        <div className="grid grid-cols-2 gap-3 my-3">
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-3.5 shadow-2xs">
            <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
              Total Operaciones
            </p>
            <p className="text-2xl font-black text-emerald-950 mt-0.5">{filteredItems.length}</p>
          </div>
          <div className="rounded-2xl border-2 border-slate-200 bg-slate-50 p-3.5 shadow-2xs">
            <p className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              Monedas
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {uniqueCurrencies.length > 0 ? (
                uniqueCurrencies.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs py-0.5 px-2 font-bold bg-white border-2 border-slate-200 text-slate-800">
                    {c}
                  </Badge>
                ))
              ) : (
                <span className="text-xs font-bold text-slate-800">HTG</span>
              )}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid gap-2 sm:grid-cols-[1fr_140px] my-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-500" />
            <Input
              placeholder={agentUser ? "Buscar por nota o monto..." : "Buscar por agente, nota o monto..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-10 text-xs bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-medium"
            />
          </div>
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="h-10 text-xs bg-white border-2 border-slate-300 rounded-xl text-slate-900 font-bold">
              <SelectValue placeholder="Moneda" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {uniqueCurrencies.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Lista de transacciones */}
        <div className="flex-1 overflow-y-auto space-y-2 pr-1 mt-2 min-h-[220px]">
          {isLoading && (
            <div className="text-center py-10 text-slate-600 font-medium text-xs">
              Cargando historial de adiciones...
            </div>
          )}

          {!isLoading && filteredItems.length === 0 && (
            <div className="text-center py-12 border-2 rounded-2xl border-dashed border-slate-200 bg-slate-50/50">
              <Coins className="size-8 mx-auto text-slate-400 mb-2" />
              <p className="text-sm font-bold text-slate-800">
                No hay registros de adición de saldo
              </p>
              <p className="text-xs text-slate-500 mt-1 font-medium">
                {search || currencyFilter !== "all"
                  ? "Intenta modificar los filtros de búsqueda."
                  : "Aún no se han registrado asignaciones de saldo a cuentas de agentes."}
              </p>
            </div>
          )}

          {!isLoading &&
            filteredItems.map((item) => {
              const isPositive = item.amount > 0;
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border-2 border-slate-200 bg-white p-3.5 hover:bg-slate-50/80 transition-colors shadow-2xs"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`size-9 rounded-xl grid place-items-center shrink-0 mt-0.5 ${
                        isPositive
                          ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-200"
                          : "bg-amber-50 text-amber-700 border-2 border-amber-200"
                      }`}
                    >
                      {isPositive ? (
                        <ArrowUpRight className="size-4" />
                      ) : (
                        <ArrowDownLeft className="size-4" />
                      )}
                    </div>

                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        {!agentUser && (
                          <span className="font-extrabold text-sm text-slate-900 flex items-center gap-1">
                            <UserCheck className="size-3.5 text-emerald-700" />
                            {item.agentName}
                          </span>
                        )}
                        {item.agentPhone && !agentUser && (
                          <span className="text-xs text-slate-600 font-mono font-bold">
                            ({item.agentPhone})
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            isPositive
                              ? "bg-emerald-50 text-emerald-800 border-2 border-emerald-200 text-[10px] font-bold"
                              : "bg-amber-50 text-amber-800 border-2 border-amber-200 text-[10px] font-bold"
                          }
                        >
                          {isPositive ? "Asignación de saldo" : "Ajuste de saldo"}
                        </Badge>
                        <Badge
                          variant="outline"
                          className={
                            item.currency === "HTG_RECARGAS"
                              ? "bg-cyan-50 text-cyan-800 border-2 border-cyan-200 text-[10px] font-bold"
                              : "bg-emerald-50 text-emerald-800 border-2 border-emerald-200 text-[10px] font-bold"
                          }
                        >
                          {item.currency === "HTG_RECARGAS" ? "📱 Recargas" : "💸 Envíos"}
                        </Badge>
                      </div>

                      <p className="text-xs text-slate-700 font-medium break-words">
                        {item.description || "Sin notas adicionales"}
                      </p>

                      <p className="text-[11px] text-slate-500 font-semibold flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-base font-black font-mono ${
                        isPositive ? "text-emerald-700" : "text-amber-700"
                      }`}
                    >
                      {isPositive ? `+${item.amount.toLocaleString()}` : item.amount.toLocaleString()}{" "}
                      <span className="text-xs font-bold">
                        {item.currency === "HTG_RECARGAS" ? "HTG" : item.currency}
                      </span>
                    </p>
                  </div>
                </div>
              );
            })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
