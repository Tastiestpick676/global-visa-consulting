// components/dashboard/DocumentPreviewModal.tsx
"use client";

import { X, ExternalLink, FileText, Download } from "lucide-react";

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  fileName?: string;
  fileUrl: string;
}

export function DocumentPreviewModal({
  isOpen,
  onClose,
  title,
  fileName,
  fileUrl,
}: DocumentPreviewModalProps) {
  if (!isOpen || !fileUrl) return null;

  const lowerName = (fileName || fileUrl).toLowerCase();
  const isImage =
    lowerName.includes(".jpg") ||
    lowerName.includes(".jpeg") ||
    lowerName.includes(".png") ||
    lowerName.includes(".webp");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-6 font-sans">
      <div className="flex flex-col w-full max-w-5xl h-[88vh] rounded-3xl bg-brand-charcoal border border-white/15 shadow-2xl overflow-hidden">
        {/* Barra Superior del Visor */}
        <div className="flex items-center justify-between px-6 py-4 bg-brand-charcoal border-b border-white/10 text-white shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-red text-white">
              <FileText className="h-4 w-4" />
            </div>
            <div className="truncate">
              <h3 className="font-display text-sm sm:text-base font-bold truncate">
                {title}
              </h3>
              {fileName && (
                <p className="text-[11px] text-white/55 truncate">{fileName}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-brand-red px-4 py-2 text-xs font-semibold text-white transition-colors"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Descargar / Nueva Pestaña</span>
              <ExternalLink className="h-3 w-3 sm:hidden" />
            </a>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl p-2 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Cerrar visor"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Lienzo de Previsualización */}
        <div className="flex-1 bg-brand-platinum/20 flex items-center justify-center overflow-auto p-2 sm:p-4">
          {isImage ? (
            <img
              src={fileUrl}
              alt={title}
              className="max-h-full max-w-full object-contain rounded-xl shadow-lg"
            />
          ) : (
            <iframe
              src={fileUrl}
              title={title}
              className="w-full h-full rounded-xl bg-white border-0 shadow-inner"
            />
          )}
        </div>
      </div>
    </div>
  );
}