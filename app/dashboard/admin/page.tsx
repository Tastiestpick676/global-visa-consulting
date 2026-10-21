// app/dashboard/admin/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
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
  UserProfile,
  UserRole,
  VisaApplication,
} from "@/types/visa";
import { calculateApplicationMetrics } from "@/lib/firebase/db";
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
  Camera,
  Sparkles,
  Link2,
  UserCircle,
  FolderKanban,
} from "lucide-react";

const inputBaseClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 px-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

function AdminDashboardContent() {
  const { user, profile } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const rawTab = searchParams.get("tab") || "gobernanza";
  const validTabs = ["gobernanza", "bolsa", "mis-casos", "clientes", "sala-cms", "equipo"];
  const activeTab = validTabs.includes(rawTab) ? rawTab : "gobernanza";

  const [allowedList, setAllowedList] = useState<PreApprovedUser[]>([]);
  const [applicationsList, setApplicationsList] = useState<VisaApplication[]>([]);
  const [consularResources, setConsularResources] = useState<ConsularResourceItem[]>([]);

  // Formulario Alta de Cliente
  const [clientEmail, setClientEmail] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientDestination, setClientDestination] = useState<DestinationCountry>("USA");
  const [clientPlan, setClientPlan] = useState<PlanTier>("Priority Pro");

  // Formulario Alta de Staff (Asesor / Admin)
  const [staffEmail, setStaffEmail] = useState("");
  const [staffName, setStaffName] = useState("");
  const [staffRole, setStaffRole] = useState<UserRole>("advisor");

  // Estudio de Publicación Fintech (CMS Sala Consular)
  const [postFormat, setPostFormat] = useState<"youtube" | "instagram" | "file" | "note">("youtube");
  const [resTitle, setResTitle] = useState("");
  const [resDesc, setResDesc] = useState("");
  const [resDest, setResDest] = useState<DestinationCountry | "ALL">("ALL");
  const [resUrl, setResUrl] = useState("");
  const [resFile, setResFile] = useState<File | null>(null);
  const [uploadingRes, setUploadingRes] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  // 1. Limpiar alertas automáticamente cada vez que el usuario cambie de pestaña en el Sidebar
  useEffect(() => {
    setFeedback("");
    setErrorMsg("");
  }, [activeTab]);

  // 2. Auto-ocultar las alertas después de 5 segundos
  useEffect(() => {
    if (!feedback && !errorMsg) return;
    const timer = setTimeout(() => {
      setFeedback("");
      setErrorMsg("");
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedback, errorMsg]);

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  const fetchBackofficeData = async () => {
    try {
      const allowedSnap = await getDocs(collection(db, "allowed_emails"));
      const allowed: PreApprovedUser[] = [];
      allowedSnap.forEach((d) => allowed.push(d.data() as PreApprovedUser));
      setAllowedList(allowed);

      const usersSnap = await getDocs(collection(db, "users"));
      const staffUids = new Set<string>();
      usersSnap.forEach((d) => {
        const u = d.data() as UserProfile;
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
        resources.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
        setConsularResources(resources);
      } catch {}
    } catch {
      setErrorMsg("Error al sincronizar datos del Backoffice.");
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
      const metrics = calculateApplicationMetrics(app);
      await updateDoc(doc(db, "applications", app.id), {
        assignedAdvisorId: user.uid,
        assignedAdvisorName: profile.fullName,
        assignedAdvisorEmail: profile.email,
        assignedAdvisorBookingUrl: profile.bookingUrl || "",
        status: metrics.autoStatus,
        progressPercentage: metrics.progressPercentage,
        currentStep: metrics.currentStep,
        updatedAt: new Date().toISOString(),
      });
      setFeedback(
        `¡Has tomado el caso de ${app.formData?.fullName || app.clientName}! Haz clic en "Gestionar Caso" para abrir su Workspace.`
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
          setErrorMsg("Por favor selecciona un archivo PDF o imagen para subir.");
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

      const categoryMap = {
        youtube: "Video YouTube",
        instagram: "Instagram / Post",
        file: "Guia",
        note: "Tip Consular",
      };

      const id = `res_${Date.now()}`;
      const newRes: ConsularResourceItem = {
        id,
        title: resTitle.trim(),
        description: resDesc.trim(),
        category: categoryMap[postFormat] as any,
        destination: resDest,
        ...(finalUrl ? { url: finalUrl } : {}),
        ...(savedStoragePath ? { storagePath: savedStoragePath } : {}),
        updatedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "consular_resources", id), newRes);
      setFeedback(`¡Publicación "${newRes.title}" publicada en la Sala Consular!`);
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

  // Elimina tanto el documento de Firestore como el archivo físico en Firebase Storage
  const handleDeleteConsularResource = async (item: ConsularResourceItem) => {
    try {
      if (item.storagePath) {
        try {
          await deleteObject(ref(storage, item.storagePath));
        } catch {}
      } else if (item.url && item.url.includes("firebasestorage.googleapis.com")) {
        try {
          await deleteObject(ref(storage, item.url));
        } catch {}
      }
      await deleteDoc(doc(db, "consular_resources", item.id));
      await fetchBackofficeData();
      setFeedback("Publicación y archivo de Storage eliminados correctamente.");
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
        fullName: clientName.trim(),
        phone: clientPhone.trim(),
        role: "client",
        destination: clientDestination,
        planTier: clientPlan,
        createdBy: profile?.email || "staff",
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "allowed_emails", cleanEmail), payload);
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
        fullName: staffName.trim(),
        role: staffRole,
        destination: "USA",
        planTier: "VIP",
        createdBy: profile?.email || "admin",
        createdAt: new Date().toISOString(),
      };

      await setDoc(doc(db, "allowed_emails", cleanEmail), payload);
      setFeedback(`Personal autorizado como ${staffRole === "admin" ? "Admin" : "Asesor"}.`);
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
      await fetchBackofficeData();
    } catch {
      setErrorMsg("No se pudo revocar el acceso.");
    }
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

  const unassignedCases = applicationsList.filter((a) => !a.assignedAdvisorId);
  const myAssignedCases = applicationsList.filter(
    (a) => a.assignedAdvisorId === user?.uid
  );
  const clientPreApprovedList = allowedList.filter((u) => u.role === "client");
  const staffPreApprovedList = allowedList.filter(
    (u) => u.role === "admin" || u.role === "advisor"
  );

  const usaCasesCount = applicationsList.filter((a) => a.destination === "USA").length;
  const japanCasesCount = applicationsList.filter((a) => a.destination === "JAPAN").length;
  const approvedCount = applicationsList.filter((a) => a.status === "approved").length;
  const rejectedCount = applicationsList.filter((a) => a.status === "rejected").length;

  return (
    <div className="space-y-8 font-sans">
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

      {/* VISTA 1: GOBERNANZA & MÉTRICAS */}
      {activeTab === "gobernanza" && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="rounded-2xl bg-brand-white p-5 border border-brand-charcoal/10 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-brand-charcoal/60">
                <span>Total Casos</span>
                <BarChart3 className="h-4 w-4 text-brand-red" />
              </div>
              <p className="font-display text-3xl font-bold text-brand-charcoal">
                {applicationsList.length}
              </p>
              <p className="text-[11px] text-brand-charcoal/50">
                🇺🇸 {usaCasesCount} EE. UU. • 🇯🇵 {japanCasesCount} Japón
              </p>
            </div>

            <div className="rounded-2xl bg-brand-white p-5 border border-brand-charcoal/10 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-brand-charcoal/60">
                <span>Bolsa de Casos</span>
                <Flame className="h-4 w-4 text-amber-500" />
              </div>
              <p className="font-display text-3xl font-bold text-brand-red">
                {unassignedCases.length}
              </p>
              <p className="text-[11px] text-brand-charcoal/50">Sin asesor asignado</p>
            </div>

            <div className="rounded-2xl bg-brand-white p-5 border border-brand-charcoal/10 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-brand-charcoal/60">
                <span>Mis Procesos</span>
                <Briefcase className="h-4 w-4 text-brand-charcoal" />
              </div>
              <p className="font-display text-3xl font-bold text-brand-charcoal">
                {myAssignedCases.length}
              </p>
              <p className="text-[11px] text-brand-charcoal/50">A cargo tuyo</p>
            </div>

            <div className="rounded-2xl bg-brand-white p-5 border border-emerald-500/25 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-emerald-700 font-semibold">
                <span>Visas Aprobadas</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              </div>
              <p className="font-display text-3xl font-bold text-emerald-600">
                {approvedCount}
              </p>
              <p className="text-[11px] text-brand-charcoal/50">Casos exitosos</p>
            </div>

            <div className="rounded-2xl bg-brand-white p-5 border border-brand-red/25 shadow-2xs space-y-1.5">
              <div className="flex items-center justify-between text-xs text-brand-red font-semibold">
                <span>Visas Rechazadas</span>
                <XCircle className="h-4 w-4 text-brand-red" />
              </div>
              <p className="font-display text-3xl font-bold text-brand-red">
                {rejectedCount}
              </p>
              <p className="text-[11px] text-brand-charcoal/50">Negadas en consulado</p>
            </div>
          </div>

          <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-brand-charcoal">
                  Monitor Maestro de Operaciones
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  El porcentaje de avance se calcula automáticamente según cuestionario, bóveda y meetings.
                </p>
              </div>
            </div>

            {applicationsList.length === 0 ? (
              <p className="text-xs text-brand-charcoal/50 py-6 text-center">
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
                            {app.formData?.fullName || app.clientName || "Cliente"}
                          </span>
                          <span className="rounded-full bg-brand-charcoal px-2.5 py-0.5 text-[10px] font-bold text-white uppercase">
                            {app.destination === "JAPAN" ? "🇯🇵 Japón" : "🇺🇸 EE. UU."}
                          </span>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              app.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-700"
                                : app.status === "rejected"
                                ? "bg-brand-red/15 text-brand-red"
                                : "bg-brand-platinum text-brand-charcoal/80"
                            }`}
                          >
                            {m.progressPercentage}% • {app.status}
                          </span>
                        </div>
                        <p className="text-xs text-brand-charcoal/60">
                          Correo: {app.clientEmail || "---"} • Asesor:{" "}
                          <strong className="text-brand-charcoal">
                            {app.assignedAdvisorName || "⚠️ Sin Asignar (En Bolsa)"}
                          </strong>
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {!app.assignedAdvisorId && (
                          <button
                            type="button"
                            onClick={() => handleClaimCase(app)}
                            className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 px-4 py-2 text-xs font-bold text-amber-800 hover:bg-amber-500/25 transition-colors"
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
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red/90 transition-colors"
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
                <h3 className="font-display text-lg font-bold text-brand-charcoal">
                  Bolsa de Casos
                </h3>
                <p className="text-xs text-brand-charcoal/55">
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
                          {app.destination === "JAPAN" ? "🇯🇵 Japón" : "🇺🇸 EE. UU."}
                        </span>
                        <span className="text-xs font-bold text-brand-red">
                          Avance: {m.progressPercentage}%
                        </span>
                      </div>
                      <h4 className="font-display text-base font-bold text-brand-charcoal pt-1">
                        {app.formData?.fullName || app.clientName || "Cliente Nuevo"}
                      </h4>
                      <p className="text-xs text-brand-charcoal/60">
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
                <h3 className="font-display text-lg font-bold text-brand-charcoal">
                  Mis Procesos Asignados ({myAssignedCases.length})
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  Haz clic en &ldquo;Gestionar Caso&rdquo; para abrir la mesa de trabajo completa del cliente.
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
                          {app.formData?.fullName || app.clientName}
                        </p>
                        <span className="rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700">
                          {m.progressPercentage}% • {app.status}
                        </span>
                      </div>
                      <p className="text-xs text-brand-charcoal/60">
                        {app.visaType} • Tel: {app.formData?.mobilePhone || "Pendiente"} • Meetings: {app.meetings?.length || 0}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/dashboard/perfil?uid=${app.id}`)
                        }
                        className="inline-flex items-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-brand-white px-4 py-2 text-xs font-semibold text-brand-charcoal hover:bg-brand-platinum transition-colors"
                      >
                        <UserCircle className="h-3.5 w-3.5" />
                        <span>Perfil 360°</span>
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          router.push(`/dashboard/admin/caso/${app.id}`)
                        }
                        className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-5 py-2 text-xs font-semibold text-white hover:bg-brand-red/90 transition-colors shadow-sm"
                      >
                        <FolderKanban className="h-3.5 w-3.5" />
                        <span>Gestionar Caso</span>
                      </button>
                      <a
                        href={`/dashboard/admin/caso/${app.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Abrir en nueva pestaña"
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-brand-charcoal/15 bg-brand-white text-brand-charcoal hover:bg-brand-charcoal hover:text-white transition-colors"
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
                <h3 className="font-display text-base font-bold text-brand-charcoal">
                  Registrar Nuevo Cliente
                </h3>
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
            <h4 className="font-display text-base font-bold text-brand-charcoal">
              Cartera de Clientes Registrados ({clientPreApprovedList.length})
            </h4>

            {clientPreApprovedList.length === 0 ? (
              <p className="text-xs text-brand-charcoal/50">Aún no hay clientes.</p>
            ) : (
              <div className="space-y-2.5">
                {clientPreApprovedList.map((c) => {
                  const activeApp = applicationsList.find(
                    (a) => a.clientEmail?.toLowerCase() === c.email.toLowerCase()
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
                            {c.fullName}
                          </p>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                              activeApp
                                ? "bg-emerald-500/15 text-emerald-700"
                                : "bg-amber-500/15 text-amber-700"
                            }`}
                          >
                            {activeApp ? `Activo (${m.progressPercentage}%)` : "Pendiente 1er Login"}
                          </span>
                        </div>
                        <p className="text-[11px] text-brand-charcoal/60">
                          {c.email} • {c.destination} • Plan <strong>{c.planTier}</strong>
                          {activeApp?.assignedAdvisorName && (
                            <span> • Asesor: <strong>{activeApp.assignedAdvisorName}</strong></span>
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
                                : `/dashboard/perfil?email=${encodeURIComponent(c.email)}`
                            )
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-brand-charcoal/15 bg-brand-white px-4 py-1.5 text-xs font-semibold text-brand-charcoal hover:bg-brand-platinum transition-colors"
                        >
                          <UserCircle className="h-3.5 w-3.5" />
                          <span>Perfil 360°</span>
                        </button>
                        {activeApp && (
                          <button
                            type="button"
                            onClick={() =>
                              router.push(`/dashboard/admin/caso/${activeApp.id}`)
                            }
                            className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-1.5 text-xs font-semibold text-white hover:bg-brand-red/90 transition-colors"
                          >
                            <FolderKanban className="h-3.5 w-3.5" />
                            <span>Gestionar Caso</span>
                          </button>
                        )}
                        {profile?.role === "admin" && (
                          <button
                            type="button"
                            onClick={() => handleRevokeEmail(c.email)}
                            className="p-2 text-brand-charcoal/40 hover:text-brand-red transition-colors"
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

{/* VISTA 5: ESTUDIO DE PUBLICACIÓN FINTECH PREMIUM (ACTUALIZADO A 3 FORMATOS) */}
{activeTab === "sala-cms" && (
  <div className="space-y-6">
    <form
      onSubmit={handleCreateConsularResource}
      className="rounded-3xl bg-brand-white border border-brand-charcoal/10 shadow-sm overflow-hidden"
    >
      <div className="bg-brand-charcoal px-7 py-6 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-red">
            <Sparkles className="h-3 w-3" />
            <span>Estudio Editorial — Sala Consular</span>
          </span>
          <h3 className="font-display text-lg font-bold">
            Nueva Publicación para el Portal de Clientes
          </h3>
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
                  : "text-white/65 hover:text-white"
              }`}
            >
              {destOpt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-7 space-y-6">
        <div className="space-y-2">
          <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal/55">
            1. Elige el formato de contenido
          </label>
          {/* Unificado a 3 opciones limpias estilo Fintech */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {[
              {
                id: "youtube",
                title: "Recurso Web / Redes",
                sub: "YouTube, Instagram, Facebook o Web",
                icon: Video,
              },
              {
                id: "file",
                title: "Subir PDF / Guía",
                sub: "Archivo descargable y previsible",
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
              const active = postFormat === fmt.id || (fmt.id === "youtube" && postFormat === "instagram");
              return (
                <button
                  key={fmt.id}
                  type="button"
                  onClick={() => setPostFormat(fmt.id === "youtube" ? "youtube" : fmt.id as any)}
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
                  <span className="text-[11px] text-brand-charcoal/50 mt-0.5">
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
                  {resFile ? `📄 ${resFile.name}` : "Haz clic para elegir PDF o Imagen..."}
                </span>
                <span className="shrink-0 rounded-lg bg-brand-red px-2.5 py-1 text-[10px] font-bold text-white uppercase">
                  Explorar
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  className="hidden"
                  onChange={(e) => setResFile(e.target.files?.[0] || null)}
                />
              </label>
            </div>
          ) : (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                3. Enlace URL (YouTube, Instagram, Facebook o Web) *
              </label>
              <input
                type="url"
                required
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
            <span className="rounded-md bg-brand-platinum px-2 py-0.5 text-[10px] font-semibold text-brand-charcoal/60">
              Opcional
            </span>
          </div>
          <textarea
            rows={2}
            value={resDesc}
            onChange={(e) => setResDesc(e.target.value)}
            placeholder="Si deseas, agrega un resumen o instrucciones adicionales..."
            className="w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 p-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all"
          />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-brand-platinum">
          <p className="text-[11px] text-brand-charcoal/50">
            Al eliminar una publicación, también se borra su archivo físico de Firebase Storage.
          </p>
          <button
            type="submit"
            disabled={submitting || uploadingRes}
            className="inline-flex items-center gap-2 rounded-full bg-brand-red px-7 py-3 text-xs font-semibold text-brand-white shadow-md shadow-brand-red/20 hover:bg-brand-red/90 disabled:opacity-50 transition-all"
          >
            <Plus className="h-4 w-4" />
            <span>
              {uploadingRes ? "Publicando..." : "Publicar en Sala Consular"}
            </span>
          </button>
        </div>
      </div>
    </form>
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
                <h3 className="font-display text-base font-bold text-brand-charcoal">
                  Agregar Personal Interno (Asesor y Admin)
                </h3>
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
            <h4 className="font-display text-base font-bold text-brand-charcoal">
              Personal Interno ({staffPreApprovedList.length})
            </h4>
            <div className="space-y-2.5">
              {staffPreApprovedList.map((s) => (
                <div
                  key={s.email}
                  className="flex items-center justify-between rounded-xl bg-brand-platinum/30 p-4 border border-brand-platinum"
                >
                  <div>
                    <p className="text-xs font-bold text-brand-charcoal">
                      {s.fullName}{" "}
                      <span className="ml-1.5 rounded bg-brand-charcoal px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                        {s.role === "admin" ? "Admin" : "Asesor"}
                      </span>
                    </p>
                    <p className="text-[11px] text-brand-charcoal/60">{s.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleRevokeEmail(s.email)}
                    className="text-brand-charcoal/40 hover:text-brand-red transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
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
      <Suspense
        fallback={
          <div className="py-20 text-center text-xs text-brand-charcoal/50">
            Cargando módulo de Backoffice...
          </div>
        }
      >
        <AdminDashboardContent />
      </Suspense>
    </DashboardLayout>
  );
}