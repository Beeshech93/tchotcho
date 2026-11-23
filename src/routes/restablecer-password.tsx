import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, AlertTriangle, KeyRound, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import logoAsset from "@/assets/lajan-rapid-logo.png";
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
    // 1. Detectar intercambio de código PKCE si está en la URL
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const errorDesc = url.searchParams.get("error_description") || url.searchParams.get("error");
      if (errorDesc) {
        setErrorMessage(errorDesc);
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
    <div className="grid min-h-screen place-items-center bg-brand px-4 py-10 selection:bg-emerald-600 selection:text-white">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-start">
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="text-foreground hover:bg-white/10"
            aria-label="Volver al inicio"
          >
            <Link to="/">
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
        </div>

        <div className="mb-6 text-center text-foreground">
          <Link
            to="/"
            className="group inline-flex flex-col items-center gap-2 rounded-2xl p-2 transition-transform hover:scale-105 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label="Tcho-Tcho - Ir a la página de inicio"
          >
            <span className="grid size-14 place-items-center overflow-hidden rounded-2xl bg-logo-surface p-1.5 shadow-soft">
              <img src={logoAsset} alt="Tcho-Tcho" className="h-full w-full object-contain" />
            </span>
            <span className="mt-1 font-display text-2xl font-bold tracking-tight text-foreground transition-colors group-hover:text-foreground/90">
              Tcho-Tcho
            </span>
          </Link>
        </div>

        <Card className="shadow-lift border-emerald-100">
          <CardHeader className="pb-3 text-center">
            <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
              <KeyRound className="size-6" />
            </div>
            <CardTitle className="text-xl font-bold">
              {done ? "¡Contraseña lista!" : "Crea tu contraseña"}
            </CardTitle>
            <CardDescription className="text-xs">
              {done
                ? "Tu nueva contraseña ha sido configurada con éxito."
                : "Ingresa tu nueva clave de acceso para entrar a tu cuenta."}
            </CardDescription>
          </CardHeader>

          <CardContent>
            {done ? (
              <div className="space-y-4 text-center py-2">
                <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-sm bg-emerald-50 py-3 px-4 rounded-xl border border-emerald-200">
                  <CheckCircle2 className="size-5 text-emerald-600" />
                  Contraseña actualizada correctamente
                </div>
                <p className="text-xs text-muted-foreground">Redirigiendo a tu cuenta…</p>
              </div>
            ) : errorMessage ? (
              <div className="space-y-4 py-2">
                <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs text-rose-800">
                  <AlertTriangle className="size-5 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-900">Enlace no disponible</p>
                    <p className="mt-0.5">{errorMessage}</p>
                  </div>
                </div>
                <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  <Link to="/auth">Ir a Iniciar Sesión / Solicitar otro</Link>
                </Button>
              </div>
            ) : !ready ? (
              <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
                <Loader2 className="size-6 animate-spin text-emerald-600" />
                <p className="text-xs text-muted-foreground font-medium">
                  Verificando enlace de seguridad…
                </p>
              </div>
            ) : (
              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Nueva contraseña</Label>
                  <Input
                    id="password"
                    name="password"
                    type="password"
                    required
                    placeholder="Mínimo 8 caracteres"
                    maxLength={72}
                    className="h-11"
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirm">Confirmar contraseña</Label>
                  <Input
                    id="confirm"
                    name="confirm"
                    type="password"
                    required
                    placeholder="Repite la nueva contraseña"
                    maxLength={72}
                    className="h-11"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm"
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
    </div>
  );
}
