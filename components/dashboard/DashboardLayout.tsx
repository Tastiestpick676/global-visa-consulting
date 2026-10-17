// components/dashboard/DashboardLayout.tsx
"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { 
  ShieldCheck, 
  LayoutDashboard, 
  FileText, 
  FolderLock, 
  Award, 
  LogOut, 
  UserCircle,
  Clock,
  Sparkles
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const navigation = [
  { name: "Resumen del Trámite", href: "/dashboard", icon: LayoutDashboard },
  { name: "Formulario Inteligente", href: "/dashboard/formulario", icon: FileText },
  { name: "Bóveda de Documentos", href: "/dashboard/boveda", icon: FolderLock },
  { name: "Sala Consular", href: "/dashboard/sala-entrenamiento", icon: Award },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, application, signOut, loading } = useAuth(); // <-- Corregido: se incluye 'user' aquí

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-red border-t-transparent" />
          <p className="text-sm font-semibold text-brand-charcoal">Cargando tu portal seguro...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-platinum/40 flex">
      {/* Sidebar Fijo en Carbón Absoluto */}
      <aside className="hidden lg:flex lg:w-72 flex-col justify-between bg-brand-charcoal text-brand-white p-6 border-r border-white/10">
        <div className="space-y-8">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-brand-white">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-base font-bold tracking-tight text-white leading-none">
                GLOBAL VISA
              </span>
              <span className="text-[10px] font-medium tracking-widest text-white/50 uppercase mt-0.5">
                Portal de Cliente
              </span>
            </div>
          </Link>

          {/* Badge del Plan */}
          <div className="rounded-xl bg-white/5 p-4 border border-white/10 space-y-1">
            <div className="flex items-center justify-between text-xs text-white/60">
              <span>Plan Activo</span>
              <Sparkles className="h-3.5 w-3.5 text-brand-red" />
            </div>
            <p className="font-display text-sm font-bold text-white">
              {profile?.planTier || "Priority Pro"}
            </p>
            <p className="text-[11px] text-brand-red uppercase font-semibold">
              {profile?.destination === "JAPAN" ? "🇯🇵 Japón" : "🇺🇸 Estados Unidos"}
            </p>
          </div>

          {/* Navegación del Portal */}
          <nav className="space-y-1.5">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-brand-red text-brand-white shadow-lg shadow-brand-red/20"
                      : "text-white/70 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Perfil y Salida */}
        <div className="pt-6 border-t border-white/10 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white font-bold text-sm">
              {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : <UserCircle className="h-5 w-5" />}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">
                {profile?.fullName || user?.displayName || "Cliente Titular"}
              </p>
              <p className="text-[11px] text-white/50 truncate">
                {profile?.email || user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar Sesión Segura</span>
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col min-w-0">
        {/* Barra Superior / Header del Dashboard con Progress Tracker */}
        <header className="sticky top-0 z-40 bg-brand-white/90 backdrop-blur-md border-b border-brand-platinum px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="font-display text-lg font-bold text-brand-charcoal">
                {application?.visaType || "Solicitud de Visa"}
              </h1>
              <p className="text-xs text-brand-charcoal/60">
                ID de Expediente: <span className="font-mono">{application?.id ? application.id.slice(0, 8) : "---"}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-brand-platinum px-4 py-1.5 text-xs font-semibold text-brand-charcoal">
              <Clock className="h-3.5 w-3.5 text-brand-red" />
              <span>Fase Actual: Paso {application?.currentStep || 2} de 4</span>
            </div>
          </div>
        </header>

        {/* Vista Inyectada */}
        <div className="flex-1 p-6 lg:p-10 max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}