// app/dashboard/formulario/page.tsx
"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { SmartFormData } from "@/types/visa";
import {
  buildAuditLogEntry,
  calculateApplicationMetrics,
  formatDisplayName,
  recordSystemLog,
  sendInternalNotification,
} from "@/lib/firebase/db";
import {
  FileText,
  Save,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Lock,
  Plane,
  Briefcase,
  ShieldCheck,
  User,
  X,
} from "lucide-react";

const inputClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 px-3.5 text-sm font-sans text-brand-charcoal placeholder:text-brand-charcoal/45 focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

const textareaClass =
  "w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/15 p-3.5 text-sm font-sans text-brand-charcoal placeholder:text-brand-charcoal/45 focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

function maskForSummaryDocument(raw?: string): string {
  if (!raw || raw.trim().length === 0) return "";
  const clean = raw.trim();
  if (clean.length <= 4) return "••••";
  return `${"•".repeat(Math.max(4, clean.length - 4))}${clean.slice(-4)}`;
}

export default function FormularioInteligentePage() {
  const { user, profile, application } = useAuth();
  const isJapan = application?.destination === "JAPAN";

  const [formData, setFormData] = useState<SmartFormData>({});
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Cargar datos generales + recuperar los 4 campos PII reales desde la subcolección aislada private_pii/vault
  useEffect(() => {
    const loadFullFormForOwner = async () => {
      const baseForm: SmartFormData = application?.formData
        ? { ...application.formData }
        : profile?.fullName
        ? { fullName: formatDisplayName(profile.fullName) }
        : {};

      if (application?.id) {
        try {
          const vaultSnap = await getDoc(
            doc(db, "applications", application.id, "private_pii", "vault")
          );
          if (vaultSnap.exists()) {
            const piiData = vaultSnap.data();
            setFormData({
              ...baseForm,
              nationalId: piiData.nationalId || baseForm.nationalId || "",
              passportNumber:
                piiData.passportNumber || baseForm.passportNumber || "",
              monthlyIncomeCop:
                piiData.monthlyIncomeCop || baseForm.monthlyIncomeCop || "",
              mobilePhone: piiData.mobilePhone || baseForm.mobilePhone || "",
            });
            return;
          }
        } catch {}
      }

      setFormData(baseForm);
    };

    loadFullFormForOwner();
  }, [application, profile]);

  const handleChange = (field: keyof SmartFormData, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !application) return;

    setSaving(true);
    setFeedback("");
    setErrorMsg("");

    try {
      const cleanName = formatDisplayName(
        formData.fullName || profile?.fullName || user.displayName || "Cliente"
      );

      // 1. Cierre F-04: Guardar los valores PII reales únicamente en la subcolección aislada private_pii/vault
      const now = new Date().toISOString();
      await setDoc(
        doc(db, "applications", application.id, "private_pii", "vault"),
        {
          nationalId: (formData.nationalId || "").trim(),
          passportNumber: (formData.passportNumber || "").trim(),
          monthlyIncomeCop: (formData.monthlyIncomeCop || "").trim(),
          mobilePhone: (formData.mobilePhone || "").trim(),
          updatedAt: now,
        },
        { merge: true }
      );

      // 2. En el documento principal applications/{id}, guardar los 4 campos PII ya truncados/enmascarados
      const maskedFormForMainDoc: SmartFormData = {
        ...formData,
        fullName: cleanName,
        nationalId: maskForSummaryDocument(formData.nationalId),
        passportNumber: maskForSummaryDocument(formData.passportNumber),
        monthlyIncomeCop: maskForSummaryDocument(formData.monthlyIncomeCop),
        mobilePhone: maskForSummaryDocument(formData.mobilePhone),
      };

      const tempApp = {
        ...application,
        formData: maskedFormForMainDoc,
      };
      const metrics = calculateApplicationMetrics(tempApp);

      const auditEntry = buildAuditLogEntry(
        isJapan
          ? "Actualización de Cuestionario MOFA / Japón"
          : "Actualización de Formulario Inteligente DS-160",
        `El titular guardó ${metrics.formCompletedCount} campos estratégicos con aislamiento PII activo (${metrics.progressPercentage}% de avance).`,
        cleanName,
        profile?.role || "client"
      );

      const existingLogs = Array.isArray(application.auditLogs)
        ? application.auditLogs
        : [];

      await updateDoc(doc(db, "applications", application.id), {
        clientName: cleanName,
        formData: maskedFormForMainDoc,
        progressPercentage: metrics.progressPercentage,
        currentStep: metrics.currentStep,
        status: metrics.autoStatus,
        auditLogs: [auditEntry, ...existingLogs],
        updatedAt: now,
      });

      await recordSystemLog({
        category: "CASE_TRACEABILITY",
        eventType: isJapan
          ? "Guardado de Cuestionario MOFA (PII Aislado)"
          : "Guardado de Formulario DS-160 (PII Aislado)",
        outcome: "SUCCESS",
        actorEmail: user.email || "cliente",
        actorName: cleanName,
        actorRole: profile?.role || "client",
        targetResource: `${cleanName} (${application.destination})`,
        details: `Cuestionario actualizado (${metrics.formCompletedCount} campos) con segregación criptográfica en subcolección private_pii.`,
      });

      await sendInternalNotification(
        application.assignedAdvisorId || "STAFF",
        `Formulario actualizado: ${cleanName}`,
        `${cleanName} actualizó su Formulario Inteligente (${
          isJapan ? "Japón MOFA" : "EE. UU. DS-160"
        }).`,
        `/dashboard/admin/caso/${application.id}`
      );

      setFeedback(
        "¡Respuestas guardadas con aislamiento PII! Tu porcentaje de avance se ha actualizado."
      );
    } catch {
      setErrorMsg("No se pudieron guardar los cambios. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  const liveMetrics = calculateApplicationMetrics(
    application ? { ...application, formData } : null
  );

  return (
    <DashboardLayout>
      <form onSubmit={handleSaveForm} className="space-y-8 font-sans">
        <div className="rounded-3xl bg-brand-charcoal text-brand-white p-6 sm:p-8 border border-white/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-red/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-red">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {isJapan
                  ? "EMBAJADA DEL JAPÓN • MOFA & SCHEDULE OF STAY"
                  : "DEPARTAMENTO DE ESTADO EE. UU. • CEAC DS-160"}
              </span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              {isJapan
                ? "Formulario Inteligente — Visa Japón y Programa de Estancia"
                : "Formulario Inteligente — Solicitud Oficial DS-160 (B1/B2)"}
            </h2>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              {isJapan
                ? "Responde en español únicamente los datos estratégicos de tu itinerario, vuelos y solvencia. Nuestro equipo estructurará tu formulario MOFA y tu Schedule of Stay técnico día por día."
                : "Responde en español y sin tecnicismos. Nuestro equipo legal auditará tus respuestas y las traducirá al inglés técnico exigido por el sistema consular CEAC."}
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 shrink-0 space-y-2 min-w-[210px]">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-white/75">Campos Completados</span>
              <span className="text-brand-red">
                {liveMetrics.formCompletedCount} respuestas
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-red transition-all duration-300"
                style={{
                  width: `${Math.min(
                    100,
                    Math.round((liveMetrics.formCompletedCount / 10) * 100)
                  )}%`,
                }}
              />
            </div>
            <p className="text-[11px] text-white/65 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-400" />
              <span>Bóveda Subcolección PII Activa</span>
            </p>
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
              className="p-1 text-emerald-800/70 hover:text-emerald-950"
              aria-label="Cerrar alerta"
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

        <section className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5">
          <div className="flex items-center gap-3 border-b border-brand-platinum pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-charcoal text-white">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-brand-charcoal">
                1. Identidad Personal y Documento de Viaje (PII Protegido)
              </h3>
              <p className="text-xs text-brand-charcoal/70">
                Tal como aparece en tu pasaporte biométrico vigente.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Nombres y Apellidos Completos *
              </label>
              <input
                type="text"
                required
                value={formData.fullName || ""}
                onChange={(e) => handleChange("fullName", e.target.value)}
                placeholder="Ej. Luz Marina Rangel"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Documento de Identidad (Cédula / DNI) *
              </label>
              <input
                type="text"
                required
                value={formData.nationalId || ""}
                onChange={(e) => handleChange("nationalId", e.target.value)}
                placeholder="Número sin puntos"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Número de Pasaporte Vigente *
              </label>
              <input
                type="text"
                required
                value={formData.passportNumber || ""}
                onChange={(e) => handleChange("passportNumber", e.target.value)}
                placeholder="Ej. PE123456"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Estado Civil Actual
              </label>
              <select
                value={formData.maritalStatus || "Soltero(a)"}
                onChange={(e) => handleChange("maritalStatus", e.target.value)}
                className={inputClass}
              >
                <option value="Soltero(a)">Soltero(a)</option>
                <option value="Casado(a)">Casado(a)</option>
                <option value="Unión Libre">Unión Libre</option>
                <option value="Divorciado(a)">Divorciado(a)</option>
                <option value="Viudo(a)">Viudo(a)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Teléfono Móvil / WhatsApp *
              </label>
              <input
                type="tel"
                required
                value={formData.mobilePhone || ""}
                onChange={(e) => handleChange("mobilePhone", e.target.value)}
                placeholder="+57 300 000 0000"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Ciudad y Dirección de Residencia
              </label>
              <input
                type="text"
                value={formData.homeAddress || ""}
                onChange={(e) => handleChange("homeAddress", e.target.value)}
                placeholder="Calle / Carrera, Barrio, Ciudad"
                className={inputClass}
              />
            </div>
          </div>
        </section>

        <section className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5">
          <div className="flex items-center gap-3 border-b border-brand-platinum pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-white">
              <Plane className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-brand-charcoal">
                {isJapan
                  ? "2. Plan de Vuelo y Schedule of Stay (Ruta en Japón)"
                  : "2. Propósito del Viaje y Estadía en Estados Unidos"}
              </h3>
              <p className="text-xs text-brand-charcoal/70">
                {isJapan
                  ? "Datos clave para armar tu cuadro técnico diario exigido por la Embajada del Japón."
                  : "Fechas estimadas y ciudades para el bloque Travel Information del DS-160."}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Fecha Estimada de Llegada *
              </label>
              <input
                type="date"
                required
                value={formData.intendedArrivalDate || ""}
                onChange={(e) =>
                  handleChange("intendedArrivalDate", e.target.value)
                }
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Duración Estimada del Viaje (Días) *
              </label>
              <input
                type="text"
                required
                value={formData.intendedStayDuration || ""}
                onChange={(e) =>
                  handleChange("intendedStayDuration", e.target.value)
                }
                placeholder={isJapan ? "Ej. 14 días" : "Ej. 10 días"}
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                ¿Quién costea los gastos del viaje?
              </label>
              <select
                value={formData.tripPayer || "Recursos Propios"}
                onChange={(e) => handleChange("tripPayer", e.target.value)}
                className={inputClass}
              >
                <option value="Recursos Propios">
                  Recursos Propios (Yo mismo)
                </option>
                <option value="Patrocinador / Familiar">
                  Patrocinador / Familiar (Con Carta de Garantía)
                </option>
                <option value="Empresa Empleadora">Empresa Empleadora</option>
              </select>
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <label className="block text-xs font-semibold text-brand-charcoal">
                {isJapan
                  ? "Ciudades a visitar en Japón (Para Schedule of Stay)"
                  : "Ciudades y Lugares que planeas visitar en EE. UU."}
              </label>
              <input
                type="text"
                value={formData.destinationCities || ""}
                onChange={(e) =>
                  handleChange("destinationCities", e.target.value)
                }
                placeholder={
                  isJapan
                    ? "Ej. Tokio (5 noches), Kioto (4 noches), Osaka (3 noches)"
                    : "Ej. Miami y Orlando, Florida"
                }
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Hotel o Dirección donde te alojarás
              </label>
              <input
                type="text"
                value={formData.accommodationDetails || ""}
                onChange={(e) =>
                  handleChange("accommodationDetails", e.target.value)
                }
                placeholder={
                  isJapan
                    ? "Ej. Hotel Gracery Shinjuku, Tokio"
                    : "Ej. Hotel Holiday Inn Miami Beach"
                }
                className={inputClass}
              />
            </div>
          </div>

          {isJapan && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-brand-platinum">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Aeropuerto de Entrada a Japón y Aerolínea tentativa
                </label>
                <input
                  type="text"
                  value={formData.japanEntryPort || ""}
                  onChange={(e) =>
                    handleChange("japanEntryPort", e.target.value)
                  }
                  placeholder="Ej. Aeropuerto Narita (NRT) / Haneda (HND)"
                  className={inputClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Resumen de Actividades Deseadas en Japón
                </label>
                <input
                  type="text"
                  value={formData.japanDailyItinerarySummary || ""}
                  onChange={(e) =>
                    handleChange("japanDailyItinerarySummary", e.target.value)
                  }
                  placeholder="Ej. Turismo cultural en templos de Kioto, Shibuya, Monte Fuji"
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5">
          <div className="flex items-center gap-3 border-b border-brand-platinum pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-charcoal text-white">
              <Briefcase className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-brand-charcoal">
                3. Perfil de Arraigo Laboral y Solvencia Financiera
              </h3>
              <p className="text-xs text-brand-charcoal/70">
                Pilar fundamental para demostrar tus vínculos económicos y
                profesionales.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Ocupación Principal *
              </label>
              <select
                value={formData.currentOccupation || "Empleado"}
                onChange={(e) =>
                  handleChange("currentOccupation", e.target.value)
                }
                className={inputClass}
              >
                <option value="Empleado">Empleado / Asalariado</option>
                <option value="Independiente / Empresario">
                  Independiente / Empresario
                </option>
                <option value="Pensionado">Pensionado</option>
                <option value="Estudiante">Estudiante</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Empresa o Negocio Actual *
              </label>
              <input
                type="text"
                required
                value={formData.employerOrBusinessName || ""}
                onChange={(e) =>
                  handleChange("employerOrBusinessName", e.target.value)
                }
                placeholder="Nombre de la empresa"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Cargo o Rol Desempeñado *
              </label>
              <input
                type="text"
                required
                value={formData.jobTitle || ""}
                onChange={(e) => handleChange("jobTitle", e.target.value)}
                placeholder="Ej. Ingeniero / Gerente Comercial"
                className={inputClass}
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Ingresos Mensuales Promedio (COP) *
              </label>
              <input
                type="text"
                required
                value={formData.monthlyIncomeCop || ""}
                onChange={(e) =>
                  handleChange("monthlyIncomeCop", e.target.value)
                }
                placeholder="Ej. $8.500.000 COP"
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-brand-charcoal">
              Breve descripción de tus funciones laborales o actividad comercial
            </label>
            <textarea
              rows={2}
              value={formData.workDescription || ""}
              onChange={(e) => handleChange("workDescription", e.target.value)}
              placeholder="Describe en 2 líneas tus responsabilidades principales y tu antigüedad..."
              className={textareaClass}
            />
          </div>
        </section>

        <section className="rounded-3xl bg-brand-white border border-brand-charcoal/10 p-6 sm:p-8 shadow-2xs space-y-5">
          <div className="flex items-center gap-3 border-b border-brand-platinum pb-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-charcoal text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display text-base font-bold text-brand-charcoal">
                4. Historial de Viajes Internacionales y Antecedentes Consulares
              </h3>
              <p className="text-xs text-brand-charcoal/70">
                Información clave para blindar tu solicitud ante el consulado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                ¿Has tenido rechazos previos de visa para{" "}
                {isJapan ? "Japón o EE. UU." : "Estados Unidos"}?
              </label>
              <select
                value={formData.previousVisaRefusal || "No"}
                onChange={(e) =>
                  handleChange("previousVisaRefusal", e.target.value)
                }
                className={inputClass}
              >
                <option value="No">No, ningún rechazo previo</option>
                <option value="Sí">
                  Sí, tuve una negación previa (requiere estrategia de descargo)
                </option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Países visitados en los últimos 5 años
              </label>
              <input
                type="text"
                value={formData.internationalTravelHistory || ""}
                onChange={(e) =>
                  handleChange("internationalTravelHistory", e.target.value)
                }
                placeholder="Ej. México, España, Italia, Panamá (o Ninguno)"
                className={inputClass}
              />
            </div>
          </div>

          {formData.previousVisaRefusal === "Sí" && (
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-red">
                Año aproximado y contexto de la negación previa (Tu asesor lo
                analizará)
              </label>
              <textarea
                rows={2}
                value={formData.refusalExplanation || ""}
                onChange={(e) =>
                  handleChange("refusalExplanation", e.target.value)
                }
                placeholder="Indica en qué año ocurrió y qué cambió positivamente en tu perfil laboral o familiar desde entonces..."
                className={textareaClass}
              />
            </div>
          )}

          <div className="pt-4 border-t border-brand-platinum flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <p className="text-xs text-brand-charcoal/70 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-red shrink-0" />
              <span>
                Puedes guardar avances parciales y regresar cuando quieras.
              </span>
            </p>

            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-full bg-brand-red px-8 py-4 text-xs sm:text-sm font-bold text-white shadow-lg shadow-brand-red/25 hover:bg-brand-charcoal disabled:opacity-50 transition-all"
            >
              <Save className="h-4 w-4" />
              <span>
                {saving
                  ? "Cifrando y guardando..."
                  : "Guardar Respuestas del Formulario"}
              </span>
            </button>
          </div>
        </section>
      </form>
    </DashboardLayout>
  );
}