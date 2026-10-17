// app/dashboard/sala-entrenamiento/page.tsx
"use client";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
export default function SalaPage() {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h2 className="font-display text-3xl font-bold text-brand-charcoal">Sala de Entrenamiento Consular</h2>
        <p className="text-sm text-brand-charcoal/70">Aquí habilitaremos el agendamiento y reportes en la Fase 6.</p>
      </div>
    </DashboardLayout>
  );
}