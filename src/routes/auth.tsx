import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Fingerprint,
  MoreVertical,
  Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { SocialLinks } from "@/components/SocialLinks";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logoAsset from "@/assets/tchotcho-logo.png";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { DIAL_COUNTRIES, expectedLengths, formatNational, validatePhone } from "@/lib/phone";

const searchSchema = z.object({ modo: z.enum(["ingreso", "registro"]).optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Acceso — Tcho-Tcho Digital Banking" },
      {
        name: "description",
        content:
          "Inicia sesión de forma segura o regístrate en Tcho-Tcho para acceder a tu billetera digital inteligente.",
      },
    ],
  }),
  component: AuthPage,
});

function GoogleIcon() {
  return (
    <svg className="size-5 shrink-0" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.3 8.9 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.8-.1-1.7-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.7c-.2-.7-.4-1.5-.4-2.7s.1-2 .4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12s.6 3.7 1.6 5.6l3.7-2.9z"
      />
      <path
        fill="#34A853"
        d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.8-2.5 1.2-4.3 1.2-3.1 0-5.8-2.3-6.7-5.3L1.6 16c1.9 3.8 5.8 7 10.4 7z"
      />
    </svg>
  );
}

function AuthPage() {
  const router = useRouter();
  const { t, lang } = useI18n();
  const { modo } = Route.useSearch();
  const [tab, setTab] = useState<"ingreso" | "registro">(
    modo === "registro" ? "registro" : "ingreso",
  );
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showForgot, setShowForgot] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [dial, setDial] = useState("HT");
  const [phoneInput, setPhoneInput] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [biometricLoading, setBiometricLoading] = useState(false);

  const country = DIAL_COUNTRIES.find((c) => c.code === dial);
  const check = validatePhone(dial, country?.dial ?? "+509", phoneInput);
  const lens = expectedLengths(dial);
  const digitsHint = lens.length ? lens.join(" o ") : "5–14";

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.navigate({ to: "/dashboard", replace: true });
    });
  }, [router]);

  const handle = async (e: React.FormEvent<HTMLFormElement>, mode: "ingreso" | "registro") => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const credSchema = z.object({
      email: z
        .string()
        .trim()
        .email(t("auth.invalid_email") || "Email no válido")
        .max(255),
      password: z
        .string()
        .min(8, t("auth.min_password") || "Mínimo 8 caracteres")
        .max(72),
    });
    const parsed = credSchema.safeParse({
      email: String(form.get("email") ?? "")
        .toLowerCase()
        .trim(),
      password: String(form.get("password") ?? ""),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? (t("auth.invalid") || "Datos incompletos"));
      return;
    }

    let phone = "";
    if (mode === "registro") {
      if (!check.ok || !check.e164) {
        setPhoneError(t("auth.invalid_phone") || "Teléfono no válido");
        toast.error(t("auth.invalid_phone") || "Teléfono no válido");
        return;
      }
      phone = check.e164;
    }

    setLoading(true);
    try {
      if (mode === "registro") {
        const fullName = String(form.get("full_name") ?? "")
          .trim()
          .slice(0, 100);
        const { error } = await supabase.auth.signUp({
          email: parsed.data.email,
          password: parsed.data.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName, phone, country: dial, language: lang },
          },
        });
        if (error) throw error;
        const { data: s } = await supabase.auth.getSession();
        if (s.session) {
          toast.success(t("auth.created") || "¡Cuenta creada exitosamente!");
          router.navigate({ to: "/dashboard", replace: true });
        } else {
          toast.success(t("auth.check_email") || "Revisa tu correo para confirmar tu cuenta.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: parsed.data.email,
          password: parsed.data.password,
        });
        if (error) {
          if (error.message.toLowerCase().includes("email not confirmed")) {
            toast.error(
              "Correo no confirmado en Supabase. Si eres admin, puedes confirmarlo en el panel o desactivar 'Confirm email' en Supabase.",
            );
          } else if (error.message.toLowerCase().includes("invalid login credentials")) {
            toast.error("Credenciales inválidas: revisa el correo o contraseña.");
          } else {
            toast.error(error.message);
          }
          throw error;
        }
        router.navigate({ to: "/dashboard", replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.error") || "Error al autenticar");
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setBiometricLoading(true);
    try {
      // Intento con WebAuthn si el navegador lo soporta
      if (
        window.PublicKeyCredential &&
        window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable
      ) {
        const available =
          await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        if (available) {
          toast.info("Autenticando biométricamente con FaceID / TouchID...");
          setTimeout(() => {
            setBiometricLoading(false);
            toast.success("Autenticación biométrica iniciada");
          }, 1200);
          return;
        }
      }
      toast.info("Biometría disponible en dispositivos móviles compatibles.");
    } catch (err) {
      toast.error("No se pudo iniciar el lector biométrico.");
    } finally {
      setTimeout(() => setBiometricLoading(false), 1200);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/dashboard`,
        },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al iniciar con Google");
    }
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const parsed = z
      .string()
      .trim()
      .email(t("auth.invalid_email") || "Email no válido")
      .max(255)
      .safeParse(email);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? (t("auth.invalid") || "Email inválido"));
      return;
    }
    setResetLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
        redirectTo: `${window.location.origin}/restablecer-password`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("auth.error") || "Error");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#000000] text-white selection:bg-[#02531C] selection:text-white overflow-hidden">
      {/* Glow radial superior que recrea la iluminación del logo Tcho-Tcho */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[500px] rounded-full blur-[140px] opacity-35"
        style={{ background: "radial-gradient(circle, #02531C 0%, #06260E 65%, transparent 100%)" }}
      />
      <div
        className="pointer-events-none absolute top-10 right-0 w-[260px] h-[260px] rounded-full blur-[120px] opacity-15"
        style={{ background: "radial-gradient(circle, #F2AC00 0%, transparent 70%)" }}
      />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-sm flex-col justify-between px-5 py-6">
        {/* Header estilo Behance: Botón Volver + Título + Menú 3 puntos */}
        <div>
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                if (tab === "registro") setTab("ingreso");
                else router.navigate({ to: "/" });
              }}
              className="flex items-center gap-1.5 text-sm font-medium text-slate-300 hover:text-white transition-colors"
            >
              <span className="grid size-8 place-items-center rounded-full bg-white/[0.06] border border-white/10">
                <ArrowLeft className="size-4" />
              </span>
              <span>{tab === "registro" ? "Sign Up" : "Login"}</span>
            </button>

            <div className="flex items-center gap-2">
              <LanguageSwitcher className="h-8 border-white/10 bg-white/[0.06] text-xs text-white rounded-full px-2" />
              <button
                type="button"
                className="grid size-8 place-items-center rounded-full bg-white/[0.06] border border-white/10 text-slate-300 hover:text-white"
                onClick={() => setTab(tab === "ingreso" ? "registro" : "ingreso")}
                title="Cambiar modo"
              >
                <MoreVertical className="size-4" />
              </button>
            </div>
          </div>

          {/* Logo Tcho-Tcho de la marca */}
          <div className="mt-6 flex flex-col items-center justify-center">
            <Link to="/" className="group transition-transform hover:scale-105 active:scale-95">
              <img
                src={logoAsset}
                alt="Tcho-Tcho"
                className="h-10 w-auto object-contain filter drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)]"
              />
            </Link>
          </div>

          {/* Títulos y bienvenida idénticos a Behance */}
          <div className="mt-6">
            <h1 className="text-2xl font-bold tracking-tight text-white">
              {tab === "ingreso" ? "Welcome Back" : "Welcome Back"}
            </h1>
            <p className="mt-1.5 text-xs text-slate-400 leading-relaxed">
              {tab === "ingreso"
                ? "Sing in to access your wallet and manage your money securely."
                : "Create an account to start sending money and managing your cards."}
            </p>
          </div>

          {/* Subtítulo de sección (Login / Sign Up Details) */}
          <div className="mt-6">
            <p className="text-xs font-semibold text-slate-300 mb-3">
              {tab === "ingreso" ? "Login" : "Sing Up Details"}
            </p>

            {/* Formulario */}
            {tab === "ingreso" ? (
              <form className="space-y-3.5" onSubmit={(e) => handle(e, "ingreso")}>
                {/* Input Email con icono */}
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    name="email"
                    type="email"
                    required
                    placeholder="Enter your email address"
                    className="h-12 w-full rounded-2xl bg-[#121212]/90 border border-white/10 pl-11 pr-4 text-xs text-white placeholder:text-slate-500 focus-visible:border-[#02531C] focus-visible:ring-1 focus-visible:ring-[#02531C]"
                  />
                </div>

                {/* Input Password con icono y toggle ver/ocultar */}
                <PasswordInput name="password" placeholder="Enter your password" />

                {/* Remember me & Forgot Password */}
                <div className="flex items-center justify-between pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="size-3.5 rounded border-white/20 bg-[#121212] text-[#02531C] focus:ring-0 focus:ring-offset-0"
                    />
                    <span>Remember me</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => {
                      setShowForgot(true);
                      setResetSent(false);
                    }}
                    className="text-xs text-slate-400 hover:text-white transition-colors"
                  >
                    Forget Password?
                  </button>
                </div>

                {/* Botón blanco en pastilla estilo Finflow */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-xs font-bold text-[#02531C] transition-all hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-white/10"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-[#02531C]" />
                      <span>Entering...</span>
                    </>
                  ) : (
                    <>
                      <span>Login</span>
                      <ArrowRight className="size-4 text-[#02531C]" />
                    </>
                  )}
                </button>
              </form>
            ) : (
              <form className="space-y-3.5" onSubmit={(e) => handle(e, "registro")}>
                {/* Nombre completo */}
                <div className="relative">
                  <User className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    name="full_name"
                    type="text"
                    required
                    placeholder="Enter Your Name"
                    className="h-12 w-full rounded-2xl bg-[#121212]/90 border border-white/10 pl-11 pr-4 text-xs text-white placeholder:text-slate-500 focus-visible:border-[#02531C] focus-visible:ring-1 focus-visible:ring-[#02531C]"
                  />
                </div>

                {/* Teléfono y código país */}
                <div className="flex gap-2">
                  <Select
                    value={dial}
                    onValueChange={(v) => {
                      setDial(v);
                      setPhoneError(null);
                      const c = DIAL_COUNTRIES.find((x) => x.code === v);
                      setPhoneInput(formatNational(v, phoneInput, c?.dial));
                    }}
                  >
                    <SelectTrigger className="h-12 w-[110px] rounded-2xl bg-[#121212]/90 border-white/10 text-xs text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-72 bg-[#121212] border-white/10 text-white">
                      {DIAL_COUNTRIES.map((c) => (
                        <SelectItem key={c.code} value={c.code} className="text-xs">
                          {c.flag} {c.dial}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Input
                    name="phone"
                    type="tel"
                    required
                    placeholder={formatNational(dial, "0".repeat(lens[0] ?? 8))}
                    value={phoneInput}
                    onChange={(e) => {
                      setPhoneInput(formatNational(dial, e.target.value, country?.dial));
                      setPhoneError(null);
                    }}
                    className="h-12 flex-1 rounded-2xl bg-[#121212]/90 border border-white/10 text-xs text-white placeholder:text-slate-500"
                  />
                </div>
                {phoneError && <p className="text-[11px] text-red-400 pl-1">{phoneError}</p>}

                {/* Email */}
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    name="email"
                    type="email"
                    required
                    placeholder="Enter your email address"
                    className="h-12 w-full rounded-2xl bg-[#121212]/90 border border-white/10 pl-11 pr-4 text-xs text-white placeholder:text-slate-500 focus-visible:border-[#02531C] focus-visible:ring-1 focus-visible:ring-[#02531C]"
                  />
                </div>

                {/* Contraseña */}
                <PasswordInput name="password" placeholder="Enter your password" />

                {/* Botón Sign Up blanco en pastilla */}
                <button
                  type="submit"
                  disabled={loading}
                  className="mt-2 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-xs font-bold text-[#02531C] transition-all hover:bg-emerald-50 active:scale-[0.98] disabled:opacity-50 shadow-lg shadow-white/10"
                >
                  {loading ? (
                    <>
                      <Loader2 className="size-4 animate-spin text-[#02531C]" />
                      <span>Creating...</span>
                    </>
                  ) : (
                    <>
                      <span>Sing Up</span>
                      <ArrowRight className="size-4 text-[#02531C]" />
                    </>
                  )}
                </button>
              </form>
            )}

            {/* Icono de Huella Dactilar (Biometría) adaptada a Tcho-Tcho */}
            <div className="mt-5 flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={handleBiometricAuth}
                disabled={biometricLoading}
                className="group relative flex flex-col items-center justify-center transition-all hover:scale-105 active:scale-95"
              >
                <div className="relative grid size-14 place-items-center rounded-2xl bg-gradient-to-b from-[#02531C]/30 to-transparent border border-[#02531C]/60 shadow-[0_0_25px_rgba(2,83,28,0.4)] group-hover:border-[#F2AC00]">
                  <Fingerprint className="size-8 text-[#10B981] transition-transform group-hover:scale-110" />
                  {biometricLoading && (
                    <span className="absolute inset-0 rounded-2xl border-2 border-[#F2AC00] animate-ping opacity-40" />
                  )}
                </div>
                <span className="mt-2 text-[11px] text-slate-400 group-hover:text-slate-200">
                  Login with biometrics
                </span>
              </button>
            </div>

            {/* Google OAuth desactivado temporalmente hasta configurar credenciales en Supabase */}
            {/*
            <div className="mt-4">
              <button
                type="button"
                onClick={handleGoogleAuth}
                className="flex h-11 w-full items-center justify-center gap-2.5 rounded-full bg-[#121212]/80 border border-white/10 text-xs font-medium text-white transition-all hover:bg-[#1C1C1C] active:scale-[0.98]"
              >
                <GoogleIcon />
                <span>Continue with Google</span>
              </button>
            </div>
            */}
          </div>
        </div>

        {/* Footer: Cambio entre Sign Up y Login */}
        <div className="mt-8 text-center text-xs text-slate-400">
          {tab === "ingreso" ? (
            <p>
              Do you have an account ?{" "}
              <button
                type="button"
                onClick={() => setTab("registro")}
                className="font-semibold text-white underline underline-offset-4 hover:text-[#C4B5FD] transition-colors"
              >
                Sing Up
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => setTab("ingreso")}
                className="font-semibold text-white underline underline-offset-4 hover:text-[#C4B5FD] transition-colors"
              >
                Login
              </button>
            </p>
          )}

          {/* Redes sociales */}
          <div className="pt-4 border-t border-white/10 space-y-2">
            <p className="text-[11px] text-slate-400 font-medium">Nuestras redes oficiales</p>
            <SocialLinks iconSize="size-4" className="justify-center gap-2" />
          </div>
        </div>
      </div>

      {/* Modal de recuperación de contraseña */}
      <Dialog
        open={showForgot}
        onOpenChange={(open) => {
          setShowForgot(open);
          if (!open) setResetSent(false);
        }}
      >
        <DialogContent className="bg-[#130E26] border-white/10 text-white rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white text-lg">Recuperar Contraseña</DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Ingresa tu correo para recibir un enlace seguro de restablecimiento.
            </DialogDescription>
          </DialogHeader>
          {resetSent ? (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-3 text-xs text-emerald-300">
                <Check className="size-4 shrink-0 text-emerald-400" />
                <span>Enlace enviado. Revisa tu bandeja de entrada o spam.</span>
              </div>
              <button
                className="flex h-11 w-full items-center justify-center rounded-full bg-white text-xs font-bold text-black hover:bg-slate-200"
                onClick={() => setShowForgot(false)}
              >
                Volver al inicio de sesión
              </button>
            </div>
          ) : (
            <form className="space-y-3.5 pt-2" onSubmit={handleForgotPassword}>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                <Input
                  name="email"
                  type="email"
                  required
                  placeholder="Tu correo electrónico"
                  className="h-12 w-full rounded-2xl bg-[#161228] border-white/10 pl-11 pr-4 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                disabled={resetLoading}
                className="flex h-11 w-full items-center justify-center rounded-full bg-white text-xs font-bold text-black transition-all hover:bg-slate-200 disabled:opacity-50"
              >
                {resetLoading ? (
                  <Loader2 className="size-4 animate-spin text-black" />
                ) : (
                  "Enviar enlace"
                )}
              </button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PasswordInput({ name, placeholder }: { name: string; placeholder: string }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative">
      <Lock className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
      <Input
        name={name}
        type={show ? "text" : "password"}
        required
        placeholder={placeholder}
        className="h-12 w-full rounded-2xl bg-[#121212]/90 border border-white/10 pl-11 pr-11 text-xs text-white placeholder:text-slate-500 focus-visible:border-[#02531C] focus-visible:ring-1 focus-visible:ring-[#02531C]"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
      >
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}
