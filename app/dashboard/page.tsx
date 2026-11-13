// app/dashboard/page.tsx
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { collection, doc, getDoc, getDocs } from "firebase/firestore";
import {
  calculateApplicationMetrics,
  formatDisplayName,
} from "@/lib/firebase/db";
import { UserProfile } from "@/types/visa";
import {
  FileText,
  FolderLock,
  Award,
  CheckCircle2,
  Clock,
  ArrowRight,
  Sparkles,
  UserCheck,
  Download,
  Calendar,
  ShieldCheck,
  Video,
  ExternalLink,
} from "lucide-react";

export default function ClientDashboardHomePage() {
  const { user, profile, application } = useAuth();
  const isJapan = application?.destination === "JAPAN";
  const metrics = calculateApplicationMetrics(application);

  const [advisorAvatar, setAdvisorAvatar] = useState<string>("");

  const clientName = formatDisplayName(
    application?.formData?.fullName ||
      profile?.fullName ||
      user?.displayName ||
      "Titular"
  );

  const assignedAdvisorName = formatDisplayName(
    application?.assignedAdvisorName ||
      (profile?.role === "admin" || profile?.role === "advisor"
        ? profile.fullName
        : "")
  );

  // Buscar la foto real del asesor asignado en Firestore
  useEffect(() => {
    const loadAdvisorPhoto = async () => {
      if (application?.assignedAdvisorPhotoUrl) {
        setAdvisorAvatar(application.assignedAdvisorPhotoUrl);
        return;
      }

      if (application?.assignedAdvisorId) {
        try {
          const snap = await getDoc(
            doc(db, "users", application.assignedAdvisorId)
          );
          if (snap.exists()) {
            const data = snap.data() as UserProfile;
            setAdvisorAvatar(data.photoUrl || data.photoURL || "");
            return;
          }
        } catch {}
      }

      if (
        (profile?.role === "admin" || profile?.role === "advisor") &&
        (profile.photoUrl || profile.photoURL || user?.photoURL)
      ) {
        setAdvisorAvatar(
          profile.photoUrl || profile.photoURL || user?.photoURL || ""
        );
        return;
      }

      if (assignedAdvisorName) {
        try {
          const snap = await getDocs(collection(db, "users"));
          snap.forEach((d) => {
            const u = d.data() as UserProfile;
            if (
              formatDisplayName(u.fullName).toLowerCase() ===
                assignedAdvisorName.toLowerCase() &&
              (u.photoUrl || u.photoURL)
            ) {
              setAdvisorAvatar(u.photoUrl || u.photoURL || "");
            }
          });
        } catch {}
      }
    };

    loadAdvisorPhoto();
  }, [
    application?.assignedAdvisorId,
    application?.assignedAdvisorPhotoUrl,
    assignedAdvisorName,
    profile,
    user,
  ]);

  const steps = [
    {
      num: 1,
      title: "Provisionamiento & Diagnóstico",
      desc: `Expediente activado para ${
        isJapan ? "Japón (MOFA)" : "Estados Unidos (B1/B2)"
      }.`,
      href: "/dashboard/perfil",
    },
    {
      num: 2,
      title: isJapan
        ? "Formulario MOFA & Itinerario"
        : "Formulario Inteligente DS-160",
      desc: `${metrics.formCompletedCount} campos estratégicos completados en español.`,
      href: "/dashboard/formulario",
    },
    {
      num: 3,
      title: "Bóveda Criptográfica PII",
      desc: `${metrics.verifiedDocsCount} de ${metrics.requiredDocsTotal} soportes verificados por tu especialista.`,
      href: "/dashboard/boveda",
    },
    {
      num: 4,
      title: "Sala Consular & Entregables",
      desc: isJapan
        ? "Emisión de carpeta física y Schedule of Stay oficial."
        : "Confirmación CEAC DS-160 y simulacro 1-a-1 en Google Meet.",
      href: "/dashboard/sala-entrenamiento",
    },
  ];

  const deliverables = Array.isArray(application?.officialDeliverables)
    ? application.officialDeliverables
    : [];
  const meetings = Array.isArray(application?.meetings)
    ? application.meetings
    : [];

  return (
    <DashboardLayout>
      <div className="space-y-8 font-sans">
        {/* BANNER PRINCIPAL CON SALUDO EN DOS LÍNEAS */}
        <div className="rounded-3xl bg-brand-charcoal text-brand-white p-6 sm:p-8 border border-white/10 shadow-lg space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2 max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-brand-red/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-red">
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  EXPEDIENTE OFICIAL •{" "}
                  {isJapan ? "🇯🇵 JAPÓN (MOFA)" : "🇺🇸 ESTADOS UNIDOS (B1/B2)"}
                </span>
              </div>

              <div className="space-y-1 pt-0.5">
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-white leading-tight">
                  Hola, {clientName}
                </h2>
                <p className="text-sm sm:text-base font-medium text-white/80">
                  Así avanza tu solicitud consular en tiempo real.
                </p>
              </div>

              <p className="text-xs text-white/70 pt-1">
                Plan contratado:{" "}
                <strong className="text-white">
                  {application?.planTier || profile?.planTier || "Priority Pro"}
                </strong>{" "}
                • Asesor asignado:{" "}
                <strong className="text-emerald-400">
                  {assignedAdvisorName || "Pendiente de asignación"}
                </strong>
              </p>
            </div>

            <div className="w-full lg:w-72 rounded-2xl bg-white/5 border border-white/10 p-5 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between text-xs font-bold">
                <span className="text-white/80">Progreso General</span>
                <span className="font-display text-xl text-brand-red">
                  {metrics.progressPercentage}%
                </span>
              </div>
              <div className="h-2.5 w-full rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand-red transition-all duration-500"
                  style={{ width: `${metrics.progressPercentage}%` }}
                />
              </div>
              <p className="text-[11px] text-white/65 flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>
                  Etapa {metrics.currentStep} de 4 • Estatus:{" "}
                  <strong className="uppercase text-white">
                    {metrics.autoStatus}
                  </strong>
                </span>
              </p>
            </div>
          </div>

          {/* LÍNEA DE TIEMPO DE LAS 4 ETAPAS */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {steps.map((st) => {
              const isCompleted = metrics.currentStep > st.num;
              const isCurrent = metrics.currentStep === st.num;
              return (
                <Link
                  key={st.num}
                  href={st.href}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between gap-3 ${
                    isCurrent
                      ? "bg-brand-red text-white border-brand-red shadow-md"
                      : isCompleted
                      ? "bg-white/10 text-white border-emerald-400/40 hover:bg-white/15"
                      : "bg-white/[0.04] text-white/70 border-white/10 hover:bg-white/10"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-extrabold uppercase">
                      PASO 0{st.num}
                    </span>
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    ) : (
                      <Clock className="h-4 w-4 opacity-75" />
                    )}
                  </div>
                  <div>
                    <p className="font-display text-xs font-bold">{st.title}</p>
                    <p className="text-[11px] opacity-80 mt-0.5 leading-snug">
                      {st.desc}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* TARJETAS DE ACCIÓN RÁPIDA */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Link
            href="/dashboard/formulario"
            className="group rounded-3xl bg-brand-white border-2 border-brand-charcoal/12 hover:border-brand-red p-6 shadow-2xs flex flex-col justify-between gap-5 transition-all"
          >
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-charcoal group-hover:bg-brand-red text-white transition-colors">
                <FileText className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-brand-charcoal">
                Formulario Inteligente
              </h3>
              <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                {isJapan
                  ? "Completa en español tus datos de viaje y alojamiento para estructurar tu formulario MOFA y Schedule of Stay."
                  : "Diligencia en español tu información personal, laboral y de viaje para la radicación técnica de tu DS-160."}
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red">
              <span>Abrir Formulario ({metrics.formCompletedCount} campos)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          <Link
            href="/dashboard/boveda"
            className="group rounded-3xl bg-brand-white border-2 border-brand-charcoal/12 hover:border-brand-red p-6 shadow-2xs flex flex-col justify-between gap-5 transition-all"
          >
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-charcoal group-hover:bg-brand-red text-white transition-colors">
                <FolderLock className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-brand-charcoal">
                Bóveda de Documentos
              </h3>
              <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                Sube tu pasaporte, foto consular y soportes financieros con
                cifrado Zero-Trust y purga automática de metadatos GPS.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red">
              <span>
                Gestionar Soportes ({metrics.uploadedDocsCount}/
                {metrics.requiredDocsTotal})
              </span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>

          <Link
            href="/dashboard/sala-entrenamiento"
            className="group rounded-3xl bg-brand-white border-2 border-brand-charcoal/12 hover:border-brand-red p-6 shadow-2xs flex flex-col justify-between gap-5 transition-all"
          >
            <div className="space-y-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-charcoal group-hover:bg-brand-red text-white transition-colors">
                <Award className="h-5 w-5" />
              </div>
              <h3 className="font-display text-lg font-bold text-brand-charcoal">
                Sala Consular 1-a-1
              </h3>
              <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                Accede a tus sesiones programadas en Google Meet con tu
                especialista y estudia las guías estratégicas de tu ruta.
              </p>
            </div>
            <div className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-red">
              <span>Ir a la Sala Consular ({meetings.length} sesiones)</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </div>
          </Link>
        </div>

        {/* RESUMEN DE ENTREGABLES Y ASESORÍA TITULAR (CON FOTO REAL DEL ASESOR Y REUNIONES) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-3.5">
              <div className="flex items-center gap-2.5">
                <Download className="h-4 w-4 text-brand-red" />
                <h3 className="font-display text-sm font-bold text-brand-charcoal">
                  Entregables Oficiales Listos ({deliverables.length})
                </h3>
              </div>
              <Link
                href="/dashboard/perfil"
                className="text-xs font-bold text-brand-red hover:underline"
              >
                Ver todos →
              </Link>
            </div>

            {deliverables.length === 0 ? (
              <p className="text-xs text-brand-charcoal/65 py-4">
                Tus documentos oficiales (Confirmación DS-160 / Schedule of
                Stay) aparecerán aquí tan pronto tu especialista los emita.
              </p>
            ) : (
              <div className="space-y-2.5">
                {deliverables.slice(0, 3).map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded-xl bg-brand-platinum/50 px-4 py-3 text-xs"
                  >
                    <span className="font-bold text-brand-charcoal truncate pr-3">
                      {d.label}
                    </span>
                    <a
                      href={d.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-full bg-brand-red px-3.5 py-1.5 text-[11px] font-bold text-white shrink-0"
                    >
                      Descargar
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-3.5">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-4 w-4 text-brand-red" />
                <h3 className="font-display text-sm font-bold text-brand-charcoal">
                  Asesoría Titular & Sesiones ({meetings.length})
                </h3>
              </div>
              <Link
                href="/dashboard/sala-entrenamiento"
                className="text-xs font-bold text-brand-red hover:underline"
              >
                Ir a Sala Consular →
              </Link>
            </div>

            {/* Ficha del Asesor con su Fotografía Real */}
            <div className="flex items-center justify-between rounded-2xl bg-brand-platinum/40 p-4 border border-brand-charcoal/10">
              <div className="flex items-center gap-3.5">
                <div className="relative shrink-0">
                  {advisorAvatar ? (
                    <img
                      src={advisorAvatar}
                      alt={assignedAdvisorName || "Asesor"}
                      width={44}
                      height={44}
                      loading="lazy"
                      decoding="async"
                      referrerPolicy="no-referrer"
                      className="h-11 w-11 rounded-xl object-cover border border-brand-charcoal/15 shadow-2xs"
                    />
                  ) : (
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-charcoal text-white font-display text-sm font-bold">
                      {assignedAdvisorName ? (
                        assignedAdvisorName.charAt(0).toUpperCase()
                      ) : (
                        <UserCheck className="h-5 w-5" />
                      )}
                    </div>
                  )}
                  {assignedAdvisorName && (
                    <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </div>

                <div>
                  <p className="text-xs font-bold text-brand-charcoal">
                    {assignedAdvisorName || "Sin asesor asignado aún"}
                  </p>
                  <p className="text-[11px] text-brand-charcoal/65">
                    {application?.assignedAdvisorEmail ||
                      (assignedAdvisorName
                        ? "Asesor Legal Titular • Supervisión activa"
                        : "En bolsa de asignación prioritaria")}
                  </p>
                </div>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                  assignedAdvisorName
                    ? "bg-emerald-500/15 text-emerald-800"
                    : "bg-amber-500/15 text-amber-800"
                }`}
              >
                {assignedAdvisorName ? "Asignado" : "En Bolsa"}
              </span>
            </div>

            {/* Lista de Reuniones Agendadas visibles directamente desde el Resumen */}
            {meetings.length > 0 && (
              <div className="space-y-2 pt-1">
                {meetings.slice(0, 2).map((m) => (
                  <div
                    key={m.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-brand-platinum/30 px-3.5 py-2.5 border border-brand-charcoal/10 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-bold text-brand-charcoal truncate">
                        {m.title}
                      </p>
                      <p className="text-[11px] text-brand-charcoal/65">
                        {new Date(m.dateTime).toLocaleString("es-CO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
                    {m.meetUrl && (
                      <a
                        href={m.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-brand-charcoal hover:bg-brand-red px-3 py-1.5 text-[11px] font-bold text-white shrink-0 transition-colors"
                      >
                        <Video className="h-3 w-3" />
                        <span>Meet</span>
                        <ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}