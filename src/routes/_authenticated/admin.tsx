import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useMemo } from "react";
import { ArrowLeft, Coins, FileText, History, RefreshCw, Shield, Sparkles, UserCheck, Users } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { useAdminPermissions } from "@/hooks/useAdminPermissions";
import {
  getAllAdminsPermissionsMap,
  getAdminUsersList,
  type AdminTabId,
} from "@/lib/admin-permissions.functions";
import { AdminPermissionsModal } from "@/components/admin/AdminPermissionsModal";
import { AgentBalanceModal } from "@/components/admin/AgentBalanceModal";
import { AgentBalanceHistoryModal } from "@/components/admin/AgentBalanceHistoryModal";
import { RegisterSuperAgentModal } from "@/components/admin/RegisterSuperAgentModal";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCountries } from "@/hooks/useCorridors";
import { bazikStatus } from "@/lib/bazik.functions";
import { BazikPanel } from "@/components/admin/BazikPanel";
import { CryptoPanel } from "@/components/admin/CryptoPanel";
import { MercadoPagoPanel } from "@/components/admin/MercadoPagoPanel";
import { StripePanel } from "@/components/admin/StripePanel";
import { ResendPanel } from "@/components/admin/ResendPanel";
import { BulkEmailPanel } from "@/components/admin/BulkEmailPanel";
import { SecurityPanel } from "@/components/admin/SecurityPanel";
import { OperatorReportPanel } from "@/components/admin/OperatorReportPanel";
import { TopupRatesPanel } from "@/components/admin/TopupRatesPanel";
import { DingConnectPanel } from "@/components/admin/DingConnectPanel";
import { AccountingPanel } from "@/components/admin/AccountingPanel";
import { SupportPanel } from "@/components/admin/SupportPanel";
import { AdBannerPanel } from "@/components/admin/AdBannerPanel";
import { SocialNetworksPanel } from "@/components/admin/SocialNetworksPanel";
import { ServicesPanel } from "@/components/admin/ServicesPanel";
import { KycPanel } from "@/components/admin/KycPanel";
import { TopupsPanel } from "@/components/admin/TopupsPanel";
import { MigrationAnalysisPanel } from "@/components/admin/MigrationAnalysisPanel";
import { adminCancelTransfer, adminSetTransferStatus } from "@/lib/transfers.functions";
import { adminSaveExchangeRate } from "@/lib/exchange-rates.functions";
import {
  money,
  shortDate,
  STATUS_LABEL,
  STATUS_TONE,
  KYC_LABEL,
  KYC_TONE,
  type KycStatus,
  type TransferStatus,
} from "@/lib/remesa";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administración — Tcho-Tcho" },
      { name: "description", content: "Gestiona usuarios, KYC, tipos de cambio y transacciones." },
      { property: "og:title", content: "Administración — Tcho-Tcho" },
      { property: "og:description", content: "Panel de control de la operación de remesas." },
    ],
  }),
  beforeLoad: async () => {
    const { data: s } = await supabase.auth.getSession();
    let user = s.session?.user;
    if (!user) {
      try {
        const { data: u } = await supabase.auth.getUser();
        user = u?.user ?? undefined;
      } catch {
        // ignore
      }
    }
    if (!user) {
      throw redirect({ to: "/auth" });
    }

    const email = user.email?.toLowerCase().trim();
    const phone = (user.phone || (user.user_metadata as any)?.phone || "").replace(/\D/g, "");
    const isSpecialAdmin =
      email === "lajanrapid26@gmail.com" ||
      email === "charlesagency4@gmail.com" ||
      phone === "529988100395" ||
      user.id === "0a1fec01-21c2-4af6-8e54-4b7ce6e2913c" ||
      user.id === "cca63804-b4c1-4221-bbd3-82258545f228" ||
      user.id === "9b729a8e-b91c-430a-907c-969652b89f3b";

    if (isSpecialAdmin) {
      return;
    }

    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleRow) {
      throw redirect({ to: "/dashboard" });
    }
  },
  component: Admin,
});

function Admin() {
  const { hasTabPermission, isSuperAdmin } = useAdminPermissions();

  const tabDefs: { id: AdminTabId; label: string; panel: React.ReactNode }[] = [
    { id: "resumen", label: "Resumen", panel: <Resumen /> },
    { id: "servicios", label: "Servicios", panel: <ServicesPanel /> },
    { id: "contabilidad", label: "Contabilidad", panel: <AccountingPanel /> },
    { id: "soporte", label: "Soporte", panel: <SupportPanel /> },
    { id: "redes", label: "Redes Sociales", panel: <SocialNetworksPanel /> },
    { id: "banner", label: "Banner", panel: <AdBannerPanel /> },
    { id: "mercadopago", label: "Mercado Pago", panel: <MercadoPagoPanel /> },
    { id: "stripe", label: "Stripe", panel: <StripePanel /> },
    { id: "resend", label: "Correo", panel: <ResendPanel /> },
    { id: "bulk-email", label: "Correo masivo", panel: <BulkEmailPanel /> },
    { id: "security", label: "Seguridad", panel: <SecurityPanel /> },
    { id: "operators", label: "Operadores", panel: <OperatorReportPanel /> },
    { id: "topup-rates", label: "Tasas Ding", panel: <TopupRatesPanel /> },
    { id: "dingconnect", label: "Recargas (Ding)", panel: <DingConnectPanel /> },
    { id: "cripto", label: "Cripto", panel: <CryptoPanel /> },
    { id: "bazik", label: "Bazik API", panel: <BazikPanel /> },
    { id: "kyc", label: "KYC", panel: <KycPanel /> },
    { id: "tx", label: "Transacciones", panel: <TxPanel /> },
    { id: "recargas", label: "Recargas", panel: <TopupsPanel /> },
    { id: "usuarios", label: "Usuarios", panel: <UsersPanel /> },
    { id: "tarifas", label: "Tarifas", panel: <RatesPanel /> },
    { id: "migracion", label: "Migración IA", panel: <MigrationAnalysisPanel /> },
  ];

  const allowedTabs = tabDefs.filter((t) => {
    return hasTabPermission(t.id);
  });
  const defaultTab = allowedTabs.some((t) => t.id === "resumen")
    ? "resumen"
    : allowedTabs[0]?.id || "tx";

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
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
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-extrabold text-slate-900">Admin Dashboard</h1>
            {isSuperAdmin && (
              <Badge className="bg-[#EF4444] text-white border-transparent gap-1 text-xs font-bold uppercase rounded-full px-2.5 py-0.5 shadow-xs">
                <Shield className="size-3" /> ADMIN
              </Badge>
            )}
          </div>
        </div>
      </div>
      <Tabs defaultValue={defaultTab}>
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-white border border-slate-200 p-1 rounded-2xl shadow-xs">
          {allowedTabs.map((t) => (
            <TabsTrigger
              key={t.id}
              value={t.id}
              className="rounded-xl px-3 py-1.5 text-xs font-medium text-slate-600 data-[state=active]:bg-[#DCFCE7] data-[state=active]:text-[#15803D] data-[state=active]:font-bold data-[state=active]:shadow-none transition-all"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {allowedTabs.map((t) => (
          <TabsContent key={t.id} value={t.id} className="mt-4">
            {t.panel}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function useTransfers() {
  useRealtimeInvalidate("transfers", ["admin-transfers"]);
  return useQuery({
    queryKey: ["admin-transfers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("transfers")
        .select("*")
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });
}

function Resumen() {
  const { data: transfers } = useTransfers();
  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("*")).data ?? [],
  });

  const { data: wallets } = useQuery({
    queryKey: ["admin-wallets-summary"],
    queryFn: async () => (await supabase.from("wallets").select("currency, balance")).data ?? [],
  });

  const rows = transfers ?? [];
  const sumBy = (pick: (t: (typeof rows)[number]) => number) => {
    const acc: Record<string, number> = {};
    rows.forEach((t) => {
      acc[t.send_currency] = (acc[t.send_currency] ?? 0) + pick(t);
    });
    const entries = Object.entries(acc);
    return entries.length ? entries.map(([c, v]) => money(v, c)).join(" · ") : "—";
  };
  const volume = sumBy((t) => Number(t.amount_send));
  const fees = sumBy((t) => Number(t.fee_send));
  const completed = rows.filter((t) => t.status === "completed").length;
  const pendingKyc = (profiles ?? []).filter((p) => p.kyc_status === "pending").length;

  const getBazikStatus = useServerFn(bazikStatus);
  const { data: bazikInfo } = useQuery({
    queryKey: ["bazik_status"],
    queryFn: () => getBazikStatus(),
    staleTime: 15_000,
  });

  const totalHtgBalance = Math.max(
    (wallets ?? [])
      .filter((w) => w.currency === "HTG")
      .reduce((sum, w) => sum + Number(w.balance || 0), 0),
    Number(bazikInfo?.adminWalletBalance || bazikInfo?.balance || 0),
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Saldo Operativo (Bazik)" value={`${totalHtgBalance.toLocaleString()} HTG`} isGreen />
        <Stat label="Volumen total" value={volume} isGreen />
        <Stat label="Ingresos comisión" value={fees} isGreen />
        <Stat label="Envíos entregados" value={`${completed} / ${rows.length}`} />
        <Stat label="KYC por revisar" value={String(pendingKyc)} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Envíos por estado</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(Object.keys(STATUS_LABEL) as TransferStatus[]).map((s) => {
            const n = rows.filter((t) => t.status === s).length;
            const pct = rows.length ? Math.round((n / rows.length) * 100) : 0;
            return (
              <div key={s} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span>{STATUS_LABEL[s]}</span>
                  <span className="text-muted-foreground">
                    {n} ({pct}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-secondary">
                  <div className="h-2 rounded-full bg-accent" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

const ALL_TRANSFER_STATUSES: TransferStatus[] = [
  "created",
  "awaiting_payment",
  "paid",
  "processing",
  "ready_for_pickup",
  "completed",
  "cancelled",
];

function TxPanel() {
  const qc = useQueryClient();
  const { data, isLoading } = useTransfers();
  const setStatus = useServerFn(adminSetTransferStatus);
  const cancelTransfer = useServerFn(adminCancelTransfer);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | TransferStatus>("all");
  const [busy, setBusy] = useState<string | null>(null);

  const { data: profiles } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => (await supabase.from("profiles").select("id, full_name, phone")).data ?? [],
  });

  const profilesMap = useMemo(() => {
    return new Map((profiles ?? []).map((p) => [p.id, p]));
  }, [profiles]);

  const rows = (data ?? []).filter((t) => {
    if (filter !== "all" && t.status !== filter) return false;
    const q = search.trim().toLowerCase();
    if (!q) return true;

    const agentId = (t as any).agent_id || (t.payment_method === "cash_agent" ? t.user_id : null);
    const agentProfile = agentId ? profilesMap.get(agentId) : null;
    const agentName = agentProfile?.full_name || agentProfile?.phone || "";

    return [t.reference, t.recipient_name, t.recipient_phone, t.destination_country, agentName]
      .filter(Boolean)
      .some((v) => String(v).toLowerCase().includes(q));
  });

  const change = async (id: string, status: TransferStatus) => {
    setBusy(id);
    try {
      if (status === "cancelled") {
        const r = await cancelTransfer({ data: { transferId: id } });
        toast.success(r.message);
      } else {
        const r = await setStatus({ data: { transferId: id, status } });
        toast.success(r.message);
      }
      qc.invalidateQueries({ queryKey: ["admin-transfers"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="text-base">Todas las transacciones</CardTitle>
        <div className="grid gap-2 sm:grid-cols-[1fr_200px]">
          <Input
            placeholder="Buscar por referencia, destinatario o nombre del agente..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              {ALL_TRANSFER_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {STATUS_LABEL[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading && <p className="text-sm text-muted-foreground">Cargando envíos…</p>}
        {!isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay envíos para este filtro.</p>
        )}
        {rows.map((t) => {
          const agentId = (t as any).agent_id || (t.payment_method === "cash_agent" ? t.user_id : null);
          const agentProfile = agentId ? profilesMap.get(agentId) : null;
          const agentName = agentProfile?.full_name || agentProfile?.phone || (agentId ? "Agente autorizado" : null);

          return (
            <div
              key={t.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 hover:bg-card/70 transition-colors"
            >
              <div className="min-w-0 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-sm">{t.recipient_name}</p>
                  {agentName && (
                    <Badge className="bg-emerald-50 text-emerald-800 border-2 border-emerald-200 text-[11px] font-bold gap-1 py-0 px-2 shadow-2xs">
                      <UserCheck className="size-3 text-emerald-700" />
                      Agente: {agentName}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {t.reference} · {t.origin_country} → {t.destination_country} · {t.payment_method} ·{" "}
                  {shortDate(t.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{money(Number(t.amount_send), t.send_currency)}</p>
                <p className="text-xs text-muted-foreground">
                  {money(Number(t.amount_receive), t.receive_currency)}
                </p>
              </div>
              <Badge className={STATUS_TONE[t.status as TransferStatus]} variant="secondary">
                {STATUS_LABEL[t.status as TransferStatus]}
              </Badge>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const w = window.open("", "_blank", "width=800,height=700");
                  if (!w) {
                    toast.error("Permite las ventanas emergentes.");
                    return;
                  }
                  const safe = (v: unknown) =>
                    String(v ?? "").replace(
                      /[&<>"]/g,
                      (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[ch] ?? ch,
                    );
                  w.document.write(
                    `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Recibo ${safe(t.reference)}</title><style>body{font:16px Arial;max-width:720px;margin:40px auto;padding:24px;color:#172033}h1{color:#0e9f6e}.row{display:flex;justify-content:space-between;border-bottom:1px solid #ddd;padding:13px 0}span{color:#667085}@media print{button{display:none}}</style></head><body><h1>LAJAN RAPID</h1><h2>Recibo de transacción</h2><p>Referencia: ${safe(t.reference)} · Fecha: ${safe(shortDate(t.created_at))}</p><div class="row"><span>Estado</span><strong>${safe(STATUS_LABEL[t.status as TransferStatus] ?? t.status)}</strong></div>${agentName ? `<div class="row"><span>Agente que procesó</span><strong style="color:#059669">${safe(agentName)}</strong></div>` : ""}<div class="row"><span>Destinatario</span><strong>${safe(t.recipient_name)}</strong></div><div class="row"><span>Países</span><strong>${safe(t.origin_country)} → ${safe(t.destination_country)}</strong></div><div class="row"><span>Método de pago</span><strong>${safe(t.payment_method)}</strong></div><div class="row"><span>Enviado</span><strong>${safe(money(Number(t.amount_send), t.send_currency))}</strong></div><div class="row"><span>Recibe</span><strong>${safe(money(Number(t.amount_receive), t.receive_currency))}</strong></div><button onclick="window.print()">Imprimir / Guardar como PDF</button></body></html>`,
                  );
                  w.document.close();
                }}
              >
                <FileText className="mr-2 size-4" />
                Generar recibo
              </Button>
              <Select
                value={t.status}
                disabled={busy === t.id || t.status === "cancelled" || t.status === "completed"}
                onValueChange={(v) => void change(t.id, v as TransferStatus)}
              >
                <SelectTrigger className="h-9 w-[170px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_TRANSFER_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function UsersPanel() {
  const qc = useQueryClient();
  const { isSuperAdmin, allowedTabs: myAllowedTabs } = useAdminPermissions();
  const [userSearch, setUserSearch] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [balanceUser, setBalanceUser] = useState<any>(null);
  const [openGlobalHistory, setOpenGlobalHistory] = useState(false);
  const [openRegisterSuperAgent, setOpenRegisterSuperAgent] = useState(false);

  const fetchAdminsMap = useServerFn(getAllAdminsPermissionsMap);
  const { data: adminsMap } = useQuery({
    queryKey: ["all-admins-permissions"],
    queryFn: () => fetchAdminsMap(),
  });

  const getBazikStatus = useServerFn(bazikStatus);
  const { data: bazikInfo } = useQuery({
    queryKey: ["bazik_status"],
    queryFn: () => getBazikStatus(),
    staleTime: 15_000,
  });

  const fetchUsers = useServerFn(getAdminUsersList);
  const {
    data: usersData,
    isLoading: isLoadingUsers,
    refetch: refetchUsers,
  } = useQuery({
    queryKey: ["admin-users-list"],
    queryFn: async () => {
      // 1. Probar función de servidor getAdminUsersList (autoritativa y completa con roles y metadatos)
      try {
        const sRes = await fetchUsers();
        if (sRes?.users && sRes.users.length > 0) {
          return sRes;
        }
      } catch (e) {
        console.warn("ServerFn failed:", e);
      }

      // 2. Probar RPC admin_get_all_users directo desde el cliente Supabase
      try {
        const { data: rpcRows, error: rpcErr } = await (supabase as any).rpc("admin_get_all_users");
        if (!rpcErr && Array.isArray(rpcRows) && rpcRows.length > 0) {
          return {
            users: rpcRows.map((u: any) => ({
              id: u.id,
              email: u.email || null,
              full_name: u.full_name || (u.email ? u.email.split("@")[0] : "Usuario"),
              phone: u.phone || null,
              country: u.country || "HT",
              language: u.language || "es",
              kyc_status: u.kyc_status || "none",
              created_at: u.created_at,
              roles: Array.isArray(u.roles) && u.roles.length > 0 ? u.roles : ["client"],
              balanceHTG: Number(u.balance_htg || 0),
            })),
          };
        }
      } catch (e) {
        console.warn("Client RPC failed:", e);
      }

      // 3. Consulta de respaldo a profiles, user_roles y wallets del cliente
      try {
        const [{ data: pList }, { data: rList }, { data: wList }] = await Promise.all([
          supabase.from("profiles").select("*").order("created_at", { ascending: false }),
          supabase.from("user_roles").select("*"),
          supabase.from("wallets").select("user_id, currency, balance"),
        ]);

        const map = new Map<string, any>();
        for (const p of pList ?? []) {
          const uRoles = (rList ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
          const uWallets = (wList ?? []).filter((w) => w.user_id === p.id);
          const bal = uWallets.find((w) => w.currency === "HTG")?.balance ?? 0;
          const isAdminUser =
            (uRoles as string[]).includes("admin") ||
            (uRoles as string[]).includes("super_admin") ||
            p.id === "0a1fec01-21c2-4af6-8e54-4b7ce6e2913c" ||
            p.id === "cca63804-b4c1-4221-bbd3-82258545f228" ||
            p.id === "9b729a8e-b91c-430a-907c-969652b89f3b" ||
            p.phone === "529988100395";
          const effectiveBal = isAdminUser
            ? Math.max(Number(bal), Number(bazikInfo?.adminWalletBalance || bazikInfo?.balance || 0))
            : Number(bal);
          map.set(p.id, {
            id: p.id,
            email: (p as any).email || null,
            full_name: p.full_name || (p as any).email?.split("@")[0] || "Usuario",
            phone: p.phone || null,
            country: p.country || "HT",
            language: p.language || "es",
            kyc_status: p.kyc_status || "none",
            created_at: p.created_at,
            roles: uRoles,
            balanceHTG: effectiveBal,
          });
        }
        return { users: Array.from(map.values()) };
      } catch {
        return { users: [] };
      }
    },
  });

  const usersList = usersData?.users ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              Gestión de Usuarios, Roles y Permisos
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                ({usersList.length} registrados)
              </span>
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Los nuevos usuarios se registran como clientes. Los administradores pueden nombrar
              agentes y adicionar saldo. Solo el Super Administrador puede crear administradores y sus
              permisos.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              size="sm"
              className="gap-1.5 font-bold text-xs bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs rounded-xl"
              onClick={() => setOpenRegisterSuperAgent(true)}
            >
              <Sparkles className="size-3.5 text-amber-300" />
              Registrar Super Agente
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-bold text-xs border-2 border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-2xs rounded-xl"
              onClick={() => setOpenGlobalHistory(true)}
            >
              <History className="size-3.5 text-emerald-700" />
              Historial de Saldo a Agentes
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 font-semibold text-xs border-white/20 hover:bg-white/10"
              onClick={() => {
                refetchUsers();
                toast.info("Actualizando lista de usuarios...");
              }}
            >
              <RefreshCw className={cn("size-3.5", isLoadingUsers && "animate-spin")} />
              Actualizar Lista
            </Button>
          </div>
        </div>
        <Input
          className="mt-3"
          placeholder="Buscar por nombre, correo o teléfono..."
          value={userSearch}
          onChange={(e) => setUserSearch(e.target.value)}
        />
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoadingUsers && (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Cargando usuarios registrados...
          </div>
        )}

        {!isLoadingUsers && usersList.length === 0 && (
          <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl">
            No se encontraron usuarios registrados en la base de datos.
          </div>
        )}

        {usersList
          .filter((p) => {
            const isMaster =
              p.email?.toLowerCase() === "charlesagency4@gmail.com" ||
              p.email?.toLowerCase() === "lajanrapid26@gmail.com" ||
              p.phone?.replace(/\D/g, "") === "529988100395" ||
              p.id === "0a1fec01-21c2-4af6-8e54-4b7ce6e2913c" ||
              p.id === "cca63804-b4c1-4221-bbd3-82258545f228" ||
              p.id === "9b729a8e-b91c-430a-907c-969652b89f3b";

            // Los administradores delegados no tienen acceso ni pueden ver la cuenta del Super Admin
            if (!isSuperAdmin && isMaster) {
              return false;
            }

            const q = userSearch.trim().toLowerCase();
            if (!q) return true;
            return [p.full_name, p.phone, p.email, p.id]
              .filter(Boolean)
              .some((v) => String(v).toLowerCase().includes(q));
          })
          .map((p) => {
            const isAdmin = p.roles.includes("admin");
            const isSuperAgent = p.roles.includes("super_agent");
            const isAgent = p.roles.includes("agent") || isSuperAgent;
            const adminPerms = adminsMap?.[p.id];
            const isMaster =
              p.email?.toLowerCase() === "charlesagency4@gmail.com" ||
              p.email?.toLowerCase() === "lajanrapid26@gmail.com" ||
              p.phone?.replace(/\D/g, "") === "529988100395" ||
              p.id === "0a1fec01-21c2-4af6-8e54-4b7ce6e2913c" ||
              p.id === "cca63804-b4c1-4221-bbd3-82258545f228" ||
              p.id === "9b729a8e-b91c-430a-907c-969652b89f3b";
            const isSuper = isMaster;

            return (
              <div
                key={p.id}
                className={`flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5 transition-colors ${
                  isAdmin ? "border-primary/30 bg-primary/5" : "border-border"
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">
                      {p.full_name || p.email || "Sin nombre"}
                    </p>
                    {isAdmin && (
                      <span
                        className="size-2 rounded-full bg-primary"
                        title="Administrador activo"
                      />
                    )}
                  </div>
                  <div className="flex flex-col text-xs text-muted-foreground">
                    {p.email && (
                      <span className="font-mono text-[11px] text-slate-600 font-semibold">{p.email}</span>
                    )}
                    <span className="text-slate-800 font-bold">{p.phone || "sin teléfono"}</span>
                  </div>
                  {isAgent && (
                    <div className="flex flex-wrap items-center gap-x-2 text-xs font-bold mt-1">
                      <span className="text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        Envíos: {p.balanceHTG.toLocaleString()} HTG
                      </span>
                      <span className="text-slate-400">·</span>
                      <span className="text-cyan-800 bg-cyan-50 px-2 py-0.5 rounded-md border border-cyan-200">
                        Recargas: {(p.balanceTopupsHTG ?? 0).toLocaleString()} HTG
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {isAdmin && (
                    <>
                      {adminPerms?.tenantName && (
                        <Badge className="bg-blue-50 text-blue-800 border-2 border-blue-200 gap-1 text-xs font-bold">
                          🏢 {adminPerms.tenantName}
                        </Badge>
                      )}
                      {isSuper ? (
                        <Badge className="bg-amber-50 text-amber-900 border-2 border-amber-300 gap-1 text-xs font-bold">
                          <Shield className="size-3" /> Super Admin
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="border-2 border-emerald-600 bg-emerald-50 text-emerald-800 gap-1 text-xs font-bold"
                        >
                          <Shield className="size-3" /> Admin (
                          {adminPerms?.allowedTabs?.length ?? 0} opciones permitidas)
                        </Badge>
                      )}
                    </>
                  )}
                  {isSuperAgent && !isAdmin && (
                    <Badge className="text-xs font-bold bg-indigo-50 text-indigo-900 border-2 border-indigo-300 gap-1 shadow-2xs">
                      <Sparkles className="size-3 text-indigo-600" /> Super Agente
                    </Badge>
                  )}
                  {isAgent && !isSuperAgent && !isAdmin && (
                    <Badge variant="secondary" className="text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
                      Agente
                    </Badge>
                  )}
                  {!isAdmin && !isAgent && (
                    <Badge variant="outline" className="text-xs text-slate-600 border border-slate-300 font-semibold">
                      Cliente
                    </Badge>
                  )}
                  <Badge
                    className={
                      KYC_TONE[p.kyc_status as KycStatus] || "bg-muted text-muted-foreground"
                    }
                    variant="secondary"
                  >
                    {KYC_LABEL[p.kyc_status as KycStatus] || p.kyc_status}
                  </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isAgent && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-2 border-emerald-600 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 font-black text-xs rounded-xl shadow-2xs"
                      onClick={() => setBalanceUser(p)}
                    >
                      <Coins className="size-3.5" />
                      Adicionar Saldo
                    </Button>
                  )}

                  {/* Administradores y Super Admin: pueden asignar roles y configurar opciones permitidas */}
                  {!isMaster && (
                    <Button
                      size="sm"
                      variant={isAdmin ? "default" : "outline"}
                      className={
                        isAdmin
                          ? "gap-1.5 bg-primary text-primary-foreground font-semibold text-xs"
                          : "gap-1.5 text-xs font-semibold"
                      }
                      onClick={() => setEditingUser(p)}
                    >
                      <Shield className="size-3.5" />
                      {isAdmin ? "Permisos Admin" : "Asignar Rol"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
      </CardContent>

      {/* Modal para adicionar saldo a agentes / usuarios */}
      {balanceUser && (
        <AgentBalanceModal
          isOpen={Boolean(balanceUser)}
          onClose={() => setBalanceUser(null)}
          user={balanceUser}
          onSuccess={() => {
            qc.invalidateQueries({ queryKey: ["admin-users-list"] });
          }}
        />
      )}

      {/* Modal de Histórico de Adición de Saldo a Agentes */}
      {openGlobalHistory && (
        <AgentBalanceHistoryModal
          isOpen={openGlobalHistory}
          onClose={() => setOpenGlobalHistory(false)}
        />
      )}

      {/* Modal de Registro de Super Agente */}
      {openRegisterSuperAgent && (
        <RegisterSuperAgentModal
          isOpen={openRegisterSuperAgent}
          onClose={() => setOpenRegisterSuperAgent(false)}
          onSuccess={() => refetchUsers()}
        />
      )}

      {/* Modal de edición de roles y permisos */}
      {editingUser && (
        <AdminPermissionsModal
          isOpen={Boolean(editingUser)}
          onClose={() => setEditingUser(null)}
          user={editingUser}
          currentRole={
            editingUser.roles?.includes("admin")
              ? "admin"
              : editingUser.roles?.includes("super_agent")
                ? "super_agent"
                : editingUser.roles?.includes("agent")
                  ? "agent"
                  : "client"
          }
          currentPerms={adminsMap?.[editingUser.id] ?? null}
          isSuperAdmin={isSuperAdmin}
          callerAllowedTabs={myAllowedTabs}
        />
      )}
    </Card>
  );
}

function RatesPanel() {
  const qc = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [from, setFrom] = useState("MXN");
  const [to, setTo] = useState("HTG");
  const { data: countries } = useCountries();

  const originCountries = (countries ?? []).filter((c) => c.is_origin);
  const destCountries = (countries ?? []).filter(
    (c) => c.is_destination || c.code === "HT" || c.currency === "HTG" || c.currency === "DOP",
  );

  const selectedOriginCountry = originCountries.find((c) => c.currency === from);
  const selectedDestCountry = destCountries.find((c) => c.currency === to);

  const { data: rates } = useQuery({
    queryKey: ["all-rates"],
    queryFn: async () =>
      (
        await supabase
          .from("exchange_rates")
          .select("*")
          .eq("is_active", true)
          .order("from_currency")
      ).data ?? [],
  });

  const rate = (rates ?? []).find((r) => r.from_currency === from && r.to_currency === to);
  const saveExchangeRateFn = useServerFn(adminSaveExchangeRate);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const rawRate = Number(f.get("rate"));
    const rawFeePercent = f.get("fee_percent") !== "" ? Number(f.get("fee_percent")) : 0;
    const rawFeeFixed = f.get("fee_fixed") !== "" ? Number(f.get("fee_fixed")) : 0;
    const rawAgentCommission =
      f.get("agent_commission_percent") !== "" ? Number(f.get("agent_commission_percent")) : 0;

    if (!Number.isFinite(rawRate) || rawRate <= 0) {
      toast.error("El tipo de cambio debe ser un número mayor a 0 (ej. 7.20)");
      return;
    }
    if (rawFeePercent < 0 || rawFeeFixed < 0 || rawAgentCommission < 0) {
      toast.error("Las comisiones no pueden ser números negativos");
      return;
    }

    setSaving(true);
    try {
      // 1. Intentar guardar mediante server function (con service role seguro)
      await saveExchangeRateFn({
        data: {
          from_currency: from,
          to_currency: to,
          rate: rawRate,
          fee_percent: rawFeePercent,
          fee_fixed: rawFeeFixed,
          agent_commission_percent: rawAgentCommission,
        },
      });
      toast.success("Tarifas actualizadas correctamente");
    } catch (serverErr: any) {
      console.warn("[RatesPanel] Server fn error, intentando cliente upsert:", serverErr);
      // 2. Fallback cliente upsert
      const { error } = await supabase.from("exchange_rates").upsert(
        {
          ...(rate ? { id: rate.id } : {}),
          from_currency: from,
          to_currency: to,
          rate: rawRate,
          fee_percent: rawFeePercent,
          fee_fixed: rawFeeFixed,
          agent_commission_percent: rawAgentCommission,
          is_active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "from_currency,to_currency" },
      );
      if (error) {
        console.error("[exchange_rates error]", error);
        toast.error(error.message || serverErr?.message || "No se pudo guardar la tarifa");
        setSaving(false);
        return;
      }
      toast.success("Tarifas actualizadas correctamente");
    } finally {
      setSaving(false);
      qc.invalidateQueries({ queryKey: ["all-rates"] });
      qc.invalidateQueries({ queryKey: ["rate"] });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tarifas por corredor</CardTitle>
          <p className="text-xs text-muted-foreground">
            Estas tasas se usan para calcular cuánto recibe el destinatario en los envíos de dinero.
            Las recargas de saldo móvil (DingConnect) usan su propia tasa, configurable en la
            pestaña "Tasas Ding".
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Moneda de origen</Label>
              <Select value={from} onValueChange={setFrom}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedOriginCountry
                        ? `${selectedOriginCountry.flag} ${selectedOriginCountry.name} · ${selectedOriginCountry.currency}`
                        : "Seleccionar país de origen"
                    }
                  >
                    {selectedOriginCountry
                      ? `${selectedOriginCountry.flag} ${selectedOriginCountry.name} · ${selectedOriginCountry.currency}`
                      : from}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {originCountries.map((c) => (
                    <SelectItem key={`${c.code}-${c.currency}`} value={c.currency}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Moneda de destino</Label>
              <Select value={to} onValueChange={setTo}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedDestCountry
                        ? `${selectedDestCountry.flag} ${selectedDestCountry.name} · ${selectedDestCountry.currency}`
                        : "Seleccionar país de destino"
                    }
                  >
                    {selectedDestCountry
                      ? `${selectedDestCountry.flag} ${selectedDestCountry.name} · ${selectedDestCountry.currency}`
                      : to}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {destCountries.map((c) => (
                    <SelectItem key={`${c.code}-${c.currency}`} value={c.currency}>
                      {c.flag} {c.name} · {c.currency}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <form
            onSubmit={save}
            className="grid gap-4 sm:grid-cols-2"
            key={`${from}-${to}-${rate?.id ?? "new"}-${rate?.rate ?? ""}`}
          >
            <Field
              name="rate"
              label={`Tipo de cambio (${to} por 1 ${from})`}
              value={
                rate && Number(rate.rate) > 0
                  ? Number(rate.rate)
                  : from === "MXN" && to === "HTG"
                    ? 7.2
                    : undefined
              }
              step="0.0001"
              placeholder="Ej. 7.20"
              helperText={`Cuánto ${to} recibe el destinatario por cada 1 ${from}`}
            />
            <Field
              name="fee_percent"
              label="Comisión porcentual (%)"
              value={rate?.fee_percent}
              step="0.01"
              placeholder="Ej. 1.5"
              helperText="% cobrado sobre el monto enviado"
            />
            <Field
              name="fee_fixed"
              label={`Comisión fija (${from})`}
              value={
                rate && Number(rate.rate) === 0 && Number(rate.fee_fixed) === 7.2
                  ? 15
                  : rate?.fee_fixed
              }
              step="0.01"
              placeholder="Ej. 15.00"
              helperText={`Cargo fijo por transacción en ${from}`}
            />
            <Field
              name="agent_commission_percent"
              label="Comisión del agente (%)"
              value={rate?.agent_commission_percent}
              step="0.01"
              placeholder="Ej. 0.8"
              helperText="% que gana el agente que procese la entrega"
            />
            <Button type="submit" disabled={saving} className="sm:col-span-2">
              {saving ? "Guardando…" : rate ? "Actualizar tarifas" : "Crear corredor"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Corredores activos</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2">
          {(rates ?? []).map((r) => {
            const originC = originCountries.find((c) => c.currency === r.from_currency);
            const destC = destCountries.find((c) => c.currency === r.to_currency);
            const isSelected = from === r.from_currency && to === r.to_currency;

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  setFrom(r.from_currency);
                  setTo(r.to_currency);
                }}
                className={`rounded-xl border p-3.5 text-left transition-all ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-sm"
                    : "border-border hover:bg-secondary/60 hover:border-border/80"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-sm flex items-center gap-1.5">
                    <span>{originC?.flag ?? "🌐"}</span>
                    <span>{originC?.name ?? r.from_currency}</span>
                    <span className="text-muted-foreground text-xs">({r.from_currency})</span>
                    <span className="text-primary font-bold">→</span>
                    <span>{destC?.flag ?? "🇭🇹"}</span>
                    <span>{destC?.name ?? r.to_currency}</span>
                    <span className="text-muted-foreground text-xs">({r.to_currency})</span>
                  </p>
                  {isSelected && (
                    <span className="text-[11px] font-semibold text-primary bg-primary/20 px-2 py-0.5 rounded-full">
                      Editando
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="text-emerald-400 font-medium">
                    1 {r.from_currency} ={" "}
                    {Number(r.rate).toLocaleString(undefined, { maximumFractionDigits: 4 })}{" "}
                    {r.to_currency}
                  </span>
                  <span>·</span>
                  <span>
                    Comisión: {Number(r.fee_percent)}% + {Number(r.fee_fixed)} {r.from_currency}
                  </span>
                  {Number(r.agent_commission_percent || 0) > 0 && (
                    <>
                      <span>·</span>
                      <span className="text-amber-400/90">
                        Agente: {Number(r.agent_commission_percent)}%
                      </span>
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({
  name,
  label,
  value,
  step,
  placeholder,
  helperText,
}: {
  name: string;
  label: string;
  value: number | undefined;
  step: string;
  placeholder?: string;
  helperText?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={name}>{label}</Label>
      <Input
        id={name}
        name={name}
        type="number"
        step={step}
        min={name === "rate" ? "0.0001" : "0"}
        defaultValue={value !== undefined ? value : ""}
        placeholder={placeholder ?? "0.00"}
        required={name === "rate"}
      />
      {helperText && <p className="text-[11px] text-muted-foreground">{helperText}</p>}
    </div>
  );
}

function Stat({
  label,
  value,
  isGreen,
}: {
  label: string;
  value: string;
  isGreen?: boolean;
}) {
  return (
    <Card className="bg-white border border-slate-200 shadow-sm rounded-2xl">
      <CardContent className="p-5">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p
          className={cn(
            "mt-1.5 font-display text-2xl font-black",
            isGreen ? "text-[#15803D]" : "text-slate-900",
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
