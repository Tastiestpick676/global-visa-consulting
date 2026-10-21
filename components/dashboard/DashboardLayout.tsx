// components/dashboard/DashboardLayout.tsx
"use client";

import { ReactNode, Suspense, useState, useEffect, useRef } from "react";
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
  Menu,
  X,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  CheckCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { calculateApplicationMetrics, formatDisplayName } from "@/lib/firebase/db";
import { db } from "@/lib/firebase/config";
import {
  collection,
  doc,
  onSnapshot,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { AppNotification } from "@/types/visa";

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

// Skeleton Estructural para feedback visual instantáneo y LCP óptimo en Lighthouse
export function DashboardContentSkeleton() {
  return (
    <div className="space-y-6 animate-skeleton" aria-busy="true" aria-live="polite">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {[1, 2, 3, 4, 5].map((n) => (
          <div
            key={n}
            className="rounded-2xl bg-brand-white p-5 border border-brand-charcoal/10 shadow-2xs space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-3 w-20 rounded-full bg-brand-charcoal/10" />
              <div className="h-4 w-4 rounded-md bg-brand-charcoal/10" />
            </div>
            <div className="h-8 w-14 rounded-lg bg-brand-charcoal/15" />
            <div className="h-2.5 w-28 rounded-full bg-brand-charcoal/10" />
          </div>
        ))}
      </div>

      <div className="rounded-2xl bg-brand-white p-6 sm:p-8 border border-brand-charcoal/10 shadow-2xs space-y-4">
        <div className="space-y-2 border-b border-brand-platinum pb-4">
          <div className="h-5 w-56 rounded-lg bg-brand-charcoal/15" />
          <div className="h-3 w-80 max-w-full rounded-full bg-brand-charcoal/10" />
        </div>
        {[1, 2, 3].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between gap-4 rounded-xl bg-brand-platinum/40 p-4"
          >
            <div className="space-y-2 flex-1">
              <div className="h-4 w-48 rounded-full bg-brand-charcoal/15" />
              <div className="h-3 w-64 max-w-full rounded-full bg-brand-charcoal/10" />
            </div>
            <div className="h-9 w-28 rounded-full bg-brand-charcoal/15 shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

function StaffSidebarLinks({
  role,
  onNavigate,
}: {
  role: string;
  onNavigate?: () => void;
}) {
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
              onClick={onNavigate}
              className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all active:scale-[0.98] ${
                isActive
                  ? "bg-brand-red text-brand-white shadow-md shadow-brand-red/25"
                  : "text-white/75 hover:bg-white/5 hover:text-white"
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

function DashboardLayoutInner({ children }: { children: ReactNode }) {
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

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMobileMenuOpen(false);
    setNotifOpen(false);
  }, [pathname]);

  // 5. Cerrar menú de Notificaciones y Drawer móvil con tecla Escape o clic afuera
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setNotifOpen(false);
        setMobileMenuOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (
        notifOpen &&
        notifContainerRef.current &&
        !notifContainerRef.current.contains(e.target as Node)
      ) {
        setNotifOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [notifOpen]);

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  useEffect(() => {
    if (!user) return;
    const targets = isStaff ? [user.uid, "STAFF"] : [user.uid];
    const q = query(
      collection(db, "notifications"),
      where("recipientId", "in", targets)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const list: AppNotification[] = [];
        snap.forEach((d) => list.push(d.data() as AppNotification));
        list.sort((a, b) =>
          (b.createdAt || "").localeCompare(a.createdAt || "")
        );
        setNotifications(list.slice(0, 20));
      },
      () => {}
    );

    return () => unsub();
  }, [user, isStaff]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkNotificationRead = async (notif: AppNotification) => {
    try {
      if (!notif.read) {
        await updateDoc(doc(db, "notifications", notif.id), { read: true });
      }
      setNotifOpen(false);
      if (notif.link) {
        router.push(notif.link);
      }
    } catch {}
  };

  const handleMarkAllRead = async () => {
    try {
      const unread = notifications.filter((n) => !n.read);
      await Promise.all(
        unread.map((n) =>
          updateDoc(doc(db, "notifications", n.id), { read: true })
        )
      );
    } catch {}
  };

  const handleToggleClientSimulation = () => {
    const nextState = !simulateClientView;
    setSimulateClientView(nextState);
    setMobileMenuOpen(false);
    if (nextState) {
      router.push("/dashboard");
    } else {
      router.push("/dashboard/admin?tab=gobernanza");
    }
  };

  const handleSignOut = async () => {
    setMobileMenuOpen(false);
    await signOut();
    router.push("/login");
  };

  const showClientMenu = !isStaff || simulateClientView;
  const avatarUrl = profile?.photoUrl || user?.photoURL || "";
  const liveMetrics = calculateApplicationMetrics(application);

  const renderSidebarContent = (onNavigate?: () => void) => (
    <>
      <div className="space-y-6 overflow-y-auto pr-1">
        {/* Cabecera de la Sidebar: Logo + Botón de Ocultar Sidebar adentro de la misma Sidebar */}
        <div className="flex items-center justify-between gap-2">
          <Link
            href={
              isStaff && !simulateClientView
                ? "/dashboard/admin?tab=gobernanza"
                : "/dashboard"
            }
            onClick={onNavigate}
            className="flex items-center gap-3 min-w-0"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-red text-brand-white shadow-md shadow-brand-red/20 shrink-0">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="flex flex-col truncate">
              <span className="font-display text-base font-bold tracking-tight text-white leading-none truncate">
                GLOBAL VISA
              </span>
              <span className="text-[10px] font-semibold tracking-widest text-white/60 uppercase mt-1 truncate">
                {profile?.role === "admin"
                  ? "Backoffice Admin"
                  : profile?.role === "advisor"
                  ? "Backoffice Asesor"
                  : "Portal de Cliente"}
              </span>
            </div>
          </Link>

          {/* 4. Botón de Ocultar Sidebar ubicado DENTRO de la propia Sidebar (En PC) */}
          {!onNavigate && (
            <button
              type="button"
              onClick={() => setDesktopSidebarOpen(false)}
              title="Ocultar barra lateral"
              aria-label="Ocultar barra lateral"
              className="hidden lg:inline-flex items-center justify-center rounded-xl bg-white/[0.06] hover:bg-brand-red text-white/75 hover:text-white p-2 border border-white/10 transition-all shrink-0"
            >
              <PanelLeftClose className="h-4 w-4" />
            </button>
          )}

          {/* Botón cerrar en Móvil */}
          {onNavigate && (
            <button
              type="button"
              onClick={onNavigate}
              className="lg:hidden rounded-lg p-2 text-white/70 hover:bg-white/10 hover:text-white transition-colors"
              aria-label="Cerrar menú móvil"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Tarjeta de Rol o Plan (con Skeleton si aún está cargando) */}
        <div className="rounded-2xl bg-white/[0.04] p-4 border border-white/10 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-medium text-white/60">
            <span>{!showClientMenu ? "Rol Operativo" : "Plan Contratado"}</span>
            <span
              className={`h-2 w-2 rounded-full ${
                simulateClientView ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
          </div>
          {loading ? (
            <div className="h-5 w-28 rounded-md bg-white/10 animate-skeleton mt-1" />
          ) : (
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
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold text-white/85 uppercase">
                  Staff
                </span>
              )}
            </div>
          )}
        </div>

        {/* Menú de Navegación (o Skeleton si aún carga el rol) */}
        {loading ? (
          <div className="space-y-2 pt-2 animate-skeleton">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 w-full rounded-xl bg-white/[0.06]" />
            ))}
          </div>
        ) : !showClientMenu ? (
          <div className="space-y-1.5">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
              Operaciones & Backoffice
            </p>
            <Suspense
              fallback={
                <div className="space-y-2 pt-1 animate-skeleton">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-9 w-full rounded-xl bg-white/5" />
                  ))}
                </div>
              }
            >
              <StaffSidebarLinks
                role={profile?.role || "client"}
                onNavigate={onNavigate}
              />
            </Suspense>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-white/50">
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
                    onClick={onNavigate}
                    className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all active:scale-[0.98] ${
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
          </div>
        )}
      </div>

      {/* Pie de Sidebar */}
      <div className="pt-4 border-t border-white/10 space-y-2.5 shrink-0">
        {isStaff && (
          <div
            onClick={handleToggleClientSimulation}
            role="switch"
            aria-checked={simulateClientView}
            aria-label="Alternar Modo Vista Cliente"
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
              <span className="text-[10px] text-white/60">
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

        <Link
          href="/dashboard/perfil"
          onClick={onNavigate}
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
                width={36}
                height={36}
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
                {formatDisplayName(profile?.fullName || user?.displayName) ||
                  "Mi Perfil"}
              </p>
              <p className="text-[10px] text-white/60 truncate">
                Ver mi perfil y ajustes
              </p>
            </div>
          </div>
          <Settings className="h-4 w-4 text-white/50 group-hover:text-white shrink-0 transition-colors" />
        </Link>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs font-semibold text-red-400 hover:bg-red-500/10 transition-all"
        >
          <LogOut className="h-4 w-4" />
          <span>Cerrar Sesión Segura</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-brand-platinum/50 flex font-sans">
      {/* Sidebar en Desktop */}
      <aside
        className={`hidden lg:flex h-screen sticky top-0 flex-col justify-between bg-brand-charcoal text-brand-white shrink-0 select-none transition-all duration-300 ease-in-out overflow-hidden ${
          desktopSidebarOpen
            ? "lg:w-72 p-6 border-r border-white/10 opacity-100"
            : "lg:w-0 p-0 border-r-0 opacity-0 pointer-events-none"
        }`}
      >
        <div className="w-60 flex-1 flex flex-col justify-between h-full">
          {renderSidebarContent()}
        </div>
      </aside>

      {/* Drawer en Móvil */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-72 max-w-[85vw] h-full flex flex-col justify-between bg-brand-charcoal text-brand-white p-6 shadow-2xl select-none">
            {renderSidebarContent(() => setMobileMenuOpen(false))}
          </aside>
        </div>
      )}

      {/* Contenido Principal (Renderiza el Header de inmediato para LCP < 0.8s en Lighthouse) */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 bg-brand-white/95 backdrop-blur-md border-b border-brand-platinum px-4 sm:px-6 lg:px-10 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {/* Botón Hamburguesa Móvil */}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden inline-flex items-center justify-center rounded-xl bg-brand-charcoal p-2.5 text-white hover:bg-brand-red transition-all shrink-0"
              aria-label="Abrir menú móvil"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Solo aparece en el Header cuando la Sidebar de PC está oculta para poder reabrirla */}
            {!desktopSidebarOpen && (
              <button
                type="button"
                onClick={() => setDesktopSidebarOpen(true)}
                title="Mostrar barra lateral"
                aria-label="Mostrar barra lateral"
                className="hidden lg:inline-flex items-center justify-center rounded-xl bg-brand-charcoal hover:bg-brand-red text-white p-2.5 transition-all shrink-0 shadow-xs"
              >
                <PanelLeftOpen className="h-4 w-4" />
              </button>
            )}

            <div className="truncate">
              <h1 className="font-display text-base sm:text-lg font-bold text-brand-charcoal truncate">
                {pathname.startsWith("/dashboard/perfil")
                  ? "Perfil de Cuenta & Expediente 360°"
                  : pathname.startsWith("/dashboard/admin")
                  ? "Centro de Gobernanza & Operaciones — Global Visa Consulting"
                  : !showClientMenu
                  ? "Consola de Asesor — Gestión de Casos"
                  : application?.visaType || "Portal de Gestión Migratoria"}
              </h1>
              {/* Contraste ajustado a text-brand-charcoal/75 para cumplir WCAG AA 4.5:1 en Lighthouse */}
              <p className="text-[11px] sm:text-xs text-brand-charcoal/75 truncate">
                {!showClientMenu || pathname.startsWith("/dashboard/admin") ? (
                  <span>
                    Sesión iniciada como{" "}
                    <strong className="text-brand-charcoal uppercase">
                      {profile?.role === "advisor" ? "Asesor" : "Admin"}
                    </strong>{" "}
                    • Protección PII Nivel Bancario Activa (Token 8h)
                  </span>
                ) : (
                  <span>
                    ID de Expediente:{" "}
                    <span className="font-mono font-semibold text-brand-charcoal">
                      {application?.id ? application.id.slice(0, 8) : "---"}
                    </span>
                    {application?.assignedAdvisorName && (
                      <span className="ml-2 sm:ml-3 text-emerald-800 font-semibold">
                        • Asesor: {formatDisplayName(application.assignedAdvisorName)}
                      </span>
                    )}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {showClientMenu && !loading && (
              <div className="hidden sm:flex items-center gap-2 rounded-full bg-brand-platinum/80 border border-brand-charcoal/10 px-4 py-1.5 text-xs font-semibold text-brand-charcoal">
                <Clock className="h-3.5 w-3.5 text-brand-red" />
                <span>
                  Fase Actual: Paso {liveMetrics.currentStep} de 4 (
                  {liveMetrics.progressPercentage}%)
                </span>
              </div>
            )}

            {/* Centro de Notificaciones con cierre al hacer clic afuera o presionar Escape */}
            <div ref={notifContainerRef} className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative inline-flex items-center justify-center rounded-xl bg-brand-platinum/80 hover:bg-brand-charcoal text-brand-charcoal hover:text-white p-2.5 border border-brand-charcoal/10 transition-all"
                aria-label="Centro de Notificaciones"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white shadow-xs">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-brand-white border border-brand-charcoal/15 shadow-2xl z-50 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 bg-brand-charcoal text-white">
                    <span className="font-display text-xs font-bold uppercase tracking-wider">
                      Notificaciones ({unreadCount} nuevas)
                    </span>
                    <div className="flex items-center gap-2">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllRead}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-red hover:underline"
                        >
                          <CheckCheck className="h-3.5 w-3.5" />
                          <span>Marcar leídas</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="rounded-lg p-1 text-white/60 hover:text-white"
                        aria-label="Cerrar notificaciones"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="max-h-80 overflow-y-auto divide-y divide-brand-platinum">
                    {notifications.length === 0 ? (
                      <div className="p-6 text-center text-xs text-brand-charcoal/70">
                        No tienes notificaciones pendientes.
                      </div>
                    ) : (
                      notifications.map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => handleMarkNotificationRead(n)}
                          className={`w-full text-left p-4 hover:bg-brand-platinum/50 transition-colors flex items-start gap-3 ${
                            !n.read ? "bg-brand-red/[0.03]" : ""
                          }`}
                        >
                          <span
                            className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${
                              !n.read ? "bg-brand-red" : "bg-brand-charcoal/20"
                            }`}
                          />
                          <div className="space-y-1 min-w-0 flex-1">
                            <p className="text-xs font-bold text-brand-charcoal truncate">
                              {n.title}
                            </p>
                            <p className="text-[11px] text-brand-charcoal/75 leading-relaxed">
                              {n.message}
                            </p>
                            <p className="text-[10px] text-brand-charcoal/60">
                              {new Date(n.createdAt).toLocaleString("es-CO", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 lg:p-10 max-w-6xl w-full mx-auto">
          {loading ? <DashboardContentSkeleton /> : children}
        </div>
      </main>
    </div>
  );
}

export function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-brand-platinum/50 p-6 lg:p-10">
          <DashboardContentSkeleton />
        </div>
      }
    >
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}