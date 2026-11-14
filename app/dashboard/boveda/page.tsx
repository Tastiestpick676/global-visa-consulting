// app/dashboard/boveda/page.tsx
"use client";

import { useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/context/AuthContext";
import { db, storage } from "@/lib/firebase/config";
import { doc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import {
  buildAuditLogEntry,
  calculateApplicationMetrics,
  formatDisplayName,
  getDefaultDocumentsByDestination,
  recordSystemLog,
  sendInternalNotification,
} from "@/lib/firebase/db";
import { optimizeImageForVault } from "@/lib/utils/imageOptimizer";
import { VaultDocumentItem } from "@/types/visa";
import {
  FolderLock,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  FileText,
  ExternalLink,
  ShieldCheck,
  Lock,
  X,
} from "lucide-react";

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB máximo según storage.rules

export default function BovedaPage() {
  const { user, profile, application } = useAuth();
  const [uploadingDocId, setUploadingDocId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  // Normalizar lista de documentos (soporta Array o Mapa de Firestore)
  // Si el expediente tiene un arreglo/objeto vacío, carga automáticamente la plantilla por destino
  const defaultDocs = getDefaultDocumentsByDestination(
    application?.destination || "USA"
  );
  const rawDocs = application?.documents;
  const extractedDocs: VaultDocumentItem[] = Array.isArray(rawDocs)
    ? rawDocs
    : rawDocs && typeof rawDocs === "object"
    ? (Object.values(rawDocs).filter(
        (d) => d && typeof d === "object" && "id" in d
      ) as VaultDocumentItem[])
    : [];

  const currentDocs: VaultDocumentItem[] =
    extractedDocs.length > 0 ? extractedDocs : defaultDocs;

  const handleUploadVaultDocument = async (
    docItem: VaultDocumentItem,
    rawFile?: File | null
  ) => {
    if (!rawFile || !user || !application) return;

    const allowedMimeTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/webp",
    ];
    if (!allowedMimeTypes.includes(rawFile.type)) {
      setErrorMsg(
        "Formato no permitido. Solo se aceptan archivos PDF, JPG, PNG o WebP."
      );
      return;
    }

    if (rawFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg(
        "El archivo supera el límite máximo de seguridad de 10 MB. Por favor sube una versión más ligera."
      );
      return;
    }

    setUploadingDocId(docItem.id);
    setFeedback("");
    setErrorMsg("");

    try {
      const processedFile = await optimizeImageForVault(rawFile, {
        maxWidth: 1600,
        maxHeight: 1600,
        quality: 0.85,
      });

      const safeFileName = processedFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `vault/${user.uid}/${docItem.id}_${Date.now()}_${safeFileName}`;
      const fileRef = ref(storage, storagePath);

      await uploadBytes(fileRef, processedFile);
      const downloadUrl = await getDownloadURL(fileRef);

      const now = new Date().toISOString();
      const updatedDocuments: VaultDocumentItem[] = currentDocs.map((d) =>
        d.id === docItem.id
          ? {
              ...d,
              status: "uploaded",
              fileName: processedFile.name,
              fileUrl: downloadUrl,
              storagePath,
              uploadedAt: now,
              feedback: "",
            }
          : d
      );

      const cleanActorName = formatDisplayName(
        profile?.fullName || user.displayName || "Cliente"
      );

      const auditEntry = buildAuditLogEntry(
        `Carga en Bóveda PII: ${docItem.title}`,
        `Archivo cargado: ${processedFile.name} (${Math.round(
          processedFile.size / 1024
        )} KB).`,
        cleanActorName,
        profile?.role || "client"
      );

      const updatedAppSnapshot = {
        ...application,
        documents: updatedDocuments,
      };
      const nextMetrics = calculateApplicationMetrics(updatedAppSnapshot);

      const existingAuditLogs = Array.isArray(application.auditLogs)
        ? application.auditLogs
        : [];

      await updateDoc(doc(db, "applications", application.id), {
        documents: updatedDocuments,
        progressPercentage: nextMetrics.progressPercentage,
        currentStep: nextMetrics.currentStep,
        status: nextMetrics.autoStatus,
        auditLogs: [auditEntry, ...existingAuditLogs],
        updatedAt: now,
      });

      await recordSystemLog({
        category: "PII_VAULT",
        eventType: `Carga de Soporte PII (${docItem.title})`,
        outcome: "SUCCESS",
        actorEmail: user.email || "cliente",
        actorName: cleanActorName,
        actorRole: profile?.role || "client",
        targetResource: `${cleanActorName} (${application.destination})`,
        details: `Soporte "${docItem.title}" cifrado en Bóveda (${Math.round(
          processedFile.size / 1024
        )} KB).`,
      });

      await sendInternalNotification(
        application.assignedAdvisorId || "STAFF",
        `Nuevo soporte en Bóveda: ${cleanActorName}`,
        `${cleanActorName} subió "${docItem.title}" para revisión legal.`,
        `/dashboard/admin/caso/${application.id}`
      );

      setFeedback(
        `¡Documento "${docItem.title}" cifrado y cargado correctamente en tu Bóveda!`
      );
    } catch {
      setErrorMsg(
        "No se pudo subir el documento. Verifica tu conexión o el formato del archivo."
      );
    } finally {
      setUploadingDocId(null);
    }
  };

  const getStatusBadge = (status: VaultDocumentItem["status"]) => {
    switch (status) {
      case "verified":
        return {
          label: "Verificado por Especialista",
          icon: CheckCircle2,
          className:
            "bg-emerald-500/15 text-emerald-800 border-emerald-500/30",
        };
      case "uploaded":
        return {
          label: "En Auditoría Legal",
          icon: Clock,
          className: "bg-amber-500/15 text-amber-900 border-amber-500/30",
        };
      case "rejected":
        return {
          label: "Requiere Ajuste",
          icon: AlertCircle,
          className: "bg-brand-red/15 text-brand-red border-brand-red/30",
        };
      default:
        return {
          label: "Pendiente de Carga",
          icon: UploadCloud,
          className:
            "bg-brand-platinum text-brand-charcoal/75 border-brand-charcoal/10",
        };
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 font-sans">
        {/* CABECERA DE LA BÓVEDA CRIPTOGRÁFICA */}
        <div className="rounded-3xl bg-brand-charcoal text-brand-white p-6 sm:p-8 border border-white/10 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full bg-brand-red/20 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-brand-red">
              <Lock className="h-3.5 w-3.5" />
              <span>Bóveda Criptográfica Zero-Trust • Protección PII</span>
            </div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold">
              Expediente Documental —{" "}
              {application?.destination === "JAPAN"
                ? "🇯🇵 Japón (MOFA)"
                : "🇺🇸 Estados Unidos (B1/B2)"}
            </h2>
            <p className="text-xs sm:text-sm text-white/75 leading-relaxed">
              Tus documentos están aislados criptográficamente. Las fotografías
              se optimizan automáticamente eliminando metadatos GPS de
              ubicación antes de almacenarse.
            </p>
          </div>

          <div className="rounded-2xl bg-white/5 border border-white/10 p-4 shrink-0 space-y-1 text-xs">
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              <span>Purga Garantizada Post-Trámite</span>
            </div>
            <p className="text-[11px] text-white/65 max-w-[230px]">
              Formatos admitidos: PDF, JPG, PNG o WebP (Máx. 10 MB por archivo).
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

        {/* GRILLA DE REQUISITOS DOCUMENTALES */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {currentDocs.map((docItem) => {
            const badge = getStatusBadge(docItem.status);
            const StatusIcon = badge.icon;
            const isUploading = uploadingDocId === docItem.id;

            return (
              <div
                key={docItem.id}
                className={`rounded-3xl bg-brand-white border-2 p-6 shadow-2xs flex flex-col justify-between gap-5 transition-all ${
                  docItem.status === "rejected"
                    ? "border-brand-red"
                    : docItem.status === "verified"
                    ? "border-emerald-500/40"
                    : "border-brand-charcoal/10"
                }`}
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-charcoal text-white">
                        <FolderLock className="h-5 w-5" />
                      </div>
                      <div>
                        <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-red">
                          {docItem.required ? "Requisito Obligatorio" : "Opcional"}
                        </span>
                        <h3 className="font-display text-base font-bold text-brand-charcoal">
                          {docItem.title}
                        </h3>
                      </div>
                    </div>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-bold shrink-0 ${badge.className}`}
                    >
                      <StatusIcon className="h-3.5 w-3.5" />
                      <span>{badge.label}</span>
                    </span>
                  </div>

                  <p className="text-xs text-brand-charcoal/75 leading-relaxed">
                    {docItem.description}
                  </p>

                  {docItem.feedback && (
                    <div className="rounded-xl bg-brand-red/10 border border-brand-red/25 p-3 text-xs text-brand-red font-medium">
                      <strong>Observación de tu Especialista:</strong>{" "}
                      {docItem.feedback}
                    </div>
                  )}

                  {docItem.fileName && (
                    <div className="flex items-center justify-between rounded-xl bg-brand-platinum/50 px-3.5 py-2.5 text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-brand-red shrink-0" />
                        <span className="font-semibold text-brand-charcoal truncate">
                          {docItem.fileName}
                        </span>
                      </div>
                      {docItem.fileUrl && (
                        <a
                          href={docItem.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-bold text-brand-red hover:underline shrink-0 ml-2"
                        >
                          <span>Ver Archivo</span>
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-brand-platinum flex items-center justify-between gap-3">
                  <span className="text-[11px] text-brand-charcoal/60">
                    {docItem.uploadedAt
                      ? `Actualizado: ${new Date(
                          docItem.uploadedAt
                        ).toLocaleDateString("es-CO")}`
                      : "Sin archivo cargado"}
                  </span>

                  {docItem.status !== "verified" && (
                    <label
                      className={`cursor-pointer inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-xs font-bold text-white transition-all ${
                        isUploading
                          ? "bg-brand-charcoal/50 pointer-events-none"
                          : "bg-brand-red hover:bg-brand-charcoal shadow-xs"
                      }`}
                    >
                      <UploadCloud className="h-4 w-4" />
                      <span>
                        {isUploading
                          ? "Cifrando y subiendo..."
                          : docItem.fileUrl
                          ? "Reemplazar Archivo"
                          : "Subir PDF / Imagen"}
                      </span>
                      <input
                        type="file"
                        accept=".pdf,image/jpeg,image/png,image/webp"
                        className="hidden"
                        disabled={isUploading}
                        onChange={(e) =>
                          handleUploadVaultDocument(
                            docItem,
                            e.target.files?.[0]
                          )
                        }
                      />
                    </label>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </DashboardLayout>
  );
}