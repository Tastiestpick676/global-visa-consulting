// app/dashboard/formulario/page.tsx
"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";
import { DestinationCountry, SmartIntakeData } from "@/types/visa";
import {
  buildAuditLogEntry,
  calculateApplicationMetrics,
  sendInternalNotification,
} from "@/lib/firebase/db";
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  User,
  Plane,
  Briefcase,
  ShieldAlert,
  Lock,
  X,
} from "lucide-react";

const defaultIntake: SmartIntakeData = {
  fullName: "",
  nationalId: "",
  maritalStatus: "Soltero/a",
  homeAddress: "",
  cityAndState: "",
  mobilePhone: "",
  purposeOfTrip: "Turismo y vacaciones",
  estimatedArrivalDate: "",
  stayDurationDays: "15 días",
  tripFinancier: "Yo mismo (Recursos propios)",
  currentOccupation: "",
  companyOrEmployerName: "",
  monthlyIncomeLocal: "",
  partnerOrParentsOccupation: "",
  japanPortOfEntry: "Aeropuerto Internacional de Narita (Tokio)",
  japanAirlineOrFlight: "Por definir (Itinerario proyectado)",
  japanCitiesToVisit: "Tokio, Kioto y Osaka",
  hasGuarantorInJapan: "no",
  guarantorDetails: "",
  previousStayInJapan: "No, primera vez visitando Japón",
  socialMediaHandles: "",
  parentsFullNamesAndDob: "",
  hasRelativesInUS: "no",
  relativesInUSDetails: "",
  previousJobsAndEducationSummary: "",
  hasPreviousVisaRefusal: "no",
  refusalExplanation: "",
  additionalNotes: "",
};

const inputClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 px-4 text-sm font-sans text-brand-charcoal placeholder:text-brand-charcoal/35 focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed";

const textareaClass =
  "w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 p-4 text-sm font-sans text-brand-charcoal placeholder:text-brand-charcoal/35 focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all disabled:opacity-60 disabled:cursor-not-allowed";

export default function FormularioPage() {
  const { user, profile, application, refreshApplication } = useAuth();
  const [destination, setDestination] = useState<DestinationCountry>("USA");
  const [formData, setFormData] = useState<SmartIntakeData>(defaultIntake);
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [error, setError] = useState("");

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  // 4. Bloqueo automático cuando el expediente ya pasó a Auditoría Legal / Listo Consulado (salvo que el asesor lo desbloquee)
  const isLockedStage =
    application?.status === "in_legal_review" ||
    application?.status === "ready_for_consulate" ||
    application?.status === "approved" ||
    application?.status === "rejected";

  const isFormLockedForClient =
    !isStaff && isLockedStage && !application?.formUnlockedByAdvisor;

  useEffect(() => {
    if (!savedSuccess && !error) return;
    const timer = setTimeout(() => {
      setSavedSuccess(false);
      setError("");
    }, 5000);
    return () => clearTimeout(timer);
  }, [savedSuccess, error]);

  useEffect(() => {
    if (application) {
      if (application.destination) {
        setDestination(application.destination);
      }
      if (application.formData) {
        setFormData((prev) => ({
          ...prev,
          ...application.formData,
        }));
      } else if (profile?.fullName) {
        setFormData((prev) => ({ ...prev, fullName: profile.fullName }));
      }
    }
  }, [application, profile]);

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >
  ) => {
    if (isFormLockedForClient) return;
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setSavedSuccess(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || isFormLockedForClient) return;

    setSaving(true);
    setError("");
    setSavedSuccess(false);

    try {
      const auditEntry = buildAuditLogEntry(
        "Actualización de Cuestionario Estratégico",
        `El titular actualizó los datos de su formulario (${destination}).`,
        formData.fullName || profile?.fullName || "Cliente",
        profile?.role || "client"
      );

      const nextAuditLogs = [
        auditEntry,
        ...(application?.auditLogs || []),
      ];

      const simulatedApp = {
        ...(application || {}),
        id: user.uid,
        userId: user.uid,
        destination,
        formData,
      } as any;

      const metrics = calculateApplicationMetrics(simulatedApp);

      await setDoc(
        doc(db, "applications", user.uid),
        {
          id: user.uid,
          userId: user.uid,
          clientName: formData.fullName || profile?.fullName || "Cliente",
          clientEmail: profile?.email || user.email || "",
          destination,
          visaType:
            destination === "JAPAN"
              ? "Visa de Turismo Japón (Estancia Corta)"
              : "Visa B1/B2 Estados Unidos",
          formData,
          status: metrics.autoStatus,
          progressPercentage: metrics.progressPercentage,
          currentStep: metrics.currentStep,
          auditLogs: nextAuditLogs,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      // Enviar notificación interna al Asesor asignado (o al canal STAFF si está en bolsa)
      await sendInternalNotification(
        application?.assignedAdvisorId || "STAFF",
        `Cuestionario actualizado: ${formData.fullName || profile?.fullName}`,
        `El cliente ha guardado cambios en su Cuestionario Estratégico (${destination}).`,
        `/dashboard/admin/caso/${user.uid}`
      );

      await refreshApplication();
      setSavedSuccess(true);
    } catch {
      setError("No se pudieron guardar los cambios. Verifica tu conexión.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 font-sans">
        {/* Cabecera */}
        <div className="rounded-2xl bg-brand-charcoal p-7 sm:p-8 text-brand-white shadow-lg flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-3 py-1 text-xs font-semibold text-brand-red">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {destination === "JAPAN"
                  ? "🇯🇵 Admisión Simplificada — Embajada del Japón"
                  : "🇺🇸 Admisión Simplificada — DS-160 Estados Unidos"}
              </span>
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Cuestionario Estratégico de Admisión
            </h2>
            <p className="text-xs sm:text-sm text-white/70 max-w-xl leading-relaxed">
              Nosotros extraemos los datos técnicos directamente de tu{" "}
              <strong className="text-white">Pasaporte y Carta Laboral</strong>{" "}
              en la Bóveda. Aquí solo dinos lo que no aparece en tus certificados.
            </p>
          </div>

          {isStaff && (
            <div className="rounded-xl bg-white/[0.06] p-3 border border-white/10 shrink-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-white/50 mb-2 text-center">
                Vista Admin
              </p>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => setDestination("USA")}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    destination === "USA"
                      ? "bg-brand-red text-white shadow-sm"
                      : "text-white/65 hover:bg-white/10"
                  }`}
                >
                  🇺🇸 EE. UU.
                </button>
                <button
                  type="button"
                  onClick={() => setDestination("JAPAN")}
                  className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                    destination === "JAPAN"
                      ? "bg-brand-red text-white shadow-sm"
                      : "text-white/65 hover:bg-white/10"
                  }`}
                >
                  🇯🇵 Japón
                </button>
              </div>
            </div>
          )}
        </div>

        {/* BANNER DE BLOQUEO AUTOMÁTICO CUANDO EL CASO ESTÁ EN AUDITORÍA LEGAL O LISTO CONSULADO */}
        {isFormLockedForClient && (
          <div className="rounded-2xl bg-amber-500/10 border border-amber-500/35 p-5 flex items-start gap-3.5">
            <Lock className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-bold uppercase tracking-wider text-amber-950">
                Cuestionario Protegido en Fase de Radicación Oficial
              </p>
              <p className="text-xs text-amber-900/85 leading-relaxed">
                Tu expediente ya se encuentra en etapa de <strong>Auditoría Legal / Consulado</strong> y tu especialista está diligenciando tus formularios oficiales con esta información. Por seguridad, la edición está bloqueada; si necesitas corregir algún dato, indícaselo a tu asesor para que habilite la edición temporalmente.
              </p>
            </div>
          </div>
        )}

        {savedSuccess && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs sm:text-sm font-medium text-emerald-700">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>
                ¡Cuestionario guardado y notificado a tu especialista legal!
              </span>
            </div>
            <button
              type="button"
              onClick={() => setSavedSuccess(false)}
              className="p-1 text-emerald-700/60 hover:text-emerald-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {error && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 text-xs sm:text-sm font-medium text-brand-red">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="p-1 text-brand-red/60 hover:text-brand-red"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <fieldset disabled={isFormLockedForClient} className="space-y-6">
            {/* BLOQUE 1: CONTACTO Y DOMICILIO */}
            <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
              <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
                <User className="h-5 w-5 text-brand-red" />
                <div>
                  <h3 className="font-display text-base font-bold text-brand-charcoal">
                    1. Datos de Contacto y Domicilio Actual
                  </h3>
                  <p className="text-xs text-brand-charcoal/55">
                    El número de pasaporte y fechas de vencimiento los tomamos de tu PDF en la Bóveda.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Nombre Completo (Como aparece en tu pasaporte)
                  </label>
                  <input
                    type="text"
                    name="fullName"
                    required
                    value={formData.fullName}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    No. de Cédula / Documento de Identidad Nacional
                  </label>
                  <input
                    type="text"
                    name="nationalId"
                    required
                    value={formData.nationalId}
                    onChange={handleChange}
                    placeholder="Ej. 1.020.304.050"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Estado Civil
                  </label>
                  <select
                    name="maritalStatus"
                    value={formData.maritalStatus}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="Soltero/a">Soltero/a</option>
                    <option value="Casado/a">Casado/a</option>
                    <option value="Unión Libre">Unión Libre</option>
                    <option value="Divorciado/a">Divorciado/a</option>
                    <option value="Viudo/a">Viudo/a</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Teléfono Móvil (WhatsApp)
                  </label>
                  <input
                    type="tel"
                    name="mobilePhone"
                    required
                    value={formData.mobilePhone}
                    onChange={handleChange}
                    placeholder="Ej. +57 300 123 4567"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Ciudad y Departamento
                  </label>
                  <input
                    type="text"
                    name="cityAndState"
                    required
                    value={formData.cityAndState}
                    onChange={handleChange}
                    placeholder="Ej. Bogotá, Cundinamarca"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Dirección Completa de Residencia (Con barrio o edificio)
                </label>
                <input
                  type="text"
                  name="homeAddress"
                  required
                  value={formData.homeAddress}
                  onChange={handleChange}
                  placeholder="Ej. Calle 93 # 15-20 Apto 501"
                  className={inputClass}
                />
              </div>
            </div>

            {/* BLOQUE 2: OCUPACIÓN Y PERFIL FINANCIERO */}
            <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
              <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
                <Briefcase className="h-5 w-5 text-brand-red" />
                <div>
                  <h3 className="font-display text-base font-bold text-brand-charcoal">
                    2. Resumen Laboral y Solvencia
                  </h3>
                  <p className="text-xs text-brand-charcoal/55">
                    Información clave para estructurar tu perfil de arraigo ante el cónsul.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Ocupación o Cargo Actual
                  </label>
                  <input
                    type="text"
                    name="currentOccupation"
                    required
                    value={formData.currentOccupation}
                    onChange={handleChange}
                    placeholder="Ej. Ingeniero / Empresario"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Nombre de Empresa o Negocio
                  </label>
                  <input
                    type="text"
                    name="companyOrEmployerName"
                    required
                    value={formData.companyOrEmployerName}
                    onChange={handleChange}
                    placeholder="Ej. Bancolombia / Independiente"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Ingreso Mensual Aproximado
                  </label>
                  <input
                    type="text"
                    name="monthlyIncomeLocal"
                    required
                    value={formData.monthlyIncomeLocal}
                    onChange={handleChange}
                    placeholder="Ej. $6,500,000 COP"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Fecha Probable de Viaje
                  </label>
                  <input
                    type="date"
                    name="estimatedArrivalDate"
                    required
                    value={formData.estimatedArrivalDate}
                    onChange={handleChange}
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Días Estimados de Estancia
                  </label>
                  <input
                    type="text"
                    name="stayDurationDays"
                    required
                    value={formData.stayDurationDays}
                    onChange={handleChange}
                    placeholder="Ej. 15 días"
                    className={inputClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    ¿Quién costea tu viaje?
                  </label>
                  <select
                    name="tripFinancier"
                    value={formData.tripFinancier}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="Yo mismo (Recursos propios)">
                      Yo mismo (Recursos propios)
                    </option>
                    <option value="Un familiar / Pareja (Con Carta de Garantía)">
                      Un familiar / Pareja (Patrocinador)
                    </option>
                    <option value="Empresa patrocinadora">
                      Empresa patrocinadora
                    </option>
                  </select>
                </div>
              </div>
            </div>

            {/* BLOQUE 3 CONDICIONAL: JAPÓN vs EE. UU. */}
            {destination === "JAPAN" ? (
              <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
                <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
                  <Plane className="h-5 w-5 text-brand-red" />
                  <div>
                    <h3 className="font-display text-base font-bold text-brand-charcoal">
                      3. Datos Exclusivos para Embajada del Japón (Programa de Estancia)
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      Ocupación de tu Cónyuge o de tus Padres
                    </label>
                    <input
                      type="text"
                      name="partnerOrParentsOccupation"
                      required
                      value={formData.partnerOrParentsOccupation || ""}
                      onChange={handleChange}
                      placeholder="Ej. Madre: Docente / Padre: Pensionado"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      Ciudades que te gustaría visitar en Japón
                    </label>
                    <input
                      type="text"
                      name="japanCitiesToVisit"
                      required
                      value={formData.japanCitiesToVisit || ""}
                      onChange={handleChange}
                      placeholder="Ej. Tokio, Kioto, Osaka y Hiroshima"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      Aeropuerto de Entrada Deseado
                    </label>
                    <input
                      type="text"
                      name="japanPortOfEntry"
                      value={formData.japanPortOfEntry || ""}
                      onChange={handleChange}
                      placeholder="Ej. Narita o Haneda (Tokio)"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      ¿Has visitado Japón anteriormente?
                    </label>
                    <input
                      type="text"
                      name="previousStayInJapan"
                      value={formData.previousStayInJapan || ""}
                      onChange={handleChange}
                      placeholder="No / Sí (indicar año)"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-2 border-t border-brand-platinum">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    ¿Tienes algún amigo, familiar o garante en Japón que te invite?
                  </label>
                  <select
                    name="hasGuarantorInJapan"
                    value={formData.hasGuarantorInJapan || "no"}
                    onChange={handleChange}
                    className={inputClass}
                  >
                    <option value="no">
                      No, viajo 100% por turismo independiente (Hotel)
                    </option>
                    <option value="yes">
                      Sí, cuento con un invitante o garante en Japón
                    </option>
                  </select>

                  {formData.hasGuarantorInJapan === "yes" && (
                    <textarea
                      name="guarantorDetails"
                      rows={2}
                      value={formData.guarantorDetails || ""}
                      onChange={handleChange}
                      placeholder="Nombre completo de la persona en Japón, parentesco/relación, dirección y teléfono..."
                      className={textareaClass}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
                <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
                  <ShieldAlert className="h-5 w-5 text-brand-red" />
                  <div>
                    <h3 className="font-display text-base font-bold text-brand-charcoal">
                      3. Preguntas Clave para el Formulario Oficial DS-160 (EE. UU.)
                    </h3>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      Nombres Completos y Fecha de Nacimiento de tus Padres
                    </label>
                    <input
                      type="text"
                      name="parentsFullNamesAndDob"
                      required
                      value={formData.parentsFullNamesAndDob || ""}
                      onChange={handleChange}
                      placeholder="Ej. Padre: Juan Pérez (12/05/1960), Madre: Ana Gómez (08/11/1964)"
                      className={inputClass}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      Usuarios de tus Redes Sociales Públicas (Instagram, LinkedIn, etc.)
                    </label>
                    <input
                      type="text"
                      name="socialMediaHandles"
                      required
                      value={formData.socialMediaHandles || ""}
                      onChange={handleChange}
                      placeholder="Ej. IG: @juanperez, LinkedIn: juan-perez"
                      className={inputClass}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Resumen Rápido: Trabajos Anteriores (Últimos 5 años) y Universidad/Colegio
                  </label>
                  <textarea
                    name="previousJobsAndEducationSummary"
                    rows={3}
                    value={formData.previousJobsAndEducationSummary || ""}
                    onChange={handleChange}
                    placeholder="Ej. 2020-2023: Analista en Empresa X. Universidad: Administración en Univ. de los Andes (2015-2020). (O indica si subiste tu Hoja de Vida a la Bóveda)."
                    className={textareaClass}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-2 border-t border-brand-platinum">
                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      ¿Tienes familiares directos viviendo en Estados Unidos?
                    </label>
                    <select
                      name="hasRelativesInUS"
                      value={formData.hasRelativesInUS || "no"}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="no">No</option>
                      <option value="yes">Sí</option>
                    </select>
                    {formData.hasRelativesInUS === "yes" && (
                      <input
                        type="text"
                        name="relativesInUSDetails"
                        value={formData.relativesInUSDetails || ""}
                        onChange={handleChange}
                        placeholder="Nombre, parentesco y estatus en EE. UU."
                        className={inputClass}
                      />
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      ¿Alguna vez te han negado o cancelado una Visa de EE. UU.?
                    </label>
                    <select
                      name="hasPreviousVisaRefusal"
                      value={formData.hasPreviousVisaRefusal || "no"}
                      onChange={handleChange}
                      className={inputClass}
                    >
                      <option value="no">No, nunca</option>
                      <option value="yes">Sí, tuve un rechazo previo</option>
                    </select>
                    {formData.hasPreviousVisaRefusal === "yes" && (
                      <input
                        type="text"
                        name="refusalExplanation"
                        value={formData.refusalExplanation || ""}
                        onChange={handleChange}
                        placeholder="¿En qué año fue y qué te indicó el cónsul?"
                        className={inputClass}
                      />
                    )}
                  </div>
                </div>
              </div>
            )}

            {!isFormLockedForClient && (
              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-brand-red px-8 py-3.5 text-xs font-semibold text-brand-white shadow-lg shadow-brand-red/25 hover:bg-brand-red/90 transition-all disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  <span>
                    {saving ? "Guardando datos..." : "Guardar Cuestionario"}
                  </span>
                </button>
              </div>
            )}
          </fieldset>
        </form>
      </div>
    </DashboardLayout>
  );
}