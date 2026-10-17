// components/landing/Navbar.tsx
import Link from "next/link";
import { ShieldCheck, ArrowUpRight } from "lucide-react";
import { getWhatsAppUrl } from "@/lib/constants";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-brand-platinum bg-brand-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 lg:px-8">
        {/* Logo + Isotipo en Rojo Acelerador */}
        <Link href="/" className="flex items-center gap-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-brand-white shadow-sm transition-transform group-hover:scale-105">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex flex-col">
            <span className="font-display text-lg font-bold tracking-tight text-brand-charcoal leading-none">
              GLOBAL VISA
            </span>
            <span className="text-[11px] font-medium tracking-widest text-brand-charcoal/60 uppercase mt-0.5">
              Consulting
            </span>
          </div>
        </Link>

        {/* Navegación Desktop */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-brand-charcoal/80">
          <a href="#proceso" className="hover:text-brand-charcoal transition-colors">
            Cómo Funciona
          </a>
          <a href="#precios" className="hover:text-brand-charcoal transition-colors">
            Planes y Tarifas
          </a>
          <a href="#faq" className="hover:text-brand-charcoal transition-colors">
            Preguntas Frecuentes
          </a>
        </nav>

        {/* Acciones: Login Portal + CTA Píldora */}
        <div className="flex items-center gap-4">
          <Link
            href="/login"
            className="hidden sm:inline-flex text-sm font-semibold text-brand-charcoal hover:text-brand-red transition-colors px-3 py-2"
          >
            Portal Clientes
          </Link>
          <a
            href={getWhatsAppUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-brand-red px-5 py-2.5 text-sm font-semibold text-brand-white shadow-sm hover:bg-brand-red/90 transition-all hover:shadow-md"
          >
            <span>Evaluar mi Caso</span>
            <ArrowUpRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </header>
  );
}