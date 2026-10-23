// app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter, redirect } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  Lock,
  ArrowRight,
  AlertCircle,
  Sparkles,
  MessageCircle,
  CheckCircle2,
  KeyRound,
  ShieldAlert,
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { getWhatsAppUrl } from "@/lib/constants";

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutos de bloqueo por fuerza bruta

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [unregisteredAlert, setUnregisteredAlert] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Protección contra Fuerza Bruta y Accesos Sospechosos
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockoutUntil, setLockoutUntil] = useState<number | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const {
    user,
    profile,
    loading,
    signIn,
    signInWithGoogle,
    requestPasswordReset,
  } = useAuth();
  const router = useRouter();

  // Si el usuario ya tiene sesión activa, redirige directamente a su panel correspondiente
  if (!loading && user) {
    const targetUrl =
      profile?.role === "admin" || profile?.role === "advisor"
        ? "/dashboard/admin?tab=gobernanza"
        : "/dashboard";
    redirect(targetUrl);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedAttempts = Number(
      localStorage.getItem("gvc_auth_attempts") || "0"
    );
    const savedLockout = Number(
      localStorage.getItem("gvc_auth_lockout_until") || "0"
    );

    setFailedAttempts(savedAttempts);
    if (savedLockout > Date.now()) {
      setLockoutUntil(savedLockout);
    } else if (savedLockout !== 0) {
      localStorage.removeItem("gvc_auth_lockout_until");
      localStorage.setItem("gvc_auth_attempts", "0");
      setFailedAttempts(0);
    }
  }, []);

  useEffect(() => {
    if (!lockoutUntil) {
      setRemainingSeconds(0);
      return;
    }

    const updateTimer = () => {
      const diff = Math.ceil((lockoutUntil - Date.now()) / 1000);
      if (diff <= 0) {
        setLockoutUntil(null);
        setFailedAttempts(0);
        setRemainingSeconds(0);
        localStorage.removeItem("gvc_auth_lockout_until");
        localStorage.setItem("gvc_auth_attempts", "0");
      } else {
        setRemainingSeconds(diff);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [lockoutUntil]);

  const registerFailedAttempt = (forceLockout = false) => {
    const nextAttempts = forceLockout
      ? MAX_FAILED_ATTEMPTS
      : failedAttempts + 1;
    setFailedAttempts(nextAttempts);
    localStorage.setItem("gvc_auth_attempts", String(nextAttempts));

    if (nextAttempts >= MAX_FAILED_ATTEMPTS) {
      const lockTime = Date.now() + LOCKOUT_DURATION_MS;
      setLockoutUntil(lockTime);
      localStorage.setItem("gvc_auth_lockout_until", String(lockTime));
    }
  };

  const resetSecurityCounters = () => {
    setFailedAttempts(0);
    setLockoutUntil(null);
    localStorage.removeItem("gvc_auth_attempts");
    localStorage.removeItem("gvc_auth_lockout_until");
  };

  const isLocked = Boolean(lockoutUntil && lockoutUntil > Date.now());

  const handleSubmitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    setError("");
    setUnregisteredAlert(false);
    setSubmitting(true);

    try {
      await signIn(email, password);
      resetSecurityCounters();
      router.push("/dashboard");
    } catch (err: any) {
      if (err?.message === "UNREGISTERED_USER") {
        setUnregisteredAlert(true);
        registerFailedAttempt();
      } else if (err?.code === "auth/too-many-requests") {
        registerFailedAttempt(true);
        setError(
          "Hemos detectado actividad inusual o múltiples intentos fallidos desde tu red. El acceso se ha bloqueado temporalmente por seguridad."
        );
      } else {
        registerFailedAttempt();
        const remaining = Math.max(
          0,
          MAX_FAILED_ATTEMPTS - (failedAttempts + 1)
        );
        setError(
          remaining > 0
            ? `Credenciales inválidas. Si es tu primer ingreso sin Google o no recuerdas tu clave, usa "¿Olvidaste o aún no tienes contraseña?". (${remaining} intentos restantes antes del bloqueo de seguridad).`
            : "Se ha alcanzado el límite de intentos fallidos permitidos."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;

    setError("");
    setResetSentSuccess(false);
    setSubmitting(true);

    try {
      await requestPasswordReset(email);
      setResetSentSuccess(true);
    } catch {
      setResetSentSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    if (isLocked) return;
    setError("");
    setUnregisteredAlert(false);
    setSubmitting(true);
    try {
      await signInWithGoogle();
      resetSecurityCounters();
      router.push("/dashboard");
    } catch (err: any) {
      if (err?.message === "UNREGISTERED_USER") {
        setUnregisteredAlert(true);
      } else {
        setError("No se pudo iniciar sesión con Google. Inténtalo de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formatCooldown = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="min-h-screen bg-brand-white grid grid-cols-1 lg:grid-cols-12 font-sans">
      {/* Columna Izquierda: Branding y Seguridad con el nuevo Logo */}
      <aside
        aria-label="Información de seguridad del portal"
        className="hidden lg:flex lg:col-span-5 bg-brand-charcoal text-brand-white p-12 flex-col justify-between relative overflow-hidden"
      >
        <div className="relative z-10">
          <Link href="/" className="inline-block focus:outline-none">
            <BrandLogo theme="dark" size="md" />
          </Link>

          <div className="mt-20 space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-xs font-semibold text-white/90">
              <Sparkles className="h-3.5 w-3.5 text-brand-red" />
              <span>Portal Privado de Clientes</span>
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight">
              Control total de tu expediente migratorio en tiempo real.
            </h1>
            <p className="text-sm text-white/80 leading-relaxed max-w-md">
              Toda tu información personal (PII) está protegida bajo reglas de
              aislamiento criptográfico, detección de fuerza bruta y
              verificación de identidad.
            </p>
          </div>
        </div>

        <div className="relative z-10 rounded-2xl bg-white/5 border border-white/10 p-5 space-y-2">
          <div className="flex items-center gap-2 text-xs font-bold text-brand-red uppercase tracking-wider">
            <Lock className="h-4 w-4" />
            <span>Seguridad Nivel Bancario • Zero-Trust</span>
          </div>
          <p className="text-xs text-white/75">
            Monitoreo activo contra intentos fallidos, enlaces de recuperación
            con expiración automática y rotación de sesión cada 8 horas.
          </p>
        </div>
      </aside>

      {/* Columna Derecha: Landmark <main> */}
      <main className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-7">
          {/* Logo visible en dispositivos móviles */}
          <div className="lg:hidden pb-2">
            <Link href="/" className="inline-block focus:outline-none">
              <BrandLogo theme="light" size="md" />
            </Link>
          </div>

          {isLocked && (
            <div
              role="alert"
              className="rounded-2xl bg-brand-red/10 border-2 border-brand-red p-5 space-y-2.5 shadow-lg"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-brand-red font-display text-sm font-bold">
                  <ShieldAlert className="h-5 w-5 shrink-0" />
                  <span>Cuenta Protegida Temporalmente</span>
                </div>
                <span className="rounded-full bg-brand-red px-3 py-0.5 font-mono text-xs font-bold text-white">
                  {formatCooldown(remainingSeconds)}
                </span>
              </div>
              <p className="text-xs text-brand-charcoal/85 leading-relaxed">
                Por protocolos de seguridad contra accesos no autorizados, hemos
                bloqueado temporalmente los intentos de inicio de sesión tras
                detectar múltiples fallos consecutivos.
              </p>
            </div>
          )}

          {mode === "login" ? (
            <>
              <div className="space-y-2">
                <h2 className="font-display text-3xl font-bold text-brand-charcoal">
                  Acceso al Portal
                </h2>
                <p className="text-xs sm:text-sm text-brand-charcoal/75">
                  Ingresa con tus credenciales autorizadas para consultar el
                  avance de tu trámite.
                </p>
              </div>

              {unregisteredAlert && (
                <div
                  role="alert"
                  className="rounded-2xl bg-brand-charcoal text-white p-5 space-y-3 border-l-4 border-brand-red shadow-lg"
                >
                  <div className="flex items-center gap-2 text-brand-red font-bold text-xs uppercase tracking-wider">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>Cuenta No Provisionada</span>
                  </div>
                  <p className="text-xs text-white/85 leading-relaxed">
                    Este correo aún no tiene un expediente activo en{" "}
                    <strong>Global Visa Consulting</strong>. El acceso al portal
                    es exclusivo para clientes que ya han iniciado su servicio.
                  </p>
                  <a
                    href={getWhatsAppUrl(
                      "Hola Global Visa Consulting, intenté ingresar al portal de clientes pero mi correo aún no está habilitado."
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-full bg-brand-red px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red/90 transition-all"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>Solicitar Activación por WhatsApp</span>
                  </a>
                </div>
              )}

              {error && !isLocked && (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-xl bg-brand-red/10 border border-brand-red/30 p-3.5 text-xs font-semibold text-brand-red"
                >
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={submitting || isLocked}
                className="w-full flex items-center justify-center gap-3 rounded-full border border-brand-charcoal/15 bg-brand-white px-6 py-3.5 text-xs sm:text-sm font-semibold text-brand-charcoal shadow-2xs hover:bg-brand-platinum/60 transition-all disabled:opacity-50"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
                <span>Continuar con Google</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-brand-platinum" />
                <span className="shrink mx-4 text-[11px] font-semibold uppercase tracking-widest text-brand-charcoal/75">
                  o con tu correo
                </span>
                <div className="flex-grow border-t border-brand-platinum" />
              </div>

              <form onSubmit={handleSubmitLogin} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="login-email"
                    className="block text-xs font-semibold text-brand-charcoal"
                  >
                    Correo Electrónico
                  </label>
                  <input
                    id="login-email"
                    type="email"
                    required
                    autoComplete="email"
                    disabled={isLocked}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="cliente@correo.com"
                    className="h-12 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 px-4 text-sm text-brand-charcoal placeholder:text-brand-charcoal/50 focus:bg-brand-white focus:border-brand-red focus:outline-none disabled:opacity-50"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-semibold text-brand-charcoal"
                    >
                      Contraseña Privada
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setMode("forgot");
                        setError("");
                        setResetSentSuccess(false);
                      }}
                      className="text-xs font-bold text-brand-red hover:underline py-1"
                    >
                      ¿Olvidaste o aún no tienes contraseña?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      id="login-password"
                      type={showPassword ? "text" : "password"}
                      required
                      autoComplete="current-password"
                      disabled={isLocked}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-12 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 pl-4 pr-12 text-sm text-brand-charcoal placeholder:text-brand-charcoal/50 focus:bg-brand-white focus:border-brand-red focus:outline-none disabled:opacity-50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      title={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-brand-charcoal/65 hover:bg-brand-charcoal/5 hover:text-brand-charcoal transition-colors"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting || isLocked}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-4 text-xs sm:text-sm font-semibold text-brand-white shadow-lg shadow-brand-red/25 hover:bg-brand-red/90 transition-all disabled:opacity-50"
                >
                  <span>
                    {submitting
                      ? "Verificando credenciales..."
                      : "Ingresar a mi Portal"}
                  </span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              </form>
            </>
          ) : (
            <div className="space-y-6">
              <button
                type="button"
                onClick={() => {
                  setMode("login");
                  setResetSentSuccess(false);
                  setError("");
                }}
                className="inline-flex items-center gap-1.5 py-1 text-xs font-semibold text-brand-charcoal/75 hover:text-brand-charcoal transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Volver al inicio de sesión</span>
              </button>

              <div className="space-y-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-brand-charcoal pt-1">
                  Restablecer o Crear Contraseña
                </h2>
                <p className="text-xs sm:text-sm text-brand-charcoal/75 leading-relaxed">
                  Si tu cuenta fue creada por nuestro equipo o si olvidaste tu
                  clave, ingresa tu correo autorizado para recibir un enlace
                  seguro de configuración.
                </p>
              </div>

              {resetSentSuccess ? (
                <div
                  role="status"
                  className="rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-5 space-y-3"
                >
                  <div className="flex items-center gap-2.5 text-emerald-800 font-display text-sm font-bold">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <span>Solicitud Procesada con Seguridad</span>
                  </div>
                  <p className="text-xs text-emerald-950/85 leading-relaxed">
                    Si el correo <strong>{email}</strong> se encuentra
                    registrado y autorizado en nuestro sistema, recibirás en los
                    próximos minutos un enlace criptográfico de un solo uso para
                    configurar tu contraseña.
                  </p>
                  <p className="text-[11px] text-emerald-900/75">
                    Por seguridad, el enlace expirará automáticamente tras su
                    uso o después del tiempo límite establecido. Revisa también
                    tu bandeja de Spam o Promociones.
                  </p>
                </div>
              ) : (
                <form
                  onSubmit={handleSubmitForgotPassword}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <label
                      htmlFor="reset-email"
                      className="block text-xs font-semibold text-brand-charcoal"
                    >
                      Correo Electrónico Autorizado
                    </label>
                    <input
                      id="reset-email"
                      type="email"
                      required
                      autoComplete="email"
                      disabled={isLocked}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="cliente@correo.com"
                      className="h-12 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 px-4 text-sm text-brand-charcoal placeholder:text-brand-charcoal/50 focus:bg-brand-white focus:border-brand-red focus:outline-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || isLocked}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-charcoal px-6 py-4 text-xs sm:text-sm font-semibold text-brand-white shadow-lg hover:bg-brand-red transition-all disabled:opacity-50"
                  >
                    <span>
                      {submitting
                        ? "Generando enlace seguro..."
                        : "Enviar Enlace de Contraseña"}
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </form>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-brand-platinum text-center">
            <Link
              href="/"
              className="inline-block py-1 text-xs font-semibold text-brand-charcoal/75 hover:text-brand-charcoal transition-colors"
            >
              ← Volver a la página principal de Global Visa Consulting
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}