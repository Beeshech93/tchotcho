import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Shield,
  ShieldCheck,
  ShieldAlert,
  User,
  Users,
  Check,
  CheckSquare,
  Square,
  Lock,
  Sparkles,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  setUserRoleAndPermissions,
  type AdminTabId,
  type AdminPermissionsConfig,
  ALL_ADMIN_TAB_IDS,
} from "@/lib/admin-permissions.functions";

interface TabMeta {
  id: AdminTabId;
  label: string;
  desc: string;
  category: "operaciones" | "finanzas" | "configuracion" | "integraciones" | "sistema";
}

const TAB_METAS: TabMeta[] = [
  // Operaciones
  {
    id: "tx",
    label: "Transacciones",
    desc: "Aprobar, ver y cancelar envíos de dinero",
    category: "operaciones",
  },
  {
    id: "recargas",
    label: "Recargas móviles",
    desc: "Historial, detalles y reintento de recargas",
    category: "operaciones",
  },
  {
    id: "kyc",
    label: "Validación KYC",
    desc: "Revisar, aprobar o rechazar identificaciones",
    category: "operaciones",
  },
  {
    id: "soporte",
    label: "Soporte al cliente",
    desc: "Ver y responder tickets de soporte",
    category: "operaciones",
  },
  {
    id: "bulk-email",
    label: "Correo masivo",
    desc: "Enviar comunicados por correo a clientes",
    category: "operaciones",
  },
  {
    id: "operators",
    label: "Reporte operadores",
    desc: "Métricas por operador telefónico",
    category: "operaciones",
  },

  // Finanzas
  {
    id: "resumen",
    label: "Resumen y Métricas",
    desc: "KPIs, volumen y gráficos generales",
    category: "finanzas",
  },
  {
    id: "contabilidad",
    label: "Contabilidad",
    desc: "Billeteras, saldos de clientes y recargas",
    category: "finanzas",
  },
  {
    id: "tarifas",
    label: "Tarifas de remesas",
    desc: "Tasas de cambio y comisiones de envío",
    category: "finanzas",
  },
  {
    id: "topup-rates",
    label: "Tasas de recargas",
    desc: "Márgenes y tasas para recargas Ding",
    category: "finanzas",
  },
  {
    id: "cripto",
    label: "Criptomonedas",
    desc: "Billeteras cripto y depósitos",
    category: "finanzas",
  },

  // Configuración
  {
    id: "servicios",
    label: "Control de Servicios",
    desc: "Habilitar/deshabilitar envíos, recargas o cripto",
    category: "configuracion",
  },
  {
    id: "banner",
    label: "Banner Promocional",
    desc: "Gestionar anuncios y avisos en la web",
    category: "configuracion",
  },
  {
    id: "redes",
    label: "Redes Sociales",
    desc: "Conectar cuentas oficiales de redes sociales",
    category: "configuracion",
  },

  // Integraciones
  {
    id: "mercadopago",
    label: "Mercado Pago",
    desc: "Credenciales y cobros en México",
    category: "integraciones",
  },
  {
    id: "stripe",
    label: "Stripe",
    desc: "Pasarela para tarjetas internacionales",
    category: "integraciones",
  },
  {
    id: "dingconnect",
    label: "DingConnect",
    desc: "Conexión para recargas de saldo",
    category: "integraciones",
  },
  {
    id: "bazik",
    label: "Bazik API",
    desc: "Dispersión a MonCash y NatCash",
    category: "integraciones",
  },
  {
    id: "resend",
    label: "Servicio de Correo",
    desc: "API key de Resend y remitente",
    category: "integraciones",
  },

  // Sistema
  {
    id: "usuarios",
    label: "Gestión de Usuarios",
    desc: "Ver y gestionar clientes y agentes (excepto Super Admin)",
    category: "sistema",
  },
  {
    id: "security",
    label: "Seguridad y Auditoría",
    desc: "Logs de seguridad y bloqueos",
    category: "sistema",
  },
  {
    id: "migracion",
    label: "Migración IA",
    desc: "Herramienta de migración asistida",
    category: "sistema",
  },
];

const CATEGORY_TITLES = {
  operaciones: "Operaciones y Clientes",
  finanzas: "Finanzas y Tasas",
  configuracion: "Configuración General",
  integraciones: "Integraciones y Pasarelas",
  sistema: "Seguridad y Administración",
};

const OPERATIONAL_TABS: AdminTabId[] = ["tx", "recargas", "kyc", "soporte", "redes", "operators"];

const AVAILABLE_ADMIN_TABS: AdminTabId[] = ALL_ADMIN_TAB_IDS;

interface AdminPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: {
    id: string;
    full_name?: string | null;
    phone?: string | null;
  } | null;
  currentRole: "admin" | "super_agent" | "agent" | "client";
  currentPerms?: AdminPermissionsConfig | null;
  isSuperAdmin?: boolean;
  callerAllowedTabs?: AdminTabId[];
}

export function AdminPermissionsModal({
  isOpen,
  onClose,
  user,
  currentRole,
  currentPerms,
  isSuperAdmin = false,
  callerAllowedTabs = ALL_ADMIN_TAB_IDS,
}: AdminPermissionsModalProps) {
  const qc = useQueryClient();
  const saveRoleAndPerms = useServerFn(setUserRoleAndPermissions);

  const effectiveCallerTabs = isSuperAdmin ? ALL_ADMIN_TAB_IDS : callerAllowedTabs;

  const [role, setRole] = useState<"admin" | "super_agent" | "agent" | "client">(currentRole);
  const [selectedTabs, setSelectedTabs] = useState<AdminTabId[]>(effectiveCallerTabs);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (user) {
      setRole(currentRole);
      if (currentRole === "admin") {
        setSelectedTabs(
          currentPerms?.allowedTabs?.length
            ? (currentPerms.allowedTabs as AdminTabId[])
            : effectiveCallerTabs,
        );
      } else {
        setSelectedTabs(effectiveCallerTabs);
      }
    }
  }, [user, currentRole, currentPerms, isSuperAdmin, callerAllowedTabs]);

  if (!user) return null;

  const toggleTab = (id: AdminTabId) => {
    if (!isSuperAdmin && !effectiveCallerTabs.includes(id)) {
      toast.info("Este acceso está reservado y requiere la autorización del Super Administrador.");
      return;
    }
    setSelectedTabs((prev) => (prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]));
  };

  const handleSelectAll = () => setSelectedTabs([...effectiveCallerTabs]);
  const handleSelectOps = () => {
    const ops = OPERATIONAL_TABS.filter((t) => isSuperAdmin || effectiveCallerTabs.includes(t));
    setSelectedTabs(ops);
  };
  const handleClearAll = () => setSelectedTabs([]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await saveRoleAndPerms({
        data: {
          targetUserId: user.id,
          role,
          isSuperAdmin: false,
          allowedTabs: role === "admin" ? selectedTabs : [],
        },
      });

      toast.success("Rol y permisos actualizados correctamente");
      qc.invalidateQueries({ queryKey: ["admin-roles"] });
      qc.invalidateQueries({ queryKey: ["admin-profiles"] });
      qc.invalidateQueries({ queryKey: ["all-admins-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-admin-permissions"] });
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "No se pudo actualizar los permisos");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <Shield className="size-5 text-primary" />
            Configurar Rol y Permisos
          </DialogTitle>
          <DialogDescription>
            Administra los privilegios de acceso y restricciones para{" "}
            <span className="font-semibold text-foreground">
              {user.full_name || user.phone || user.id}
            </span>
            .
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* 1. Selector de Rol */}
          <div className="space-y-3">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Seleccionar Rol del Usuario
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Cliente */}
              <button
                type="button"
                onClick={() => setRole("client")}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  role === "client"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/60 hover:border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <User className="size-5 text-muted-foreground" />
                  {role === "client" && <Check className="size-4 text-primary" />}
                </div>
                <p className="font-bold text-sm mt-2">Cliente</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Usuario regular sin acceso administrativo.
                </p>
              </button>

              {/* Agente */}
              <button
                type="button"
                onClick={() => setRole("agent")}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  role === "agent"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/60 hover:border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Users className="size-5 text-amber-500" />
                  {role === "agent" && <Check className="size-4 text-primary" />}
                </div>
                <p className="font-bold text-sm mt-2">Agente</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Acceso al portal de agentes para cobrar/enviar.
                </p>
              </button>

              {/* Super Agente */}
              <button
                type="button"
                onClick={() => setRole("super_agent")}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  role === "super_agent"
                    ? "border-indigo-600 bg-indigo-50/70 ring-2 ring-indigo-400 text-indigo-950"
                    : "border-border/60 hover:border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <Sparkles className="size-5 text-indigo-600" />
                  {role === "super_agent" && <Check className="size-4 text-indigo-600" />}
                </div>
                <p className="font-bold text-sm mt-2 text-indigo-950">Super Agente</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  Agente principal con privilegios operativos y límites extendidos.
                </p>
              </button>

              {/* Administrador */}
              <button
                type="button"
                onClick={() => {
                  setRole("admin");
                  if (!currentPerms?.allowedTabs?.length) {
                    setSelectedTabs(effectiveCallerTabs);
                  }
                }}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer ${
                  role === "admin"
                    ? "border-primary bg-primary/10 ring-2 ring-primary/20"
                    : "border-border/60 hover:border-border hover:bg-secondary/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <ShieldCheck className="size-5 text-primary" />
                  {role === "admin" && <Check className="size-4 text-primary" />}
                </div>
                <p className="font-bold text-sm mt-2">Administrador</p>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {isSuperAdmin
                    ? "Acceso completo o personalizado a las opciones del panel."
                    : "Hereda los accesos y módulos que posees como Administrador."}
                </p>
              </button>
            </div>
          </div>

          {/* 2. Opciones de Administrador (Permisos y Opciones Permitidas) */}
          {role === "admin" && (
            <div className="space-y-4 rounded-2xl bg-secondary/30 p-4 border border-border/50 animate-in fade-in duration-200">
              {!isSuperAdmin && (
                <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-950">
                  <ShieldCheck className="size-4 text-[#15803D] shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-emerald-900">
                      Delegación con tus accesos activos ({effectiveCallerTabs.length} módulos)
                    </p>
                    <p className="text-slate-600 mt-0.5">
                      Como Administrador, otorgas los accesos que actualmente posees. Los módulos adicionales están reservados y requieren la autorización del Super Administrador.
                    </p>
                  </div>
                </div>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <Label className="font-bold text-base">
                      Opciones y Módulos Permitidos
                    </Label>
                    <Badge variant="outline" className="border-emerald-300 text-emerald-800 bg-emerald-50 gap-1 text-[11px] font-bold">
                      <ShieldCheck className="size-3 text-emerald-700" /> {selectedTabs.length} de {isSuperAdmin ? AVAILABLE_ADMIN_TABS.length : effectiveCallerTabs.length} {isSuperAdmin ? "activos" : "permitidos"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecciona a qué secciones tendrá acceso este administrador en el panel.
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleSelectAll}
                  >
                    {isSuperAdmin ? "Todos" : "Mis Accesos"}
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={handleSelectOps}
                  >
                    Solo Operaciones
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-muted-foreground"
                    onClick={handleClearAll}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>

              {/* Selector de permisos granulares — Solo módulos autorizados */}
              <div className="space-y-4 pt-3 border-t border-border/50">
                  {/* Lista de módulos por categoría (filtrando no autorizados) */}
                  {(
                    [
                      "operaciones",
                      "finanzas",
                      "configuracion",
                      "integraciones",
                      "sistema",
                    ] as const
                  ).map((cat) => {
                    const items = TAB_METAS.filter(
                      (m) => m.category === cat && (isSuperAdmin || effectiveCallerTabs.includes(m.id)),
                    );
                    if (items.length === 0) return null;
                    return (
                      <div key={cat} className="space-y-2">
                        <p className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                          <span className="size-1.5 rounded-full bg-emerald-600" />
                          {CATEGORY_TITLES[cat]}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {items.map((tab) => {
                            const checked = selectedTabs.includes(tab.id);
                            return (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => toggleTab(tab.id)}
                                className={`flex items-start gap-2.5 p-2.5 rounded-xl border-2 text-left transition-colors cursor-pointer ${
                                  checked
                                    ? "border-emerald-500 bg-emerald-50/70 text-slate-900 shadow-2xs"
                                    : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                              >
                                <div className="mt-0.5 shrink-0">
                                  {checked ? (
                                    <CheckSquare className="size-4 text-emerald-700" />
                                  ) : (
                                    <Square className="size-4 text-slate-400" />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="font-extrabold text-xs text-slate-900 leading-tight">
                                    {tab.label}
                                  </p>
                                  <p className="text-[11px] text-slate-500 font-medium leading-tight mt-0.5 truncate">
                                    {tab.desc}
                                  </p>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
            </div>
          )}
        </div>

        <DialogFooter className="flex-row justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={onClose} disabled={isSaving}>
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2 bg-primary text-primary-foreground font-bold"
          >
            {isSaving ? "Guardando..." : "Guardar Permisos"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
