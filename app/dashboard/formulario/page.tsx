// app/dashboard/formulario/page.tsx
"use client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
export default function FormularioPage() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h2 className="font-display text-3xl font-bold text-brand-charcoal">Formulario Inteligente</h2>
        <p className="text-sm text-brand-charcoal/70">Aquí construirermos el formulario multi-paso en la Fase 5.</p>
      </div>
    </DashboardLayout>
  );
}