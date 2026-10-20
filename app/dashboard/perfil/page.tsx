// app/dashboard/perfil/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import {
  DestinationCountry,
  HistoricalCaseSummary,
  OfficialDeliverableItem,
  PreApprovedUser,
  UserProfile,
  VisaApplication,
} from "@/types/visa";
import { formatDisplayName } from "@/lib/firebase/db";
import {
  UserCircle,
  Mail,
  Phone,
  Calendar,
  ShieldCheck,
  Save,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Briefcase,
  FileText,
  FolderLock,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  History,
  PlusCircle,
  FileCheck2,
  FileDown,
  Trash2,
  X,
} from "lucide-react";

const inputBaseClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 px-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

function extractCleanBookingUrl(rawInput: string): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return "";
  const srcMatch = trimmed.match(/src=["']([^"']+)["']/i);
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1].trim();
  }
  return trimmed;
}

function PerfilContent() {
  const { user, profile, application, refreshApplication } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const targetUidParam = searchParams.get("uid");
  const targetEmailParam = searchParams.get("email");
  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  const isInspectingOther =
    isStaff &&
    Boolean(
      (targetUidParam && targetUidParam !== user?.uid) ||
        (targetEmailParam &&
          targetEmailParam.toLowerCase() !== profile?.email?.toLowerCase())
    );

  const [viewedProfile, setViewedProfile] = useState<UserProfile | null>(null);
  const [viewedPreApproved, setViewedPreApproved] =
    useState<PreApprovedUser | null>(null);
  const [viewedApp, setViewedApp] = useState<VisaApplication | null>(null);
  const [assignedCasesToStaff, setAssignedCasesToStaff] = useState<
    VisaApplication[]
  >([]);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const [delivTitle, setDelivTitle] = useState("");
  const [delivCategory, setDelivCategory] = useState<
    OfficialDeliverableItem["category"]
  >("Confirmación DS-160");
  const [delivFile, setDelivFile] = useState<File | null>(null);
  const [uploadingDeliv, setUploadingDeliv] = useState(false);

  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Auto-ocultar las alertas después de 5 segundos
  useEffect(() => {
    if (!feedback && !errorMsg) return;
    const timer = setTimeout(() => {
      setFeedback("");
      setErrorMsg("");
    }, 5000);
    return () => clearTimeout(timer);
  }, [feedback, errorMsg]);

  useEffect(() => {
    const loadProfileData = async () => {
      if (!user || !profile) return;
      setLoadingProfile(true);
      try {
        if (!isInspectingOther) {
          setViewedProfile(profile);
          setViewedApp(application);

          const cleanFull = formatDisplayName(profile.fullName);
          const nameParts = cleanFull.split(" ");
          setFirstName(profile.firstName || nameParts[0] || "");
          setLastName(
            profile.lastName || nameParts.slice(1).join(" ") || ""
          );
          setPhone(
            profile.phone || application?.formData?.mobilePhone || ""
          );
          setPhotoUrl(profile.photoUrl || user.photoURL || "");
          setBookingUrl(profile.bookingUrl || "");

          if (profile.role === "admin" || profile.role === "advisor") {
            const q = query(
              collection(db, "applications"),
              where("assignedAdvisorId", "==", user.uid)
            );
            const snap = await getDocs(q);
            const myList: VisaApplication[] = [];
            snap.forEach((d) => myList.push(d.data() as VisaApplication));
            setAssignedCasesToStaff(myList);
          }
        } else {
          let foundUser: UserProfile | null = null;
          let foundApp: VisaApplication | null = null;
          let foundPre: PreApprovedUser | null = null;

          if (targetUidParam) {
            const uSnap = await getDoc(doc(db, "users", targetUidParam));
            if (uSnap.exists()) foundUser = uSnap.data() as UserProfile;

            const aSnap = await getDoc(doc(db, "applications", targetUidParam));
            if (aSnap.exists()) foundApp = aSnap.data() as VisaApplication;
          }

          const lookupEmail = (
            targetEmailParam ||
            foundUser?.email ||
            foundApp?.clientEmail ||
            ""
          )
            .trim()
            .toLowerCase();

          if (lookupEmail) {
            const preSnap = await getDoc(
              doc(db, "allowed_emails", lookupEmail)
            );
            if (preSnap.exists()) {
              foundPre = preSnap.data() as PreApprovedUser;
            }

            if (!foundApp) {
              const appsSnap = await getDocs(collection(db, "applications"));
              appsSnap.forEach((d) => {
                const data = d.data() as VisaApplication;
                if (data.clientEmail?.toLowerCase() === lookupEmail) {
                  foundApp = data;
                }
              });
            }
          }

          setViewedProfile(foundUser);
          setViewedApp(foundApp);
          setViewedPreApproved(foundPre);
        }
      } catch {
        setErrorMsg("No se pudo cargar la información del perfil.");
      } finally {
        setLoadingProfile(false);
      }
    };

    loadProfileData();
  }, [user, profile, application, isInspectingOther, targetUidParam, targetEmailParam]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploadingPhoto(true);
    setErrorMsg("");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const avatarRef = ref(
        storage,
        `vault/${user.uid}/avatar_${Date.now()}_${safeName}`
      );
      await uploadBytes(avatarRef, file);
      const url = await getDownloadURL(avatarRef);
      setPhotoUrl(url);
      await updateDoc(doc(db, "users", user.uid), {
        photoUrl: url,
        updatedAt: new Date().toISOString(),
      });
      await refreshApplication();
      setFeedback("Fotografía de perfil actualizada.");
    } catch {
      setErrorMsg("No se pudo subir la imagen de perfil.");
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSaveMyProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;
    setSaving(true);
    setFeedback("");
    setErrorMsg("");

    try {
      const combinedName = formatDisplayName(
        `${firstName.trim()} ${lastName.trim()}`
      );
      let cleanBookingUrl = extractCleanBookingUrl(bookingUrl);

      if (cleanBookingUrl.includes("calendar.app.google")) {
        try {
          const res = await fetch(
            `/api/calendar?url=${encodeURIComponent(cleanBookingUrl)}`
          );
          if (res.ok) {
            const data = await res.json();
            if (data.resolvedUrl) cleanBookingUrl = data.resolvedUrl;
          }
        } catch {}
      }

      setBookingUrl(cleanBookingUrl);

      await setDoc(
        doc(db, "users", user.uid),
        {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          fullName: combinedName,
          phone: phone.trim(),
          photoUrl: photoUrl.trim(),
          bookingUrl: cleanBookingUrl,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (profile.role === "admin" || profile.role === "advisor") {
        const q = query(
          collection(db, "applications"),
          where("assignedAdvisorId", "==", user.uid)
        );
        const snap = await getDocs(q);
        const updates: Promise<void>[] = [];
        snap.forEach((d) => {
          updates.push(
            updateDoc(doc(db, "applications", d.id), {
              assignedAdvisorName: combinedName,
              assignedAdvisorBookingUrl: cleanBookingUrl,
            })
          );
        });
        await Promise.all(updates);
      }

      await refreshApplication();
      setFeedback(
        profile.role === "admin" || profile.role === "advisor"
          ? "¡Perfil y Agenda Insertada guardados!"
          : "¡Tus datos de perfil han sido actualizados correctamente!"
      );
    } catch {
      setErrorMsg("No se pudieron guardar los cambios del perfil.");
    } finally {
      setSaving(false);
    }
  };

  const handleStaffUploadDeliverable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewedApp || !delivFile) return;
    setUploadingDeliv(true);
    setFeedback("");
    setErrorMsg("");

    try {
      const safeName = delivFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `vault/${viewedApp.id}/deliverables/${Date.now()}_${safeName}`;
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

      const updatedList = [
        newDeliv,
        ...(viewedApp.officialDeliverables || []),
      ];

      await updateDoc(doc(db, "applications", viewedApp.id), {
        officialDeliverables: updatedList,
        consularSession: {
          ...(viewedApp.consularSession || {}),
          officialDeliverableTitle: newDeliv.title,
          officialDeliverableUrl: newDeliv.fileUrl,
        },
        updatedAt: new Date().toISOString(),
      });

      setViewedApp((prev) =>
        prev ? { ...prev, officialDeliverables: updatedList } : null
      );
      setDelivTitle("");
      setDelivFile(null);
      setFeedback(
        `Documento "${newDeliv.title}" publicado en el perfil del cliente.`
      );
    } catch {
      setErrorMsg("No se pudo subir el documento al perfil del cliente.");
    } finally {
      setUploadingDeliv(false);
    }
  };

  const handleStaffDeleteDeliverable = async (
    item: OfficialDeliverableItem
  ) => {
    if (!viewedApp) return;
    try {
      if (item.storagePath) {
        try {
          await deleteObject(ref(storage, item.storagePath));
        } catch {}
      }
      const updatedList = (viewedApp.officialDeliverables || []).filter(
        (d) => d.id !== item.id
      );
      await updateDoc(doc(db, "applications", viewedApp.id), {
        officialDeliverables: updatedList,
        updatedAt: new Date().toISOString(),
      });
      setViewedApp((prev) =>
        prev ? { ...prev, officialDeliverables: updatedList } : null
      );
      setFeedback("Documento eliminado del perfil del cliente.");
    } catch {
      setErrorMsg("No se pudo eliminar el documento.");
    }
  };

  const handleArchiveAndStartNewCase = async (newDest: DestinationCountry) => {
    if (!viewedApp) return;
    setSaving(true);
    setFeedback("");
    setErrorMsg("");

    try {
      const prevSummary: HistoricalCaseSummary = {
        caseId: `HIST-${Date.now().toString().slice(-5)}`,
        visaType: viewedApp.visaType,
        destination: viewedApp.destination,
        status: viewedApp.status,
        closedAt: new Date().toISOString().split("T")[0],
        advisorName:
          formatDisplayName(viewedApp.assignedAdvisorName) ||
          "Equipo Global Visa",
      };

      const updatedHistory = [
        prevSummary,
        ...(viewedApp.historicalCases || []),
      ];

      const nextVisaType =
        newDest === "JAPAN"
          ? "Visa de Turismo Japón (Estancia Corta)"
          : "Visa B1/B2 Estados Unidos";

      await updateDoc(doc(db, "applications", viewedApp.id), {
        destination: newDest,
        visaType: nextVisaType,
        status: "onboarding_pending",
        currentStep: 1,
        progressPercentage: 20,
        isDecommissioned: false,
        historicalCases: updatedHistory,
        updatedAt: new Date().toISOString(),
      });

      setViewedApp((prev) =>
        prev
          ? {
              ...prev,
              destination: newDest,
              visaType: nextVisaType,
              status: "onboarding_pending",
              currentStep: 1,
              progressPercentage: 20,
              historicalCases: updatedHistory,
            }
          : null
      );

      setFeedback(
        "El caso anterior fue guardado en el Historial del Cliente y se ha inicializado su nueva solicitud."
      );
    } catch {
      setErrorMsg("No se pudo inicializar la nueva solicitud.");
    } finally {
      setSaving(false);
    }
  };

  if (loadingProfile) {
    return (
      <div className="py-20 text-center text-xs text-brand-charcoal/50">
        Cargando expediente y perfil...
      </div>
    );
  }

  // ============================================================================
  // MODO A: FICHA 360° DE UN CLIENTE (Vista para Admin / Asesor)
  // ============================================================================
  if (isInspectingOther) {
    const displayName = formatDisplayName(
      viewedApp?.formData?.fullName ||
        viewedProfile?.fullName ||
        viewedPreApproved?.fullName ||
        "Cliente Registrado"
    );
    const displayEmail =
      viewedProfile?.email ||
      viewedApp?.clientEmail ||
      viewedPreApproved?.email ||
      targetEmailParam ||
      "---";
    const displayPhone =
      viewedApp?.formData?.mobilePhone ||
      viewedProfile?.phone ||
      viewedPreApproved?.phone ||
      "No registrado";
    const displayRole =
      viewedProfile?.role || viewedPreApproved?.role || "client";
    const displayPlan =
      viewedProfile?.planTier ||
      viewedApp?.planTier ||
      viewedPreApproved?.planTier ||
      "Priority Pro";
    const displayDest =
      viewedApp?.destination ||
      viewedProfile?.destination ||
      viewedPreApproved?.destination ||
      "USA";

    const clientDeliverables = viewedApp?.officialDeliverables || [];

    return (
      <div className="max-w-5xl mx-auto space-y-6 font-sans">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-2 rounded-full bg-brand-white border border-brand-charcoal/10 px-4 py-2 text-xs font-semibold text-brand-charcoal hover:bg-brand-platinum transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Volver</span>
          </button>
          <span className="rounded-full bg-brand-charcoal px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
            Ficha 360° de Cliente • Vista Staff
          </span>
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

        <div className="rounded-3xl bg-brand-charcoal p-7 sm:p-8 text-white shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            {viewedProfile?.photoUrl ? (
              <img
                src={viewedProfile.photoUrl}
                alt={displayName}
                referrerPolicy="no-referrer"
                className="h-20 w-20 rounded-2xl object-cover border-2 border-brand-red"
              />
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-brand-red text-white font-display text-3xl font-bold shadow-lg shadow-brand-red/30">
                {displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-brand-red/20 px-3 py-0.5 text-[10px] font-bold uppercase text-brand-red">
                  {displayRole === "client"
                    ? `Cliente • Plan ${displayPlan}`
                    : displayRole.toUpperCase()}
                </span>
                <span className="rounded-full bg-white/10 px-3 py-0.5 text-[10px] font-bold uppercase text-white/80">
                  {displayDest === "JAPAN" ? "🇯🇵 Japón" : "🇺🇸 Estados Unidos"}
                </span>
              </div>
              <h2 className="font-display text-2xl sm:text-3xl font-bold">
                {displayName}
              </h2>
              <div className="flex flex-wrap items-center gap-4 text-xs text-white/70">
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-brand-red" />
                  {displayEmail}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 text-brand-red" />
                  {displayPhone}
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.06] p-4 border border-white/10 text-right shrink-0">
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
              Asesor Asignado
            </p>
            <p className="font-display text-sm font-bold text-white mt-1">
              {formatDisplayName(viewedApp?.assignedAdvisorName) ||
                "⚠️ Sin Asignar (En Bolsa)"}
            </p>
            {viewedApp && (
              <button
                type="button"
                onClick={() =>
                  router.push(`/dashboard/admin/caso/${viewedApp.id}`)
                }
                className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-red/90 transition-all"
              >
                <span>Abrir Workspace del Caso</span>
              </button>
            )}
          </div>
        </div>

        {viewedApp && (
          <div className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-3.5">
              <div className="flex items-center gap-2.5">
                <FileCheck2 className="h-5 w-5 text-brand-red" />
                <div>
                  <h3 className="font-display text-base font-bold text-brand-charcoal">
                    Documentos Oficiales Emitidos en el Perfil del Cliente ({clientDeliverables.length})
                  </h3>
                  <p className="text-xs text-brand-charcoal/55">
                    Sube aquí la Hoja de Confirmación DS-160, Cita Consular o Formatos de Japón. El cliente los verá en su propio perfil listos para descargar.
                  </p>
                </div>
              </div>
            </div>

            <form
              onSubmit={handleStaffUploadDeliverable}
              className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end bg-brand-platinum/30 p-4 rounded-2xl border border-brand-platinum"
            >
              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-brand-charcoal">
                  Categoría Oficial
                </label>
                <select
                  value={delivCategory}
                  onChange={(e) => setDelivCategory(e.target.value as any)}
                  className={inputBaseClass}
                >
                  <option value="Confirmación DS-160">Confirmación DS-160</option>
                  <option value="Cita Consular / CAS">Cita Consular / CAS</option>
                  <option value="Formulario Embajada Japón">Formulario Japón</option>
                  <option value="Schedule of Stay (Itinerario)">Schedule of Stay</option>
                  <option value="Otro Documento Oficial">Otro Documento</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-brand-charcoal">
                  Título del Documento
                </label>
                <input
                  type="text"
                  value={delivTitle}
                  onChange={(e) => setDelivTitle(e.target.value)}
                  placeholder="Ej. Confirmación DS-160 Oficial"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1">
                <label className="block text-[11px] font-bold text-brand-charcoal">
                  Archivo PDF / Imagen
                </label>
                <label className="cursor-pointer flex items-center justify-between h-11 rounded-xl border border-dashed border-brand-red/40 bg-brand-white px-3.5 text-xs font-semibold text-brand-charcoal">
                  <span className="truncate pr-2">
                    {delivFile ? delivFile.name : "Elegir PDF..."}
                  </span>
                  <UploadCloud className="h-4 w-4 text-brand-red shrink-0" />
                  <input
                    type="file"
                    required
                    accept=".pdf,.jpg,.jpeg,.png"
                    className="hidden"
                    onChange={(e) => setDelivFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>

              <button
                type="submit"
                disabled={uploadingDeliv || !delivFile}
                className="h-11 inline-flex items-center justify-center gap-2 rounded-xl bg-brand-red px-4 text-xs font-semibold text-white hover:bg-brand-red/90 disabled:opacity-50 transition-all"
              >
                <UploadCloud className="h-4 w-4" />
                <span>{uploadingDeliv ? "Subiendo..." : "Subir al Perfil"}</span>
              </button>
            </form>

            {clientDeliverables.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                {clientDeliverables.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border border-brand-platinum p-3.5 text-xs"
                  >
                    <div className="truncate pr-3">
                      <span className="text-[10px] font-bold uppercase text-brand-red">
                        {item.category}
                      </span>
                      <p className="font-bold text-brand-charcoal truncate">
                        {item.title}
                      </p>
                      <p className="text-[10px] text-brand-charcoal/50 truncate">
                        {item.fileName}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={item.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-brand-charcoal px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-red transition-colors"
                      >
                        <span>Abrir</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleStaffDeleteDeliverable(item)}
                        className="p-1.5 text-brand-charcoal/40 hover:text-brand-red transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {viewedApp ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-5">
              <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
                <div className="flex items-center gap-2.5">
                  <FileText className="h-5 w-5 text-brand-red" />
                  <div>
                    <h3 className="font-display text-base font-bold text-brand-charcoal">
                      Caso Activo: {viewedApp.visaType}
                    </h3>
                    <p className="text-xs text-brand-charcoal/55">
                      Estado: <strong className="uppercase">{viewedApp.status}</strong> • ID: {viewedApp.id.slice(0, 10)}
                    </p>
                  </div>
                </div>
                <span className="rounded-full bg-brand-red/10 px-3 py-1 text-xs font-bold text-brand-red">
                  Paso {viewedApp.currentStep} de 4 ({viewedApp.progressPercentage}%)
                </span>
              </div>

              {!viewedApp.formData ? (
                <p className="text-xs text-brand-charcoal/50 italic py-4">
                  El cliente aún no ha enviado las respuestas de su Cuestionario Estratégico.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-brand-platinum/40 p-3.5">
                    <span className="text-brand-charcoal/55 block">No. Cédula / ID:</span>
                    <span className="font-bold text-brand-charcoal">{viewedApp.formData.nationalId || "---"}</span>
                  </div>
                  <div className="rounded-xl bg-brand-platinum/40 p-3.5">
                    <span className="text-brand-charcoal/55 block">Estado Civil:</span>
                    <span className="font-bold text-brand-charcoal">{viewedApp.formData.maritalStatus || "---"}</span>
                  </div>
                  <div className="rounded-xl bg-brand-platinum/40 p-3.5">
                    <span className="text-brand-charcoal/55 block">Domicilio Actual:</span>
                    <span className="font-bold text-brand-charcoal">
                      {viewedApp.formData.homeAddress}, {viewedApp.formData.cityAndState}
                    </span>
                  </div>
                  <div className="rounded-xl bg-brand-platinum/40 p-3.5">
                    <span className="text-brand-charcoal/55 block">Ocupación & Empresa:</span>
                    <span className="font-bold text-brand-charcoal">
                      {viewedApp.formData.currentOccupation} • {viewedApp.formData.companyOrEmployerName} ({viewedApp.formData.monthlyIncomeLocal})
                    </span>
                  </div>
                </div>
              )}

              <div className="pt-4 border-t border-brand-platinum space-y-3">
                <h4 className="font-display text-sm font-bold text-brand-charcoal flex items-center gap-2">
                  <FolderLock className="h-4 w-4 text-brand-red" />
                  <span>Documentos en la Bóveda del Cliente</span>
                </h4>
                {!viewedApp.documents || Object.keys(viewedApp.documents).length === 0 ? (
                  <p className="text-xs text-brand-charcoal/50 italic">
                    Sin archivos cargados en la Bóveda.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {Object.values(viewedApp.documents).map((docItem) => (
                      <a
                        key={docItem.docId}
                        href={docItem.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-xl border border-brand-platinum p-3 text-xs hover:border-brand-red transition-colors"
                      >
                        <div className="truncate pr-2">
                          <p className="font-bold text-brand-charcoal truncate">{docItem.title}</p>
                          <p className="text-[10px] text-brand-charcoal/50 truncate">{docItem.fileName}</p>
                        </div>
                        <ExternalLink className="h-4 w-4 text-brand-red shrink-0" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-3xl bg-brand-white p-6 sm:p-7 border border-brand-charcoal/10 shadow-sm flex flex-col justify-between space-y-6">
              <div className="space-y-4">
                <div className="flex items-center gap-2 border-b border-brand-platinum pb-3.5">
                  <History className="h-5 w-5 text-brand-red" />
                  <div>
                    <h3 className="font-display text-base font-bold text-brand-charcoal">
                      Historial de Solicitudes
                    </h3>
                    <p className="text-[11px] text-brand-charcoal/55">
                      Casos activos y trámites anteriores de este cliente.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-brand-red/[0.04] border border-brand-red/20 p-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-brand-red">
                      Trámite Actual
                    </span>
                    <span className="text-[10px] font-bold uppercase text-brand-charcoal/60">
                      {viewedApp.status}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-brand-charcoal">
                    {viewedApp.visaType}
                  </p>
                  <p className="text-[11px] text-brand-charcoal/60">
                    Asesor: {formatDisplayName(viewedApp.assignedAdvisorName) || "Sin asignar"}
                  </p>
                </div>

                {!viewedApp.historicalCases ||
                viewedApp.historicalCases.length === 0 ? (
                  <p className="text-xs text-brand-charcoal/50 italic">
                    No registra trámites anteriores cerrados.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {viewedApp.historicalCases.map((h) => (
                      <div
                        key={h.caseId}
                        className="rounded-xl bg-brand-platinum/40 p-3.5 border border-brand-platinum space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono text-[10px] text-brand-charcoal/60">
                            {h.caseId}
                          </span>
                          <span
                            className={`rounded px-2 py-0.5 text-[9px] font-bold uppercase ${
                              h.status === "approved"
                                ? "bg-emerald-500/15 text-emerald-700"
                                : "bg-brand-charcoal/10 text-brand-charcoal"
                            }`}
                          >
                            {h.status}
                          </span>
                        </div>
                        <p className="font-bold text-brand-charcoal">{h.visaType}</p>
                        <p className="text-[10px] text-brand-charcoal/55">
                          Cerrado: {h.closedAt} • {h.advisorName}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-brand-platinum space-y-2">
                <p className="text-[11px] font-semibold text-brand-charcoal">
                  ¿El cliente contrató un nuevo trámite?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleArchiveAndStartNewCase("USA")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-platinum px-3 py-2.5 text-[11px] font-bold text-brand-charcoal hover:bg-brand-red hover:text-white transition-colors"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Nueva 🇺🇸 USA</span>
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => handleArchiveAndStartNewCase("JAPAN")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand-platinum px-3 py-2.5 text-[11px] font-bold text-brand-charcoal hover:bg-brand-red hover:text-white transition-colors"
                  >
                    <PlusCircle className="h-3.5 w-3.5" />
                    <span>Nueva 🇯🇵 Japón</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl bg-brand-white p-8 border border-brand-charcoal/10 text-center space-y-2">
            <p className="text-sm font-bold text-brand-charcoal">
              Este cliente ya está autorizado en el directorio ({displayEmail}), pero aún no ha iniciado sesión por primera vez.
            </p>
          </div>
        )}
      </div>
    );
  }

  // ============================================================================
  // MODO B: MI PERFIL PROPIO (Admin, Asesor o Cliente)
  // ============================================================================
  const myOfficialDeliverables = application?.officialDeliverables || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 font-sans">
      <div className="rounded-3xl bg-brand-charcoal p-7 sm:p-8 text-white shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-6">
        <div className="flex items-center gap-5">
          <div className="relative group">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={profile?.fullName || "Foto de perfil"}
                referrerPolicy="no-referrer"
                className="h-20 w-20 rounded-2xl object-cover border-2 border-brand-red"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-red text-white font-display text-3xl font-bold">
                {(firstName || profile?.fullName || "U").charAt(0).toUpperCase()}
              </div>
            )}
            <label className="cursor-pointer absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full bg-brand-white text-brand-charcoal shadow-md hover:bg-brand-red hover:text-white transition-colors">
              <UploadCloud className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={uploadingPhoto}
                onChange={handlePhotoUpload}
              />
            </label>
          </div>

          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-3 py-0.5 text-[10px] font-bold uppercase tracking-wider text-brand-red">
              <Sparkles className="h-3 w-3" />
              <span>
                {profile?.role === "admin"
                  ? "Perfil de Admin"
                  : profile?.role === "advisor"
                  ? "Perfil de Asesor"
                  : `Cliente Titular • Plan ${profile?.planTier || "Priority Pro"}`}
              </span>
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              {formatDisplayName(profile?.fullName) || "Mi Perfil"}
            </h2>
            <p className="text-xs text-white/65">{profile?.email}</p>
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

      {/* WIDGET EXCLUSIVO PARA CLIENTES: DOCUMENTOS Y ARCHIVOS GENERADOS POR EL ASESOR */}
      {!isStaff && (
        <div className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-5">
          <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
            <FileCheck2 className="h-5 w-5 text-brand-red shrink-0" />
            <div>
              <h3 className="font-display text-base font-bold text-brand-charcoal">
                Documentos y Archivos de tu Proceso
              </h3>
              <p className="text-xs text-brand-charcoal/55">
                Aquí encontrarás los formularios oficiales, confirmaciones, itinerarios y soportes que tu asesor irá generando durante cada etapa de tu solicitud.
              </p>
            </div>
          </div>

          {myOfficialDeliverables.length === 0 ? (
            <div className="rounded-2xl bg-brand-platinum/30 p-6 border border-brand-platinum text-center space-y-1.5">
              <p className="text-xs font-bold text-brand-charcoal">
                Aún no hay archivos generados en tu perfil
              </p>
              <p className="text-[11px] text-brand-charcoal/55 max-w-lg mx-auto leading-relaxed">
                A medida que avance tu proceso, aquí irán apareciendo los documentos, confirmaciones y archivos oficiales elaborados por tu asesor listos para consultar o descargar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {myOfficialDeliverables.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-2xl bg-emerald-500/[0.04] border border-emerald-500/25 p-4"
                >
                  <div className="truncate pr-3 space-y-0.5">
                    <span className="inline-block rounded bg-emerald-600 px-2 py-0.5 text-[9px] font-bold uppercase text-white">
                      {item.category}
                    </span>
                    <p className="text-xs font-bold text-brand-charcoal truncate pt-1">
                      {item.title}
                    </p>
                    <p className="text-[10px] text-brand-charcoal/55 truncate">
                      Generado por {item.uploadedBy}
                    </p>
                  </div>

                  <a
                    href={item.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-brand-red transition-all"
                  >
                    <FileDown className="h-3.5 w-3.5" />
                    <span>Descargar</span>
                  </a>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Formulario de Datos Personales */}
      <form
        onSubmit={handleSaveMyProfile}
        className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-6"
      >
        <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
          <UserCircle className="h-5 w-5 text-brand-red" />
          <div>
            <h3 className="font-display text-base font-bold text-brand-charcoal">
              Información Personal de la Cuenta
            </h3>
            <p className="text-xs text-brand-charcoal/55">
              Actualiza tu nombre, apellido, teléfono y fotografía de perfil.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-brand-charcoal">
              Nombres
            </label>
            <input
              type="text"
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Ej. Luis"
              className={inputBaseClass}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-brand-charcoal">
              Apellidos
            </label>
            <input
              type="text"
              required
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Ej. Garay"
              className={inputBaseClass}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-brand-charcoal">
              Correo Electrónico (Autenticado)
            </label>
            <input
              type="email"
              disabled
              value={profile?.email || ""}
              className={`${inputBaseClass} opacity-60 cursor-not-allowed`}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-brand-charcoal">
              Teléfono / WhatsApp
            </label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Ej. +57 300 123 4567"
              className={inputBaseClass}
            />
          </div>
        </div>

        {isStaff && (
          <div className="pt-4 border-t border-brand-platinum space-y-3">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-brand-red" />
              <div>
                <h4 className="font-display text-sm font-bold text-brand-charcoal">
                  Mi Página de Reserva Insertada (Exclusiva para mis casos asignados)
                </h4>
                <p className="text-xs text-brand-charcoal/55">
                  Puedes pegar directamente el <strong>código HTML <code>&lt;iframe src=&quot;...&quot;&gt;</code> de Google Calendar</strong> (&ldquo;Página de reserva insertada&rdquo;) o la URL directa.
                </p>
              </div>
            </div>

            <input
              type="text"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              placeholder='Pega aquí el código <iframe src="https://calendar.google.com/calendar/appointments/schedules/...">'
              className={inputBaseClass}
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-4 border-t border-brand-platinum">
          <div className="flex items-center gap-2 text-xs text-brand-charcoal/60">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Sincronización en tiempo real con Firestore.</span>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-full bg-brand-red px-7 py-3 text-xs font-semibold text-brand-white shadow-md shadow-brand-red/20 hover:bg-brand-red/90 disabled:opacity-50 transition-all"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? "Guardando..." : "Guardar Mi Perfil"}</span>
          </button>
        </div>
      </form>

      {isStaff ? (
        <div className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-brand-platinum pb-3.5">
            <div className="flex items-center gap-2.5">
              <Briefcase className="h-5 w-5 text-brand-red" />
              <h3 className="font-display text-base font-bold text-brand-charcoal">
                Mis Expedientes a Cargo ({assignedCasesToStaff.length})
              </h3>
            </div>
          </div>

          {assignedCasesToStaff.length === 0 ? (
            <p className="text-xs text-brand-charcoal/50">
              Actualmente no tienes casos asignados. Puedes reclamar casos desde la Bolsa de Casos.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {assignedCasesToStaff.map((c) => (
                <div
                  key={c.id}
                  className="flex items-center justify-between rounded-2xl bg-brand-platinum/30 p-4 border border-brand-platinum"
                >
                  <div>
                    <p className="text-xs font-bold text-brand-charcoal">
                      {formatDisplayName(c.formData?.fullName || c.clientName)}
                    </p>
                    <p className="text-[11px] text-brand-charcoal/60">
                      {c.visaType} • {c.progressPercentage}%
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      router.push(`/dashboard/admin/caso/${c.id}`)
                    }
                    className="rounded-full bg-brand-charcoal px-3.5 py-1.5 text-[11px] font-semibold text-white hover:bg-brand-red transition-colors"
                  >
                    Gestionar Caso
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-3xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-sm space-y-4">
          <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
            <FileText className="h-5 w-5 text-brand-red" />
            <h3 className="font-display text-base font-bold text-brand-charcoal">
              Mis Solicitudes Migratorias
            </h3>
          </div>

          {application && (
            <div className="rounded-2xl bg-brand-platinum/30 p-5 border border-brand-platinum flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="rounded-full bg-brand-red/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-brand-red">
                  Solicitud Activa • {application.progressPercentage}%
                </span>
                <p className="font-display text-base font-bold text-brand-charcoal pt-1">
                  {application.visaType}
                </p>
                <p className="text-xs text-brand-charcoal/60">
                  Asesor Asignado:{" "}
                  <strong>
                    {formatDisplayName(application.assignedAdvisorName) ||
                      "En asignación por coordinación legal"}
                  </strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="rounded-full bg-brand-charcoal px-5 py-2.5 text-xs font-semibold text-white hover:bg-brand-red transition-colors"
              >
                Ir a mi Trámite
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function PerfilPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="py-20 text-center text-xs text-brand-charcoal/50">
            Cargando perfil...
          </div>
        }
      >
        <PerfilContent />
      </Suspense>
    </DashboardLayout>
  );
}