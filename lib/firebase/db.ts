// lib/firebase/db.ts
import { auth, db } from "./config";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import {
  AppNotification,
  ApplicationStatus,
  AuditLogEntry,
  DestinationCountry,
  PlanTier,
  ScheduledMeetingItem,
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

function toIcsUtcTimestamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
}

export function getGoogleCalendarUrl(
  meeting: ScheduledMeetingItem,
  clientName?: string
): string {
  const start = new Date(meeting.dateTime);
  const safeStart = isNaN(start.getTime()) ? new Date() : start;
  const end = new Date(safeStart.getTime() + 45 * 60 * 1000);

  const datesParam = `${toIcsUtcTimestamp(safeStart)}/${toIcsUtcTimestamp(end)}`;
  const title = `${meeting.title} — Global Visa Consulting`;
  const details = [
    `Sesión Consular 1-a-1 con ${formatDisplayName(meeting.advisorName)}`,
    clientName ? `Titular: ${formatDisplayName(clientName)}` : "",
    meeting.meetUrl ? `Videollamada Google Meet: ${meeting.meetUrl}` : "",
    meeting.notes ? `Notas: ${meeting.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: datesParam,
    details,
    location: meeting.meetUrl || "Google Meet — Sala Consular GVC",
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadMeetingIcs(
  meeting: ScheduledMeetingItem,
  clientName?: string
): void {
  if (typeof window === "undefined") return;

  const start = new Date(meeting.dateTime);
  const safeStart = isNaN(start.getTime()) ? new Date() : start;
  const end = new Date(safeStart.getTime() + 45 * 60 * 1000);

  const cleanAdvisor = formatDisplayName(
    meeting.advisorName || "Especialista Legal GVC"
  );
  const cleanClient = formatDisplayName(clientName || "Titular");

  const descriptionLines = [
    `Sesión Consular 1-a-1 — Global Visa Consulting`,
    `Especialista Legal: ${cleanAdvisor}`,
    `Titular: ${cleanClient}`,
    meeting.meetUrl ? `Enlace Google Meet: ${meeting.meetUrl}` : "",
    meeting.notes ? `Notas: ${meeting.notes}` : "",
  ]
    .filter(Boolean)
    .join("\\n");

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Global Visa Consulting//Sala Consular 1-a-1//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${meeting.id}@globalvisaconsulting.com`,
    `DTSTAMP:${toIcsUtcTimestamp(new Date())}`,
    `DTSTART:${toIcsUtcTimestamp(safeStart)}`,
    `DTEND:${toIcsUtcTimestamp(end)}`,
    `SUMMARY:${meeting.title} — Global Visa Consulting`,
    `DESCRIPTION:${descriptionLines}`,
    `LOCATION:${meeting.meetUrl || "Google Meet"}`,
    "STATUS:CONFIRMED",
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Recordatorio: Tu sesión consular 1-a-1 inicia en 30 minutos",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([icsContent], {
    type: "text/calendar;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const slug = meeting.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

  link.href = url;
  link.setAttribute("download", `sesion-gvc-${slug || "consular"}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
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

  const docs = normalizeToArray<any>(app.documents);
  const deliverables = normalizeToArray<any>(app.officialDeliverables);
  const meetings = normalizeToArray<any>(app.meetings);

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
      eventType: (params.eventType || "Evento").slice(0, 115),
      outcome: params.outcome,
      actorEmail: (params.actorEmail || "desconocido").toLowerCase(),
      actorName: params.actorName
        ? formatDisplayName(params.actorName)
        : params.actorEmail || "Usuario",
      actorRole: params.actorRole || "anonymous",
      targetResource: (params.targetResource || "Sistema Global").slice(0, 120),
      details: (params.details || "").slice(0, 580),
      ...(params.metadata ? { metadata: params.metadata.slice(0, 300) } : {}),
    };

    await setDoc(doc(db, "system_logs", logId), entry);
  } catch {}
}

async function getBearerAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth.currentUser) {
    try {
      const idToken = await auth.currentUser.getIdToken();
      headers["Authorization"] = `Bearer ${idToken}`;
    } catch {}
  }
  return headers;
}

export async function sendTransactionalEmail(params: {
  to: string;
  subject: string;
  clientName: string;
  title: string;
  message: string;
  ctaLabel?: string;
  ctaUrl?: string;
  actorEmail?: string;
  actorName?: string;
  actorRole?: UserRole;
}): Promise<{ ok: boolean; simulated?: boolean }> {
  try {
    const appOrigin =
      typeof window !== "undefined"
        ? window.location.origin
        : "http://localhost:3000";

    const headers = await getBearerAuthHeaders();
    let ok = false;
    let simulated = true;

    try {
      const response = await fetch("/api/notifications/email", {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "SEND_EMAIL",
          ...params,
          ctaUrl: params.ctaUrl
            ? params.ctaUrl.startsWith("http")
              ? params.ctaUrl
              : `${appOrigin}${params.ctaUrl}`
            : `${appOrigin}/dashboard`,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        ok = Boolean(data.ok);
        simulated = Boolean(data.simulated);
      }
    } catch {
      simulated = true;
    }

    await recordSystemLog({
      category: "CASE_TRACEABILITY",
      eventType: `Correo Transaccional: ${params.title}`,
      outcome: ok ? "SUCCESS" : "WARNING",
      actorEmail: params.actorEmail || "sistema@globalvisa.com",
      actorName: params.actorName || "Motor Transaccional",
      actorRole: params.actorRole || "admin",
      targetResource: params.to,
      details: `${params.subject} (${
        simulated ? "Notificación registrada en SIEM" : "Enviado vía SMTP/Resend"
      }).`,
    });

    return { ok, simulated };
  } catch {
    return { ok: false, simulated: true };
  }
}

export async function requestServerTwoFactorOtp(params: {
  email: string;
  fullName: string;
  role: UserRole;
}): Promise<{
  ok: boolean;
  otpChallengeToken?: string;
  devOtpPreview?: string;
}> {
  try {
    const headers = await getBearerAuthHeaders();
    const res = await fetch("/api/notifications/email", {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "SEND_OTP",
        to: params.email,
        clientName: params.fullName,
      }),
    });

    const data = await res.json();

    await recordSystemLog({
      category: "SECURITY_AUTH",
      eventType: "Despacho de Desafío 2FA Criptográfico (Server-Side OTP)",
      outcome: data.ok ? "INFO" : "WARNING",
      actorEmail: params.email,
      actorName: params.fullName,
      actorRole: params.role,
      targetResource: "Motor HMAC-SHA256 2FA",
      details:
        "El servidor generó un código OTP de 6 dígitos con firma HMAC y lo envió al correo del titular.",
    });

    return {
      ok: Boolean(data.ok),
      otpChallengeToken: data.otpChallengeToken,
      devOtpPreview: data.devOtpPreview,
    };
  } catch {
    return { ok: false };
  }
}

export async function verifyServerTwoFactorOtp(params: {
  otpGuess: string;
  otpChallengeToken: string;
}): Promise<{ ok: boolean; twoFactorProof?: string; error?: string }> {
  try {
    const headers = await getBearerAuthHeaders();
    const res = await fetch("/api/notifications/email", {
      method: "POST",
      headers,
      body: JSON.stringify({
        action: "VERIFY_OTP",
        to: auth.currentUser?.email || "",
        otpGuess: params.otpGuess,
        otpChallengeToken: params.otpChallengeToken,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.verified) {
      return {
        ok: false,
        error: data.error || "Código de verificación inválido o expirado.",
      };
    }

    return {
      ok: true,
      twoFactorProof: data.twoFactorProof,
    };
  } catch {
    return {
      ok: false,
      error: "Error de red verificando el segundo factor.",
    };
  }
}