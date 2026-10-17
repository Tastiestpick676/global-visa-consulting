// components/landing/ProcessSteps.tsx
import { MessageSquareCheck, Laptop, Award } from "lucide-react";

const steps = [
  {
    number: "01",
    title: "Diagnóstico Viable por WhatsApp",
    subtitle: "High-Touch Sales",
    description:
      "Evaluamos tu perfil migratorio de forma honesta antes de que pagues. Definimos la estrategia jurídica exacta para tu caso en EE. UU. o Japón y activamos tu cuenta privada.",
    icon: MessageSquareCheck,
    dark: false,
  },
  {
    number: "02",
    title: "Recolección Inteligente y Bóveda",
    subtitle: "High-Tech Delivery",
    description:
      "Accedes a tu Portal de Usuario. Llenas formularios dinámicos en español con autoguardado y subes tus soportes a tu bóveda segura mientras nuestro equipo estructura tu aplicación oficial.",
    icon: Laptop,
    dark: false,
  },
  {
    number: "03",
    title: "Entrenamiento Consular y Cita",
    subtitle: "Preparación de Élite",
    description:
      "Auditamos cada respuesta, agendamos tu cita oficial y te entrenamos en nuestra Sala de Simulación para que asistas al consulado con total seguridad y cero nervios.",
    icon: Award,
    dark: true,
  },
];

export function ProcessSteps() {
  return (
    <section id="proceso" className="bg-brand-platinum/60 py-24 border-y border-brand-platinum">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        {/* Encabezado de sección */}
        <div className="max-w-3xl space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-red">
            El Nuevo Estándar Migratorio
          </span>
          <h2 className="font-display text-3xl font-bold tracking-tight text-brand-charcoal sm:text-5xl">
            Tres pasos claros. Cero incertidumbre.
          </h2>
          <p className="text-base text-brand-charcoal/70 leading-relaxed">
            Reemplazamos la opacidad de las agencias tradicionales por un sistema transparente 
            donde siempre sabes qué está ocurriendo con tu trámite.
          </p>
        </div>

        {/* Grid Bento Box */}
        <div className="mt-14 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {steps.map((step) => {
            const Icon = step.icon;
            return (
              <div
                key={step.number}
                className={`group relative flex flex-col justify-between rounded-2xl p-8 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${
                  step.dark
                    ? "bg-brand-charcoal text-brand-white"
                    : "bg-brand-white text-brand-charcoal border border-brand-platinum"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span
                      className={`font-display text-4xl font-bold ${
                        step.dark ? "text-brand-red" : "text-brand-charcoal/15"
                      }`}
                    >
                      {step.number}
                    </span>
                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                        step.dark
                          ? "bg-brand-red text-brand-white"
                          : "bg-brand-platinum text-brand-charcoal"
                      }`}
                    >
                      <Icon className="h-6 w-6" />
                    </div>
                  </div>

                  <p
                    className={`mt-8 text-xs font-semibold uppercase tracking-wider ${
                      step.dark ? "text-brand-red" : "text-brand-red"
                    }`}
                  >
                    {step.subtitle}
                  </p>
                  <h3 className="mt-2 font-display text-2xl font-bold tracking-tight">
                    {step.title}
                  </h3>
                  <p
                    className={`mt-4 text-sm leading-relaxed ${
                      step.dark ? "text-white/75" : "text-brand-charcoal/70"
                    }`}
                  >
                    {step.description}
                  </p>
                </div>

                <div
                  className={`mt-8 pt-4 border-t text-xs font-medium ${
                    step.dark
                      ? "border-white/10 text-white/50"
                      : "border-brand-platinum text-brand-charcoal/50"
                  }`}
                >
                  Monitoreo en tiempo real incluido
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}