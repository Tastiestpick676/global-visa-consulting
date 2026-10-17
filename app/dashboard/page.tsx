// app/dashboard/page.tsx
"use client";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { FileText, FolderLock, Award, CheckCircle2, ArrowRight, Clock, ShieldAlert } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { profile, application } = useAuth();

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Bienvenida personalizada */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-2xl bg-brand-charcoal p-8 text-brand-white shadow-xl">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-3 py-1 text-xs font-semibold text-brand-red">
              <ShieldAlert className="h-3.5 w-3.5" />
              <span>Expediente Protegido y Verificado</span>
            </span>
            <h2 className="font-display text-3xl font-bold">
              Hola, {profile?.fullName || "Estimado Cliente"}
            </h2>
            <p className="text-sm text-white/70 max-w-xl">
              Tu proceso para la <span className="text-white font-semibold">{application?.visaType}</span> avanza según el cronograma legal establecido.
            </p>
          </div>

          <div className="rounded-xl bg-white/10 p-5 border border-white/10 shrink-0 text-center">
            <p className="text-xs uppercase tracking-wider text-white/60">Progreso Total</p>
            <p className="font-display text-4xl font-bold text-brand-red mt-1">
              {application?.progressPercentage || 25}%
            </p>
          </div>
        </div>

        {/* Grid Bento Box de Módulos del Portal */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {/* Módulo 1: Formulario */}
          <Link
            href="/dashboard/formulario"
            className="group flex flex-col justify-between rounded-2xl bg-brand-white p-6 border border-brand-platinum shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-platinum text-brand-charcoal group-hover:bg-brand-red group-hover:text-brand-white transition-colors">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600">
                  En Proceso
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-brand-charcoal mt-6">
                Formulario Inteligente
              </h3>
              <p className="text-xs text-brand-charcoal/70 mt-2 leading-relaxed">
                Completa tus datos personales, historial laboral y de viajes en español sin documentos confusos.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between pt-4 border-t border-brand-platinum text-xs font-semibold text-brand-red">
              <span>Continuar llenando</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

          {/* Módulo 2: Bóveda de Documentos */}
          <Link
            href="/dashboard/boveda"
            className="group flex flex-col justify-between rounded-2xl bg-brand-white p-6 border border-brand-platinum shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-platinum text-brand-charcoal group-hover:bg-brand-red group-hover:text-brand-white transition-colors">
                  <FolderLock className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600">
                  Verificado
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-brand-charcoal mt-6">
                Bóveda de Documentos
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

          {/* Módulo 3: Sala Consular */}
          <Link
            href="/dashboard/sala-entrenamiento"
            className="group flex flex-col justify-between rounded-2xl bg-brand-white p-6 border border-brand-platinum shadow-sm hover:shadow-md transition-all hover:-translate-y-1"
          >
            <div>
              <div className="flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-platinum text-brand-charcoal group-hover:bg-brand-red group-hover:text-brand-white transition-colors">
                  <Award className="h-6 w-6" />
                </div>
                <span className="rounded-full bg-brand-red/10 px-3 py-1 text-xs font-semibold text-brand-red">
                  Próximo Paso
                </span>
              </div>
              <h3 className="font-display text-xl font-bold text-brand-charcoal mt-6">
                Sala Consular (AI & 1-a-1)
              </h3>
              <p className="text-xs text-brand-charcoal/70 mt-2 leading-relaxed">
                Simulacro de entrevista consular en vivo y reportes estratégicos para tu cita oficial.
              </p>
            </div>

            <div className="mt-8 flex items-center justify-between pt-4 border-t border-brand-platinum text-xs font-semibold text-brand-red">
              <span>Ver simulacros</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </div>
          </Link>

        </div>

        {/* Sección de Historial de Fases */}
        <div className="rounded-2xl bg-brand-white p-8 border border-brand-platinum shadow-sm space-y-6">
          <h3 className="font-display text-xl font-bold text-brand-charcoal">
            Línea de Tiempo del Trámite
          </h3>

          <div className="space-y-4">
            <div className="flex items-start gap-4 p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-brand-charcoal">Fase 1: Diagnóstico Migratorio Inicial</p>
                <p className="text-xs text-brand-charcoal/60 mt-0.5">Perfil evaluado y aprobado en WhatsApp. Credenciales de portal generadas.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-brand-red/5 border border-brand-red/20">
              <Clock className="h-5 w-5 text-brand-red shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-brand-charcoal">Fase 2: Recolección y Auditoría Legal</p>
                <p className="text-xs text-brand-charcoal/60 mt-0.5">Actualmente diligenciando el Formulario Inteligente y cargando soportes a la bóveda.</p>
              </div>
            </div>

            <div className="flex items-start gap-4 p-4 rounded-xl bg-brand-platinum/60 border border-brand-platinum opacity-60">
              <div className="h-5 w-5 rounded-full border-2 border-brand-charcoal/30 shrink-0 mt-0.5 flex items-center justify-center text-[10px] font-bold">3</div>
              <div>
                <p className="text-sm font-semibold text-brand-charcoal">Fase 3: Simulacro Consular y Cita Oficial</p>
                <p className="text-xs text-brand-charcoal/60 mt-0.5">Pendiente de completar la fase anterior para agendar entrenamiento en vivo.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}