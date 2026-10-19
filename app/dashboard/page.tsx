// app/dashboard/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  calculateApplicationMetrics,
  formatDisplayName,
  StepSemaphore,
} from "@/lib/firebase/db";
import {
  FileText,
  FolderLock,
  Award,
  CheckCircle2,
  ArrowRight,
  Clock,
  ShieldAlert,
  UserCheck,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";

function getSemaphoreBadge(state: StepSemaphore) {
  if (state === "completed") {
    return {
      label: "Completado",
      classes: "bg-emerald-500/15 text-emerald-700 border border-emerald-500/30",
      rowClasses: "bg-emerald-500/5 border-emerald-500/25",
      iconColor: "text-emerald-600",
    };
  }
  if (state === "in_progress") {
    return {
      label: "En Proceso",
      classes: "bg-amber-500/15 text-amber-700 border border-amber-500/30",
      rowClasses: "bg-amber-500/5 border-amber-500/25",
      iconColor: "text-amber-600",
    };
  }
  return {
    label: "Faltante",
    classes: "bg-brand-red/15 text-brand-red border border-brand-red/30",
    rowClasses: "bg-brand-red/5 border-brand-red/20",
    iconColor: "text-brand-red",
  };
}

export default function DashboardPage() {
  const { profile, application, loading, simulateClientView } = useAuth();
  const router = useRouter();

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  useEffect(() => {
    if (!loading && isStaff && !simulateClientView) {
      router.replace("/dashboard/admin?tab=gobernanza");
    }
  }, [isStaff, simulateClientView, loading, router]);

  if (loading || (isStaff && !simulateClientView)) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-xs text-brand-charcoal/50">
          Redirigiendo al Backoffice...
        </div>
      </DashboardLayout>
    );
  }

  const metrics = calculateApplicationMetrics(application);
  const badgeStep1 = getSemaphoreBadge(metrics.formSemaphore);
  const badgeStep2 = getSemaphoreBadge(metrics.vaultSemaphore);
  const badgeStep3 = getSemaphoreBadge(metrics.consularSemaphore);
  const advisorCleanName = formatDisplayName(application?.assignedAdvisorName);

  return (
    <DashboardLayout>
      <div className="space-y-8 font-sans">
        {/* Bienvenida personalizada */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl bg-brand-charcoal p-8 text-brand-white shadow-xl">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-3 py-1 text-xs font-semibold text-brand-red">
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Expediente Protegido y Verificado</span>
              </span>
              {advisorCleanName && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
                  <UserCheck className="h-3.5 w-3.5" />
                  <span>Asesor: {advisorCleanName}</span>
                </span>
              )}
            </div>
            <h2 className="font-display text-3xl font-bold">
              Hola, {formatDisplayName(profile?.fullName) || "Estimado Cliente"}
            </h2>
            <p className="text-sm text-white/70 max-w-xl">
              Tu proceso para la{" "}
              <span className="text-white font-semibold">{application?.visaType}</span>{" "}
              avanza automáticamente a medida que completas tus etapas.
            </p>
          </div>

          <div className="rounded-xl bg-white/10 p-5 border border-white/10 shrink-0 text-center min-w-[140px]">
            <p className="text-xs uppercase tracking-wider text-white/60">
              Progreso Total
            </p>
            <p className="font-display text-4xl font-bold text-brand-red mt-1">
              {metrics.progressPercentage}%
            </p>
          </div>
        </div>

        {/* Grid Bento Box con Semáforo Verde / Amarillo / Rojo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/dashboard/formulario"
            className="group flex flex-col justify-between rounded-2xl bg-brand-white p-6 border border-brand-platinum shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-platinum text-brand-charcoal group-hover:bg-brand-red group-hover:text-brand-white transition-colors">
                  <FileText className="h-6 w-6" />
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${badgeStep1.classes}`}
                >
                  {badgeStep1.label}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-brand-charcoal mt-6">
                1. Cuestionario Estratégico
              </h3>
              <p className="text-xs text-brand-charcoal/70 mt-2 leading-relaxed">
                Completa en 3 minutos los datos que no aparecen en tus certificados para que redactemos tu aplicación.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between pt-4 border-t border-brand-platinum text-xs font-semibold text-brand-red">
              <span>Abrir cuestionario</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/dashboard/boveda"
            className="group flex flex-col justify-between rounded-2xl bg-brand-white p-6 border border-brand-platinum shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-platinum text-brand-charcoal group-hover:bg-brand-red group-hover:text-brand-white transition-colors">
                  <FolderLock className="h-6 w-6" />
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${badgeStep2.classes}`}
                >
                  {badgeStep2.label}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-brand-charcoal mt-6">
                2. Bóveda de Documentos
              </h3>
              <p className="text-xs text-brand-charcoal/70 mt-2 leading-relaxed">
                Sube tu pasaporte vigente y soportes financieros con encriptación de nivel bancario.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between pt-4 border-t border-brand-platinum text-xs font-semibold text-brand-red">
              <span>Gestionar archivos</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          <Link
            href="/dashboard/sala-entrenamiento"
            className="group flex flex-col justify-between rounded-2xl bg-brand-white p-6 border border-brand-platinum shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-platinum text-brand-charcoal group-hover:bg-brand-red group-hover:text-brand-white transition-colors">
                  <Award className="h-6 w-6" />
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${badgeStep3.classes}`}
                >
                  {badgeStep3.label}
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-brand-charcoal mt-6">
                3. Sala Consular & Citas
              </h3>
              <p className="text-xs text-brand-charcoal/70 mt-2 leading-relaxed">
                Videos de preparación, entregables de tus reuniones y agendamiento 1-a-1 con tu asesor asignado.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between pt-4 border-t border-brand-platinum text-xs font-semibold text-brand-red">
              <span>Entrar a la sala</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>
        </div>

        {/* Línea de Tiempo Completa con las 4 Etapas Reales */}
        <div className="rounded-2xl bg-brand-white p-8 border border-brand-platinum shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-xl font-bold text-brand-charcoal">
              Estado de Etapas en Tiempo Real
            </h3>
            <span className="text-xs font-semibold text-brand-charcoal/55">
              Paso {metrics.currentStep} de 4
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Etapa 1 */}
            <div className="flex items-start gap-3.5 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/25">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-brand-charcoal">
                    Etapa 1: Admisión y Provisionamiento
                  </p>
                  <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                    Completado
                  </span>
                </div>
                <p className="text-xs text-brand-charcoal/60 mt-1">
                  Expediente digital activo y protegido bajo aislamiento criptográfico.
                </p>
              </div>
            </div>

            {/* Etapa 2 */}
            <div className={`flex items-start gap-3.5 p-4 rounded-xl border ${badgeStep1.rowClasses}`}>
              {metrics.formSemaphore === "completed" ? (
                <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 ${badgeStep1.iconColor}`} />
              ) : metrics.formSemaphore === "in_progress" ? (
                <Clock className={`h-5 w-5 shrink-0 mt-0.5 ${badgeStep1.iconColor}`} />
              ) : (
                <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${badgeStep1.iconColor}`} />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-brand-charcoal">
                    Etapa 2: Cuestionario Estratégico
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeStep1.classes}`}>
                    {badgeStep1.label}
                  </span>
                </div>
                <p className="text-xs text-brand-charcoal/60 mt-1">
                  Recolección de información personal, laboral y plan de viaje.
                </p>
              </div>
            </div>

            {/* Etapa 3 */}
            <div className={`flex items-start gap-3.5 p-4 rounded-xl border ${badgeStep2.rowClasses}`}>
              {metrics.vaultSemaphore === "completed" ? (
                <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 ${badgeStep2.iconColor}`} />
              ) : metrics.vaultSemaphore === "in_progress" ? (
                <Clock className={`h-5 w-5 shrink-0 mt-0.5 ${badgeStep2.iconColor}`} />
              ) : (
                <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${badgeStep2.iconColor}`} />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-brand-charcoal">
                    Etapa 3: Bóveda y Auditoría Documental
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeStep2.classes}`}>
                    {badgeStep2.label}
                  </span>
                </div>
                <p className="text-xs text-brand-charcoal/60 mt-1">
                  Carga y verificación legal de pasaporte, fotografía y solvencia financiera.
                </p>
              </div>
            </div>

            {/* Etapa 4 */}
            <div className={`flex items-start gap-3.5 p-4 rounded-xl border ${badgeStep3.rowClasses}`}>
              {metrics.consularSemaphore === "completed" ? (
                <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 ${badgeStep3.iconColor}`} />
              ) : metrics.consularSemaphore === "in_progress" ? (
                <Clock className={`h-5 w-5 shrink-0 mt-0.5 ${badgeStep3.iconColor}`} />
              ) : (
                <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${badgeStep3.iconColor}`} />
              )}
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-brand-charcoal">
                    Etapa 4: Sala Consular & Entregables
                  </p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeStep3.classes}`}>
                    {badgeStep3.label}
                  </span>
                </div>
                <p className="text-xs text-brand-charcoal/60 mt-1">
                  Sesión 1-a-1 con tu especialista y entrega de formularios oficiales listos.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}