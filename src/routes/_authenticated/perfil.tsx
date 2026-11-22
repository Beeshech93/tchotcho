import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState, useEffect } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  Circle,
  Share2,
  Shield,
  X,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Upload,
  FileText,
  Volume2,
  RefreshCw,
  ImageIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/useProfile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SocialLinks } from "@/components/SocialLinks";
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
import { KYC_TONE, type KycStatus } from "@/lib/remesa";
import { useI18n } from "@/lib/i18n";
import { Switch } from "@/components/ui/switch";
import {
  isNotificationSoundEnabled,
  playNotificationDing,
  setNotificationSoundEnabled,
} from "@/lib/notification-sound";
import { submitKycVerification } from "@/lib/kyc.functions";

export const Route = createFileRoute("/_authenticated/perfil")({
  head: () => ({
    meta: [
      { title: "Mi perfil y verificación — Tcho-Tcho" },
      { name: "description", content: "Actualiza tus datos y verifica tu identidad (KYC)." },
      { property: "og:title", content: "Mi perfil y verificación — Tcho-Tcho" },
      { property: "og:description", content: "Datos personales y estado de verificación KYC." },
    ],
  }),
  component: Perfil,
});

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });

function Perfil() {
  const { user, profile, roles, reload, isAdmin } = useProfile();
  const { t } = useI18n();
  const qc = useQueryClient();
  const [savingProfile, setSavingProfile] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(isNotificationSoundEnabled);
  const [savingKyc, setSavingKyc] = useState(false);
  const [docType, setDocType] = useState("ine");
  const [docNumber, setDocNumber] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [address, setAddress] = useState("");
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);

  // Crear y limpiar ObjectURLs de vista previa
  useEffect(() => {
    if (!frontFile) {
      setFrontPreview(null);
      return;
    }
    const url = URL.createObjectURL(frontFile);
    setFrontPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [frontFile]);

  useEffect(() => {
    if (!backFile) {
      setBackPreview(null);
      return;
    }
    const url = URL.createObjectURL(backFile);
    setBackPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [backFile]);

  const profileSchema = useMemo(
    () =>
      z.object({
        full_name: z.string().trim().min(3, t("profile.err_name")).max(100),
        phone: z.string().trim().min(6, t("profile.err_phone")).max(25),
      }),
    [t],
  );

  const kycSchema = useMemo(
    () =>
      z.object({
        document_type: z.string().min(2),
        document_number: z.string().trim().min(4, t("profile.err_doc_number")).max(40),
        birth_date: z.string().min(4, t("profile.err_birth_date")),
        address: z.string().trim().min(6, t("profile.err_address")).max(200),
      }),
    [t],
  );

  const KYC_LABEL: Record<KycStatus, string> = {
    none: t("profile.kyc_none"),
    pending: t("profile.kyc_pending"),
    approved: t("profile.kyc_approved"),
    rejected: t("profile.kyc_rejected"),
  };

  const { data: submission } = useQuery({
    queryKey: ["kyc", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("kyc_submissions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  // Pre-llenar datos anteriores si fue rechazado
  useEffect(() => {
    if (submission && profile?.kyc_status === "rejected") {
      if (submission.document_type) setDocType(submission.document_type);
      if (submission.document_number) setDocNumber(submission.document_number);
      if (submission.birth_date) setBirthDate(submission.birth_date);
      if (submission.address) setAddress(submission.address);
    }
  }, [submission, profile?.kyc_status]);

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!isAdmin && profile?.kyc_status === "approved") {
      toast.error("Tu perfil está bloqueado porque tu identidad ya fue verificada.");
      return;
    }
    const form = new FormData(e.currentTarget);
    const parsed = profileSchema.safeParse({
      full_name: String(form.get("full_name") ?? ""),
      phone: String(form.get("phone") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    setSavingProfile(true);
    const { error } = await supabase.from("profiles").update(parsed.data).eq("id", user!.id);
    setSavingProfile(false);
    if (error) {
      toast.error(t("profile.err_save"));
      return;
    }
    toast.success(t("profile.success_save"));
    void reload();
  };

  const saveKyc = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = kycSchema.safeParse({
      document_type: docType,
      document_number: String(form.get("document_number") || docNumber).trim(),
      birth_date: String(form.get("birth_date") || birthDate).trim(),
      address: String(form.get("address") || address).trim(),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]!.message);
      return;
    }
    if (!frontFile) {
      toast.error(t("profile.err_no_front"));
      return;
    }
    if (frontFile.size > 10 * 1024 * 1024 || (backFile && backFile.size > 10 * 1024 * 1024)) {
      toast.error(t("profile.err_file_size"));
      return;
    }

    setSavingKyc(true);
    try {
      // 1. Convertir imágenes a base64
      const frontBase64 = await fileToBase64(frontFile);
      const backBase64 = backFile ? await fileToBase64(backFile) : null;

      // 2. Enviar a través de la función de servidor con permisos admin
      const res = await submitKycVerification({
        data: {
          document_type: parsed.data.document_type,
          document_number: parsed.data.document_number,
          birth_date: parsed.data.birth_date,
          address: parsed.data.address,
          front_base64: frontBase64,
          front_name: frontFile.name,
          back_base64: backBase64,
          back_name: backFile ? backFile.name : null,
        },
      });

      toast.success(res.message || t("profile.success_kyc"));
      setFrontFile(null);
      setBackFile(null);
      qc.invalidateQueries({ queryKey: ["kyc", user?.id] });
      void reload();
    } catch (err: any) {
      console.warn("[KYC] Función de servidor falló, intentando subida directa:", err);
      // Fallback a Storage cliente
      try {
        const stamp = Date.now();
        const frontExt = frontFile.name.split(".").pop() || "jpg";
        const frontPath = `${user!.id}/${stamp}-frente.${frontExt}`;
        const { error: uploadFrontError } = await supabase.storage
          .from("kyc-documents")
          .upload(frontPath, frontFile, { upsert: true });
        if (uploadFrontError) throw uploadFrontError;

        let backPath: string | null = null;
        if (backFile) {
          const backExt = backFile.name.split(".").pop() || "jpg";
          backPath = `${user!.id}/${stamp}-reverso.${backExt}`;
          const { error: uploadBackError } = await supabase.storage
            .from("kyc-documents")
            .upload(backPath, backFile, { upsert: true });
          if (uploadBackError) throw uploadBackError;
        }

        const { error: insError } = await supabase.from("kyc_submissions").insert({
          user_id: user!.id,
          ...parsed.data,
          status: "pending",
          document_photo_path: frontPath,
          document_back_path: backPath,
        });
        if (insError) throw insError;

        await supabase.from("profiles").update({ kyc_status: "pending" }).eq("id", user!.id);
        toast.success(t("profile.success_kyc"));
        setFrontFile(null);
        setBackFile(null);
        qc.invalidateQueries({ queryKey: ["kyc", user?.id] });
        void reload();
      } catch (fallbackErr: any) {
        console.error("[KYC Error]:", fallbackErr);
        const detail =
          fallbackErr?.message || err?.message || t("profile.err_kyc_send");
        toast.error(detail);
      }
    } finally {
      setSavingKyc(false);
    }
  };

  const kyc = (profile?.kyc_status ?? "none") as KycStatus;

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-16">
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
        <h1 className="text-2xl font-bold">{t("profile.title")}</h1>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">{t("profile.personal_data")}</CardTitle>
          <div className="flex items-center gap-1.5">
            {isAdmin && (
              <Badge className="bg-amber-500/15 text-amber-400 border-amber-500/30 gap-1 text-xs font-bold">
                <Shield className="size-3" /> Super Admin
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              {roles.includes("agent") ? t("nav.agent_portal") : t("profile.client_user")}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={saveProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">{t("profile.email")}</Label>
              <Input id="email" value={user?.email ?? ""} disabled />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="full_name">{t("profile.full_name")}</Label>
              <Input
                id="full_name"
                name="full_name"
                defaultValue={profile?.full_name ?? ""}
                disabled={!isAdmin && profile?.kyc_status === "approved"}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="phone">{t("profile.phone")}</Label>
              <Input
                id="phone"
                name="phone"
                defaultValue={profile?.phone ?? ""}
                disabled={!isAdmin && profile?.kyc_status === "approved"}
                required
              />
            </div>
            <Button
              type="submit"
              disabled={savingProfile || (!isAdmin && profile?.kyc_status === "approved")}
            >
              {savingProfile ? t("profile.saving") : t("profile.save_changes")}
            </Button>
          </form>

          {!isAdmin && profile?.kyc_status === "approved" && (
            <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
              <span>
                Tus datos personales están validados y protegidos por tu verificación KYC aprobada.
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preferencias de Notificación con Sonido */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base flex items-center gap-2">
              <Volume2 className="size-4 text-emerald-600" />
              Sonido de notificaciones
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Reproducir un tono suave cuando se complete o actualice una remesa, recarga o transacción.
            </CardDescription>
          </div>
          <Switch
            checked={soundEnabled}
            onCheckedChange={(val) => {
              setSoundEnabled(val);
              setNotificationSoundEnabled(val);
              if (val) {
                playNotificationDing();
                toast.success("Sonido de notificaciones activado");
              } else {
                toast.info("Sonido de notificaciones desactivado");
              }
            }}
            aria-label="Activar sonido de notificaciones"
          />
        </CardHeader>
      </Card>

      {/* SECCIÓN DE VERIFICACIÓN KYC */}
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="size-4 text-emerald-600" />
              {t("profile.kyc_title")}
            </CardTitle>
            <CardDescription className="text-xs">
              Valida tu identidad para enviar dinero y realizar transacciones de forma segura.
            </CardDescription>
          </div>
          <Badge
            className={
              isAdmin
                ? "bg-amber-500/15 text-amber-500 border-amber-500/30 gap-1 font-bold"
                : KYC_TONE[kyc]
            }
            variant="secondary"
          >
            {isAdmin ? (
              <>
                <Shield className="size-3" /> Super Admin Verificado
              </>
            ) : (
              KYC_LABEL[kyc]
            )}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-4">
          {isAdmin ? (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-500 text-black font-black">
                  <Shield className="size-5" />
                </span>
                <div>
                  <h4 className="font-semibold text-foreground flex items-center gap-2">
                    Cuenta Super Administrador
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-[10px] font-black text-amber-500">
                      Acceso Total
                    </span>
                  </h4>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Esta cuenta cuenta con privilegios de <strong>Super Administrador</strong>:
                    acceso completo a todos los módulos y operaciones del sistema, y exención total
                    de verificación KYC.
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <>
              {/* Barra de progreso de verificación */}
              <ol className="flex items-center gap-2 py-1">
                {kyc === "rejected" ? (
                  <li className="flex items-center gap-1.5 text-sm font-semibold text-rose-600">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700">
                      <X className="size-3.5" />
                    </span>
                    {t("profile.step_rejected")}
                  </li>
                ) : (
                  [
                    { key: "sent", label: t("profile.step_sent"), done: kyc !== "none" },
                    {
                      key: "review",
                      label: t("profile.step_review"),
                      done: kyc === "pending" || kyc === "approved",
                    },
                    {
                      key: "approved",
                      label: t("profile.step_approved"),
                      done: kyc === "approved",
                    },
                  ].map((s, i, arr) => (
                    <li key={s.key} className="flex flex-1 items-center gap-1.5">
                      <span
                        className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                          s.done
                            ? "bg-emerald-600 text-white"
                            : "bg-slate-100 text-slate-400"
                        }`}
                      >
                        {s.done ? <Check className="size-3.5" /> : <Circle className="size-2.5" />}
                      </span>
                      <span
                        className={`text-xs font-medium ${s.done ? "text-slate-900 font-bold" : "text-slate-400"}`}
                      >
                        {s.label}
                      </span>
                      {i < arr.length - 1 && (
                        <span
                          className={`h-0.5 flex-1 ${s.done ? "bg-emerald-400" : "bg-slate-200"}`}
                        />
                      )}
                    </li>
                  ))
                )}
              </ol>

              {/* ESTADO: APROBADO */}
              {kyc === "approved" && (
                <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                    <span>Tu identidad está 100% verificada</span>
                  </div>
                  <p className="text-xs text-emerald-950">
                    {t("profile.kyc_approved_desc")} Puedes realizar envíos de dinero, recargas y transacciones sin ninguna restricción.
                  </p>
                </div>
              )}

              {/* ESTADO: EN REVISIÓN */}
              {kyc === "pending" && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-3">
                  <div className="flex items-center gap-2 text-amber-900 font-bold text-sm">
                    <Clock className="size-5 text-amber-600 animate-pulse shrink-0" />
                    <span>Tu verificación está en revisión por nuestro equipo</span>
                  </div>
                  <p className="text-xs text-amber-950">
                    {t("profile.kyc_pending_desc")} Nuestro equipo revisa los documentos en un plazo promedio de <strong>5 a 15 minutos</strong> en horario de atención. Te notificaremos en cuanto quede aprobada.
                  </p>
                  {submission && (
                    <div className="rounded-lg bg-white/80 border border-amber-200 p-2.5 text-xs text-slate-700 space-y-1">
                      <p>
                        <span className="font-bold text-slate-900">Documento enviado:</span>{" "}
                        {submission.document_type?.toUpperCase()} · {submission.document_number}
                      </p>
                      <p>
                        <span className="font-bold text-slate-900">Fecha de envío:</span>{" "}
                        {new Date(submission.created_at).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* ESTADO: RECHAZADO O SIN VERIFICAR */}
              {(kyc === "none" || kyc === "rejected") && (
                <div className="space-y-4">
                  {kyc === "rejected" && (
                    <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-rose-900 font-bold text-sm">
                        <AlertTriangle className="size-5 text-rose-600 shrink-0" />
                        <span>Verificación Rechazada</span>
                      </div>
                      <p className="text-xs text-rose-950">
                        {submission?.review_notes ? (
                          <>
                            <strong>Motivo:</strong> {submission.review_notes}
                          </>
                        ) : (
                          "Algunos datos o documentos no cumplían con los requisitos de legibilidad. Por favor corrígelos y vuelve a enviar."
                        )}
                      </p>
                      <p className="text-[11px] text-rose-700">
                        Sube una foto más nítida, con buena iluminación y asegúrate de que todos los datos coincidan.
                      </p>
                    </div>
                  )}

                  <form onSubmit={saveKyc} className="grid gap-4 sm:grid-cols-2 pt-1">
                    <div className="space-y-1.5">
                      <Label htmlFor="document_type">{t("profile.doc_type")}</Label>
                      <Select value={docType} onValueChange={setDocType}>
                        <SelectTrigger id="document_type" className="h-10 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="ine">Cédula de Identidad / DNI / INE</SelectItem>
                          <SelectItem value="passport">Pasaporte Oficial</SelectItem>
                          <SelectItem value="residency">Permiso de Residencia / FM2 / FM3</SelectItem>
                          <SelectItem value="license">Licencia de Conducir Oficial</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="document_number">{t("profile.doc_number")}</Label>
                      <Input
                        id="document_number"
                        name="document_number"
                        value={docNumber}
                        onChange={(e) => setDocNumber(e.target.value)}
                        placeholder="Ej: 001-1234567-8"
                        maxLength={40}
                        required
                        className="h-10 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="birth_date">{t("profile.birth_date")}</Label>
                      <Input
                        id="birth_date"
                        name="birth_date"
                        type="date"
                        value={birthDate}
                        onChange={(e) => setBirthDate(e.target.value)}
                        required
                        className="h-10 text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="address">{t("profile.address")}</Label>
                      <Input
                        id="address"
                        name="address"
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Calle, número, ciudad y país"
                        maxLength={200}
                        required
                        className="h-10 text-xs"
                      />
                    </div>

                    {/* FOTO FRONTAL CON VISTA PREVIA */}
                    <div className="space-y-2">
                      <Label htmlFor="doc-front" className="flex items-center gap-1.5">
                        <ImageIcon className="size-4 text-emerald-600" />
                        <span>{t("profile.doc_front")} *</span>
                      </Label>
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center hover:border-emerald-500 transition">
                        {frontPreview ? (
                          <div className="space-y-2">
                            <img
                              src={frontPreview}
                              alt="Frente"
                              className="rounded-lg h-32 w-full object-contain mx-auto bg-white border"
                            />
                            <div className="flex items-center justify-between text-xs">
                              <span className="truncate max-w-[150px] text-slate-600">{frontFile?.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setFrontFile(null)}
                                className="h-6 text-rose-600 text-xs px-2"
                              >
                                Cambiar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <label htmlFor="doc-front" className="cursor-pointer block py-3">
                            <Upload className="size-6 mx-auto text-slate-400 mb-1" />
                            <p className="text-xs font-semibold text-slate-700">Subir foto frontal</p>
                            <p className="text-[10px] text-slate-400">JPG, PNG o WEBP (máx. 10MB)</p>
                            <input
                              id="doc-front"
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => setFrontFile(e.target.files?.[0] ?? null)}
                              required={!frontFile}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    {/* FOTO TRASERA CON VISTA PREVIA */}
                    <div className="space-y-2">
                      <Label htmlFor="doc-back" className="flex items-center gap-1.5">
                        <ImageIcon className="size-4 text-emerald-600" />
                        <span>{t("profile.doc_back")} (Opcional en pasaporte)</span>
                      </Label>
                      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-3 text-center hover:border-emerald-500 transition">
                        {backPreview ? (
                          <div className="space-y-2">
                            <img
                              src={backPreview}
                              alt="Reverso"
                              className="rounded-lg h-32 w-full object-contain mx-auto bg-white border"
                            />
                            <div className="flex items-center justify-between text-xs">
                              <span className="truncate max-w-[150px] text-slate-600">{backFile?.name}</span>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setBackFile(null)}
                                className="h-6 text-rose-600 text-xs px-2"
                              >
                                Cambiar
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <label htmlFor="doc-back" className="cursor-pointer block py-3">
                            <Upload className="size-6 mx-auto text-slate-400 mb-1" />
                            <p className="text-xs font-semibold text-slate-700">Subir foto del reverso</p>
                            <p className="text-[10px] text-slate-400">Reverso si aplica (máx. 10MB)</p>
                            <input
                              id="doc-back"
                              type="file"
                              accept="image/*"
                              capture="environment"
                              className="hidden"
                              onChange={(e) => setBackFile(e.target.files?.[0] ?? null)}
                            />
                          </label>
                        )}
                      </div>
                    </div>

                    <Button
                      type="submit"
                      disabled={savingKyc}
                      className="sm:col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold h-11 text-sm shadow-sm"
                    >
                      {savingKyc ? (
                        <span className="inline-flex items-center gap-2">
                          <RefreshCw className="size-4 animate-spin" />
                          {t("profile.sending")}...
                        </span>
                      ) : kyc === "rejected" ? (
                        "Reenviar verificación corregida"
                      ) : (
                        t("profile.send_verification")
                      )}
                    </Button>
                  </form>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Redes Sociales Oficiales */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Share2 className="size-4 text-emerald-500" />
            Redes Sociales Oficiales
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground">
            Conoce nuestras cuentas y comunidades oficiales para noticias, promociones y atención directa.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold text-slate-700">
                  Canales de WhatsApp, Facebook y Soporte
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Atención directa, confirmaciones y avisos de tarifas en tiempo real.
                </p>
              </div>
              <SocialLinks iconSize="size-4" className="gap-2" />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
