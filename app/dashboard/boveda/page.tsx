// app/dashboard/boveda/page.tsx
"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { DocumentPreviewModal } from "@/components/dashboard/DocumentPreviewModal";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase/config";
import { doc, setDoc } from "firebase/firestore";
import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject,
} from "firebase/storage";
import { DestinationCountry, VaultDocument } from "@/types/visa";
import {
  buildAuditLogEntry,
  calculateApplicationMetrics,
  sendInternalNotification,
} from "@/lib/firebase/db";
import {
  UploadCloud,
  CheckCircle2,
  FileText,
  Lock,
  Trash2,
  AlertCircle,
  Eye,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

interface RequiredDocItem {
  id: string;
  title: string;
  description: string;
  required: boolean;
  destinations: DestinationCountry[];
  conditionHint?: string;
}

const REQUIRED_DOCS_CATALOG: RequiredDocItem[] = [
  {
    id: "passport",
    title: "Pasaporte Vigente (Hoja de Datos Biográficos)",
    description:
      "Escaneo nítido de la página donde aparece tu foto, número de pasaporte y fecha de vencimiento.",
    required: true,
    destinations: ["USA", "JAPAN"],
  },
  {
    id: "photo_jp",
    title: "Fotografía Digital Reciente (4.5 cm x 3.5 cm, Fondo Blanco)",
    description:
      "Tomada en los últimos 6 meses, rostro despejado, sin gafas ni sombras.",
    required: true,
    destinations: ["JAPAN"],
  },
  {
    id: "photo_us",
    title: "Fotografía Digital Tipo Visa EE. UU. (5 cm x 5 cm, Fondo Blanco)",
    description:
      "Formato cuadrado oficial del Departamento de Estado, tomada en los últimos 6 meses.",
    required: true,
    destinations: ["USA"],
  },
  {
    id: "work_certificate",
    title: "Certificado Laboral o Cámara de Comercio / RUT",
    description:
      "Si eres empleado: carta indicando cargo, antigüedad, salario y tipo de contrato. Si eres independiente: Cámara de Comercio o RUT.",
    required: true,
    destinations: ["USA", "JAPAN"],
  },
  {
    id: "bank_statements",
    title: "Extractos Bancarios (Últimos 3 Meses) y Certificación de Saldo",
    description:
      "PDFs originales emitidos por tu banco donde se evidencie el saldo disponible y movimientos.",
    required: true,
    destinations: ["USA", "JAPAN"],
  },
  {
    id: "tax_return",
    title: "Declaración de Renta o Certificado de Ingresos y Retenciones",
    description:
      "Último período fiscal disponible para respaldar tu capacidad patrimonial.",
    required: false,
    destinations: ["USA", "JAPAN"],
  },
  {
    id: "resume_cv",
    title: "Hoja de Vida / Resumen Laboral y Académico (Opcional)",
    description:
      "Súbela si prefieres que tomemos de ahí tus empleos de los últimos 5 años y tu universidad para el DS-160.",
    required: false,
    destinations: ["USA"],
  },
  {
    id: "sponsor_guarantee_jp",
    title: "Documentos de Patrocinador / Carta de Garantía (Si aplica)",
    description:
      "Solo si tu viaje es costeado por un familiar o si tienes un garante en Japón.",
    required: false,
    destinations: ["JAPAN"],
  },
];

export default function BovedaPage() {
  const { user, profile, application, refreshApplication } = useAuth();
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Estado del Visor de Documentos Integrado
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    fileName: string;
    fileUrl: string;
  } | null>(null);

  const destination: DestinationCountry =
    application?.destination || profile?.destination || "USA";

  const uploadedDocs: Record<string, VaultDocument> =
    application?.documents || {};

  useEffect(() => {
    if (!errorMsg && !successMsg) return;
    const timer = setTimeout(() => {
      setErrorMsg("");
      setSuccessMsg("");
    }, 5000);
    return () => clearTimeout(timer);
  }, [errorMsg, successMsg]);

  const filteredCatalog = REQUIRED_DOCS_CATALOG.filter((item) =>
    item.destinations.includes(destination)
  );

  const handleFileUpload = async (
    docItem: RequiredDocItem,
    file: File | undefined
  ) => {
    if (!file || !user) return;

    if (file.size > 10 * 1024 * 1024) {
      setErrorMsg("El archivo supera el límite máximo permitido de 10 MB.");
      return;
    }

    setUploadingId(docItem.id);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `vault/${user.uid}/${docItem.id}_${Date.now()}_${safeName}`;
      const storageRef = ref(storage, storagePath);

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const newVaultDoc: VaultDocument = {
        docId: docItem.id,
        title: docItem.title,
        fileName: file.name,
        fileUrl: downloadUrl,
        storagePath,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
        status: "uploaded",
        advisorFeedback: "", // Limpia cualquier observación previa al subir la versión corregida
      };

      const updatedDocuments = {
        ...uploadedDocs,
        [docItem.id]: newVaultDoc,
      };

      const auditEntry = buildAuditLogEntry(
        `Carga en Bóveda: ${docItem.title}`,
        `Archivo cargado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB).`,
        profile?.fullName || "Cliente",
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
        documents: updatedDocuments,
      } as any;

      const metrics = calculateApplicationMetrics(simulatedApp);

      await setDoc(
        doc(db, "applications", user.uid),
        {
          id: user.uid,
          userId: user.uid,
          destination,
          documents: updatedDocuments,
          status: metrics.autoStatus,
          progressPercentage: metrics.progressPercentage,
          currentStep: metrics.currentStep,
          auditLogs: nextAuditLogs,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await sendInternalNotification(
        application?.assignedAdvisorId || "STAFF",
        `Nuevo documento en Bóveda: ${profile?.fullName || "Cliente"}`,
        `Subió "${docItem.title}" (${file.name}) para revisión legal.`,
        `/dashboard/admin/caso/${user.uid}`
      );

      await refreshApplication();
      setSuccessMsg(`Documento "${docItem.title}" encriptado y guardado en tu Bóveda.`);
    } catch {
      setErrorMsg("No se pudo subir el archivo. Inténtalo nuevamente.");
    } finally {
      setUploadingId(null);
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!user || !uploadedDocs[docId]) return;
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const target = uploadedDocs[docId];
      if (target.storagePath) {
        try {
          const fileRef = ref(storage, target.storagePath);
          await deleteObject(fileRef);
        } catch {}
      }

      const updatedDocuments = { ...uploadedDocs };
      delete updatedDocuments[docId];

      const auditEntry = buildAuditLogEntry(
        `Eliminación en Bóveda: ${target.title}`,
        `Archivo eliminado por el usuario: ${target.fileName}.`,
        profile?.fullName || "Cliente",
        profile?.role || "client"
      );

      await setDoc(
        doc(db, "applications", user.uid),
        {
          documents: updatedDocuments,
          auditLogs: [auditEntry, ...(application?.auditLogs || [])],
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await refreshApplication();
      setSuccessMsg("Archivo eliminado de la bóveda.");
    } catch {
      setErrorMsg("No se pudo eliminar el documento.");
    }
  };

  const uploadedForCurrentDest = filteredCatalog.filter(
    (item) => Boolean(uploadedDocs[item.id])
  ).length;

  return (
    <DashboardLayout>
      <DocumentPreviewModal
        isOpen={Boolean(previewDoc)}
        onClose={() => setPreviewDoc(null)}
        title={previewDoc?.title || ""}
        fileName={previewDoc?.fileName}
        fileUrl={previewDoc?.fileUrl || ""}
      />

      <div className="max-w-4xl mx-auto space-y-6 font-sans">
        {/* Encabezado */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 rounded-2xl bg-brand-charcoal p-7 sm:p-8 text-brand-white shadow-lg">
          <div className="space-y-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-red/20 px-3 py-1 text-xs font-semibold text-brand-red">
              <Sparkles className="h-3.5 w-3.5" />
              <span>
                {destination === "JAPAN"
                  ? "🇯🇵 Requisitos Consulares — Embajada del Japón"
                  : "🇺🇸 Soportes Oficiales — Visa B1/B2 Estados Unidos"}
              </span>
            </span>
            <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-tight">
              Bóveda Criptográfica de Documentos
            </h2>
            <p className="text-xs sm:text-sm text-white/70 max-w-xl leading-relaxed">
              Sube tus certificados en formato PDF o imagen. Nuestro equipo legal auditará cada archivo y te notificará aquí mismo si alguno requiere ajuste.
            </p>
          </div>

          <div className="rounded-xl bg-white/[0.06] p-4 border border-white/10 shrink-0 text-center min-w-[140px]">
            <p className="text-[11px] uppercase tracking-wider text-white/55 font-semibold">
              Soportes Listos
            </p>
            <p className="font-display text-3xl font-bold text-brand-red mt-1">
              {uploadedForCurrentDest} / {filteredCatalog.length}
            </p>
          </div>
        </div>

        {errorMsg && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 text-xs sm:text-sm font-medium text-brand-red">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg("")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center justify-between gap-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs sm:text-sm font-medium text-emerald-700">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 shrink-0" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg("")}>
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Lista de Documentos */}
        <div className="space-y-4">
          {filteredCatalog.map((item) => {
            const uploaded = uploadedDocs[item.id];
            const isUploading = uploadingId === item.id;
            const isRejected = uploaded?.status === "rejected";
            const isVerified = uploaded?.status === "verified";

            return (
              <div
                key={item.id}
                className={`rounded-2xl bg-brand-white p-6 border transition-all ${
                  isRejected
                    ? "border-brand-red/50 ring-2 ring-brand-red/10"
                    : isVerified
                    ? "border-emerald-500/35"
                    : uploaded
                    ? "border-brand-charcoal/15"
                    : "border-brand-charcoal/10"
                } shadow-2xs space-y-4`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-5">
                  <div className="flex items-start gap-4">
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        isRejected
                          ? "bg-brand-red/15 text-brand-red"
                          : isVerified
                          ? "bg-emerald-500/15 text-emerald-600"
                          : uploaded
                          ? "bg-amber-500/15 text-amber-700"
                          : "bg-brand-platinum text-brand-charcoal"
                      }`}
                    >
                      {uploaded ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        <FileText className="h-5 w-5" />
                      )}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-bold text-brand-charcoal">
                          {item.title}
                        </h3>
                        {item.required ? (
                          <span className="rounded-full bg-brand-red/10 px-2.5 py-0.5 text-[10px] font-bold uppercase text-brand-red">
                            Obligatorio
                          </span>
                        ) : (
                          <span className="rounded-full bg-brand-platinum px-2.5 py-0.5 text-[10px] font-semibold uppercase text-brand-charcoal/60">
                            Segun Perfil
                          </span>
                        )}

                        {uploaded && (
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase ${
                              isVerified
                                ? "bg-emerald-500/15 text-emerald-700"
                                : isRejected
                                ? "bg-brand-red text-white"
                                : "bg-amber-500/15 text-amber-800"
                            }`}
                          >
                            {isVerified
                              ? "✓ Verificado por Asesor"
                              : isRejected
                              ? "⚠️ Requiere Corrección"
                              : "En Revisión Legal"}
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-brand-charcoal/65 leading-relaxed max-w-xl">
                        {item.description}
                      </p>

                      {uploaded && (
                        <div className="pt-1.5 flex flex-wrap items-center gap-3 text-xs text-emerald-700 font-medium">
                          <span>Archivo: {uploaded.fileName}</span>
                          <span className="text-brand-charcoal/30">•</span>
                          <span>
                            {(uploaded.fileSize / 1024 / 1024).toFixed(2)} MB
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {uploaded ? (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            setPreviewDoc({
                              title: item.title,
                              fileName: uploaded.fileName,
                              fileUrl: uploaded.fileUrl,
                            })
                          }
                          className="inline-flex items-center gap-1.5 rounded-full border border-brand-charcoal/15 px-4 py-2 text-xs font-semibold text-brand-charcoal hover:bg-brand-platinum transition-colors"
                        >
                          <Eye className="h-3.5 w-3.5 text-brand-red" />
                          <span>Vista Previa</span>
                        </button>

                        {/* Si fue observado, permitir reemplazar directamente */}
                        <label className="cursor-pointer inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal px-4 py-2 text-xs font-semibold text-white hover:bg-brand-red transition-colors">
                          <UploadCloud className="h-3.5 w-3.5" />
                          <span>Reemplazar</span>
                          <input
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            disabled={isUploading}
                            onChange={(e) =>
                              handleFileUpload(item, e.target.files?.[0])
                            }
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => handleDeleteDocument(item.id)}
                          className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-brand-red/20 text-brand-red hover:bg-brand-red/10 transition-colors"
                          title="Eliminar archivo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </>
                    ) : (
                      <label
                        className={`cursor-pointer inline-flex items-center gap-2 rounded-full bg-brand-charcoal px-5 py-2.5 text-xs font-semibold text-brand-white hover:bg-brand-red transition-all ${
                          isUploading ? "opacity-50 pointer-events-none" : ""
                        }`}
                      >
                        <UploadCloud className="h-4 w-4" />
                        <span>
                          {isUploading ? "Encriptando..." : "Subir Documento"}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          className="hidden"
                          disabled={isUploading}
                          onChange={(e) =>
                            handleFileUpload(item, e.target.files?.[0])
                          }
                        />
                      </label>
                    )}
                  </div>
                </div>

                {/* 5. FEEDBACK DE MOTIVO DE OBSERVACIÓN / RECHAZO ESCRITO POR EL ASESOR */}
                {isRejected && uploaded?.advisorFeedback && (
                  <div className="rounded-xl bg-brand-red/10 border border-brand-red/30 p-4 flex items-start gap-3 text-xs text-brand-red">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold uppercase tracking-wider text-[10px] block">
                        Motivo de Observación de tu Especialista Legal:
                      </span>
                      <p className="font-semibold text-brand-charcoal mt-0.5">
                        &ldquo;{uploaded.advisorFeedback}&rdquo;
                      </p>
                      <p className="text-[11px] text-brand-charcoal/65 mt-1">
                        Haz clic en el botón <strong>&ldquo;Reemplazar&rdquo;</strong> de arriba para subir el documento corregido.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="rounded-2xl bg-brand-platinum/60 p-5 border border-brand-charcoal/10 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-brand-charcoal/70">
            <ShieldCheck className="h-5 w-5 text-brand-red shrink-0" />
            <span>
              Tus documentos están aislados bajo reglas de seguridad Firebase Storage por UID y se eliminan tras concluir tu trámite.
            </span>
          </div>
          <Lock className="h-4 w-4 text-brand-charcoal/40 shrink-0" />
        </div>
      </div>
    </DashboardLayout>
  );
}