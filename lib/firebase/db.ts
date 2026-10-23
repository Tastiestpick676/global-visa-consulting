// lib/firebase/db.ts
import { db } from "./config";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  AppNotification,
  ApplicationStatus,
  AuditLogEntry,
  DestinationCountry,
  PlanTier,
  SystemLogCategory,
  SystemLogEntry,
  SystemLogOutcome,
  UserProfile,
  UserRole,
  VaultDocumentItem,
  VisaApplication,
} from "@/types/visa";

export function formatDisplayName(rawName?: string | null): string {
  if (!rawName) return "";
  const cleaned = rawName.trim().replace(/\s+/g, " ");
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Normaliza cualquier campo de Firestore que pueda venir como Array o como Objeto/Mapa
 * evitando errores `x.filter is not a function` o `x.some is not a function`.
 */
function normalizeToArray<T = any>(rawField: unknown): T[] {
  if (!rawField) return [];
  if (Array.isArray(rawField)) return rawField;
  if (typeof rawField === "object") {
    return Object.values(rawField as Record<string, T>).filter(
      (item) => item !== null && typeof item === "object"
    );
  }
  return [];
}

export function getDefaultDocumentsByDestination(
  destination: DestinationCountry
): VaultDocumentItem[] {
  if (destination === "JAPAN") {
    return [
      {
        id: "doc_passport",
        title: "Pasaporte Biométrico Vigente",
        description:
          "Escaneo nítido de la hoja de datos biográficos con mínimo 6 meses de vigencia.",
        required: true,
        status: "pending",
      },
      {
        id: "doc_photo_jp",
        title: "Fotografía Consular 4.5 x 4.5 cm (Fondo Blanco)",
        description:
          "Formato oficial exigido por la Embajada del Japón (MOFA), rostro despejado.",
        required: true,
        status: "pending",
      },
      {
        id: "doc_bank_statements",
        title: "Extractos Bancarios (Últimos 3 Meses)",
        description:
          "Certificación de saldos y extractos que soporten solvencia propia para el viaje.",
        required: true,
        status: "pending",
      },
      {
        id: "doc_employment_cert",
        title: "Certificado Laboral o Cámara de Comercio",
        description:
          "Soporte de ingresos, cargo, antigüedad o matrícula mercantil vigente.",
        required: true,
        status: "pending",
      },
      {
        id: "doc_flight_hotel_reservation",
        title: "Pre-Reserva de Vuelos y Alojamiento (Para Schedule of Stay)",
        description:
          "Base para estructurar tu itinerario técnico día por día ante el consulado japonés.",
        required: false,
        status: "pending",
      },
    ];
  }

  return [
    {
      id: "doc_passport",
      title: "Pasaporte Vigente (y Anteriores con Visa si aplica)",
      description:
        "Hoja biográfica en PDF o imagen clara para extracción técnica de datos DS-160.",
      required: true,
      status: "pending",
    },
    {
      id: "doc_photo_us",
      title: "Fotografía Digital 5 x 5 cm (Fondo Blanco)",
      description:
        "Cumpliendo estándares del Departamento de Estado (sin gafas ni accesorios).",
      required: true,
      status: "pending",
    },
    {
      id: "doc_employment_ties",
      title: "Certificación Laboral, Cámara de Comercio o RUT",
      description:
        "Soporte principal de arraigo económico y actividad profesional en tu país.",
      required: true,
      status: "pending",
    },
    {
      id: "doc_financial_support",
      title: "Soportes de Solvencia (Extractos / Declaración de Renta)",
      description:
        "Respaldo documental para el día de tu entrevista consular bajo Sección 214(b).",
      required: true,
      status: "pending",
    },
  ];
}

export function buildAuditLogEntry(
  action: string,
  details: string,
  actorName: string,
  actorRole: UserRole
): AuditLogEntry {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    action,
    details,
    actorName: formatDisplayName(actorName) || actorName,
    actorRole,
    timestamp: new Date().toISOString(),
  };
}

export function calculateApplicationMetrics(app?: VisaApplication | null): {
  progressPercentage: number;
  currentStep: number;
  autoStatus: ApplicationStatus;
  formCompletedCount: number;
  verifiedDocsCount: number;
  uploadedDocsCount: number;
  requiredDocsTotal: number;
} {
  if (!app) {
    return {
      progressPercentage: 15,
      currentStep: 1,
      autoStatus: "onboarding",
      formCompletedCount: 0,
      verifiedDocsCount: 0,
      uploadedDocsCount: 0,
      requiredDocsTotal: 4,
    };
  }

  // Normalizamos todos los campos para soportar tanto Arrays como Objetos/Mapas en Firestore
  const docs = normalizeToArray<any>(app.documents);
  const deliverables = normalizeToArray<any>(app.officialDeliverables);
  const meetings = normalizeToArray<any>(app.meetings);

  // Si los documentos vienen de un mapa sin la propiedad `required` explícita, asumimos que son requeridos
  const requiredDocs = docs.filter((d) =>
    typeof d?.required === "boolean" ? d.required : true
  );
  const totalReq = requiredDocs.length || 4;

  const uploadedReq = requiredDocs.filter(
    (d) =>
      d?.status === "uploaded" ||
      d?.status === "verified" ||
      d?.status === "approved" ||
      Boolean(d?.fileUrl || d?.url)
  ).length;

  const verifiedReq = requiredDocs.filter(
    (d) => d?.status === "verified" || d?.status === "approved"
  ).length;

  const fd = app.formData || {};
  const filledKeys = Object.keys(fd).filter((k) => {
    const val = fd[k];
    if (typeof val === "string") return val.trim().length > 0;
    if (typeof val === "boolean" || typeof val === "number") return true;
    return false;
  });

  if (app.status === "approved" || app.status === "rejected") {
    return {
      progressPercentage: 100,
      currentStep: 4,
      autoStatus: app.status,
      formCompletedCount: filledKeys.length,
      verifiedDocsCount: verifiedReq,
      uploadedDocsCount: uploadedReq,
      requiredDocsTotal: totalReq,
    };
  }

  const formScore = Math.min(35, Math.round((filledKeys.length / 8) * 35));
  const uploadScore = Math.round((uploadedReq / totalReq) * 20);
  const verifyScore = Math.round((verifiedReq / totalReq) * 20);

  const hasDeliverables = deliverables.length > 0;
  const hasMeetings = meetings.length > 0;
  const completedMeeting = meetings.some(
    (m) => m?.completed || m?.status === "completed"
  );

  let consularScore = 0;
  if (hasDeliverables) consularScore += 5;
  if (hasMeetings) consularScore += 5;
  if (completedMeeting) consularScore += 5;

  const baseScore = 10;
  const rawTotal =
    baseScore + formScore + uploadScore + verifyScore + consularScore;
  const progressPercentage = Math.min(98, Math.max(15, rawTotal));

  let currentStep = 1;
  let autoStatus: ApplicationStatus = "onboarding";

  if (filledKeys.length > 0 && filledKeys.length < 5) {
    currentStep = 2;
    autoStatus = "form_in_progress";
  } else if (filledKeys.length >= 5 && verifiedReq < totalReq) {
    currentStep = 3;
    autoStatus =
      uploadedReq < totalReq ? "documents_pending" : "legal_review";
  } else if (filledKeys.length >= 5 && verifiedReq >= totalReq) {
    currentStep = 4;
    autoStatus = "ready_for_consulate";
  }

  return {
    progressPercentage,
    currentStep,
    autoStatus,
    formCompletedCount: filledKeys.length,
    verifiedDocsCount: verifiedReq,
    uploadedDocsCount: uploadedReq,
    requiredDocsTotal: totalReq,
  };
}

export async function initializeUserAndApplication(
  uid: string,
  email: string,
  fullName: string,
  destination: DestinationCountry = "USA",
  role: UserRole = "client",
  planTier: PlanTier = "Priority Pro"
): Promise<void> {
  const userRef = doc(db, "users", uid);
  const appRef = doc(db, "applications", uid);

  const now = new Date().toISOString();
  const cleanName = formatDisplayName(fullName) || "Titular Autorizado";

  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) {
    const newProfile: UserProfile = {
      uid,
      email: email.toLowerCase(),
      fullName: cleanName,
      role,
      destination,
      planTier,
      createdAt: now,
      updatedAt: now,
    };
    await setDoc(userRef, newProfile);
  }

  const appSnap = await getDoc(appRef);
  if (!appSnap.exists()) {
    const initialAudit = buildAuditLogEntry(
      "Provisionamiento de Expediente",
      `Expediente inicializado para jurisdicción ${destination} (${planTier}).`,
      cleanName,
      role
    );

    const welcomeNotif: AppNotification = {
      id: `notif_welcome_${Date.now()}`,
      recipientId: uid,
      title: "Expediente Consular Activado",
      message: `Bienvenido a Global Visa Consulting. Tu portal seguro para ${
        destination === "JAPAN" ? "Japón" : "Estados Unidos"
      } está listo.`,
      link: "/dashboard",
      read: false,
      createdAt: now,
    };

    const newApp: VisaApplication = {
      id: uid,
      userId: uid,
      clientName: cleanName,
      clientEmail: email.toLowerCase(),
      destination,
      visaType:
        destination === "JAPAN"
          ? "Visa Turismo / Estancia Corta — Japón"
          : "Visa B1/B2 Turismo y Negocios — EE. UU.",
      planTier,
      status: "onboarding",
      currentStep: 1,
      progressPercentage: 15,
      consularAttempt: 1,
      formData: {
        fullName: cleanName,
      },
      documents: getDefaultDocumentsByDestination(destination),
      officialDeliverables: [],
      meetings: [],
      auditLogs: [initialAudit],
      notifications: [welcomeNotif],
      createdAt: now,
      updatedAt: now,
    };

    await setDoc(appRef, newApp);
  }
}

export async function sendInternalNotification(
  recipientUid: string,
  title: string,
  message: string,
  link: string = "/dashboard"
): Promise<void> {
  try {
    const notifId = `notif_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 6)}`;
    const newNotif: AppNotification = {
      id: notifId,
      recipientId: recipientUid,
      title,
      message,
      link,
      read: false,
      createdAt: new Date().toISOString(),
    };

    try {
      await setDoc(doc(db, "notifications", notifId), newNotif);
    } catch {}

    if (recipientUid !== "STAFF") {
      const appRef = doc(db, "applications", recipientUid);
      const snap = await getDoc(appRef);
      if (snap.exists()) {
        const appData = snap.data() as VisaApplication;
        const currentList = normalizeToArray<AppNotification>(
          appData.notifications
        );
        await updateDoc(appRef, {
          notifications: [newNotif, ...currentList].slice(0, 25),
        });
      }
    }
  } catch {}
}

export async function recordSystemLog(params: {
  category: SystemLogCategory;
  eventType: string;
  outcome: SystemLogOutcome;
  actorEmail: string;
  actorName?: string;
  actorRole?: UserRole | "anonymous";
  targetResource?: string;
  details: string;
  metadata?: string;
}): Promise<void> {
  try {
    const logId = `syslog_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 7)}`;
    const entry: SystemLogEntry = {
      id: logId,
      timestamp: new Date().toISOString(),
      category: params.category,
      eventType: params.eventType,
      outcome: params.outcome,
      actorEmail: (params.actorEmail || "desconocido").toLowerCase(),
      actorName: params.actorName
        ? formatDisplayName(params.actorName)
        : params.actorEmail || "Usuario",
      actorRole: params.actorRole || "anonymous",
      targetResource: params.targetResource || "Sistema Global",
      details: params.details,
      ...(params.metadata ? { metadata: params.metadata } : {}),
    };

    await setDoc(doc(db, "system_logs", logId), entry);
  } catch {}
}