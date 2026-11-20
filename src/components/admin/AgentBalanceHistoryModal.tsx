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
  const [typeFilter, setTypeFilter] = useState<"all" | "deposit" | "deduct">("all");

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
      if (typeFilter === "deposit" && item.amount <= 0) return false;
      if (typeFilter === "deduct" && item.amount >= 0) return false;

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
  }, [items, search, currencyFilter, typeFilter]);

  // Estadísticas rápidas
  const totalDeposited = useMemo(() => {
    return filteredItems
      .filter((i) => i.amount > 0)
      .reduce((acc, curr) => acc + curr.amount, 0);
  }, [filteredItems]);

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
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-xl flex items-center gap-2">
                <History className="size-5 text-primary" />
                <span>
                  {agentUser
                    ? `Historial de Saldo: ${agentUser.full_name || "Agente"}`
                    : "Historial de Adición de Saldo a Agentes"}
                </span>
              </DialogTitle>
              <DialogDescription className="text-xs">
                {agentUser
                  ? `Registro de todas las recargas y ajustes recibidos por ${agentUser.full_name || agentUser.phone}.`
                  : "Auditoría de todos los abonos y ajustes de saldo operativo otorgados a las cuentas de agentes."}
              </DialogDescription>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Actualizar datos"
            >
              <RefreshCw className={`size-4 ${isFetching ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </DialogHeader>

        {/* Resumen rápido */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 my-3">
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Total Operaciones
            </p>
            <p className="text-xl font-bold mt-0.5">{filteredItems.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
            <p className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider">
              Total Abonado
            </p>
            <p className="text-xl font-bold text-emerald-400 mt-0.5">
              +{totalDeposited.toLocaleString()}
            </p>
          </div>
          <div className="rounded-xl border border-border/40 bg-card p-3 col-span-2 sm:col-span-1">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
              Monedas
            </p>
            <div className="flex flex-wrap gap-1 mt-1">
              {uniqueCurrencies.length > 0 ? (
                uniqueCurrencies.map((c) => (
                  <Badge key={c} variant="outline" className="text-xs py-0 px-1.5">
                    {c}
                  </Badge>
                ))
              ) : (
                <span className="text-xs text-muted-foreground">HTG</span>
              )}
            </div>
          </div>
        </div>

        {/* Filtros */}
        <div className="grid gap-2 sm:grid-cols-[1fr_130px_130px] my-1">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder={agentUser ? "Buscar por nota o monto..." : "Buscar por agente, nota o monto..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
          <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los tipos</SelectItem>
              <SelectItem value="deposit">Solo Abonos (+)</SelectItem>
              <SelectItem value="deduct">Solo Ajustes (-)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={currencyFilter} onValueChange={setCurrencyFilter}>
            <SelectTrigger className="h-9 text-xs">
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
            <div className="text-center py-10 text-muted-foreground text-xs">
              Cargando historial de adiciones...
            </div>
          )}

          {!isLoading && filteredItems.length === 0 && (
            <div className="text-center py-12 border rounded-xl border-dashed">
              <Coins className="size-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium text-foreground">
                No hay registros de adición de saldo
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {search || typeFilter !== "all" || currencyFilter !== "all"
                  ? "Intenta modificar los filtros de búsqueda."
                  : "Aún no se han registrado abonos a cuentas de agentes."}
              </p>
            </div>
          )}

          {!isLoading &&
            filteredItems.map((item) => {
              const isPositive = item.amount > 0;
              return (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/60 p-3 hover:bg-card/80 transition-colors"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className={`size-8 rounded-lg grid place-items-center shrink-0 mt-0.5 ${
                        isPositive
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
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
                          <span className="font-semibold text-sm text-foreground flex items-center gap-1">
                            <UserCheck className="size-3.5 text-primary" />
                            {item.agentName}
                          </span>
                        )}
                        {item.agentPhone && !agentUser && (
                          <span className="text-xs text-muted-foreground font-mono">
                            ({item.agentPhone})
                          </span>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            isPositive
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 text-[10px]"
                              : "bg-amber-500/10 text-amber-400 border-amber-500/30 text-[10px]"
                          }
                        >
                          {isPositive ? "Abono de saldo" : "Ajuste de saldo"}
                        </Badge>
                      </div>

                      <p className="text-xs text-muted-foreground break-words">
                        {item.description || "Sin notas adicionales"}
                      </p>

                      <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                        <Calendar className="size-3" />
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-base font-bold font-mono ${
                        isPositive ? "text-emerald-400" : "text-amber-400"
                      }`}
                    >
                      {isPositive ? `+${item.amount.toLocaleString()}` : item.amount.toLocaleString()}{" "}
                      <span className="text-xs font-semibold">{item.currency}</span>
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
