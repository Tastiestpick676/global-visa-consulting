// app/dashboard/sala-entrenamiento/page.tsx
"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, getDocs, updateDoc } from "firebase/firestore";
import { ConsularResourceItem, ReactionType } from "@/types/visa";
import {
  downloadMeetingIcs,
  formatDisplayName,
  getGoogleCalendarUrl,
} from "@/lib/firebase/db";
import { getWhatsAppUrl } from "@/lib/constants";
import {
  Video,
  Calendar,
  CalendarPlus,
  BookOpen,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  MessageCircle,
  FileText,
  Eye,
  SmilePlus,
  X,
} from "lucide-react";

const REACTION_OPTIONS: {
  key: ReactionType;
  emoji: string;
  label: string;
}[] = [
  { key: "helpful", emoji: "👍", label: "Me sirve" },
  { key: "fire", emoji: "🔥", label: "Clave" },
  { key: "clap", emoji: "👏", label: "Muy claro" },
  { key: "bulb", emoji: "💡", label: "Buen tip" },
];

function getYouTubeEmbedUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.replace("/", "");
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (u.hostname.includes("youtube.com")) {
      if (u.pathname.startsWith("/shorts/")) {
        const id = u.pathname.split("/shorts/")[1]?.split("/")[0];
        return id ? `https://www.youtube.com/embed/${id}` : null;
      }
      const v = u.searchParams.get("v");
      return v ? `https://www.youtube.com/embed/${v}` : null;
    }
  } catch {}
  return null;
}

function getInstagramEmbedUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const u = new URL(rawUrl);
    if (u.hostname.includes("instagram.com")) {
      const cleanPath = u.pathname.replace(/\/$/, "");
      if (
        cleanPath.startsWith("/p/") ||
        cleanPath.startsWith("/reel/") ||
        cleanPath.startsWith("/tv/")
      ) {
        return `https://www.instagram.com${cleanPath}/embed`;
      }
    }
  } catch {}
  return null;
}

function isImageUrl(rawUrl?: string): boolean {
  if (!rawUrl) return false;
  const lower = rawUrl.toLowerCase();
  return (
    lower.includes(".jpg") ||
    lower.includes(".jpeg") ||
    lower.includes(".png") ||
    lower.includes(".webp")
  );
}

function isPdfUrl(rawUrl?: string, category?: string): boolean {
  if (!rawUrl) return false;
  const lower = rawUrl.toLowerCase();
  return (
    lower.includes(".pdf") ||
    (category === "Guia" && lower.includes("firebasestorage.googleapis.com"))
  );
}

export default function SalaEntrenamientoPage() {
  const { user, application } = useAuth();
  const isJapan = application?.destination === "JAPAN";

  const [resources, setResources] = useState<ConsularResourceItem[]>([]);
  const [loadingRes, setLoadingRes] = useState(true);
  const [previewDoc, setPreviewDoc] = useState<ConsularResourceItem | null>(
    null
  );

  useEffect(() => {
    const fetchResources = async () => {
      setLoadingRes(true);
      try {
        const snap = await getDocs(collection(db, "consular_resources"));
        const list: ConsularResourceItem[] = [];
        const dest = application?.destination || "USA";

        snap.forEach((d) => {
          if (d.id === "settings_booking") return;
          const item = d.data() as ConsularResourceItem;
          if (item.destination === "ALL" || item.destination === dest) {
            list.push(item);
          }
        });

        list.sort((a, b) =>
          (b.updatedAt || "").localeCompare(a.updatedAt || "")
        );
        setResources(list);
      } catch {
      } finally {
        setLoadingRes(false);
      }
    };

    fetchResources();
  }, [application?.destination]);

  // Cerrar el visualizador interno al presionar la tecla Escape (Esc)
  useEffect(() => {
    if (!previewDoc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewDoc(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewDoc]);

  const handleToggleReaction = async (
    item: ConsularResourceItem,
    reactionKey: ReactionType
  ) => {
    if (!user) return;
    const currentReactions = item.reactions || {};
    const listForKey = Array.isArray(currentReactions[reactionKey])
      ? currentReactions[reactionKey]!
      : [];

    const hasReacted = listForKey.includes(user.uid);
    const nextListForKey = hasReacted
      ? listForKey.filter((id) => id !== user.uid)
      : [...listForKey, user.uid];

    const nextReactions = {
      ...currentReactions,
      [reactionKey]: nextListForKey,
    };

    setResources((prev) =>
      prev.map((r) =>
        r.id === item.id ? { ...r, reactions: nextReactions } : r
      )
    );

    try {
      await updateDoc(doc(db, "consular_resources", item.id), {
        reactions: nextReactions,
      });
    } catch {}
  };

  const meetings = Array.isArray(application?.meetings)
    ? application?.meetings
    : [];
  const advisorName = formatDisplayName(
    application?.assignedAdvisorName || "Pendiente de asignación"
  );
  const bookingUrl = application?.assignedAdvisorBookingUrl || "";

  return (
    <DashboardLayout>
      <div className="space-y-8 font-sans">
        {/* HERO DE LA SALA CONSULAR */}
        <div className="rounded-3xl bg-brand-charcoal text-brand-white p-6 sm:p-8 border border-white/10 shadow-lg flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-red/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-red">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                SALA DE PREPARACIÓN CONSULAR 1-A-1 •{" "}
                {isJapan ? "JAPÓN MOFA" : "EE. UU. B1/B2"}
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              {isJapan
                ? "Centro de Revisión Documental y Carpeta Consular Japonesa"
                : "Entrenamiento de Entrevista Consular y Simulacro 1-a-1"}
            </h2>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              Asesor asignado:{" "}
              <strong className="text-white">{advisorName}</strong>. Únete a tus
              sesiones 1-a-1 en Google Meet y consulta el muro de publicaciones
              y guías legales.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            {bookingUrl ? (
              <a
                href={bookingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-xs font-bold text-white shadow-lg shadow-brand-red/25 hover:bg-brand-red/90 transition-all"
              >
                <Calendar className="h-4 w-4" />
                <span>Agendar Sesión 1-a-1</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            ) : (
              <a
                href={getWhatsAppUrl(
                  `Hola Global Visa Consulting, quiero coordinar mi sesión 1-a-1 de Sala Consular con mi asesor (${advisorName}).`
                )}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-brand-red px-6 py-3.5 text-xs font-bold text-white shadow-lg shadow-brand-red/25 hover:bg-brand-red/90 transition-all"
              >
                <MessageCircle className="h-4 w-4" />
                <span>Coordinar Simulacro por WhatsApp</span>
              </a>
            )}
          </div>
        </div>

        {/* SESIONES GOOGLE MEET PROGRAMADAS CON BOTONES .ICS Y GOOGLE CALENDAR */}
        <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-4">
          <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                <Video className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-brand-charcoal">
                  Tus Sesiones 1-a-1 en Google Meet ({meetings.length})
                </h3>
                <p className="text-xs text-brand-charcoal/70">
                  Enlaces directos a tus simulacros y descarga de recordatorio
                  para tu calendario.
                </p>
              </div>
            </div>
          </div>

          {meetings.length === 0 ? (
            <div className="rounded-2xl bg-brand-platinum/30 p-6 text-center space-y-1">
              <p className="text-xs font-bold text-brand-charcoal">
                Aún no tienes sesiones agendadas en el calendario
              </p>
              <p className="text-[11px] text-brand-charcoal/70">
                Cuando tu asesor programe tu simulacro 1-a-1, verás aquí la
                fecha, hora, el botón a la videollamada y el archivo .ics.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {meetings.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl bg-brand-platinum/40 p-5 border border-brand-charcoal/10 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[10px] font-bold uppercase text-brand-red">
                        SESIÓN 1-A-1 • GOOGLE MEET
                      </span>
                      {m.completed && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>Completada</span>
                        </span>
                      )}
                    </div>
                    <h4 className="font-display text-base font-bold text-brand-charcoal">
                      {m.title}
                    </h4>
                    <p className="text-xs text-brand-charcoal/75">
                      📅{" "}
                      {new Date(m.dateTime).toLocaleString("es-CO", {
                        dateStyle: "full",
                        timeStyle: "short",
                      })}{" "}
                      • Asesor:{" "}
                      <strong>{formatDisplayName(m.advisorName)}</strong>
                    </p>
                    {m.notes && (
                      <p className="text-[11px] text-brand-charcoal/65 pt-1">
                        Nota: {m.notes}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {m.meetUrl && (
                      <a
                        href={m.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand-charcoal px-4 py-2.5 text-xs font-bold text-white hover:bg-brand-red transition-all"
                      >
                        <Video className="h-4 w-4" />
                        <span>Entrar a Google Meet</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() =>
                        downloadMeetingIcs(m, application?.clientName)
                      }
                      title="Descargar archivo .ics para Apple Calendar / Outlook"
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-brand-white hover:bg-brand-charcoal hover:text-white px-4 py-2.5 text-xs font-bold text-brand-charcoal transition-all"
                    >
                      <CalendarPlus className="h-3.5 w-3.5 text-brand-red" />
                      <span>Descargar .ics</span>
                    </button>

                    <a
                      href={getGoogleCalendarUrl(m, application?.clientName)}
                      target="_blank"
                      rel="noopener noreferrer"
                      title="Añadir a Google Calendar"
                      className="inline-flex items-center justify-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-brand-white hover:bg-brand-charcoal hover:text-white px-3.5 py-2.5 text-xs font-bold text-brand-charcoal transition-all"
                    >
                      <span>Google Calendar</span>
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* MURO DE PUBLICACIONES Y GUÍAS LEGALES CON CÁPSULA EXPANDIBLE DE REACCIONES */}
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-brand-charcoal/10 pb-3.5">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-5 w-5 text-brand-red" />
              <h3 className="font-display text-lg font-bold text-brand-charcoal">
                Muro de Publicaciones y Guías Legales
              </h3>
            </div>
            <span className="text-xs font-medium text-brand-charcoal/60">
              {resources.length}{" "}
              {resources.length === 1 ? "publicación" : "publicaciones"}
            </span>
          </div>

          {loadingRes ? (
            <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-10 text-center text-xs text-brand-charcoal/60">
              Cargando muro de publicaciones...
            </div>
          ) : resources.length === 0 ? (
            <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-10 text-center text-xs text-brand-charcoal/60">
              Aún no hay publicaciones disponibles en el muro.
            </div>
          ) : (
            <div className="space-y-6">
              {resources.map((item) => {
                const ytEmbed = getYouTubeEmbedUrl(item.url);
                const igEmbed = getInstagramEmbedUrl(item.url);
                const isImg = isImageUrl(item.url);
                const isPdf = isPdfUrl(item.url, item.category);
                const isDocPreviewable = (isPdf || isImg) && Boolean(item.url);

                const destLabel =
                  item.destination === "ALL"
                    ? "General"
                    : item.destination === "JAPAN"
                    ? "Japón"
                    : "EE. UU.";

                // Filtrar qué reacciones ya tienen al menos 1 voto para mostrarlas como badges limpios
                const activeReactionsSummary = REACTION_OPTIONS.map((opt) => {
                  const list = Array.isArray(item.reactions?.[opt.key])
                    ? item.reactions![opt.key]!
                    : [];
                  const userReacted = Boolean(user && list.includes(user.uid));
                  return {
                    ...opt,
                    count: list.length,
                    userReacted,
                  };
                }).filter((r) => r.count > 0);

                return (
                  <article
                    key={item.id}
                    className="rounded-3xl bg-brand-white border border-brand-charcoal/12 overflow-hidden shadow-2xs transition-all"
                  >
                    {ytEmbed ? (
                      <div className="relative aspect-video w-full bg-brand-charcoal">
                        <iframe
                          src={ytEmbed}
                          title={item.title}
                          className="w-full h-full border-0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : igEmbed ? (
                      <div className="relative w-full h-[500px] bg-brand-white border-b border-brand-platinum overflow-hidden">
                        <iframe
                          src={igEmbed}
                          title={item.title}
                          className="w-full h-full border-0"
                          scrolling="no"
                        />
                      </div>
                    ) : isDocPreviewable ? (
                      <div
                        onClick={() => setPreviewDoc(item)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            setPreviewDoc(item);
                          }
                        }}
                        aria-label={`Abrir visualizador de ${item.title}`}
                        className="group cursor-pointer relative w-full h-80 sm:h-96 bg-brand-platinum overflow-hidden border-b border-brand-platinum"
                      >
                        <div className="w-full h-full transition-all duration-300 group-hover:blur-xs group-hover:scale-[1.01] pointer-events-none">
                          {isImg ? (
                            <img
                              src={item.url}
                              alt={item.title}
                              loading="lazy"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <iframe
                              src={`${item.url}#toolbar=0&navpanes=0&scrollbar=0`}
                              title={item.title}
                              className="w-full h-full border-0 bg-white"
                            />
                          )}
                        </div>

                        <div className="absolute inset-0 bg-brand-charcoal/35 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-all duration-300 flex flex-col items-center justify-center gap-2.5">
                          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-white text-brand-charcoal shadow-xl transform scale-90 group-hover:scale-100 transition-transform duration-300">
                            <Eye className="h-6 w-6 text-brand-red" />
                          </div>
                          <span className="rounded-full bg-brand-charcoal/90 px-4 py-1.5 text-xs font-bold text-white shadow-md">
                            Abrir Visualizador de Documento
                          </span>
                        </div>
                      </div>
                    ) : null}

                    {/* CONTENIDO Y BARRA EXPANDIBLE DE REACCIONES */}
                    <div className="p-6 sm:p-7 space-y-4">
                      <div className="flex items-center justify-between gap-4">
                        <span className="inline-flex items-center rounded-full bg-brand-red/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-red">
                          {item.category}
                        </span>
                        <span className="text-xs font-medium text-brand-charcoal/55">
                          Global Visa Consulting • {destLabel}
                        </span>
                      </div>

                      <div className="space-y-1.5">
                        <h4 className="font-display text-lg sm:text-xl font-bold text-brand-charcoal">
                          {item.title}
                        </h4>

                        {item.description && (
                          <p className="text-xs sm:text-sm text-brand-charcoal/75 leading-relaxed whitespace-pre-line">
                            {item.description}
                          </p>
                        )}
                      </div>

                      {/* BARRA INFERIOR CON CÍRCULO DE EMOJI EXPANDIBLE A LA DERECHA */}
                      <div className="pt-3.5 border-t border-brand-platinum flex items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Cápsula que inicia como un círculo y al hacer hover despliega los emojis a la derecha */}
                          <div className="group/reactions inline-flex items-center rounded-full bg-brand-platinum/65 hover:bg-brand-white border border-brand-charcoal/12 hover:border-brand-charcoal/20 p-1 hover:shadow-md transition-all duration-300">
                            {/* Botón circular genérico disparador */}
                            <span
                              title="Reaccionar a esta publicación"
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-white group-hover/reactions:bg-brand-charcoal text-brand-charcoal/70 group-hover/reactions:text-white shadow-2xs transition-colors duration-200 cursor-pointer"
                            >
                              <SmilePlus className="h-4 w-4" />
                            </span>

                            {/* Bandeja de emojis que se despliega suavemente hacia la derecha en hover */}
                            <div className="flex items-center gap-1 overflow-hidden max-w-0 opacity-0 group-hover/reactions:max-w-[200px] group-hover/reactions:opacity-100 group-hover/reactions:pl-1.5 group-hover/reactions:pr-1 transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]">
                              {REACTION_OPTIONS.map((reactOpt, idx) => {
                                const usersWhoReacted = Array.isArray(
                                  item.reactions?.[reactOpt.key]
                                )
                                  ? item.reactions![reactOpt.key]!
                                  : [];
                                const isSelected = Boolean(
                                  user && usersWhoReacted.includes(user.uid)
                                );

                                return (
                                  <button
                                    key={reactOpt.key}
                                    type="button"
                                    onClick={() =>
                                      handleToggleReaction(item, reactOpt.key)
                                    }
                                    title={reactOpt.label}
                                    style={{
                                      transitionDelay: `${idx * 25}ms`,
                                    }}
                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm transition-all duration-200 hover:scale-125 active:scale-95 focus:outline-none ${
                                      isSelected
                                        ? "bg-brand-red/15 ring-1 ring-brand-red"
                                        : "hover:bg-brand-platinum"
                                    }`}
                                  >
                                    <span>{reactOpt.emoji}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>

                          {/* Píldoras compactas de reacciones activas (solo aparecen las que tienen > 0 votos) */}
                          {activeReactionsSummary.map((r) => (
                            <button
                              key={r.key}
                              type="button"
                              onClick={() => handleToggleReaction(item, r.key)}
                              title={`${r.label} (${r.count})`}
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold border transition-all duration-200 active:scale-95 focus:outline-none ${
                                r.userReacted
                                  ? "bg-brand-charcoal text-white border-brand-charcoal shadow-2xs"
                                  : "bg-brand-platinum/50 hover:bg-brand-platinum text-brand-charcoal border-brand-charcoal/10"
                              }`}
                            >
                              <span className="text-sm leading-none">
                                {r.emoji}
                              </span>
                              <span className="font-mono text-[11px]">
                                {r.count}
                              </span>
                            </button>
                          ))}
                        </div>

                        {item.url && !ytEmbed && !igEmbed && !isDocPreviewable && (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs font-bold text-brand-charcoal/60 hover:text-brand-red transition-colors"
                          >
                            <FileText className="h-3.5 w-3.5" />
                            <span>Abrir enlace</span>
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* VISUALIZADOR INTERNO DE DOCUMENTOS (CIERRA CON ESC) */}
        {previewDoc && (
          <div
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
            onClick={() => setPreviewDoc(null)}
          >
            <div
              className="w-full max-w-5xl rounded-3xl bg-brand-white border border-brand-charcoal/20 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal text-white">
                <div className="min-w-0 pr-4">
                  <span className="font-mono text-[10px] font-bold uppercase text-brand-red block">
                    VISUALIZADOR INTERNO • {previewDoc.category} (ESC PARA
                    CERRAR)
                  </span>
                  <h3 className="font-display text-base font-bold truncate">
                    {previewDoc.title}
                  </h3>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {previewDoc.url && (
                    <a
                      href={previewDoc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-brand-red px-4 py-1.5 text-xs font-bold text-white transition-colors"
                    >
                      <span>Abrir Original</span>
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => setPreviewDoc(null)}
                    className="rounded-xl bg-white/10 hover:bg-brand-red p-2 text-white transition-colors focus:outline-none"
                    aria-label="Cerrar visualizador (Esc)"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              <div className="flex-1 bg-brand-platinum overflow-auto min-h-[72vh] flex items-center justify-center">
                {isImageUrl(previewDoc.url) ? (
                  <img
                    src={previewDoc.url}
                    alt={previewDoc.title}
                    className="max-h-[78vh] w-auto object-contain p-4"
                  />
                ) : (
                  <iframe
                    src={previewDoc.url}
                    title={previewDoc.title}
                    className="w-full h-[78vh] border-0 bg-white"
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}