// app/dashboard/boveda/page.tsx
"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { DestinationCountry, VaultDocument } from "@/types/visa";
import {
  FolderLock,
  UploadCloud,
  CheckCircle2,
  FileText,
  Trash2,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Info,
} from "lucide-react";

interface RequiredDocSpec {
  id: string;
  title: string;
  description: string;
  required: boolean;
  badge: string;
}

export default function BovedaPage() {
  const { user, profile, application, refreshApplication } = useAuth();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const destination: DestinationCountry =
    application?.destination || profile?.destination || "USA";

  const isSponsoredByFamily =
    application?.formData?.tripFinancier ===
    "Un familiar / Pareja (Con Carta de Garantía)";

  // Lista dinámica de requisitos según Embajada (Japón vs EE. UU.) y tipo de solvencia
  const requiredDocs: RequiredDocSpec[] =
    destination === "JAPAN"
      ? [
          {
            id: "passport",
            title: "1. Pasaporte Vigente (Página Biográfica)",
            description:
              "Escaneo nítido de la página principal donde aparecen tu foto, firma y fechas de validez. Debe tener mínimo 2 páginas libres.",
            required: true,
            badge: "Obligatorio",
          },
          {
            id: "photo_jp",
            title: "2. Fotografía Digital Tipo Visado (45mm x 35mm)",
            description:
              "Fondo blanco liso, tomada en los últimos 6 meses, rostro despejado mirando al frente sin gafas ni accesorios.",
            required: true,
            badge: "Obligatorio",
          },
          {
            id: "bank_statements",
            title: "3. Extractos Bancarios (Últimos 3 Meses)",
            description:
              "PDFs originales descargados del banco (cuentas de ahorro o corriente). La Embajada del Japón exige que se vea claramente el nombre del titular y el saldo final.",
            required: true,
            badge: "Solvencia Crítica",
          },
          {
            id: "employment_tax",
            title: "4. Carta Laboral Vigente y/o Declaración de Renta",
            description:
              "Certificado laboral indicando cargo, antigüedad y salario mensual (de aquí extraemos el NIT, dirección y teléfono de tu empresa). Si eres independiente, certificado de ingresos por contador con tarjeta profesional.",
            required: true,
            badge: "Obligatorio",
          },
          {
            id: "flight_hotel_booking",
            title: "5. Prerreserva de Vuelos Internacionales (Entrada/Salida de Japón)",
            description:
              "Itinerario o prerreserva donde conste aerolínea, número de vuelo y aeropuerto de entrada (ej. Narita NRT o Haneda HND). No compres tiquetes no reembolsables.",
            required: false,
            badge: "Recomendado",
          },
          ...(isSponsoredByFamily
            ? [
                {
                  id: "birth_marriage_certificate",
                  title: "6. Registro Civil de Nacimiento o Matrimonio (Parentesco con Garante)",
                  description:
                    "Requisito estricto de la Embajada del Japón en Colombia cuando el viaje es costeado por padres o cónyuge.",
                  required: true,
                  badge: "Requisito Garante",
                },
                {
                  id: "guarantor_financials",
                  title: "7. Extractos Bancarios y Carta Laboral de tu Garante",
                  description:
                    "Últimos 3 extractos bancarios y soporte de ingresos de la persona que financia tu viaje (nosotros redactaremos la Carta de Garantía oficial para su firma).",
                  required: true,
                  badge: "Requisito Garante",
                },
              ]
            : []),
        ]
      : [
          {
            id: "passport",
            title: "1. Pasaporte Vigente (y Pasaportes Anteriores si tienen Visas)",
            description:
              "Foto o PDF claro de la hoja de datos de tu pasaporte actual. De aquí nuestro equipo extrae número de pasaporte, fechas y lugar de emisión para tu DS-160.",
            required: true,
            badge: "Obligatorio DS-160",
          },
          {
            id: "photo_us",
            title: "2. Fotografía Digital 5x5 cm (Fondo Blanco)",
            description:
              "Formato cuadrado (mínimo 600x600 px), fondo blanco sin sombras, orejas visibles y sin lentes, para cargarla directamente en el sistema CEAC del Departamento de Estado.",
            required: true,
            badge: "Obligatorio DS-160",
          },
          {
            id: "employment_certificate",
            title: "3. Certificación Laboral o Cámara de Comercio",
            description:
              "Documento que respalde tu arraigo laboral en Colombia. De este archivo tomamos la dirección exacta, código y teléfono de tu empleador.",
            required: true,
            badge: "Arraigo Económico",
          },
          {
            id: "resume_cv",
            title: "4. Hoja de Vida Actualizada (CV en PDF)",
            description:
              "Súbela para que nuestro equipo legal extraiga tus empleos de los últimos 5 años, cargos, supervisores y fechas universitarias sin que tengas que digitarlos.",
            required: false,
            badge: "Ahorra Tiempo",
          },
          {
            id: "bank_statements",
            title: "5. Extractos Bancarios Recientes (Últimos 3 Meses)",
            description:
              "Para auditar tu perfil financiero y prepararte estratégicamente para las preguntas de solvencia del Oficial Consular.",
            required: false,
            badge: "Auditoría Legal",
          },
        ];

  const uploadedDocsMap = application?.documents || {};
  const totalRequired = requiredDocs.filter((d) => d.required).length;
  const uploadedRequiredCount = requiredDocs.filter(
    (d) => d.required && uploadedDocsMap[d.id]
  ).length;

  const handleFileUpload = async (
    docSpec: RequiredDocSpec,
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // Validación de tamaño máximo (10 MB)
    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("El archivo supera el límite máximo permitido de 10 MB.");
      return;
    }

    setUploadingId(docSpec.id);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `vault/${user.uid}/${docSpec.id}/${Date.now()}_${safeFileName}`;
      const fileRef = ref(storage, storagePath);

      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);

      const newVaultDoc: VaultDocument = {
        docId: docSpec.id,
        title: docSpec.title,
        fileName: file.name,
        fileUrl: downloadUrl,
        storagePath,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        status: "uploaded",
      };

      const updatedDocuments = {
        ...uploadedDocsMap,
        [docSpec.id]: newVaultDoc,
      };

      const newRequiredCompleted = requiredDocs.filter(
        (d) => d.required && updatedDocuments[d.id]
      ).length;

      const newProgress =
        newRequiredCompleted >= totalRequired
          ? 85
          : Math.max(application?.progressPercentage || 25, 50);

      await updateDoc(doc(db, "applications", user.uid), {
        documents: updatedDocuments,
        progressPercentage: newProgress,
        currentStep: newRequiredCompleted >= totalRequired ? 3 : 2,
        updatedAt: new Date().toISOString(),
      });

      await refreshApplication();
      setSuccessMsg(`"${docSpec.title}" cargado y encriptado correctamente en tu Bóveda.`);
    } catch {
      setErrorMsg(
        "No se pudo subir el archivo. Verifica que Firebase Storage esté habilitado en tu consola de Firebase."
      );
    } finally {
      setUploadingId(null);
      e.target.value = "";
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!user || !uploadedDocsMap[docId]) return;
    setUploadingId(docId);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const targetDoc = uploadedDocsMap[docId];
      if (targetDoc.storagePath) {
        try {
          await deleteObject(ref(storage, targetDoc.storagePath));
        } catch {
          // Si ya no existe en Storage, continuamos limpiando Firestore
        }
      }

      const updatedDocuments = { ...uploadedDocsMap };
      delete updatedDocuments[docId];

      await updateDoc(doc(db, "applications", user.uid), {
        documents: updatedDocuments,
        updatedAt: new Date().toISOString(),
      });

      await refreshApplication();
      setSuccessMsg("Documento eliminado correctamente.");
    } catch {
      setErrorMsg("No se pudo eliminar el documento.");
    } finally {
      setUploadingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-6 font-sans">
        {/* Encabezado de la Bóveda */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-2xl bg-brand-charcoal p-7 sm:p-8 text-brand-white shadow-lg">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-3 py-1 text-xs font-semibold text-brand-red">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {destination === "JAPAN"
                  ? "🇯🇵 Checklist Oficial — Embajada del Japón en Colombia"
                  : "🇺🇸 Checklist Documental — Visa B1/B2 Estados Unidos"}
              </span>
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Bóveda Criptográfica de Documentos
            </h2>
            <p className="text-xs sm:text-sm text-white/70 max-w-xl leading-relaxed">
              Sube tus soportes en PDF o imagen (JPG/PNG). Nuestro equipo legal auditará cada archivo y extraerá los datos técnicos para diligenciar tus formularios oficiales sin errores.
            </p>
          </div>

          <div className="rounded-xl bg-white/[0.06] p-4 border border-white/10 shrink-0 text-center min-w-[150px]">
            <p className="text-[10px] uppercase tracking-widest text-white/50 font-bold">
              Soportes Obligatorios
            </p>
            <p className="font-display text-3xl font-bold text-brand-red mt-1">
              {uploadedRequiredCount}{" "}
              <span className="text-base text-white/50">/ {totalRequired}</span>
            </p>
          </div>
        </div>

        {/* Nota especial para Japón sobre documentos que genera la Agencia */}
        {destination === "JAPAN" && (
          <div className="rounded-2xl bg-brand-white p-4 sm:p-5 border border-brand-charcoal/10 flex items-start gap-3.5 shadow-2xs">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-red/10 text-brand-red">
              <Info className="h-5 w-5" />
            </div>
            <div className="text-xs space-y-1">
              <p className="font-semibold text-brand-charcoal">
                ¿Qué pasa con el Formulario de Solicitud de Visado Japonés, el Programa de Estancia (Schedule of Stay) y la Carta de Garantía?
              </p>
              <p className="text-brand-charcoal/65 leading-relaxed">
                <strong>No tienes que hacerlos tú.</strong> Con los datos de tu Cuestionario y estos soportes, nuestro equipo los redacta bajo el estándar exacto de la Embajada del Japón en Bogotá y te los enviará listos para firmar.
              </p>
            </div>
          </div>
        )}

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

        {/* Lista de Documentos Requeridos */}
        <div className="space-y-4">
          {requiredDocs.map((docSpec) => {
            const uploadedDoc = uploadedDocsMap[docSpec.id];
            const isUploading = uploadingId === docSpec.id;

            return (
              <div
                key={docSpec.id}
                className={`rounded-2xl bg-brand-white p-6 border transition-all shadow-2xs ${
                  uploadedDoc
                    ? "border-emerald-500/30 bg-emerald-500/[0.01]"
                    : "border-brand-charcoal/10"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base font-bold text-brand-charcoal">
                        {docSpec.title}
                      </h3>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                          uploadedDoc
                            ? "bg-emerald-500/15 text-emerald-700"
                            : docSpec.required
                            ? "bg-brand-red/10 text-brand-red"
                            : "bg-brand-platinum text-brand-charcoal/60"
                        }`}
                      >
                        {uploadedDoc ? "Recibido en Bóveda" : docSpec.badge}
                      </span>
                    </div>
                    <p className="text-xs text-brand-charcoal/60 leading-relaxed">
                      {docSpec.description}
                    </p>
                  </div>

                  {/* Controles de Subida o Vista del Archivo */}
                  <div className="shrink-0 flex items-center gap-2.5">
                    <label
                      className={`cursor-pointer inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-semibold transition-all ${
                        uploadedDoc
                          ? "border border-brand-charcoal/15 bg-brand-white text-brand-charcoal hover:bg-brand-platinum"
                          : "bg-brand-red text-brand-white shadow-md shadow-brand-red/15 hover:bg-brand-red/90"
                      } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                    >
                      <UploadCloud className="h-4 w-4" />
                      <span>
                        {isUploading
                          ? "Subiendo..."
                          : uploadedDoc
                          ? "Reemplazar archivo"
                          : "Subir documento"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) => handleFileUpload(docSpec, e)}
                      />
                    </label>
                  </div>
                </div>

                {/* Detalle del archivo ya cargado */}
                {uploadedDoc && (
                  <div className="mt-4 pt-4 border-t border-brand-platinum flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 text-xs text-brand-charcoal/80">
                      <FileText className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold truncate max-w-xs sm:max-w-md">
                        {uploadedDoc.fileName}
                      </span>
                      <span className="text-brand-charcoal/45 text-[11px]">
                        ({(uploadedDoc.fileSize / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <a
                        href={uploadedDoc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs font-semibold text-brand-charcoal/70 hover:text-brand-charcoal transition-colors"
                      >
                        <span>Ver archivo</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        onClick={() => handleDeleteDocument(docSpec.id)}
                        disabled={isUploading}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span>Eliminar</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Pie de Seguridad */}
        <div className="rounded-2xl bg-brand-white p-5 border border-brand-charcoal/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 text-xs text-brand-charcoal/65">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>
              Almacenamiento aislado por UID en Firebase Cloud Storage. Formatos aceptados: PDF, JPG y PNG (máx. 10 MB por archivo).
            </span>
          </div>
          <FolderLock className="h-5 w-5 text-brand-charcoal/30 shrink-0 hidden sm:block" />
        </div>
      </div>
    </DashboardLayout>
  );
}