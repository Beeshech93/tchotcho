import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  PlugZap,
  Wallet,
  RefreshCw,
  ArrowRightLeft,
  CheckCircle2,
  Clock,
  ShieldCheck,
  Coins,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  bazikSaveCredentials,
  bazikStatus,
  bazikTestAuth,
  bazikSyncBalance,
} from "@/lib/bazik.functions";

const CRED_KEYS = [
  "BAZIK_BASE_URL",
  "BAZIK_USER_ID",
  "BAZIK_SECRET_KEY",
  "BAZIK_WEBHOOK_SECRET",
  "BAZIK_ENVIRONMENT",
] as const;
type CredKey = (typeof CRED_KEYS)[number];

const EMPTY: Record<CredKey, string> = {
  BAZIK_BASE_URL: "https://api.bazik.io",
  BAZIK_USER_ID: "",
  BAZIK_SECRET_KEY: "",
  BAZIK_WEBHOOK_SECRET: "",
  BAZIK_ENVIRONMENT: "production",
};

export function BazikPanel() {
  const status = useServerFn(bazikStatus);
  const testAuth = useServerFn(bazikTestAuth);
  const saveCreds = useServerFn(bazikSaveCredentials);
  const syncBalance = useServerFn(bazikSyncBalance);
  const queryClient = useQueryClient();

  const [manualAmount, setManualAmount] = useState("");
  const [showManualInput, setShowManualInput] = useState(false);

  const {
    data: info,
    error: statusError,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["bazik_status"],
    queryFn: () => status(),
    retry: false,
  });

  const [creds, setCreds] = useState<Record<CredKey, string>>(EMPTY);
  const setCred = (k: CredKey, v: string) => setCreds((p) => ({ ...p, [k]: v }));

  const saveMut = useMutation({
    mutationFn: () => {
      const payload: Partial<Record<CredKey, string>> = {};
      for (const k of CRED_KEYS) if (creds[k].trim()) payload[k] = creds[k].trim();
      if (Object.keys(payload).length === 0) throw new Error("Nada para guardar");
      return saveCreds({ data: payload });
    },
    onSuccess: () => {
      toast.success("Credenciales guardadas");
      setCreds(EMPTY);
      void queryClient.invalidateQueries({ queryKey: ["bazik_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const testMut = useMutation({
    mutationFn: () => testAuth(),
    onSuccess: (r) => {
      if (r.ok) toast.success("Autenticación con Bazik exitosa");
      else toast.error(r.error);
      void queryClient.invalidateQueries({ queryKey: ["bazik_status"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const syncMut = useMutation({
    mutationFn: async (amount?: number) => {
      return syncBalance({ data: amount !== undefined ? { manualBalance: amount } : undefined });
    },
    onSuccess: (res) => {
      toast.success(res.message);
      setManualAmount("");
      setShowManualInput(false);
      void queryClient.invalidateQueries({ queryKey: ["bazik_status"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-users-list"] });
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      void queryClient.invalidateQueries({ queryKey: ["admin-transfers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSyncAutomatic = () => {
    syncMut.mutate(undefined);
  };

  const handleSyncManual = () => {
    const parsed = parseFloat(manualAmount.replace(/,/g, ""));
    if (isNaN(parsed) || parsed < 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    syncMut.mutate(parsed);
  };

  const currentBazikBalance = info?.balance ?? null;
  const adminWalletBalance =
    info?.adminWalletBalance && info.adminWalletBalance > 0
      ? info.adminWalletBalance
      : info?.balance ?? 0;

  return (
    <div className="space-y-4">
      {/* TARJETA DESTACADA: SINCRONIZACIÓN DE SALDO CON LA BILLETERA ADMIN */}
      <Card className="border-2 border-emerald-300 bg-gradient-to-br from-emerald-50/80 via-white to-emerald-50/30 shadow-sm rounded-2xl overflow-hidden">
        <CardHeader className="pb-3 border-b border-emerald-100 bg-emerald-50/50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-black text-emerald-950 flex items-center gap-2">
                <Coins className="size-5 text-emerald-600" />
                Sincronización de Saldo Bazik ⇄ Saldo Admin
              </CardTitle>
              <CardDescription className="text-xs text-emerald-800/80 font-medium mt-0.5">
                Mantén sincronizado el saldo operativo de tu cuenta de Bazik (MonCash) con la billetera principal del Administrador.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => void refetch()}
                disabled={isFetching}
                className="gap-1.5 h-8 text-xs font-bold border-emerald-300 text-emerald-800 hover:bg-emerald-100"
              >
                <RefreshCw className={`size-3.5 ${isFetching ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {/* Alertas de Estado Informativas */}
          {!info?.configured && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-xs text-amber-900 flex items-start gap-2.5">
              <span className="text-base">⚠️</span>
              <div className="space-y-1">
                <p className="font-bold">Credenciales de Bazik aún no configuradas</p>
                <p className="text-amber-800 text-[11px]">
                  Para ver tu saldo real de Bazik en vivo y habilitar la sincronización automática vía API, ingresa tu <strong>User ID</strong> y <strong>Secret Key</strong> en el formulario <em>"Configurar Credenciales de Bazik"</em> más abajo y haz clic en <strong>Guardar credenciales</strong>.
                </p>
              </div>
            </div>
          )}

          {info?.configured && !info?.authOk && (
            <div className="rounded-xl border border-rose-300 bg-rose-50 p-3.5 text-xs text-rose-900 flex items-start gap-2.5">
              <span className="text-base">❌</span>
              <div className="space-y-1">
                <p className="font-bold">Error de autenticación con Bazik</p>
                <p className="text-rose-800 text-[11px]">
                  {info.authError ?? "Bazik rechazó las credenciales. Verifica que el User ID y la Secret Key correspondan a tu cuenta activa en Bazik.io."}
                </p>
              </div>
            </div>
          )}

          {info?.configured && info?.authOk && (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3.5 text-xs text-emerald-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                <p className="font-bold text-emerald-900 text-xs">
                  Conexión en vivo con Bazik activa y autenticada correctamente.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => syncMut.mutate(undefined)}
                disabled={syncMut.isPending}
                className="h-7 text-[11px] font-bold border-emerald-400 text-emerald-900 hover:bg-emerald-100"
              >
                {syncMut.isPending ? "Sincronizando..." : "Sincronizar con Billetera Admin"}
              </Button>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Balance en Bazik */}
            <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Saldo Reportado en Bazik
              </span>
              <p className="mt-1 text-2xl font-black text-emerald-700">
                {currentBazikBalance !== null
                  ? `${currentBazikBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} HTG`
                  : info?.configured
                    ? "Consultando saldo..."
                    : "Sin configurar"}
              </p>
              <p className="mt-1 text-[11px] text-slate-500 flex items-center gap-1">
                <Clock className="size-3 text-slate-400" />
                {info?.lastSyncedAt
                  ? `Último sync: ${new Date(info.lastSyncedAt).toLocaleString()}`
                  : info?.configured
                    ? "En espera de sincronización"
                    : "Requiere User ID y Secret Key"}
              </p>
            </div>

            {/* Balance en Billetera Admin */}
            <div className="rounded-xl border border-emerald-200 bg-white p-4 shadow-2xs">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Saldo Billetera Admin (HTG)
              </span>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {adminWalletBalance.toLocaleString("en-US", { minimumFractionDigits: 2 })} HTG
              </p>
              <p className="mt-1 text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                <ShieldCheck className="size-3 text-emerald-600" />
                Billetera operativa del Administrador
              </p>
            </div>

            {/* Acción de Sincronización */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-500/10 p-4 flex flex-col justify-between sm:col-span-2 lg:col-span-1 shadow-2xs">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                  Acción Inmediata
                </span>
                <p className="text-xs text-emerald-950 mt-1">
                  Sincroniza el saldo de Bazik para que se refleje de inmediato en tu cuenta y dashboard.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <Button
                  size="sm"
                  onClick={handleSyncAutomatic}
                  disabled={syncMut.isPending || !info?.configured}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-sm"
                >
                  <ArrowRightLeft className="size-3.5" />
                  {syncMut.isPending ? "Sincronizando..." : "Sincronizar vía API"}
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowManualInput(!showManualInput)}
                  className="border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-bold"
                >
                  {showManualInput ? "Cancelar" : "Sincronizar Monto"}
                </Button>
              </div>
            </div>
          </div>

          {/* Formulario de Sincronización Manual de Saldo */}
          {showManualInput && (
            <div className="rounded-xl border-2 border-emerald-400/80 bg-white p-4 space-y-3 shadow-sm animate-in fade-in duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold text-slate-900">
                    Sincronización directa / manual de saldo Bazik
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Si recién depositaste en tu cuenta Bazik o deseas reflejar el saldo exacto de tu portal Bazik.io:
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="any"
                    placeholder="Ej. 150000"
                    value={manualAmount}
                    onChange={(e) => setManualAmount(e.target.value)}
                    className="h-9 text-xs font-bold pl-3 pr-14"
                  />
                  <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-400">
                    HTG
                  </span>
                </div>

                <Button
                  size="sm"
                  disabled={syncMut.isPending || !manualAmount.trim()}
                  onClick={handleSyncManual}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-9 text-xs gap-1.5 shrink-0"
                >
                  <CheckCircle2 className="size-3.5" />
                  Confirmar y Sincronizar en Admin
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* DETALLES DE CONEXIÓN Y CREDENCIALES */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <PlugZap className="size-4 text-emerald-600" /> Conexión con Bazik
              <Badge variant={info?.configured ? "secondary" : "destructive"}>
                {statusError ? "Sin datos" : info?.configured ? "Configurado" : "Sin configurar"}
              </Badge>
              {info?.configured ? (
                <Badge variant={info.authOk ? "default" : "destructive"}>
                  {info.authOk ? "Autenticación OK" : "Error de autenticación"}
                </Badge>
              ) : null}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {info?.baseUrl ? (
              <p className="text-xs text-muted-foreground">
                {info.baseUrl} · entorno: {info.environment}
              </p>
            ) : null}
            {statusError ? (
              <p className="text-xs text-destructive">
                No se pudo cargar el estado:{" "}
                {statusError instanceof Error ? statusError.message : "Error de conexión"}.{" "}
                <button className="underline" onClick={() => void refetch()}>
                  Reintentar
                </button>
              </p>
            ) : null}
            {info?.authError ? (
              <p className="text-xs text-destructive">
                {info.authError} Revisa que el User ID y la Secret Key sean los actuales de tu cuenta
                Bazik.
              </p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              MonCash y NatCash · máx. 75,000 HTG por transacción · límite 100 req/min.
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={testMut.isPending || !info?.configured}
              onClick={() => testMut.mutate()}
            >
              Probar autenticación
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Credenciales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bazik-url">URL base de la API</Label>
              <Input
                id="bazik-url"
                placeholder={info?.baseUrl ?? "https://api.bazik.io"}
                value={creds.BAZIK_BASE_URL}
                onChange={(e) => setCred("BAZIK_BASE_URL", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bazik-userid">User ID</Label>
              <Input
                id="bazik-userid"
                type="password"
                placeholder="userID de Bazik"
                value={creds.BAZIK_USER_ID}
                onChange={(e) => setCred("BAZIK_USER_ID", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bazik-secret">Secret Key</Label>
              <Input
                id="bazik-secret"
                type="password"
                placeholder="secretKey de Bazik"
                value={creds.BAZIK_SECRET_KEY}
                onChange={(e) => setCred("BAZIK_SECRET_KEY", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bazik-webhook">Webhook secret (opcional)</Label>
              <Input
                id="bazik-webhook"
                type="password"
                placeholder="Secreto para verificar webhooks"
                value={creds.BAZIK_WEBHOOK_SECRET}
                onChange={(e) => setCred("BAZIK_WEBHOOK_SECRET", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bazik-env">Entorno</Label>
              <Select
                {...(creds.BAZIK_ENVIRONMENT ? { value: creds.BAZIK_ENVIRONMENT } : {})}
                onValueChange={(v) => setCred("BAZIK_ENVIRONMENT", v)}
              >
                <SelectTrigger id="bazik-env">
                  <SelectValue placeholder={info?.environment ?? "production"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">Sandbox</SelectItem>
                  <SelectItem value="production">Producción</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              size="sm"
              disabled={saveMut.isPending}
              onClick={() => saveMut.mutate()}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              Guardar credenciales
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
