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
  Sparkles,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";

const clientNavigation = [
  { name: "Resumen del Trámite", href: "/dashboard", icon: LayoutDashboard },
  { name: "Formulario Inteligente", href: "/dashboard/formulario", icon: FileText },
  { name: "Bóveda de Documentos", href: "/dashboard/boveda", icon: FolderLock },
  { name: "Sala Consular", href: "/dashboard/sala-entrenamiento", icon: Award },
];

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, application, signOut, loading } = useAuth();

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-red border-t-transparent" />
          <p className="text-sm font-medium text-brand-charcoal">Cargando tu portal seguro...</p>
        </div>
      </div>
    );
  }

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  return (
    <div className="min-h-screen bg-brand-platinum/50 flex font-sans">
      {/* Sidebar Fijo en Carbón Absoluto */}
      <aside className="hidden lg:flex lg:w-72 flex-col justify-between bg-brand-charcoal text-brand-white p-6 border-r border-white/10 shrink-0">
        <div className="space-y-7">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-brand-white shadow-md shadow-brand-red/20">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-base font-bold tracking-tight text-white leading-none">
                GLOBAL VISA
              </span>
              <span className="text-[10px] font-semibold tracking-widest text-white/45 uppercase mt-1">
                {profile?.role === "admin"
                  ? "Consola Admin"
                  : profile?.role === "advisor"
                  ? "Consola Asesor"
                  : "Portal de Cliente"}
              </span>
            </div>
          </Link>

          {/* Tarjeta de Plan y Destino */}
          <div className="rounded-2xl bg-white/[0.04] p-4 border border-white/10 space-y-2">
            <div className="flex items-center justify-between text-[11px] font-medium text-white/50">
              <span>Nivel de Cuenta</span>
              <Sparkles className="h-3.5 w-3.5 text-brand-red" />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-white">
                {profile?.role === "admin"
                  ? "Administrador"
                  : profile?.role === "advisor"
                  ? "Asesor Legal"
                  : profile?.planTier || "Priority Pro"}
              </span>
              <span className="rounded-full bg-brand-red/20 px-2.5 py-0.5 text-[10px] font-bold text-brand-red uppercase">
                {application?.destination === "JAPAN" || profile?.destination === "JAPAN"
                  ? "🇯🇵 Japón"
                  : "🇺🇸 EE. UU."}
              </span>
            </div>
          </div>

          {/* Navegación Organizada por Secciones */}
          <div className="space-y-6">
            <div className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-white/35">
                Mi Expediente
              </p>
              <nav className="space-y-1">
                {clientNavigation.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                        isActive
                          ? "bg-brand-red text-brand-white shadow-md shadow-brand-red/25"
                          : "text-white/65 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </nav>
            </div>

            {isStaff && (
              <div className="space-y-1.5 pt-2 border-t border-white/10">
                <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-brand-red">
                  Consola Staff
                </p>
                <Link
                  href="/dashboard/admin"
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    pathname.startsWith("/dashboard/admin")
                      ? "bg-brand-red text-brand-white shadow-md shadow-brand-red/25"
                      : "text-white/75 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0 text-brand-red" />
                  <span>Gestión de Usuarios y Casos</span>
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Perfil y Salida */}
        <div className="pt-5 border-t border-white/10 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white font-bold text-xs">
              {profile?.fullName ? (
                profile.fullName.charAt(0).toUpperCase()
              ) : (
                <UserCircle className="h-5 w-5" />
              )}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">
                {profile?.fullName || user?.displayName || "Usuario Activo"}
              </p>
              <p className="text-[11px] text-white/45 truncate">
                {profile?.email || user?.email}
              </p>
            </div>
          </div>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar Sesión Segura</span>
          </button>
        </div>
      </aside>

      {/* Contenido Principal */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-brand-white/95 backdrop-blur-md border-b border-brand-platinum px-6 lg:px-10 py-4 flex items-center justify-between">
          <div>
            <h1 className="font-display text-lg font-bold text-brand-charcoal">
              {isStaff && pathname.startsWith("/dashboard/admin")
                ? "Consola de Administración y Provisionamiento"
                : application?.visaType || "Solicitud de Visa"}
            </h1>
            <p className="text-xs text-brand-charcoal/55">
              ID de Expediente:{" "}
              <span className="font-mono font-semibold text-brand-charcoal/80">
                {application?.id ? application.id.slice(0, 8) : "---"}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 rounded-full bg-brand-platinum/80 border border-brand-charcoal/5 px-4 py-1.5 text-xs font-semibold text-brand-charcoal">
              <Clock className="h-3.5 w-3.5 text-brand-red" />
              <span>Fase Actual: Paso {application?.currentStep || 2} de 4</span>
            </div>
          </div>
        </header>

        <div className="flex-1 p-6 lg:p-10 max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}