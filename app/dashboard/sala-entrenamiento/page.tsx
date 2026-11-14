// app/dashboard/sala-entrenamiento/page.tsx
"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import {
  subscribeToConsularResources,
  toggleResourceReaction,
  buildGoogleCalendarUrl,
  downloadMeetingIcs,
  formatDisplayName,
} from "@/lib/firebase/db";
import { ConsularResource, ReactionEmoji } from "@/types/visa";
import { getWhatsAppUrl } from "@/lib/constants";
import {
  Award,
  BookOpen,
  Video,
  Calendar,
  ExternalLink,
  FileText,
  Sparkles,
  CheckCircle2,
  Eye,
  X,
  Download,
  SmilePlus,
  ChevronDown,
  Lock,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

const REACTION_EMOJIS: ReactionEmoji[] = ["👍", "🔥", "👏", "💡"];

const INTERVIEW_QUESTIONS_BY_DEST = {
  USA: [
    {
      q: "¿Cuál es el propósito exacto de su viaje a los Estados Unidos y por cuántos días planea quedarse?",
      tip: "Responde en menos de 20 segundos mencionando ciudad específica, fechas coherentes con tus vacaciones laborales y motivo turístico o de negocios concreto.",
    },
    {
      q: "¿A qué se dedica actualmente en Colombia y cuánto tiempo lleva en su empresa o actividad económica?",
      tip: "Destaca tu cargo, antigüedad, responsabilidades y cómo tus ingresos mensuales respaldan holgadamente el presupuesto del viaje (Sección 214b).",
    },
    {
      q: "¿Quién costeará los gastos de su viaje y qué vínculos familiares o patrimoniales tiene en su país?",
      tip: "Sé transparente con tus ingresos o los de tu patrocinador y menciona tu núcleo familiar o compromisos presenciales que garantizan tu retorno.",
    },
  ],
  JAPAN: [
    {
      q: "¿Cómo debe coincidir mi Schedule of Stay con los extractos bancarios de los últimos 3 meses?",
      tip: "La Embajada del Japón verifica que el saldo final disponible cubra holgadamente los vuelos internacionales, hoteles y viáticos diarios por cada día reportado en Tokio, Kioto u Osaka.",
    },
    {
      q: "¿Qué revisa el oficial de radicación en las reservas de hotel y tiquetes para la carpeta MOFA?",
      tip: "Todas las noches del itinerario deben estar respaldadas con dirección y teléfono de cada hotel en Japón, coincidiendo exactamente con el formulario con código QR.",
    },
    {
      q: "¿Cuándo se requiere Carta de Garantía (Letter of Guarantee) en la solicitud japonesa?",
      tip: "Cuando un tercero o familiar asume total o parcialmente los gastos del viaje, o cuando deseas respaldar ingresos variables con un codeudor solvente.",
    },
  ],
};

export default function SalaEntrenamientoPage() {
  const { user, profile, application, simulateClientView } = useAuth();
  const [resources, setResources] = useState<ConsularResource[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [previewResource, setPreviewResource] =
    useState<ConsularResource | null>(null);
  const [openQuestionIdx, setOpenQuestionIdx] = useState<number | null>(0);

  // Permite al Staff previsualizar el candado de Essential cuando está en Modo Vista Cliente
  const [staffPreviewLocked, setStaffPreviewLocked] = useState<boolean>(false);

  const destination = application?.destination || "USA";
  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  // Detectar si el cliente tiene el Plan Essential (bloquea la Sala Consular y muestra Upsell)
  const rawPlan = (
    application?.planTier ||
    profile?.planTier ||
    "Priority Pro"
  ).toLowerCase();
  const isClientOnEssential = rawPlan.includes("essential");
  const showEssentialPaywall =
    (!isStaff && isClientOnEssential) || (isStaff && staffPreviewLocked);

  useEffect(() => {
    const unsub = subscribeToConsularResources(destination, (list) => {
      setResources(list);
    });
    return () => unsub();
  }, [destination]);

  // Cerrar el visor de PDF/imagen con la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && previewResource) {
        setPreviewResource(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewResource]);

  const filteredResources = resources.filter((r) => {
    if (selectedCategory === "ALL") return true;
    return r.category === selectedCategory;
  });

  const scheduledMeetings = (application?.meetings || []).filter(
    (m) => m.status === "scheduled"
  );

  const handleToggleReaction = async (
    resourceId: string,
    emoji: ReactionEmoji
  ) => {
    if (!user) return;
    await toggleResourceReaction(resourceId, user.uid, emoji);
  };

  const isImageUrl = (url?: string) => {
    if (!url) return false;
    return /\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(url);
  };

  const upgradePriceDiff = destination === "JAPAN" ? "$80.000 COP" : "$110.000 COP";
  const targetPlanName =
    destination === "JAPAN"
      ? "Priority Pro Japón ($230.000 COP)"
      : "Priority Pro USA ($290.000 COP)";

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* BARRA DE PRUEBA RÁPIDA EXCLUSIVA PARA STAFF EN MODO VISTA CLIENTE */}
        {isStaff && simulateClientView && (
          <div className="rounded-2xl bg-brand-charcoal text-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 border border-white/10">
            <div className="flex items-center gap-2 text-xs">
              <Sparkles className="h-4 w-4 text-brand-red shrink-0" />
              <span>
                <strong>Simulador de Staff:</strong> Prueba cómo ve esta
                pantalla un cliente según su plan contratado:
              </span>
            </div>
            <div className="inline-flex rounded-xl bg-white/10 p-1 text-xs font-bold">
              <button
                type="button"
                onClick={() => setStaffPreviewLocked(false)}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  !staffPreviewLocked
                    ? "bg-brand-red text-white"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Priority Pro / VIP (Desbloqueado)
              </button>
              <button
                type="button"
                onClick={() => setStaffPreviewLocked(true)}
                className={`rounded-lg px-3 py-1.5 transition-all cursor-pointer ${
                  staffPreviewLocked
                    ? "bg-brand-red text-white"
                    : "text-white/70 hover:text-white"
                }`}
              >
                Plan Essential (Con Candado Upsell)
              </button>
            </div>
          </div>
        )}

        {/* CABECERA PRINCIPAL */}
        <div className="rounded-3xl bg-brand-charcoal text-brand-white p-6 sm:p-8 border border-white/10 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-red/20 px-3 py-1 text-[11px] font-mono font-bold uppercase tracking-wider text-brand-red">
              <Award className="h-3.5 w-3.5" />
              <span>
                SALA DE ENTRENAMIENTO CONSULAR •{" "}
                {destination === "JAPAN" ? "JAPÓN (MOFA)" : "EE. UU. (214B)"}
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Preparación Estratégica y Recursos Oficiales
            </h2>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              {destination === "JAPAN"
                ? "Guías técnicas para estructurar tu Schedule of Stay, auditoría de solvencia bancaria y sesiones 1-a-1 de revisión pre-radicación."
                : "Entrenamiento real bajo criterios de la Sección 214(b), banco de preguntas frecuentes del Oficial Consular y sesiones de simulacro 1-a-1 por Google Meet."}
            </p>
          </div>

          <div className="rounded-2xl bg-white/[0.05] border border-white/10 p-4 shrink-0 space-y-1 min-w-[230px]">
            <span className="text-[10px] font-mono uppercase tracking-widest text-white/60 block">
              TU NIVEL DE ACCESO ACTUAL
            </span>
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-base font-bold text-white">
                {showEssentialPaywall
                  ? "Plan Essential"
                  : application?.planTier || profile?.planTier || "Priority Pro"}
              </span>
              <span
                className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                  showEssentialPaywall
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-emerald-500/20 text-emerald-300"
                }`}
              >
                {showEssentialPaywall ? "Acceso Básico" : "Acceso Total"}
              </span>
            </div>
          </div>
        </div>

        {/* CANDADO DE UPSELL AUTOMÁTICO SI EL CLIENTE ESTÁ EN PLAN ESSENTIAL */}
        {showEssentialPaywall ? (
          <div className="space-y-8">
            <div className="rounded-3xl bg-brand-white border-2 border-brand-red p-7 sm:p-10 shadow-xl space-y-6 relative overflow-hidden">
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                <div className="space-y-3 max-w-2xl">
                  <div className="inline-flex items-center gap-2 rounded-full bg-brand-red/10 px-3.5 py-1 text-xs font-bold text-brand-red">
                    <Lock className="h-3.5 w-3.5" />
                    <span>MÓDULO EXCLUSIVO • PRIORITY PRO &amp; VIP CONCIERGE</span>
                  </div>
                  <h3 className="font-display text-2xl sm:text-3xl font-extrabold text-brand-charcoal">
                    Desbloquea tu Simulacro 1-a-1 en Vivo y el Banco de
                    Entrenamiento Consular.
                  </h3>
                  <p className="text-xs sm:text-sm text-brand-charcoal/75 leading-relaxed">
                    Tu <strong>Plan Essential</strong> incluye la gestión técnica
                    de tu formulario oficial y tu Bóveda Documental. Mejora tu
                    plan a <strong>{targetPlanName}</strong> abonando únicamente
                    la diferencia (<strong>+{upgradePriceDiff}</strong>) para
                    desbloquear:
                  </p>
                </div>

                <div className="rounded-2xl bg-brand-platinum/70 border border-brand-charcoal/10 p-5 text-center shrink-0 min-w-[240px] space-y-1">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/60 block">
                    UPGRADE INMEDIATO POR DIFERENCIA
                  </span>
                  <p className="font-display text-3xl font-extrabold text-brand-charcoal">
                    +{upgradePriceDiff}
                  </p>
                  <p className="text-[11px] font-semibold text-brand-red">
                    Activación instantánea en tu expediente
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="rounded-2xl bg-brand-platinum/50 p-4 border border-brand-charcoal/10 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-charcoal">
                    <Video className="h-4 w-4 text-brand-red shrink-0" />
                    <span>Simulacro 1-a-1 en Vivo (Google Meet)</span>
                  </div>
                  <p className="text-xs text-brand-charcoal/70 leading-relaxed">
                    Sesión privada con tu especialista para entrenar tus
                    respuestas reales y auditar tus soportes antes de la cita.
                  </p>
                </div>

                <div className="rounded-2xl bg-brand-platinum/50 p-4 border border-brand-charcoal/10 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-charcoal">
                    <BookOpen className="h-4 w-4 text-brand-red shrink-0" />
                    <span>Muro de Guías y Plantillas Oficiales</span>
                  </div>
                  <p className="text-xs text-brand-charcoal/70 leading-relaxed">
                    Acceso ilimitado a guías en PDF, protocolos de entrevista
                    214(b), modelos de cartas y ejemplos de Schedule of Stay.
                  </p>
                </div>

                <div className="rounded-2xl bg-brand-platinum/50 p-4 border border-brand-charcoal/10 space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-brand-charcoal">
                    <ShieldCheck className="h-4 w-4 text-brand-red shrink-0" />
                    <span>
                      {destination === "JAPAN"
                        ? "Auditoría Financiera de Extractos"
                        : "1 Gestión de Adelanto de Cita Incluida"}
                    </span>
                  </div>
                  <p className="text-xs text-brand-charcoal/70 leading-relaxed">
                    {destination === "JAPAN"
                      ? "Revisión detallada de tus últimos 3 meses de movimientos bancarios y ruta lógica."
                      : "Monitoreo en el sistema oficial para adelantar tu fecha de cita consular sin costo adicional."}
                  </p>
                </div>
              </div>

              <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-t border-brand-platinum">
                <p className="text-xs text-brand-charcoal/70">
                  Tu asesor titular habilitará este módulo en tiempo real tan
                  pronto confirmes la actualización de tu plan.
                </p>
                <a
                  href={getWhatsAppUrl(
                    `Hola Global Visa Consulting, soy ${formatDisplayName(
                      profile?.fullName || user?.email
                    )} y quiero mejorar mi expediente del Plan Essential a ${targetPlanName} abonando la diferencia (+${upgradePriceDiff}) para desbloquear la Sala Consular y mi sesión 1-a-1.`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-red hover:bg-brand-charcoal px-7 py-4 text-xs sm:text-sm font-bold text-white shadow-lg shadow-brand-red/25 transition-all shrink-0"
                >
                  <span>Mejorar a Priority Pro (+{upgradePriceDiff})</span>
                  <ArrowUpRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* VISTA PREVIA DIFUMINADA DEL BANCO DE PREGUNTAS */}
            <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 relative overflow-hidden select-none">
              <div className="blur-[5px] pointer-events-none opacity-60 space-y-4">
                <h4 className="font-display text-lg font-bold text-brand-charcoal">
                  Banco de Preguntas Reales de Entrevista Consular
                </h4>
                {INTERVIEW_QUESTIONS_BY_DEST[destination].map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl bg-brand-platinum/60 p-4 border border-brand-charcoal/10"
                  >
                    <p className="text-sm font-bold text-brand-charcoal">
                      {item.q}
                    </p>
                    <p className="text-xs text-brand-charcoal/70 mt-1">
                      {item.tip}
                    </p>
                  </div>
                ))}
              </div>
              <div className="absolute inset-0 flex items-center justify-center bg-brand-white/40 backdrop-blur-[2px]">
                <span className="inline-flex items-center gap-2 rounded-full bg-brand-charcoal text-white px-5 py-2.5 text-xs font-bold shadow-lg">
                  <Lock className="h-3.5 w-3.5 text-brand-red" />
                  <span>Contenido reservado para planes Priority Pro y VIP</span>
                </span>
              </div>
            </div>
          </div>
        ) : (
          /* CONTENIDO DESBLOQUEADO PARA PRIORITY PRO, VIP CONCIERGE Y STAFF */
          <>
            {/* SESIONES 1-A-1 AGENDADAS */}
            {scheduledMeetings.length > 0 && (
              <div className="rounded-3xl bg-brand-white border-2 border-brand-charcoal/15 p-6 sm:p-8 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                      <Video className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-display text-lg font-bold text-brand-charcoal">
                        Tus Sesiones 1-a-1 Programadas (Google Meet)
                      </h3>
                      <p className="text-xs text-brand-charcoal/70">
                        Descarga el recordatorio en tu calendario o únete a la
                        videollamada en la fecha acordada.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scheduledMeetings.map((mtg) => (
                    <div
                      key={mtg.id}
                      className="rounded-2xl bg-brand-platinum/50 border border-brand-charcoal/10 p-5 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-1.5">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                          <Calendar className="h-3 w-3" />
                          <span>Sesión Confirmada</span>
                        </span>
                        <h4 className="font-display text-base font-bold text-brand-charcoal">
                          {mtg.title}
                        </h4>
                        <p className="text-xs font-semibold text-brand-charcoal/80">
                          📅{" "}
                          {new Date(mtg.scheduledAt).toLocaleString("es-CO", {
                            dateStyle: "full",
                            timeStyle: "short",
                          })}{" "}
                          ({mtg.durationMinutes || 45} min)
                        </p>
                        {mtg.notes && (
                          <p className="text-xs text-brand-charcoal/70 pt-1">
                            {mtg.notes}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-brand-charcoal/10">
                        <a
                          href={mtg.meetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-red hover:bg-brand-charcoal px-4 py-2 text-xs font-bold text-white transition-all"
                        >
                          <Video className="h-3.5 w-3.5" />
                          <span>Entrar a Google Meet</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>

                        <a
                          href={buildGoogleCalendarUrl({
                            title: `${mtg.title} — Global Visa Consulting`,
                            scheduledAtIso: mtg.scheduledAt,
                            durationMinutes: mtg.durationMinutes || 45,
                            meetUrl: mtg.meetUrl,
                            notes: mtg.notes,
                          })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-white border border-brand-charcoal/15 hover:border-brand-charcoal px-3.5 py-2 text-xs font-semibold text-brand-charcoal transition-all"
                        >
                          <Calendar className="h-3.5 w-3.5 text-brand-red" />
                          <span>Google Calendar</span>
                        </a>

                        <button
                          type="button"
                          onClick={() =>
                            downloadMeetingIcs({
                              title: `${mtg.title} — Global Visa Consulting`,
                              scheduledAtIso: mtg.scheduledAt,
                              durationMinutes: mtg.durationMinutes || 45,
                              meetUrl: mtg.meetUrl,
                              notes: mtg.notes,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-white border border-brand-charcoal/15 hover:border-brand-charcoal px-3.5 py-2 text-xs font-semibold text-brand-charcoal transition-all cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5 text-brand-charcoal" />
                          <span>Archivo .ics</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* BANCO INTERACTIVO DE PREGUNTAS REALES DE ENTREVISTA / AUDITORÍA */}
            <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5">
              <div className="space-y-1">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand-red">
                  ENTRENAMIENTO DE CRITERIO CONSULAR
                </span>
                <h3 className="font-display text-xl font-bold text-brand-charcoal">
                  {destination === "JAPAN"
                    ? "Puntos Críticos de Auditoría Documental MOFA"
                    : "Banco de Preguntas Clave del Oficial Consular (Sección 214b)"}
                </h3>
              </div>

              <div className="space-y-3">
                {INTERVIEW_QUESTIONS_BY_DEST[destination].map((item, idx) => {
                  const isOpen = openQuestionIdx === idx;
                  return (
                    <div
                      key={item.q}
                      className={`rounded-2xl border transition-all overflow-hidden ${
                        isOpen
                          ? "bg-brand-platinum/40 border-brand-charcoal/25"
                          : "bg-brand-white border-brand-charcoal/10 hover:border-brand-charcoal/25"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setOpenQuestionIdx((prev) =>
                            prev === idx ? null : idx
                          )
                        }
                        className="w-full flex items-center justify-between gap-4 p-4 sm:p-5 text-left cursor-pointer focus:outline-none"
                      >
                        <span className="font-display text-xs sm:text-sm font-bold text-brand-charcoal">
                          {idx + 1}. {item.q}
                        </span>
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-brand-charcoal transition-transform ${
                            isOpen ? "rotate-180 text-brand-red" : ""
                          }`}
                        />
                      </button>
                      {isOpen && (
                        <div className="px-4 sm:px-5 pb-5 pt-0 text-xs text-brand-charcoal/80 leading-relaxed border-t border-brand-charcoal/10">
                          <div className="pt-3 flex items-start gap-2.5">
                            <CheckCircle2 className="h-4 w-4 text-brand-red shrink-0 mt-0.5" />
                            <p>
                              <strong className="text-brand-charcoal">
                                Recomendación de tu Especialista:
                              </strong>{" "}
                              {item.tip}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* MURO DE PUBLICACIONES Y GUÍAS LEGALES (ESTILO FORO A 1 COLUMNA) */}
            <div className="space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-xl font-bold text-brand-charcoal">
                    Muro de Publicaciones y Guías Legales
                  </h3>
                  <p className="text-xs text-brand-charcoal/70">
                    Material oficial publicado por nuestros especialistas para
                    tu jurisdicción.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { id: "ALL", label: "Todos" },
                    { id: "Guía Consular", label: "Guías Consulares" },
                    { id: "Tips de Entrevista", label: "Entrevista" },
                    { id: "Checklist Oficial", label: "Checklists" },
                  ].map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategory(cat.id)}
                      className={`rounded-full px-3.5 py-1.5 text-xs font-bold transition-all cursor-pointer focus:outline-none ${
                        selectedCategory === cat.id
                          ? "bg-brand-charcoal text-white"
                          : "bg-brand-white border border-brand-charcoal/15 text-brand-charcoal/75 hover:text-brand-charcoal"
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredResources.length === 0 ? (
                <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-10 text-center space-y-2">
                  <BookOpen className="h-7 w-7 text-brand-charcoal/40 mx-auto" />
                  <p className="text-sm font-bold text-brand-charcoal">
                    Aún no hay publicaciones en esta categoría.
                  </p>
                  <p className="text-xs text-brand-charcoal/65">
                    Nuestro equipo legal publicará nuevas guías de preparación
                    aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredResources.map((res) => {
                    const reactionsMap = res.reactions || {};

                    return (
                      <article
                        key={res.id}
                        className="rounded-3xl bg-brand-white border border-brand-charcoal/12 p-6 sm:p-8 shadow-2xs space-y-5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="rounded-full bg-brand-red/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-red">
                              {res.category || "Guía Consular"}
                            </span>
                            <span className="rounded-full bg-brand-platinum px-2.5 py-0.5 font-mono text-[10px] font-bold text-brand-charcoal">
                              {res.destination === "ALL"
                                ? "EE. UU. & Japón"
                                : res.destination === "JAPAN"
                                ? "🇯🇵 Japón"
                                : "🇺🇸 EE. UU."}
                            </span>
                          </div>
                          {res.createdAt && (
                            <span className="text-[11px] text-brand-charcoal/55">
                              {new Date(res.createdAt).toLocaleDateString(
                                "es-CO",
                                {
                                  dateStyle: "medium",
                                }
                              )}
                            </span>
                          )}
                        </div>

                        <div className="space-y-2">
                          <h4 className="font-display text-lg sm:text-xl font-bold text-brand-charcoal">
                            {res.title}
                          </h4>
                          <p className="text-xs sm:text-sm text-brand-charcoal/80 leading-relaxed whitespace-pre-line">
                            {res.summary || res.content}
                          </p>
                        </div>

                        {/* TARJETA DE ADJUNTO CON BLUR + OJO AL HACER HOVER */}
                        {res.attachmentUrl && (
                          <div
                            onClick={() => setPreviewResource(res)}
                            className="group relative rounded-2xl bg-brand-platinum/60 border border-brand-charcoal/15 p-4 flex items-center justify-between gap-4 cursor-pointer overflow-hidden transition-all hover:border-brand-red"
                          >
                            <div className="flex items-center gap-3.5 min-w-0 transition-all duration-300 group-hover:blur-[2px] group-hover:opacity-60">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-charcoal text-white">
                                <FileText className="h-5 w-5 text-brand-red" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs sm:text-sm font-bold text-brand-charcoal truncate">
                                  {res.attachmentName ||
                                    "Documento Oficial Adjunto"}
                                </p>
                                <p className="text-[11px] text-brand-charcoal/65">
                                  Haz clic para previsualizar en pantalla
                                  completa (Esc para cerrar)
                                </p>
                              </div>
                            </div>

                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-brand-charcoal/25 backdrop-blur-[2px]">
                              <span className="inline-flex items-center gap-2 rounded-full bg-brand-charcoal text-white px-4 py-2 text-xs font-bold shadow-lg">
                                <Eye className="h-4 w-4 text-brand-red" />
                                <span>Previsualizar Documento</span>
                              </span>
                            </div>
                          </div>
                        )}

                        {/* BARRA INFERIOR DE REACCIONES CON CÁPSULA ANIMADA */}
                        <div className="pt-3 border-t border-brand-platinum flex items-center justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Cápsula desplegable hacia la derecha al hacer hover */}
                            <div className="group inline-flex items-center rounded-full bg-brand-platinum/80 border border-brand-charcoal/10 p-1 transition-all duration-300">
                              <span
                                className="flex h-7 w-7 items-center justify-center rounded-full text-brand-charcoal/70 group-hover:text-brand-red transition-colors"
                                title="Reaccionar"
                              >
                                <SmilePlus className="h-4 w-4" />
                              </span>
                              <div className="flex items-center gap-1 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[200px] group-hover:opacity-100 group-hover:px-1.5 transition-all duration-300 ease-out">
                                {REACTION_EMOJIS.map((emoji) => {
                                  const usersWhoReacted =
                                    reactionsMap[emoji] || [];
                                  const hasReacted = Boolean(
                                    user && usersWhoReacted.includes(user.uid)
                                  );
                                  return (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() =>
                                        handleToggleReaction(res.id, emoji)
                                      }
                                      className={`h-7 w-7 rounded-full flex items-center justify-center text-sm transition-transform hover:scale-125 cursor-pointer focus:outline-none ${
                                        hasReacted ? "bg-brand-red/15" : ""
                                      }`}
                                    >
                                      {emoji}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>

                            {/* Píldoras de conteo de reacciones activas */}
                            {REACTION_EMOJIS.map((emoji) => {
                              const list = reactionsMap[emoji] || [];
                              if (list.length === 0) return null;
                              const isMine = Boolean(
                                user && list.includes(user.uid)
                              );
                              return (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() =>
                                    handleToggleReaction(res.id, emoji)
                                  }
                                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all cursor-pointer focus:outline-none ${
                                    isMine
                                      ? "bg-brand-red/10 border border-brand-red/30 text-brand-red"
                                      : "bg-brand-platinum/60 border border-transparent text-brand-charcoal/80 hover:border-brand-charcoal/20"
                                  }`}
                                >
                                  <span>{emoji}</span>
                                  <span>{list.length}</span>
                                </button>
                              );
                            })}
                          </div>

                          {res.authorName && (
                            <span className="text-[11px] font-semibold text-brand-charcoal/55">
                              Publicado por {formatDisplayName(res.authorName)}
                            </span>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* MODAL PREVISUALIZADOR INTERNO DE DOCUMENTOS E IMÁGENES (CIERRA CON ESC) */}
      {previewResource && previewResource.attachmentUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/75 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6"
          onClick={() => setPreviewResource(null)}
        >
          <div
            className="w-full max-w-5xl h-[88vh] rounded-3xl bg-brand-white border border-white/15 shadow-2xl flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal text-white">
              <div className="min-w-0 pr-4">
                <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand-red block">
                  VISOR PROTEGIDO • SALA CONSULAR
                </span>
                <h4 className="font-display text-sm sm:text-base font-bold truncate">
                  {previewResource.attachmentName || previewResource.title}
                </h4>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <a
                  href={previewResource.attachmentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-brand-red px-4 py-2 text-xs font-bold text-white transition-all"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Descargar</span>
                </a>
                <button
                  type="button"
                  onClick={() => setPreviewResource(null)}
                  className="rounded-full bg-white/10 hover:bg-white/20 p-2 text-white transition-all cursor-pointer focus:outline-none"
                  aria-label="Cerrar previsualización (Esc)"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-brand-platinum/60 overflow-auto flex items-center justify-center p-4">
              {isImageUrl(previewResource.attachmentUrl) ? (
                <img
                  src={previewResource.attachmentUrl}
                  alt={previewResource.title}
                  className="max-h-full max-w-full rounded-xl object-contain shadow-md"
                />
              ) : (
                <iframe
                  src={previewResource.attachmentUrl}
                  title={previewResource.title}
                  className="w-full h-full rounded-xl bg-white border border-brand-charcoal/10"
                />
              )}
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}