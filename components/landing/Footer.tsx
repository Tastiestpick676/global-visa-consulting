// components/landing/Footer.tsx
import Link from "next/link";
import { ShieldCheck, ArrowRight } from "lucide-react";
import { getWhatsAppUrl } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-brand-charcoal text-brand-white">
      {/* Banner CTA Superior */}
      <div className="mx-auto max-w-7xl px-6 pt-16 pb-12 lg:px-8 border-b border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 rounded-2xl bg-white/5 p-8 sm:p-12 border border-white/10">
          <div className="max-w-2xl space-y-2">
            <h3 className="font-display text-2xl sm:text-3xl font-bold">
              ¿Listo para tramitar tu visa sin estrés ni errores?
            </h3>
            <p className="text-sm sm:text-base text-white/70">
              Agenda hoy tu diagnóstico por WhatsApp y activa tu Portal de Usuario en minutos.
            </p>
          </div>
          <a
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-3 rounded-full bg-brand-red px-8 py-4 text-sm sm:text-base font-semibold text-brand-white hover:bg-brand-red/90 transition-all shrink-0"
          >
            <span>Hablar con un Especialista</span>
            <ArrowRight className="h-5 w-5" />
          </a>
        </div>
      </div>

      {/* Pie de página legal */}
      <div className="mx-auto max-w-7xl px-6 py-12 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6 text-xs text-white/50">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-red text-brand-white">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <span className="font-display text-sm font-bold text-brand-white tracking-tight">
            GLOBAL VISA CONSULTING
          </span>
        </div>

        <div className="flex items-center gap-6">
          <Link href="/login" className="hover:text-white transition-colors">
            Acceso Clientes
          </Link>
          <a href="#proceso" className="hover:text-white transition-colors">
            Proceso
          </a>
          <a href="#precios" className="hover:text-white transition-colors">
            Tarifas
          </a>
        </div>

        <p>© 2026 Global Visa Consulting. Firma privada de asesoría migratoria.</p>
      </div>
    </footer>
  );
}