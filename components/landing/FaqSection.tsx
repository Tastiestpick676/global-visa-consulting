// components/landing/FaqSection.tsx
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    question: "¿Qué diferencia a Global Visa Consulting de un tramitador tradicional?",
    answer:
      "Los tramitadores tradicionales te envían un archivo PDF o Word confuso, llenan datos sin estrategia legal y te dejan a ciegas durante meses. En Global Visa Consulting tienes acceso a un Portal Privado con seguimiento en tiempo real, formularios inteligentes con autoguardado, bóveda encriptada y preparación consular estratégica.",
  },
  {
    question: "¿Mis datos personales y de pasaporte están seguros en la plataforma?",
    answer:
      "Absolutamente. Cumplimos con estrictos protocolos de privacidad para Información de Identificación Personal (PII). Tu información viaja encriptada y está protegida mediante reglas de seguridad que garantizan que solo tú y tu especialista asignado puedan visualizar tu expediente.",
  },
  {
    question: "¿Garantizan la aprobación de la visa de EE. UU. o Japón?",
    answer:
      "Por ley, ninguna firma seria puede garantizar la decisión final de un oficial consular. Lo que sí garantizamos es presentar una solicitud técnicamente impecable, sin errores en el formulario DS-160 o expediente japonés, y entrenarte para defender tu perfil con total solidez en la entrevista.",
  },
  {
    question: "¿Cómo funciona el estudio inicial por WhatsApp?",
    answer:
      "Al hacer clic en cualquiera de nuestros botones principales, hablarás con un consultor de admisiones que evaluará la viabilidad de tu caso. Si tu perfil es apto, definimos el plan ideal y te enviamos las credenciales de acceso a tu Portal de Usuario para comenzar de inmediato.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="bg-brand-platinum/60 py-24 border-t border-brand-platinum">
      <div className="mx-auto max-w-4xl px-6 lg:px-8">
        <div className="text-center space-y-4">
          <span className="text-xs font-bold uppercase tracking-widest text-brand-red">
            Resolvemos tus dudas
          </span>
          <h2 className="font-display text-3xl font-bold tracking-tight text-brand-charcoal sm:text-4xl">
            Preguntas Frecuentes
          </h2>
          <p className="text-base text-brand-charcoal/70">
            Todo lo que necesitas saber antes de iniciar tu proceso migratorio con nosotros.
          </p>
        </div>

        <div className="mt-12 rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-platinum shadow-sm">
          <Accordion type="single" collapsible className="w-full">
            {faqs.map((faq, index) => (
              <AccordionItem
                key={index}
                value={`item-${index}`}
                className="border-b border-brand-platinum last:border-0"
              >
                <AccordionTrigger className="text-left font-display text-base sm:text-lg font-semibold text-brand-charcoal hover:text-brand-red hover:no-underline py-5">
                  {faq.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm sm:text-base text-brand-charcoal/75 leading-relaxed pb-5">
                  {faq.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </div>
    </section>
  );
}