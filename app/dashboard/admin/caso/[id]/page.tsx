// app/dashboard/admin/caso/[id]/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  DashboardLayout,
  DashboardContentSkeleton,
} from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  ApplicationStatus,
  OfficialDeliverableItem,
  ScheduledMeetingItem,
  UserProfile,
  VaultDocumentItem,
  VisaApplication,
} from "@/types/visa";
import {
  buildAuditLogEntry,
  calculateApplicationMetrics,
  downloadMeetingIcs,
  formatDisplayName,
  getDefaultDocumentsByDestination,
  getGoogleCalendarUrl,
  recordSystemLog,
  sendInternalNotification,
  sendTransactionalEmail,
} from "@/lib/firebase/db";
import {
  ArrowLeft,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  Lock,
  UploadCloud,
  Video,
  Trash2,
  ExternalLink,
  FolderLock,
  FileText,
  Calendar,
  CalendarPlus,
  AlertCircle,
  UserCheck,
  Mail,
  Clock,
  History,
  X,
} from "lucide-react";

const inputClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 px-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none transition-all";

function maskSensitiveValue(raw?: string): string {
  if (!raw || raw.trim().length === 0) return "Pendiente";
  const clean = raw.trim();
  if (clean.length <= 4) return "****";
  return `${"•".repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

function AdminCaseWorkspaceContent() {
  const params = useParams();
  const router = useRouter();
  const caseId = String(params?.id || "");
  const { profile } = useAuth();

  const [appData, setAppData] = useState<VisaApplication | null>(null);
  const [staffList, setStaffList] = useState<UserProfile[]>([]);
  const [loadingCase, setLoadingCase] = useState(true);

  // Estado de enmascaramiento y datos descargados bajo demanda desde la subcolección private_pii/vault
  const [piiRevealed, setPiiRevealed] = useState(false);
  const [unmaskedVaultPii, setUnmaskedVaultPii] = useState<{
    nationalId?: string;
    passportNumber?: string;
    monthlyIncomeCop?: string;
    mobilePhone?: string;
  } | null>(null);

  const [previewVaultDoc, setPreviewVaultDoc] =
    useState<VaultDocumentItem | null>(null);

  const [docFeedbackMap, setDocFeedbackMap] = useState<Record<string, string>>(
    {}
  );

  const [delivLabel, setDelivLabel] = useState("");
  const [delivFile, setDelivFile] = useState<File | null>(null);
  const [uploadingDeliv, setUploadingDeliv] = useState(false);

  const [meetTitle, setMeetTitle] = useState("");
  const [meetDateTime, setMeetDateTime] = useState("");
  const [meetUrl, setMeetUrl] = useState("");
  const [meetNotes, setMeetNotes] = useState("");
  const [savingMeet, setSavingMeet] = useState(false);

  const [purgingVault, setPurgingVault] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  const fetchCaseDetails = async () => {
    if (!caseId) return;
    setLoadingCase(true);
    try {
      const snap = await getDoc(doc(db, "applications", caseId));
      if (snap.exists()) {
        setAppData(snap.data() as VisaApplication);
      }

      const usersSnap = await getDocs(collection(db, "users"));
      const advisors: UserProfile[] = [];
      usersSnap.forEach((d) => {
        const u = d.data() as UserProfile;
        if (u.role === "admin" || u.role === "advisor") {
          advisors.push(u);
        }
      });
      setStaffList(advisors);
    } catch {
      setErrorMsg("No se pudo cargar el expediente del cliente.");
    } finally {
      setLoadingCase(false);
    }
  };

  useEffect(() => {
    if (isStaff && caseId) {
      fetchCaseDetails();
    }
  }, [isStaff, caseId]);

  useEffect(() => {
    if (!previewVaultDoc) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPreviewVaultDoc(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [previewVaultDoc]);

  const handleToggleRevealPii = async () => {
    if (!appData || !profile) return;
    const nextState = !piiRevealed;

    if (nextState && !unmaskedVaultPii) {
      try {
        const vaultSnap = await getDoc(
          doc(db, "applications", appData.id, "private_pii", "vault")
        );
        if (vaultSnap.exists()) {
          setUnmaskedVaultPii(vaultSnap.data());
        }
      } catch {}
    }

    setPiiRevealed(nextState);

    if (nextState) {
      const clientName = formatDisplayName(
        appData.formData?.fullName || appData.clientName || "Cliente"
      );
      await recordSystemLog({
        category: "PII_VAULT",
        eventType: "Acceso a Bóveda Subcolección PII (private_pii/vault)",
        outcome: "INFO",
        actorEmail: profile.email,
        actorName: profile.fullName,
        actorRole: profile.role,
        targetResource: `${clientName} (${appData.destination})`,
        details: `${formatDisplayName(
          profile.fullName
        )} descargó y reveló bajo demanda los campos sensibles de la subcolección aislada private_pii.`,
      });
    }
  };

  const handleAssignAdvisor = async (advisorUid: string) => {
    if (!appData || !profile) return;
    const selectedAdvisor = staffList.find((s) => s.uid === advisorUid);
    if (!selectedAdvisor) return;

    try {
      const cleanAdvName = formatDisplayName(selectedAdvisor.fullName);
      const advisorPhoto =
        selectedAdvisor.photoUrl || selectedAdvisor.photoURL || "";
      const audit = buildAuditLogEntry(
        "Asignación de Especialista Legal",
        `Caso asignado a ${cleanAdvName}.`,
        profile.fullName,
        profile.role
      );

      await updateDoc(doc(db, "applications", appData.id), {
        assignedAdvisorId: selectedAdvisor.uid,
        assignedAdvisorName: cleanAdvName,
        assignedAdvisorEmail: selectedAdvisor.email,
        assignedAdvisorPhotoUrl: advisorPhoto,
        assignedAdvisorBookingUrl: selectedAdvisor.bookingUrl || "",
        auditLogs: [audit, ...(appData.auditLogs || [])],
        updatedAt: new Date().toISOString(),
      });

      await recordSystemLog({
        category: "CASE_TRACEABILITY",
        eventType: "Asignación de Especialista Legal",
        outcome: "SUCCESS",
        actorEmail: profile.email,
        actorName: profile.fullName,
        actorRole: profile.role,
        targetResource: `${formatDisplayName(appData.clientName)} (${
          appData.destination
        })`,
        details: `Titularidad asignada a ${cleanAdvName}.`,
      });

      setFeedback(`Especialista ${cleanAdvName} asignado correctamente.`);
      await fetchCaseDetails();
    } catch {
      setErrorMsg("No se pudo asignar el especialista.");
    }
  };

  const handleUpdateFinalConsularStatus = async (
    nextStatus: ApplicationStatus
  ) => {
    if (!appData || !profile) return;
    try {
      const cleanActor = formatDisplayName(profile.fullName);
      const clientName = formatDisplayName(
        appData.formData?.fullName || appData.clientName || "Cliente"
      );

      const audit = buildAuditLogEntry(
        `Cambio de Estatus Consular: ${nextStatus.toUpperCase()}`,
        `El especialista actualizó el estado del trámite a ${nextStatus}.`,
        cleanActor,
        profile.role
      );

      await updateDoc(doc(db, "applications", appData.id), {
        status: nextStatus,
        progressPercentage:
          nextStatus === "approved" || nextStatus === "rejected"
            ? 100
            : appData.progressPercentage,
        auditLogs: [audit, ...(appData.auditLogs || [])],
        updatedAt: new Date().toISOString(),
      });

      await recordSystemLog({
        category: "CASE_TRACEABILITY",
        eventType: `Cambio de Estatus Consular (${nextStatus.toUpperCase()})`,
        outcome: nextStatus === "rejected" ? "WARNING" : "SUCCESS",
        actorEmail: profile.email,
        actorName: cleanActor,
        actorRole: profile.role,
        targetResource: `${clientName} (${appData.destination})`,
        details: `Estado del expediente actualizado a [${nextStatus.toUpperCase()}].`,
      });

      if (appData.clientEmail) {
        await sendTransactionalEmail({
          to: appData.clientEmail,
          subject: `Actualización de tu Expediente Consular (${nextStatus.toUpperCase()})`,
          clientName,
          title: `Nuevo Estado: ${nextStatus.toUpperCase()}`,
          message: `Tu especialista legal (${cleanActor}) ha actualizado el estado de tu solicitud de visa a "${nextStatus.toUpperCase()}". Ingresa a tu portal para consultar los detalles.`,
          actorEmail: profile.email,
          actorName: cleanActor,
          actorRole: profile.role,
        });
      }

      setFeedback(
        `Estatus actualizado a ${nextStatus.toUpperCase()} y notificado.`
      );
      await fetchCaseDetails();
    } catch {
      setErrorMsg("No se pudo cambiar el estatus del expediente.");
    }
  };

  const handleReviewDocument = async (
    docItem: VaultDocumentItem,
    verdict: "verified" | "rejected"
  ) => {
    if (!appData || !profile) return;

    const rawDocs = appData.documents;
    const baseDocs: VaultDocumentItem[] =
      Array.isArray(rawDocs) && rawDocs.length > 0
        ? rawDocs
        : getDefaultDocumentsByDestination(appData.destination);

    const customFeedback = (docFeedbackMap[docItem.id] || "").trim();
    if (verdict === "rejected" && !customFeedback) {
      setErrorMsg(
        "Por favor escribe una observación indicando al cliente qué debe ajustar en el documento."
      );
      return;
    }

    try {
      const cleanActor = formatDisplayName(profile.fullName);
      const clientName = formatDisplayName(
        appData.formData?.fullName || appData.clientName || "Cliente"
      );

      const updatedDocs = baseDocs.map((d) =>
        d.id === docItem.id
          ? {
              ...d,
              status: verdict,
              feedback:
                verdict === "rejected"
                  ? customFeedback
                  : "Verificado conforme a norma consular.",
              reviewedBy: cleanActor,
            }
          : d
      );

      const nextMetrics = calculateApplicationMetrics({
        ...appData,
        documents: updatedDocs,
      });

      const audit = buildAuditLogEntry(
        `Dictamen Bóveda PII (${
          verdict === "verified" ? "VERIFICADO" : "RECHAZADO"
        }): ${docItem.title}`,
        verdict === "rejected"
          ? `Motivo de ajuste: ${customFeedback}`
          : `Documento validado por ${cleanActor}.`,
        cleanActor,
        profile.role
      );

      await updateDoc(doc(db, "applications", appData.id), {
        documents: updatedDocs,
        progressPercentage: nextMetrics.progressPercentage,
        currentStep: nextMetrics.currentStep,
        status: nextMetrics.autoStatus,
        auditLogs: [audit, ...(appData.auditLogs || [])],
        updatedAt: new Date().toISOString(),
      });

      await recordSystemLog({
        category: "PII_VAULT",
        eventType: `Auditoría de Soporte PII (${
          verdict === "verified" ? "Verificado" : "Rechazado"
        })`,
        outcome: verdict === "verified" ? "SUCCESS" : "WARNING",
        actorEmail: profile.email,
        actorName: cleanActor,
        actorRole: profile.role,
        targetResource: `${clientName} • ${docItem.title}`,
        details:
          verdict === "verified"
            ? `Soporte "${docItem.title}" aprobado.`
            : `Soporte "${docItem.title}" rechazado: ${customFeedback}`,
      });

      await sendInternalNotification(
        appData.id,
        verdict === "verified"
          ? `Documento Verificado: ${docItem.title}`
          : `Ajuste Requerido: ${docItem.title}`,
        verdict === "verified"
          ? `Tu especialista legal aprobó "${docItem.title}" en la Bóveda.`
          : `Observación en "${docItem.title}": ${customFeedback}`,
        "/dashboard/boveda"
      );

      if (appData.clientEmail) {
        await sendTransactionalEmail({
          to: appData.clientEmail,
          subject:
            verdict === "verified"
              ? `✓ Soporte Verificado: ${docItem.title}`
              : `⚠️ Ajuste Requerido en Bóveda: ${docItem.title}`,
          clientName,
          title:
            verdict === "verified"
              ? `Documento Aprobado: ${docItem.title}`
              : `Observación Legal en: ${docItem.title}`,
          message:
            verdict === "verified"
              ? `Tu especialista legal (${cleanActor}) ha auditado y verificado satisfactoriamente tu documento "${docItem.title}".`
              : `Tu especialista legal revisó "${docItem.title}" e indicó el siguiente ajuste necesario: "${customFeedback}". Por favor sube la versión corregida en tu Bóveda Documental.`,
          ctaLabel: "Ir a mi Bóveda Criptográfica",
          ctaUrl: "/dashboard/boveda",
          actorEmail: profile.email,
          actorName: cleanActor,
          actorRole: profile.role,
        });
      }

      setFeedback(`Dictamen guardado y notificado al cliente.`);
      await fetchCaseDetails();
    } catch {
      setErrorMsg("No se pudo guardar el dictamen del documento.");
    }
  };

  const handleDeleteSingleDocument = async (docItem: VaultDocumentItem) => {
    if (!appData || !profile) return;

    try {
      if (docItem.storagePath) {
        try {
          await deleteObject(ref(storage, docItem.storagePath));
        } catch {}
      }

      const rawDocs =
        Array.isArray(appData.documents) && appData.documents.length > 0
          ? appData.documents
          : getDefaultDocumentsByDestination(appData.destination);

      const updatedDocs: VaultDocumentItem[] = rawDocs.map((d) =>
        d.id === docItem.id
          ? {
              ...d,
              status: "pending",
              fileName: "",
              fileUrl: "",
              storagePath: "",
              feedback: "",
            }
          : d
      );

      const nextMetrics = calculateApplicationMetrics({
        ...appData,
        documents: updatedDocs,
      });

      const cleanActor = formatDisplayName(profile.fullName);
      const clientName = formatDisplayName(
        appData.formData?.fullName || appData.clientName || "Cliente"
      );

      const audit = buildAuditLogEntry(
        `Eliminación Individual de Soporte: ${docItem.title}`,
        `Archivo eliminado de Storage y requisito restablecido a pendiente por ${cleanActor}.`,
        cleanActor,
        profile.role
      );

      await updateDoc(doc(db, "applications", appData.id), {
        documents: updatedDocs,
        progressPercentage: nextMetrics.progressPercentage,
        currentStep: nextMetrics.currentStep,
        status: nextMetrics.autoStatus,
        auditLogs: [audit, ...(appData.auditLogs || [])],
        updatedAt: new Date().toISOString(),
      });

      await recordSystemLog({
        category: "PII_VAULT",
        eventType: `Eliminación Individual de Archivo (${docItem.title})`,
        outcome: "WARNING",
        actorEmail: profile.email,
        actorName: cleanActor,
        actorRole: profile.role,
        targetResource: `${clientName} • ${docItem.title}`,
        details: `El asesor eliminó el archivo "${
          docItem.fileName || docItem.title
        }" y restableció el requisito a pendiente.`,
      });

      setFeedback(`Archivo de "${docItem.title}" eliminado correctamente.`);
      await fetchCaseDetails();
    } catch {
      setErrorMsg("No se pudo eliminar el archivo seleccionado.");
    }
  };

  const handleUploadDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appData || !profile || !delivFile || !delivLabel.trim()) return;

    setUploadingDeliv(true);
    setFeedback("");
    setErrorMsg("");

    try {
      const safeName = delivFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `vault/${appData.id}/deliverable_${Date.now()}_${safeName}`;
      const fileRef = ref(storage, storagePath);

      await uploadBytes(fileRef, delivFile);
      const fileUrl = await getDownloadURL(fileRef);

      const cleanActor = formatDisplayName(profile.fullName);
      const clientName = formatDisplayName(
        appData.formData?.fullName || appData.clientName || "Cliente"
      );

      const newDeliv: OfficialDeliverableItem = {
        id: `deliv_${Date.now()}`,
        label: delivLabel.trim(),
        fileName: delivFile.name,
        fileUrl,
        storagePath,
        uploadedBy: cleanActor,
        uploadedAt: new Date().toISOString(),
      };

      const updatedDeliverables = [
        newDeliv,
        ...(Array.isArray(appData.officialDeliverables)
          ? appData.officialDeliverables
          : []),
      ];

      const nextMetrics = calculateApplicationMetrics({
        ...appData,
        officialDeliverables: updatedDeliverables,
      });

      const audit = buildAuditLogEntry(
        `Emisión de Entregable Oficial: ${newDeliv.label}`,
        `Archivo oficial emitido: ${newDeliv.fileName}.`,
        cleanActor,
        profile.role
      );

      await updateDoc(doc(db, "applications", appData.id), {
        officialDeliverables: updatedDeliverables,
        progressPercentage: nextMetrics.progressPercentage,
        currentStep: nextMetrics.currentStep,
        status: nextMetrics.autoStatus,
        auditLogs: [audit, ...(appData.auditLogs || [])],
        updatedAt: new Date().toISOString(),
      });

      await recordSystemLog({
        category: "PII_VAULT",
        eventType: `Emisión de Entregable Oficial (${newDeliv.label})`,
        outcome: "SUCCESS",
        actorEmail: profile.email,
        actorName: cleanActor,
        actorRole: profile.role,
        targetResource: `${clientName} (${appData.destination})`,
        details: `Entregable "${newDeliv.label}" puesto a disposición del cliente.`,
      });

      await sendInternalNotification(
        appData.id,
        `Nuevo Entregable Oficial: ${newDeliv.label}`,
        `Tu especialista ha emitido "${newDeliv.label}". Ya puedes descargarlo desde tu Perfil.`,
        "/dashboard/perfil"
      );

      if (appData.clientEmail) {
        await sendTransactionalEmail({
          to: appData.clientEmail,
          subject: `📄 Documento Oficial Emitido: ${newDeliv.label}`,
          clientName,
          title: `Entregable Listo: ${newDeliv.label}`,
          message: `Tu especialista legal (${cleanActor}) ha emitido tu documento oficial "${newDeliv.label}" (${newDeliv.fileName}). Ya se encuentra disponible para descarga en tu portal privado.`,
          ctaLabel: "Descargar mi Entregable Oficial",
          ctaUrl: "/dashboard/perfil",
          actorEmail: profile.email,
          actorName: cleanActor,
          actorRole: profile.role,
        });
      }

      setDelivLabel("");
      setDelivFile(null);
      setFeedback(`¡Entregable "${newDeliv.label}" emitido y notificado!`);
      await fetchCaseDetails();
    } catch {
      setErrorMsg("No se pudo subir el entregable oficial.");
    } finally {
      setUploadingDeliv(false);
    }
  };

  const handleScheduleMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appData || !profile || !meetTitle.trim() || !meetDateTime) return;

    setSavingMeet(true);
    setFeedback("");
    setErrorMsg("");

    try {
      const cleanActor = formatDisplayName(profile.fullName);
      const clientName = formatDisplayName(
        appData.formData?.fullName || appData.clientName || "Cliente"
      );

      const newMeet: ScheduledMeetingItem = {
        id: `meet_${Date.now()}`,
        title: meetTitle.trim(),
        dateTime: meetDateTime,
        meetUrl: meetUrl.trim() || "https://meet.google.com/",
        advisorName: cleanActor,
        notes: meetNotes.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };

      const updatedMeetings = [
        newMeet,
        ...(Array.isArray(appData.meetings) ? appData.meetings : []),
      ];

      const audit = buildAuditLogEntry(
        `Sesión 1-a-1 Programada: ${newMeet.title}`,
        `Fecha: ${new Date(newMeet.dateTime).toLocaleString("es-CO")}.`,
        cleanActor,
        profile.role
      );

      await updateDoc(doc(db, "applications", appData.id), {
        meetings: updatedMeetings,
        auditLogs: [audit, ...(appData.auditLogs || [])],
        updatedAt: new Date().toISOString(),
      });

      await recordSystemLog({
        category: "CASE_TRACEABILITY",
        eventType: "Programación de Simulacro 1-a-1 (Google Meet)",
        outcome: "SUCCESS",
        actorEmail: profile.email,
        actorName: cleanActor,
        actorRole: profile.role,
        targetResource: `${clientName} (${appData.destination})`,
        details: `Sesión "${newMeet.title}" agendada para ${new Date(
          newMeet.dateTime
        ).toLocaleString("es-CO")}.`,
      });

      await sendInternalNotification(
        appData.id,
        `Sesión Agendada: ${newMeet.title}`,
        `Tienes una sesión 1-a-1 el ${new Date(
          newMeet.dateTime
        ).toLocaleString("es-CO")}. Puedes descargar el archivo .ics en tu Sala Consular.`,
        "/dashboard/sala-entrenamiento"
      );

      if (appData.clientEmail) {
        const gcalUrl = getGoogleCalendarUrl(newMeet, clientName);
        await sendTransactionalEmail({
          to: appData.clientEmail,
          subject: `📅 Confirmación de Sesión Consular 1-a-1: ${newMeet.title}`,
          clientName,
          title: `Sesión Programada: ${newMeet.title}`,
          message: `Tu especialista (${cleanActor}) ha agendado tu sesión para el ${new Date(
            newMeet.dateTime
          ).toLocaleString("es-CO", {
            dateStyle: "full",
            timeStyle: "short",
          })}. Videollamada Google Meet: ${
            newMeet.meetUrl
          }. También puedes descargar el archivo .ics para Apple Calendar / Outlook desde tu Sala Consular.`,
          ctaLabel: "📅 Añadir a mi Google Calendar",
          ctaUrl: gcalUrl,
          actorEmail: profile.email,
          actorName: cleanActor,
          actorRole: profile.role,
        });
      }

      setMeetTitle("");
      setMeetDateTime("");
      setMeetUrl("");
      setMeetNotes("");
      setFeedback("Sesión Google Meet programada y notificada.");
      await fetchCaseDetails();
    } catch {
      setErrorMsg("No se pudo programar la sesión.");
    } finally {
      setSavingMeet(false);
    }
  };

  const handleToggleMeetingCompleted = async (meetingId: string) => {
    if (!appData || !profile) return;
    const currentMeetings = Array.isArray(appData.meetings)
      ? appData.meetings
      : [];
    const updatedMeetings = currentMeetings.map((m) =>
      m.id === meetingId ? { ...m, completed: !m.completed } : m
    );
    const nextMetrics = calculateApplicationMetrics({
      ...appData,
      meetings: updatedMeetings,
    });

    await updateDoc(doc(db, "applications", appData.id), {
      meetings: updatedMeetings,
      progressPercentage: nextMetrics.progressPercentage,
      currentStep: nextMetrics.currentStep,
      updatedAt: new Date().toISOString(),
    });
    await fetchCaseDetails();
  };

  const handleDeleteMeeting = async (meetingId: string) => {
    if (!appData || !profile) return;
    const currentMeetings = Array.isArray(appData.meetings)
      ? appData.meetings
      : [];
    const updatedMeetings = currentMeetings.filter((m) => m.id !== meetingId);

    await updateDoc(doc(db, "applications", appData.id), {
      meetings: updatedMeetings,
      updatedAt: new Date().toISOString(),
    });
    setFeedback("Sesión eliminada del calendario del expediente.");
    await fetchCaseDetails();
  };

  const handleZeroTrustPurgeVault = async () => {
    if (!appData || !profile) return;
    const confirmed = window.confirm(
      "¿Ejecutar Purga Criptográfica Zero-Trust Final? Se eliminarán definitivamente todos los archivos sensibles de este expediente ya concluido."
    );
    if (!confirmed) return;

    setPurgingVault(true);
    try {
      const rawDocs = Array.isArray(appData.documents)
        ? appData.documents
        : [];
      for (const d of rawDocs) {
        if (d.storagePath) {
          try {
            await deleteObject(ref(storage, d.storagePath));
          } catch {}
        }
      }

      const purgedDocs: VaultDocumentItem[] = rawDocs.map((d) => ({
        ...d,
        fileUrl: "",
        storagePath: "",
        fileName: "PURGADO (ZERO-TRUST)",
      }));

      const cleanActor = formatDisplayName(profile.fullName);
      const clientName = formatDisplayName(
        appData.formData?.fullName || appData.clientName || "Cliente"
      );

      const audit = buildAuditLogEntry(
        "Ejecución de Purga Definitiva Zero-Trust",
        `Todos los soportes sensibles fueron eliminados de Firebase Storage tras concluir el trámite.`,
        cleanActor,
        profile.role
      );

      await updateDoc(doc(db, "applications", appData.id), {
        documents: purgedDocs,
        auditLogs: [audit, ...(appData.auditLogs || [])],
        updatedAt: new Date().toISOString(),
      });

      await recordSystemLog({
        category: "PII_VAULT",
        eventType: "Purga Criptográfica Definitiva (Zero-Trust)",
        outcome: "CRITICAL",
        actorEmail: profile.email,
        actorName: cleanActor,
        actorRole: profile.role,
        targetResource: `${clientName} (${appData.destination})`,
        details: `Se destruyeron permanentemente los archivos PII en Storage tras finalizar el proceso.`,
      });

      setFeedback(
        "Purga Criptográfica Zero-Trust completada y registrada en el SIEM."
      );
      await fetchCaseDetails();
    } catch {
      setErrorMsg("Error al ejecutar la purga documental.");
    } finally {
      setPurgingVault(false);
    }
  };

  if (!isStaff) {
    return (
      <div className="rounded-2xl bg-brand-red/10 p-8 text-center">
        <ShieldAlert className="h-10 w-10 text-brand-red mx-auto" />
        <p className="font-display text-lg font-bold mt-2">
          Acceso Restringido al Equipo Legal
        </p>
      </div>
    );
  }

  if (loadingCase || !appData) {
    return <DashboardContentSkeleton />;
  }

  const clientName = formatDisplayName(
    appData.formData?.fullName || appData.clientName || "Cliente"
  );
  const fd = appData.formData || {};
  const docsList: VaultDocumentItem[] =
    Array.isArray(appData.documents) && appData.documents.length > 0
      ? appData.documents
      : getDefaultDocumentsByDestination(appData.destination);

  const caseAuditLogs = Array.isArray(appData.auditLogs)
    ? appData.auditLogs
    : [];

  const isCaseConcluded =
    appData.status === "approved" || appData.status === "rejected";

  return (
    <div className="space-y-8 font-sans">
      {/* CABECERA DEL WORKSPACE */}
      <div className="rounded-3xl bg-brand-charcoal text-white p-6 sm:p-8 border border-white/10 shadow-lg space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/10 pb-5">
          <div className="space-y-1.5">
            <button
              type="button"
              onClick={() => router.push("/dashboard/admin?tab=gobernanza")}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-white/70 hover:text-brand-red transition-colors mb-1"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver al Monitor de Operaciones</span>
            </button>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                {clientName}
              </h2>
              <span className="rounded-full bg-brand-red px-3 py-0.5 font-mono text-[10px] font-bold uppercase">
                {appData.destination === "JAPAN"
                  ? "🇯🇵 Japón MOFA"
                  : "🇺🇸 EE. UU. B1/B2"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-0.5 font-mono text-[10px] font-bold uppercase">
                Plan {appData.planTier}
              </span>
            </div>
            <p className="text-xs text-white/70 flex items-center gap-2">
              <Mail className="h-3.5 w-3.5 text-brand-red" />
              <span>{appData.clientEmail}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-brand-red shrink-0" />
              <select
                aria-label="Asignar especialista legal"
                value={appData.assignedAdvisorId || ""}
                onChange={(e) => handleAssignAdvisor(e.target.value)}
                className="h-10 rounded-full bg-white/10 border border-white/15 px-4 text-xs font-bold text-white focus:outline-none focus:border-brand-red"
              >
                <option value="" className="text-brand-charcoal">
                  ⚠️ Sin Asesor (En Bolsa)
                </option>
                {staffList.map((s) => (
                  <option
                    key={s.uid}
                    value={s.uid}
                    className="text-brand-charcoal"
                  >
                    {formatDisplayName(s.fullName)} ({s.role.toUpperCase()})
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={() => handleUpdateFinalConsularStatus("approved")}
              className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 hover:bg-emerald-500 px-4 py-2 text-xs font-bold text-white transition-all"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Visa Aprobada</span>
            </button>

            <button
              type="button"
              onClick={() => handleUpdateFinalConsularStatus("rejected")}
              className="inline-flex items-center gap-1.5 rounded-full bg-brand-red hover:bg-brand-red/90 px-4 py-2 text-xs font-bold text-white transition-all"
            >
              <XCircle className="h-3.5 w-3.5" />
              <span>Rechazada</span>
            </button>
          </div>
        </div>

        {/* CONTROL DE ENMASCARAMIENTO PII CON BÓVEDA SUBCOLECCIÓN */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-white/5 border border-white/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red/20 text-brand-red">
              <Lock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-white">
                Aislamiento Criptográfico de Subcolección PII (`private_pii/vault`)
              </p>
              <p className="text-[11px] text-white/65">
                Cédula, Pasaporte e Ingresos no viajan en la carga inicial; se
                descargan bajo demanda y quedan auditados en el SIEM.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleToggleRevealPii}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold transition-all shrink-0 ${
              piiRevealed
                ? "bg-amber-500 text-brand-charcoal"
                : "bg-white/10 hover:bg-brand-red text-white border border-white/15"
            }`}
          >
            {piiRevealed ? (
              <>
                <EyeOff className="h-4 w-4" />
                <span>Ocultar Datos PII</span>
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" />
                <span>Revelar Datos Sensibles</span>
              </>
            )}
          </button>
        </div>
      </div>

      {feedback && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback("")}
            className="p-1"
            aria-label="Cerrar mensaje"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 text-xs font-semibold text-brand-red">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg("")}
            className="p-1"
            aria-label="Cerrar error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* RESPUESTAS DEL FORMULARIO INTELIGENTE */}
      <section className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-brand-red" />
            <h3 className="font-display text-lg font-bold text-brand-charcoal">
              Respuestas del Formulario Inteligente (
              {appData.destination === "JAPAN" ? "Japón MOFA" : "DS-160"})
            </h3>
          </div>
          <span className="font-mono text-[11px] font-bold text-brand-charcoal/65">
            {piiRevealed ? "🔓 BÓVEDA PII DESBLOQUEADA" : "🔒 BÓVEDA PII SELLADA"}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          <div className="rounded-2xl bg-brand-platinum/40 p-4 border border-brand-charcoal/10">
            <span className="text-[10px] font-mono font-bold uppercase text-brand-red block">
              CÉDULA / DNI (PII)
            </span>
            <p className="font-mono text-sm font-bold text-brand-charcoal mt-1">
              {piiRevealed
                ? unmaskedVaultPii?.nationalId || fd.nationalId || "Pendiente"
                : maskSensitiveValue(fd.nationalId)}
            </p>
          </div>

          <div className="rounded-2xl bg-brand-platinum/40 p-4 border border-brand-charcoal/10">
            <span className="text-[10px] font-mono font-bold uppercase text-brand-red block">
              PASAPORTE (PII)
            </span>
            <p className="font-mono text-sm font-bold text-brand-charcoal mt-1">
              {piiRevealed
                ? unmaskedVaultPii?.passportNumber ||
                  fd.passportNumber ||
                  "Pendiente"
                : maskSensitiveValue(fd.passportNumber)}
            </p>
          </div>

          <div className="rounded-2xl bg-brand-platinum/40 p-4 border border-brand-charcoal/10">
            <span className="text-[10px] font-mono font-bold uppercase text-brand-red block">
              INGRESOS MENSUALES (PII)
            </span>
            <p className="font-mono text-sm font-bold text-brand-charcoal mt-1">
              {piiRevealed
                ? unmaskedVaultPii?.monthlyIncomeCop ||
                  fd.monthlyIncomeCop ||
                  "Pendiente"
                : maskSensitiveValue(fd.monthlyIncomeCop)}
            </p>
          </div>

          <div className="rounded-2xl bg-brand-platinum/40 p-4 border border-brand-charcoal/10">
            <span className="text-[10px] font-mono font-bold uppercase text-brand-red block">
              TELÉFONO MÓVIL (PII)
            </span>
            <p className="font-mono text-sm font-bold text-brand-charcoal mt-1">
              {piiRevealed
                ? unmaskedVaultPii?.mobilePhone ||
                  fd.mobilePhone ||
                  "Pendiente"
                : maskSensitiveValue(fd.mobilePhone)}
            </p>
          </div>

          <div className="rounded-2xl bg-brand-platinum/30 p-4 border border-brand-platinum">
            <span className="text-[10px] font-bold uppercase text-brand-charcoal/60 block">
              Fecha Llegada & Duración
            </span>
            <p className="font-bold text-brand-charcoal mt-1">
              {fd.intendedArrivalDate || "---"} (
              {fd.intendedStayDuration || "---"})
            </p>
          </div>

          <div className="rounded-2xl bg-brand-platinum/30 p-4 border border-brand-platinum">
            <span className="text-[10px] font-bold uppercase text-brand-charcoal/60 block">
              Ciudades Destino
            </span>
            <p className="font-bold text-brand-charcoal mt-1">
              {fd.destinationCities || "Pendiente"}
            </p>
          </div>

          <div className="rounded-2xl bg-brand-platinum/30 p-4 border border-brand-platinum">
            <span className="text-[10px] font-bold uppercase text-brand-charcoal/60 block">
              Empresa y Cargo
            </span>
            <p className="font-bold text-brand-charcoal mt-1">
              {fd.employerOrBusinessName || "---"} • {fd.jobTitle || "---"}
            </p>
          </div>

          <div className="rounded-2xl bg-brand-platinum/30 p-4 border border-brand-platinum">
            <span className="text-[10px] font-bold uppercase text-brand-charcoal/60 block">
              Rechazos Previos / Viajes
            </span>
            <p className="font-bold text-brand-charcoal mt-1">
              Rechazos: {fd.previousVisaRefusal || "No"} •{" "}
              {fd.internationalTravelHistory || "Sin viajes"}
            </p>
          </div>
        </div>
      </section>

      {/* AUDITORÍA DE BÓVEDA DOCUMENTAL ESTILO FINTECH EJECUTIVO */}
      <section className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-platinum pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-charcoal text-white">
              <FolderLock className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-brand-charcoal">
                Bóveda Documental del Expediente ({docsList.length} requisitos)
              </h3>
              <p className="text-xs text-brand-charcoal/70">
                Los controles de dictamen, previsualización y eliminación
                individual se activan cuando el cliente sube cada soporte.
              </p>
            </div>
          </div>

          {profile?.role === "admin" && isCaseConcluded && (
            <button
              type="button"
              onClick={handleZeroTrustPurgeVault}
              disabled={purgingVault}
              className="inline-flex items-center gap-2 rounded-full border border-brand-red/40 bg-brand-red/10 hover:bg-brand-red hover:text-white px-4 py-2 text-xs font-bold text-brand-red transition-all"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>
                {purgingVault
                  ? "Purgando Storage..."
                  : "Purga Post-Trámite (Zero-Trust)"}
              </span>
            </button>
          )}
        </div>

        <div className="divide-y divide-brand-platinum border border-brand-charcoal/10 rounded-2xl overflow-hidden">
          {docsList.map((docItem) => {
            const hasUploadedFile = Boolean(docItem.fileUrl);

            const statusBadge =
              docItem.status === "verified"
                ? {
                    text: "Verificado",
                    cls: "bg-emerald-500/15 text-emerald-800 border-emerald-500/30",
                  }
                : docItem.status === "uploaded"
                ? {
                    text: "Listo para Revisión",
                    cls: "bg-amber-500/15 text-amber-900 border-amber-500/30",
                  }
                : docItem.status === "rejected"
                ? {
                    text: "Ajuste Solicitado",
                    cls: "bg-brand-red/15 text-brand-red border-brand-red/30",
                  }
                : {
                    text: "Esperando al Cliente",
                    cls: "bg-brand-platinum text-brand-charcoal/65 border-brand-charcoal/10",
                  };

            return (
              <div
                key={docItem.id}
                className="p-5 bg-brand-white hover:bg-brand-platinum/20 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1 max-w-xl">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-display text-sm font-bold text-brand-charcoal">
                      {docItem.title}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase ${statusBadge.cls}`}
                    >
                      {statusBadge.text}
                    </span>
                  </div>
                  <p className="text-xs text-brand-charcoal/65">
                    {docItem.description}
                  </p>

                  {hasUploadedFile && (
                    <div className="pt-1.5 flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setPreviewVaultDoc(docItem)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-platinum/70 hover:bg-brand-charcoal hover:text-white px-3 py-1.5 text-xs font-bold text-brand-charcoal transition-colors"
                      >
                        <Eye className="h-3.5 w-3.5 text-brand-red" />
                        <span>
                          Previsualizar ({docItem.fileName || "Documento"})
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteSingleDocument(docItem)}
                        title="Eliminar este archivo individualmente"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-charcoal/55 hover:text-brand-red transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Eliminar archivo</span>
                      </button>
                    </div>
                  )}
                </div>

                {hasUploadedFile ? (
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 shrink-0">
                    <input
                      type="text"
                      value={docFeedbackMap[docItem.id] || ""}
                      onChange={(e) =>
                        setDocFeedbackMap((prev) => ({
                          ...prev,
                          [docItem.id]: e.target.value,
                        }))
                      }
                      placeholder="Observación (si pides ajuste)..."
                      className="h-9 sm:w-56 rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 px-3 text-xs text-brand-charcoal focus:bg-white focus:border-brand-red focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleReviewDocument(docItem, "verified")}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-brand-charcoal hover:bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white transition-all"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Aprobar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleReviewDocument(docItem, "rejected")}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-brand-red/30 bg-brand-red/10 hover:bg-brand-red hover:text-white px-3.5 py-2 text-xs font-bold text-brand-red transition-all"
                      >
                        <XCircle className="h-3.5 w-3.5" />
                        <span>Ajuste</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-brand-charcoal/50 font-medium shrink-0">
                    <Clock className="h-3.5 w-3.5" />
                    <span>Sin archivo cargado por el titular</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* EMISIÓN DE ENTREGABLES OFICIALES Y AGENDAMIENTO GOOGLE MEET */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
        <form
          onSubmit={handleUploadDeliverable}
          className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
            <UploadCloud className="h-5 w-5 text-brand-red" />
            <div>
              <h3 className="font-display text-base font-bold text-brand-charcoal">
                Emitir Entregable Oficial al Cliente
              </h3>
              <p className="text-xs text-brand-charcoal/70">
                Hoja de Confirmación DS-160, Citas CAS o Schedule of Stay.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              required
              value={delivLabel}
              onChange={(e) => setDelivLabel(e.target.value)}
              placeholder="Ej. Confirmación Oficial CEAC DS-160 / Schedule of Stay"
              className={inputClass}
            />

            <label className="cursor-pointer flex items-center justify-between h-11 rounded-xl border border-dashed border-brand-red/40 bg-brand-red/[0.03] px-4 text-xs font-semibold text-brand-charcoal">
              <span className="truncate">
                {delivFile
                  ? `📄 ${delivFile.name}`
                  : "Seleccionar PDF oficial..."}
              </span>
              <span className="rounded bg-brand-red px-2.5 py-1 text-[10px] font-bold text-white uppercase">
                Explorar
              </span>
              <input
                type="file"
                accept=".pdf,image/*"
                className="hidden"
                onChange={(e) => setDelivFile(e.target.files?.[0] || null)}
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={uploadingDeliv || !delivFile}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-6 py-3 text-xs font-bold text-white hover:bg-brand-charcoal disabled:opacity-50 transition-all"
          >
            <UploadCloud className="h-4 w-4" />
            <span>
              {uploadingDeliv
                ? "Emitiendo y notificando..."
                : "Emitir Entregable y Notificar al Cliente"}
            </span>
          </button>
        </form>

        <form
          onSubmit={handleScheduleMeeting}
          className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-4"
        >
          <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
            <Calendar className="h-5 w-5 text-brand-red" />
            <div>
              <h3 className="font-display text-base font-bold text-brand-charcoal">
                Programar Simulacro 1-a-1 (Google Meet)
              </h3>
              <p className="text-xs text-brand-charcoal/70">
                Envía citación automática con calendario al correo y Sala
                Consular.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="text"
              required
              value={meetTitle}
              onChange={(e) => setMeetTitle(e.target.value)}
              placeholder="Ej. Simulacro Consular 1-a-1"
              className={inputClass}
            />
            <input
              type="datetime-local"
              required
              value={meetDateTime}
              onChange={(e) => setMeetDateTime(e.target.value)}
              className={inputClass}
            />
          </div>

          <input
            type="url"
            value={meetUrl}
            onChange={(e) => setMeetUrl(e.target.value)}
            placeholder="https://meet.google.com/xxx-xxxx-xxx"
            className={inputClass}
          />

          <button
            type="submit"
            disabled={savingMeet}
            className="w-full inline-flex items-center justify-center gap-2 rounded-full bg-brand-charcoal px-6 py-3 text-xs font-bold text-white hover:bg-brand-red disabled:opacity-50 transition-all"
          >
            <Video className="h-4 w-4" />
            <span>
              {savingMeet
                ? "Agendando..."
                : "Agendar Sesión y Enviar Citación"}
            </span>
          </button>

          {/* LISTA DE SESIONES YA AGENDADAS EN ESTE EXPEDIENTE CON DESCARGA .ICS */}
          {Array.isArray(appData.meetings) && appData.meetings.length > 0 && (
            <div className="pt-4 border-t border-brand-platinum space-y-2.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-brand-charcoal/60 block">
                Sesiones Agendadas con {clientName} ({appData.meetings.length})
              </span>
              {appData.meetings.map((m) => (
                <div
                  key={m.id}
                  className="rounded-2xl bg-brand-platinum/40 p-3.5 border border-brand-charcoal/10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-charcoal truncate">
                        {m.title}
                      </span>
                      {m.completed && (
                        <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          Completada
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-brand-charcoal/70">
                      📅{" "}
                      {new Date(m.dateTime).toLocaleString("es-CO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      })}{" "}
                      • {formatDisplayName(m.advisorName)}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => downloadMeetingIcs(m, clientName)}
                      title="Descargar evento .ics para Apple Calendar / Outlook"
                      className="inline-flex items-center gap-1 rounded-lg border border-brand-charcoal/15 bg-white hover:bg-brand-charcoal hover:text-white px-2.5 py-1.5 text-[11px] font-bold text-brand-charcoal transition-colors"
                    >
                      <CalendarPlus className="h-3 w-3 text-brand-red" />
                      <span>.ics</span>
                    </button>

                    {m.meetUrl && (
                      <a
                        href={m.meetUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-lg bg-brand-charcoal hover:bg-brand-red px-2.5 py-1.5 text-[11px] font-bold text-white transition-colors"
                      >
                        <Video className="h-3 w-3" />
                        <span>Meet</span>
                      </a>
                    )}

                    <button
                      type="button"
                      onClick={() => handleToggleMeetingCompleted(m.id)}
                      className="rounded-lg border border-brand-charcoal/15 bg-white hover:bg-emerald-600 hover:text-white px-2.5 py-1.5 text-[11px] font-bold text-brand-charcoal transition-colors"
                    >
                      {m.completed ? "Reabrir" : "✓ Completar"}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteMeeting(m.id)}
                      className="rounded-lg p-1.5 text-brand-charcoal/50 hover:text-brand-red transition-colors"
                      title="Cancelar / Eliminar sesión"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </form>
      </div>

      {/* BITÁCORA DE AUDITORÍA Y TRAZABILIDAD DEL EXPEDIENTE */}
      <section className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-charcoal text-white">
              <History className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-brand-charcoal">
                Bitácora de Auditoría del Expediente ({caseAuditLogs.length}{" "}
                eventos)
              </h3>
              <p className="text-xs text-brand-charcoal/70">
                Historial cronológico inmutable de todas las acciones sobre este
                caso.
              </p>
            </div>
          </div>
        </div>

        {caseAuditLogs.length === 0 ? (
          <p className="text-xs text-brand-charcoal/60 py-6 text-center">
            Aún no hay eventos registrados en la bitácora de este expediente.
          </p>
        ) : (
          <div className="divide-y divide-brand-platinum max-h-96 overflow-y-auto pr-1">
            {caseAuditLogs.map((log) => (
              <div
                key={log.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-charcoal">
                      {log.action}
                    </span>
                    <span className="rounded bg-brand-platinum px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-brand-charcoal">
                      {log.actorName} ({log.actorRole})
                    </span>
                  </div>
                  <p className="text-brand-charcoal/70">{log.details}</p>
                </div>
                <span className="font-mono text-[11px] text-brand-charcoal/55 shrink-0">
                  {new Date(log.timestamp).toLocaleString("es-CO", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* VISUALIZADOR INTERNO DE DOCUMENTOS DEL CASO (SE CIERRA CON ESC) */}
      {previewVaultDoc && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xs flex items-center justify-center p-4 sm:p-8"
          onClick={() => setPreviewVaultDoc(null)}
        >
          <div
            className="w-full max-w-5xl rounded-3xl bg-brand-white border border-brand-charcoal/20 shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal text-white">
              <div className="min-w-0 pr-4">
                <span className="font-mono text-[10px] font-bold uppercase text-brand-red block">
                  AUDITORÍA BÓVEDA PII • PRESIONA ESC PARA CERRAR
                </span>
                <h3 className="font-display text-base font-bold truncate">
                  {previewVaultDoc.title} — {previewVaultDoc.fileName}
                </h3>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                {previewVaultDoc.fileUrl && (
                  <a
                    href={previewVaultDoc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-brand-red px-4 py-1.5 text-xs font-bold text-white transition-colors"
                  >
                    <span>Abrir en Pestaña Nueva</span>
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
                <button
                  type="button"
                  onClick={() => setPreviewVaultDoc(null)}
                  className="rounded-xl bg-white/10 hover:bg-brand-red p-2 text-white transition-colors"
                  aria-label="Cerrar visualizador (Esc)"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 bg-brand-platinum overflow-auto min-h-[72vh] flex items-center justify-center">
              <iframe
                src={previewVaultDoc.fileUrl}
                title={previewVaultDoc.title}
                className="w-full h-[78vh] border-0 bg-white"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminCaseWorkspacePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<DashboardContentSkeleton />}>
        <AdminCaseWorkspaceContent />
      </Suspense>
    </DashboardLayout>
  );
}