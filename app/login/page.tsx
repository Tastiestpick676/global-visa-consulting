// app/login/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ShieldCheck, Lock, ArrowRight, AlertCircle, Sparkles } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { DestinationCountry } from "@/types/visa";
import { Input } from "@/components/ui/input";

export default function LoginPage() {
  const router = useRouter();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [destination, setDestination] = useState<DestinationCountry>("USA");
  const [errorMsg, setErrorMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSubmitting(true);

    try {
      if (isRegistering) {
        if (!fullName.trim()) {
          setErrorMsg("Por favor ingresa tu nombre completo como aparece en el pasaporte.");
          setSubmitting(false);
          return;
        }
        await signUp(email, password, fullName.trim(), destination);
      } else {
        await signIn(email, password);
      }
      router.push("/dashboard");
    } catch {
      setErrorMsg(
        isRegistering
          ? "No se pudo activar la cuenta. Verifica que el correo no esté en uso y que la contraseña tenga al menos 6 caracteres."
          : "Credenciales inválidas. Verifica tu correo y contraseña."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg("");
    setSubmitting(true);
    try {
      await signInWithGoogle(destination);
      router.push("/dashboard");
    } catch {
      setErrorMsg("No se pudo completar el acceso con Google. Intenta nuevamente.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-12 bg-brand-white">
      {/* Columna Izquierda: Panel Ejecutivo en Carbón Absoluto */}
      <div className="hidden lg:flex lg:col-span-5 bg-brand-charcoal text-brand-white p-12 flex-col justify-between">
        <div>
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-brand-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <span className="font-display text-lg font-bold tracking-tight">
              GLOBAL VISA CONSULTING
            </span>
          </Link>

          <div className="mt-20 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-medium text-white/80">
              <Sparkles className="h-3.5 w-3.5 text-brand-red" />
              <span>Portal Privado de Clientes</span>
            </div>
            <h1 className="font-display text-4xl font-bold leading-tight">
              Control total de tu expediente migratorio en tiempo real.
            </h1>
            <p className="text-sm text-white/70 leading-relaxed">
              Toda tu información personal (PII) está protegida bajo reglas de aislamiento criptográfico. 
              Solo tú y tu especialista legal asignado tienen acceso a este entorno.
            </p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 p-6 border border-white/10 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-brand-red uppercase tracking-wider">
            <Lock className="h-4 w-4" />
            <span>Seguridad Nivel Bancario</span>
          </div>
          <p className="text-xs text-white/60 leading-relaxed">
            Conexión directa con Firebase Cloud Firestore & Storage bajo protocolo estricto de privacidad.
          </p>
        </div>
      </div>

      {/* Columna Derecha: Formulario de Acceso / Activación */}
      <div className="lg:col-span-7 flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md space-y-7">
          {/* Header móvil */}
          <div className="lg:hidden flex items-center justify-between border-b border-brand-platinum pb-4">
            <Link href="/" className="inline-flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red text-brand-white">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="font-display text-base font-bold text-brand-charcoal">
                GLOBAL VISA
              </span>
            </Link>
            <Link href="/" className="text-xs font-semibold text-brand-charcoal/60 hover:text-brand-charcoal">
              ← Volver al inicio
            </Link>
          </div>

          <div className="space-y-2">
            <h2 className="font-display text-3xl font-bold text-brand-charcoal">
              {isRegistering ? "Activar Expediente Digital" : "Bienvenido a tu Portal"}
            </h2>
            <p className="text-sm text-brand-charcoal/65">
              {isRegistering
                ? "Crea tus credenciales privadas para comenzar a diligenciar tu solicitud."
                : "Ingresa con tu cuenta para ver el avance de tu visa en tiempo real."}
            </p>
          </div>

          {/* Selector de Modo (Login vs Registro) */}
          <div className="grid grid-cols-2 rounded-xl bg-brand-platinum p-1 text-xs font-semibold">
            <button
              type="button"
              onClick={() => {
                setIsRegistering(false);
                setErrorMsg("");
              }}
              className={`rounded-lg py-2.5 transition-all ${
                !isRegistering
                  ? "bg-brand-white text-brand-charcoal shadow-sm"
                  : "text-brand-charcoal/60 hover:text-brand-charcoal"
              }`}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => {
                setIsRegistering(true);
                setErrorMsg("");
              }}
              className={`rounded-lg py-2.5 transition-all ${
                isRegistering
                  ? "bg-brand-white text-brand-charcoal shadow-sm"
                  : "text-brand-charcoal/60 hover:text-brand-charcoal"
              }`}
            >
              Activar Cuenta Nueva
            </button>
          </div>

          {errorMsg && (
            <div className="flex items-start gap-3 rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 text-xs font-medium text-brand-red">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Botón Oficial de Google */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-3 rounded-full border border-brand-charcoal/15 bg-brand-white px-6 py-3.5 text-sm font-semibold text-brand-charcoal shadow-xs hover:bg-brand-platinum/60 disabled:opacity-50 transition-all"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            <span>Continuar con Google</span>
          </button>

          {/* Separador */}
          <div className="relative flex items-center justify-center">
            <div className="w-full border-t border-brand-platinum" />
            <span className="bg-brand-white px-4 text-[11px] font-medium uppercase tracking-wider text-brand-charcoal/45 shrink-0">
              o con tu correo
            </span>
            <div className="w-full border-t border-brand-platinum" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-brand-charcoal">
                    Nombre Completo (Como figura en tu pasaporte)
                  </label>
                  <Input
                    type="text"
                    required
                    placeholder="Ej. Carlos Andrés Mendoza"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="h-11 rounded-xl bg-brand-platinum/50 border-brand-platinum"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-brand-charcoal">
                    País de Destino de tu Solicitud
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDestination("USA")}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        destination === "USA"
                          ? "border-brand-red bg-brand-red/5 text-brand-charcoal font-semibold"
                          : "border-brand-platinum bg-brand-white text-brand-charcoal/70"
                      }`}
                    >
                      <p className="text-sm">🇺🇸 Estados Unidos</p>
                      <p className="text-[11px] text-brand-charcoal/55">Visa B1/B2 (DS-160)</p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDestination("JAPAN")}
                      className={`rounded-xl border p-3 text-left transition-all ${
                        destination === "JAPAN"
                          ? "border-brand-red bg-brand-red/5 text-brand-charcoal font-semibold"
                          : "border-brand-platinum bg-brand-white text-brand-charcoal/70"
                      }`}
                    >
                      <p className="text-sm">🇯🇵 Japón</p>
                      <p className="text-[11px] text-brand-charcoal/55">Turismo / Negocios</p>
                    </button>
                  </div>
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-charcoal">
                Correo Electrónico
              </label>
              <Input
                type="email"
                required
                placeholder="cliente@correo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 rounded-xl bg-brand-platinum/50 border-brand-platinum"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-brand-charcoal">
                Contraseña Privada
              </label>
              <Input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 rounded-xl bg-brand-platinum/50 border-brand-platinum"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-sm font-semibold text-brand-white shadow-lg shadow-brand-red/20 hover:bg-brand-red/90 disabled:opacity-50 transition-all"
            >
              <span>
                {submitting
                  ? "Verificando credenciales..."
                  : isRegistering
                  ? "Crear Cuenta e Ir al Dashboard"
                  : "Ingresar a mi Portal"}
              </span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </form>

          <div className="pt-4 border-t border-brand-platinum text-center">
            <Link
              href="/"
              className="text-xs font-medium text-brand-charcoal/60 hover:text-brand-charcoal transition-colors"
            >
              ← Volver a la página principal de Global Visa Consulting
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}