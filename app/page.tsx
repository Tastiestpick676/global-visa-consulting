// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getWhatsAppUrl } from "@/lib/constants";
import ConsularGlobe from "@/components/landing/ConsularGlobe";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { DestinationCountry } from "@/types/visa";
import {
  CheckCircle2,
  ArrowRight,
  ArrowUpRight,
  Lock,
  FileText,
  FolderLock,
  Award,
  Globe2,
  ChevronDown,
} from "lucide-react";

const NAV_ITEMS = [
  { id: "jurisdicciones", label: "Rutas Consulares" },
  { id: "como-funciona", label: "Cómo Funciona" },
  { id: "planes", label: "Planes y Tarifas" },
  { id: "faq", label: "Preguntas Frecuentes" },
];

const PLANS_BY_COUNTRY: Record<
  DestinationCountry,
  {
    countryLabel: string;
    subtitle: string;
    plans: {
      name: string;
      tagline: string;
      price: string;
      description: string;
      highlighted?: boolean;
      badge?: string;
      features: string[];
      whatsappMsg: string;
    }[];
  }
> = {
  USA: {
    countryLabel: "Estados Unidos (Visa B1/B2)",
    subtitle:
      "Proceso ante el Departamento de Estado (CEAC), programación de citas CAS + Embajada y preparación frente al Oficial Consular bajo la Sección 214(b).",
    plans: [
      {
        name: "Essential USA",
        tagline: "Renovación o Solicitud Estándar B1/B2",
        price: "$190",
        description:
          "Ideal para solicitantes con historial de viajes previo o renovaciones de visa americana sin entrevista.",
        features: [
          "Acceso completo al Portal de Cliente 24/7",
          "Formulario Inteligente DS-160 en español auditado en inglés técnico",
          "Revisión legal de pasaporte y soportes en Bóveda Criptográfica",
          "Emisión de hoja oficial de Confirmación CEAC DS-160",
          "Programación de citas oficiales en CAS y Embajada de EE. UU.",
        ],
        whatsappMsg:
          "Hola Global Visa Consulting, quiero contratar el Plan Essential para Estados Unidos ($190 USD).",
      },
      {
        name: "Priority Pro USA",
        tagline: "Estrategia de Arraigo 214(b) + Simulacro 1-a-1",
        price: "$290",
        highlighted: true,
        badge: "Más Elegido",
        description:
          "Diseñado para primeras solicitudes de visa B1/B2 que buscan máxima solidez probatoria y entrenamiento real frente al cónsul.",
        features: [
          "Todo lo incluido en el Plan Essential USA",
          "Estructuración jurídica de perfil de arraigo laboral y familiar",
          "Acceso completo a la Sala de Entrenamiento Consular",
          "1 Simulacro de entrevista consular 1-a-1 en vivo (Google Meet)",
          "Monitoreo prioritario de adelanto de cita consular en el sistema",
        ],
        whatsappMsg:
          "Hola Global Visa Consulting, quiero contratar el Plan Priority Pro para Estados Unidos ($290 USD).",
      },
      {
        name: "VIP Concierge USA",
        tagline: "Ejecutivos, Familias o Rechazos Previos 214(b)",
        price: "$450",
        description:
          "Acompañamiento jurídico intensivo con reconstrucción de perfil tras negaciones previas o gestión integral de grupo familiar.",
        features: [
          "Todo lo incluido en el Plan Priority Pro USA",
          "Auditoría forense de rechazos previos bajo Sección 214(b)",
          "Doble sesión de simulacro consular con Senior Legal Advisor",
          "Redacción técnica de cartas de patrocinio o invitación ejecutiva",
          "Línea directa preferencial con tu especialista por WhatsApp",
        ],
        whatsappMsg:
          "Hola Global Visa Consulting, quiero contratar el Plan VIP Concierge para Estados Unidos ($450 USD).",
      },
    ],
  },
  JAPAN: {
    countryLabel: "Japón (Visa MOFA Estancia Corta)",
    subtitle:
      "La Embajada del Japón no realiza entrevista verbal estándar; la aprobación depende 100% de la exactitud milimétrica de tu carpeta física, solvencia bancaria y Schedule of Stay.",
    plans: [
      {
        name: "Essential Japón",
        tagline: "Turismo Individual con Solvencia Propia",
        price: "$150",
        description:
          "Para viajeros con ingresos y extractos bancarios propios que requieren estructuración oficial de su expediente japonés.",
        features: [
          "Acceso completo al Portal de Cliente y Bóveda Documental 24/7",
          "Diligenciamiento oficial del Formulario de Solicitud de Visa MOFA",
          "Elaboración técnica del Schedule of Stay (Itinerario día por día)",
          "Verificación de reservas de vuelos y hoteles según norma consular",
          "Instructivo exacto de armado de carpeta física para radicación",
        ],
        whatsappMsg:
          "Hola Global Visa Consulting, quiero contratar el Plan Essential para Japón ($150 USD).",
      },
      {
        name: "Priority Pro Japón",
        tagline: "Auditoría Financiera + Carpeta Consular Llave en Mano",
        price: "$240",
        highlighted: true,
        badge: "Recomendado Japón",
        description:
          "Blindaje documental completo con auditoría de extractos bancarios de los últimos 3 meses y sesión 1-a-1 de revisión pre-radicación.",
        features: [
          "Todo lo incluido en el Plan Essential Japón",
          "Auditoría milimétrica de extractos bancarios, saldos y movimientos",
          "Diseño personalizado de ruta lógica en Schedule of Stay (Tokio/Kioto/Osaka)",
          "1 Sesión 1-a-1 en vivo (Google Meet) de revisión final de carpeta física",
          "Emisión de entregables oficiales listos para imprimir en tu portal",
        ],
        whatsappMsg:
          "Hola Global Visa Consulting, quiero contratar el Plan Priority Pro para Japón ($240 USD).",
      },
      {
        name: "VIP Concierge Japón",
        tagline: "Grupos Familiares, Con Garante o Perfil Independiente",
        price: "$380",
        description:
          "Especial para solicitudes con patrocinador económico (carta de garantía), trabajadores independientes o grupos familiares.",
        features: [
          "Todo lo incluido en el Plan Priority Pro Japón",
          "Estructuración jurídica de Carta de Garantía (Guarantor) y parentesco",
          "Conciliación contable de ingresos para independientes o empresarios",
          "Doble auditoría documental con Senior Advisor especializado en MOFA",
          "Soporte directo preferencial por WhatsApp hasta la entrega del visado",
        ],
        whatsappMsg:
          "Hola Global Visa Consulting, quiero contratar el Plan VIP Concierge para Japón ($380 USD).",
      },
    ],
  },
};

const FAQ_LIST = [
  {
    q: "¿Cómo protegen mi pasaporte y mis extractos bancarios?",
    a: "Tus archivos se almacenan en una Bóveda Criptográfica aislada por usuario bajo arquitectura Zero-Trust. Solo tu especialista legal asignado puede auditarlos y, una vez concluido tu trámite consular, ejecutamos la purga definitiva de tus archivos sensibles.",
  },
  {
    q: "¿Qué diferencia hay entre el trámite de EE. UU. (B1/B2) y el de Japón?",
    a: "Para Estados Unidos radicamos el formulario técnico DS-160, gestionamos tus citas CAS/Embajada y realizamos un simulacro 1-a-1 de entrevista verbal. Para Japón, donde no hay entrevista estándar, estructuramos milimétricamente tu carpeta física, solvencia bancaria y el programa diario oficial (Schedule of Stay).",
  },
  {
    q: "¿Qué pasa si ya tengo sesión iniciada y abro la página principal?",
    a: "Tu sesión permanece activa de forma segura en el navegador con renovación de token cada 8 horas. Al hacer clic en 'Ir a mi Portal', entrarás directamente a tu panel de seguimiento sin tener que volver a digitar tu contraseña.",
  },
  {
    q: "¿Los honorarios incluyen la tasa consular de la embajada?",
    a: "Nuestros planes cubren toda la estructuración jurídica, radicación de formularios oficiales, bóveda documental y entrenamiento 1-a-1. El derecho consular gubernamental se paga directamente a la cuenta oficial de la embajada respectiva.",
  },
  {
    q: "¿Dónde descargo mi Confirmación DS-160 o mis formatos de Japón?",
    a: "Tan pronto tu especialista legal emita tus documentos oficiales, recibirás una notificación en la campana del portal y podrás previsualizarlos en pantalla completa o descargarlos desde la sección 'Mi Perfil'.",
  },
];

export default function LandingPage() {
  const { user, profile, loading, isTwoFactorVerified } = useAuth();

  const [activeSection, setActiveSection] = useState<string>("");
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrolledPastHero, setScrolledPastHero] = useState(false);

  // Selector de país con estado de transición animada para las tarjetas
  const [selectedPlanCountry, setSelectedPlanCountry] =
    useState<DestinationCountry>("USA");
  const [isSwitchingCountry, setIsSwitchingCountry] = useState(false);

  // FAQs inician todas cerradas (null) hasta que el usuario haga clic
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null);

  const isFullyAuthenticated = Boolean(user && isTwoFactorVerified);

  const portalHref = isFullyAuthenticated
    ? profile?.role === "admin" || profile?.role === "advisor"
      ? "/dashboard/admin?tab=gobernanza"
      : "/dashboard"
    : "/login";

  useEffect(() => {
    const handleScrollSpy = () => {
      const y = window.scrollY;
      setIsScrolled(y > 35);
      setScrolledPastHero(y > 320);

      if (y < 380) {
        setActiveSection("");
        return;
      }

      const scrollPosition = y + 240;
      for (const item of NAV_ITEMS) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(item.id);
            break;
          }
        }
      }
    };

    handleScrollSpy();
    window.addEventListener("scroll", handleScrollSpy, { passive: true });
    return () => window.removeEventListener("scroll", handleScrollSpy);
  }, []);

  const handleSelectCountryWithAnimation = (country: DestinationCountry) => {
    if (country === selectedPlanCountry) return;
    setIsSwitchingCountry(true);
    setTimeout(() => {
      setSelectedPlanCountry(country);
      setIsSwitchingCountry(false);
    }, 160);
  };

  const handleScrollToTop = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    setActiveSection("");
    e.currentTarget.blur();
  };

  const activeCountryPricing = PLANS_BY_COUNTRY[selectedPlanCountry];

  return (
    <div
      id="top"
      className="min-h-screen bg-brand-white text-brand-charcoal font-sans relative selection:bg-brand-red selection:text-white"
    >
      {/* GLOBO 3D DINÁMICO: Más grande y centrado en el Hero, regresa al tamaño y posición actual al bajar */}
      <div
        aria-hidden="true"
        className={`hidden lg:flex items-center justify-center pointer-events-none fixed w-[640px] h-[640px] z-0 transition-all duration-700 ease-out ${
          scrolledPastHero
            ? "top-24 right-[1%] opacity-20 scale-90"
            : "top-12 right-[4%] opacity-100 scale-100"
        }`}
      >
        <ConsularGlobe />
      </div>

      {/* NAVBAR INTELIGENTE: Sólida en el tope, traslúcida al bajar y 100% visible al hacer hover */}
      <header
        className={`sticky top-0 z-40 px-4 sm:px-8 py-3.5 transition-all duration-300 border-b ${
          isScrolled
            ? "bg-brand-white/65 backdrop-blur-md opacity-85 border-brand-charcoal/5 hover:bg-brand-white hover:opacity-100 hover:border-brand-charcoal/15 hover:shadow-md"
            : "bg-brand-white opacity-100 border-brand-charcoal/10"
        }`}
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <a
            href="#top"
            onClick={handleScrollToTop}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/30 rounded-xl inline-block"
            aria-label="Subir al inicio de Global Visa Consulting"
          >
            <BrandLogo theme="light" />
          </a>

          <nav
            aria-label="Navegación principal"
            className="hidden md:flex items-center gap-1.5 rounded-full bg-brand-platinum/90 p-1.5 border border-brand-charcoal/10"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-all duration-200 focus:outline-none ${
                    isActive
                      ? "bg-brand-charcoal text-brand-white shadow-xs"
                      : "text-brand-charcoal/75 hover:text-brand-charcoal hover:bg-brand-white/70"
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={portalHref}
              className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-brand-platinum/70 hover:bg-brand-charcoal hover:text-white px-4 py-2.5 text-xs font-bold text-brand-charcoal transition-all min-w-[132px]"
            >
              <Lock className="h-3.5 w-3.5 text-brand-red shrink-0" />
              {loading ? (
                <span className="h-3.5 w-20 rounded-full bg-brand-charcoal/15 animate-skeleton" />
              ) : (
                <span>{user ? "Ir a mi Portal" : "Portal Clientes"}</span>
              )}
            </Link>

            <a
              href={getWhatsAppUrl(
                "Hola Global Visa Consulting, quiero evaluar mi perfil migratorio para tramitar mi visa."
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-5 py-2.5 text-xs font-bold text-brand-white hover:bg-brand-red/90 transition-all shadow-xs"
            >
              <span>Evaluar mi Caso</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        {/* SECCIÓN 1: HERO LIMPIO */}
        <section className="max-w-7xl mx-auto px-4 sm:px-8 pt-12 pb-20 lg:pt-20 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6 bg-brand-white pr-0 lg:pr-6">
              <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-extrabold tracking-tight text-brand-charcoal leading-[1.06]">
                Tu visa gestionada con{" "}
                <span className="text-brand-red">precisión consular</span> y
                tecnología en tiempo real.
              </h1>

              <p className="text-sm sm:text-base text-brand-charcoal/80 leading-relaxed max-w-xl">
                Olvídate de los tramitadores informales y de los formularios
                confusos. Estructuramos tu perfil de arraigo, radicamos tu{" "}
                <strong className="text-brand-charcoal">
                  DS-160 o expediente oficial para Japón
                </strong>{" "}
                y te preparamos 1-a-1 en un portal privado con seguridad de
                nivel bancario.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1 max-w-xl">
                <a
                  href="#planes"
                  onClick={() => handleSelectCountryWithAnimation("USA")}
                  className="group flex items-center justify-between rounded-2xl bg-brand-platinum/70 hover:bg-brand-charcoal border border-brand-charcoal/10 p-4 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-charcoal group-hover:bg-brand-red text-white font-mono text-xs font-bold transition-colors">
                      US
                    </div>
                    <div>
                      <p className="text-xs font-bold text-brand-charcoal group-hover:text-white">
                        Visa B1/B2 EE. UU.
                      </p>
                      <p className="text-[11px] text-brand-charcoal/70 group-hover:text-white/75">
                        Formulario DS-160 + Cita CAS
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-brand-charcoal/40 group-hover:text-white transition-colors" />
                </a>

                <a
                  href="#planes"
                  onClick={() => handleSelectCountryWithAnimation("JAPAN")}
                  className="group flex items-center justify-between rounded-2xl bg-brand-platinum/70 hover:bg-brand-charcoal border border-brand-charcoal/10 p-4 transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red text-white font-mono text-xs font-bold">
                      JP
                    </div>
                    <div>
                      <p className="text-xs font-bold text-brand-charcoal group-hover:text-white">
                        Visa Turismo Japón
                      </p>
                      <p className="text-[11px] text-brand-charcoal/70 group-hover:text-white/75">
                        Schedule of Stay + MOFA
                      </p>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-brand-charcoal/40 group-hover:text-white transition-colors" />
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <a
                  href={getWhatsAppUrl(
                    "Hola Global Visa Consulting, quiero iniciar el diagnóstico de mi solicitud de visa."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2.5 rounded-full bg-brand-red px-7 py-4 text-xs sm:text-sm font-bold text-brand-white shadow-lg shadow-brand-red/20 hover:bg-brand-red/90 transition-all"
                >
                  <span>Iniciar Diagnóstico en WhatsApp</span>
                  <ArrowRight className="h-4 w-4" />
                </a>

                <Link
                  href={portalHref}
                  className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-charcoal/15 bg-brand-white px-7 py-4 text-xs sm:text-sm font-bold text-brand-charcoal hover:border-brand-charcoal transition-all min-w-[175px]"
                >
                  {loading ? (
                    <span className="h-4 w-28 rounded-full bg-brand-charcoal/15 animate-skeleton" />
                  ) : (
                    <span>
                      {user ? "Abrir mi Expediente" : "Conocer el Portal"}
                    </span>
                  )}
                </Link>
              </div>

              <div className="pt-4 border-t border-brand-platinum flex flex-wrap items-center gap-6 text-xs font-semibold text-brand-charcoal/75">
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-red" />
                  Tracking Consular 24/7
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-red" />
                  Bóveda Criptográfica PII
                </span>
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-brand-red" />
                  Simulacro 1-a-1 Google Meet
                </span>
              </div>
            </div>

            <div
              aria-hidden="true"
              className="hidden lg:block lg:col-span-5 min-h-[460px] pointer-events-none"
            />
          </div>
        </section>

        {/* SECCIÓN 2: RUTAS CONSULARES */}
        <section
          id="jurisdicciones"
          className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-8 py-20 border-t border-brand-charcoal/10 space-y-12"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-red">
                Jurisdicciones Especializadas
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-brand-charcoal">
                Dos destinos de alta exigencia. Una metodología jurídica exacta.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-brand-charcoal/75 max-w-md leading-relaxed">
              Cada embajada evalúa criterios distintos. Nuestro sistema adapta
              automáticamente tu formulario inteligente, tu bóveda documental y
              tus entregables según el consulado de destino.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="rounded-3xl bg-brand-white border-2 border-brand-charcoal/15 p-7 sm:p-9 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-charcoal text-white font-mono text-sm font-extrabold">
                      USA
                    </span>
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-red">
                        DEPARTAMENTO DE ESTADO • CEAC
                      </span>
                      <h3 className="font-display text-xl font-bold text-brand-charcoal">
                        Visa B1/B2 Estados Unidos
                      </h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-brand-platinum px-3.5 py-1 font-mono text-[11px] font-bold text-brand-charcoal">
                    FORM DS-160
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-brand-charcoal/80 leading-relaxed">
                  Enfocada en demostrar sólidos lazos de arraigo familiar,
                  laboral y patrimonial bajo la Sección 214(b) de la Ley de
                  Inmigración y Nacionalidad.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="rounded-2xl bg-brand-platinum p-4 border border-brand-charcoal/10">
                    <span className="font-mono text-[10px] font-bold text-brand-red block">
                      ENTREGABLE 01
                    </span>
                    <p className="font-bold text-brand-charcoal mt-1">
                      Radicación Oficial DS-160
                    </p>
                    <p className="text-[11px] text-brand-charcoal/75 mt-0.5">
                      Traducido y auditado en inglés técnico consular.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-brand-platinum p-4 border border-brand-charcoal/10">
                    <span className="font-mono text-[10px] font-bold text-brand-red block">
                      ENTREGABLE 02
                    </span>
                    <p className="font-bold text-brand-charcoal mt-1">
                      Citas CAS + Embajada
                    </p>
                    <p className="text-[11px] text-brand-charcoal/75 mt-0.5">
                      Programación de toma biométrica y entrevista.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-brand-platinum flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-brand-charcoal/75">
                  B1 (Negocios) • B2 (Turismo / Tratamiento Médico)
                </span>
                <a
                  href="#planes"
                  onClick={() => handleSelectCountryWithAnimation("USA")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                >
                  <span>Ver Planes EE. UU.</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>

            <div className="rounded-3xl bg-brand-white border-2 border-brand-charcoal/15 p-7 sm:p-9 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-5">
                <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
                  <div className="flex items-center gap-3.5">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red text-white font-mono text-sm font-extrabold">
                      JPN
                    </span>
                    <div>
                      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-red">
                        EMBAJADA DEL JAPÓN • MOFA
                      </span>
                      <h3 className="font-display text-xl font-bold text-brand-charcoal">
                        Visa de Estancia Corta Japón
                      </h3>
                    </div>
                  </div>
                  <span className="rounded-full bg-brand-platinum px-3.5 py-1 font-mono text-[11px] font-bold text-brand-charcoal">
                    SCHEDULE OF STAY
                  </span>
                </div>

                <p className="text-xs sm:text-sm text-brand-charcoal/80 leading-relaxed">
                  La Embajada del Japón no realiza entrevista verbal estándar;
                  la aprobación depende 100% de la exactitud milimétrica de tu
                  carpeta física, solvencia bancaria y programa diario.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                  <div className="rounded-2xl bg-brand-platinum p-4 border border-brand-charcoal/10">
                    <span className="font-mono text-[10px] font-bold text-brand-red block">
                      ENTREGABLE 01
                    </span>
                    <p className="font-bold text-brand-charcoal mt-1">
                      Schedule of Stay Oficial
                    </p>
                    <p className="text-[11px] text-brand-charcoal/75 mt-0.5">
                      Itinerario técnico día por día con hoteles y contacto.
                    </p>
                  </div>
                  <div className="rounded-2xl bg-brand-platinum p-4 border border-brand-charcoal/10">
                    <span className="font-mono text-[10px] font-bold text-brand-red block">
                      ENTREGABLE 02
                    </span>
                    <p className="font-bold text-brand-charcoal mt-1">
                      Auditoría de Extractos
                    </p>
                    <p className="text-[11px] text-brand-charcoal/75 mt-0.5">
                      Verificación de saldos y cartas de garantía.
                    </p>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-brand-platinum flex items-center justify-between">
                <span className="font-mono text-[11px] font-semibold text-brand-charcoal/75">
                  Turismo • Visita Familiar • Tránsito
                </span>
                <a
                  href="#planes"
                  onClick={() => handleSelectCountryWithAnimation("JAPAN")}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                >
                  <span>Ver Planes Japón</span>
                  <ArrowRight className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* SECCIÓN 3: CÓMO FUNCIONA */}
        <section
          id="como-funciona"
          className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-8 py-20 border-t border-brand-charcoal/10 space-y-12"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-red">
                Metodología en 4 Etapas
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-brand-charcoal">
                Ingeniería documental sin fricción.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-brand-charcoal/75 max-w-md leading-relaxed">
              Extraemos los datos complejos directamente de tu pasaporte y
              certificados laborales en la Bóveda para que no tengas que llenar
              interminables formularios gubernamentales.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "ETAPA 01",
                title: "Diagnóstico & Provisionamiento",
                desc: "Habilitamos tu expediente privado en el portal según tu destino (EE. UU. o Japón) y asignamos a tu especialista legal titular.",
                icon: Globe2,
                badge: "20% Avance",
              },
              {
                step: "ETAPA 02",
                title: "Formulario Inteligente",
                desc: "Respondes en 5 minutos y en español solo las preguntas estratégicas de viaje y arraigo que se adaptan a tu país de destino.",
                icon: FileText,
                badge: "50% Avance",
              },
              {
                step: "ETAPA 03",
                title: "Bóveda Criptográfica",
                desc: "Subes tu pasaporte, foto y extractos. Tu asesor audita cada PDF y te indica en vivo si está verificado o requiere ajuste.",
                icon: FolderLock,
                badge: "80% Avance",
              },
              {
                step: "ETAPA 04",
                title: "Sala Consular & Entregables",
                desc: "Descargas tu Confirmación DS-160 o carpeta japonesa directamente desde tu perfil y realizas tu preparación 1-a-1 por Google Meet.",
                icon: Award,
                badge: "100% Listo",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.step}
                  className="rounded-3xl bg-brand-white border-2 border-brand-charcoal/15 p-6 shadow-sm flex flex-col justify-between space-y-6"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-extrabold text-brand-red">
                        {item.step}
                      </span>
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-charcoal text-white">
                        <Icon className="h-5 w-5" />
                      </div>
                    </div>
                    <h3 className="font-display text-lg font-bold text-brand-charcoal">
                      {item.title}
                    </h3>
                    <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                      {item.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-brand-platinum flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-brand-charcoal/70">
                      Monitoreo en vivo
                    </span>
                    <span className="rounded-full bg-brand-platinum px-2.5 py-0.5 font-mono text-[10px] font-bold text-brand-charcoal">
                      {item.badge}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECCIÓN 4: PLANES Y TARIFAS CON SELECTOR DESLIZANTE ANIMADO */}
        <section
          id="planes"
          className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-8 py-20 border-t border-brand-charcoal/10 space-y-10"
        >
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-red">
                Honorarios Transparentes por Jurisdicción
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-brand-charcoal">
                Inversión clara desde el primer día.
              </h2>
              <p
                className={`text-xs sm:text-sm text-brand-charcoal/75 leading-relaxed pt-1 transition-all duration-300 ${
                  isSwitchingCountry
                    ? "opacity-0 translate-y-1"
                    : "opacity-100 translate-y-0"
                }`}
              >
                {activeCountryPricing.subtitle}
              </p>
            </div>

            {/* Selector de País con Píldora Deslizante Animada (Sliding Pill) */}
            <div className="flex flex-col sm:items-end gap-2 shrink-0">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-charcoal/65">
                Selecciona el país de tu trámite:
              </span>
              <div
                role="tablist"
                aria-label="Seleccionar país de destino para ver planes"
                className="relative grid grid-cols-2 rounded-2xl bg-brand-platinum p-1.5 border border-brand-charcoal/15 w-full sm:w-[390px] select-none overflow-hidden"
              >
                {/* Píldora deslizante de fondo */}
                <span
                  aria-hidden="true"
                  className={`pointer-events-none absolute top-1.5 bottom-1.5 left-1.5 w-[calc(50%-6px)] rounded-xl bg-brand-charcoal shadow-md transition-transform duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                    selectedPlanCountry === "JAPAN"
                      ? "translate-x-full"
                      : "translate-x-0"
                  }`}
                />

                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedPlanCountry === "USA"}
                  onClick={() => handleSelectCountryWithAnimation("USA")}
                  className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors duration-300 focus:outline-none ${
                    selectedPlanCountry === "USA"
                      ? "text-white"
                      : "text-brand-charcoal/75 hover:text-brand-charcoal"
                  }`}
                >
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-extrabold transition-transform duration-300 ${
                      selectedPlanCountry === "USA"
                        ? "bg-brand-red text-white scale-105"
                        : "bg-brand-charcoal/15 text-brand-charcoal"
                    }`}
                  >
                    US
                  </span>
                  <span>Estados Unidos (B1/B2)</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  aria-selected={selectedPlanCountry === "JAPAN"}
                  onClick={() => handleSelectCountryWithAnimation("JAPAN")}
                  className={`relative z-10 flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold transition-colors duration-300 focus:outline-none ${
                    selectedPlanCountry === "JAPAN"
                      ? "text-white"
                      : "text-brand-charcoal/75 hover:text-brand-charcoal"
                  }`}
                >
                  <span
                    className={`rounded px-1.5 py-0.5 font-mono text-[10px] font-extrabold transition-transform duration-300 ${
                      selectedPlanCountry === "JAPAN"
                        ? "bg-brand-red text-white scale-105"
                        : "bg-brand-charcoal/15 text-brand-charcoal"
                    }`}
                  >
                    JP
                  </span>
                  <span>Japón (MOFA)</span>
                </button>
              </div>
            </div>
          </div>

          {/* Grilla de Planes con Animación Fluida y Stagger al cambiar de país */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            {activeCountryPricing.plans.map((plan, index) => {
              const staggerDelay =
                index === 0
                  ? "delay-0"
                  : index === 1
                  ? "delay-75"
                  : "delay-150";
              const transitionStateClass = isSwitchingCountry
                ? "opacity-0 translate-y-3 scale-[0.98]"
                : `opacity-100 translate-y-0 scale-100 ${staggerDelay}`;

              if (plan.highlighted) {
                return (
                  <div
                    key={plan.name}
                    className={`rounded-3xl bg-brand-charcoal text-brand-white border-2 border-brand-red p-8 flex flex-col justify-between space-y-6 shadow-xl relative transition-all duration-300 ease-out ${transitionStateClass}`}
                  >
                    <div className="space-y-4">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="font-display text-xl font-bold text-white">
                            {plan.name}
                          </h3>
                          <p className="text-xs text-white/70 mt-0.5">
                            {plan.tagline}
                          </p>
                        </div>
                        {plan.badge && (
                          <span className="rounded-full bg-brand-red px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shrink-0">
                            {plan.badge}
                          </span>
                        )}
                      </div>

                      <div className="flex items-baseline gap-1">
                        <span className="font-display text-4xl font-extrabold text-white">
                          {plan.price}
                        </span>
                        <span className="text-xs font-bold text-white/70">
                          USD
                        </span>
                      </div>

                      <p className="text-xs text-white/80 leading-relaxed">
                        {plan.description}
                      </p>

                      <ul className="space-y-2.5 pt-2 text-xs text-white/90">
                        {plan.features.map((f) => (
                          <li key={f} className="flex items-start gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0 mt-0.5" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <a
                      href={getWhatsAppUrl(plan.whatsappMsg)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-4 text-xs font-bold text-white shadow-lg shadow-brand-red/25 hover:bg-brand-red/90 transition-all"
                    >
                      <span>Elegir {plan.name}</span>
                      <ArrowUpRight className="h-4 w-4" />
                    </a>
                  </div>
                );
              }

              return (
                <div
                  key={plan.name}
                  className={`rounded-3xl bg-brand-white border-2 border-brand-charcoal/15 p-8 flex flex-col justify-between space-y-6 shadow-sm transition-all duration-300 ease-out ${transitionStateClass}`}
                >
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-display text-xl font-bold text-brand-charcoal">
                        {plan.name}
                      </h3>
                      <p className="text-xs text-brand-charcoal/70 mt-0.5">
                        {plan.tagline}
                      </p>
                    </div>

                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-4xl font-extrabold text-brand-charcoal">
                        {plan.price}
                      </span>
                      <span className="text-xs font-bold text-brand-charcoal/70">
                        USD
                      </span>
                    </div>

                    <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                      {plan.description}
                    </p>

                    <ul className="space-y-2.5 pt-2 text-xs text-brand-charcoal/85">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2.5">
                          <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0 mt-0.5" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <a
                    href={getWhatsAppUrl(plan.whatsappMsg)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-charcoal bg-brand-white px-6 py-3.5 text-xs font-bold text-brand-charcoal hover:bg-brand-charcoal hover:text-white transition-all"
                  >
                    <span>Elegir {plan.name}</span>
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                </div>
              );
            })}
          </div>
        </section>

        {/* SECCIÓN 5: PREGUNTAS FRECUENTES (TODAS CERRADAS AL INICIO) */}
        <section
          id="faq"
          className="scroll-mt-20 max-w-4xl mx-auto px-4 sm:px-8 py-20 border-t border-brand-charcoal/10 space-y-10"
        >
          <div className="space-y-2 text-center">
            <span className="text-xs font-bold uppercase tracking-widest text-brand-red">
              Resolución de Dudas
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-brand-charcoal">
              Preguntas Frecuentes
            </h2>
            <p className="text-xs sm:text-sm text-brand-charcoal/75 max-w-lg mx-auto">
              Haz clic en cada pregunta para desplegar los detalles técnicos y
              legales de nuestro servicio.
            </p>
          </div>

          <div className="space-y-3.5">
            {FAQ_LIST.map((item, idx) => {
              const isOpen = openFaqIndex === idx;
              return (
                <div
                  key={item.q}
                  className={`rounded-2xl bg-brand-white border-2 transition-all overflow-hidden ${
                    isOpen
                      ? "border-brand-charcoal shadow-sm"
                      : "border-brand-charcoal/12 hover:border-brand-charcoal/30"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() =>
                      setOpenFaqIndex((prev) => (prev === idx ? null : idx))
                    }
                    aria-expanded={isOpen}
                    className="w-full flex items-center justify-between gap-4 p-5 sm:p-6 text-left focus:outline-none"
                  >
                    <span className="font-display text-sm sm:text-base font-bold text-brand-charcoal">
                      {item.q}
                    </span>
                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-transform duration-200 ${
                        isOpen
                          ? "bg-brand-red text-white rotate-180"
                          : "bg-brand-platinum text-brand-charcoal"
                      }`}
                    >
                      <ChevronDown className="h-4 w-4" />
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 sm:px-6 pb-6 pt-0 text-xs sm:text-sm text-brand-charcoal/80 leading-relaxed border-t border-brand-platinum">
                      <p className="pt-4">{item.a}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {/* FOOTER SÓLIDO CON LOGO OFICIAL EN MODO DARK */}
      <footer className="relative z-20 bg-brand-charcoal text-brand-white border-t border-white/10 px-4 sm:px-8 py-12">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <a
            href="#top"
            onClick={handleScrollToTop}
            className="focus:outline-none rounded-xl inline-block"
            aria-label="Subir al inicio de Global Visa Consulting"
          >
            <BrandLogo
              theme="dark"
              subtitle="EE. UU. & JAPÓN • LEGALTECH"
            />
          </a>

          <p className="text-xs text-white/70">
            © 2026 Global Visa Consulting. Todos los derechos reservados. Firma
            privada independiente de las embajadas.
          </p>
        </div>
      </footer>
    </div>
  );
}