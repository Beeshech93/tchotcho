import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertTriangle, KeyRound, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import logoAsset from "@/assets/tchotcho-logo.png";
import iconAsset from "@/assets/tchotcho-icon.png";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/restablecer-password")({
  head: () => ({
    meta: [{ title: "Crear o Restablecer Contraseña — Tcho-Tcho" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // 1. Detectar intercambio de código PKCE o tokens en hash / query
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const code = url.searchParams.get("code") || hashParams.get("code");
      const rawError =
        url.searchParams.get("error_description") ||
        url.searchParams.get("error") ||
        hashParams.get("error_description") ||
        hashParams.get("error");

      if (rawError) {
        const decoded = decodeURIComponent(rawError.replace(/\+/g, " "));
        if (decoded.toLowerCase().includes("expired") || decoded.toLowerCase().includes("invalid")) {
          setErrorMessage("El enlace ha expirado o ya fue utilizado. Por favor solicita uno nuevo.");
        } else {
          setErrorMessage(decoded);
        }
        return;
      }

      if (code) {
        supabase.auth.exchangeCodeForSession(code).then(({ data, error: exchangeError }) => {
          if (exchangeError) {
            setErrorMessage(exchangeError.message);
          } else if (data.session) {
            setReady(true);
          }
        });
      }

      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      if (accessToken && refreshToken) {
        supabase.auth
          .setSession({ access_token: accessToken, refresh_token: refreshToken })
          .then(({ data, error }) => {
            if (!error && data.session) {
              setReady(true);
            }
          });
      }
    }

    // 2. Suscribirse a cambios de auth de Supabase (hash o token recovery)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (session && event === "SIGNED_IN")) {
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });

    // Timeout de verificación: si pasados 7 segundos no se detectó sesión ni error
    const timer = setTimeout(() => {
      setReady((prev) => {
        if (!prev) {
          setErrorMessage(
            "El enlace ha expirado o ya fue utilizado. Por favor solicita uno nuevo desde la pantalla de inicio de sesión.",
          );
        }
        return prev;
      });
    }, 7000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const schema = z
      .object({
        password: z.string().min(8, t("auth.min_password") || "Mínimo 8 caracteres").max(72),
        confirm: z.string(),
      })
      .refine((d) => d.password === d.confirm, { message: "Las contraseñas no coinciden" });

    const parsed = schema.safeParse({
      password: String(form.get("password") ?? ""),
      confirm: String(form.get("confirm") ?? ""),
    });

    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? (t("auth.invalid") || "Datos inválidos"));
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
      if (error) throw error;
      setDone(true);
      toast.success("¡Contraseña guardada exitosamente!");
      setTimeout(() => router.navigate({ to: "/dashboard", replace: true }), 1500);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : (t("auth.error") || "Error al actualizar"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-gradient-to-br from-[#064E3B] via-[#022c22] to-[#011812] text-white selection:bg-emerald-600 selection:text-white flex flex-col justify-between">
      {/* 1. Pattern de diseño de fondo: Cuadrícula de micropuntos fintech */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.18]"
        style={{
          backgroundImage: "radial-gradient(circle, #34D399 1.25px, transparent 1.25px)",
          backgroundSize: "28px 28px",
        }}
      />

      {/* 2. Círculos y destellos radiales ambientales (Ambient Glow Orbs) */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 size-[550px] rounded-full blur-[140px] opacity-35"
        style={{ background: "radial-gradient(circle, #10B981 0%, #047857 60%, transparent 100%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-32 size-[500px] rounded-full blur-[130px] opacity-30"
        style={{ background: "radial-gradient(circle, #34D399 0%, #065F46 65%, transparent 100%)" }}
      />
      <div
        className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[650px] rounded-full blur-[160px] opacity-20"
        style={{ background: "radial-gradient(circle, #059669 0%, transparent 70%)" }}
      />

      {/* 3. Anillos geométricos decorativos en el fondo */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
        <div className="size-[680px] rounded-full border border-emerald-500/10" />
        <div className="absolute size-[880px] rounded-full border border-emerald-500/5" />
      </div>

      {/* Contenedor principal con Header, Logo Destacado y Card */}
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6">
        {/* Barra superior con botón volver elegante */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/"
            className="group inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-white/20 border border-white/15 px-3.5 py-1.5 text-xs font-semibold text-emerald-100 hover:text-white backdrop-blur-md shadow-sm transition-all"
            aria-label="Volver al inicio"
          >
            <ArrowLeft className="size-3.5 transition-transform group-hover:-translate-x-0.5" />
            <span>Volver al inicio</span>
          </Link>

          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            <ShieldCheck className="size-3.5 text-emerald-400" />
            Acceso Seguro
          </div>
        </div>

        {/* LOGO DESTACADO — Placa blanca brillante amplia con halo, mascota grande y wordmark nítido */}
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="relative group">
            {/* Halo de luz esmeralda detrás del logo */}
            <div className="pointer-events-none absolute -inset-1.5 rounded-[32px] bg-gradient-to-r from-emerald-400 via-emerald-300 to-emerald-500 opacity-40 blur-xl group-hover:opacity-60 transition duration-500" />

            <Link
              to="/"
              className="relative inline-flex items-center gap-3.5 sm:gap-4.5 rounded-[26px] bg-white px-7 py-3.5 sm:px-9 sm:py-4.5 shadow-[0_16px_40px_rgba(0,0,0,0.4)] border-[2.5px] border-emerald-400 ring-4 ring-emerald-400/20 hover:border-emerald-500 hover:scale-105 active:scale-95 transition-all"
              aria-label="Tcho-Tcho - Ir al inicio"
            >
              <img
                src={iconAsset}
                alt="Tcho-Tcho Mascot"
                className="size-13 sm:size-16 object-contain shrink-0 group-hover:rotate-6 transition-transform"
              />
              <img
                src={logoAsset}
                alt="Tcho-Tcho"
                className="h-9 sm:h-12 w-auto object-contain shrink-0"
              />
            </Link>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-emerald-500/25 border border-emerald-300/40 px-3.5 py-1 text-xs font-bold text-emerald-200 shadow-sm backdrop-blur-md">
            <Sparkles className="size-3.5 text-emerald-300" />
            <span>Banca Móvil &amp; Envíos Oficiales</span>
          </div>
        </div>

        {/* TARJETA ELEVADA — Diseño blanco nítido con bordes y botones esmeralda */}
        <Card className="rounded-[28px] border-2 border-emerald-300/40 bg-white shadow-2xl shadow-emerald-950/60 overflow-hidden text-slate-900">
          <CardHeader className="pb-3 pt-6 text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-emerald-100/90 text-emerald-700 shadow-xs border border-emerald-200">
              <KeyRound className="size-6 text-emerald-600" />
            </div>
            <CardTitle className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              {done ? "¡Contraseña lista!" : "Crea tu contraseña"}
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 font-medium max-w-xs mx-auto">
              {done
                ? "Tu nueva contraseña ha sido configurada con éxito."
                : "Ingresa tu nueva clave de acceso para entrar a tu cuenta."}
            </CardDescription>
          </CardHeader>

          <CardContent className="px-6 pb-6 pt-2">
            {done ? (
              <div className="space-y-4 text-center py-3">
                <div className="flex items-center justify-center gap-2 text-emerald-800 font-bold text-sm bg-emerald-50 py-3.5 px-4 rounded-2xl border-2 border-emerald-300">
                  <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
                  Contraseña actualizada correctamente
                </div>
                <p className="text-xs text-slate-500 font-medium">Redirigiendo a tu cuenta…</p>
              </div>
            ) : errorMessage ? (
              <div className="space-y-4 py-2">
                <div className="flex items-start gap-3 rounded-2xl border-2 border-rose-200 bg-rose-50/90 p-4 text-xs text-rose-800">
                  <AlertTriangle className="size-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-950 text-sm">Enlace no disponible</p>
                    <p className="mt-1 leading-relaxed text-rose-900">{errorMessage}</p>
                  </div>
                </div>
                <Button asChild className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow-md">
                  <Link to="/auth">Ir a Iniciar Sesión / Solicitar otro</Link>
                </Button>
              </div>
            ) : !ready ? (
              <div className="flex flex-col items-center justify-center gap-3 py-8 text-center">
                <Loader2 className="size-7 animate-spin text-emerald-600" />
                <p className="text-xs text-slate-600 font-semibold">
                  Verificando enlace de seguridad…
                </p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-bold text-slate-800">
                    Nueva contraseña
                  </Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="Mínimo 8 caracteres"
                    maxLength={72}
                    className="h-11 rounded-xl border-slate-300 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 text-slate-900"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm" className="text-xs font-bold text-slate-800">
                    Confirmar contraseña
                  </Label>
                  <Input
                    id="confirm"
                    name="confirm"
                    type="password"
                    required
                    placeholder="Repite la nueva contraseña"
                    maxLength={72}
                    className="h-11 rounded-xl border-slate-300 focus-visible:ring-emerald-500 focus-visible:border-emerald-500 text-slate-900"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-950/20 transition-all hover:scale-[1.01] active:scale-[0.99] mt-2"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="size-4 animate-spin" /> Guardando…
                    </span>
                  ) : (
                    "Guardar contraseña y entrar"
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Footer sutil con derechos y privacidad */}
      <footer className="relative z-10 py-4 text-center text-[11px] text-emerald-200/60 font-medium">
        © 2026 Tcho-Tcho. Todos los derechos reservados.
      </footer>
    </div>
  );
}
