// app/dashboard/perfil/page.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  DashboardLayout,
  DashboardContentSkeleton,
} from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { auth, db, storage } from "@/lib/firebase/config";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { updateProfile, updatePassword } from "firebase/auth";
import {
  PreApprovedUser,
  UserProfile,
  VisaApplication,
} from "@/types/visa";
import {
  calculateApplicationMetrics,
  downloadMeetingIcs,
  formatDisplayName,
  recordSystemLog,
} from "@/lib/firebase/db";
import { optimizeImageForVault } from "@/lib/utils/imageOptimizer";
import {
  UserCircle,
  Camera,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileText,
  Download,
  Calendar,
  CalendarPlus,
  Video,
  KeyRound,
  ArrowLeft,
  FolderKanban,
  Clock,
  ExternalLink,
  Eye,
  EyeOff,
  X,
} from "lucide-react";

const inputBaseClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 px-3.5 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none transition-all";

function ProfilePageContent() {
  const { user, profile, application } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const inspectedUid = searchParams.get("uid") || "";
  const inspectedEmail = searchParams.get("email") || "";
  const isStaff = profile?.role === "admin" || profile?.role === "advisor";
  const isInspectingOther =
    isStaff &&
    ((inspectedUid && inspectedUid !== user?.uid) || Boolean(inspectedEmail));

  const [targetProfile, setTargetProfile] = useState<UserProfile | null>(null);
  const [targetApp, setTargetApp] = useState<VisaApplication | null>(null);
  const [targetPreApproved, setTargetPreApproved] =
    useState<PreApprovedUser | null>(null);
  const [loadingTarget, setLoadingTarget] = useState(false);

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [bookingUrl, setBookingUrl] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!isInspectingOther) {
      setTargetProfile(profile);
      setTargetApp(application);
      setFullName(formatDisplayName(profile?.fullName || user?.displayName));
      setPhone(profile?.phone || application?.formData?.mobilePhone || "");
      setBookingUrl(profile?.bookingUrl || "");
      return;
    }

    const fetchInspectedClient = async () => {
      setLoadingTarget(true);
      try {
        if (inspectedUid) {
          const uSnap = await getDoc(doc(db, "users", inspectedUid));
          if (uSnap.exists()) {
            setTargetProfile(uSnap.data() as UserProfile);
          }
          const aSnap = await getDoc(doc(db, "applications", inspectedUid));
          if (aSnap.exists()) {
            setTargetApp(aSnap.data() as VisaApplication);
          }
        } else if (inspectedEmail) {
          const cleanMail = inspectedEmail.trim().toLowerCase();
          const allowSnap = await getDoc(doc(db, "allowed_emails", cleanMail));
          if (allowSnap.exists()) {
            setTargetPreApproved(allowSnap.data() as PreApprovedUser);
          }
        }
      } catch {
        setErrorMsg("No se pudo cargar la ficha 360° del cliente.");
      } finally {
        setLoadingTarget(false);
      }
    };

    fetchInspectedClient();
  }, [
    isInspectingOther,
    inspectedUid,
    inspectedEmail,
    profile,
    application,
    user,
  ]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = e.target.files?.[0];
    if (!rawFile || !user) return;

    if (!rawFile.type.startsWith("image/")) {
      setErrorMsg("Por favor selecciona una imagen válida (JPG, PNG o WebP).");
      return;
    }

    setUploadingAvatar(true);
    setFeedback("");
    setErrorMsg("");

    try {
      const optimizedAvatar = await optimizeImageForVault(rawFile, {
        maxWidth: 400,
        maxHeight: 400,
        quality: 0.85,
      });

      const storagePath = `vault/${user.uid}/avatar_${Date.now()}.webp`;
      const avatarRef = ref(storage, storagePath);
      await uploadBytes(avatarRef, optimizedAvatar);
      const downloadUrl = await getDownloadURL(avatarRef);

      await updateDoc(doc(db, "users", user.uid), {
        photoUrl: downloadUrl,
        photoURL: downloadUrl,
        updatedAt: new Date().toISOString(),
      });

      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: downloadUrl });
      }

      await recordSystemLog({
        category: "PII_VAULT",
        eventType: "Actualización de Fotografía de Perfil (WebP Optimizado)",
        outcome: "SUCCESS",
        actorEmail: user.email || "usuario",
        actorName: profile?.fullName || user.displayName || "Usuario",
        actorRole: profile?.role || "client",
        targetResource: storagePath,
        details: `Avatar optimizado de ${Math.round(
          rawFile.size / 1024
        )} KB a ${Math.round(
          optimizedAvatar.size / 1024
        )} KB con purga de metadatos EXIF.`,
      });

      setFeedback("¡Fotografía de perfil optimizada y actualizada con éxito!");
    } catch {
      setErrorMsg("No se pudo actualizar la foto de perfil.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleSaveOwnProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isInspectingOther) return;

    setSavingProfile(true);
    setFeedback("");
    setErrorMsg("");

    try {
      const cleanName = formatDisplayName(fullName);
      await updateDoc(doc(db, "users", user.uid), {
        fullName: cleanName,
        phone: phone.trim(),
        ...(isStaff ? { bookingUrl: bookingUrl.trim() } : {}),
        updatedAt: new Date().toISOString(),
      });

      if (application) {
        await updateDoc(doc(db, "applications", user.uid), {
          clientName: cleanName,
          "formData.fullName": cleanName,
          "formData.mobilePhone": phone.trim(),
          updatedAt: new Date().toISOString(),
        });
      }

      setFeedback("Datos de perfil guardados correctamente.");
    } catch {
      setErrorMsg("No se pudieron guardar los cambios del perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDirectPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || isInspectingOther) return;

    if (newPassword.length < 8) {
      setErrorMsg("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== confirmNewPassword) {
      setErrorMsg("Las contraseñas ingresadas no coinciden.");
      return;
    }

    setChangingPassword(true);
    setFeedback("");
    setErrorMsg("");

    try {
      await updatePassword(auth.currentUser, newPassword);

      await recordSystemLog({
        category: "SECURITY_AUTH",
        eventType: "Cambio Directo de Contraseña desde Perfil",
        outcome: "SUCCESS",
        actorEmail: user?.email || "usuario",
        actorName: profile?.fullName || user?.displayName || "Usuario",
        actorRole: profile?.role || "client",
        targetResource: "Credenciales de Acceso",
        details:
          "El titular actualizó su contraseña directamente desde Mi Perfil.",
      });

      setNewPassword("");
      setConfirmNewPassword("");
      setFeedback("¡Tu contraseña ha sido actualizada exitosamente!");
    } catch (err: any) {
      if (err?.code === "auth/requires-recent-login") {
        setErrorMsg(
          "Por seguridad, para cambiar tu contraseña después de varios minutos debes cerrar sesión y volver a ingresar."
        );
      } else {
        setErrorMsg("No se pudo actualizar la contraseña. Intenta de nuevo.");
      }
    } finally {
      setChangingPassword(false);
    }
  };

  if (loadingTarget) {
    return <DashboardContentSkeleton />;
  }

  const displayName = formatDisplayName(
    targetProfile?.fullName ||
      targetApp?.formData?.fullName ||
      targetApp?.clientName ||
      targetPreApproved?.fullName ||
      "Titular"
  );
  const displayEmail =
    targetProfile?.email ||
    targetApp?.clientEmail ||
    targetPreApproved?.email ||
    user?.email ||
    "---";
  const displayRole =
    targetProfile?.role || targetPreApproved?.role || "client";
  const displayDest =
    targetApp?.destination ||
    targetProfile?.destination ||
    targetPreApproved?.destination ||
    "USA";
  const displayPlan =
    targetApp?.planTier ||
    targetProfile?.planTier ||
    targetPreApproved?.planTier ||
    "Priority Pro";
  const displayAvatar =
    targetProfile?.photoUrl ||
    targetProfile?.photoURL ||
    (!isInspectingOther ? user?.photoURL : "") ||
    "";

  const metrics = calculateApplicationMetrics(targetApp);
  const deliverables = Array.isArray(targetApp?.officialDeliverables)
    ? targetApp?.officialDeliverables
    : [];
  const meetings = Array.isArray(targetApp?.meetings)
    ? targetApp?.meetings
    : [];

  return (
    <div className="space-y-8 font-sans">
      {isInspectingOther && (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand-charcoal text-white p-5 shadow-md">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-white/10 hover:bg-brand-red px-3.5 py-2 text-xs font-bold text-white transition-all"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Volver</span>
            </button>
            <div>
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-red block">
                MODO INSPECCIÓN 360° • BACKOFFICE
              </span>
              <p className="font-display text-sm sm:text-base font-bold">
                Viendo ficha integral de {displayName} ({displayEmail})
              </p>
            </div>
          </div>

          {targetApp && (
            <button
              type="button"
              onClick={() =>
                router.push(`/dashboard/admin/caso/${targetApp.id}`)
              }
              className="inline-flex items-center gap-2 rounded-full bg-brand-red px-5 py-2.5 text-xs font-bold text-white hover:bg-brand-red/90 transition-all"
            >
              <FolderKanban className="h-4 w-4" />
              <span>Abrir Workspace del Caso</span>
            </button>
          )}
        </div>
      )}

      {feedback && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
            <span>{feedback}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback("")}
            className="p-1 text-emerald-800/70 hover:text-emerald-950"
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
            className="p-1 text-brand-red/70 hover:text-brand-red"
            aria-label="Cerrar error"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* TARJETA SUPERIOR: RESUMEN DE IDENTIDAD Y ESTADO DEL EXPEDIENTE */}
      <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative">
            {displayAvatar ? (
              <img
                src={displayAvatar}
                alt={displayName}
                width={80}
                height={80}
                loading="lazy"
                decoding="async"
                referrerPolicy="no-referrer"
                className="h-20 w-20 rounded-2xl object-cover border-2 border-brand-charcoal/15 shadow-sm"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-brand-charcoal text-white font-display text-2xl font-bold">
                {displayName ? (
                  displayName.charAt(0).toUpperCase()
                ) : (
                  <UserCircle className="h-10 w-10" />
                )}
              </div>
            )}

            {!isInspectingOther && (
              <label
                title="Cambiar fotografía de perfil (se optimiza automáticamente a WebP)"
                className="cursor-pointer absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-xl bg-brand-red text-white shadow-md hover:bg-brand-charcoal transition-colors"
              >
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={handleAvatarUpload}
                />
              </label>
            )}
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl sm:text-2xl font-bold text-brand-charcoal">
                {displayName}
              </h2>
              <span className="rounded-full bg-brand-charcoal px-3 py-0.5 font-mono text-[10px] font-bold uppercase text-white">
                {displayRole === "admin"
                  ? "Admin"
                  : displayRole === "advisor"
                  ? "Asesor Legal"
                  : `Plan ${displayPlan}`}
              </span>
              {displayRole === "client" && (
                <span className="rounded-full bg-brand-red/10 px-3 py-0.5 font-mono text-[10px] font-bold uppercase text-brand-red">
                  {displayDest === "JAPAN" ? "🇯🇵 Japón MOFA" : "🇺🇸 EE. UU. B1/B2"}
                </span>
              )}
            </div>
            <p className="text-xs text-brand-charcoal/75">{displayEmail}</p>
            {uploadingAvatar && (
              <p className="text-[11px] font-semibold text-brand-red">
                Comprimiendo imagen a WebP y limpiando metadatos EXIF...
              </p>
            )}
          </div>
        </div>

        {displayRole === "client" && (
          <div className="w-full md:w-64 rounded-2xl bg-brand-platinum/50 p-4 border border-brand-charcoal/10 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-brand-charcoal">
              <span>Avance del Trámite</span>
              <span className="text-brand-red">
                {metrics.progressPercentage}%
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-brand-charcoal/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-red transition-all duration-500"
                style={{ width: `${metrics.progressPercentage}%` }}
              />
            </div>
            <p className="text-[11px] text-brand-charcoal/70 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-brand-red" />
              <span>
                Paso {metrics.currentStep} de 4 • Estatus:{" "}
                <strong className="uppercase">{metrics.autoStatus}</strong>
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-6 space-y-6">
          <form
            onSubmit={handleSaveOwnProfile}
            className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5"
          >
            <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
              <div>
                <h3 className="font-display text-base font-bold text-brand-charcoal">
                  Datos de Identidad y Contacto
                </h3>
                <p className="text-xs text-brand-charcoal/70">
                  Información sincronizada con tu expediente migratorio.
                </p>
              </div>
              <ShieldCheck className="h-5 w-5 text-brand-red" />
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  disabled={isInspectingOther}
                  value={isInspectingOther ? displayName : fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Correo Electrónico Autorizado
                </label>
                <input
                  type="email"
                  disabled
                  value={displayEmail}
                  className={`${inputBaseClass} opacity-70 cursor-not-allowed`}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Teléfono Móvil / WhatsApp
                </label>
                <input
                  type="tel"
                  disabled={isInspectingOther}
                  value={
                    isInspectingOther
                      ? targetProfile?.phone ||
                        targetApp?.formData?.mobilePhone ||
                        targetPreApproved?.phone ||
                        ""
                      : phone
                  }
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+57 300 000 0000"
                  className={inputBaseClass}
                />
              </div>

              {!isInspectingOther && isStaff && (
                <div className="space-y-1.5 pt-2 border-t border-brand-platinum">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Enlace de Agenda Personal (Calendly / Google Calendar)
                  </label>
                  <input
                    type="url"
                    value={bookingUrl}
                    onChange={(e) => setBookingUrl(e.target.value)}
                    placeholder="https://calendar.app.google/..."
                    className={inputBaseClass}
                  />
                </div>
              )}
            </div>

            {!isInspectingOther && (
              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-red px-6 py-3 text-xs font-bold text-white shadow-sm hover:bg-brand-red/90 disabled:opacity-50 transition-all"
                >
                  <span>
                    {savingProfile ? "Guardando..." : "Guardar Cambios"}
                  </span>
                </button>
              </div>
            )}
          </form>

          {!isInspectingOther && (
            <form
              onSubmit={handleDirectPasswordChange}
              className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-brand-platinum pb-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-charcoal text-white">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-display text-base font-bold text-brand-charcoal">
                    Cambiar Contraseña
                  </h3>
                  <p className="text-xs text-brand-charcoal/70">
                    Actualiza tu clave privada de acceso directamente.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Nueva Contraseña
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      required
                      minLength={8}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 8 caracteres"
                      className={`${inputBaseClass} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-charcoal/60 hover:text-brand-charcoal"
                    >
                      {showNewPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Confirmar Contraseña
                  </label>
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repite la contraseña"
                    className={inputBaseClass}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={changingPassword || !newPassword}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-6 py-3 text-xs font-bold text-white hover:bg-brand-red transition-all disabled:opacity-50"
                >
                  <KeyRound className="h-4 w-4" />
                  <span>
                    {changingPassword
                      ? "Actualizando..."
                      : "Actualizar Contraseña"}
                  </span>
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
              <div className="flex items-center gap-2.5">
                <FileText className="h-5 w-5 text-brand-red" />
                <div>
                  <h3 className="font-display text-base font-bold text-brand-charcoal">
                    Entregables Oficiales Emitidos ({deliverables.length})
                  </h3>
                  <p className="text-xs text-brand-charcoal/70">
                    Confirmación DS-160, citas CAS o carpeta japonesa MOFA.
                  </p>
                </div>
              </div>
            </div>

            {deliverables.length === 0 ? (
              <div className="rounded-2xl bg-brand-platinum/30 p-6 text-center space-y-1">
                <p className="text-xs font-bold text-brand-charcoal">
                  Aún no hay entregables finales emitidos
                </p>
                <p className="text-[11px] text-brand-charcoal/70">
                  Tan pronto tu especialista legal radique tus formularios
                  oficiales, aparecerán aquí listos para descargar.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {deliverables.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-2xl bg-brand-platinum/40 p-4 border border-brand-charcoal/10"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-brand-charcoal truncate">
                        {item.label}
                      </p>
                      <p className="text-[11px] text-brand-charcoal/65 truncate">
                        {item.fileName} • Emitido por {item.uploadedBy}
                      </p>
                    </div>
                    <a
                      href={item.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-red px-4 py-2 text-xs font-bold text-white hover:bg-brand-red/90 shrink-0 transition-all"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Descargar</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-brand-platinum pb-4">
              <div className="flex items-center gap-2.5">
                <Calendar className="h-5 w-5 text-brand-red" />
                <div>
                  <h3 className="font-display text-base font-bold text-brand-charcoal">
                    Sesiones Consulares 1-a-1 ({meetings.length})
                  </h3>
                  <p className="text-xs text-brand-charcoal/70">
                    Simulacros programados por Google Meet y descarga .ics.
                  </p>
                </div>
              </div>
            </div>

            {meetings.length === 0 ? (
              <div className="rounded-2xl bg-brand-platinum/30 p-6 text-center space-y-1">
                <p className="text-xs font-bold text-brand-charcoal">
                  Sin sesiones programadas actualmente
                </p>
                <p className="text-[11px] text-brand-charcoal/70">
                  Puedes coordinar tu sesión desde la Sala Consular una vez tu
                  documentación esté completa.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {meetings.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl bg-brand-platinum/40 p-4 border border-brand-charcoal/10"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-bold text-brand-charcoal">
                          {m.title}
                        </p>
                        {m.completed && (
                          <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                            Completada
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-brand-charcoal/70">
                        {new Date(m.dateTime).toLocaleString("es-CO", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}{" "}
                        • Asesor: {formatDisplayName(m.advisorName)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => downloadMeetingIcs(m, displayName)}
                        className="inline-flex items-center gap-1 rounded-full border border-brand-charcoal/15 bg-brand-white hover:bg-brand-charcoal hover:text-white px-3.5 py-2 text-xs font-bold text-brand-charcoal transition-all"
                        title="Descargar archivo .ics para Apple Calendar / Outlook"
                      >
                        <CalendarPlus className="h-3.5 w-3.5 text-brand-red" />
                        <span>.ics</span>
                      </button>

                      {m.meetUrl && (
                        <a
                          href={m.meetUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal px-4 py-2 text-xs font-bold text-white hover:bg-brand-red shrink-0 transition-all"
                        >
                          <Video className="h-3.5 w-3.5" />
                          <span>Unirse a Meet</span>
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<DashboardContentSkeleton />}>
        <ProfilePageContent />
      </Suspense>
    </DashboardLayout>
  );
}