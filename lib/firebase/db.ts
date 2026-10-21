// lib/firebase/db.ts
import { doc, setDoc } from "firebase/firestore";
import { db } from "./config";
import {
  AppNotification,
  ApplicationStatus,
  AuditLogEntry,
  DestinationCountry,
  PlanTier,
  UserProfile,
  UserRole,
  VisaApplication,
} from "@/types/visa";

export function formatDisplayName(name?: string | null): string {
  if (!name) return "";
  return name
    .replace(/([a-zñáéíóú])([A-ZÑÁÉÍÓÚ])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildAuditLogEntry(
  action: string,
  details: string,
  actorName: string,
  actorRole: UserRole = "client"
): AuditLogEntry {
  return {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    action,
    details,
    actorName: formatDisplayName(actorName) || "Usuario",
    actorRole,
    timestamp: new Date().toISOString(),
  };
}

export async function sendInternalNotification(
  recipientId: string,
  title: string,
  message: string,
  link?: string
): Promise<void> {
  if (!recipientId) return;
  try {
    const targets = recipientId === "STAFF" ? ["STAFF"] : [recipientId, "STAFF"];

    await Promise.all(
      targets.map(async (target) => {
        const id = `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${target}`;
        const payload: AppNotification = {
          id,
          recipientId: target,
          title,
          message,
          ...(link ? { link } : {}),
          read: false,
          createdAt: new Date().toISOString(),
        };
        await setDoc(doc(db, "notifications", id), payload);
      })
    );
  } catch {
    // Fallo silencioso
  }
}

export type StepSemaphore = "completed" | "in_progress" | "missing";

export function calculateApplicationMetrics(app?: VisaApplication | null): {
  progressPercentage: number;
  currentStep: number;
  autoStatus: ApplicationStatus;
  formSemaphore: StepSemaphore;
  vaultSemaphore: StepSemaphore;
  consularSemaphore: StepSemaphore;
} {
  if (!app) {
    return {
      progressPercentage: 20,
      currentStep: 1,
      autoStatus: "onboarding_pending",
      formSemaphore: "missing",
      vaultSemaphore: "missing",
      consularSemaphore: "missing",
    };
  }

  if (app.status === "approved" || app.status === "rejected") {
    return {
      progressPercentage: 100,
      currentStep: 4,
      autoStatus: app.status,
      formSemaphore: "completed",
      vaultSemaphore: "completed",
      consularSemaphore: "completed",
    };
  }

  const fd = app.formData;
  const hasAnyForm = Boolean(
    fd && (fd.nationalId || fd.mobilePhone || fd.homeAddress || fd.currentOccupation)
  );
  const isFormComplete = Boolean(
    fd &&
      fd.fullName &&
      fd.nationalId &&
      fd.mobilePhone &&
      fd.homeAddress &&
      fd.currentOccupation &&
      fd.estimatedArrivalDate
  );

  let formSemaphore: StepSemaphore = isFormComplete
    ? "completed"
    : hasAnyForm
    ? "in_progress"
    : "missing";

  const docsCount = app.documents ? Object.keys(app.documents).length : 0;
  const requiredMin = app.destination === "JAPAN" ? 4 : 3;
  let vaultSemaphore: StepSemaphore =
    docsCount >= requiredMin
      ? "completed"
      : docsCount > 0
      ? "in_progress"
      : "missing";

  const meetingsCount = app.meetings ? app.meetings.length : 0;
  const hasDeliverable = Boolean(
    (app.officialDeliverables && app.officialDeliverables.length > 0) ||
      app.consularSession?.officialDeliverableUrl
  );
  const isSessionBooked = app.consularSession?.status === "confirmed";

  let consularSemaphore: StepSemaphore =
    meetingsCount > 0 || hasDeliverable
      ? "completed"
      : isSessionBooked || app.assignedAdvisorId
      ? "in_progress"
      : "missing";

  let progress = 20;
  let step = 1;
  let autoStatus: ApplicationStatus = "onboarding_pending";

  if (formSemaphore === "in_progress") {
    progress = 35;
    step = 2;
  } else if (formSemaphore === "completed") {
    progress = 50;
    step = 2;
    autoStatus = "documents_pending";
  }

  if (vaultSemaphore === "in_progress") {
    progress = Math.max(progress, 65);
    step = 3;
    autoStatus = "in_legal_review";
  } else if (vaultSemaphore === "completed") {
    progress = Math.max(progress, 80);
    step = 3;
    autoStatus = "in_legal_review";
  }

  if (consularSemaphore === "completed" || isSessionBooked) {
    progress = Math.max(progress, 92);
    step = 4;
    autoStatus = "ready_for_consulate";
  }

  if (app.status === "documents_pending") {
    progress = Math.max(progress, 50);
    step = Math.max(step, 2);
    if (formSemaphore === "missing") formSemaphore = "in_progress";
    autoStatus = "documents_pending";
  } else if (app.status === "in_legal_review") {
    progress = Math.max(progress, 75);
    step = Math.max(step, 3);
    if (formSemaphore === "missing") formSemaphore = "completed";
    if (vaultSemaphore === "missing") vaultSemaphore = "in_progress";
    autoStatus = "in_legal_review";
  } else if (app.status === "ready_for_consulate") {
    progress = Math.max(progress, 92);
    step = 4;
    formSemaphore = "completed";
    vaultSemaphore = "completed";
    if (consularSemaphore === "missing") consularSemaphore = "in_progress";
    autoStatus = "ready_for_consulate";
  }

  return {
    progressPercentage: progress,
    currentStep: step,
    autoStatus,
    formSemaphore,
    vaultSemaphore,
    consularSemaphore,
  };
}

export async function initializeUserAndApplication(
  uid: string,
  email: string,
  fullName: string,
  destination: DestinationCountry = "USA",
  role: UserRole = "client",
  planTier: PlanTier = "Priority Pro",
  assignedAdvisorId: string = "",
  assignedAdvisorName: string = ""
): Promise<{ profile: UserProfile; application: VisaApplication }> {
  const now = new Date().toISOString();

  const profile: UserProfile = {
    uid,
    email: email.toLowerCase(),
    fullName: formatDisplayName(fullName),
    role,
    destination,
    planTier,
    createdAt: now,
  };

  const initialAudit = buildAuditLogEntry(
    "Provisionamiento de Expediente",
    `Cuenta activada e inicializada para trámite de ${destination} (Plan ${planTier}).`,
    fullName,
    role
  );

  const application: VisaApplication = {
    id: uid,
    userId: uid,
    clientName: formatDisplayName(fullName),
    clientEmail: email.toLowerCase(),
    destination,
    planTier,
    visaType:
      destination === "JAPAN"
        ? "Visa de Turismo Japón (Estancia Corta)"
        : "Visa B1/B2 Estados Unidos",
    status: "onboarding_pending",
    currentStep: 1,
    progressPercentage: 20,
    assignedAdvisorId,
    assignedAdvisorName: formatDisplayName(assignedAdvisorName),
    auditLogs: [initialAudit],
    updatedAt: now,
  };

  await setDoc(doc(db, "users", uid), profile);
  await setDoc(doc(db, "applications", uid), application);

  return { profile, application };
}