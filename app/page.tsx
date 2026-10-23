// app/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { getWhatsAppUrl } from "@/lib/constants";
import ConsularGlobe from "@/components/landing/ConsularGlobe";
import { BrandLogo } from "@/components/ui/BrandLogo";
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
  const { user, profile } = useAuth();

  const [activeSection, setActiveSection] = useState<string>("");
  const [scrolledPastHero, setScrolledPastHero] = useState(false);
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const portalHref = user
    ? profile?.role === "admin" || profile?.role === "advisor"
      ? "/dashboard/admin?tab=gobernanza"
      : "/dashboard"
    : "/login";

  useEffect(() => {
    const handleScrollSpy = () => {
      const y = window.scrollY;
      setScrolledPastHero(y > 520);

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

  const handleScrollToTop = (e: React.MouseEvent<HTMLAnchorElement>) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: "smooth" });
    if (typeof window !== "undefined" && window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }
    setActiveSection("");
    e.currentTarget.blur();
  };

  return (
    <div
      id="top"
      className="min-h-screen bg-brand-white text-brand-charcoal font-sans relative selection:bg-brand-red selection:text-white"
    >
      {/* GLOBO 3D SIN RECORTES */}
      <div
        aria-hidden="true"
        className={`hidden lg:flex items-center justify-center pointer-events-none fixed top-20 right-[3%] w-[540px] h-[540px] z-0 transition-opacity duration-500 ${
          scrolledPastHero ? "opacity-20" : "opacity-100"
        }`}
      >
        <ConsularGlobe />
      </div>

      {/* NAVBAR STICKY 100% SÓLIDO CON LOGO OFICIAL Y SCROLL-SPY */}
      <header className="sticky top-0 z-40 bg-brand-white border-b border-brand-charcoal/10 px-4 sm:px-8 py-3.5">
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
            className="hidden md:flex items-center gap-1.5 rounded-full bg-brand-platinum p-1.5 border border-brand-charcoal/10"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = activeSection === item.id;
              return (
                <a
                  key={item.id}
                  href={`#${item.id}`}
                  onClick={() => setActiveSection(item.id)}
                  className={`rounded-full px-4 py-2 text-xs font-bold transition-all focus:outline-none ${
                    isActive
                      ? "bg-brand-charcoal text-brand-white shadow-xs"
                      : "text-brand-charcoal/75 hover:text-brand-charcoal hover:bg-brand-white/60"
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
              className="inline-flex items-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-brand-platinum/60 hover:bg-brand-charcoal hover:text-white px-4 py-2.5 text-xs font-bold text-brand-charcoal transition-all"
            >
              <Lock className="h-3.5 w-3.5 text-brand-red" />
              <span>{user ? "Ir a mi Portal" : "Portal Clientes"}</span>
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
                  href="#jurisdicciones"
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
                  href="#jurisdicciones"
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
                  className="inline-flex items-center gap-2 rounded-full border-2 border-brand-charcoal/15 bg-brand-white px-7 py-4 text-xs sm:text-sm font-bold text-brand-charcoal hover:border-brand-charcoal transition-all"
                >
                  <span>
                    {user ? "Abrir mi Expediente" : "Conocer el Portal"}
                  </span>
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
              automáticamente tu cuestionario, tu bóveda documental y tus
              entregables según el consulado de destino.
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
                  href={getWhatsAppUrl(
                    "Hola Global Visa Consulting, me interesa tramitar mi Visa B1/B2 para Estados Unidos."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                >
                  <span>Solicitar Visa EE. UU.</span>
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
                  href={getWhatsAppUrl(
                    "Hola Global Visa Consulting, me interesa tramitar mi Visa para Japón."
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red hover:underline"
                >
                  <span>Solicitar Visa Japón</span>
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
                title: "Cuestionario Estratégico",
                desc: "Respondes en 5 minutos y en español solo las preguntas estratégicas de viaje y arraigo que no aparecen en tus certificados.",
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
                desc: "Descargas tu Confirmación DS-160 o carpeta japonesa directamente desde tu perfil y realizas tu simulacro 1-a-1 por Google Meet.",
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

        {/* SECCIÓN 4: PLANES Y TARIFAS */}
        <section
          id="planes"
          className="scroll-mt-20 max-w-7xl mx-auto px-4 sm:px-8 py-20 border-t border-brand-charcoal/10 space-y-12"
        >
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <span className="text-xs font-bold uppercase tracking-widest text-brand-red">
                Honorarios Transparentes
              </span>
              <h2 className="font-display text-3xl sm:text-4xl font-extrabold text-brand-charcoal">
                Inversión clara desde el primer día.
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-brand-charcoal/75 max-w-md leading-relaxed">
              Sin cobros sorpresa ni letras pequeñas. Elige el nivel de
              acompañamiento jurídico que mejor se adapte a tu perfil
              migratorio.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch">
            <div className="rounded-3xl bg-brand-white border-2 border-brand-charcoal/15 p-8 flex flex-col justify-between space-y-6 shadow-sm">
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-brand-charcoal">
                    Essential
                  </h3>
                  <p className="text-xs text-brand-charcoal/70">
                    Solicitud Individual Estándar
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold text-brand-charcoal">
                    $190
                  </span>
                  <span className="text-xs font-bold text-brand-charcoal/70">
                    USD
                  </span>
                </div>

                <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                  Ideal para perfiles con historial de viajes previo o
                  renovaciones sin complicaciones.
                </p>

                <ul className="space-y-2.5 pt-2 text-xs text-brand-charcoal/85">
                  {[
                    "Acceso completo al Portal de Cliente 24/7",
                    "Cuestionario inteligente DS-160 / Japón en español",
                    "Auditoría legal de respuestas y soportes en Bóveda",
                    "Emisión de Confirmación DS-160 o Schedule of Stay",
                    "Programación de cita consular oficial",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={getWhatsAppUrl(
                  "Hola Global Visa Consulting, quiero contratar el Plan Essential ($190 USD)."
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-charcoal bg-brand-white px-6 py-3.5 text-xs font-bold text-brand-charcoal hover:bg-brand-charcoal hover:text-white transition-all"
              >
                <span>Elegir Essential</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>

            <div className="rounded-3xl bg-brand-charcoal text-brand-white border-2 border-brand-red p-8 flex flex-col justify-between space-y-6 shadow-xl relative">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-display text-xl font-bold text-white">
                      Priority Pro
                    </h3>
                    <p className="text-xs text-white/70">
                      Estrategia de Arraigo + Simulacro Consular
                    </p>
                  </div>
                  <span className="rounded-full bg-brand-red px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    Más Elegido
                  </span>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold text-white">
                    $290
                  </span>
                  <span className="text-xs font-bold text-white/70">USD</span>
                </div>

                <p className="text-xs text-white/80 leading-relaxed">
                  Diseñado para primeras solicitudes que buscan máxima solidez
                  probatoria y preparación frente al cónsul.
                </p>

                <ul className="space-y-2.5 pt-2 text-xs text-white/90">
                  {[
                    "Todo lo incluido en el Plan Essential",
                    "Estrategia de arraigo personalizada por especialista",
                    "Acceso completo a la Sala de Entrenamiento Consular",
                    "1 Simulacro de entrevista 1-a-1 en vivo (Google Meet)",
                    "Monitoreo prioritario de adelanto de cita consular",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={getWhatsAppUrl(
                  "Hola Global Visa Consulting, quiero contratar el Plan Priority Pro ($290 USD)."
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-4 text-xs font-bold text-white shadow-lg shadow-brand-red/25 hover:bg-brand-red/90 transition-all"
              >
                <span>Elegir Priority Pro</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>

            <div className="rounded-3xl bg-brand-white border-2 border-brand-charcoal/15 p-8 flex flex-col justify-between space-y-6 shadow-sm">
              <div className="space-y-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-brand-charcoal">
                    VIP Concierge
                  </h3>
                  <p className="text-xs text-brand-charcoal/70">
                    Ejecutivos, Familias o Casos con Rechazo Previo
                  </p>
                </div>

                <div className="flex items-baseline gap-1">
                  <span className="font-display text-4xl font-extrabold text-brand-charcoal">
                    $450
                  </span>
                  <span className="text-xs font-bold text-brand-charcoal/70">
                    USD
                  </span>
                </div>

                <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                  Acompañamiento intensivo con reconstrucción de perfil
                  migratorio o gestión integral de grupo familiar.
                </p>

                <ul className="space-y-2.5 pt-2 text-xs text-brand-charcoal/85">
                  {[
                    "Todo lo incluido en el Plan Priority Pro",
                    "Auditoría profunda de rechazos previos (214b)",
                    "Doble sesión de simulacro consular con Senior Advisor",
                    "Estructuración de cartas de patrocinio o garantía",
                    "Soporte directo preferencial por WhatsApp",
                  ].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0 mt-0.5" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <a
                href={getWhatsAppUrl(
                  "Hola Global Visa Consulting, quiero contratar el Plan VIP Concierge ($450 USD)."
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex items-center justify-center gap-2 rounded-full border-2 border-brand-charcoal bg-brand-white px-6 py-3.5 text-xs font-bold text-brand-charcoal hover:bg-brand-charcoal hover:text-white transition-all"
              >
                <span>Elegir VIP Concierge</span>
                <ArrowUpRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </section>

        {/* SECCIÓN 5: PREGUNTAS FRECUENTES (ACORDEÓN DESPLEGABLE INTERACTIVO) */}
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