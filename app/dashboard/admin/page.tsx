// app/dashboard/admin/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  DashboardLayout,
  DashboardContentSkeleton,
} from "@/components/dashboard/DashboardLayout";
import { BrandLogoIcon } from "@/components/ui/BrandLogo";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDocs,
  setDoc,
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  ConsularResourceItem,
  DestinationCountry,
  PlanTier,
  PreApprovedUser,
  SystemLogCategory,
  SystemLogEntry,
  SystemLogOutcome,
  UserProfile,
  UserRole,
  VisaApplication,
} from "@/types/visa";
import {
  buildAuditLogEntry,
  calculateApplicationMetrics,
  formatDisplayName,
  recordSystemLog,
  sendInternalNotification,
} from "@/lib/firebase/db";
import {
  UserPlus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
  ExternalLink,
  Flame,
  Briefcase,
  BarChart3,
  HandMetal,
  XCircle,
  BookOpen,
  Plus,
  UploadCloud,
  Video,
  Sparkles,
  Link2,
  UserCircle,
  FolderKanban,
  X,
  TerminalSquare,
  Search,
  Download,
  Lock,
  FolderLock,
  Activity,
  ShieldCheck,
} from "lucide-react";

const inputBaseClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 px-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

function AdminDashboardContent() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") || "gobernanza";
  const validTabs = [
    "gobernanza",
    "bolsa",
    "mis-casos",
    "clientes",
    "sala-cms",
    "equipo",
    "logs",
  ];
  const activeTab = validTabs.includes(rawTab) ? rawTab : "gobernanza";

  const [allowedList, setAllowedList] = useState<PreApprovedUser[]>([]);
  const [applicationsList, setApplicationsList] = useState<VisaApplication[]>(
    []
  );
  const [consularResources, setConsularResources] = useState<
    ConsularResourceItem[]
  >([]);
  const [systemLogs, setSystemLogs] = useState<SystemLogEntry[]>([]);
  const [loadingData, setLoadingData] = useState(true);

  // Filtros para el Centro de Logs & Auditoría (Tab = logs)
  const [logSubTab, setLogSubTab] = useState<"ALL" | SystemLogCategory>("ALL");
  const [logOutcomeFilter, setLogOutcomeFilter] = useState<
    "ALL" | SystemLogOutcome
  >("ALL");
  const [logSearchQuery, setLogSearchQuery] = useState("");

  // Formulario Alta de Cliente
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDestination, setClientDestination] =
    useState<DestinationCountry>("USA");
  const [clientPlan, setClientPlan] = useState<PlanTier>("Priority Pro");

  // Formulario Alta de Staff (Asesor / Admin)
  const [staffEmail, setStaffEmail] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<UserRole>("advisor");

  // Estudio de Publicación Fintech Unificado a 3 formatos
  const [postFormat, setPostFormat] = useState<"web" | "file" | "note">("web");
  const [resTitle, setResTitle] = useState("");
  const [resDesc, setResDesc] = useState("");
  const [resDest, setResDest] = useState<DestinationCountry | "ALL">("ALL");
  const [resUrl, setResUrl] = useState("");
  const [resFile, setResFile] = useState<File | null>(null);
  const [uploadingRes, setUploadingRes] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  useEffect(() => {
    setFeedback("");
    setErrorMsg("");
  }, [activeTab]);

  useEffect(() => {
    if (!feedback && !errorMsg) return;
    const timer = setTimeout(() => {
      setFeedback("");
      setErrorMsg("");
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedback, errorMsg]);

  const fetchBackofficeData = async () => {
    setLoadingData(true);
    try {
      const allowedSnap = await getDocs(collection(db, "allowed_emails"));
      const allowed: PreApprovedUser[] = [];
      allowedSnap.forEach((d) => allowed.push(d.data() as PreApprovedUser));
      setAllowedList(allowed);

      const usersSnap = await getDocs(collection(db, "users"));
      const allUsers: UserProfile[] = [];
      const staffUids = new Set<string>();
      usersSnap.forEach((d) => {
        const u = d.data() as UserProfile;
        allUsers.push(u);
        if (u.role === "admin" || u.role === "advisor") {
          staffUids.add(u.uid);
        }
      });

      const appsSnap = await getDocs(collection(db, "applications"));
      const apps: VisaApplication[] = [];
      appsSnap.forEach((d) => {
        const appData = d.data() as VisaApplication;
        if (!staffUids.has(appData.userId)) {
          apps.push(appData);
        }
      });
      setApplicationsList(apps);

      try {
        const resSnap = await getDocs(collection(db, "consular_resources"));
        const resources: ConsularResourceItem[] = [];
        resSnap.forEach((d) => {
          if (d.id !== "settings_booking") {
            resources.push(d.data() as ConsularResourceItem);
          }
        });
        resources.sort((a, b) =>
          (b.updatedAt || "").localeCompare(a.updatedAt || "")
        );
        setConsularResources(resources);
      } catch {}

      // Consolidación Inteligente de Logs (system_logs + auditLogs de Casos + Eventos IAM/Auth)
      const unifiedLogs: SystemLogEntry[] = [];
      const seenIds = new Set<string>();

      try {
        const sysLogsSnap = await getDocs(collection(db, "system_logs"));
        sysLogsSnap.forEach((d) => {
          const item = d.data() as SystemLogEntry;
          unifiedLogs.push(item);
          seenIds.add(item.id);
        });
      } catch {}

      // Extraer Trazabilidad de Expedientes & Bóveda PII desde applications.auditLogs
      apps.forEach((app) => {
        const clientLabel = `${formatDisplayName(
          app.formData?.fullName || app.clientName || "Cliente"
        )} (${app.destination})`;

        (app.auditLogs || []).forEach((aLog) => {
          if (seenIds.has(aLog.id)) return;
          seenIds.add(aLog.id);

          const lowerAction = (aLog.action || "").toLowerCase();
          const isVaultEvent =
            lowerAction.includes("bóveda") ||
            lowerAction.includes("documento") ||
            lowerAction.includes("purga") ||
            lowerAction.includes("entregable") ||
            lowerAction.includes("pdf");

          const isCritical =
            lowerAction.includes("rechaz") || lowerAction.includes("purga");

          unifiedLogs.push({
            id: aLog.id,
            timestamp: aLog.timestamp,
            category: isVaultEvent ? "PII_VAULT" : "CASE_TRACEABILITY",
            eventType: aLog.action,
            outcome: isCritical ? "WARNING" : "SUCCESS",
            actorEmail: aLog.actorName,
            actorName: formatDisplayName(aLog.actorName),
            actorRole: aLog.actorRole,
            targetResource: clientLabel,
            details: aLog.details,
          });
        });
      });

      // Extraer Eventos de Autenticación / Primer Ingreso desde users
      allUsers.forEach((u) => {
        const synthId = `auth_init_${u.uid}`;
        if (!seenIds.has(synthId) && u.createdAt) {
          seenIds.add(synthId);
          unifiedLogs.push({
            id: synthId,
            timestamp: u.createdAt,
            category: "SECURITY_AUTH",
            eventType: "Autenticación & Provisionamiento Token",
            outcome: "SUCCESS",
            actorEmail: u.email,
            actorName: formatDisplayName(u.fullName),
            actorRole: u.role,
            targetResource: "Firebase Auth • Token 8h",
            details: `Sesión verificada y perfil sincronizado con rol [${u.role.toUpperCase()}].`,
          });
        }
      });

      // Extraer Eventos de Gobernanza IAM desde allowed_emails
      allowed.forEach((a) => {
        const iamId = `iam_allow_${a.email}`;
        if (!seenIds.has(iamId) && a.createdAt) {
          seenIds.add(iamId);
          unifiedLogs.push({
            id: iamId,
            timestamp: a.createdAt,
            category: "IAM_GOVERNANCE",
            eventType:
              a.role === "client"
                ? "Alta de Cliente en Lista Blanca"
                : `Autorización de Staff (${a.role.toUpperCase()})`,
            outcome: "INFO",
            actorEmail: a.createdBy || "admin",
            actorName: a.createdBy || "Admin",
            actorRole: "admin",
            targetResource: `${formatDisplayName(a.fullName)} (${a.email})`,
            details: `Acceso habilitado para destino ${
              a.destination || "USA"
            } • Plan ${a.planTier || "Essential"}.`,
          });
        }
      });

      unifiedLogs.sort((a, b) =>
        (b.timestamp || "").localeCompare(a.timestamp || "")
      );
      setSystemLogs(unifiedLogs);
    } catch {
      setErrorMsg("Error al sincronizar datos del Backoffice.");
    } finally {
      setLoadingData(false);
    }
  };

  useEffect(() => {
    if (isStaff) {
      fetchBackofficeData();
    }
  }, [isStaff]);

  const handleClaimCase = async (app: VisaApplication) => {
    if (!user || !profile) return;
    setFeedback("");
    setErrorMsg("");
    try {
      const cleanAdvisorName = formatDisplayName(profile.fullName);
      const metrics = calculateApplicationMetrics(app);

      const audit = buildAuditLogEntry(
        "Reclamo de Expediente en Bolsa",
        `${cleanAdvisorName} tomó la titularidad del caso desde la Bolsa de Casos.`,
        cleanAdvisorName,
        profile.role
      );

      await updateDoc(doc(db, "applications", app.id), {
        assignedAdvisorId: user.uid,
        assignedAdvisorName: cleanAdvisorName,
        assignedAdvisorEmail: profile.email,
        assignedAdvisorBookingUrl: profile.bookingUrl || "",
        status: metrics.autoStatus,
        progressPercentage: metrics.progressPercentage,
        currentStep: metrics.currentStep,
        auditLogs: [audit, ...(app.auditLogs || [])],
        updatedAt: new Date().toISOString(),
      });

      await recordSystemLog({
        category: "CASE_TRACEABILITY",
        eventType: "Reclamo de Expediente en Bolsa",
        outcome: "SUCCESS",
        actorEmail: profile.email,
        actorName: cleanAdvisorName,
        actorRole: profile.role,
        targetResource: `${formatDisplayName(
          app.formData?.fullName || app.clientName
        )} (${app.destination})`,
        details: `${cleanAdvisorName} asumió la titularidad jurídica del expediente.`,
      });

      await sendInternalNotification(
        app.id,
        `Especialista Asignado: ${cleanAdvisorName}`,
        `${cleanAdvisorName} ha tomado tu expediente. Ya puedes agendar tu sesión 1-a-1 en la Sala Consular.`,
        "/dashboard/sala-entrenamiento"
      );

      setFeedback(
        `¡Has tomado el caso de ${formatDisplayName(
          app.formData?.fullName || app.clientName
        )}! Haz clic en "Gestionar Caso" para abrir su Workspace.`
      );
      await fetchBackofficeData();
    } catch {
      setErrorMsg("No se pudo reclamar el expediente.");
    }
  };

  const handleCreateConsularResource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== "admin") return;
    setSubmitting(true);
    setUploadingRes(true);
    setFeedback("");
    setErrorMsg("");

    try {
      let finalUrl = resUrl.trim();
      let savedStoragePath = "";

      if (postFormat === "file") {
        if (!resFile) {
          setErrorMsg(
            "Por favor selecciona un archivo PDF o imagen para subir."
          );
          setSubmitting(false);
          setUploadingRes(false);
          return;
        }
        const safeName = resFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        savedStoragePath = `consular_blog/${Date.now()}_${safeName}`;
        const fileRef = ref(storage, savedStoragePath);
        await uploadBytes(fileRef, resFile);
        finalUrl = await getDownloadURL(fileRef);
      }

      let detectedCategory: ConsularResourceItem["category"] = "Tip Consular";
      if (postFormat === "file") {
        detectedCategory = "Guia";
      } else if (postFormat === "web") {
        const lowerUrl = finalUrl.toLowerCase();
        if (lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be")) {
          detectedCategory = "Video YouTube";
        } else if (lowerUrl.includes("instagram.com")) {
          detectedCategory = "Instagram / Post";
        } else {
          detectedCategory = "Tip Consular";
        }
      }

      const id = `res_${Date.now()}`;
      const newRes: ConsularResourceItem = {
        id,
        title: resTitle.trim(),
        description: resDesc.trim(),
        category: detectedCategory,
        destination: resDest,
        ...(finalUrl ? { url: finalUrl } : {}),
        ...(savedStoragePath ? { storagePath: savedStoragePath } : {}),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "consular_resources", id), newRes);

      await recordSystemLog({
        category: "PII_VAULT",
        eventType: "Publicación en Sala Consular",
        outcome: "SUCCESS",
        actorEmail: profile.email,
        actorName: profile.fullName,
        actorRole: profile.role,
        targetResource: `Sala Consular (${resDest})`,
        details: `Recurso publicado: "${newRes.title}" [${detectedCategory}].`,
      });

      setFeedback(
        `¡Publicación "${newRes.title}" publicada en la Sala Consular!`
      );
      setResTitle("");
      setResDesc("");
      setResUrl("");
      setResFile(null);
      await fetchBackofficeData();
    } catch {
      setErrorMsg("No se pudo publicar el recurso.");
    } finally {
      setSubmitting(false);
      setUploadingRes(false);
    }
  };

  const handleDeleteConsularResource = async (item: ConsularResourceItem) => {
    try {
      if (item.storagePath) {
        try {
          await deleteObject(ref(storage, item.storagePath));
        } catch {}
      } else if (
        item.url &&
        item.url.includes("firebasestorage.googleapis.com")
      ) {
        try {
          await deleteObject(ref(storage, item.url));
        } catch {}
      }
      await deleteDoc(doc(db, "consular_resources", item.id));

      if (profile) {
        await recordSystemLog({
          category: "PII_VAULT",
          eventType: "Eliminación de Recurso Editorial",
          outcome: "WARNING",
          actorEmail: profile.email,
          actorName: profile.fullName,
          actorRole: profile.role,
          targetResource: item.title,
          details: `Se eliminó la publicación y su archivo asociado en Firebase Storage.`,
        });
      }

      await fetchBackofficeData();
      setFeedback(
        "Publicación y archivo de Storage eliminados correctamente."
      );
    } catch {
      setErrorMsg("No se pudo eliminar la publicación.");
    }
  };

  const handleRegisterClient = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setFeedback("");
    setErrorMsg("");

    const cleanEmail = clientEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    try {
      const payload: PreApprovedUser = {
        email: cleanEmail,
        fullName: formatDisplayName(clientName.trim()),
        phone: clientPhone.trim(),
        role: "client",
        destination: clientDestination,
        planTier: clientPlan,
        createdBy: profile?.email || "staff",
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "allowed_emails", cleanEmail), payload);

      await recordSystemLog({
        category: "IAM_GOVERNANCE",
        eventType: "Provisionamiento de Nuevo Cliente",
        outcome: "SUCCESS",
        actorEmail: profile?.email || "staff",
        actorName: profile?.fullName || "Staff",
        actorRole: profile?.role || "admin",
        targetResource: `${payload.fullName} (${cleanEmail})`,
        details: `Cliente autorizado para ruta ${clientDestination} • Plan ${clientPlan}.`,
      });

      setFeedback(`Cliente ${payload.fullName} registrado con éxito.`);
      setClientEmail("");
      setClientName("");
      setClientPhone("");
      await fetchBackofficeData();
    } catch {
      setErrorMsg("No se pudo registrar el cliente.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== "admin") return;
    setSubmitting(true);
    setFeedback("");
    setErrorMsg("");

    const cleanEmail = staffEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    try {
      const payload: PreApprovedUser = {
        email: cleanEmail,
        fullName: formatDisplayName(staffName.trim()),
        role: staffRole,
        destination: "USA",
        planTier: "VIP",
        createdBy: profile?.email || "admin",
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "allowed_emails", cleanEmail), payload);

      await recordSystemLog({
        category: "IAM_GOVERNANCE",
        eventType: `Alta de Personal Interno (${staffRole.toUpperCase()})`,
        outcome: "SUCCESS",
        actorEmail: profile.email,
        actorName: profile.fullName,
        actorRole: profile.role,
        targetResource: `${payload.fullName} (${cleanEmail})`,
        details: `Se otorgaron privilegios de ${
          staffRole === "admin" ? "Administrador" : "Asesor Legal"
        }.`,
      });

      setFeedback(
        `Personal autorizado como ${
          staffRole === "admin" ? "Admin" : "Asesor"
        }.`
      );
      setStaffEmail("");
      setStaffName("");
      await fetchBackofficeData();
    } catch {
      setErrorMsg("No se pudo registrar al miembro del equipo.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRevokeEmail = async (emailToDelete: string) => {
    try {
      await deleteDoc(doc(db, "allowed_emails", emailToDelete));

      if (profile) {
        await recordSystemLog({
          category: "IAM_GOVERNANCE",
          eventType: "Revocación de Acceso (Lista Blanca)",
          outcome: "CRITICAL",
          actorEmail: profile.email,
          actorName: profile.fullName,
          actorRole: profile.role,
          targetResource: emailToDelete,
          details: `Se eliminó el correo ${emailToDelete} de allowed_emails.`,
        });
      }

      await fetchBackofficeData();
      setFeedback("Acceso revocado correctamente.");
    } catch {
      setErrorMsg("No se pudo revocar el acceso.");
    }
  };

  const handleExportLogsCsv = (logsToExport: SystemLogEntry[]) => {
    const headers = [
      "Timestamp",
      "Categoria",
      "Tipo de Evento",
      "Resultado",
      "Actor",
      "Rol",
      "Expediente / Objetivo",
      "Detalle",
    ];
    const rows = logsToExport.map((l) => [
      new Date(l.timestamp).toLocaleString("es-CO"),
      l.category,
      `"${(l.eventType || "").replace(/"/g, '""')}"`,
      l.outcome,
      `"${(l.actorName || l.actorEmail || "").replace(/"/g, '""')}"`,
      l.actorRole,
      `"${(l.targetResource || "").replace(/"/g, '""')}"`,
      `"${(l.details || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `GVC_Audit_Logs_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!isStaff) {
    return (
      <div className="rounded-2xl bg-brand-red/10 border border-brand-red/30 p-8 text-center space-y-3">
        <ShieldAlert className="h-10 w-10 text-brand-red mx-auto" />
        <h2 className="font-display text-2xl font-bold text-brand-charcoal">
          Acceso Exclusivo Backoffice
        </h2>
      </div>
    );
  }

  if (loadingData && applicationsList.length === 0 && allowedList.length === 0) {
    return <DashboardContentSkeleton />;
  }

  const unassignedCases = applicationsList.filter((a) => !a.assignedAdvisorId);
  const myAssignedCases = applicationsList.filter(
    (a) => a.assignedAdvisorId === user?.uid
  );
  const clientPreApprovedList = allowedList.filter((u) => u.role === "client");
  const staffPreApprovedList = allowedList.filter(
    (u) => u.role === "admin" || u.role === "advisor"
  );

  const usaCasesCount = applicationsList.filter(
    (a) => a.destination === "USA"
  ).length;
  const japanCasesCount = applicationsList.filter(
    (a) => a.destination === "JAPAN"
  ).length;
  const approvedCount = applicationsList.filter(
    (a) => a.status === "approved"
  ).length;
  const rejectedCount = applicationsList.filter(
    (a) => a.status === "rejected"
  ).length;

  // Filtrado de Logs para la vista ?tab=logs
  const filteredLogs = systemLogs.filter((entry) => {
    const matchesCategory =
      logSubTab === "ALL" || entry.category === logSubTab;
    const matchesOutcome =
      logOutcomeFilter === "ALL" || entry.outcome === logOutcomeFilter;
    const q = logSearchQuery.trim().toLowerCase();
    const matchesSearch =
      !q ||
      entry.eventType.toLowerCase().includes(q) ||
      entry.actorName.toLowerCase().includes(q) ||
      entry.actorEmail.toLowerCase().includes(q) ||
      (entry.targetResource || "").toLowerCase().includes(q) ||
      entry.details.toLowerCase().includes(q);

    return matchesCategory && matchesOutcome && matchesSearch;
  });

  const getCategoryBadge = (cat: SystemLogCategory) => {
    switch (cat) {
      case "SECURITY_AUTH":
        return {
          label: "Sign-In & Seguridad",
          className: "bg-brand-charcoal text-white",
        };
      case "CASE_TRACEABILITY":
        return {
          label: "Trazabilidad de Caso",
          className: "bg-blue-600/15 text-blue-900 border border-blue-600/30",
        };
      case "PII_VAULT":
        return {
          label: "Bóveda PII & Storage",
          className:
            "bg-purple-600/15 text-purple-900 border border-purple-600/30",
        };
      case "IAM_GOVERNANCE":
        return {
          label: "Gobernanza & IAM",
          className:
            "bg-amber-500/15 text-amber-900 border border-amber-500/30",
        };
    }
  };

  const getOutcomeBadge = (outcome: SystemLogOutcome) => {
    switch (outcome) {
      case "SUCCESS":
        return {
          label: "EXITOSO",
          className: "bg-emerald-500/15 text-emerald-800",
        };
      case "WARNING":
        return {
          label: "ALERTA / AJUSTE",
          className: "bg-amber-500/15 text-amber-900",
        };
      case "CRITICAL":
        return {
          label: "CRÍTICO / REVOCADO",
          className: "bg-brand-red/15 text-brand-red",
        };
      case "INFO":
        return {
          label: "INFORMATIVO",
          className: "bg-brand-platinum text-brand-charcoal",
        };
    }
  };

  return (
    <div className="space-y-8 font-sans">
      {feedback && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-700 transition-all">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback("")}
            className="rounded-lg p-1 text-emerald-700/70 hover:bg-emerald-500/20 hover:text-emerald-900 transition-colors"
            aria-label="Cerrar alerta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 text-xs font-semibold text-brand-red transition-all">
          <div className="flex items-center gap-3">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg("")}
            className="rounded-lg p-1 text-brand-red/70 hover:bg-brand-red/20 hover:text-brand-red transition-colors"
            aria-label="Cerrar alerta"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* VISTA 1: GOBERNANZA & MÉTRICAS */}
      {activeTab === "gobernanza" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl bg-brand-white p-5 border border-brand-charcoal/10 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-charcoal/75">
                <span>Total Casos</span>
                <BarChart3 className="h-4 w-4 text-brand-red" />
              </div>
              <p className="font-display text-3xl font-bold text-brand-charcoal">
                {applicationsList.length}
              </p>
              <p className="text-[11px] font-medium text-brand-charcoal/70">
                🇺🇸 {usaCasesCount} EE. UU. • 🇯🇵 {japanCasesCount} Japón
              </p>
            </div>

            <div className="rounded-2xl bg-brand-white p-5 border border-brand-charcoal/10 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-charcoal/75">
                <span>Bolsa de Casos</span>
                <Flame className="h-4 w-4 text-amber-500" />
              </div>
              <p className="font-display text-3xl font-bold text-brand-red">
                {unassignedCases.length}
              </p>
              <p className="text-[11px] font-medium text-brand-charcoal/70">
                Sin asesor asignado
              </p>
            </div>

            <div className="rounded-2xl bg-brand-white p-5 border border-brand-charcoal/10 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-brand-charcoal/75">
                <span>Mis Procesos</span>
                <Briefcase className="h-4 w-4 text-brand-charcoal" />
              </div>
              <p className="font-display text-3xl font-bold text-brand-charcoal">
                {myAssignedCases.length}
              </p>
              <p className="text-[11px] font-medium text-brand-charcoal/70">
                A cargo tuyo
              </p>
            </div>

            <div className="rounded-2xl bg-brand-white p-5 border border-emerald-500/25 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-emerald-800 font-semibold">
                <span>Visas Aprobadas</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="font-display text-3xl font-bold text-emerald-700">
                {approvedCount}
              </p>
              <p className="text-[11px] font-medium text-brand-charcoal/70">
                Casos exitosos
              </p>
            </div>

            <div className="rounded-2xl bg-brand-white p-5 border border-brand-red/25 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-brand-red font-semibold">
                <span>Visas Rechazadas</span>
                <XCircle className="h-4 w-4 text-brand-red" />
              </div>
              <p className="font-display text-3xl font-bold text-brand-red">
                {rejectedCount}
              </p>
              <p className="text-[11px] font-medium text-brand-charcoal/70">
                Negadas en consulado
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
              <div>
                <h2 className="font-display text-lg font-bold text-brand-charcoal">
                  Monitor Maestro de Operaciones
                </h2>
                <p className="text-xs text-brand-charcoal/70">
                  El porcentaje de avance se calcula automáticamente según
                  cuestionario, bóveda y meetings.
                </p>
              </div>
            </div>

            {applicationsList.length === 0 ? (
              <p className="text-xs text-brand-charcoal/70 py-6 text-center">
                Aún no hay expedientes activos de clientes.
              </p>
            ) : (
              <div className="space-y-3">
                {applicationsList.map((app) => {
                  const m = calculateApplicationMetrics(app);
                  return (
                    <div
                      key={app.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-brand-platinum/30 p-4 border border-brand-platinum"
                    >
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-brand-charcoal">
                            {formatDisplayName(
                              app.formData?.fullName || app.clientName
                            ) || "Cliente"}
                          </span>
                          <span className="rounded-full bg-brand-charcoal px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">
                            {app.destination === "JAPAN"
                              ? "🇯🇵 Japón"
                              : "🇺🇸 EE. UU."}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              app.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-800"
                                : app.status === "rejected"
                                ? "bg-brand-red/15 text-brand-red"
                                : "bg-brand-platinum text-brand-charcoal/85"
                            }`}
                          >
                            {m.progressPercentage}% • {app.status}
                          </span>
                        </div>
                        <p className="text-xs text-brand-charcoal/70">
                          Correo: {app.clientEmail || "---"} • Asesor:{" "}
                          <strong className="text-brand-charcoal">
                            {formatDisplayName(app.assignedAdvisorName) ||
                              "⚠️ Sin Asignar (En Bolsa)"}
                          </strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!app.assignedAdvisorId && (
                          <button
                            type="button"
                            onClick={() => handleClaimCase(app)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-xs font-bold text-amber-900 hover:bg-amber-500/25 transition-all"
                          >
                            <HandMetal className="h-3.5 w-3.5" />
                            <span>Tomar Caso</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/dashboard/admin/caso/${app.id}`)
                          }
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red/90 transition-all"
                        >
                          <FolderKanban className="h-3.5 w-3.5" />
                          <span>Gestionar Caso</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA 2: BOLSA DE CASOS */}
      {activeTab === "bolsa" && (
        <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
                <Flame className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-brand-charcoal">
                  Bolsa de Casos
                </h2>
                <p className="text-xs text-brand-charcoal/70">
                  Expedientes nuevos disponibles para ser tomados por un Asesor.
                </p>
              </div>
            </div>
            <span className="rounded-full bg-brand-red/10 px-3 py-1 text-xs font-bold text-brand-red">
              {unassignedCases.length} disponibles
            </span>
          </div>

          {unassignedCases.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto" />
              <p className="text-sm font-bold text-brand-charcoal">
                ¡Bolsa al día! Todos los casos tienen asesor asignado.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {unassignedCases.map((app) => {
                const m = calculateApplicationMetrics(app);
                return (
                  <div
                    key={app.id}
                    className="rounded-2xl bg-brand-platinum/30 p-5 border border-brand-platinum flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="rounded-full bg-brand-charcoal px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">
                          {app.destination === "JAPAN"
                            ? "🇯🇵 Japón"
                            : "🇺🇸 EE. UU."}
                        </span>
                        <span className="text-xs font-bold text-brand-red">
                          Avance: {m.progressPercentage}%
                        </span>
                      </div>
                      <h3 className="font-display text-base font-bold text-brand-charcoal pt-1">
                        {formatDisplayName(
                          app.formData?.fullName || app.clientName
                        ) || "Cliente Nuevo"}
                      </h3>
                      <p className="text-xs text-brand-charcoal/70">
                        {app.clientEmail} • {app.visaType}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 pt-3 border-t border-brand-platinum">
                      <button
                        type="button"
                        onClick={() => handleClaimCase(app)}
                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-4 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-brand-red/90 transition-all"
                      >
                        <HandMetal className="h-4 w-4" />
                        <span>Asignarme este Caso</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/dashboard/admin/caso/${app.id}`)
                        }
                        className="inline-flex items-center justify-center rounded-full border border-brand-charcoal/15 bg-brand-white px-4 py-2.5 text-xs font-semibold text-brand-charcoal hover:bg-brand-platinum transition-all"
                      >
                        <span>Ver Caso</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA 3: MIS PROCESOS ASIGNADOS */}
      {activeTab === "mis-casos" && (
        <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
          <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-charcoal text-white">
                <Briefcase className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-display text-lg font-bold text-brand-charcoal">
                  Mis Procesos Asignados ({myAssignedCases.length})
                </h2>
                <p className="text-xs text-brand-charcoal/70">
                  Haz clic en &ldquo;Gestionar Caso&rdquo; para abrir la mesa de
                  trabajo completa del cliente.
                </p>
              </div>
            </div>
          </div>

          {myAssignedCases.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <p className="text-sm font-semibold text-brand-charcoal">
                Aún no tienes casos asignados.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myAssignedCases.map((app) => {
                const m = calculateApplicationMetrics(app);
                return (
                  <div
                    key={app.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-brand-platinum/30 p-4 border border-brand-platinum"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-bold text-brand-charcoal">
                          {formatDisplayName(
                            app.formData?.fullName || app.clientName
                          )}
                        </p>
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-800">
                          {m.progressPercentage}% • {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-brand-charcoal/70">
                        {app.visaType} • Tel:{" "}
                        {app.formData?.mobilePhone || "Pendiente"} • Meetings:{" "}
                        {app.meetings?.length || 0}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/dashboard/perfil?uid=${app.id}`)
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-brand-white px-4 py-2 text-xs font-semibold text-brand-charcoal hover:bg-brand-platinum transition-all"
                      >
                        <UserCircle className="h-3.5 w-3.5" />
                        <span>Perfil 360°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/dashboard/admin/caso/${app.id}`)
                        }
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-5 py-2 text-xs font-semibold text-white hover:bg-brand-red/90 transition-all shadow-sm"
                      >
                        <FolderKanban className="h-3.5 w-3.5" />
                        <span>Gestionar Caso</span>
                      </button>
                      <a
                        href={`/dashboard/admin/caso/${app.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir en nueva pestaña"
                        aria-label="Abrir expediente en nueva pestaña"
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-brand-charcoal/15 bg-brand-white text-brand-charcoal hover:bg-brand-charcoal hover:text-white transition-all"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VISTA 4: DIRECTORIO DE CLIENTES */}
      {activeTab === "clientes" && (
        <div className="space-y-6">
          <form
            onSubmit={handleRegisterClient}
            className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5"
          >
            <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
              <UserPlus className="h-5 w-5 text-brand-red" />
              <div>
                <h2 className="font-display text-base font-bold text-brand-charcoal">
                  Registrar Nuevo Cliente
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="space-y-1.5 lg:col-span-2">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Correo del Cliente
                </label>
                <input
                  type="email"
                  required
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="cliente@gmail.com"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="Ej. Sindy Rubio"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  País Destino
                </label>
                <select
                  value={clientDestination}
                  onChange={(e) =>
                    setClientDestination(e.target.value as DestinationCountry)
                  }
                  className={inputBaseClass}
                >
                  <option value="USA">🇺🇸 Estados Unidos</option>
                  <option value="JAPAN">🇯🇵 Japón</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Plan Contratado
                </label>
                <select
                  value={clientPlan}
                  onChange={(e) => setClientPlan(e.target.value as PlanTier)}
                  className={inputBaseClass}
                >
                  <option value="Essential">Essential ($190)</option>
                  <option value="Priority Pro">Priority Pro ($290)</option>
                  <option value="VIP">VIP ($450)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-brand-red px-7 py-3 text-xs font-semibold text-brand-white shadow-md hover:bg-brand-red/90 disabled:opacity-50 transition-all"
              >
                <UserPlus className="h-4 w-4" />
                <span>Dar de Alta Cliente</span>
              </button>
            </div>
          </form>

          <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-4">
            <h3 className="font-display text-base font-bold text-brand-charcoal">
              Cartera de Clientes Registrados ({clientPreApprovedList.length})
            </h3>

            {clientPreApprovedList.length === 0 ? (
              <p className="text-xs text-brand-charcoal/70">
                Aún no hay clientes.
              </p>
            ) : (
              <div className="space-y-2.5">
                {clientPreApprovedList.map((c) => {
                  const activeApp = applicationsList.find(
                    (a) =>
                      a.clientEmail?.toLowerCase() === c.email.toLowerCase()
                  );
                  const m = calculateApplicationMetrics(activeApp);
                  return (
                    <div
                      key={c.email}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-brand-platinum/30 p-4 border border-brand-platinum"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-brand-charcoal">
                            {formatDisplayName(c.fullName)}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              activeApp
                                ? "bg-emerald-500/15 text-emerald-800"
                                : "bg-amber-500/15 text-amber-800"
                            }`}
                          >
                            {activeApp
                              ? `Activo (${m.progressPercentage}%)`
                              : "Pendiente 1er Login"}
                          </span>
                        </div>
                        <p className="text-[11px] text-brand-charcoal/70">
                          {c.email} • {c.destination} • Plan{" "}
                          <strong>{c.planTier}</strong>
                          {activeApp?.assignedAdvisorName && (
                            <span>
                              {" "}
                              • Asesor:{" "}
                              <strong>
                                {formatDisplayName(
                                  activeApp.assignedAdvisorName
                                )}
                              </strong>
                            </span>
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            router.push(
                              activeApp
                                ? `/dashboard/perfil?uid=${activeApp.id}`
                                : `/dashboard/perfil?email=${encodeURIComponent(
                                    c.email
                                  )}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-brand-white px-4 py-1.5 text-xs font-semibold text-brand-charcoal hover:bg-brand-platinum transition-all"
                        >
                          <UserCircle className="h-3.5 w-3.5" />
                          <span>Perfil 360°</span>
                        </button>
                        {activeApp && (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(
                                `/dashboard/admin/caso/${activeApp.id}`
                              )
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-red/90 transition-all"
                          >
                            <FolderKanban className="h-3.5 w-3.5" />
                            <span>Gestionar Caso</span>
                          </button>
                        )}
                        {profile?.role === "admin" && (
                          <button
                            type="button"
                            onClick={() => handleRevokeEmail(c.email)}
                            className="p-2 text-brand-charcoal/50 hover:text-brand-red transition-colors"
                            aria-label={`Revocar acceso a ${c.email}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VISTA 5: ESTUDIO DE PUBLICACIÓN FINTECH PREMIUM */}
      {activeTab === "sala-cms" && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateConsularResource}
            className="rounded-3xl bg-brand-white border border-brand-charcoal/10 shadow-sm overflow-hidden"
          >
            <div className="bg-brand-charcoal px-7 py-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <BrandLogoIcon className="h-10 w-10" />
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-red">
                    <Sparkles className="h-3 w-3" />
                    <span>Estudio Editorial — Sala Consular</span>
                  </span>
                  <h2 className="font-display text-lg font-bold">
                    Nueva Publicación para el Portal de Clientes
                  </h2>
                </div>
              </div>

              <div className="inline-flex rounded-xl bg-white/10 p-1 border border-white/10 self-start sm:self-auto">
                {[
                  { id: "ALL", label: "🌎 Ambos" },
                  { id: "USA", label: "🇺🇸 EE. UU." },
                  { id: "JAPAN", label: "🇯🇵 Japón" },
                ].map((destOpt) => (
                  <button
                    key={destOpt.id}
                    type="button"
                    onClick={() => setResDest(destOpt.id as any)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                      resDest === destOpt.id
                        ? "bg-brand-red text-white shadow-xs"
                        : "text-white/70 hover:text-white"
                    }`}
                  >
                    {destOpt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-7 space-y-6">
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/70">
                  1. Elige el formato de contenido
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    {
                      id: "web",
                      title: "Recurso Web / Redes",
                      sub: "YouTube, Instagram, Facebook o Link",
                      icon: Video,
                    },
                    {
                      id: "file",
                      title: "Subir PDF / Guía",
                      sub: "Archivo con vista previa interactiva",
                      icon: UploadCloud,
                    },
                    {
                      id: "note",
                      title: "Nota / Tip Legal",
                      sub: "Artículo o consejo editorial",
                      icon: BookOpen,
                    },
                  ].map((fmt) => {
                    const Icon = fmt.icon;
                    const active = postFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => setPostFormat(fmt.id as any)}
                        className={`flex flex-col items-start rounded-2xl p-4 border text-left transition-all ${
                          active
                            ? "border-brand-red bg-brand-red/[0.04] ring-2 ring-brand-red/15"
                            : "border-brand-charcoal/10 bg-brand-platinum/30 hover:bg-brand-platinum/60"
                        }`}
                      >
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl mb-2.5 ${
                            active
                              ? "bg-brand-red text-white"
                              : "bg-brand-charcoal/10 text-brand-charcoal"
                          }`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="font-display text-xs font-bold text-brand-charcoal">
                          {fmt.title}
                        </span>
                        <span className="text-[11px] text-brand-charcoal/65 mt-0.5">
                          {fmt.sub}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    2. Título de la Publicación *
                  </label>
                  <input
                    type="text"
                    required
                    value={resTitle}
                    onChange={(e) => setResTitle(e.target.value)}
                    placeholder="Ej. Cómo responder en 20 segundos al Oficial Consular"
                    className={inputBaseClass}
                  />
                </div>

                {postFormat === "file" ? (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      3. Archivo PDF o Imagen *
                    </label>
                    <label className="cursor-pointer flex items-center justify-between h-11 rounded-xl border border-dashed border-brand-red/40 bg-brand-red/[0.02] px-4 text-xs font-semibold text-brand-charcoal hover:bg-brand-red/[0.06] transition-all">
                      <span className="truncate pr-2">
                        {resFile
                          ? `📄 ${resFile.name}`
                          : "Haz clic para elegir PDF o Imagen..."}
                      </span>
                      <span className="shrink-0 rounded-lg bg-brand-red px-2.5 py-1 text-[10px] font-bold text-white uppercase">
                        Explorar
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        onChange={(e) =>
                          setResFile(e.target.files?.[0] || null)
                        }
                      />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      3.{" "}
                      {postFormat === "web"
                        ? "Enlace URL (YouTube, Instagram, Facebook o Web) *"
                        : "Enlace Externo (Opcional)"}
                    </label>
                    <input
                      type="url"
                      required={postFormat === "web"}
                      value={resUrl}
                      onChange={(e) => setResUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=... o https://instagram.com/..."
                      className={inputBaseClass}
                    />
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    4. Notas o Contexto Editorial
                  </label>
                  <span className="rounded-md bg-brand-platinum px-2 py-0.5 text-[10px] font-semibold text-brand-charcoal/70">
                    Opcional
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={resDesc}
                  onChange={(e) => setResDesc(e.target.value)}
                  placeholder="Si deseas, agrega un resumen o instrucciones adicionales (puedes dejarlo en blanco)..."
                  className="w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 p-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all"
                />
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-brand-platinum">
                <p className="text-[11px] text-brand-charcoal/65">
                  Al eliminar una publicación de abajo, también se borra su
                  archivo de Firebase Storage.
                </p>
                <button
                  type="submit"
                  disabled={submitting || uploadingRes}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-red px-7 py-3 text-xs font-semibold text-brand-white shadow-md shadow-brand-red/20 hover:bg-brand-red/90 disabled:opacity-50 transition-all"
                >
                  <Plus className="h-4 w-4" />
                  <span>
                    {uploadingRes
                      ? "Publicando..."
                      : "Publicar en Sala Consular"}
                  </span>
                </button>
              </div>
            </div>
          </form>

          <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-4">
            <h3 className="font-display text-base font-bold text-brand-charcoal">
              Publicaciones Activas en el Feed ({consularResources.length})
            </h3>

            {consularResources.length === 0 ? (
              <p className="text-xs text-brand-charcoal/70">
                Aún no hay publicaciones personalizadas.
              </p>
            ) : (
              <div className="space-y-3">
                {consularResources.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl bg-brand-platinum/30 p-4 border border-brand-platinum"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded bg-brand-charcoal px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                          {item.destination === "ALL"
                            ? "🌎 Ambos"
                            : item.destination}
                        </span>
                        <span className="rounded bg-brand-red/10 px-2 py-0.5 text-[10px] font-bold text-brand-red uppercase">
                          {item.category}
                        </span>
                        <p className="text-xs font-bold text-brand-charcoal">
                          {item.title}
                        </p>
                      </div>
                      {item.description && (
                        <p className="text-xs text-brand-charcoal/70">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      {item.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-brand-red hover:underline"
                        >
                          <Link2 className="h-3.5 w-3.5" />
                          <span>Abrir Media</span>
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => handleDeleteConsularResource(item)}
                        className="p-2 text-brand-charcoal/50 hover:text-brand-red transition-colors"
                        title="Eliminar publicación y archivo de Storage"
                        aria-label={`Eliminar publicación ${item.title}`}
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

      {/* VISTA 6: EQUIPO & ROLES INTERNOS */}
      {activeTab === "equipo" && (
        <div className="space-y-6">
          <form
            onSubmit={handleRegisterStaff}
            className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5"
          >
            <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
              <ShieldAlert className="h-5 w-5 text-brand-red" />
              <div>
                <h2 className="font-display text-base font-bold text-brand-charcoal">
                  Agregar Personal Interno (Asesor y Admin)
                </h2>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Correo del Integrante
                </label>
                <input
                  type="email"
                  required
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="asesor@globalvisa.com"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Nombre
                </label>
                <input
                  type="text"
                  required
                  value={staffName}
                  onChange={(e) => setStaffName(e.target.value)}
                  placeholder="Ej. Camila Gómez"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Rol Interno
                </label>
                <select
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as UserRole)}
                  className={inputBaseClass}
                >
                  <option value="advisor">Asesor</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-7 py-3 text-xs font-semibold text-brand-white hover:bg-brand-red transition-all"
              >
                <UserPlus className="h-4 w-4" />
                <span>Autorizar Miembro</span>
              </button>
            </div>
          </form>

          <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-4">
            <h3 className="font-display text-base font-bold text-brand-charcoal">
              Personal Interno ({staffPreApprovedList.length})
            </h3>
            <div className="space-y-2.5">
              {staffPreApprovedList.map((s) => (
                <div
                  key={s.email}
                  className="flex items-center justify-between rounded-xl bg-brand-platinum/30 p-4 border border-brand-platinum"
                >
                  <div>
                    <p className="text-xs font-bold text-brand-charcoal">
                      {formatDisplayName(s.fullName)}{" "}
                      <span className="ml-1.5 rounded bg-brand-charcoal px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                        {s.role === "admin" ? "Admin" : "Asesor"}
                      </span>
                    </p>
                    <p className="text-[11px] text-brand-charcoal/70">
                      {s.email}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeEmail(s.email)}
                    className="text-brand-charcoal/50 hover:text-brand-red transition-colors"
                    aria-label={`Revocar acceso a ${s.email}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* VISTA 7: BITÁCORA MAESTRA DE LOGS & AUDITORÍA SIEM (SOLO ADMINS) */}
      {activeTab === "logs" && profile?.role === "admin" && (
        <div className="space-y-6">
          {/* Cabecera y Resumen por Categoría */}
          <div className="rounded-3xl bg-brand-charcoal text-brand-white p-6 sm:p-8 border border-white/10 shadow-lg space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div className="flex items-center gap-3.5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-red text-white shadow-md shadow-brand-red/25">
                  <TerminalSquare className="h-6 w-6" />
                </div>
                <div>
                  <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-brand-red">
                    SIEM LEGALTECH • ZERO-TRUST AUDIT TRAIL
                  </span>
                  <h2 className="font-display text-xl sm:text-2xl font-bold text-white">
                    Bitácora Maestra de Logs & Trazabilidad Forense
                  </h2>
                </div>
              </div>

              <button
                type="button"
                onClick={() => handleExportLogsCsv(filteredLogs)}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 hover:bg-brand-red px-5 py-2.5 text-xs font-bold text-white border border-white/15 transition-all self-start sm:self-auto"
              >
                <Download className="h-4 w-4" />
                <span>Exportar CSV ({filteredLogs.length})</span>
              </button>
            </div>

            {/* Sub-navegación de las 4 Categorías de Logs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {[
                {
                  id: "ALL",
                  title: "Todos los Eventos",
                  sub: "Vista unificada",
                  count: systemLogs.length,
                  icon: Activity,
                },
                {
                  id: "SECURITY_AUTH",
                  title: "Sign-In & Seguridad",
                  sub: "Accesos y sesiones",
                  count: systemLogs.filter(
                    (l) => l.category === "SECURITY_AUTH"
                  ).length,
                  icon: Lock,
                },
                {
                  id: "CASE_TRACEABILITY",
                  title: "Trazabilidad de Casos",
                  sub: "Flujo consular y estatus",
                  count: systemLogs.filter(
                    (l) => l.category === "CASE_TRACEABILITY"
                  ).length,
                  icon: FolderKanban,
                },
                {
                  id: "PII_VAULT",
                  title: "Bóveda PII & Storage",
                  sub: "Soportes y purgas",
                  count: systemLogs.filter((l) => l.category === "PII_VAULT")
                    .length,
                  icon: FolderLock,
                },
                {
                  id: "IAM_GOVERNANCE",
                  title: "Gobernanza & IAM",
                  sub: "Altas y revocaciones",
                  count: systemLogs.filter(
                    (l) => l.category === "IAM_GOVERNANCE"
                  ).length,
                  icon: ShieldCheck,
                },
              ].map((tabItem) => {
                const Icon = tabItem.icon;
                const isSelected = logSubTab === tabItem.id;
                return (
                  <button
                    key={tabItem.id}
                    type="button"
                    onClick={() => setLogSubTab(tabItem.id as any)}
                    className={`flex flex-col justify-between rounded-2xl p-4 border text-left transition-all ${
                      isSelected
                        ? "bg-brand-red border-brand-red text-white shadow-md"
                        : "bg-white/5 border-white/10 text-white/80 hover:bg-white/10"
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-2">
                      <Icon className="h-4 w-4" />
                      <span className="rounded-full bg-black/25 px-2.5 py-0.5 font-mono text-xs font-bold">
                        {tabItem.count}
                      </span>
                    </div>
                    <div>
                      <p className="font-display text-xs font-bold">
                        {tabItem.title}
                      </p>
                      <p className="text-[10px] opacity-75 mt-0.5">
                        {tabItem.sub}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Barra de Búsqueda y Filtro de Resultado */}
          <div className="rounded-2xl bg-brand-white p-5 border border-brand-charcoal/10 shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="relative flex-1">
              <Search className="h-4 w-4 text-brand-charcoal/45 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                placeholder="Buscar por usuario, correo, expediente, acción o detalle técnico..."
                aria-label="Buscar en los registros de auditoría"
                className="h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 pl-10 pr-4 text-xs sm:text-sm text-brand-charcoal placeholder:text-brand-charcoal/50 focus:bg-brand-white focus:border-brand-red focus:outline-none"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <label
                htmlFor="log-outcome-select"
                className="text-xs font-bold text-brand-charcoal/70"
              >
                Resultado:
              </label>
              <select
                id="log-outcome-select"
                value={logOutcomeFilter}
                onChange={(e) => setLogOutcomeFilter(e.target.value as any)}
                className="h-11 rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 px-3.5 text-xs font-bold text-brand-charcoal focus:border-brand-red focus:outline-none"
              >
                <option value="ALL">Todos los estados</option>
                <option value="SUCCESS">Exitoso (SUCCESS)</option>
                <option value="INFO">Informativo (INFO)</option>
                <option value="WARNING">Alerta / Ajuste (WARNING)</option>
                <option value="CRITICAL">Crítico / Revocado (CRITICAL)</option>
              </select>
            </div>
          </div>

          {/* Tabla Estructurada de Logs con Columnas */}
          <div className="rounded-2xl bg-brand-white border border-brand-charcoal/10 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-brand-platinum/60 border-b border-brand-charcoal/10 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-charcoal/75">
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      Timestamp (Fecha / Hora)
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Categoría</th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      Tipo de Evento
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      Actor & Rol
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">
                      Objetivo / Expediente
                    </th>
                    <th className="py-3.5 px-4 whitespace-nowrap">Resultado</th>
                    <th className="py-3.5 px-4 min-w-[260px]">
                      Detalle Técnico
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-platinum text-xs">
                  {filteredLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="py-12 text-center text-brand-charcoal/65 font-medium"
                      >
                        No se encontraron registros que coincidan con los
                        filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredLogs.map((logItem) => {
                      const catBadge = getCategoryBadge(logItem.category);
                      const outBadge = getOutcomeBadge(logItem.outcome);
                      return (
                        <tr
                          key={logItem.id}
                          className="hover:bg-brand-platinum/25 transition-colors"
                        >
                          <td className="py-3.5 px-4 font-mono text-[11px] text-brand-charcoal/80 whitespace-nowrap">
                            {new Date(logItem.timestamp).toLocaleString(
                              "es-CO",
                              {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                                second: "2-digit",
                              }
                            )}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 text-[10px] font-bold ${catBadge.className}`}
                            >
                              {catBadge.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 font-display font-bold text-brand-charcoal whitespace-nowrap">
                            {logItem.eventType}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              <span className="font-semibold text-brand-charcoal">
                                {logItem.actorName}
                              </span>
                              <span className="rounded bg-brand-charcoal/10 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase text-brand-charcoal">
                                {logItem.actorRole}
                              </span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4 font-medium text-brand-charcoal/85 whitespace-nowrap">
                            {logItem.targetResource || "Sistema Global"}
                          </td>
                          <td className="py-3.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[10px] font-bold ${outBadge.className}`}
                            >
                              {outBadge.label}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-brand-charcoal/75 leading-relaxed">
                            {logItem.details}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<DashboardContentSkeleton />}>
        <AdminDashboardContent />
      </Suspense>
    </DashboardLayout>
  );
}