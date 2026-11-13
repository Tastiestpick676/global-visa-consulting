// components/landing/PricingSection.tsx
"use client";

import { useState } from "react";
import {
  CheckCircle2,
  ArrowUpRight,
  CalendarClock,
  Users,
} from "lucide-react";
import { getWhatsAppUrl } from "@/lib/constants";

type JurisdictionTab = "USA" | "JAPAN";

interface PricingTier {
  id: string;
  name: string;
  subtitle: string;
  price: string;
  currency: string;
  unitLabel: string;
  badge?: string;
  highlighted: boolean;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaMessage: string;
}

const PRICING_BY_COUNTRY: Record<JurisdictionTab, PricingTier[]> = {
  USA: [
    {
      id: "usa-essential",
      name: "Essential USA",
      subtitle: "Renovación o Gestión Base DS-160",
      price: "$180.000",
      currency: "COP",
      unitLabel: "Precio lanzamiento • Por solicitante",
      highlighted: false,
      description:
        "Ideal para renovaciones sin entrevista o viajeros que solo requieren un diligenciamiento técnico impecable de su formulario y programación de citas.",
      features: [
        "Acceso al Portal de Cliente 24/7 y carga segura de datos",
        "Cuestionario inteligente en español traducido a inglés técnico (DS-160)",
        "Auditoría de coherencia de datos antes de enviar a CEAC",
        "Emisión de hoja oficial de confirmación DS-160",
        "Creación de cuenta oficial, gestión de pago MRV y agendamiento CAS + Embajada",
      ],
      ctaLabel: "Elegir Essential USA",
      ctaMessage:
        "Hola Global Visa Consulting, me interesa el Plan Essential USA ($180.000 COP) para iniciar mi trámite.",
    },
    {
      id: "usa-priority",
      name: "Priority Pro USA",
      subtitle: "Primera Vez + Estrategia de Arraigo + Simulacro",
      price: "$290.000",
      currency: "COP",
      unitLabel: "Por solicitante",
      badge: "MÁS ELEGIDO",
      highlighted: true,
      description:
        "Diseñado para primeras solicitudes que buscan estructurar un perfil sólido bajo los criterios de la Sección 214(b) y llegar entrenados frente al cónsul.",
      features: [
        "Todo lo incluido en el Plan Essential USA",
        "Diagnóstico y estructuración de perfil de arraigo laboral y familiar",
        "Guía personalizada de documentos de soporte según tu perfil",
        "1 Sesión de simulacro de entrevista consular 1-a-1 en vivo (Google Meet)",
        "Acceso a banco de preguntas reales y entrenamiento en el portal",
        "1 Búsqueda y gestión de adelanto de cita consular incluida",
      ],
      ctaLabel: "Elegir Priority Pro USA",
      ctaMessage:
        "Hola Global Visa Consulting, quiero contratar el Plan Priority Pro USA ($290.000 COP).",
    },
    {
      id: "usa-vip",
      name: "VIP Concierge USA",
      subtitle: "Rechazos Previos 214(b), Independientes o Ejecutivos",
      price: "$420.000",
      currency: "COP",
      unitLabel: "Por solicitante",
      highlighted: false,
      description:
        "Acompañamiento intensivo para reconstruir perfiles tras una negación previa o estructurar ingresos complejos (independientes, comerciantes o patrocinadores).",
      features: [
        "Todo lo incluido en el Plan Priority Pro USA",
        "Auditoría detallada de causas de rechazo previo (Sección 214b)",
        "Estrategia de corrección de perfil y narrativa consular",
        "Doble sesión (2) de simulacro de entrevista 1-a-1 con feedback correctivo",
        "Monitoreo prioritario continuo para adelantamiento de cita",
        "Soporte directo preferencial por WhatsApp durante todo el proceso",
      ],
      ctaLabel: "Elegir VIP Concierge USA",
      ctaMessage:
        "Hola Global Visa Consulting, me interesa el Plan VIP Concierge USA ($420.000 COP) para evaluar mi caso.",
    },
  ],
  JAPAN: [
    {
      id: "jp-essential",
      name: "Essential Japón",
      subtitle: "Estructuración Básica de Expediente",
      price: "$150.000",
      currency: "COP",
      unitLabel: "Por solicitante",
      highlighted: false,
      description:
        "Para viajeros con ingresos formales (empleados) y solvencia propia clara que necesitan sus formularios e itinerario oficial bajo norma japonesa.",
      features: [
        "Acceso al Portal de Cliente y lista de chequeo interactiva",
        "Diligenciamiento oficial del Formulario de Solicitud MOFA (con código QR)",
        "Elaboración técnica del Schedule of Stay (Itinerario día por día exigido)",
        "Verificación de formato de reservas de vuelos y hoteles",
        "Instructivo paso a paso de ordenamiento e impresión de carpeta física",
      ],
      ctaLabel: "Elegir Essential Japón",
      ctaMessage:
        "Hola Global Visa Consulting, me interesa el Plan Essential Japón ($150.000 COP) para iniciar mi trámite.",
    },
    {
      id: "jp-priority",
      name: "Priority Pro Japón",
      subtitle: "Auditoría Financiera + Carpeta Llave en Mano",
      price: "$230.000",
      currency: "COP",
      unitLabel: "Por solicitante",
      badge: "RECOMENDADO JAPÓN",
      highlighted: true,
      description:
        "Blindaje documental completo. Revisamos tus extractos bancarios al milímetro y diseñamos una ruta lógica para evitar requerimientos de la Embajada.",
      features: [
        "Todo lo incluido en el Plan Essential Japón",
        "Auditoría detallada de extractos bancarios (últimos 3 meses, saldos y promedios)",
        "Diseño personalizado de ruta lógica en Schedule of Stay (Tokio, Kioto, Osaka, etc.)",
        "Estructuración de presupuesto de viaje coherente con tu solvencia",
        "1 Sesión 1-a-1 en vivo (Google Meet) de revisión final antes de imprimir",
        "Archivos finales en PDF auditados y listos para descarga en tu portal",
      ],
      ctaLabel: "Elegir Priority Pro Japón",
      ctaMessage:
        "Hola Global Visa Consulting, quiero contratar el Plan Priority Pro Japón ($230.000 COP).",
    },
    {
      id: "jp-vip",
      name: "VIP Concierge Japón",
      subtitle: "Con Garante (Patrocinador), Independientes o Familias",
      price: "$340.000",
      currency: "COP",
      unitLabel: "Por solicitante / o Pareja",
      highlighted: false,
      description:
        "Especial para solicitudes que requieren demostrar ingresos como independientes, rentistas de capital, o viajeros patrocinados por un familiar.",
      features: [
        "Todo lo incluido en el Plan Priority Pro Japón",
        "Redacción técnica de Carta de Garantía (Letter of Guarantee) y motivo de invitación",
        "Estructuración de soportes de parentesco y solvencia del patrocinador",
        "Conciliación documental de ingresos para independientes o empresarios",
        "Redacción de cartas explicativas ante movimientos bancarios atípicos",
        "Soporte directo por WhatsApp hasta la radicación del expediente",
      ],
      ctaLabel: "Elegir VIP Concierge Japón",
      ctaMessage:
        "Hola Global Visa Consulting, me interesa el Plan VIP Concierge Japón ($340.000 COP) para evaluar nuestro caso.",
    },
  ],
};

export function PricingSection() {
  const [selectedCountry, setSelectedCountry] =
    useState<JurisdictionTab>("USA");
  const tiers = PRICING_BY_COUNTRY[selectedCountry];

  return (
    <section id="precios" className="bg-brand-white py-24 font-sans">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Encabezado y Selector de Jurisdicción */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
          <div className="max-w-2xl space-y-3">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-brand-red block">
              HONORARIOS TRANSPARENTES POR JURISDICCIÓN
            </span>
            <h2 className="font-display text-3xl font-bold tracking-tight text-brand-charcoal sm:text-5xl">
              Inversión clara desde el primer día.
            </h2>
            <p className="text-sm sm:text-base text-brand-charcoal/70 leading-relaxed">
              {selectedCountry === "USA"
                ? "Proceso ante el Departamento de Estado (CEAC), programación de citas CAS + Embajada y preparación frente al Oficial Consular bajo la Sección 214(b)."
                : "Estructuración documental bajo estándares de la Embajada del Japón (MOFA), auditoría de solvencia bancaria y diseño de Schedule of Stay día por día."}
            </p>
          </div>

          <div className="space-y-2 shrink-0">
            <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand-charcoal/60 block lg:text-right">
              SELECCIONA EL PAÍS DE TU TRÁMITE:
            </span>
            <div className="inline-flex rounded-2xl bg-brand-platinum/60 p-1.5 border border-brand-charcoal/10">
              <button
                type="button"
                onClick={() => setSelectedCountry("USA")}
                className={`inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-xs font-bold transition-all cursor-pointer ${
                  selectedCountry === "USA"
                    ? "bg-brand-charcoal text-brand-white shadow-sm"
                    : "text-brand-charcoal/70 hover:text-brand-charcoal"
                }`}
              >
                <span className="rounded bg-brand-red px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-white">
                  US
                </span>
                <span className="text-left leading-tight">
                  Estados Unidos
                  <span className="block text-[10px] opacity-80">(B1/B2)</span>
                </span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedCountry("JAPAN")}
                className={`inline-flex items-center gap-2.5 rounded-xl px-5 py-3 text-xs font-bold transition-all cursor-pointer ${
                  selectedCountry === "JAPAN"
                    ? "bg-brand-charcoal text-brand-white shadow-sm"
                    : "text-brand-charcoal/70 hover:text-brand-charcoal"
                }`}
              >
                <span className="rounded bg-brand-charcoal/15 px-1.5 py-0.5 font-mono text-[10px] font-extrabold text-brand-charcoal">
                  JP
                </span>
                <span className="text-left leading-tight">Japón (MOFA)</span>
              </button>
            </div>
          </div>
        </div>

        {/* Grid de 3 Tiers */}
        <div className="mt-14 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-stretch">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className={`relative flex flex-col justify-between rounded-3xl p-8 transition-all ${
                tier.highlighted
                  ? "bg-brand-charcoal text-brand-white shadow-2xl ring-2 ring-brand-red lg:-translate-y-2"
                  : "bg-brand-white text-brand-charcoal border border-brand-charcoal/12 shadow-xs"
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-display text-xl sm:text-2xl font-bold">
                      {tier.name}
                    </h3>
                    <p
                      className={`text-xs font-medium mt-1 ${
                        tier.highlighted
                          ? "text-white/70"
                          : "text-brand-charcoal/65"
                      }`}
                    >
                      {tier.subtitle}
                    </p>
                  </div>

                  {tier.badge && (
                    <span className="shrink-0 rounded-full bg-brand-red px-3 py-1 font-mono text-[10px] font-extrabold uppercase tracking-wider text-brand-white">
                      {tier.badge}
                    </span>
                  )}
                </div>

                <div className="mt-6 space-y-1">
                  <div className="flex items-baseline gap-1.5">
                    <span className="font-display text-4xl sm:text-5xl font-bold tracking-tight">
                      {tier.price}
                    </span>
                    <span
                      className={`font-mono text-xs font-bold uppercase ${
                        tier.highlighted
                          ? "text-white/70"
                          : "text-brand-charcoal/60"
                      }`}
                    >
                      {tier.currency}
                    </span>
                  </div>
                  <p
                    className={`text-[11px] font-semibold ${
                      tier.highlighted
                        ? "text-brand-red"
                        : "text-brand-charcoal/55"
                    }`}
                  >
                    {tier.unitLabel}
                  </p>
                </div>

                <p
                  className={`mt-4 text-xs sm:text-sm leading-relaxed ${
                    tier.highlighted
                      ? "text-white/80"
                      : "text-brand-charcoal/75"
                  }`}
                >
                  {tier.description}
                </p>

                <ul className="mt-6 space-y-3.5 border-t pt-6 border-current/10">
                  {tier.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex items-start gap-2.5 text-xs sm:text-sm"
                    >
                      <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0 mt-0.5" />
                      <span
                        className={
                          tier.highlighted
                            ? "text-white/90 leading-snug"
                            : "text-brand-charcoal/85 leading-snug"
                        }
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-8 pt-2">
                <a
                  href={getWhatsAppUrl(tier.ctaMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-xs sm:text-sm font-bold transition-all ${
                    tier.highlighted
                      ? "bg-brand-red text-brand-white hover:bg-brand-red/90 shadow-lg shadow-brand-red/25"
                      : "border border-brand-charcoal/25 bg-brand-white text-brand-charcoal hover:bg-brand-charcoal hover:text-brand-white"
                  }`}
                >
                  <span>{tier.ctaLabel}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>

        {/* Nota / CTA Secundario para Tarifas Grupales y Adelanto de Cita */}
        <div className="mt-10 rounded-3xl bg-brand-platinum/50 border border-brand-charcoal/10 p-6 sm:px-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-red/10 text-brand-red">
              {selectedCountry === "USA" ? (
                <CalendarClock className="h-5 w-5" />
              ) : (
                <Users className="h-5 w-5" />
              )}
            </div>
            <div className="space-y-0.5">
              <p className="text-xs sm:text-sm font-bold text-brand-charcoal">
                {selectedCountry === "USA"
                  ? "¿Viajas en familia (3 o más personas) o solo necesitas Adelantar tu Cita ($160.000 COP)?"
                  : "¿Viajas en grupo familiar a Japón (3 o más personas)?"}
              </p>
              <p className="text-xs text-brand-charcoal/70">
                {selectedCountry === "USA"
                  ? "Accede a tarifas preferenciales para núcleos familiares o contrata únicamente el monitoreo de adelanto si ya tienes tu DS-160 listo."
                  : "Cotiza nuestra tarifa grupal sincronizada para familias que viajan bajo el mismo itinerario en Japón."}
              </p>
            </div>
          </div>

          <a
            href={getWhatsAppUrl(
              selectedCountry === "USA"
                ? "Hola Global Visa Consulting, quiero cotizar una tarifa grupal familiar o el servicio de Adelanto de Cita ($160.000 COP)."
                : "Hola Global Visa Consulting, quiero cotizar una tarifa grupal familiar para Japón."
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-brand-charcoal hover:bg-brand-red px-5 py-3 text-xs font-bold text-brand-white transition-all shrink-0"
          >
            <span>Cotiza tarifa grupal aquí</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>

        <p className="mt-8 text-center text-xs text-brand-charcoal/55">
          * Los valores expresados corresponden a nuestros honorarios de
          consultoría y uso de plataforma tecnológica. No incluyen las tasas
          consulares oficiales de cada embajada.
        </p>
      </div>
    </section>
  );
}