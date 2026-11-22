import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import {
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  ExternalLink,
  ShieldCheck,
  User,
  Phone,
  Mail,
  Calendar,
  MapPin,
  RefreshCw,
  FileText,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeInvalidate } from "@/hooks/useRealtimeInvalidate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { KYC_LABEL, KYC_TONE, shortDate, type KycStatus } from "@/lib/remesa";
import {
  adminGetKycSubmissions,
  adminGetKycDocumentUrls,
  adminReviewKycSubmission,
} from "@/lib/kyc.functions";

type EnrichedKycRow = {
  id: string;
  user_id: string;
  document_type: string;
  document_number: string;
  address: string;
  birth_date: string;
  status: string;
  review_notes: string | null;
  document_photo_path: string | null;
  document_back_path: string | null;
  created_at: string;
  user_full_name?: string;
  user_phone?: string;
  user_email?: string | null;
  current_kyc_status?: string;
};

const COMMON_REJECTION_REASONS = [
  "La foto del documento está borrosa o ilegible.",
  "El documento de identidad está vencido.",
  "Falta la foto del reverso del documento.",
  "El nombre en el documento no coincide con el perfil.",
  "El documento está cortado o no se ven las 4 esquinas.",
  "Documento no válido (se requiere identificación oficial vigente).",
];

export function KycPanel() {
  const qc = useQueryClient();
  useRealtimeInvalidate("kyc_submissions", ["admin-kyc"]);

  const [activeTab, setActiveTab] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [search, setSearch] = useState("");
  const [viewer, setViewer] = useState<{
    submissionId: string;
    targetRow: EnrichedKycRow;
    front?: string | null;
    back?: string | null;
    loading: boolean;
  } | null>(null);

  const [rejectTarget, setRejectTarget] = useState<EnrichedKycRow | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: submissions = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-kyc"],
    queryFn: async () => {
      try {
        const res = await adminGetKycSubmissions();
        if (res && res.submissions) return res.submissions as EnrichedKycRow[];
      } catch (err) {
        console.warn("[KycPanel] Fallback a cliente Supabase:", err);
      }
      // Fallback si la función de servidor falla
      const { data } = await supabase
        .from("kyc_submissions")
        .select("*")
        .order("created_at", { ascending: false });
      return (data ?? []) as EnrichedKycRow[];
    },
  });

  const filtered = useMemo(() => {
    return submissions.filter((item) => {
      // Filtro de pestaña
      if (activeTab !== "all" && item.status !== activeTab) {
        return false;
      }
      // Filtro de búsqueda
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        item.user_full_name?.toLowerCase().includes(q) ||
        item.user_phone?.toLowerCase().includes(q) ||
        item.user_email?.toLowerCase().includes(q) ||
        item.document_number?.toLowerCase().includes(q) ||
        item.document_type?.toLowerCase().includes(q) ||
        item.address?.toLowerCase().includes(q)
      );
    });
  }, [submissions, activeTab, search]);

  const counts = useMemo(() => {
    return {
      all: submissions.length,
      pending: submissions.filter((s) => s.status === "pending").length,
      approved: submissions.filter((s) => s.status === "approved").length,
      rejected: submissions.filter((s) => s.status === "rejected").length,
    };
  }, [submissions]);

  const viewDocuments = async (row: EnrichedKycRow) => {
    setViewer({
      submissionId: row.id,
      targetRow: row,
      front: null,
      back: null,
      loading: true,
    });

    try {
      // Intentar vía función de servidor segura
      const res = await adminGetKycDocumentUrls({ data: { submissionId: row.id } });
      if (res && (res.frontUrl || res.backUrl)) {
        setViewer({
          submissionId: row.id,
          targetRow: row,
          front: res.frontUrl,
          back: res.backUrl,
          loading: false,
        });
        return;
      }
    } catch {
      // Fallback a Storage cliente
    }

    const urls: { front?: string; back?: string } = {};
    if (row.document_photo_path) {
      const { data: signed } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(row.document_photo_path, 3600);
      if (signed?.signedUrl) urls.front = signed.signedUrl;
    }
    if (row.document_back_path) {
      const { data: signed } = await supabase.storage
        .from("kyc-documents")
        .createSignedUrl(row.document_back_path, 3600);
      if (signed?.signedUrl) urls.back = signed.signedUrl;
    }

    if (!urls.front && !urls.back) {
      toast.error("Esta solicitud no tiene fotos adjuntas o expiraron.");
      setViewer(null);
      return;
    }

    setViewer({
      submissionId: row.id,
      targetRow: row,
      front: urls.front || null,
      back: urls.back || null,
      loading: false,
    });
  };

  const handleReview = async (
    submissionId: string,
    userId: string,
    status: "approved" | "rejected",
    notes?: string,
  ) => {
    setIsProcessing(true);
    try {
      await adminReviewKycSubmission({
        data: {
          submissionId,
          status,
          notes: notes || undefined,
        },
      });
      toast.success(status === "approved" ? "KYC aprobado exitosamente" : "KYC rechazado");
      qc.invalidateQueries({ queryKey: ["admin-kyc"] });
      if (viewer && viewer.submissionId === submissionId) {
        setViewer(null);
      }
    } catch (err) {
      console.error("[KycPanel] Error revisando:", err);
      // Fallback cliente
      const { error } = await supabase
        .from("kyc_submissions")
        .update({ status, review_notes: notes || null })
        .eq("id", submissionId);
      if (!error) {
        await supabase.from("profiles").update({ kyc_status: status }).eq("id", userId);
        toast.success(status === "approved" ? "KYC aprobado exitosamente" : "KYC rechazado");
        qc.invalidateQueries({ queryKey: ["admin-kyc"] });
        if (viewer) setViewer(null);
      } else {
        toast.error(error.message || "No se pudo actualizar el estado de KYC.");
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-black text-slate-900 flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-600" />
              Verificación de Identidad (KYC)
            </CardTitle>
            <CardDescription className="text-xs text-slate-500 mt-0.5">
              Revisa y valida la documentación de los clientes para habilitar sus transferencias y envíos.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refetch()}
            className="self-start sm:self-auto gap-1.5 h-8 text-xs font-bold"
          >
            <RefreshCw className="size-3.5" />
            Actualizar
          </Button>
        </div>

        {/* Pestañas de estado y Búsqueda */}
        <div className="pt-3 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as any)}
            className="w-full md:w-auto"
          >
            <TabsList className="grid grid-cols-4 w-full md:w-auto h-9">
              <TabsTrigger value="all" className="text-xs font-bold">
                Todas ({counts.all})
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="text-xs font-bold text-amber-700 data-[state=active]:text-amber-800"
              >
                Pendientes ({counts.pending})
              </TabsTrigger>
              <TabsTrigger
                value="approved"
                className="text-xs font-bold text-emerald-700 data-[state=active]:text-emerald-800"
              >
                Aprobadas ({counts.approved})
              </TabsTrigger>
              <TabsTrigger
                value="rejected"
                className="text-xs font-bold text-rose-700 data-[state=active]:text-rose-800"
              >
                Rechazadas ({counts.rejected})
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 size-4 text-slate-400" />
            <Input
              placeholder="Buscar por nombre, tel, doc..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {isLoading && (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <RefreshCw className="size-4 animate-spin" /> Cargando solicitudes...
          </div>
        )}

        {!isLoading && filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400 border border-dashed rounded-xl bg-slate-50/50">
            <FileText className="size-8 mx-auto mb-2 text-slate-300" />
            <p className="text-sm font-bold text-slate-600">No hay solicitudes de verificación</p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? "No hay resultados para tu búsqueda." : "Cuando los usuarios envíen sus documentos, aparecerán aquí."}
            </p>
          </div>
        )}

        {!isLoading &&
          filtered.map((k) => (
            <div
              key={k.id}
              className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3.5 hover:border-emerald-300 transition-all shadow-2xs"
            >
              {/* Información del Cliente */}
              <div className="space-y-1.5 min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="inline-flex items-center gap-1.5 font-bold text-slate-900 text-sm">
                    <User className="size-3.5 text-slate-400 shrink-0" />
                    <span>{k.user_full_name || "Usuario"}</span>
                  </div>

                  <Badge className={KYC_TONE[k.status as KycStatus] || "bg-slate-100 text-slate-800"} variant="secondary">
                    {KYC_LABEL[k.status as KycStatus] || k.status}
                  </Badge>

                  <span className="text-[11px] font-medium text-slate-400">
                    {shortDate(k.created_at)}
                  </span>
                </div>

                {/* Detalles de contacto y documento */}
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span className="font-semibold text-emerald-950 uppercase bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    {k.document_type}: {k.document_number}
                  </span>

                  {k.user_phone && (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Phone className="size-3 text-slate-400" />
                      {k.user_phone}
                    </span>
                  )}

                  {k.user_email && (
                    <span className="inline-flex items-center gap-1 text-slate-500">
                      <Mail className="size-3 text-slate-400" />
                      {k.user_email}
                    </span>
                  )}

                  <span className="inline-flex items-center gap-1 text-slate-500">
                    <Calendar className="size-3 text-slate-400" />
                    Nac: {k.birth_date}
                  </span>

                  <span className="inline-flex items-center gap-1 text-slate-500 truncate max-w-xs">
                    <MapPin className="size-3 text-slate-400 shrink-0" />
                    {k.address}
                  </span>
                </div>

                {k.review_notes && (
                  <div className="mt-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-2 rounded-lg">
                    <span className="font-bold">Motivo de rechazo:</span> {k.review_notes}
                  </div>
                )}
              </div>

              {/* Acciones */}
              <div className="flex items-center gap-2 shrink-0 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 h-8 text-xs font-bold"
                  onClick={() => void viewDocuments(k)}
                >
                  <Eye className="size-3.5 text-slate-600" /> Ver documento
                </Button>

                {k.status === "pending" && (
                  <>
                    <Button
                      size="sm"
                      className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1 h-8 text-xs font-bold shadow-xs"
                      disabled={isProcessing}
                      onClick={() => void handleReview(k.id, k.user_id, "approved")}
                    >
                      <CheckCircle2 className="size-3.5" /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="gap-1 h-8 text-xs font-bold shadow-xs"
                      disabled={isProcessing}
                      onClick={() => {
                        setRejectTarget(k);
                        setRejectReason("");
                      }}
                    >
                      <XCircle className="size-3.5" /> Rechazar
                    </Button>
                  </>
                )}

                {k.status === "rejected" && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 gap-1 h-8 text-xs font-bold"
                    disabled={isProcessing}
                    onClick={() => void handleReview(k.id, k.user_id, "approved")}
                  >
                    <CheckCircle2 className="size-3.5" /> Re-aprobar
                  </Button>
                )}
              </div>
            </div>
          ))}
      </CardContent>

      {/* MODAL DE VISUALIZACIÓN DE DOCUMENTOS */}
      <Dialog open={!!viewer} onOpenChange={(open) => !open && setViewer(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between text-base">
              <span>Documentos de {viewer?.targetRow.user_full_name}</span>
              {viewer?.targetRow && (
                <Badge className={KYC_TONE[viewer.targetRow.status as KycStatus]} variant="secondary">
                  {KYC_LABEL[viewer.targetRow.status as KycStatus]}
                </Badge>
              )}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {viewer?.targetRow.document_type.toUpperCase()} · {viewer?.targetRow.document_number} · Nac:{" "}
              {viewer?.targetRow.birth_date} · {viewer?.targetRow.address}
            </DialogDescription>
          </DialogHeader>

          {viewer?.loading ? (
            <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
              <RefreshCw className="size-4 animate-spin" /> Cargando imágenes del documento...
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 pt-2">
              {viewer?.front ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700">Frente del documento</p>
                    <a
                      href={viewer.front}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 font-bold"
                    >
                      <ExternalLink className="size-3" /> Ver completa
                    </a>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-1 overflow-hidden shadow-xs">
                    <img
                      src={viewer.front}
                      alt="Frente del documento"
                      className="rounded-lg w-full max-h-72 object-contain bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-xs text-slate-400">
                  Sin foto frontal
                </div>
              )}

              {viewer?.back ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-slate-700">Reverso del documento</p>
                    <a
                      href={viewer.back}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-emerald-600 hover:underline inline-flex items-center gap-1 font-bold"
                    >
                      <ExternalLink className="size-3" /> Ver completa
                    </a>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-1 overflow-hidden shadow-xs">
                    <img
                      src={viewer.back}
                      alt="Reverso del documento"
                      className="rounded-lg w-full max-h-72 object-contain bg-white"
                    />
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed p-6 text-center text-xs text-slate-400 flex flex-col items-center justify-center">
                  <p>Sin foto trasera</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">(Opcional en pasaportes)</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="pt-4 border-t flex-col sm:flex-row gap-2 justify-between items-center">
            <Button variant="outline" size="sm" onClick={() => setViewer(null)}>
              Cerrar
            </Button>

            {viewer?.targetRow && viewer.targetRow.status === "pending" && (
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="destructive"
                  disabled={isProcessing}
                  onClick={() => {
                    const row = viewer.targetRow;
                    setRejectTarget(row);
                    setRejectReason("");
                  }}
                >
                  <XCircle className="size-3.5 mr-1" /> Rechazar
                </Button>
                <Button
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                  disabled={isProcessing}
                  onClick={() =>
                    void handleReview(viewer.targetRow.id, viewer.targetRow.user_id, "approved")
                  }
                >
                  <CheckCircle2 className="size-3.5 mr-1" /> Aprobar Verificación
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL PARA RECHAZAR CON MOTIVO */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base text-rose-900 flex items-center gap-2">
              <XCircle className="size-5 text-rose-600" /> Rechazar verificación
            </DialogTitle>
            <DialogDescription className="text-xs">
              Indica la razón clara del rechazo. El cliente la verá en su perfil para corregir y reenviar los documentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <p className="text-xs font-bold text-slate-700">Motivos rápidos frecuentes:</p>
            <div className="flex flex-wrap gap-1.5">
              {COMMON_REJECTION_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setRejectReason(reason)}
                  className="text-[11px] text-left rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 hover:border-slate-300 px-2.5 py-1 text-slate-700 transition"
                >
                  {reason}
                </button>
              ))}
            </div>

            <div className="space-y-1 pt-1">
              <label className="text-xs font-bold text-slate-700">Detalle o motivo específico:</label>
              <Textarea
                placeholder="Escribe el motivo del rechazo para el cliente..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                maxLength={300}
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <DialogFooter className="pt-3">
            <Button variant="outline" size="sm" onClick={() => setRejectTarget(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={!rejectReason.trim() || isProcessing}
              onClick={() => {
                if (!rejectTarget) return;
                void handleReview(
                  rejectTarget.id,
                  rejectTarget.user_id,
                  "rejected",
                  rejectReason.trim(),
                );
                setRejectTarget(null);
              }}
            >
              Confirmar Rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
