// app/dashboard/formulario/page.tsx
"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { SmartIntakeData, DestinationCountry } from "@/types/visa";
import {
  CheckCircle2,
  Save,
  Sparkles,
  AlertCircle,
  ShieldCheck,
  FileCheck2,
  Plane,
  UserCheck,
  Briefcase,
  ChevronDown,
} from "lucide-react";

const defaultIntake: SmartIntakeData = {
  fullName: "",
  nationalId: "",
  maritalStatus: "Soltero/a",
  homeAddress: "",
  cityAndState: "Barranquilla, Atlántico",
  mobilePhone: "",
  purposeOfTrip: "Turismo",
  estimatedArrivalDate: "",
  stayDurationDays: "13 días",
  tripFinancier: "Yo mismo (Recursos propios)",
  currentOccupation: "",
  companyOrEmployerName: "",
  monthlyIncomeLocal: "",
  partnerOrParentsOccupation: "",
  japanPortOfEntry: "Narita, Tokio (NRT)",
  japanAirlineOrFlight: "",
  japanCitiesToVisit: "Tokio, Kioto y Osaka",
  hasGuarantorInJapan: "no",
  guarantorDetails: "",
  previousStayInJapan: "Ninguna",
  socialMediaHandles: "",
  parentsFullNamesAndDob: "",
  hasRelativesInUS: "no",
  relativesInUSDetails: "",
  previousJobsAndEducationSummary: "",
  hasPreviousVisaRefusal: "no",
  refusalExplanation: "",
  additionalNotes: "",
};

const inputBaseClass =
  "h-11 w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 px-3.5 text-sm font-sans text-brand-charcoal placeholder:text-brand-charcoal/40 focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

const selectBaseClass =
  "h-11 w-full appearance-none rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 pl-3.5 pr-9 text-sm font-sans text-brand-charcoal focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

const textareaBaseClass =
  "w-full rounded-xl bg-brand-platinum/50 border border-brand-charcoal/10 p-3.5 text-sm font-sans text-brand-charcoal placeholder:text-brand-charcoal/40 focus:bg-brand-white focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15 transition-all";

export default function FormularioPage() {
  const { user, profile, application, refreshApplication } = useAuth();
  const [destination, setDestination] = useState<DestinationCountry>("USA");
  const [formData, setFormData] = useState<SmartIntakeData>(defaultIntake);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const activeDest = application?.destination || profile?.destination || "USA";
    setDestination(activeDest);

    if (application?.formData) {
      setFormData((prev) => ({
        ...prev,
        ...application.formData,
        fullName: application.formData?.fullName || profile?.fullName || "",
      }));
    } else if (profile?.fullName) {
      setFormData((prev) => ({ ...prev, fullName: profile.fullName }));
    }
  }, [application, profile]);

  const handleChange = (field: keyof SmartIntakeData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleDestinationSwitch = async (newDest: DestinationCountry) => {
    setDestination(newDest);
    if (!user) return;
    try {
      await updateDoc(doc(db, "applications", user.uid), {
        destination: newDest,
        visaType:
          newDest === "JAPAN"
            ? "Visa de Turismo Japón (Estancia Corta)"
            : "Visa B1/B2 Estados Unidos",
      });
      await updateDoc(doc(db, "users", user.uid), {
        destination: newDest,
      });
      await refreshApplication();
    } catch {
      // Silencioso seguro PII
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const appRef = doc(db, "applications", user.uid);

      await updateDoc(appRef, {
        destination,
        formData,
        progressPercentage: 65,
        currentStep: 3,
        status: "in_legal_review",
        updatedAt: new Date().toISOString(),
      });

      await refreshApplication();
      setSuccessMsg(
        destination === "JAPAN"
          ? "¡Perfil guardado! Con estos datos y tu Bóveda armaremos tu Solicitud Oficial de Visado Japonés y tu Programa de Estancia."
          : "¡Perfil guardado! Con estos datos y tu Bóveda nuestro equipo legal diligenciará tu formulario DS-160 oficial."
      );
    } catch {
      setErrorMsg("No se pudieron guardar los datos. Intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 font-sans">
        {/* Encabezado Ejecutivo */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-2xl bg-brand-charcoal p-7 sm:p-8 text-brand-white shadow-lg">
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
              <strong className="text-white font-semibold">Pasaporte y Carta Laboral</strong> en la Bóveda. Aquí solo dinos lo que no aparece en tus certificados.
            </p>
          </div>

          {/* Selector de País */}
          <div className="rounded-xl bg-white/[0.06] p-3 border border-white/10 shrink-0 space-y-2">
            <p className="text-[10px] uppercase tracking-widest text-white/50 text-center font-bold">
              Formulario Activo
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => handleDestinationSwitch("USA")}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  destination === "USA"
                    ? "bg-brand-red text-white shadow-sm"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                🇺🇸 EE. UU.
              </button>
              <button
                type="button"
                onClick={() => handleDestinationSwitch("JAPAN")}
                className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
                  destination === "JAPAN"
                    ? "bg-brand-red text-white shadow-sm"
                    : "bg-white/5 text-white/60 hover:text-white"
                }`}
              >
                🇯🇵 Japón
              </button>
            </div>
          </div>
        </div>

        {/* Nota de extracción documental */}
        <div className="rounded-2xl bg-brand-white p-4 sm:p-5 border border-brand-charcoal/10 flex items-center gap-3.5 shadow-2xs">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <FileCheck2 className="h-5 w-5" />
          </div>
          <div className="text-xs">
            <p className="font-semibold text-brand-charcoal">
              Cero transcripción de documentos
            </p>
            <p className="text-brand-charcoal/60 mt-0.5">
              No necesitas digitar tu número de pasaporte, fechas de emisión ni la dirección o teléfono de tu empresa; los tomamos de tu Bóveda.
            </p>
          </div>
        </div>

        {successMsg && (
          <div className="flex items-center gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}
        {errorMsg && (
          <div className="flex items-center gap-3 rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 text-xs font-semibold text-brand-red">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          {/* SECCIÓN 1: Identidad y Domicilio Actual */}
          <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
              <UserCheck className="h-5 w-5 text-brand-red" />
              <div>
                <h3 className="font-display text-base font-bold text-brand-charcoal">
                  1. Datos Personales y de Contacto
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  Información básica de contacto y residencia actual en Colombia.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Nombre Completo (Como en el pasaporte)
                </label>
                <input
                  type="text"
                  required
                  value={formData.fullName}
                  onChange={(e) => handleChange("fullName", e.target.value)}
                  placeholder="Ej. Luz Daniela Rangel Díaz"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  No. de Cédula / ID Nacional
                </label>
                <input
                  type="text"
                  required
                  value={formData.nationalId}
                  onChange={(e) => handleChange("nationalId", e.target.value)}
                  placeholder="Ej. 1193470292"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Estado Civil
                </label>
                <div className="relative">
                  <select
                    value={formData.maritalStatus}
                    onChange={(e) => handleChange("maritalStatus", e.target.value)}
                    className={selectBaseClass}
                  >
                    <option value="Soltero/a">Soltero/a</option>
                    <option value="Casado/a">Casado/a</option>
                    <option value="Unión Libre">Unión Libre</option>
                    <option value="Divorciado/a">Divorciado/a</option>
                    <option value="Viudo/a">Viudo/a</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-brand-charcoal/50" />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Teléfono Móvil (WhatsApp)
                </label>
                <input
                  type="text"
                  required
                  value={formData.mobilePhone}
                  onChange={(e) => handleChange("mobilePhone", e.target.value)}
                  placeholder="Ej. 300 695 9343"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Ciudad y Departamento
                </label>
                <input
                  type="text"
                  required
                  value={formData.cityAndState}
                  onChange={(e) => handleChange("cityAndState", e.target.value)}
                  placeholder="Ej. Barranquilla, Atlántico"
                  className={inputBaseClass}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-brand-charcoal">
                Dirección de Domicilio Actual
              </label>
              <input
                type="text"
                required
                value={formData.homeAddress}
                onChange={(e) => handleChange("homeAddress", e.target.value)}
                placeholder="Ej. Calle 86 No. 47-38, Barrio Alto Prado"
                className={inputBaseClass}
              />
            </div>
          </div>

          {/* SECCIÓN 2: Plan de Viaje y Solvencia */}
          <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
            <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
              <Plane className="h-5 w-5 text-brand-red" />
              <div>
                <h3 className="font-display text-base font-bold text-brand-charcoal">
                  2. Logística de Viaje y Perfil Económico
                </h3>
                <p className="text-xs text-brand-charcoal/55">
                  Fechas tentativas y actividad económica que respalda tu solicitud.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Fecha Probable de Entrada
                </label>
                <input
                  type="date"
                  required
                  value={formData.estimatedArrivalDate}
                  onChange={(e) => handleChange("estimatedArrivalDate", e.target.value)}
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Días Previstos de Estancia
                </label>
                <input
                  type="text"
                  required
                  value={formData.stayDurationDays}
                  onChange={(e) => handleChange("stayDurationDays", e.target.value)}
                  placeholder="Ej. 13 días"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  ¿Quién costea el viaje?
                </label>
                <div className="relative">
                  <select
                    value={formData.tripFinancier}
                    onChange={(e) => handleChange("tripFinancier", e.target.value)}
                    className={selectBaseClass}
                  >
                    <option value="Yo mismo (Recursos propios)">Yo mismo (Recursos propios)</option>
                    <option value="Un familiar / Pareja (Con Carta de Garantía)">Un familiar / Pareja (Garante)</option>
                    <option value="Empresa patrocinadora">Empresa patrocinadora</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-brand-charcoal/50" />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Ocupación o Cargo Actual
                </label>
                <input
                  type="text"
                  required
                  value={formData.currentOccupation}
                  onChange={(e) => handleChange("currentOccupation", e.target.value)}
                  placeholder="Ej. Asesora Comercial / Ingeniero"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Empresa o Negocio Actual
                </label>
                <input
                  type="text"
                  required
                  value={formData.companyOrEmployerName}
                  onChange={(e) => handleChange("companyOrEmployerName", e.target.value)}
                  placeholder="Ej. Banco Serfinanza / Tecnoglass"
                  className={inputBaseClass}
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Ingreso Mensual Aproximado
                </label>
                <input
                  type="text"
                  required
                  value={formData.monthlyIncomeLocal}
                  onChange={(e) => handleChange("monthlyIncomeLocal", e.target.value)}
                  placeholder="Ej. $6.500.000 COP"
                  className={inputBaseClass}
                />
              </div>
            </div>
          </div>

          {/* SECCIÓN 3 CONDICIONAL: JAPÓN vs ESTADOS UNIDOS */}
          {destination === "JAPAN" ? (
            <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
              <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
                <Briefcase className="h-5 w-5 text-brand-red" />
                <div>
                  <h3 className="font-display text-base font-bold text-brand-charcoal">
                    3. Requisitos Específicos — Embajada del Japón
                  </h3>
                  <p className="text-xs text-brand-charcoal/55">
                    Con estos datos redactaremos tu Solicitud de Visado y tu Programa de Estancia{" "}
                    <span className="italic">(Schedule of Stay)</span> día por día.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Ocupación de tu Pareja o Padres *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.partnerOrParentsOccupation || ""}
                    onChange={(e) => handleChange("partnerOrParentsOccupation", e.target.value)}
                    placeholder="Ej. IT Helpdesk Supervisor / Independiente / No aplica"
                    className={inputBaseClass}
                  />
                  <p className="text-[11px] text-brand-charcoal/50">
                    * Requerido en la página 2 del formato oficial japonés (de tus padres si eres menor/estudiante).
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Ciudades que deseas visitar en Japón
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.japanCitiesToVisit || ""}
                    onChange={(e) => handleChange("japanCitiesToVisit", e.target.value)}
                    placeholder="Ej. Tokio, Kioto y Osaka"
                    className={inputBaseClass}
                  />
                  <p className="text-[11px] text-brand-charcoal/50">
                    Nosotros armamos el itinerario diario detallado de hoteles y actividades por ti.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Aeropuerto de Entrada Previsto
                  </label>
                  <input
                    type="text"
                    value={formData.japanPortOfEntry || ""}
                    onChange={(e) => handleChange("japanPortOfEntry", e.target.value)}
                    placeholder="Ej. Narita, Tokio (NRT)"
                    className={inputBaseClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Aerolínea Proyectada (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.japanAirlineOrFlight || ""}
                    onChange={(e) => handleChange("japanAirlineOrFlight", e.target.value)}
                    placeholder="Ej. ANA / United / China Eastern"
                    className={inputBaseClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Visitas Anteriores a Japón
                  </label>
                  <input
                    type="text"
                    value={formData.previousStayInJapan || ""}
                    onChange={(e) => handleChange("previousStayInJapan", e.target.value)}
                    placeholder="Ej. Ninguna"
                    className={inputBaseClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 pt-1">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    ¿Cuentas con Garante o Invitante en Japón?
                  </label>
                  <div className="relative">
                    <select
                      value={formData.hasGuarantorInJapan || "no"}
                      onChange={(e) => handleChange("hasGuarantorInJapan", e.target.value)}
                      className={selectBaseClass}
                    >
                      <option value="no">No, voy 100% por turismo independiente (Hotel)</option>
                      <option value="yes">Sí, me invita un familiar o residente en Japón</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-brand-charcoal/50" />
                  </div>
                </div>

                {formData.hasGuarantorInJapan === "yes" && (
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-brand-charcoal">
                      Datos de quien te invita en Japón
                    </label>
                    <input
                      type="text"
                      value={formData.guarantorDetails || ""}
                      onChange={(e) => handleChange("guarantorDetails", e.target.value)}
                      placeholder="Nombre completo, parentesco y teléfono en Japón"
                      className={inputBaseClass}
                    />
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-5">
              <div className="flex items-center gap-2.5 border-b border-brand-platinum pb-3.5">
                <Briefcase className="h-5 w-5 text-brand-red" />
                <div>
                  <h3 className="font-display text-base font-bold text-brand-charcoal">
                    3. Datos Clave para DS-160 — Estados Unidos
                  </h3>
                  <p className="text-xs text-brand-charcoal/55">
                    Información que exige el Departamento de Estado y no aparece en tus certificados.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Nombres y Fecha de Nacimiento de tus Padres
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formData.parentsFullNamesAndDob || ""}
                    onChange={(e) => handleChange("parentsFullNamesAndDob", e.target.value)}
                    placeholder="Ej. Padre: Jairo Rubio (30/09/1942) | Madre: Emperatriz Rodríguez (09/09/1959)"
                    className={textareaBaseClass}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    Redes Sociales Públicas (@usuario)
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formData.socialMediaHandles || ""}
                    onChange={(e) => handleChange("socialMediaHandles", e.target.value)}
                    placeholder="Ej. Instagram: @usuario | LinkedIn: Nombre Apellido"
                    className={textareaBaseClass}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-brand-charcoal">
                  Resumen de Empleos Anteriores (Últimos 5 años) y Universidad
                </label>
                <textarea
                  rows={2}
                  value={formData.previousJobsAndEducationSummary || ""}
                  onChange={(e) => handleChange("previousJobsAndEducationSummary", e.target.value)}
                  placeholder="Ej. 2022-2024: Hidrotest del Caribe | Univ. Autónoma del Caribe (O sube tu Hoja de Vida en la Bóveda)"
                  className={textareaBaseClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    ¿Tienes familiares directos en Estados Unidos?
                  </label>
                  <div className="relative">
                    <select
                      value={formData.hasRelativesInUS || "no"}
                      onChange={(e) => handleChange("hasRelativesInUS", e.target.value)}
                      className={selectBaseClass}
                    >
                      <option value="no">No tengo familiares en EE. UU.</option>
                      <option value="yes">Sí tengo familiares en EE. UU.</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-brand-charcoal/50" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-brand-charcoal">
                    ¿Te han negado la visa de EE. UU. anteriormente?
                  </label>
                  <div className="relative">
                    <select
                      value={formData.hasPreviousVisaRefusal || "no"}
                      onChange={(e) => handleChange("hasPreviousVisaRefusal", e.target.value)}
                      className={selectBaseClass}
                    >
                      <option value="no">No, nunca me la han negado</option>
                      <option value="yes">Sí, tuve un rechazo previo</option>
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-brand-charcoal/50" />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Barra Inferior de Envío */}
          <div className="rounded-2xl bg-brand-white p-6 border border-brand-charcoal/10 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2.5 text-xs text-brand-charcoal/65">
              <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
              <span>
                Encriptación PII activa. Tus respuestas solo son visibles para tu especialista legal asignado.
              </span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-brand-red px-8 py-3.5 text-sm font-semibold text-brand-white shadow-lg shadow-brand-red/20 hover:bg-brand-red/90 disabled:opacity-50 transition-all shrink-0"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? "Guardando en expediente..." : "Guardar y Enviar a mi Asesor"}</span>
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}