// app/dashboard/sala-entrenamiento/page.tsx
"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DocumentPreviewModal } from "@/components/dashboard/DocumentPreviewModal";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import { ConsularResourceItem } from "@/types/visa";
import { formatDisplayName } from "@/lib/firebase/db";
import {
  Calendar,
  Sparkles,
  BookOpen,
  ExternalLink,
  UserCheck,
  Clock,
  Eye,
  FileText,
} from "lucide-react";

const DEFAULT_FIRM_SCHEDULE_EMBED =
  "https://calendar.google.com/calendar/appointments/schedules/AcZssZ1Hb_eri_ul0i_zycg7FX-vcn8dZPEJk1Iayk9XZZ24xq1kRNdh0XpFJzLsn8yWBWBGxf3_WgPS?gv=true";

function extractCleanBookingUrl(rawInput?: string): string {
  if (!rawInput) return "";
  const trimmed = rawInput.trim();
  const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1].trim();
  }
  return trimmed;
}

function getEmbedYouTubeUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  try {
    const url = new URL(rawUrl.trim());
    if (url.hostname.includes("youtu.be")) {
      const id = url.pathname.split("/").filter(Boolean)[0];
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (url.hostname.includes("youtube.com")) {
      const vParam = url.searchParams.get("v");
      if (vParam) return `https://www.youtube.com/embed/${vParam}`;
      const parts = url.pathname.split("/").filter(Boolean);
      if (
        (parts[0] === "shorts" || parts[0] === "embed" || parts[0] === "v") &&
        parts[1]
      ) {
        return `https://www.youtube.com/embed/${parts[1]}`;
      }
    }
  } catch {
    const match = rawUrl.match(
      /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/|v\/))([a-zA-Z0-9_-]{11})/
    );
    if (match && match[1]) {
      return `https://www.youtube.com/embed/${match[1]}`;
    }
  }
  return null;
}

function getEmbedInstagramUrl(rawUrl?: string): string | null {
  if (!rawUrl) return null;
  const match = rawUrl.match(
    /instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i
  );
  if (match && match[1]) {
    return `https://www.instagram.com/p/${match[1]}/embed`;
  }
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

function formatBookingEmbedUrl(
  rawBookingUrl: string,
  clientName: string,
  clientEmail: string
): string {
  const clean =
    extractCleanBookingUrl(rawBookingUrl) || DEFAULT_FIRM_SCHEDULE_EMBED;
  try {
    const url = new URL(clean);
    if (
      url.hostname.includes("calendly.com") ||
      url.hostname.includes("cal.com")
    ) {
      if (clientName) url.searchParams.set("name", clientName);
      if (clientEmail) url.searchParams.set("email", clientEmail);
      url.searchParams.set("hide_gdpr_banner", "1");
    } else if (url.hostname.includes("calendar.google.com")) {
      url.searchParams.set("gv", "true");
    }
    return url.toString();
  } catch {
    return clean;
  }
}

export default function SalaPage() {
  const { user, profile, application } = useAuth();
  const [resources, setResources] = useState<ConsularResourceItem[]>([]);
  const [resolvedEmbedUrl, setResolvedEmbedUrl] = useState<string>("");
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  // Estado del Visor Integrado para los PDFs y Guías de la Sala Consular
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    fileUrl: string;
  } | null>(null);

  const destination = application?.destination || profile?.destination || "USA";
  const hasAssignedAdvisor = Boolean(application?.assignedAdvisorId);

  useEffect(() => {
    const loadResourcesAndAdvisorBooking = async () => {
      setLoadingSchedule(true);
      try {
        const snap = await getDocs(collection(db, "consular_resources"));
        const list: ConsularResourceItem[] = [];

        snap.forEach((d) => {
          if (d.id !== "settings_booking") {
            const item = d.data() as ConsularResourceItem;
            if (
              item.destination === "ALL" ||
              item.destination === destination
            ) {
              list.push(item);
            }
          }
        });
        list.sort((a, b) =>
          (b.updatedAt || "").localeCompare(a.updatedAt || "")
        );
        setResources(list);

        if (application?.assignedAdvisorId) {
          let chosenUrl = extractCleanBookingUrl(
            application.assignedAdvisorBookingUrl || ""
          );

          if (!chosenUrl) {
            const advSnap = await getDoc(
              doc(db, "users", application.assignedAdvisorId)
            );
            if (advSnap.exists() && advSnap.data()?.bookingUrl) {
              chosenUrl = extractCleanBookingUrl(advSnap.data().bookingUrl);
            }
          }

          if (!chosenUrl || chosenUrl.includes("calendar.app.google")) {
            chosenUrl = DEFAULT_FIRM_SCHEDULE_EMBED;
          }

          setResolvedEmbedUrl(chosenUrl);
        } else {
          setResolvedEmbedUrl("");
        }
      } catch {
        setResolvedEmbedUrl("");
      } finally {
        setLoadingSchedule(false);
      }
    };

    loadResourcesAndAdvisorBooking();
  }, [
    destination,
    application?.assignedAdvisorId,
    application?.assignedAdvisorBookingUrl,
  ]);

  const clientNameStr =
    application?.formData?.fullName ||
    profile?.fullName ||
    user?.displayName ||
    "";
  const clientEmailStr = profile?.email || user?.email || "";

  const embedBookingUrl = hasAssignedAdvisor
    ? formatBookingEmbedUrl(resolvedEmbedUrl, clientNameStr, clientEmailStr)
    : "";

  const meetingsList = application?.meetings || [];

  return (
    <DashboardLayout>
      {/* MODAL DEL VISOR DE DOCUMENTOS INTEGRADO */}
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || ""}
        fileUrl={previewDoc?.fileUrl || ""}
      />

      <div className="max-w-4xl mx-auto space-y-8 font-sans">
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-2xl bg-brand-charcoal p-7 sm:p-8 text-brand-white shadow-lg">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-3 py-1 text-xs font-semibold text-brand-red">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {destination === "JAPAN"
                  ? "🇯🇵 Blog y Sala Consular — Japón"
                  : "🇺🇸 Blog y Sala Consular — Estados Unidos"}
              </span>
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Sala Consular & Entregables Legales
            </h2>
            <p className="text-xs sm:text-sm text-white/70 max-w-xl leading-relaxed">
              Consulta las notas y documentos de tus sesiones, explora las guías exclusivas de nuestro equipo y agenda tu cita 1-a-1 con tu especialista asignado.
            </p>
          </div>

          <div className="rounded-xl bg-white/[0.06] p-4 border border-white/10 shrink-0 text-center min-w-[175px]">
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
              Especialista a Cargo
            </p>
            <p className="font-display text-xs font-bold text-white mt-1.5">
              {formatDisplayName(application?.assignedAdvisorName) || "En Asignación"}
            </p>
          </div>
        </div>

        {/* BITÁCORA DE MEETINGS */}
        {meetingsList.length > 0 && (
          <div className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-4">
            <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
              <UserCheck className="h-5 w-5 text-brand-red" />
              <div>
                <h3 className="font-display text-base font-bold text-brand-charcoal">
                  Resumen de Sesiones y Documentos Entregables ({meetingsList.length})
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  Notas oficiales y archivos adjuntos cargados por tu especialista legal.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {meetingsList.map((mtg) => (
                <div
                  key={mtg.id}
                  className="rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/25 p-5 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-emerald-600 px-3 py-0.5 text-[10px] font-bold text-white">
                        📅 {mtg.date}
                      </span>
                      <h4 className="font-display text-sm font-bold text-brand-charcoal">
                        {mtg.title}
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-800">
                      Asesor: {formatDisplayName(mtg.advisorName)}
                    </span>
                  </div>

                  <p className="text-xs sm:text-sm text-brand-charcoal/80 leading-relaxed whitespace-pre-line bg-brand-white p-4 rounded-xl border border-emerald-500/15">
                    {mtg.notes}
                  </p>

                  {mtg.attachmentUrl && (
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewDoc({
                            title: mtg.title,
                            fileUrl: mtg.attachmentUrl || "",
                          })
                        }
                        className="inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-red transition-all"
                      >
                        <Eye className="h-3.5 w-3.5" />
                        <span>Vista Previa</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* FEED EDITORIAL CON RENDERIZADO DE 1RA PÁGINA (ESTILO MINIATURA YOUTUBE + HOVER BLUR + OJO) */}
        <div className="space-y-5">
          <div className="flex items-center justify-between border-b border-brand-charcoal/10 pb-3">
            <div className="flex items-center gap-2.5">
              <BookOpen className="h-5 w-5 text-brand-red" />
              <h3 className="font-display text-lg font-bold text-brand-charcoal">
                Muro de Publicaciones y Guías Legales
              </h3>
            </div>
            <span className="text-xs font-medium text-brand-charcoal/50">
              {resources.length} publicaciones
            </span>
          </div>

          {resources.length === 0 ? (
            <div className="rounded-2xl bg-brand-white p-8 border border-brand-charcoal/10 text-center text-xs text-brand-charcoal/50">
              Pronto tu asesor publicará artículos y videos exclusivos para tu proceso.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6">
              {resources.map((item) => {
                const youtubeEmbed = getEmbedYouTubeUrl(item.url);
                const instagramEmbed = getEmbedInstagramUrl(item.url);
                const isPdfOrFile =
                  !youtubeEmbed &&
                  !instagramEmbed &&
                  (item.category === "Guia" ||
                    item.category === "Documento Oficial" ||
                    item.category === "Checklist" ||
                    Boolean(
                      item.url &&
                        (item.url.toLowerCase().includes(".pdf") ||
                          item.url.includes("firebasestorage.googleapis.com"))
                    ));

                const isImg = isImageUrl(item.url);

                return (
                  <article
                    key={item.id}
                    className="rounded-3xl bg-brand-white border border-brand-charcoal/10 shadow-sm overflow-hidden transition-all hover:shadow-md"
                  >
                    {/* 1. REPRODUCTOR YOUTUBE */}
                    {youtubeEmbed && (
                      <div className="aspect-video w-full bg-brand-charcoal border-b border-brand-platinum">
                        <iframe
                          src={youtubeEmbed}
                          title={item.title}
                          className="w-full h-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      </div>
                    )}

                    {/* 2. REPRODUCTOR INSTAGRAM */}
                    {instagramEmbed && (
                      <div className="w-full bg-brand-platinum/30 border-b border-brand-platinum flex justify-center py-4">
                        <iframe
                          src={instagramEmbed}
                          title={item.title}
                          className="w-full max-w-md h-[540px] rounded-2xl border border-brand-charcoal/10 bg-white"
                        />
                      </div>
                    )}

                    {/* 3. RENDERIZADO DE PRIMERA PÁGINA DEL PDF / IMAGEN ARRIBA (COMO YOUTUBE) + BLUR Y OJO EN HOVER */}
                    {isPdfOrFile && item.url && (
                      <div
                        onClick={() =>
                          setPreviewDoc({
                            title: item.title,
                            fileUrl: item.url || "",
                          })
                        }
                        className="group relative aspect-video w-full bg-brand-platinum/60 border-b border-brand-platinum overflow-hidden cursor-pointer select-none"
                      >
                        {/* Renderizado en vivo de la 1ra página del documento que se desenfoca en hover */}
                        <div className="w-full h-full transition-all duration-300 ease-out group-hover:blur-xs group-hover:scale-[1.02] pointer-events-none">
                          {isImg ? (
                            <img
                              src={item.url}
                              alt={item.title}
                              className="w-full h-full object-cover object-top"
                            />
                          ) : (
                            <iframe
                              src={`${item.url}#page=1&toolbar=0&navpanes=0&scrollbar=0&view=FitH`}
                              title={item.title}
                              scrolling="no"
                              className="w-full h-[120%] -mt-2 border-0 bg-white pointer-events-none"
                            />
                          )}
                        </div>

                        {/* Etiqueta discreta en la esquina superior izquierda */}
                        <div className="absolute top-4 left-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal/85 backdrop-blur-xs px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
                          <FileText className="h-3 w-3 text-brand-red" />
                          <span>Vista de 1ª Página • Haz clic para ampliar</span>
                        </div>

                        {/* Capa de Hover con Blur + Círculo Central con Ojo */}
                        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-brand-charcoal/0 group-hover:bg-brand-charcoal/45 transition-all duration-300">
                          <div className="flex flex-col items-center gap-2.5 opacity-0 scale-90 group-hover:opacity-100 group-hover:scale-100 transition-all duration-300">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-red text-white shadow-2xl shadow-brand-red/50 ring-4 ring-white/25">
                              <Eye className="h-7 w-7" />
                            </div>
                            <span className="rounded-full bg-brand-charcoal/90 px-4 py-1.5 text-xs font-bold text-white shadow-md">
                              Abrir Vista Previa Completa
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* PIE DE TARJETA (IGUAL QUE YOUTUBE + BOTÓN "VISTA PREVIA") */}
                    <div className="p-6 sm:p-7 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-brand-red/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-red">
                          {item.category}
                        </span>
                        <span className="text-[11px] font-medium text-brand-charcoal/45">
                          Global Visa Consulting •{" "}
                          {item.destination === "ALL"
                            ? "General"
                            : item.destination}
                        </span>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                          <h4 className="font-display text-xl font-bold text-brand-charcoal">
                            {item.title}
                          </h4>

                          {item.description && (
                            <p className="text-xs sm:text-sm text-brand-charcoal/70 leading-relaxed whitespace-pre-line">
                              {item.description}
                            </p>
                          )}
                        </div>

                        {isPdfOrFile && item.url && (
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewDoc({
                                title: item.title,
                                fileUrl: item.url || "",
                              })
                            }
                            className="shrink-0 inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-red transition-colors shadow-xs"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Vista Previa</span>
                          </button>
                        )}
                      </div>

                      {item.url && !youtubeEmbed && !instagramEmbed && !isPdfOrFile && (
                        <div className="pt-2">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-red transition-colors"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            <span>Abrir recurso externo</span>
                          </a>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* AGENDA EN TIEMPO REAL */}
        <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 shadow-sm overflow-hidden">
          <div className="bg-brand-charcoal px-7 py-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-brand-red" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-brand-red">
                  Agenda Oficial del Especialista • Sincronización Directa
                </span>
              </div>
              <h3 className="font-display text-lg font-bold">
                {hasAssignedAdvisor
                  ? `Reserva tu Sesión 1-a-1 con ${formatDisplayName(application?.assignedAdvisorName)}`
                  : "Asignación de Especialista Legal en Curso"}
              </h3>
              <p className="text-xs text-white/65">
                {hasAssignedAdvisor
                  ? `Elige el día y la hora en el calendario de abajo. Google Calendar enviará automáticamente la invitación y el enlace de Google Meet a ${clientEmailStr}.`
                  : "Una vez que tu expediente sea asignado a tu Especialista Legal titular, aquí se habilitará su calendario exclusivo de citas."}
              </p>
            </div>
          </div>

          {!hasAssignedAdvisor ? (
            <div className="p-12 text-center space-y-3 bg-brand-platinum/20">
              <Clock className="h-9 w-9 text-amber-500 mx-auto" />
              <h4 className="font-display text-base font-bold text-brand-charcoal">
                Tu caso está siendo asignado a un Asesor Legal
              </h4>
              <p className="text-xs text-brand-charcoal/60 max-w-md mx-auto leading-relaxed">
                Mientras asignamos tu expediente, avanza completando tu <strong>Cuestionario Estratégico</strong> y subiendo tus documentos en la <strong>Bóveda</strong>. En cuanto tu asesor tome el caso, podrás agendar directamente con él en esta sección.
              </p>
            </div>
          ) : loadingSchedule ? (
            <div className="p-12 text-center text-xs text-brand-charcoal/50">
              Cargando disponibilidad de {formatDisplayName(application?.assignedAdvisorName)}...
            </div>
          ) : (
            <div className="w-full bg-brand-white">
              <iframe
                src={embedBookingUrl}
                title="Cita consular 1:1 — Global Visa Consulting"
                style={{ border: 0 }}
                width="100%"
                height="680"
                frameBorder="0"
                className="w-full h-[680px] border-0"
                allow="camera; microphone; fullscreen"
              />
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}