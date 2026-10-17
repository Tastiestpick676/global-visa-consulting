// app/dashboard/boveda/page.tsx
"use client";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

export default function BovedaPage() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h2 className="font-display text-3xl font-bold text-brand-charcoal">
          Bóveda de Documentos
        </h2>
        <p className="text-sm text-brand-charcoal/70">
          Aquí configuraremos la subida segura a Firebase Storage en la Fase 6.
        </p>
      </div>
    </DashboardLayout>
  );
}