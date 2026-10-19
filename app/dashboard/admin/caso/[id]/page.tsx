// app/dashboard/admin/caso/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  deleteField,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  ApplicationStatus,
  CaseMeetingRecord,
  UserProfile,
  VaultDocument,
  VisaApplication,
} from "@/types/visa";
import {
  calculateApplicationMetrics,
  formatDisplayName,
} from "@/lib/firebase/db";
import {
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileText,
  FolderLock,
  Calendar,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Sparkles,
  Paperclip,
  Plus,
  ArchiveRestore,
  XCircle,
  Clock,
  Award,
  ShieldAlert,
  RotateCcw,
} from "lucide-react";

const inputBaseClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 px-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

// Las 4 etapas secuenciales limpias (sin mezclar los botones de Aprobada/Rechazada en la barra)
const PROCESS_STAGES: {
  id: ApplicationStatus;
  order: number;
  label: string;
  desc: string;
}[] = [
  {
    id: "onboarding_pending",
    order: 1,
    label: "1. Onboarding",
    desc: "Cuestionario estratégico",
  },
  {
    id: "documents_pending",
    order: 2,
    label: "2. Bóveda Documental",
    desc: "Recolección de soportes",
  },
  {
    id: "in_legal_review",
    order: 3,
    label: "3. Auditoría Legal",
    desc: "Revisión por especialista",
  },
  {
    id: "ready_for_consulate",
    order: 4,
    label: "4. Listo Consulado",
    desc: "Entregables y simulacro",
  },
];

function getStageOrder(status: ApplicationStatus): number {
  if (status === "onboarding_pending") return 1;
  if (status === "documents_pending") return 2;
  if (status === "in_legal_review") return 3;
  if (status === "ready_for_consulate") return 4;
  if (status === "approved" || status === "rejected") return 5;
  return 1;
}

export default function CaseWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const caseId = params?.id as string;

  const [appData, setAppData] = useState<VisaApplication | null>(null);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    "cuestionario" | "boveda" | "meetings"
  >("cuestionario");
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Modales de Doble Confirmación (Retroceso de Etapa y Dictamen Final Consular)
  const [pendingRollbackStage, setPendingRollbackStage] =
    useState<ApplicationStatus | null>(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);

  // Estado para Registrar un Nuevo Meeting
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [meetingTitle, setMeetingTitle] = useState("");
  const [meetingNotes, setMeetingNotes] = useState("");
  const [meetingFile, setMeetingFile] = useState<File | null>(null);
  const [savingMeeting, setSavingMeeting] = useState(false);

  const [decommissioning, setDecommissioning] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  useEffect(() => {
    if (!isStaff || !caseId) return;

    // 1. Suscripción en TIEMPO REAL (onSnapshot) al expediente del cliente:
    // Si el cliente modifica cualquier dato de su formulario o sube un documento, se actualiza en vivo aquí
    const unsubCase = onSnapshot(
      doc(db, "applications", caseId),
      (snap) => {
        if (snap.exists()) {
          setAppData(snap.data() as VisaApplication);
        } else {
          setAppData(null);
        }
        setLoading(false);
      },
      () => {
        setErrorMsg("No se pudo sincronizar el expediente en tiempo real.");
        setLoading(false);
      }
    );

    // 2. Cargar lista de asesores
    getDocs(collection(db, "users")).then((usersSnap) => {
      const staff: UserProfile[] = [];
      usersSnap.forEach((d) => {
        const u = d.data() as UserProfile;
        if (u.role === "admin" || u.role === "advisor") {
          staff.push(u);
        }
      });
      setStaffList(staff);
    });

    return () => unsubCase();
  }, [isStaff, caseId]);

  const handleCopyText = (label: string, val?: string) => {
    if (!val) return;
    navigator.clipboard.writeText(val);
    setCopiedField(label);
    setTimeout(() => setCopiedField(null), 1800);
  };

  // Ejecuta el cambio de estado en Firestore
  const executeStageChange = async (newStatus: ApplicationStatus) => {
    if (!appData) return;
    setFeedback("");
    setErrorMsg("");
    setPendingRollbackStage(null);
    setShowResolutionModal(false);

    const simulatedApp: VisaApplication = { ...appData, status: newStatus };
    const metrics = calculateApplicationMetrics(simulatedApp);

    try {
      await updateDoc(doc(db, "applications", appData.id), {
        status: newStatus,
        progressPercentage: metrics.progressPercentage,
        currentStep: metrics.currentStep,
        updatedAt: new Date().toISOString(),
      });

      setFeedback(
        `Estado actualizado a "${newStatus.toUpperCase()}". Avance sincronizado en tiempo real (${metrics.progressPercentage}%).`
      );
    } catch {
      setErrorMsg("No se pudo actualizar la etapa del caso.");
    }
  };

  // Verifica si es un retroceso de etapa para exigir Doble Confirmación
  const handleStageClick = (targetStatus: ApplicationStatus) => {
    if (!appData || appData.status === targetStatus) return;

    const currentMetrics = calculateApplicationMetrics(appData);
    const currentOrder = Math.max(
      getStageOrder(appData.status),
      currentMetrics.currentStep
    );
    const targetOrder = getStageOrder(targetStatus);

    // Si intenta retroceder a una etapa menor (o volver a Onboarding cuando el formulario ya tiene datos), pedimos doble confirmación
    if (
      targetOrder < currentOrder ||
      (targetStatus === "onboarding_pending" &&
        currentMetrics.formSemaphore !== "missing")
    ) {
      setPendingRollbackStage(targetStatus);
      return;
    }

    executeStageChange(targetStatus);
  };

  const handleChangeAdvisor = async (newAdvisorUid: string) => {
    if (!appData) return;
    const chosen = staffList.find((s) => s.uid === newAdvisorUid);
    const cleanName = chosen ? formatDisplayName(chosen.fullName) : "";
    try {
      await updateDoc(doc(db, "applications", appData.id), {
        assignedAdvisorId: chosen ? chosen.uid : "",
        assignedAdvisorName: cleanName,
        assignedAdvisorEmail: chosen ? chosen.email : "",
        assignedAdvisorBookingUrl: chosen?.bookingUrl || "",
        updatedAt: new Date().toISOString(),
      });
      setFeedback(
        chosen
          ? `Caso asignado a ${cleanName}.`
          : "El caso fue devuelto a la Bolsa de Casos."
      );
    } catch {
      setErrorMsg("Error al reasignar asesor.");
    }
  };

  const handleVerifyDocument = async (
    docId: string,
    newDocStatus: "verified" | "rejected"
  ) => {
    if (!appData || !appData.documents?.[docId]) return;
    try {
      const updatedDocs: Record<string, VaultDocument> = {
        ...appData.documents,
        [docId]: {
          ...appData.documents[docId],
          status: newDocStatus,
        },
      };

      const nextApp = { ...appData, documents: updatedDocs };
      const metrics = calculateApplicationMetrics(nextApp);

      await updateDoc(doc(db, "applications", appData.id), {
        documents: updatedDocs,
        progressPercentage: metrics.progressPercentage,
        currentStep: metrics.currentStep,
        updatedAt: new Date().toISOString(),
      });

      setFeedback(
        `Documento marcado como ${
          newDocStatus === "verified" ? "VERIFICADO" : "OBSERVADO"
        }.`
      );
    } catch {
      setErrorMsg("No se pudo actualizar el estado del documento.");
    }
  };

  const handleAddMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appData) return;
    setSavingMeeting(true);
    setFeedback("");
    setErrorMsg("");

    try {
      let attachmentUrl = "";
      let attachmentName = "";
      let attachmentStoragePath = "";

      if (meetingFile) {
        const safeName = meetingFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        attachmentStoragePath = `vault/${appData.id}/meetings/${Date.now()}_${safeName}`;
        const fileRef = ref(storage, attachmentStoragePath);
        await uploadBytes(fileRef, meetingFile);
        attachmentUrl = await getDownloadURL(fileRef);
        attachmentName = meetingFile.name;
      }

      const newMeeting: CaseMeetingRecord = {
        id: `mtg_${Date.now()}`,
        date: meetingDate,
        title: meetingTitle.trim() || "Sesión de Revisión y Auditoría Consular",
        notes: meetingNotes.trim(),
        advisorName: formatDisplayName(profile?.fullName) || "Especialista Legal",
        ...(attachmentUrl
          ? { attachmentUrl, attachmentName, attachmentStoragePath }
          : {}),
        createdAt: new Date().toISOString(),
      };

      const updatedMeetings = [newMeeting, ...(appData.meetings || [])];
      const nextApp: VisaApplication = {
        ...appData,
        meetings: updatedMeetings,
      };
      const metrics = calculateApplicationMetrics(nextApp);

      const updatedConsularSession = {
        ...(appData.consularSession || {}),
        status: "completed" as const,
        advisorNotes:
          newMeeting.notes || appData.consularSession?.advisorNotes || "",
        ...(attachmentUrl
          ? {
              officialDeliverableTitle: newMeeting.title,
              officialDeliverableUrl: attachmentUrl,
            }
          : {}),
      };

      await updateDoc(doc(db, "applications", appData.id), {
        meetings: updatedMeetings,
        consularSession: updatedConsularSession,
        progressPercentage: metrics.progressPercentage,
        currentStep: metrics.currentStep,
        updatedAt: new Date().toISOString(),
      });

      setMeetingTitle("");
      setMeetingNotes("");
      setMeetingFile(null);
      setFeedback(
        "¡Meeting registrado! Las notas y el archivo adjunto ya están sincronizados con el cliente."
      );
    } catch {
      setErrorMsg("No se pudo registrar el meeting.");
    } finally {
      setSavingMeeting(false);
    }
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!appData || !appData.meetings) return;
    const target = appData.meetings.find((m) => m.id === meetingId);
    try {
      if (target?.attachmentStoragePath) {
        try {
          await deleteObject(ref(storage, target.attachmentStoragePath));
        } catch {}
      }
      const updated = appData.meetings.filter((m) => m.id !== meetingId);
      await updateDoc(doc(db, "applications", appData.id), {
        meetings: updated,
        updatedAt: new Date().toISOString(),
      });
      setFeedback("Registro de meeting eliminado.");
    } catch {
      setErrorMsg("No se pudo eliminar el registro.");
    }
  };

  const handleDecommissionCase = async () => {
    if (!appData) return;
    const confirmPurge = window.confirm(
      `¿Confirmas el decomisionamiento seguro del expediente de ${
        appData.formData?.fullName || appData.clientName
      }?\n\nSe borrarán todos los archivos pesados de Firebase Storage y los datos sensibles PII, conservando la estadística en los KPIs.`
    );
    if (!confirmPurge) return;

    setDecommissioning(true);
    try {
      if (appData.documents) {
        for (const docItem of Object.values(appData.documents)) {
          if (docItem.storagePath) {
            try {
              await deleteObject(ref(storage, docItem.storagePath));
            } catch {}
          }
        }
      }
      if (appData.meetings) {
        for (const m of appData.meetings) {
          if (m.attachmentStoragePath) {
            try {
              await deleteObject(ref(storage, m.attachmentStoragePath));
            } catch {}
          }
        }
      }

      const preservedName =
        appData.formData?.fullName || appData.clientName || "Cliente Archivado";

      await updateDoc(doc(db, "applications", appData.id), {
        clientName: preservedName,
        formData: deleteField(),
        documents: deleteField(),
        isDecommissioned: true,
        decommissionedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setFeedback("Purga PII y decomisionamiento de Storage completado.");
    } catch {
      setErrorMsg("Error al ejecutar la purga PII.");
    } finally {
      setDecommissioning(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="py-20 text-center text-xs text-brand-charcoal/50">
          Abriendo Mesa de Trabajo del Expediente...
        </div>
      </DashboardLayout>
    );
  }

  if (!appData) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl bg-brand-white p-8 border border-brand-charcoal/10 text-center space-y-3">
          <p className="text-sm font-bold text-brand-charcoal">
            No se encontró el expediente solicitado.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/admin?tab=mis-casos")}
            className="inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-5 py-2 text-xs font-semibold text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver al Backoffice</span>
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const autoMetrics = calculateApplicationMetrics(appData);
  const docsArray = appData.documents ? Object.values(appData.documents) : [];
  const meetingsArray = appData.meetings || [];
  const isCaseClosed =
    appData.status === "approved" || appData.status === "rejected";

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto space-y-6 font-sans">
        {/* MODAL DE DOBLE CONFIRMACIÓN PARA RETROCEDER ETAPA */}
        {pendingRollbackStage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-md rounded-3xl bg-brand-white p-7 border border-brand-charcoal/10 shadow-2xl space-y-5">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-600">
                  <RotateCcw className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-lg font-bold text-brand-charcoal">
                    Confirmar Retroceso de Etapa
                  </h3>
                  <p className="text-xs text-brand-charcoal/55">
                    Acción de gobernanza con doble verificación
                  </p>
                </div>
              </div>

              <p className="text-xs sm:text-sm text-brand-charcoal/75 leading-relaxed">
                El expediente de{" "}
                <strong>
                  {appData.formData?.fullName || appData.clientName}
                </strong>{" "}
                ya cuenta con información adelantada (Paso {autoMetrics.currentStep} de 4). ¿Estás seguro de que deseas regresar manualmente el estado a{" "}
                <strong className="uppercase text-brand-red">
                  {pendingRollbackStage}
                </strong>
                ?
              </p>

              <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-brand-platinum">
                <button
                  type="button"
                  onClick={() => setPendingRollbackStage(null)}
                  className="rounded-full px-5 py-2.5 text-xs font-semibold text-brand-charcoal/70 hover:bg-brand-platinum transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => executeStageChange(pendingRollbackStage)}
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-brand-red/90 transition-all"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Sí, Retroceder Etapa</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL ELEGANTE DE DICTAMEN CONSULAR FINAL (APROBADA / RECHAZADA) */}
        {showResolutionModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-3xl bg-brand-white p-7 border border-brand-charcoal/10 shadow-2xl space-y-6">
              <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-charcoal text-white">
                    <Award className="h-5 w-5 text-brand-red" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-bold text-brand-charcoal">
                      Emitir Resolución Consular Oficial
                    </h3>
                    <p className="text-xs text-brand-charcoal/55">
                      Registra la decisión final de la Embajada para este expediente.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => executeStageChange("approved")}
                  className="group flex flex-col items-start justify-between rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/[0.04] hover:bg-emerald-600 hover:border-emerald-600 p-5 text-left transition-all"
                >
                  <CheckCircle2 className="h-7 w-7 text-emerald-600 group-hover:text-white mb-3 transition-colors" />
                  <div>
                    <p className="font-display text-base font-bold text-brand-charcoal group-hover:text-white">
                      Visa Aprobada
                    </p>
                    <p className="text-xs text-brand-charcoal/60 group-hover:text-white/80 mt-1">
                      Marca el caso al 100% y suma +1 a tus KPIs de Visas Aprobadas.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => executeStageChange("rejected")}
                  className="group flex flex-col items-start justify-between rounded-2xl border-2 border-brand-red/30 bg-brand-red/[0.04] hover:bg-brand-red hover:border-brand-red p-5 text-left transition-all"
                >
                  <XCircle className="h-7 w-7 text-brand-red group-hover:text-white mb-3 transition-colors" />
                  <div>
                    <p className="font-display text-base font-bold text-brand-charcoal group-hover:text-white">
                      Visa Rechazada
                    </p>
                    <p className="text-xs text-brand-charcoal/60 group-hover:text-white/80 mt-1">
                      Cierra el expediente como denegado y actualiza las métricas de rechazo.
                    </p>
                  </div>
                </button>
              </div>

              <div className="flex justify-end pt-2 border-t border-brand-platinum">
                <button
                  type="button"
                  onClick={() => setShowResolutionModal(false)}
                  className="rounded-full px-5 py-2 text-xs font-semibold text-brand-charcoal/60 hover:bg-brand-platinum transition-colors"
                >
                  Cerrar sin cambios
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Barra Superior de Navegación */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard/admin?tab=mis-casos")}
            className="inline-flex items-center gap-2 rounded-full bg-brand-white border border-brand-charcoal/10 px-4 py-2 text-xs font-semibold text-brand-charcoal hover:bg-brand-platinum transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver a Mis Procesos</span>
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-brand-charcoal/60">
                Asesor asignado:
              </span>
              <select
                value={appData.assignedAdvisorId || ""}
                onChange={(e) => handleChangeAdvisor(e.target.value)}
                className="h-9 rounded-full bg-brand-white border border-brand-charcoal/15 px-3.5 text-xs font-bold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-red"
              >
                <option value="">⚠️ Sin Asignar (En Bolsa)</option>
                {staffList.map((s) => (
                  <option key={s.uid} value={s.uid}>
                    {formatDisplayName(s.fullName)} ({s.role === "admin" ? "Admin" : "Asesor"})
                  </option>
                ))}
              </select>
            </div>

            {/* Botón Separado y Elegante para Dictamen Final */}
            <button
              type="button"
              onClick={() => setShowResolutionModal(true)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-bold shadow-xs transition-all ${
                appData.status === "approved"
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : appData.status === "rejected"
                  ? "bg-brand-red text-white hover:bg-brand-red/90"
                  : "bg-brand-charcoal text-white hover:bg-brand-red"
              }`}
            >
              <Award className="h-3.5 w-3.5" />
              <span>
                {appData.status === "approved"
                  ? "Dictamen: Visa Aprobada (Cambiar)"
                  : appData.status === "rejected"
                  ? "Dictamen: Visa Rechazada (Cambiar)"
                  : "Emitir Dictamen Consular"}
              </span>
            </button>
          </div>
        </div>

        {/* Cabecera Ejecutiva del Expediente */}
        <div className="rounded-3xl bg-brand-charcoal p-7 sm:p-8 text-white shadow-xl space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-brand-red">
                  <Sparkles className="h-3 w-3" />
                  <span>Sincronización en Tiempo Real Activa</span>
                </span>
                <span className="rounded-full bg-white/10 px-3 py-1 text-[10px] font-bold uppercase text-white/80">
                  {appData.destination === "JAPAN" ? "🇯🇵 Japón" : "🇺🇸 Estados Unidos"} • Plan {appData.planTier || "Priority Pro"}
                </span>
                {isCaseClosed && (
                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase ${
                      appData.status === "approved"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : "bg-brand-red/30 text-red-200 border border-brand-red/50"
                    }`}
                  >
                    {appData.status === "approved"
                      ? "✅ Resolución: Visa Aprobada"
                      : "❌ Resolución: Visa Rechazada"}
                  </span>
                )}
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                {appData.formData?.fullName || appData.clientName || "Cliente Titular"}
              </h2>
              <p className="text-xs text-white/65">
                Correo: <strong className="text-white">{appData.clientEmail}</strong> • Teléfono:{" "}
                <strong className="text-white">
                  {appData.formData?.mobilePhone || "Pendiente"}
                </strong>{" "}
                • Cédula:{" "}
                <strong className="text-white">
                  {appData.formData?.nationalId || "Pendiente"}
                </strong>
              </p>
            </div>

            <div className="rounded-2xl bg-white/[0.06] p-4 border border-white/10 text-center min-w-[160px] shrink-0">
              <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
                Avance Automático
              </p>
              <p className="font-display text-3xl font-bold text-brand-red mt-1">
                {autoMetrics.progressPercentage}%
              </p>
              <p className="text-[11px] text-white/60 mt-0.5">
                Paso {autoMetrics.currentStep} de 4
              </p>
            </div>
          </div>

          {/* Stepper Horizontal Limpio de 4 Etapas Operativas */}
          <div className="pt-4 border-t border-white/10 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/45">
                Flujo de Etapas del Trámite (4 Pasos)
              </p>
              <span className="text-[10px] text-white/45">
                Retroceder una etapa solicita confirmación de seguridad
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              {PROCESS_STAGES.map((st) => {
                const isCurrent =
                  appData.status === st.id ||
                  (!isCaseClosed && autoMetrics.currentStep === st.order);
                const isCompleted =
                  isCaseClosed || autoMetrics.currentStep > st.order;

                return (
                  <button
                    key={st.id}
                    type="button"
                    onClick={() => handleStageClick(st.id)}
                    className={`flex flex-col items-start rounded-2xl p-4 border text-left transition-all ${
                      isCurrent
                        ? "bg-white text-brand-charcoal border-white shadow-lg"
                        : isCompleted
                        ? "bg-emerald-500/15 border-emerald-500/35 text-white hover:bg-emerald-500/25"
                        : "bg-white/[0.04] border-white/10 text-white/65 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs font-bold leading-tight">
                        {st.label}
                      </span>
                      {isCompleted && !isCurrent && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      )}
                    </div>
                    <span
                      className={`text-[11px] mt-1 ${
                        isCurrent ? "text-brand-charcoal/65" : "text-white/55"
                      }`}
                    >
                      {st.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {feedback && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-3 rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 text-xs font-semibold text-brand-red">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Banner de Decomisionamiento PII cuando el caso está cerrado */}
        {isCaseClosed &&
          !appData.isDecommissioned &&
          profile?.role === "admin" && (
            <div className="rounded-2xl bg-amber-500/10 border border-amber-500/30 p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <p className="text-xs font-bold text-amber-950 uppercase tracking-wide flex items-center gap-2">
                  <ArchiveRestore className="h-4 w-4 text-amber-700" />
                  <span>Decomisionamiento Seguro de Información (FinOps & PII)</span>
                </p>
                <p className="text-xs text-amber-900/80 leading-relaxed max-w-2xl">
                  Este trámite ya concluyó ({appData.status.toUpperCase()}). Puedes purgar los PDFs pesados de Storage y los datos sensibles dejando intacta la estadística en tus KPIs.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDecommissionCase}
                disabled={decommissioning}
                className="shrink-0 inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-red transition-all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {decommissioning ? "Purgando PII..." : "Purgar PII y Archivar"}
                </span>
              </button>
            </div>
          )}

        {/* Selector de Pestañas del Workspace */}
        <div className="flex flex-wrap items-center gap-2 border-b border-brand-charcoal/10 pb-3">
          {[
            {
              id: "cuestionario",
              label: "1. Cuestionario Estratégico",
              icon: FileText,
              semaforo: autoMetrics.formSemaphore,
            },
            {
              id: "boveda",
              label: `2. Bóveda de Documentos (${docsArray.length})`,
              icon: FolderLock,
              semaforo: autoMetrics.vaultSemaphore,
            },
            {
              id: "meetings",
              label: `3. Registrar Meetings & Entregables (${meetingsArray.length})`,
              icon: Calendar,
              semaforo: autoMetrics.consularSemaphore,
            },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeWorkspaceTab === tab.id;
            const dotColor =
              tab.semaforo === "completed"
                ? "bg-emerald-500"
                : tab.semaforo === "in_progress"
                ? "bg-amber-500"
                : "bg-brand-red";
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveWorkspaceTab(tab.id as any)}
                className={`inline-flex items-center gap-2.5 rounded-full px-5 py-2.5 text-xs font-bold transition-all ${
                  active
                    ? "bg-brand-charcoal text-white shadow-sm"
                    : "bg-brand-white text-brand-charcoal/70 border border-brand-charcoal/10 hover:bg-brand-platinum"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
                <span className={`h-2 w-2 rounded-full ${dotColor}`} />
              </button>
            );
          })}
        </div>

        {/* TAB 1: RESPUESTAS DEL CUESTIONARIO ESTRATÉGICO */}
        {activeWorkspaceTab === "cuestionario" && (
          <div className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-brand-charcoal">
                  Información Diligenciada por el Cliente (En Vivo)
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  Cualquier cambio que el cliente guarde en su formulario se refleja aquí automáticamente. Haz clic en una tarjeta para copiar su contenido.
                </p>
              </div>
            </div>

            {!appData.formData ? (
              <div className="py-12 text-center space-y-2">
                <Clock className="h-8 w-8 text-brand-red mx-auto" />
                <p className="text-sm font-bold text-brand-charcoal">
                  El cliente aún no ha guardado respuestas en su Cuestionario Estratégico.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { label: "Nombre Completo (Pasaporte)", val: appData.formData.fullName },
                  { label: "No. de Cédula / ID Nacional", val: appData.formData.nationalId },
                  { label: "Estado Civil", val: appData.formData.maritalStatus },
                  { label: "Teléfono Móvil (WhatsApp)", val: appData.formData.mobilePhone },
                  { label: "Ciudad y Departamento", val: appData.formData.cityAndState },
                  { label: "Dirección de Domicilio", val: appData.formData.homeAddress },
                  { label: "Fecha Probable de Entrada", val: appData.formData.estimatedArrivalDate },
                  { label: "Días Previstos de Estancia", val: appData.formData.stayDurationDays },
                  { label: "¿Quién costea el viaje?", val: appData.formData.tripFinancier },
                  { label: "Ocupación o Cargo Actual", val: appData.formData.currentOccupation },
                  { label: "Empresa o Empleador Actual", val: appData.formData.companyOrEmployerName },
                  { label: "Ingreso Mensual Aproximado", val: appData.formData.monthlyIncomeLocal },
                  ...(appData.destination === "JAPAN"
                    ? [
                        {
                          label: "Ocupación de Pareja o Padres (Japón Pág. 2)",
                          val: appData.formData.partnerOrParentsOccupation,
                        },
                        {
                          label: "Ciudades a Visitar (Schedule of Stay)",
                          val: appData.formData.japanCitiesToVisit,
                        },
                        {
                          label: "Aeropuerto de Entrada (Japón)",
                          val: appData.formData.japanPortOfEntry,
                        },
                        {
                          label: "Aerolínea Proyectada",
                          val: appData.formData.japanAirlineOrFlight,
                        },
                        {
                          label: "Visitas Previas a Japón",
                          val: appData.formData.previousStayInJapan,
                        },
                        {
                          label: "Garante / Invitante en Japón",
                          val:
                            appData.formData.hasGuarantorInJapan === "yes"
                              ? `Sí: ${appData.formData.guarantorDetails}`
                              : "No (Turismo independiente)",
                        },
                      ]
                    : [
                        {
                          label: "Nombres y Fechas de Nacimiento de Padres (DS-160)",
                          val: appData.formData.parentsFullNamesAndDob,
                        },
                        {
                          label: "Redes Sociales Públicas (@usuario)",
                          val: appData.formData.socialMediaHandles,
                        },
                        {
                          label: "Resumen Empleos (5 años) y Universidad",
                          val: appData.formData.previousJobsAndEducationSummary,
                        },
                        {
                          label: "Familiares en EE. UU.",
                          val: appData.formData.hasRelativesInUS === "yes" ? "Sí" : "No",
                        },
                        {
                          label: "Rechazos de Visa Previos",
                          val: appData.formData.hasPreviousVisaRefusal === "yes" ? "Sí" : "No",
                        },
                      ]),
                ].map((item) => (
                  <div
                    key={item.label}
                    onClick={() => handleCopyText(item.label, item.val)}
                    className="group cursor-pointer rounded-2xl bg-brand-platinum/40 hover:bg-brand-platinum/80 p-4 border border-brand-platinum flex items-start justify-between gap-3 transition-all"
                  >
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-brand-charcoal/55 block">
                        {item.label}
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-brand-charcoal break-words">
                        {item.val || "---"}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-brand-white p-2 text-brand-charcoal/50 group-hover:text-brand-red shadow-2xs">
                      {copiedField === item.label ? (
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: BÓVEDA DE DOCUMENTOS */}
        {activeWorkspaceTab === "boveda" && (
          <div className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-brand-charcoal">
                  Soportes Cargados en la Bóveda Criptográfica ({docsArray.length})
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  Revisa los PDFs del cliente para extraer datos de pasaporte y carta laboral, y márcalos como Verificados.
                </p>
              </div>
            </div>

            {docsArray.length === 0 ? (
              <div className="py-12 text-center space-y-2">
                <FolderLock className="h-8 w-8 text-brand-red mx-auto" />
                <p className="text-sm font-bold text-brand-charcoal">
                  El cliente aún no ha subido archivos a su Bóveda.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {docsArray.map((docItem) => (
                  <div
                    key={docItem.docId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-brand-platinum/30 p-5 border border-brand-platinum"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-brand-charcoal">
                          {docItem.title}
                        </p>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                            docItem.status === "verified"
                              ? "bg-emerald-500/15 text-emerald-700"
                              : docItem.status === "rejected"
                              ? "bg-brand-red/15 text-brand-red"
                              : "bg-amber-500/15 text-amber-800"
                          }`}
                        >
                          {docItem.status === "verified"
                            ? "Verificado"
                            : docItem.status === "rejected"
                            ? "Observado"
                            : "En Revisión"}
                        </span>
                      </div>
                      <p className="text-xs text-brand-charcoal/60">
                        Archivo: <strong>{docItem.fileName}</strong> •{" "}
                        {(docItem.fileSize / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <a
                        href={docItem.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red transition-colors"
                      >
                        <span>Abrir Archivo</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() =>
                          handleVerifyDocument(docItem.docId, "verified")
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2 text-xs font-bold text-emerald-800 hover:bg-emerald-500/25 transition-colors"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Verificar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          handleVerifyDocument(docItem.docId, "rejected")
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-brand-red/10 border border-brand-red/25 px-3.5 py-2 text-xs font-bold text-brand-red hover:bg-brand-red/20 transition-colors"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Observar</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REGISTRAR MEETINGS, NOTAS Y SUBIR ATTACHMENTS */}
        {activeWorkspaceTab === "meetings" && (
          <div className="space-y-6">
            <form
              onSubmit={handleAddMeeting}
              className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-5"
            >
              <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
                <Calendar className="h-5 w-5 text-brand-red" />
                <div>
                  <h3 className="font-display text-base font-bold text-brand-charcoal">
                    Registrar Meeting, Simulacro o Entregable Oficial
                  </h3>
                  <p className="text-xs text-brand-charcoal/55">
                    Deja constancia de la fecha en que se realizó la sesión, las notas estratégicas y adjunta documentos listos (confirmación DS-160, Schedule of Stay, etc.).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Fecha del Meeting *
                  </label>
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                    className={inputBaseClass}
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Título de la Sesión o Entregable *
                  </label>
                  <input
                    type="text"
                    required
                    value={meetingTitle}
                    onChange={(e) => setMeetingTitle(e.target.value)}
                    placeholder="Ej. Simulacro Consular 1-a-1 y Entrega de Hoja de Confirmación DS-160"
                    className={inputBaseClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Notas de la Reunión / Dictamen para el Cliente *
                </label>
                <textarea
                  rows={3}
                  required
                  value={meetingNotes}
                  onChange={(e) => setMeetingNotes(e.target.value)}
                  placeholder="Escribe aquí los puntos tratados, fortalezas del perfil, recomendaciones para la ventanilla consular y acuerdos..."
                  className="w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 p-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-brand-platinum">
                <label className="cursor-pointer inline-flex items-center gap-2.5 rounded-xl border border-dashed border-brand-red/40 bg-brand-red/[0.02] px-4 py-2.5 text-xs font-semibold text-brand-charcoal hover:bg-brand-red/[0.06] transition-all">
                  <Paperclip className="h-4 w-4 text-brand-red" />
                  <span className="truncate max-w-xs">
                    {meetingFile
                      ? `📎 ${meetingFile.name}`
                      : "Adjuntar Archivo / Attachment (PDF, Imagen — Opcional)"}
                  </span>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    className="hidden"
                    onChange={(e) =>
                      setMeetingFile(e.target.files?.[0] || null)
                    }
                  />
                </label>

                <button
                  type="submit"
                  disabled={savingMeeting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-7 py-3 text-xs font-semibold text-brand-white shadow-md shadow-brand-red/20 hover:bg-brand-red/90 disabled:opacity-50 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    {savingMeeting
                      ? "Guardando Meeting..."
                      : "Guardar Registro de Meeting"}
                  </span>
                </button>
              </div>
            </form>

            <div className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-4">
              <h4 className="font-display text-base font-bold text-brand-charcoal">
                Bitácora de Meetings y Archivos Adjuntos ({meetingsArray.length})
              </h4>

              {meetingsArray.length === 0 ? (
                <p className="text-xs text-brand-charcoal/50 py-4">
                  Aún no se han registrado reuniones ni entregables en este caso.
                </p>
              ) : (
                <div className="space-y-3">
                  {meetingsArray.map((mtg) => (
                    <div
                      key={mtg.id}
                      className="rounded-2xl bg-brand-platinum/30 p-5 border border-brand-platinum space-y-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="rounded-full bg-brand-charcoal px-3 py-0.5 text-[10px] font-bold text-white">
                            📅 {mtg.date}
                          </span>
                          <span className="text-xs font-bold text-brand-charcoal">
                            {mtg.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-brand-charcoal/55">
                            Registrado por:{" "}
                            <strong>{formatDisplayName(mtg.advisorName)}</strong>
                          </span>
                          <button
                            type="button"
                            onClick={() => handleDeleteMeeting(mtg.id)}
                            className="text-brand-charcoal/40 hover:text-brand-red transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <p className="text-xs text-brand-charcoal/75 leading-relaxed whitespace-pre-line bg-brand-white p-3.5 rounded-xl border border-brand-platinum">
                        {mtg.notes}
                      </p>

                      {mtg.attachmentUrl && (
                        <div className="pt-1">
                          <a
                            href={mtg.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 rounded-full bg-brand-red/10 px-4 py-1.5 text-xs font-bold text-brand-red hover:bg-brand-red hover:text-white transition-all"
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            <span>
                              Ver Attachment:{" "}
                              {mtg.attachmentName || "Documento Adjunto"}
                            </span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}