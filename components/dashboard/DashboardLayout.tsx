// components/dashboard/DashboardLayout.tsx
"use client";

import { ReactNode, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  ShieldCheck,
  LayoutDashboard,
  FileText,
  FolderLock,
  Award,
  LogOut,
  UserCircle,
  Clock,
  Users,
  Briefcase,
  Flame,
  BarChart3,
  ShieldAlert,
  BookOpen,
  Settings,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { calculateApplicationMetrics, formatDisplayName } from "@/lib/firebase/db";

const clientNavigation = [
  { name: "Resumen del Trámite", href: "/dashboard", icon: LayoutDashboard },
  { name: "Formulario Inteligente", href: "/dashboard/formulario", icon: FileText },
  { name: "Bóveda de Documentos", href: "/dashboard/boveda", icon: FolderLock },
  { name: "Sala Consular", href: "/dashboard/sala-entrenamiento", icon: Award },
];

const staffNavigation = [
  {
    name: "Gobernanza & Métricas",
    href: "/dashboard/admin?tab=gobernanza",
    tabId: "gobernanza",
    icon: BarChart3,
    roles: ["admin", "advisor"],
  },
  {
    name: "Bolsa de Casos",
    href: "/dashboard/admin?tab=bolsa",
    tabId: "bolsa",
    icon: Flame,
    roles: ["admin", "advisor"],
  },
  {
    name: "Mis Procesos Asignados",
    href: "/dashboard/admin?tab=mis-casos",
    tabId: "mis-casos",
    icon: Briefcase,
    roles: ["admin", "advisor"],
  },
  {
    name: "Directorio de Clientes",
    href: "/dashboard/admin?tab=clientes",
    tabId: "clientes",
    icon: Users,
    roles: ["admin", "advisor"],
  },
  {
    name: "Recursos Sala Consular",
    href: "/dashboard/admin?tab=sala-cms",
    tabId: "sala-cms",
    icon: BookOpen,
    roles: ["admin"],
  },
  {
    name: "Equipo & Roles Internos",
    href: "/dashboard/admin?tab=equipo",
    tabId: "equipo",
    icon: ShieldAlert,
    roles: ["admin"],
  },
];

// Subcomponente aislado en <Suspense> para evitar errores de prerenderizado con useSearchParams en Next.js 16
function StaffSidebarLinks({ role }: { role: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") || "gobernanza";

  return (
    <nav className="space-y-1">
      {staffNavigation
        .filter((item) => item.roles.includes(role))
        .map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === "/dashboard/admin" && activeTab === item.tabId;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                isActive
                  ? "bg-brand-red text-brand-white shadow-md shadow-brand-red/25"
                  : "text-white/70 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.name}</span>
            </Link>
          );
        })}
    </nav>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    user,
    profile,
    application,
    signOut,
    loading,
    simulateClientView,
    setSimulateClientView,
  } = useAuth();

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  const handleToggleClientSimulation = () => {
    const nextState = !simulateClientView;
    setSimulateClientView(nextState);
    if (nextState) {
      router.push("/dashboard");
    } else {
      router.push("/dashboard/admin?tab=gobernanza");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-brand-red border-t-transparent" />
          <p className="text-sm font-medium text-brand-charcoal">
            Cargando entorno seguro...
          </p>
        </div>
      </div>
    );
  }

  const showClientMenu = !isStaff || simulateClientView;
  const avatarUrl = profile?.photoUrl || user?.photoURL || "";
  const liveMetrics = calculateApplicationMetrics(application);

  return (
    <div className="min-h-screen bg-brand-platinum/50 flex font-sans">
      {/* Sidebar 100% FIJO */}
      <aside className="hidden lg:flex lg:w-72 h-screen sticky top-0 flex-col justify-between bg-brand-charcoal text-brand-white p-6 border-r border-white/10 shrink-0 select-none">
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* Logo */}
          <Link
            href={
              isStaff && !simulateClientView
                ? "/dashboard/admin?tab=gobernanza"
                : "/dashboard"
            }
            className="flex items-center gap-3"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-brand-white shadow-md shadow-brand-red/20 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-display text-base font-bold tracking-tight text-white leading-none">
                GLOBAL VISA
              </span>
              <span className="text-[10px] font-semibold tracking-widest text-white/45 uppercase mt-1">
                {profile?.role === "admin"
                  ? "Backoffice Admin"
                  : profile?.role === "advisor"
                  ? "Backoffice Asesor"
                  : "Portal de Cliente"}
              </span>
            </div>
          </Link>

          {/* Tarjeta de Rol Operativo o Plan Contratado */}
          <div className="rounded-2xl bg-white/[0.04] p-4 border border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] font-medium text-white/50">
              <span>{!showClientMenu ? "Rol Operativo" : "Plan Contratado"}</span>
              <span
                className={`h-2 w-2 rounded-full ${
                  simulateClientView ? "bg-amber-400" : "bg-emerald-400"
                }`}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-display text-sm font-bold text-white">
                {simulateClientView
                  ? "Vista Cliente"
                  : profile?.role === "admin"
                  ? "Admin"
                  : profile?.role === "advisor"
                  ? "Asesor"
                  : profile?.planTier || "Priority Pro"}
              </span>
              {!isStaff || simulateClientView ? (
                <span className="rounded-full bg-brand-red/20 px-2.5 py-0.5 text-[10px] font-bold text-brand-red uppercase">
                  {application?.destination === "JAPAN" ? "🇯🇵 Japón" : "🇺🇸 EE. UU."}
                </span>
              ) : (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/80 uppercase">
                  Staff
                </span>
              )}
            </div>
          </div>

          {/* Menú Dinámico */}
          {!showClientMenu ? (
            <div className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-white/35">
                Operaciones & Backoffice
              </p>
              <Suspense
                fallback={
                  <div className="px-3.5 py-2 text-xs text-white/40">
                    Cargando menú...
                  </div>
                }
              >
                <StaffSidebarLinks role={profile?.role || "client"} />
              </Suspense>
            </div>
          ) : (
            <div className="space-y-1.5">
              <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-white/35">
                {isStaff ? "Simulación de Cliente" : "Mi Expediente"}
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
          )}
        </div>

        {/* Parte Inferior Fija: Toggle Switch + Tarjeta de Perfil Clicable + Cerrar Sesión */}
        <div className="pt-4 border-t border-white/10 space-y-2.5 shrink-0">
          {isStaff && (
            <div
              onClick={handleToggleClientSimulation}
              role="switch"
              aria-checked={simulateClientView}
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleToggleClientSimulation();
                }
              }}
              className="cursor-pointer flex items-center justify-between rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 px-3.5 py-2.5 transition-all"
            >
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">
                  Modo Vista Cliente
                </span>
                <span className="text-[10px] text-white/45">
                  {simulateClientView ? "Simulación activa" : "Backoffice activo"}
                </span>
              </div>

              <div
                className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ${
                  simulateClientView ? "bg-brand-red" : "bg-white/20"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-200 ${
                    simulateClientView ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </div>
            </div>
          )}

          {/* Enlace directo a la Página de Perfil con referrerPolicy="no-referrer" para avatares de Google */}
          <Link
            href="/dashboard/perfil"
            className={`group flex items-center justify-between rounded-xl p-2.5 border transition-all ${
              pathname.startsWith("/dashboard/perfil")
                ? "bg-brand-red/15 border-brand-red/40"
                : "border-transparent hover:bg-white/[0.06] hover:border-white/10"
            }`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={profile?.fullName || "Avatar"}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 shrink-0 rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-white font-bold text-xs">
                  {profile?.fullName ? (
                    profile.fullName.charAt(0).toUpperCase()
                  ) : (
                    <UserCircle className="h-5 w-5" />
                  )}
                </div>
              )}
              <div className="overflow-hidden">
                <p className="text-xs font-semibold text-white truncate group-hover:text-brand-red transition-colors">
                  {profile?.fullName || user?.displayName || "Mi Perfil"}
                </p>
                <p className="text-[10px] text-white/45 truncate">
                  Ver mi perfil y ajustes
                </p>
              </div>
            </div>
            <Settings className="h-4 w-4 text-white/35 group-hover:text-white shrink-0 transition-colors" />
          </Link>

          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-colors"
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
              {pathname.startsWith("/dashboard/perfil")
                ? "Perfil de Cuenta & Expediente 360°"
                : !showClientMenu
                ? profile?.role === "admin"
                  ? "Centro de Gobernanza & Operaciones — Global Visa Consulting"
                  : "Consola de Asesor — Gestión de Casos"
                : application?.visaType || "Solicitud de Visa"}
            </h1>
            <p className="text-xs text-brand-charcoal/55">
              {!showClientMenu ? (
                <span>
                  Sesión iniciada como{" "}
                  <strong className="text-brand-charcoal uppercase">
                    {profile?.role === "admin" ? "Admin" : "Asesor"}
                  </strong>{" "}
                  • Protección PII Nivel Bancario Activa
                </span>
              ) : (
                <span>
                  ID de Expediente:{" "}
                  <span className="font-mono font-semibold text-brand-charcoal/80">
                    {application?.id ? application.id.slice(0, 8) : "---"}
                  </span>
                  {application?.assignedAdvisorName && (
                    <span className="ml-3 text-emerald-700 font-semibold">
                      • Asesor: {formatDisplayName(application.assignedAdvisorName)}
                    </span>
                  )}
                </span>
              )}
            </p>
          </div>

          {showClientMenu && (
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-brand-platinum/80 border border-brand-charcoal/5 px-4 py-1.5 text-xs font-semibold text-brand-charcoal">
                <Clock className="h-3.5 w-3.5 text-brand-red" />
                <span>
                  Fase Actual: Paso {liveMetrics.currentStep} de 4 (
                  {liveMetrics.progressPercentage}%)
                </span>
              </div>
            </div>
          )}
        </header>

        <div className="flex-1 p-6 lg:p-10 max-w-6xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}