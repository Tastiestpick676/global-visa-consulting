// components/landing/PricingSection.tsx
import { Check, Sparkles, ArrowUpRight } from "lucide-react";
import { getWhatsAppUrl } from "@/lib/constants";

const tiers = [
  {
    name: "Essential",
    subtitle: "Solicitud Individual Estándar",
    price: "$190",
    currency: "USD",
    description:
      "Ideal para perfiles con historial de viajes previo o renovaciones sin complicaciones.",
    features: [
      "Acceso completo al Portal de Usuario 24/7",
      "Formulario inteligente DS-160 / Japón en español",
      "Auditoría legal de respuestas y perfil",
      "Bóveda segura para pasaporte y documentos",
      "Agendamiento de cita consular oficial",
    ],
    ctaMessage:
      "Hola Global Visa Consulting, me interesa el Plan Essential ($190 USD) para iniciar mi trámite.",
    highlighted: false,
  },
  {
    name: "Priority Pro",
    subtitle: "Estrategia + Simulacro Consular",
    price: "$290",
    currency: "USD",
    description:
      "Nuestro plan más elegido. Diseñado para primeras solicitudes que buscan máxima probabilidad de aprobación.",
    features: [
      "Todo lo incluido en el Plan Essential",
      "Estrategia de arraigo personalizada por especialista",
      "Acceso a la Sala de Entrenamiento Consular",
      "1 Simulacro de entrevista 1-a-1 en vivo",
      "Monitoreo prioritario para adelanto de cita",
      "Soporte directo por WhatsApp con tu asesor",
    ],
    ctaMessage:
      "Hola Global Visa Consulting, quiero contratar el Plan Priority Pro ($290 USD).",
    highlighted: true,
  },
  {
    name: "VIP & Familia",
    subtitle: "Grupos o Casos Complejos",
    price: "$450",
    currency: "USD",
    description:
      "Atención ejecutiva para grupos familiares (hasta 3 personas) o solicitantes con rechazos previos.",
    features: [
      "Cobertura hasta para 3 perfiles sincronizados",
      "Auditoría forense de rechazos consulares previos",
      "2 Simulacros de entrevista personalizados",
      "Preparación de carpeta física y digital ejecutiva",
      "Acompañamiento prioritario hasta el día de la cita",
    ],
    ctaMessage:
      "Hola Global Visa Consulting, me interesa el Plan VIP & Familia ($450 USD) para evaluar nuestro caso.",
    highlighted: false,
  },
];

export function PricingSection() {
  return (
    <section id="precios" className="bg-brand-white py-24">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Encabezado */}
        <div className="mx-auto max-w-3xl text-center space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-red">
            Honorarios Transparentes
          </span>
          <h2 className="font-display text-3xl font-bold tracking-tight text-brand-charcoal sm:text-5xl">
            Inversión clara desde el primer día.
          </h2>
          <p className="text-base text-brand-charcoal/70 leading-relaxed">
            Sin cobros sorpresa ni letras pequeñas. Elige el nivel de acompañamiento 
            que mejor se adapte a tu perfil migratorio.
          </p>
        </div>

        {/* Grid de 3 Tiers */}
        <div className="mt-16 grid grid-cols-1 gap-8 lg:grid-cols-3 lg:items-stretch">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col justify-between rounded-2xl p-8 transition-all ${
                tier.highlighted
                  ? "bg-brand-charcoal text-brand-white shadow-2xl ring-2 ring-brand-red lg:-translate-y-2"
                  : "bg-brand-platinum/60 text-brand-charcoal border border-brand-platinum"
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-1 text-xs font-semibold text-brand-white shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Más Recomendado</span>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-2xl font-bold">{tier.name}</h3>
                    <p
                      className={`text-xs font-medium mt-0.5 ${
                        tier.highlighted ? "text-white/60" : "text-brand-charcoal/60"
                      }`}
                    >
                      {tier.subtitle}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-baseline gap-1.5">
                  <span className="font-display text-5xl font-bold tracking-tight">
                    {tier.price}
                  </span>
                  <span
                    className={`text-sm font-semibold ${
                      tier.highlighted ? "text-white/60" : "text-brand-charcoal/60"
                    }`}
                  >
                    {tier.currency}
                  </span>
                </div>

                <p
                  className={`mt-4 text-sm leading-relaxed ${
                    tier.highlighted ? "text-white/75" : "text-brand-charcoal/70"
                  }`}
                >
                  {tier.description}
                </p>

                <ul className="mt-8 space-y-3.5 border-t pt-6 border-current/10">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-3 text-sm">
                      <Check className="h-4 w-4 text-brand-red shrink-0 mt-0.5" />
                      <span
                        className={
                          tier.highlighted ? "text-white/90" : "text-brand-charcoal/85"
                        }
                      >
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-10">
                <a
                  href={getWhatsAppUrl(tier.ctaMessage)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`w-full inline-flex items-center justify-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition-all ${
                    tier.highlighted
                      ? "bg-brand-red text-brand-white hover:bg-brand-red/90 shadow-lg shadow-brand-red/25"
                      : "bg-brand-charcoal text-brand-white hover:bg-brand-charcoal/90"
                  }`}
                >
                  <span>Elegir {tier.name}</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-brand-charcoal/55">
          * Los valores expresados corresponden a nuestros honorarios de consultoría y uso de plataforma tecnológica. No incluyen las tasas consulares oficiales de cada embajada.
        </p>
      </div>
    </section>
  );
}