import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  XCircle,
  Banknote,
  PlusCircle,
  Search,
  CheckCircle2,
  Clock,
  Coins,
  ShieldCheck,
  Info,
  DollarSign,
  Send,
  Building,
  Wallet,
  Smartphone,
  RefreshCw,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  FileText,
  Sparkles,
  Users,
  UserPlus,
  TrendingUp,
  Trash2,
  Percent,
} from "lucide-react";
import { AddSubordinateAgentModal } from "@/components/agent/AddSubordinateAgentModal";
import {
  getMySubordinateAgents,
  getSubordinateTransactions,
  removeSubordinateAgent,
} from "@/lib/super-agent.functions";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { useWallets } from "@/hooks/useWallet";
import {
  adminCancelTransfer,
  adminConfirmTransfer,
  adminSetTransferStatus,
  agentCreateCashTransfer,
  agentConfirmCashPayment,
} from "@/lib/transfers.functions";
import { dingCreateTopupCheckout } from "@/lib/dingconnect.functions";
import { useCountries, useRate, fallbackRate } from "@/hooks/useCorridors";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import {
  STATUS_LABEL,
  STATUS_TONE,
  deliveryMethods,
  citiesFor,
  quote,
  money,
  shortDate,
  type TransferStatus,
} from "@/lib/remesa";

const ALL_STATUSES: TransferStatus[] = [
  "created",
  "awaiting_payment",
  "paid",
  "processing",
  "ready_for_pickup",
  "completed",
  "cancelled",
];

export const Route = createFileRoute("/_authenticated/agente")({
  head: () => ({
    meta: [
      { title: "Panel de Agente Independiente — Tcho-Tcho" },
      {
        name: "description",
        content: "Ventanilla de transacciones en efectivo y comisiones de agente.",
      },
      { property: "og:title", content: "Panel de Agente Independiente — Tcho-Tcho" },
      {
        property: "og:description",
        content: "Gestión autónoma de transacciones en efectivo y comisiones.",
      },
    ],
  }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return;
  },
  component: Agente,
});

function Agente() {
  const { user, profile, isAdmin, isSuperAgent } = useProfile();
  const qc = useQueryClient();
  const confirmTransfer = useServerFn(adminConfirmTransfer);
  const setStatus = useServerFn(adminSetTransferStatus);
  const cancelTransfer = useServerFn(adminCancelTransfer);
  const createCashTransfer = useServerFn(agentCreateCashTransfer);
  const confirmCashByRef = useServerFn(agentConfirmCashPayment);
  const createTopupCheckout = useServerFn(dingCreateTopupCheckout);

  const { data: countries } = useCountries();
  const { data: wallets } = useWallets();

  const transfersWallet = useMemo(
    () => (wallets ?? []).find((w) => w.currency === "HTG"),
    [wallets],
  );
  const topupsWallet = useMemo(
    () => (wallets ?? []).find((w) => w.currency === "HTG_RECARGAS"),
    [wallets],
  );

  const transfersBalance = Number(transfersWallet?.balance) || 0;
  const topupsBalance = Number(topupsWallet?.balance) || 0;

  const transfersBalanceLabel = `${transfersBalance.toLocaleString()} HTG`;
  const topupsBalanceLabel = `${topupsBalance.toLocaleString()} HTG`;

  // Estados de control para modales
  const [openNewCashModal, setOpenNewCashModal] = useState(false);
  const [openClaimModal, setOpenClaimModal] = useState(false);
  const [openTopupModal, setOpenTopupModal] = useState(false);
  const [openAddAgentModal, setOpenAddAgentModal] = useState(false);
  const [claimReference, setClaimReference] = useState("");
  const [isClaiming, setIsClaiming] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Funciones de servidor para red de Super Agente
  const getSubAgents = useServerFn(getMySubordinateAgents);
  const getSubTxs = useServerFn(getSubordinateTransactions);
  const removeSubAgent = useServerFn(removeSubordinateAgent);

  const { data: subAgentsData, refetch: refetchSubAgents } = useQuery({
    queryKey: ["my-subordinate-agents"],
    queryFn: () => getSubAgents(),
    enabled: Boolean(isSuperAgent || isAdmin),
  });

  const { data: subTxsData, refetch: refetchSubTxs } = useQuery({
    queryKey: ["subordinate-transactions"],
    queryFn: () => getSubTxs(),
    enabled: Boolean(isSuperAgent || isAdmin),
  });

  const handleRemoveAgent = async (agentId: string, agentName: string) => {
    if (!confirm(`¿Estás seguro de desvincular a "${agentName}" de tu red de agentes?`)) return;
    try {
      await removeSubAgent({ data: { targetUserId: agentId } });
      toast.success("Agente desvinculado de tu red.");
      refetchSubAgents();
      refetchSubTxs();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo desvincular al agente.");
    }
  };

  // Formulario de nueva recarga telefónica integrada en el panel
  const [topupPhone, setTopupPhone] = useState("");
  const [topupOperator, setTopupOperator] = useState("Digicel");
  const [topupAmount, setTopupAmount] = useState("250");
  const [isSubmittingTopup, setIsSubmittingTopup] = useState(false);

  // Consultar recargas realizadas por este agente
  const { data: agentTopups, isLoading: isLoadingTopups } = useQuery({
    queryKey: ["agent-topups", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("topups")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  // Consultar movimientos de billetera de este agente
  const {
    data: agentWalletTxs,
    isLoading: isLoadingWalletTxs,
    refetch: refetchWalletTxs,
  } = useQuery({
    queryKey: ["agent-wallet-txs", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
  });

  // Formulario de nueva transacción en efectivo (ventanilla)
  const [originCountry, setOriginCountry] = useState("DO");
  const [destinationCountry] = useState("HT");
  const [recipientName, setRecipientName] = useState("");
  const [recipientPhone, setRecipientPhone] = useState("");
  const [recipientCity, setRecipientCity] = useState("Port-au-Prince");
  const [deliveryMethod, setDeliveryMethod] = useState("moncash");
  const [amountSend, setAmountSend] = useState("");
  const [note, setNote] = useState("");
  const [isSubmittingCash, setIsSubmittingCash] = useState(false);

  // Cotización en tiempo real para la ventanilla en efectivo
  const origins = useMemo(() => (countries ?? []).filter((c) => c.is_origin), [countries]);
  const activeOrigin = useMemo(
    () => origins.find((c) => c.code === originCountry) ?? origins[0],
    [origins, originCountry],
  );
  const sendCur = activeOrigin?.currency ?? "DOP";
  const recvCur = "HTG";

  const { data: corridorRate } = useRate(sendCur, recvCur);
  const effectiveCfg =
    corridorRate && Number(corridorRate.rate) > 0
      ? corridorRate
      : (fallbackRate(sendCur, recvCur) ?? {
          rate: 2.2,
          fee_percent: 2.5,
          fee_fixed: 50,
          agent_commission_percent: 1.0,
        });

  const parsedAmount = Number(amountSend) || 0;
  const q = quote(parsedAmount, effectiveCfg);

  // Cada agente consulta de forma independiente sus transacciones y pendientes en efectivo
  const { data: transfers, isLoading } = useQuery({
    queryKey: ["agent-transfers", user?.id, isAdmin],
    queryFn: async () => {
      let query = supabase.from("transfers").select("*").order("created_at", { ascending: false });

      if (!isAdmin && user?.id) {
        // Un agente independiente ve sus propias operaciones y solicitudes en efectivo pendientes
        query = query.or(
          `agent_id.eq.${user.id},user_id.eq.${user.id},and(status.eq.awaiting_payment,payment_method.eq.cash_agent)`,
        );
      }

      const { data } = await query.limit(100);
      return (data as Row[]) ?? [];
    },
    enabled: Boolean(user?.id),
  });

  const advance = async (id: string, status: TransferStatus, message: string) => {
    try {
      const result = await confirmTransfer({ data: { transferId: id } });
      if (result.ok) {
        toast.success(result.message || message);
        qc.invalidateQueries({ queryKey: ["agent-transfers"] });
      } else {
        toast.error("No se pudo actualizar");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar");
    }
  };

  const changeStage = async (id: string, status: TransferStatus) => {
    try {
      const result = await setStatus({ data: { transferId: id, status } });
      toast.success(result.message);
      qc.invalidateQueries({ queryKey: ["agent-transfers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar la etapa");
    }
  };

  const cancel = async (id: string, reason: string) => {
    try {
      const result = await cancelTransfer({
        data: { transferId: id, reason: reason || undefined },
      });
      toast.success(result.message);
      qc.invalidateQueries({ queryKey: ["agent-transfers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cancelar");
    }
  };

  // Enviar nueva transacción en efectivo (ventanilla)
  const handleCreateCashTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (parsedAmount <= 0) {
      toast.error("Ingresa un monto en efectivo válido.");
      return;
    }
    if (!recipientName.trim()) {
      toast.error("Ingresa el nombre completo del destinatario.");
      return;
    }
    if (!recipientPhone.trim()) {
      toast.error("Ingresa el teléfono del destinatario.");
      return;
    }

    if (deliveryMethod === "moncash" && q.receives > 75000) {
      toast.error("MonCash permite un máximo de 75,000 HTG.");
      return;
    }
    if (deliveryMethod === "natcash" && (q.receives < 3998 || q.receives > 75000)) {
      toast.error("NatCash requiere entre 3,998 y 75,000 HTG.");
      return;
    }

    if (!isAdmin && (transfersBalance <= 0 || q.receives > transfersBalance)) {
      toast.error(
        `Saldo insuficiente en tu Billetera de Envíos de Dinero. Tu saldo actual es de ${transfersBalance.toLocaleString()} HTG y esta operación requiere ${q.receives.toLocaleString()} HTG. Sin saldo no puedes realizar envíos.`,
      );
      return;
    }

    setIsSubmittingCash(true);
    try {
      const res = await createCashTransfer({
        data: {
          originCountry,
          destinationCountry: "HT",
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          recipientCity,
          deliveryMethod,
          amountSend: parsedAmount,
          note: note.trim() || undefined,
        },
      });

      if (res.ok) {
        toast.success(`¡Transacción ${res.reference} cobrada en efectivo exitosamente!`);
        setOpenNewCashModal(false);
        setRecipientName("");
        setRecipientPhone("");
        setAmountSend("");
        setNote("");
        qc.invalidateQueries({ queryKey: ["agent-transfers"] });
        qc.invalidateQueries({ queryKey: ["wallets"] });
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Error al registrar la transacción en efectivo",
      );
    } finally {
      setIsSubmittingCash(false);
    }
  };

  // Cobrar envío existente que un cliente generó con pago en efectivo
  const handleClaimByReference = async (e: React.FormEvent) => {
    e.preventDefault();
    const ref = claimReference.trim();
    if (!ref) {
      toast.error("Ingresa el código de referencia.");
      return;
    }

    setIsClaiming(true);
    try {
      const res = await confirmCashByRef({ data: { reference: ref } });
      if (res.ok) {
        toast.success(res.message);
        setClaimReference("");
        setOpenClaimModal(false);
        qc.invalidateQueries({ queryKey: ["agent-transfers"] });
        qc.invalidateQueries({ queryKey: ["wallets"] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cobrar la referencia");
    } finally {
      setIsClaiming(false);
    }
  };

  // Enviar recarga telefónica DingConnect directamente desde el panel
  const handleCreateTopup = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = topupPhone.trim().replace(/\s+/g, "");
    const formattedPhone = cleanPhone.startsWith("+")
      ? cleanPhone
      : cleanPhone.startsWith("509")
        ? `+${cleanPhone}`
        : `+509${cleanPhone}`;

    const numAmount = Number(topupAmount) || 0;
    if (numAmount <= 0) {
      toast.error("Ingresa un monto válido para la recarga.");
      return;
    }

    if (topupsBalance < numAmount || topupsBalance <= 0) {
      toast.error(
        `Saldo insuficiente en tu Billetera de Recargas. Tu saldo actual es de ${topupsBalance.toLocaleString()} HTG y esta recarga requiere ${numAmount.toLocaleString()} HTG. Sin saldo no puedes realizar envíos.`,
      );
      return;
    }

    setIsSubmittingTopup(true);
    try {
      const sku = topupOperator === "Natcom" ? "NATCOM_HTG" : "DIGICEL_HTG";
      const res = await createTopupCheckout({
        data: {
          skuCode: sku,
          operator: topupOperator,
          countryCode: "HT",
          phone: formattedPhone,
          payAmount: numAmount,
          payCurrency: "HTG",
          topupAmount: numAmount,
          topupCurrency: "HTG",
          paymentMethod: "agent_wallet",
          originCountry: "HT",
        },
      });

      if ((res as any).mode === "direct" || (res as any).reference) {
        toast.success(`¡Recarga enviada con éxito! Ref: ${(res as any).reference}`);
        setOpenTopupModal(false);
        setTopupPhone("");
        setTopupAmount("250");
        qc.invalidateQueries({ queryKey: ["agent-topups"] });
        qc.invalidateQueries({ queryKey: ["wallets"] });
        qc.invalidateQueries({ queryKey: ["agent-wallet-txs"] });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al procesar la recarga");
    } finally {
      setIsSubmittingTopup(false);
    }
  };

  const rows = useMemo(() => transfers ?? [], [transfers]);

  // Filtrado de búsqueda
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter(
      (t) =>
        t.reference.toLowerCase().includes(q) ||
        t.recipient_name.toLowerCase().includes(q) ||
        t.recipient_phone.toLowerCase().includes(q) ||
        t.recipient_city.toLowerCase().includes(q),
    );
  }, [rows, searchQuery]);

  // Mis operaciones como agente independiente
  const myOperations = filteredRows.filter(
    (t) => t.agent_id === user?.id || (isAdmin && t.agent_id),
  );

  // Solicitudes en efectivo pendientes por cobrar en ventanilla
  const pendingCashPickups = filteredRows.filter(
    (t) => t.status === "awaiting_payment" && t.payment_method === "cash_agent",
  );

  // Operaciones activas en proceso
  const activeOperations = myOperations.filter(
    (t) => t.status === "processing" || t.status === "paid" || t.status === "ready_for_pickup",
  );

  // Historial completado
  const completedOperations = myOperations.filter((t) => t.status === "completed");

  // Suma total de efectivo recaudado por este agente
  const totalCashCollected = myOperations
    .filter((t) => t.payment_method === "cash_agent" && t.status !== "cancelled")
    .reduce(
      (acc, t) => {
        const cur = t.send_currency;
        acc[cur] = (acc[cur] ?? 0) + Number(t.total_send ?? 0);
        return acc;
      },
      {} as Record<string, number>,
    );

  const totalCashLabel =
    Object.keys(totalCashCollected).length === 0
      ? "0.00"
      : Object.entries(totalCashCollected)
          .map(([cur, val]) => money(val, cur))
          .join(" · ");

  // Comisiones acumuladas ganadas por este agente
  const commissions = myOperations
    .filter((t) => t.status !== "cancelled")
    .reduce(
      (acc, t) => {
        const cur = t.send_currency;
        acc[cur] = (acc[cur] ?? 0) + Number(t.agent_commission_send ?? 0);
        return acc;
      },
      {} as Record<string, number>,
    );

  const commissionsLabel =
    Object.keys(commissions).length === 0
      ? "0.00"
      : Object.entries(commissions)
          .map(([cur, val]) => money(val, cur))
          .join(" · ");

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Cabecera Principal */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="shrink-0"
            aria-label="Volver al inicio"
          >
            <Link to="/dashboard">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Panel de Agente Independiente</h1>
              {isSuperAgent ? (
                <Badge className="border-2 border-indigo-300 bg-indigo-50 text-indigo-900 font-bold gap-1 shadow-2xs">
                  <Sparkles className="size-3 text-indigo-600" /> Super Agente
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="border-2 border-emerald-300 bg-emerald-50 text-emerald-800 font-bold"
                >
                  Solo Efectivo
                </Badge>
              )}
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Gestión de ventanilla, transacciones en efectivo y comisiones de tu agencia.
            </p>
          </div>
        </div>

        {/* Botones de Acción Rápida (Todo integrado dentro del panel, lado a lado) */}
        <div className="flex flex-row items-center gap-2 overflow-x-auto pb-1 sm:pb-0 sm:overflow-visible">
          {isSuperAgent && (
            <Button
              onClick={() => setOpenAddAgentModal(true)}
              className="gap-2 bg-indigo-700 hover:bg-indigo-800 text-white font-extrabold shadow-sm text-xs sm:text-sm whitespace-nowrap shrink-0 rounded-xl"
            >
              <UserPlus className="size-4" />
              <span>Adicionar Agente</span>
            </Button>
          )}

          <Button
            onClick={() => setOpenNewCashModal(true)}
            className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold shadow-sm text-xs sm:text-sm whitespace-nowrap shrink-0 rounded-xl"
          >
            <PlusCircle className="size-4" />
            <span>Nueva Operación en Efectivo</span>
          </Button>

          <Button
            onClick={() => setOpenTopupModal(true)}
            className="gap-2 bg-sky-700 hover:bg-sky-800 text-white font-extrabold shadow-sm text-xs sm:text-sm whitespace-nowrap shrink-0 rounded-xl"
          >
            <Smartphone className="size-4" />
            <span>Nueva Recarga</span>
          </Button>
        </div>
      </div>

      {/* Resumen de Red para Super Agente */}
      {isSuperAgent && (
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/80 to-blue-50/90 p-4 border-2 border-indigo-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-indigo-600 text-white grid place-items-center shadow-xs shrink-0">
              <Users className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-900">
                Mis Agentes en Red
              </p>
              <p className="text-xl font-black text-indigo-950">
                {subAgentsData?.summary.totalAgents ?? 0}{" "}
                {subAgentsData?.summary.totalAgents === 1 ? "agente" : "agentes"}
              </p>
              <p className="text-[11px] text-indigo-700">Equipos y ventanillas asignadas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-purple-600 text-white grid place-items-center shadow-xs shrink-0">
              <Coins className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-purple-900">
                Comisiones de Red Ganadas
              </p>
              <p className="text-xl font-black text-purple-950">
                +{(subAgentsData?.summary.totalCommissionsHTG ?? 0).toLocaleString()} HTG
              </p>
              <p className="text-[11px] text-purple-700">Por envíos de tus agentes</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="size-11 rounded-xl bg-blue-600 text-white grid place-items-center shadow-xs shrink-0">
              <TrendingUp className="size-5" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-blue-900">
                Volumen Procesado en Red
              </p>
              <p className="text-xl font-black text-blue-950">
                {(subAgentsData?.summary.totalVolumeHTG ?? 0).toLocaleString()} HTG
              </p>
              <p className="text-[11px] text-blue-700">
                {subAgentsData?.summary.totalOperations ?? 0} operaciones liquidadas
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Tarjetas KPI de Rendimiento del Agente (Dos billeteras independientes) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard
          icon={Banknote}
          label="Billetera Envíos de Dinero"
          value={transfersBalanceLabel}
          tone="text-emerald-800 font-black"
          hint="Saldo para remesas MonCash y NatCash"
        />
        <StatCard
          icon={Smartphone}
          label="Billetera Recargas"
          value={topupsBalanceLabel}
          tone="text-cyan-800 font-black"
          hint="Saldo para recargas telefónicas Haití"
        />
        <StatCard
          icon={Banknote}
          label="Efectivo en Ventanilla"
          value={totalCashLabel}
          tone="text-slate-900 font-black"
          hint="Total recaudado en mano"
        />
        <StatCard
          icon={Coins}
          label="Comisiones Ganadas"
          value={commissionsLabel}
          tone="text-emerald-700 font-black"
          hint="Ganancia neta acumulada"
        />
        <StatCard
          icon={Clock}
          label="En Proceso"
          value={String(activeOperations.length)}
          tone="text-amber-700 font-black"
          hint="En entrega o dispersión"
        />
        <StatCard
          icon={CheckCircle2}
          label="Completadas"
          value={String(completedOperations.length)}
          tone="text-emerald-700 font-black"
          hint="Entregadas exitosamente"
        />
      </div>

      {/* Buscador de Envíos */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por referencia (ej. LR-...), nombre o teléfono..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 h-11 bg-card/60"
        />
      </div>

      {/* Pestañas Centralizadas de Todas las Transacciones del Agente */}
      <Tabs defaultValue="my_operations" className="space-y-4">
        <TabsList
          className={`grid w-full ${
            isSuperAgent ? "grid-cols-2 sm:grid-cols-6" : "grid-cols-2 sm:grid-cols-5"
          }`}
        >
          <TabsTrigger value="my_operations">
            Envíos ({myOperations.length})
          </TabsTrigger>
          <TabsTrigger value="topups">
            Recargas ({agentTopups?.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="pending_cash">
            Por Cobrar ({pendingCashPickups.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Comisiones ({completedOperations.length})
          </TabsTrigger>
          <TabsTrigger value="wallets">
            Billeteras ({agentWalletTxs?.length ?? 0})
          </TabsTrigger>
          {isSuperAgent && (
            <TabsTrigger
              value="network"
              className="data-[state=active]:bg-indigo-600 data-[state=active]:text-white font-bold"
            >
              Mi Red ({subAgentsData?.agents.length ?? 0})
            </TabsTrigger>
          )}
        </TabsList>

        {/* Tab 1: Mis Operaciones de Envío de Dinero */}
        <TabsContent value="my_operations" className="space-y-3">
          <Section
            title="Operaciones de Remesas de tu Agencia"
            description="Envíos registrados o cobrados en efectivo por tu punto de atención."
            rows={myOperations}
            advance={advance}
            changeStage={changeStage}
            cancel={cancel}
            isAdmin={isAdmin}
            currentUserId={user?.id}
          />
        </TabsContent>

        {/* Tab 2: Recargas Telefónicas DingConnect de la Agencia */}
        <TabsContent value="topups" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Smartphone className="size-4 text-cyan-700" />
                  <span>Recargas Telefónicas de tu Agencia</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Recargas enviadas a Digicel y Natcom Haití directamente desde tu Billetera de Recargas.
                </CardDescription>
              </div>
              <Button
                size="sm"
                onClick={() => setOpenTopupModal(true)}
                className="gap-1.5 bg-cyan-600 hover:bg-cyan-700 text-white font-bold text-xs shadow-xs rounded-xl"
              >
                <PlusCircle className="size-3.5" />
                <span>Nueva Recarga</span>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingTopups ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Cargando historial de recargas...
                </div>
              ) : !agentTopups || agentTopups.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground space-y-2">
                  <p>Aún no has registrado ninguna recarga telefónica desde tu panel.</p>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setOpenTopupModal(true)}
                    className="gap-1.5 text-xs text-cyan-800 border-2 border-cyan-400 bg-cyan-50 hover:bg-cyan-100 font-bold rounded-xl"
                  >
                    <Smartphone className="size-3.5" />
                    <span>Realizar Primera Recarga</span>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  {agentTopups.map((topup: any) => {
                    const isDigicel = String(topup.operator).toLowerCase().includes("digicel");
                    return (
                      <div
                        key={topup.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border-2 border-slate-200/90 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-9 rounded-xl grid place-items-center shrink-0 ${
                              isDigicel
                                ? "bg-rose-50 text-rose-700 border-2 border-rose-200"
                                : "bg-cyan-50 text-cyan-800 border-2 border-cyan-200"
                            }`}
                          >
                            <Smartphone className="size-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-sm text-slate-900 font-mono">
                                {topup.phone}
                              </span>
                              <Badge
                                variant="outline"
                                className={
                                  isDigicel
                                    ? "bg-rose-50 text-rose-700 border-rose-300 text-[10px] font-bold"
                                    : "bg-cyan-50 text-cyan-800 border-cyan-300 text-[10px] font-bold"
                                }
                              >
                                {topup.operator || "Haití"}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              Ref: <span className="font-mono font-bold text-slate-700">{topup.reference}</span> ·{" "}
                              {new Date(topup.created_at).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-black text-sm text-cyan-900 font-mono">
                            {Number(topup.amount).toLocaleString()} HTG
                          </p>
                          <Badge
                            variant="outline"
                            className={`text-[10px] mt-0.5 font-bold ${
                              topup.status === "completed" || topup.status === "successful"
                                ? "bg-emerald-50 text-emerald-800 border-emerald-300"
                                : topup.status === "failed"
                                  ? "bg-rose-50 text-rose-800 border-rose-300"
                                  : "bg-amber-50 text-amber-800 border-amber-300"
                            }`}
                          >
                            {topup.status === "completed" || topup.status === "successful"
                              ? "Completada"
                              : topup.status === "failed"
                                ? "Fallida"
                                : "En proceso"}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 3: Pendientes por Cobrar en Ventanilla */}
        <TabsContent value="pending_cash" className="space-y-3">
          <Section
            title="Solicitudes Pendientes de Cobro en Efectivo"
            description="Clientes que crearon un envío para pagar en efectivo en una agencia autorizada."
            rows={pendingCashPickups}
            advance={advance}
            changeStage={changeStage}
            cancel={cancel}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            isClaimView
          />
        </TabsContent>

        {/* Tab 4: Historial y Comisiones */}
        <TabsContent value="history" className="space-y-3">
          <Section
            title="Historial de Operaciones Entregadas"
            description="Transacciones completadas con el desglose de comisión recibida."
            rows={completedOperations}
            advance={advance}
            changeStage={changeStage}
            cancel={cancel}
            isAdmin={isAdmin}
            currentUserId={user?.id}
            readOnly
          />
        </TabsContent>

        {/* Tab 5: Movimientos de Billetera y Saldo */}
        <TabsContent value="wallets" className="space-y-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="size-4 text-emerald-700" />
                  <span>Historial de Movimientos de Saldo</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  Registro de asignaciones de administrador, débitos por envíos, recargas y reembolsos.
                </CardDescription>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => refetchWalletTxs()}
                className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                <RefreshCw className="size-3.5" />
                <span>Actualizar</span>
              </Button>
            </CardHeader>
            <CardContent>
              {isLoadingWalletTxs ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Cargando movimientos de billetera...
                </div>
              ) : !agentWalletTxs || agentWalletTxs.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Aún no se registran movimientos en tus billeteras.
                </div>
              ) : (
                <div className="space-y-2">
                  {agentWalletTxs.map((tx: any) => {
                    const isPositive = Number(tx.amount) > 0;
                    const isTopup =
                      tx.currency === "HTG_RECARGAS" || String(tx.kind).includes("topup");
                    return (
                      <div
                        key={tx.id}
                        className="flex flex-wrap items-center justify-between gap-3 p-3.5 rounded-2xl border-2 border-slate-200/90 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`size-9 rounded-xl grid place-items-center shrink-0 ${
                              isPositive
                                ? "bg-emerald-50 text-emerald-700 border-2 border-emerald-200"
                                : "bg-slate-100 text-slate-700 border-2 border-slate-200"
                            }`}
                          >
                            {isPositive ? (
                              <ArrowUpRight className="size-4" />
                            ) : (
                              <ArrowDownLeft className="size-4" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-extrabold text-xs text-slate-900">
                                {tx.description ||
                                  (isPositive ? "Asignación de saldo" : "Débito operativo")}
                              </span>
                              <Badge
                                variant="outline"
                                className={`text-[10px] font-extrabold ${
                                  isTopup
                                    ? "bg-cyan-50 text-cyan-800 border-cyan-300"
                                    : "bg-emerald-50 text-emerald-800 border-emerald-300"
                                }`}
                              >
                                {isTopup ? "📱 Recargas" : "💸 Envíos"}
                              </Badge>
                            </div>
                            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                              {new Date(tx.created_at).toLocaleDateString("es-ES", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p
                            className={`font-mono font-black text-sm ${
                              isPositive ? "text-emerald-700" : "text-slate-800"
                            }`}
                          >
                            {isPositive
                              ? `+${Number(tx.amount).toLocaleString()}`
                              : Number(tx.amount).toLocaleString()}{" "}
                            <span className="text-xs font-bold text-slate-500">HTG</span>
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 6: Mi Red de Agentes (Exclusivo para Super Agente) */}
        {isSuperAgent && (
          <TabsContent value="network" className="space-y-4">
            {/* Sección 1: Lista de Agentes Subordinados */}
            <Card className="border-2 border-indigo-200/90 shadow-2xs">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="size-4 text-indigo-700" />
                    Agentes Registrados bajo tu Red ({subAgentsData?.agents.length ?? 0})
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Agentes que operan bajo tu supervisión. Ganas un porcentaje automático por cada transacción que realicen.
                  </CardDescription>
                </div>
                <Button
                  onClick={() => setOpenAddAgentModal(true)}
                  size="sm"
                  className="gap-1.5 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl shadow-xs shrink-0"
                >
                  <UserPlus className="size-3.5" />
                  Adicionar Agente
                </Button>
              </CardHeader>
              <CardContent>
                {(!subAgentsData?.agents || subAgentsData.agents.length === 0) ? (
                  <div className="py-10 text-center space-y-3 border border-dashed rounded-2xl border-indigo-200 bg-indigo-50/30">
                    <div className="size-12 rounded-full bg-indigo-100 text-indigo-700 mx-auto grid place-items-center">
                      <Users className="size-6" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-indigo-950">Aún no tienes agentes en tu red</p>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-md mx-auto">
                        Haz clic en &quot;Adicionar Agente&quot; para seleccionar o registrar clientes y comenzar a ganar comisiones automáticas por cada envío que procesen.
                      </p>
                    </div>
                    <Button
                      onClick={() => setOpenAddAgentModal(true)}
                      size="sm"
                      className="gap-2 bg-indigo-700 hover:bg-indigo-800 text-white font-bold text-xs rounded-xl"
                    >
                      <UserPlus className="size-4" />
                      Adicionar mi primer agente
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {subAgentsData.agents.map((ag) => (
                      <div
                        key={ag.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl border-2 border-indigo-100 bg-white hover:bg-indigo-50/40 transition-colors shadow-2xs"
                      >
                        <div className="flex items-start gap-3">
                          <div className="size-10 rounded-xl bg-indigo-100 text-indigo-800 font-black grid place-items-center shrink-0 text-sm">
                            {(ag.fullName || "A").slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-foreground">
                                {ag.fullName}
                              </p>
                              <Badge className="bg-indigo-50 text-indigo-800 border border-indigo-300 font-bold text-[10px]">
                                {ag.commissionPercent}% Comisión
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {ag.phone || "Sin teléfono"}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
                              <span className="font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                Saldo Envíos: {ag.balanceHTG.toLocaleString()} HTG
                              </span>
                              <span className="font-semibold text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                                Saldo Recargas: {ag.balanceTopupsHTG.toLocaleString()} HTG
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                          <div className="text-left sm:text-right">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                              Generado para ti
                            </p>
                            <p className="font-black text-sm text-indigo-900">
                              +{ag.commissionsGenerated.toLocaleString()} HTG
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {ag.totalTransfersCount} envíos ({ag.totalVolumeSend.toLocaleString()} HTG)
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveAgent(ag.id, ag.fullName)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 size-9 p-0 rounded-xl shrink-0"
                            title="Desvincular de mi red"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sección 2: Historial de Operaciones de los Agentes */}
            <Card className="border-2 border-slate-200/90 shadow-2xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Coins className="size-4 text-purple-700" />
                  Operaciones de tu Red y Comisiones Ganadas
                </CardTitle>
                <CardDescription className="text-xs">
                  Detalle en tiempo real de cada envío procesado por tus agentes con la comisión acreditada a tu cuenta.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {(!subTxsData?.transactions || subTxsData.transactions.length === 0) ? (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
                    Tus agentes aún no han realizado transacciones registradas.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {subTxsData.transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-2xl border-2 border-slate-200/90 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black text-slate-800">
                              {tx.reference}
                            </span>
                            <Badge variant="outline" className="text-[10px] uppercase font-bold">
                              {tx.deliveryMethod}
                            </Badge>
                            <Badge className="bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              {STATUS_LABEL[tx.status as TransferStatus] || tx.status}
                            </Badge>
                          </div>
                          <p className="text-xs text-slate-800 mt-1">
                            Agente: <strong className="text-indigo-950">{tx.agentName}</strong>
                            {tx.agentPhone && <span className="text-muted-foreground font-mono"> ({tx.agentPhone})</span>}
                            {" → "}
                            Beneficiario: <strong>{tx.recipientName}</strong>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {new Date(tx.createdAt).toLocaleString()} · Envío: {tx.amountSend} {tx.sendCurrency} → Recibe: {tx.amountReceive} {tx.receiveCurrency}
                          </p>
                        </div>

                        <div className="text-left sm:text-right pt-2 sm:pt-0 border-t sm:border-t-0 border-border/60">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-900">
                            Tu Comisión de Red
                          </p>
                          <p className="font-black text-sm text-purple-700">
                            +{tx.superAgentCommission} {tx.sendCurrency}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Modal: Nueva Transacción en Efectivo en Ventanilla */}
      <Dialog open={openNewCashModal} onOpenChange={setOpenNewCashModal}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto bg-white border border-slate-200 shadow-2xl rounded-3xl text-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-black text-slate-900">
              <div className="size-8 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-xs">
                <Banknote className="size-5" />
              </div>
              Nueva Transacción en Efectivo
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 font-medium">
              Ventanilla de agente: Recibe el efectivo en mano y registra el envío hacia Haití.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateCashTransfer} className="space-y-4 pt-2">
            {/* Aviso Solo Efectivo */}
            <div className="rounded-2xl bg-emerald-100/90 border-2 border-emerald-400 p-3.5 text-xs text-emerald-950 flex items-center gap-2.5 shadow-2xs">
              <ShieldCheck className="size-5 shrink-0 text-emerald-800" />
              <span className="leading-relaxed">
                <strong className="font-black text-emerald-950">Solo Efectivo:</strong> Debes cobrar el importe físico directamente al
                cliente en tu ventanilla antes de confirmar.
              </span>
            </div>

            {/* País de Origen del Agente */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-slate-900">País de Origen (Moneda de cobro)</Label>
              <Select value={originCountry} onValueChange={setOriginCountry}>
                <SelectTrigger className="bg-white border-2 border-slate-300 text-slate-900 font-bold rounded-xl focus:border-emerald-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {origins.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.currency})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Datos del Destinatario en Haití */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor="recipientName" className="text-xs font-black text-slate-900">
                  Nombre Completo del Destinatario
                </Label>
                <Input
                  id="recipientName"
                  placeholder="Ej. Jean-Baptiste Pierre"
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  required
                  className="bg-white border-2 border-slate-300 text-slate-900 focus:border-emerald-600 rounded-xl font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="recipientPhone" className="text-xs font-black text-slate-900">
                  Teléfono (Haití +509)
                </Label>
                <Input
                  id="recipientPhone"
                  placeholder="509XXXXXXXX"
                  value={recipientPhone}
                  onChange={(e) => setRecipientPhone(e.target.value)}
                  required
                  className="bg-white border-2 border-slate-300 text-slate-900 focus:border-emerald-600 rounded-xl font-mono font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-black text-slate-900">Ciudad de Entrega</Label>
                <Select value={recipientCity} onValueChange={setRecipientCity}>
                  <SelectTrigger className="bg-white border-2 border-slate-300 text-slate-900 font-bold rounded-xl focus:border-emerald-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {citiesFor("HT").map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Método de Entrega en Haití */}
            <div className="space-y-1.5">
              <Label className="text-xs font-black text-slate-900">Método de Entrega en Haití</Label>
              <Select value={deliveryMethod} onValueChange={setDeliveryMethod}>
                <SelectTrigger className="bg-white border-2 border-slate-300 text-slate-900 font-bold rounded-xl focus:border-emerald-600">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {deliveryMethods("HT").map((d) => (
                    <SelectItem key={d.value} value={d.value}>
                      {d.label} — {d.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Monto Recibido en Efectivo */}
            <div className="space-y-1.5">
              <Label htmlFor="amountSend" className="text-xs font-black text-slate-900">
                Monto en Efectivo a Enviar ({sendCur})
              </Label>
              <Input
                id="amountSend"
                type="number"
                step="any"
                min="1"
                placeholder={`0.00 ${sendCur}`}
                value={amountSend}
                onChange={(e) => setAmountSend(e.target.value)}
                required
                className="bg-white border-2 border-slate-300 text-slate-900 focus:border-emerald-600 rounded-xl font-mono font-black text-lg"
              />
            </div>

            {/* Desglose de cotización en tiempo real */}
            {parsedAmount > 0 && (
              <div className="rounded-2xl border-2 border-slate-200 bg-slate-50/90 p-4 space-y-2.5 text-xs text-slate-800 shadow-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-semibold">Tasa de cambio:</span>
                  <span className="font-mono font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                    1 {sendCur} = {Number(effectiveCfg.rate).toFixed(4)} {recvCur}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-semibold">Tarifa de envío:</span>
                  <span className="font-bold text-slate-900">{money(q.fee, sendCur)}</span>
                </div>
                <div className="flex justify-between items-center font-black border-t border-slate-200 pt-2 text-sm text-slate-900">
                  <span>Total en Efectivo a Cobrar:</span>
                  <span className="text-emerald-700 font-mono text-base font-black">{money(q.total, sendCur)}</span>
                </div>
                <div className="flex justify-between items-center font-black text-sm text-slate-900 bg-emerald-100/70 border border-emerald-300 p-2.5 rounded-xl">
                  <span className="text-emerald-950">Destinatario Recibe en Haití:</span>
                  <span className="text-emerald-800 font-mono text-base font-black">{money(q.receives, recvCur)}</span>
                </div>
                <div className="flex justify-between items-center border-t border-slate-200 pt-2 text-emerald-900 font-bold">
                  <span>Tu Comisión como Agente:</span>
                  <span className="text-emerald-800 font-mono text-sm bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300">
                    +{money(q.commission, sendCur)}
                  </span>
                </div>
                <div className="pt-1 text-[11px] text-slate-600 flex items-center gap-1.5 font-medium">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>
                    Método de pago: <strong className="text-slate-900">Efectivo en Ventanilla (cash_agent)</strong>
                  </span>
                </div>
              </div>
            )}

            {/* Estado de Billetera de Envíos de Dinero */}
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/90 p-4 text-xs space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-black text-emerald-950 flex items-center gap-2 text-sm">
                  <div className="size-7 rounded-lg bg-emerald-700 text-white grid place-items-center shadow-xs">
                    <Banknote className="size-4" />
                  </div>
                  Billetera de Envíos de Dinero
                </span>
                <span className="font-mono font-black text-emerald-950 text-base bg-white border-2 border-emerald-400 px-3 py-1 rounded-xl shadow-2xs">
                  {transfersBalance.toLocaleString()} HTG
                </span>
              </div>
              {parsedAmount > 0 && q.receives > transfersBalance ? (
                <p className="text-rose-900 bg-rose-50 border-2 border-rose-300 p-2.5 rounded-xl font-bold flex items-center gap-2 text-xs">
                  ⚠️ Saldo insuficiente: Tienes {transfersBalance.toLocaleString()} HTG y esta operación requiere {q.receives.toLocaleString()} HTG. Sin saldo operativo no puedes realizar el envío.
                </p>
              ) : (
                <p className="text-emerald-950 font-bold leading-relaxed">
                  El monto a entregar ({parsedAmount > 0 ? `${q.receives.toLocaleString()} HTG` : "en HTG"}) se descontará de tu Billetera de Envíos de Dinero.
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="note" className="text-xs font-black text-slate-900">
                Nota interna (Opcional)
              </Label>
              <Textarea
                id="note"
                rows={2}
                placeholder="Observación o detalle del cliente..."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                maxLength={300}
                className="bg-white border-2 border-slate-300 text-slate-900 focus:border-emerald-600 rounded-xl font-medium"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenNewCashModal(false)}
                disabled={isSubmittingCash}
                className="text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmittingCash ||
                  parsedAmount <= 0 ||
                  (!isAdmin && (transfersBalance <= 0 || (parsedAmount > 0 && q.receives > transfersBalance)))
                }
                className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl py-2.5 shadow-md"
              >
                <Banknote className="size-4" />
                {isSubmittingCash
                  ? "Registrando..."
                  : !isAdmin && parsedAmount > 0 && q.receives > transfersBalance
                    ? "Saldo insuficiente para enviar"
                    : "Cobrar en Efectivo y Procesar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Cobrar con Código de Referencia */}
      <Dialog open={openClaimModal} onOpenChange={setOpenClaimModal}>
        <DialogContent className="max-w-md bg-white border border-slate-200 shadow-2xl rounded-3xl text-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-black text-slate-900">
              <div className="size-8 rounded-xl bg-emerald-600 text-white grid place-items-center shadow-xs">
                <Search className="size-5" />
              </div>
              Cobrar Transferencia con Referencia
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 font-medium">
              Si un cliente creó un envío en la app y seleccionó &ldquo;Efectivo con agente&rdquo;,
              ingresa su código de referencia para cobrar el efectivo en ventanilla y procesarlo.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleClaimByReference} className="space-y-4 pt-2">
            <div className="space-y-1.5">
              <Label htmlFor="claimReference" className="text-xs font-bold text-slate-800">
                Código de Referencia (Ej. LR-123456)
              </Label>
              <Input
                id="claimReference"
                placeholder="LR-..."
                value={claimReference}
                onChange={(e) => setClaimReference(e.target.value.toUpperCase())}
                required
                className="font-mono text-base font-bold uppercase bg-slate-50 border-slate-300 focus:bg-white text-slate-900 rounded-xl"
              />
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenClaimModal(false)}
                disabled={isClaiming}
                className="text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isClaiming || !claimReference.trim()}
                className="gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold rounded-xl py-2.5 shadow-md"
              >
                <CheckCircle2 className="size-4" />
                {isClaiming ? "Buscando..." : "Confirmar Cobro en Efectivo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Nueva Recarga Telefónica DingConnect (Integrada en el Panel) */}
      <Dialog open={openTopupModal} onOpenChange={setOpenTopupModal}>
        <DialogContent className="max-w-md bg-white border border-slate-200 shadow-2xl rounded-3xl text-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-xl font-black text-slate-900">
              <div className="size-8 rounded-xl bg-cyan-600 text-white grid place-items-center shadow-xs">
                <Smartphone className="size-5" />
              </div>
              Nueva Recarga Telefónica (Haití)
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-600 font-medium">
              Envía recargas de Digicel o Natcom al instante. El costo se debita directamente de tu
              Billetera de Recargas.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleCreateTopup} className="space-y-4 pt-1">
            {/* Selector de Operador */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-800">Operador Telefónico</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setTopupOperator("Digicel")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 text-xs font-extrabold transition-all ${
                    topupOperator === "Digicel"
                      ? "bg-rose-50 border-rose-500 text-rose-700 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="size-2.5 rounded-full bg-rose-500" />
                  Digicel Haití
                </button>
                <button
                  type="button"
                  onClick={() => setTopupOperator("Natcom")}
                  className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border-2 text-xs font-extrabold transition-all ${
                    topupOperator === "Natcom"
                      ? "bg-cyan-50 border-cyan-500 text-cyan-800 shadow-xs"
                      : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span className="size-2.5 rounded-full bg-cyan-500" />
                  Natcom Haití
                </button>
              </div>
            </div>

            {/* Número de Teléfono */}
            <div className="space-y-1.5">
              <Label htmlFor="topupPhone" className="text-xs font-bold text-slate-800">
                Número de Celular (+509)
              </Label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-mono font-bold text-slate-500">
                  +509
                </span>
                <Input
                  id="topupPhone"
                  type="tel"
                  placeholder="37123456"
                  value={topupPhone}
                  onChange={(e) => setTopupPhone(e.target.value.replace(/[^0-9]/g, ""))}
                  required
                  className="pl-14 font-mono text-base font-bold tracking-wider bg-slate-50 border-slate-300 focus:bg-white text-slate-900 rounded-xl"
                  maxLength={12}
                />
              </div>
            </div>

            {/* Monto de la Recarga */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="topupAmount" className="text-xs font-bold text-slate-800">
                  Monto a Recargar (HTG)
                </Label>
                <span className="text-[11px] font-semibold text-slate-500">Moneda: HTG</span>
              </div>
              <Input
                id="topupAmount"
                type="number"
                placeholder="250"
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value)}
                required
                min={50}
                max={5000}
                className="font-mono text-base font-black bg-slate-50 border-slate-300 focus:bg-white text-slate-900 rounded-xl"
              />
              <div className="flex gap-1.5 pt-1">
                {["100", "250", "500", "1000"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTopupAmount(preset)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold border transition-colors ${
                      topupAmount === preset
                        ? "bg-cyan-600 border-cyan-600 text-white shadow-xs"
                        : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
                    }`}
                  >
                    {preset} HTG
                  </button>
                ))}
              </div>
            </div>

            {/* Estado de Billetera de Recargas */}
            <div className="rounded-2xl border-2 border-cyan-200 bg-cyan-50/90 p-4 text-xs space-y-2 shadow-xs">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-cyan-950 flex items-center gap-2 text-sm">
                  <div className="size-7 rounded-lg bg-cyan-600 text-white grid place-items-center shadow-xs">
                    <Smartphone className="size-4" />
                  </div>
                  Billetera de Recargas
                </span>
                <span className="font-mono font-black text-cyan-900 text-base bg-cyan-100 border border-cyan-300 px-3 py-1 rounded-xl shadow-2xs">
                  {topupsBalance.toLocaleString()} HTG
                </span>
              </div>
              {Number(topupAmount) > 0 && Number(topupAmount) > topupsBalance ? (
                <p className="text-rose-700 bg-rose-50 border border-rose-300 p-2.5 rounded-xl font-bold flex items-center gap-2 text-xs">
                  ⚠️ Saldo insuficiente: Tienes {topupsBalance.toLocaleString()} HTG y esta recarga requiere {Number(topupAmount).toLocaleString()} HTG. Sin saldo en tu billetera de recargas no puedes realizar envíos.
                </p>
              ) : (
                <p className="text-cyan-950/80 font-medium leading-relaxed">
                  El monto ({Number(topupAmount) > 0 ? `${Number(topupAmount).toLocaleString()} HTG` : "en HTG"}) se descontará automáticamente de tu Billetera de Recargas.
                </p>
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpenTopupModal(false)}
                disabled={isSubmittingTopup}
                className="text-slate-600 hover:text-slate-900"
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={
                  isSubmittingTopup ||
                  !topupPhone.trim() ||
                  Number(topupAmount) <= 0 ||
                  topupsBalance < Number(topupAmount)
                }
                className="gap-2 bg-cyan-600 hover:bg-cyan-700 text-white font-extrabold text-sm shadow-md rounded-xl py-2.5"
              >
                <Smartphone className="size-4" />
                {isSubmittingTopup
                  ? "Enviando recarga..."
                  : topupsBalance < Number(topupAmount)
                    ? "Saldo insuficiente"
                    : "Enviar Recarga Inmediata"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Adicionar Agente a la Red de Super Agente */}
      <AddSubordinateAgentModal
        isOpen={openAddAgentModal}
        onClose={() => setOpenAddAgentModal(false)}
        onSuccess={() => {
          refetchSubAgents();
          refetchSubTxs();
        }}
      />
    </div>
  );
}

type Row = {
  id: string;
  reference: string;
  recipient_name: string;
  recipient_phone: string;
  recipient_city: string;
  amount_send: number;
  total_send: number;
  amount_receive: number;
  send_currency: string;
  receive_currency: string;
  origin_country: string;
  destination_country: string;
  delivery_method: string;
  payment_method: string;
  agent_id: string | null;
  agent_commission_send: number | null;
  status: string;
  created_at: string;
};

function Section({
  title,
  description,
  rows,
  advance,
  changeStage,
  cancel,
  readOnly,
  isAdmin,
  currentUserId,
  isClaimView,
}: {
  title: string;
  description?: string;
  rows: Row[];
  advance: (id: string, status: TransferStatus, message: string) => Promise<void>;
  changeStage: (id: string, status: TransferStatus) => Promise<void>;
  cancel: (id: string, reason: string) => Promise<void>;
  readOnly?: boolean | undefined;
  isAdmin?: boolean | undefined;
  currentUserId?: string | undefined;
  isClaimView?: boolean | undefined;
}) {
  const getAction = (t: Row) => {
    if (t.status === "awaiting_payment") {
      return { to: "processing" as TransferStatus, label: "Confirmar cobro en efectivo" };
    }
    if (t.status === "processing" || t.status === "paid") {
      return { to: "completed" as TransferStatus, label: "Confirmar entrega completada" };
    }
    return undefined;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.length === 0 && (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No hay operaciones en esta sección.
          </div>
        )}
        {rows.map((t) => {
          const action = getAction(t);
          const isMyAgentTransfer = t.agent_id === currentUserId || isAdmin;

          return (
            <div
              key={t.id}
              className="flex flex-col gap-3 rounded-2xl border-2 border-slate-200/90 bg-white p-4 transition-all hover:bg-slate-50/80 shadow-2xs sm:flex-row sm:items-center sm:justify-between"
            >
              {/* Información del Destinatario y Origen/Destino */}
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-extrabold text-slate-900 text-sm sm:text-base">
                    {t.recipient_name}
                  </p>
                  <span className="text-xs font-semibold text-slate-500">({t.recipient_city})</span>
                  {t.payment_method === "cash_agent" && (
                    <Badge
                      variant="outline"
                      className="border-emerald-300 text-emerald-800 bg-emerald-50 text-[10px] font-extrabold py-0.5"
                    >
                      💵 Efectivo en Ventanilla
                    </Badge>
                  )}
                </div>

                <p className="text-xs text-slate-500 font-medium flex flex-wrap items-center gap-2">
                  <span className="font-mono font-bold text-slate-800">{t.reference}</span>
                  <span>·</span>
                  <span className="font-semibold text-slate-700">
                    {t.origin_country} → {t.destination_country}
                  </span>
                  <span>·</span>
                  <span>Entrega: {t.delivery_method}</span>
                  <span>·</span>
                  <span>{shortDate(t.created_at)}</span>
                </p>

                {Number(t.agent_commission_send ?? 0) > 0 && (
                  <p className="text-xs font-black text-emerald-700">
                    Comisión ganada: +{money(Number(t.agent_commission_send), t.send_currency)}
                  </p>
                )}
              </div>

              {/* Montos y Estado */}
              <div className="flex flex-wrap items-center gap-3 sm:justify-end">
                <div className="text-left sm:text-right">
                  <p className="font-black text-slate-900 text-sm sm:text-base font-mono">
                    {money(Number(t.total_send || t.amount_send), t.send_currency)}
                  </p>
                  <p className="text-xs font-bold text-emerald-700">
                    Recibe: {money(Number(t.amount_receive), t.receive_currency)}
                  </p>
                </div>

                <Badge className={STATUS_TONE[t.status as TransferStatus]} variant="secondary">
                  {STATUS_LABEL[t.status as TransferStatus]}
                </Badge>

                {/* Botón de Acción Principal para el Agente */}
                {!readOnly && action && (isMyAgentTransfer || isClaimView) && (
                  <Button
                    size="sm"
                    className="gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs shadow-sm rounded-xl"
                    onClick={() => void advance(t.id, action.to, action.label)}
                  >
                    <CheckCircle2 className="size-3.5" />
                    {action.label}
                  </Button>
                )}

                {/* Cambio manual de etapa */}
                {!readOnly && (isAdmin || isMyAgentTransfer) && (
                  <Select
                    value={t.status}
                    onValueChange={(value) => void changeStage(t.id, value as TransferStatus)}
                  >
                    <SelectTrigger className="h-8 w-[130px] text-xs">
                      <SelectValue placeholder="Cambiar" />
                    </SelectTrigger>
                    <SelectContent>
                      {ALL_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Cancelar transacción */}
                {!readOnly &&
                  (isAdmin || isMyAgentTransfer) &&
                  t.status !== "cancelled" &&
                  t.status !== "completed" && (
                    <CancelButton
                      reference={t.reference}
                      onConfirm={(reason) => cancel(t.id, reason)}
                    />
                  )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function CancelButton({
  reference,
  onConfirm,
}: {
  reference: string;
  onConfirm: (reason: string) => Promise<void>;
}) {
  const [reason, setReason] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive" className="h-8 px-2.5 text-xs gap-1">
          <XCircle className="size-3.5" /> Cancelar
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Cancelar el envío {reference}</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción marcará el envío como cancelado y se registrará en el historial de tu
            agencia.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          placeholder="Motivo de la cancelación (opcional)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => setReason("")}>Volver</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              void onConfirm(reason);
              setReason("");
            }}
          >
            Sí, cancelar envío
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone = "text-slate-900",
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  tone?: string;
  hint?: string;
}) {
  return (
    <Card className="relative overflow-hidden border-2 border-slate-200/90 bg-white shadow-xs rounded-2xl hover:border-emerald-500/40 transition-all">
      <CardContent className="p-4 space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs font-bold text-slate-600">{label}</p>
          <div className="size-7 rounded-lg bg-slate-100 text-slate-700 grid place-items-center shrink-0">
            <Icon className="size-4" />
          </div>
        </div>
        <p className={`font-display text-2xl font-black tracking-tight ${tone}`}>{value}</p>
        {hint && <p className="text-[11px] font-semibold text-slate-500">{hint}</p>}
      </CardContent>
    </Card>
  );
}
