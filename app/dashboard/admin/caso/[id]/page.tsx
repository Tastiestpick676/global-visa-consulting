// app/dashboard/admin/caso/[id]/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
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
  OfficialDeliverableItem,
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
  RotateCcw,
  FileCheck2,
  UploadCloud,
  ShieldAlert,
  ArrowRightCircle,
  X,
} from "lucide-react";

const inputBaseClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 px-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

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

interface StageTransitionPrompt {
  targetStatus: ApplicationStatus;
  targetLabel: string;
  direction: "forward" | "backward";
  blockingErrors: string[];
  warnings: string[];
}

function CaseWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const { profile } = useAuth();
  const caseId = params?.id as string;

  const [appData, setAppData] = useState<VisaApplication | null>(null);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [activeWorkspaceTab, setActiveWorkspaceTab] = useState<
    "cuestionario" | "boveda" | "entregables" | "meetings"
  >("cuestionario");
  const [loading, setLoading] = useState(true);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [transitionPrompt, setTransitionPrompt] =
    useState<StageTransitionPrompt | null>(null);
  const [showResolutionModal, setShowResolutionModal] = useState(false);

  const [delivTitle, setDelivTitle] = useState("");
  const [delivCategory, setDelivCategory] = useState<
    OfficialDeliverableItem["category"]
  >("Confirmación DS-160");
  const [delivFile, setDelivFile] = useState<File | null>(null);
  const [uploadingDeliv, setUploadingDeliv] = useState(false);

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

  // 1. Limpiar alertas al cambiar de pestaña dentro del Workspace
  useEffect(() => {
    setFeedback("");
    setErrorMsg("");
  }, [activeWorkspaceTab]);

  // 2. Auto-ocultar las alertas después de 5 segundos
  useEffect(() => {
    if (!feedback && !errorMsg) return;
    const timer = setTimeout(() => {
      setFeedback("");
      setErrorMsg("");
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedback, errorMsg]);

  useEffect(() => {
    if (!isStaff || !caseId) return;

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

  const evaluateStageTransition = (targetStatus: ApplicationStatus) => {
    if (!appData || appData.status === targetStatus) return;

    const currentMetrics = calculateApplicationMetrics(appData);
    const currentOrder = getStageOrder(appData.status);
    const targetOrder = getStageOrder(targetStatus);
    const direction: "forward" | "backward" =
      targetOrder < currentOrder ? "backward" : "forward";

    const stageObj = PROCESS_STAGES.find((s) => s.id === targetStatus);
    const targetLabel =
      stageObj?.label ||
      (targetStatus === "approved"
        ? "Visa Aprobada"
        : targetStatus === "rejected"
        ? "Visa Rechazada"
        : targetStatus);

    const blockingErrors: string[] = [];
    const warnings: string[] = [];

    const fd = appData.formData;
    const isFormComplete = Boolean(
      fd &&
        fd.fullName &&
        fd.nationalId &&
        fd.mobilePhone &&
        fd.homeAddress &&
        fd.currentOccupation &&
        fd.estimatedArrivalDate
    );

    const docsMap = appData.documents || {};
    const docsList = Object.values(docsMap);
    const hasPassport = Boolean(docsMap["passport"]);
    const hasPhoto = Boolean(docsMap["photo_us"] || docsMap["photo_jp"]);
    const unverifiedDocsCount = docsList.filter(
      (d) => d.status !== "verified"
    ).length;
    const deliverablesCount = appData.officialDeliverables?.length || 0;
    const meetingsCount = appData.meetings?.length || 0;

    if (direction === "forward") {
      if (targetOrder >= 2 && !isFormComplete) {
        blockingErrors.push(
          "Obligatorio: El cliente aún no ha completado los campos requeridos del Cuestionario Estratégico (Nombre, Cédula, Teléfono, Dirección, Ocupación y Fecha de viaje)."
        );
      }

      if (targetOrder >= 3) {
        if (!hasPassport) {
          blockingErrors.push(
            "Obligatorio: El cliente no ha subido su Pasaporte Vigente en la Bóveda de Documentos."
          );
        }
        if (!hasPhoto) {
          warnings.push(
            "El cliente aún no ha cargado la Fotografía Digital tipo visado en su Bóveda."
          );
        }
        if (docsList.length < 3) {
          warnings.push(
            `Solo se han subido ${docsList.length} documentos en la Bóveda (se recomiendan mínimo 3 soportes).`
          );
        }
      }

      if (targetOrder >= 4) {
        if (unverifiedDocsCount > 0) {
          warnings.push(
            `Hay ${unverifiedDocsCount} documento(s) en la Bóveda que aún no han sido marcados como "Verificados" por el asesor.`
          );
        }
        if (deliverablesCount === 0) {
          warnings.push(
            "Aún no has subido ningún Entregable Oficial (ej. Confirmación DS-160 o Formato Japonés) al perfil del cliente."
          );
        }
        if (meetingsCount === 0) {
          warnings.push(
            "No se ha registrado ninguna sesión en la Bitácora de Meetings."
          );
        }
      }
    } else {
      warnings.push(
        `El expediente ya se encontraba en una fase más avanzada (Paso ${currentMetrics.currentStep} de 4). Al retroceder a "${targetLabel}", el porcentaje del cliente se ajustará hacia atrás.`
      );
      if (isFormComplete && targetStatus === "onboarding_pending") {
        warnings.push(
          "El cliente ya había completado su Cuestionario Estratégico."
        );
      }
    }

    setShowResolutionModal(false);
    setTransitionPrompt({
      targetStatus,
      targetLabel,
      direction,
      blockingErrors,
      warnings,
    });
  };

  const executeStageChange = async (newStatus: ApplicationStatus) => {
    if (!appData) return;
    setFeedback("");
    setErrorMsg("");
    setTransitionPrompt(null);
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
        `Etapa actualizada a "${newStatus.toUpperCase()}". Sincronizado en tiempo real con el portal del cliente (${metrics.progressPercentage}%).`
      );
    } catch {
      setErrorMsg("No se pudo actualizar la etapa del caso.");
    }
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

  const handleUploadOfficialDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appData || !delivFile) return;
    setUploadingDeliv(true);
    setFeedback("");
    setErrorMsg("");

    try {
      const safeName = delivFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `vault/${appData.id}/deliverables/${Date.now()}_${safeName}`;
      const fileRef = ref(storage, storagePath);

      await uploadBytes(fileRef, delivFile);
      const fileUrl = await getDownloadURL(fileRef);

      const newDeliv: OfficialDeliverableItem = {
        id: `deliv_${Date.now()}`,
        title: delivTitle.trim() || delivCategory,
        category: delivCategory,
        fileName: delivFile.name,
        fileUrl,
        storagePath,
        fileSize: delivFile.size,
        uploadedBy: formatDisplayName(profile?.fullName) || "Equipo Legal",
        uploadedAt: new Date().toISOString(),
      };

      const updatedList = [newDeliv, ...(appData.officialDeliverables || [])];

      await updateDoc(doc(db, "applications", appData.id), {
        officialDeliverables: updatedList,
        consularSession: {
          ...(appData.consularSession || {}),
          officialDeliverableTitle: newDeliv.title,
          officialDeliverableUrl: newDeliv.fileUrl,
        },
        updatedAt: new Date().toISOString(),
      });

      setDelivTitle("");
      setDelivFile(null);
      setFeedback(
        `¡Documento "${newDeliv.title}" subido al perfil del cliente!`
      );
    } catch {
      setErrorMsg("No se pudo subir el documento oficial a Firebase Storage.");
    } finally {
      setUploadingDeliv(false);
    }
  };

  const handleDeleteOfficialDeliverable = async (
    item: OfficialDeliverableItem
  ) => {
    if (!appData) return;
    try {
      if (item.storagePath) {
        try {
          await deleteObject(ref(storage, item.storagePath));
        } catch {}
      }
      const updatedList = (appData.officialDeliverables || []).filter(
        (d) => d.id !== item.id
      );
      await updateDoc(doc(db, "applications", appData.id), {
        officialDeliverables: updatedList,
        updatedAt: new Date().toISOString(),
      });
      setFeedback("Documento oficial eliminado del perfil del cliente.");
    } catch {
      setErrorMsg("No se pudo eliminar el entregable.");
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
        advisorName:
          formatDisplayName(profile?.fullName) || "Especialista Legal",
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

      await updateDoc(doc(db, "applications", appData.id), {
        meetings: updatedMeetings,
        progressPercentage: metrics.progressPercentage,
        currentStep: metrics.currentStep,
        updatedAt: new Date().toISOString(),
      });

      setMeetingTitle("");
      setMeetingNotes("");
      setMeetingFile(null);
      setFeedback("¡Meeting registrado con éxito!");
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
      if (appData.officialDeliverables) {
        for (const deliv of appData.officialDeliverables) {
          if (deliv.storagePath) {
            try {
              await deleteObject(ref(storage, deliv.storagePath));
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
        officialDeliverables: deleteField(),
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
      <div className="py-20 text-center text-xs text-brand-charcoal/50">
        Abriendo Mesa de Trabajo del Expediente...
      </div>
    );
  }

  if (!appData) {
    return (
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
    );
  }

  const autoMetrics = calculateApplicationMetrics(appData);
  const docsArray = appData.documents ? Object.values(appData.documents) : [];
  const deliverablesArray = appData.officialDeliverables || [];
  const meetingsArray = appData.meetings || [];
  const isCaseClosed =
    appData.status === "approved" || appData.status === "rejected";

  return (
    <div className="max-w-5xl mx-auto space-y-6 font-sans">
      {/* MODAL UNIFICADO DE VALIDACIÓN Y DOBLE CONFIRMACIÓN */}
      {transitionPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-3xl bg-brand-white p-7 border border-brand-charcoal/10 shadow-2xl space-y-5">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${
                  transitionPrompt.blockingErrors.length > 0
                    ? "bg-brand-red/15 text-brand-red"
                    : transitionPrompt.direction === "backward"
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-emerald-500/15 text-emerald-600"
                }`}
              >
                {transitionPrompt.blockingErrors.length > 0 ? (
                  <ShieldAlert className="h-5 w-5" />
                ) : transitionPrompt.direction === "backward" ? (
                  <RotateCcw className="h-5 w-5" />
                ) : (
                  <ArrowRightCircle className="h-5 w-5" />
                )}
              </div>
              <div>
                <h3 className="font-display text-lg font-bold text-brand-charcoal">
                  {transitionPrompt.blockingErrors.length > 0
                    ? "Cambio Bloqueado: Faltan Requisitos Obligatorios"
                    : transitionPrompt.direction === "backward"
                    ? `Confirmar Retroceso a ${transitionPrompt.targetLabel}`
                    : `Confirmar Avance a ${transitionPrompt.targetLabel}`}
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  Control de calidad y gobernanza de procesos migratorios
                </p>
              </div>
            </div>

            {transitionPrompt.blockingErrors.length > 0 ? (
              <div className="space-y-3">
                <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                  No es posible mover el expediente de{" "}
                  <strong>
                    {formatDisplayName(appData.formData?.fullName || appData.clientName)}
                  </strong>{" "}
                  a <strong>{transitionPrompt.targetLabel}</strong> porque aún no cumple con los siguientes requisitos obligatorios:
                </p>
                <div className="space-y-2">
                  {transitionPrompt.blockingErrors.map((err, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl bg-brand-red/10 border border-brand-red/25 p-3.5 text-xs font-semibold text-brand-red"
                    >
                      <XCircle className="h-4 w-4 shrink-0 mt-0.5" />
                      <span>{err}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-xs sm:text-sm text-brand-charcoal/75 leading-relaxed">
                  ¿Confirmas cambiar el estado del expediente de{" "}
                  <strong>
                    {formatDisplayName(appData.formData?.fullName || appData.clientName)}
                  </strong>{" "}
                  a{" "}
                  <strong className="text-brand-charcoal">
                    {transitionPrompt.targetLabel}
                  </strong>
                  ?
                </p>

                {transitionPrompt.warnings.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-amber-800">
                      Observaciones detectadas antes de cambiar el estado:
                    </p>
                    {transitionPrompt.warnings.map((warn, i) => (
                      <div
                        key={i}
                        className="flex items-start gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-950"
                      >
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>{warn}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-brand-platinum">
              <button
                type="button"
                onClick={() => setTransitionPrompt(null)}
                className="rounded-full px-5 py-2.5 text-xs font-semibold text-brand-charcoal/70 hover:bg-brand-platinum transition-colors"
              >
                {transitionPrompt.blockingErrors.length > 0
                  ? "Entendido, volver al caso"
                  : "Cancelar"}
              </button>

              {transitionPrompt.blockingErrors.length === 0 && (
                <button
                  type="button"
                  onClick={() =>
                    executeStageChange(transitionPrompt.targetStatus)
                  }
                  className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-6 py-2.5 text-xs font-semibold text-white shadow-md hover:bg-brand-red/90 transition-all"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  <span>Sí, Confirmar Cambio de Estado</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE DICTAMEN CONSULAR FINAL */}
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
                onClick={() => evaluateStageTransition("approved")}
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
                onClick={() => evaluateStageTransition("rejected")}
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

      {/* Barra Superior */}
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

      {/* Cabecera Ejecutiva */}
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
              {formatDisplayName(appData.formData?.fullName || appData.clientName) || "Cliente Titular"}
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
              Valida requisitos obligatorios al avanzar o retroceder
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
                  onClick={() => evaluateStageTransition(st.id)}
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
        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-700">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback("")}
            className="rounded-lg p-1 text-emerald-700/60 hover:bg-emerald-500/20 hover:text-emerald-900 transition-colors"
            aria-label="Cerrar alerta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 text-xs font-semibold text-brand-red">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg("")}
            className="rounded-lg p-1 text-brand-red/60 hover:bg-brand-red/20 hover:text-brand-red transition-colors"
            aria-label="Cerrar alerta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Banner de Decomisionamiento PII */}
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

      {/* Selector de 4 Pestañas del Workspace */}
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
            label: `2. Bóveda del Cliente (${docsArray.length})`,
            icon: FolderLock,
            semaforo: autoMetrics.vaultSemaphore,
          },
          {
            id: "entregables",
            label: `3. Subir DS-160 / Confirmaciones al Perfil (${deliverablesArray.length})`,
            icon: FileCheck2,
            semaforo:
              deliverablesArray.length > 0 ? "completed" : "in_progress",
          },
          {
            id: "meetings",
            label: `4. Bitácora de Meetings (${meetingsArray.length})`,
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
                Soportes Cargados por el Cliente ({docsArray.length})
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

      {/* TAB 3: SUBIR ENTREGABLES OFICIALES AL PERFIL DEL CLIENTE */}
      {activeWorkspaceTab === "entregables" && (
        <div className="space-y-6">
          <form
            onSubmit={handleUploadOfficialDeliverable}
            className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-5"
          >
            <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
              <FileCheck2 className="h-5 w-5 text-brand-red" />
              <div>
                <h3 className="font-display text-base font-bold text-brand-charcoal">
                  Subir Documentos Oficiales al Perfil del Cliente (DS-160, Confirmaciones, Itinerarios)
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  Los archivos que cargues aquí aparecerán automáticamente en el widget de <strong>&ldquo;Documentos y Archivos de tu Proceso&rdquo;</strong> dentro del Perfil y la Sala Consular del cliente.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Tipo de Documento Oficial *
                </label>
                <select
                  value={delivCategory}
                  onChange={(e) => setDelivCategory(e.target.value as any)}
                  className={inputBaseClass}
                >
                  <option value="Confirmación DS-160">
                    🇺🇸 Hoja de Confirmación DS-160 Oficial
                  </option>
                  <option value="Cita Consular / CAS">
                    📅 Confirmación de Cita Consular / CAS
                  </option>
                  <option value="Formulario Embajada Japón">
                    🇯🇵 Formulario Oficial de Visado Japonés
                  </option>
                  <option value="Schedule of Stay (Itinerario)">
                    🗾 Schedule of Stay (Programa de Estancia Japón)
                  </option>
                  <option value="Otro Documento Oficial">
                    📄 Otro Documento / Carta de Garantía
                  </option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Título Personalizado (Opcional)
                </label>
                <input
                  type="text"
                  value={delivTitle}
                  onChange={(e) => setDelivTitle(e.target.value)}
                  placeholder="Ej. Confirmación DS-160 Lista para Imprimir — Luz Rangel"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-brand-platinum">
              <label className="cursor-pointer inline-flex items-center gap-2.5 rounded-xl border border-dashed border-brand-red/40 bg-brand-red/[0.02] px-4 py-3 text-xs font-semibold text-brand-charcoal hover:bg-brand-red/[0.06] transition-all">
                <UploadCloud className="h-4 w-4 text-brand-red" />
                <span className="truncate max-w-xs">
                  {delivFile
                    ? `📄 ${delivFile.name}`
                    : "Seleccionar PDF o Imagen Oficial desde tu computador *"}
                </span>
                <input
                  type="file"
                  required
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setDelivFile(e.target.files?.[0] || null)}
                />
              </label>

              <button
                type="submit"
                disabled={uploadingDeliv || !delivFile}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-7 py-3 text-xs font-semibold text-brand-white shadow-md shadow-brand-red/20 hover:bg-brand-red/90 disabled:opacity-50 transition-all"
              >
                <UploadCloud className="h-4 w-4" />
                <span>
                  {uploadingDeliv
                    ? "Subiendo al Perfil..."
                    : "Publicar en el Perfil del Cliente"}
                </span>
              </button>
            </div>
          </form>

          <div className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-4">
            <h4 className="font-display text-base font-bold text-brand-charcoal">
              Documentos Oficiales Activos en el Perfil de este Cliente ({deliverablesArray.length})
            </h4>

            {deliverablesArray.length === 0 ? (
              <p className="text-xs text-brand-charcoal/50 py-4">
                Aún no has cargado confirmaciones ni formularios oficiales al perfil de este cliente.
              </p>
            ) : (
              <div className="space-y-3">
                {deliverablesArray.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-brand-platinum/30 p-4 border border-brand-platinum"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-brand-charcoal px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">
                          {item.category}
                        </span>
                        <p className="text-xs font-bold text-brand-charcoal">
                          {item.title}
                        </p>
                      </div>
                      <p className="text-[11px] text-brand-charcoal/55">
                        Archivo: {item.fileName} • Subido por {item.uploadedBy}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red transition-colors"
                      >
                        <span>Ver / Descargar</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteOfficialDeliverable(item)}
                        className="p-2 text-brand-charcoal/40 hover:text-brand-red transition-colors"
                        title="Eliminar archivo"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: REGISTRAR MEETINGS, NOTAS Y SUBIR ATTACHMENTS */}
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
                  Registrar Meeting o Simulacro Consular
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  Deja constancia de la fecha en que se realizó la sesión, las notas estratégicas y acuerdos con el cliente.
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
                  Título de la Sesión *
                </label>
                <input
                  type="text"
                  required
                  value={meetingTitle}
                  onChange={(e) => setMeetingTitle(e.target.value)}
                  placeholder="Ej. Simulacro Consular 1-a-1 y Revisión de Arraigo"
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
                placeholder="Escribe aquí los puntos tratados, fortalezas del perfil y recomendaciones para la ventanilla consular..."
                className="w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 p-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all"
              />
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-brand-platinum">
              <label className="cursor-pointer inline-flex items-center gap-2.5 rounded-xl border border-dashed border-brand-red/40 bg-brand-red/[0.02] px-4 py-2.5 text-xs font-semibold text-brand-charcoal hover:bg-brand-red/[0.06] transition-all">
                <Paperclip className="h-4 w-4 text-brand-red" />
                <span className="truncate max-w-xs">
                  {meetingFile
                    ? `📎 ${meetingFile.name}`
                    : "Adjuntar Archivo de la Reunión (Opcional)"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  className="hidden"
                  onChange={(e) => setMeetingFile(e.target.files?.[0] || null)}
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
              Bitácora de Meetings ({meetingsArray.length})
            </h4>

            {meetingsArray.length === 0 ? (
              <p className="text-xs text-brand-charcoal/50 py-4">
                Aún no se han registrado reuniones en este caso.
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
  );
}

export default function CaseWorkspacePage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="py-20 text-center text-xs text-brand-charcoal/50">
            Cargando Workspace del Caso...
          </div>
        }
      >
        <CaseWorkspaceContent />
      </Suspense>
    </DashboardLayout>
  );
}