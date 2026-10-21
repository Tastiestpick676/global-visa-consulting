// components/dashboard/DocumentPreviewModal.tsx
"use client";

import { useEffect, useState } from "react";
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
  const [frameLoading, setFrameLoading] = useState(true);

  useEffect(() => {
    if (isOpen) {
      setFrameLoading(true);
    }
  }, [isOpen, fileUrl]);

  // 5. Cerrar con la tecla Escape en el teclado
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !fileUrl) return null;

  const lowerName = (fileName || fileUrl).toLowerCase();
  const isImage =
    lowerName.includes(".jpg") ||
    lowerName.includes(".jpeg") ||
    lowerName.includes(".png") ||
    lowerName.includes(".webp");

  return (
    <div
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title || "Visor de Documento"}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-3 sm:p-6 font-sans cursor-pointer"
    >
      {/* Contenedor interior: detiene la propagación para que hacer clic adentro NO cierre el visor */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex flex-col w-full max-w-5xl h-[88vh] rounded-3xl bg-brand-charcoal border border-white/15 shadow-2xl overflow-hidden cursor-default"
      >
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
              <p className="text-[11px] text-white/65 truncate">
                {fileName || "Presiona ESC o haz clic afuera para cerrar"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <a
              href={fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-full bg-white/10 hover:bg-brand-red px-4 py-2 text-xs font-semibold text-white transition-all active:scale-95"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Descargar / Nueva Pestaña</span>
              <ExternalLink className="h-3 w-3 sm:hidden" />
            </a>
            <button
              type="button"
              onClick={onClose}
              title="Cerrar (Esc)"
              className="rounded-xl p-2 text-white/70 hover:bg-white/10 hover:text-white transition-all"
              aria-label="Cerrar visor"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Lienzo de Previsualización con Skeleton mientras carga */}
        <div className="relative flex-1 bg-brand-platinum/20 flex items-center justify-center overflow-auto p-2 sm:p-4">
          {frameLoading && (
            <div className="absolute inset-4 rounded-xl bg-white/10 animate-skeleton flex flex-col items-center justify-center gap-3 text-white/70">
              <div className="h-12 w-12 rounded-2xl bg-white/15" />
              <div className="h-3 w-48 rounded-full bg-white/15" />
              <div className="h-2.5 w-32 rounded-full bg-white/10" />
            </div>
          )}

          {isImage ? (
            <img
              src={fileUrl}
              alt={title}
              onLoad={() => setFrameLoading(false)}
              className="relative z-10 max-h-full max-w-full object-contain rounded-xl shadow-lg"
            />
          ) : (
            <iframe
              src={fileUrl}
              title={title}
              onLoad={() => setFrameLoading(false)}
              className="relative z-10 w-full h-full rounded-xl bg-white border-0 shadow-inner"
            />
          )}
        </div>
      </div>
    </div>
  );
}