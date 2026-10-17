// components/landing/HeroSection.tsx
import { ArrowRight, CheckCircle2, Sparkles, Lock, FileCheck2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { getWhatsAppUrl } from "@/lib/constants";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-brand-white pt-12 pb-24 lg:pt-20 lg:pb-32">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-12 lg:items-center">
          
          {/* Columna Izquierda: Copy de Alto Impacto */}
          <div className="lg:col-span-7 space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-platinum px-4 py-1.5 text-xs font-semibold text-brand-charcoal">
              <Sparkles className="h-3.5 w-3.5 text-brand-red" />
              <span>Especialistas en Visas para EE. UU. y Japón</span>
            </div>

            <h1 className="font-display text-4xl font-bold tracking-tight text-brand-charcoal sm:text-6xl leading-[1.08]">
              Tu visa gestionada con{" "}
              <span className="text-brand-red">precisión legal</span> y tecnología en tiempo real.
            </h1>

            <p className="max-w-2xl text-lg text-brand-charcoal/75 leading-relaxed">
              Olvídate de los tramitadores tradicionales y de los interminables archivos en Word. 
              Combinamos estrategia migratoria personalizada con un portal privado donde controlas 
              cada avance de tu solicitud sin ansiedad ni fricción.
            </p>

            {/* CTAs en forma de píldora */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 pt-2">
              <a
                href={getWhatsAppUrl("Hola Global Visa Consulting, quiero agendar mi estudio inicial por WhatsApp.")}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-red px-8 py-4 text-base font-semibold text-brand-white shadow-lg shadow-brand-red/20 hover:bg-brand-red/90 transition-all"
              >
                <span>Iniciar Diagnóstico en WhatsApp</span>
                <ArrowRight className="h-5 w-5" />
              </a>
              <a
                href="#proceso"
                className="inline-flex items-center justify-center rounded-full border border-brand-charcoal/15 bg-brand-white px-7 py-4 text-base font-semibold text-brand-charcoal hover:bg-brand-platinum transition-colors"
              >
                Conocer la Plataforma
              </a>
            </div>

            {/* Puntos de confianza */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 border-t border-brand-platinum text-sm text-brand-charcoal/80">
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0" />
                <span>Tracking 24/7 en tu Portal</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0" />
                <span>Cero formularios PDF confusos</span>
              </div>
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0" />
                <span>Encriptación bancaria PII</span>
              </div>
            </div>
          </div>

          {/* Columna Derecha: Bento Preview del Portal de Usuario */}
          <div className="lg:col-span-5">
            <div className="rounded-2xl bg-brand-charcoal p-6 sm:p-8 text-brand-white shadow-2xl border border-brand-charcoal">
              <div className="flex items-center justify-between border-b border-white/10 pb-5">
                <div>
                  <p className="text-xs uppercase tracking-wider text-white/50">Portal del Cliente</p>
                  <h3 className="font-display text-lg font-semibold mt-0.5">Solicitud B1/B2 — EE. UU.</h3>
                </div>
                <Badge className="rounded-full bg-brand-red text-brand-white hover:bg-brand-red px-3 py-1 text-xs">
                  En Progreso • 75%
                </Badge>
              </div>

              {/* Barra de progreso visual */}
              <div className="my-6 space-y-2">
                <div className="flex justify-between text-xs text-white/70">
                  <span>Fase actual: Auditoría Consular DS-160</span>
                  <span className="font-semibold text-white">Paso 3 de 4</span>
                </div>
                <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-3/4 rounded-full bg-brand-red" />
                </div>
              </div>

              {/* Mini tarjetas Bento de módulos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-white/5 p-4 border border-white/10">
                  <div className="flex items-center gap-3">
                    <FileCheck2 className="h-5 w-5 text-brand-red" />
                    <div>
                      <p className="text-sm font-medium">Formulario Inteligente DS-160</p>
                      <p className="text-xs text-white/60">Validado por especialista legal</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400">Completado</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white/5 p-4 border border-white/10">
                  <div className="flex items-center gap-3">
                    <Lock className="h-5 w-5 text-brand-red" />
                    <div>
                      <p className="text-sm font-medium">Bóveda de Documentos</p>
                      <p className="text-xs text-white/60">Pasaporte y soportes financieros</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400">Verificado</span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-white/10 p-4 border border-brand-red/50">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-brand-red" />
                    <div>
                      <p className="text-sm font-medium">Sala de Entrenamiento Consular</p>
                      <p className="text-xs text-white/60">Simulacro 1-a-1 listo para agendar</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-brand-red/20 px-2.5 py-1 text-[11px] font-semibold text-brand-red">
                    Acción Requerida
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}