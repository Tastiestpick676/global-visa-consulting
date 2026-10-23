// app/reset-password/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { verifyPasswordResetCode, confirmPasswordReset } from "firebase/auth";
import { auth } from "@/lib/firebase/config";
import { BrandLogo } from "@/components/ui/BrandLogo";
import {
  Lock,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  ArrowRight,
  Eye,
  EyeOff,
  ShieldAlert,
} from "lucide-react";

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const oobCode = searchParams.get("oobCode") || "";

  const [verifyingCode, setVerifyingCode] = useState(true);
  const [accountEmail, setAccountEmail] = useState("");
  const [codeExpiredOrInvalid, setCodeExpiredOrInvalid] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [successChanged, setSuccessChanged] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const checkResetToken = async () => {
      if (!oobCode) {
        setCodeExpiredOrInvalid(true);
        setVerifyingCode(false);
        return;
      }

      try {
        const email = await verifyPasswordResetCode(auth, oobCode);
        setAccountEmail(email);
        setCodeExpiredOrInvalid(false);
      } catch {
        setCodeExpiredOrInvalid(true);
      } finally {
        setVerifyingCode(false);
      }
    };

    checkResetToken();
  }, [oobCode]);

  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumberOrSymbol = /[0-9!@#$%^&*(),.?":{}|<>_\-]/.test(newPassword);
  const passwordsMatch =
    newPassword.length > 0 && newPassword === confirmPassword;

  const isPasswordStrong =
    hasMinLength && hasUpper && hasLower && hasNumberOrSymbol && passwordsMatch;

  const handleConfirmNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordStrong || !oobCode) return;

    setSubmitting(true);
    setErrorMsg("");

    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccessChanged(true);
    } catch (err: any) {
      if (
        err?.code === "auth/expired-action-code" ||
        err?.code === "auth/invalid-action-code"
      ) {
        setCodeExpiredOrInvalid(true);
      } else {
        setErrorMsg(
          "No se pudo actualizar la contraseña. Por seguridad, solicita un nuevo enlace."
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (verifyingCode) {
    return (
      <main className="min-h-screen bg-brand-platinum/50 flex items-center justify-center p-6 font-sans">
        <div className="rounded-3xl bg-brand-white p-8 border border-brand-charcoal/10 shadow-lg max-w-md w-full text-center space-y-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-red border-t-transparent mx-auto" />
          <h1 className="font-display text-base font-bold text-brand-charcoal">
            Verificando firma criptográfica del enlace...
          </h1>
          <p className="text-xs text-brand-charcoal/75">
            Comprobando validez temporal y autenticidad del token de seguridad.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-brand-platinum/50 flex flex-col justify-center items-center p-6 font-sans">
      <div className="w-full max-w-md space-y-6">
        <div className="flex justify-center">
          <Link href="/" className="inline-block focus:outline-none">
            <BrandLogo theme="light" size="md" />
          </Link>
        </div>

        <div className="rounded-3xl bg-brand-white p-7 sm:p-9 border border-brand-charcoal/10 shadow-xl space-y-6">
          {codeExpiredOrInvalid ? (
            <div className="text-center space-y-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red mx-auto">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <div className="space-y-1.5">
                <h1 className="font-display text-2xl font-bold text-brand-charcoal">
                  Enlace Expirado o Utilizado
                </h1>
                <p className="text-xs sm:text-sm text-brand-charcoal/75 leading-relaxed">
                  Por estándares de seguridad bancaria, los enlaces de
                  recuperación son de <strong>un solo uso</strong> y tienen un
                  tiempo máximo de expiración.
                </p>
              </div>
              <div className="pt-2">
                <Link
                  href="/login"
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-charcoal px-6 py-3.5 text-xs font-semibold text-white hover:bg-brand-red transition-all"
                >
                  <span>Solicitar un Nuevo Enlace en el Portal</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          ) : successChanged ? (
            <div className="text-center space-y-5">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 mx-auto">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <div className="space-y-1.5">
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-800">
                  Credencial Actualizada
                </span>
                <h1 className="font-display text-2xl font-bold text-brand-charcoal pt-1">
                  Tu contraseña ha sido cambiada exitosamente
                </h1>
                <p className="text-xs sm:text-sm text-brand-charcoal/75 leading-relaxed">
                  El enlace temporal ha sido invalidado automáticamente. Ya
                  puedes iniciar sesión en tu portal con tu nueva clave privada.
                </p>
              </div>

              <button
                type="button"
                onClick={() => router.push("/login")}
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-4 text-xs sm:text-sm font-semibold text-white shadow-lg shadow-brand-red/25 hover:bg-brand-red/90 transition-all"
              >
                <span>Iniciar Sesión Ahora</span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red">
                  <KeyRound className="h-5 w-5" />
                </div>
                <h1 className="font-display text-2xl font-bold text-brand-charcoal pt-1">
                  Configurar Nueva Contraseña
                </h1>
                <p className="text-xs text-brand-charcoal/75">
                  Cuenta verificada:{" "}
                  <strong className="text-brand-charcoal">
                    {accountEmail}
                  </strong>
                </p>
              </div>

              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-center gap-2.5 rounded-xl bg-brand-red/10 border border-brand-red/30 p-3.5 text-xs font-semibold text-brand-red"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <form onSubmit={handleConfirmNewPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="new-password"
                    className="block text-xs font-semibold text-brand-charcoal"
                  >
                    Nueva Contraseña Privada
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPass ? "text" : "password"}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres..."
                      className="h-12 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 pl-4 pr-12 text-sm text-brand-charcoal placeholder:text-brand-charcoal/50 focus:bg-brand-white focus:border-brand-red focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((p) => !p)}
                      aria-label={
                        showPass ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      title={
                        showPass ? "Ocultar contraseña" : "Mostrar contraseña"
                      }
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-brand-charcoal/65 hover:bg-brand-charcoal/5 hover:text-brand-charcoal transition-colors"
                    >
                      {showPass ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="confirm-password"
                    className="block text-xs font-semibold text-brand-charcoal"
                  >
                    Confirmar Nueva Contraseña
                  </label>
                  <input
                    id="confirm-password"
                    type={showPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repite tu contraseña..."
                    className="h-12 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 px-4 text-sm text-brand-charcoal placeholder:text-brand-charcoal/50 focus:bg-brand-white focus:border-brand-red focus:outline-none"
                  />
                </div>

                <div className="rounded-2xl bg-brand-platinum/40 p-4 border border-brand-platinum space-y-2 text-[11px]">
                  <p className="font-bold text-brand-charcoal uppercase tracking-wider text-[10px]">
                    Estándares de Seguridad Requeridos:
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                    <span
                      className={
                        hasMinLength
                          ? "text-emerald-800 font-semibold"
                          : "text-brand-charcoal/70"
                      }
                    >
                      {hasMinLength ? "✓" : "•"} Mínimo 8 caracteres
                    </span>
                    <span
                      className={
                        hasUpper && hasLower
                          ? "text-emerald-800 font-semibold"
                          : "text-brand-charcoal/70"
                      }
                    >
                      {hasUpper && hasLower ? "✓" : "•"} Mayúsculas y minúsculas
                    </span>
                    <span
                      className={
                        hasNumberOrSymbol
                          ? "text-emerald-800 font-semibold"
                          : "text-brand-charcoal/70"
                      }
                    >
                      {hasNumberOrSymbol ? "✓" : "•"} Al menos 1 número o
                      símbolo
                    </span>
                    <span
                      className={
                        passwordsMatch
                          ? "text-emerald-800 font-semibold"
                          : "text-brand-charcoal/70"
                      }
                    >
                      {passwordsMatch ? "✓" : "•"} Las contraseñas coinciden
                    </span>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={!isPasswordStrong || submitting}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-4 text-xs sm:text-sm font-semibold text-brand-white shadow-lg shadow-brand-red/25 hover:bg-brand-red/90 transition-all disabled:opacity-50"
                >
                  <Lock className="h-4 w-4" />
                  <span>
                    {submitting
                      ? "Cifrando y guardando..."
                      : "Guardar Nueva Contraseña"}
                  </span>
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-brand-platinum/50 flex items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-red border-t-transparent" />
        </main>
      }
    >
      <ResetPasswordContent />
    </Suspense>
  );
}