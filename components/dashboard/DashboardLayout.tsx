// components/dashboard/DashboardLayout.tsx
"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { BrandLogo } from "@/components/ui/BrandLogo";
import { db } from "@/lib/firebase/config";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  updateDoc,
} from "firebase/firestore";
import {
  AppNotification,
  PreApprovedUser,
  VisaApplication,
} from "@/types/visa";
import { formatDisplayName } from "@/lib/firebase/db";
import {
  LayoutDashboard,
  FileText,
  FolderLock,
  GraduationCap,
  ShieldAlert,
  LogOut,
  Menu,
  X,
  MessageCircle,
  Bell,
  UserCircle,
  PanelLeftClose,
  PanelLeftOpen,
  Flame,
  Briefcase,
  Users,
  BookOpen,
  BarChart3,
  Eye,
  CheckCheck,
  TerminalSquare,
} from "lucide-react";
import { getWhatsAppUrl } from "@/lib/constants";

export function DashboardContentSkeleton() {
  return (
    <div
      className="space-y-6 animate-pulse"
      aria-busy="true"
      aria-label="Cargando contenido del portal"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((n) => (
          <div
            key={n}
            className="h-28 rounded-2xl bg-brand-white border border-brand-charcoal/10 p-5 flex flex-col justify-between"
          >
            <div className="h-3 w-24 rounded bg-brand-platinum" />
            <div className="h-7 w-16 rounded bg-brand-platinum" />
            <div className="h-2.5 w-32 rounded bg-brand-platinum/70" />
          </div>
        ))}
      </div>
      <div className="h-96 rounded-2xl bg-brand-white border border-brand-charcoal/10 p-6 space-y-4">
        <div className="h-5 w-48 rounded bg-brand-platinum" />
        <div className="h-3 w-72 rounded bg-brand-platinum/70" />
        <div className="space-y-3 pt-4">
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-16 rounded-xl bg-brand-platinum/50" />
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { user, profile, loading, signOut } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab") || "gobernanza";

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [viewMode, setViewMode] = useState<"staff" | "client">("staff");

  const [previewClients, setPreviewClients] = useState<PreApprovedUser[]>([]);
  const [previewClientEmail, setPreviewClientEmail] = useState<string>("");

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [bellOpen, setBellOpen] = useState(false);

  const isStaff = profile?.role === "admin" || profile?.role === "advisor";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedCollapse = localStorage.getItem("gvc_sidebar_collapsed");
    if (savedCollapse === "true") setSidebarCollapsed(true);

    const savedMode = localStorage.getItem("gvc_staff_view_mode");
    if (savedMode === "client" || savedMode === "staff") {
      setViewMode(savedMode);
    }

    const savedClientEmail = localStorage.getItem("gvc_preview_client_email");
    if (savedClientEmail) {
      setPreviewClientEmail(savedClientEmail);
    }
  }, []);

  useEffect(() => {
    if (!isStaff) return;
    const loadPreviewableClients = async () => {
      try {
        const snap = await getDocs(collection(db, "allowed_emails"));
        const list: PreApprovedUser[] = [];
        snap.forEach((d) => {
          const data = d.data() as PreApprovedUser;
          if (data.role === "client") {
            list.push(data);
          }
        });
        setPreviewClients(list);
        if (list.length > 0 && !previewClientEmail) {
          setPreviewClientEmail(list[0].email);
          localStorage.setItem("gvc_preview_client_email", list[0].email);
        }
      } catch {}
    };
    loadPreviewableClients();
  }, [isStaff, previewClientEmail]);

  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(
      doc(db, "applications", user.uid),
      (snap) => {
        if (snap.exists()) {
          const data = snap.data() as VisaApplication;
          setNotifications(data.notifications || []);
        }
      },
      () => {}
    );
    return () => unsub();
  }, [user]);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [user, loading, router]);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("gvc_sidebar_collapsed", String(next));
      return next;
    });
  };

  const handleToggleClientPreviewSwitch = () => {
    const nextMode = viewMode === "client" ? "staff" : "client";
    setViewMode(nextMode);
    localStorage.setItem("gvc_staff_view_mode", nextMode);
    if (nextMode === "client") {
      router.push("/dashboard");
    } else {
      router.push("/dashboard/admin?tab=gobernanza");
    }
  };

  const handleSelectPreviewClient = async (email: string) => {
    setPreviewClientEmail(email);
    localStorage.setItem("gvc_preview_client_email", email);

    if (user) {
      const selected = previewClients.find((c) => c.email === email);
      if (selected) {
        try {
          const appsSnap = await getDocs(collection(db, "applications"));
          let realClientApp: VisaApplication | null = null;
          appsSnap.forEach((d) => {
            const appData = d.data() as VisaApplication;
            if (
              appData.clientEmail?.toLowerCase() === email.toLowerCase() &&
              d.id !== user.uid
            ) {
              realClientApp = appData;
            }
          });

          const myAppRef = doc(db, "applications", user.uid);
          const mySnap = await getDoc(myAppRef);
          if (mySnap.exists()) {
            await updateDoc(myAppRef, {
              destination: realClientApp
                ? (realClientApp as VisaApplication).destination
                : selected.destination,
              planTier: realClientApp
                ? (realClientApp as VisaApplication).planTier
                : selected.planTier,
              visaType:
                (selected.destination || "USA") === "JAPAN"
                  ? "Turismo / Estancia Corta Japón"
                  : "B1/B2 Turismo y Negocios EE. UU.",
              ...(realClientApp
                ? {
                    progressPercentage: (realClientApp as VisaApplication)
                      .progressPercentage,
                    status: (realClientApp as VisaApplication).status,
                    currentStep: (realClientApp as VisaApplication).currentStep,
                  }
                : {}),
            });
          }
        } catch {}
      }
    }
  };

  const handleMarkNotificationsRead = async () => {
    if (!user || notifications.length === 0) return;
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    try {
      await updateDoc(doc(db, "applications", user.uid), {
        notifications: updated,
      });
    } catch {}
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-brand-platinum flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-brand-red border-t-transparent" />
          <p className="font-sans text-xs font-medium text-brand-charcoal/70">
            Sincronizando entorno seguro...
          </p>
        </div>
      </div>
    );
  }

  const clientNavItems = [
    { name: "Resumen de Trámite", href: "/dashboard", icon: LayoutDashboard },
    {
      name: "Cuestionario DS-160",
      href: "/dashboard/cuestionario",
      icon: FileText,
    },
    { name: "Bóveda Documental", href: "/dashboard/boveda", icon: FolderLock },
    {
      name: "Sala Consular",
      href: "/dashboard/sala-entrenamiento",
      icon: GraduationCap,
    },
  ];

  const staffNavItems = [
    {
      name: "Gobernanza & Métricas",
      href: "/dashboard/admin?tab=gobernanza",
      tabId: "gobernanza",
      icon: BarChart3,
    },
    {
      name: "Bolsa de Casos",
      href: "/dashboard/admin?tab=bolsa",
      tabId: "bolsa",
      icon: Flame,
    },
    {
      name: "Mis Procesos Asignados",
      href: "/dashboard/admin?tab=mis-casos",
      tabId: "mis-casos",
      icon: Briefcase,
    },
    {
      name: "Directorio de Clientes",
      href: "/dashboard/admin?tab=clientes",
      tabId: "clientes",
      icon: Users,
    },
    ...(profile?.role === "admin"
      ? [
          {
            name: "Recursos Sala Consular",
            href: "/dashboard/admin?tab=sala-cms",
            tabId: "sala-cms",
            icon: BookOpen,
          },
          {
            name: "Equipo & Roles Internos",
            href: "/dashboard/admin?tab=equipo",
            tabId: "equipo",
            icon: ShieldAlert,
          },
          {
            name: "Logs & Auditoría",
            href: "/dashboard/admin?tab=logs",
            tabId: "logs",
            icon: TerminalSquare,
          },
        ]
      : []),
  ];

  const handleSignOut = async () => {
    await signOut();
    router.push("/login");
  };

  const unreadCount = notifications.filter((n) => !n.read).length;
  const formattedUserName = formatDisplayName(
    profile?.fullName || user.displayName || "Usuario"
  );

  return (
    <div className="min-h-screen bg-brand-platinum/50 flex flex-col lg:flex-row font-sans">
      {/* SIDEBAR FIJA A LA ALTURA DE LA PANTALLA (lg:h-screen lg:sticky lg:top-0) */}
      <aside
        aria-label="Menú principal del portal"
        className={`hidden lg:flex lg:h-screen lg:sticky lg:top-0 lg:flex-col lg:justify-between bg-brand-charcoal text-brand-white p-4 shrink-0 transition-all duration-300 overflow-hidden select-none ${
          sidebarCollapsed ? "lg:w-20" : "lg:w-72"
        }`}
      >
        <div
          className={`space-y-5 ${
            sidebarCollapsed ? "w-12" : "w-60"
          } mx-auto flex-1 flex flex-col min-h-0`}
        >
          <div className="flex items-center justify-between border-b border-white/10 pb-4 shrink-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 overflow-hidden focus:outline-none"
            >
              <BrandLogo
                theme="dark"
                size="sm"
                iconOnly={sidebarCollapsed}
                subtitle={isStaff ? "Backoffice Admin" : "Portal Cliente"}
              />
            </Link>

            <button
              type="button"
              onClick={toggleSidebar}
              aria-label={
                sidebarCollapsed
                  ? "Expandir barra lateral"
                  : "Colapsar barra lateral"
              }
              title={
                sidebarCollapsed
                  ? "Expandir barra lateral"
                  : "Colapsar barra lateral"
              }
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-white/70 hover:bg-white/15 hover:text-white transition-all shrink-0"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>

          {!sidebarCollapsed && (
            <div className="rounded-xl bg-white/5 p-3.5 border border-white/10 space-y-1 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-white/60">
                  Rol Operativo
                </span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
              <div className="flex items-center justify-between pt-0.5">
                <span className="font-display text-sm font-bold text-white">
                  {profile?.role === "admin"
                    ? "Admin"
                    : profile?.role === "advisor"
                    ? "Asesor"
                    : `Plan ${profile?.planTier || "Essential"}`}
                </span>
                <span className="rounded bg-white/15 px-2 py-0.5 text-[10px] font-bold text-white uppercase">
                  {isStaff ? "Staff" : profile?.destination || "USA"}
                </span>
              </div>
            </div>
          )}

          <nav
            aria-label="Navegación del expediente"
            className="space-y-4 flex-1 overflow-y-auto pr-1"
          >
            {(!isStaff || viewMode === "client") && (
              <div className="space-y-1">
                {!sidebarCollapsed && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-white/55 pb-1">
                    {isStaff ? "Simulación Vista Cliente" : "Mi Expediente"}
                  </p>
                )}
                {clientNavItems.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.name}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                        active
                          ? "bg-brand-red text-brand-white shadow-md shadow-brand-red/25"
                          : "text-white/75 hover:bg-white/5 hover:text-white"
                      } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            )}

            {isStaff && viewMode === "staff" && (
              <div className="space-y-1">
                {!sidebarCollapsed && (
                  <p className="px-3 text-[10px] font-bold uppercase tracking-widest text-white/55 pb-1">
                    Operaciones & Backoffice
                  </p>
                )}
                {staffNavItems.map((item) => {
                  const Icon = item.icon;
                  const active =
                    pathname.startsWith("/dashboard/admin") &&
                    currentTab === item.tabId;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={item.name}
                      className={`flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-medium transition-all ${
                        active
                          ? "bg-brand-red text-brand-white shadow-md shadow-brand-red/25"
                          : "text-white/75 hover:bg-white/5 hover:text-white"
                      } ${sidebarCollapsed ? "justify-center px-0" : ""}`}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!sidebarCollapsed && <span>{item.name}</span>}
                    </Link>
                  );
                })}
              </div>
            )}
          </nav>
        </div>

        {/* ZONA INFERIOR SIEMPRE VISIBLE AL PIE DE LA SIDEBAR */}
        <div
          className={`pt-3.5 border-t border-white/10 space-y-2 shrink-0 ${
            sidebarCollapsed ? "w-12" : "w-60"
          } mx-auto`}
        >
          {isStaff && !sidebarCollapsed && (
            <div className="space-y-2">
              <div
                onClick={handleToggleClientPreviewSwitch}
                role="switch"
                aria-checked={viewMode === "client"}
                aria-label="Modo Vista Cliente"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleToggleClientPreviewSwitch();
                  }
                }}
                className="cursor-pointer flex items-center justify-between rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 px-3.5 py-2 transition-all select-none"
              >
                <div className="flex items-center gap-2.5">
                  <Eye
                    className={`h-4 w-4 ${
                      viewMode === "client" ? "text-brand-red" : "text-white/60"
                    }`}
                  />
                  <div>
                    <p className="text-[11px] font-bold text-white leading-tight">
                      Modo Vista Cliente
                    </p>
                    <p className="text-[9px] text-white/65">
                      {viewMode === "client"
                        ? "Simulación activa"
                        : "Backoffice activo"}
                    </p>
                  </div>
                </div>

                <div
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                    viewMode === "client" ? "bg-brand-red" : "bg-white/20"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      viewMode === "client" ? "translate-x-4" : "translate-x-1"
                    }`}
                  />
                </div>
              </div>

              {viewMode === "client" && previewClients.length > 0 && (
                <div className="rounded-xl bg-brand-red/10 border border-brand-red/30 p-2.5 space-y-1">
                  <label
                    htmlFor="preview-client-select"
                    className="block text-[9px] font-bold uppercase tracking-wider text-brand-red"
                  >
                    Simulando expediente de:
                  </label>
                  <select
                    id="preview-client-select"
                    value={previewClientEmail}
                    onChange={(e) => handleSelectPreviewClient(e.target.value)}
                    className="w-full rounded-lg bg-brand-charcoal border border-white/15 px-2 py-1.5 text-[11px] font-semibold text-white focus:outline-none focus:border-brand-red"
                  >
                    {previewClients.map((c) => (
                      <option key={c.email} value={c.email}>
                        {formatDisplayName(c.fullName)} (
                        {c.destination === "JAPAN" ? "🇯🇵 JP" : "🇺🇸 US"})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <Link
            href="/dashboard/perfil"
            title="Mi Perfil y Configuración"
            className={`group flex items-center justify-between rounded-xl p-2 border transition-all ${
              pathname === "/dashboard/perfil"
                ? "bg-white/15 border-brand-red text-white"
                : "bg-white/5 border-white/10 hover:bg-white/10 text-white"
            } ${sidebarCollapsed ? "justify-center" : ""}`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {profile?.photoURL || profile?.photoUrl || user.photoURL ? (
                <img
                  src={
                    profile?.photoURL ||
                    profile?.photoUrl ||
                    user.photoURL ||
                    ""
                  }
                  alt={formattedUserName}
                  width={36}
                  height={36}
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 shrink-0 rounded-full object-cover border border-white/20"
                />
              ) : (
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-red text-xs font-bold text-white uppercase">
                  {formattedUserName.slice(0, 2)}
                </div>
              )}
              {!sidebarCollapsed && (
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">
                    {formattedUserName}
                  </p>
                  <p className="text-[10px] text-white/65 truncate">
                    Ver mi perfil y ajustes
                  </p>
                </div>
              )}
            </div>
            {!sidebarCollapsed && (
              <UserCircle className="h-4 w-4 text-white/60 group-hover:text-white shrink-0" />
            )}
          </Link>

          {!isStaff && !sidebarCollapsed && (
            <a
              href={getWhatsAppUrl(
                `Hola Global Visa Consulting, soy ${formattedUserName} y necesito asistencia con mi expediente.`
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 text-xs font-semibold text-white transition-all"
            >
              <MessageCircle className="h-3.5 w-3.5 text-brand-red" />
              <span>Soporte WhatsApp</span>
            </a>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Cerrar sesión segura"
            title="Cerrar Sesión Segura"
            className={`flex items-center gap-2.5 w-full rounded-xl px-3 py-2 text-xs font-medium text-red-400 hover:bg-brand-red/15 hover:text-brand-red transition-all ${
              sidebarCollapsed ? "justify-center px-0" : ""
            }`}
          >
            <LogOut className="h-4 w-4 shrink-0" />
            {!sidebarCollapsed && <span>Cerrar Sesión Segura</span>}
          </button>
        </div>
      </aside>

      {/* Header Móvil */}
      <div className="lg:hidden flex items-center justify-between bg-brand-charcoal text-brand-white px-5 py-3.5">
        <Link href="/" className="flex items-center gap-2.5">
          <BrandLogo theme="dark" size="sm" />
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={
            mobileMenuOpen
              ? "Cerrar menú de navegación"
              : "Abrir menú de navegación"
          }
          className="p-2 text-white"
        >
          {mobileMenuOpen ? (
            <X className="h-6 w-6" />
          ) : (
            <Menu className="h-6 w-6" />
          )}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="lg:hidden bg-brand-charcoal text-white px-6 py-4 space-y-2 border-b border-white/10">
          {(isStaff && viewMode === "staff"
            ? staffNavItems
            : clientNavItems
          ).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block rounded-xl px-4 py-2.5 text-xs font-semibold hover:bg-white/10"
            >
              {item.name}
            </Link>
          ))}
          <Link
            href="/dashboard/perfil"
            onClick={() => setMobileMenuOpen(false)}
            className="block rounded-xl px-4 py-2.5 text-xs font-semibold text-brand-red"
          >
            Mi Perfil ({formattedUserName})
          </Link>
        </div>
      )}

      {/* Landmark <main> Único */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 bg-brand-white/95 backdrop-blur-md border-b border-brand-charcoal/10 px-6 lg:px-10 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="truncate">
              <h1 className="font-display text-base sm:text-lg font-bold text-brand-charcoal truncate">
                {isStaff && viewMode === "staff"
                  ? "Centro de Gobernanza & Operaciones — Global Visa Consulting"
                  : `Bienvenido de nuevo, ${formattedUserName}`}
              </h1>
              <p className="text-xs text-brand-charcoal/70 truncate">
                Sesión iniciada como{" "}
                <strong className="uppercase">{profile?.role}</strong> •
                Protección PII Nivel Bancario Activa (Token 8h)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0 relative">
            {isStaff && viewMode === "client" && (
              <button
                type="button"
                onClick={handleToggleClientPreviewSwitch}
                className="inline-flex items-center gap-1.5 rounded-full bg-brand-charcoal px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-red transition-all"
              >
                <ShieldAlert className="h-3.5 w-3.5" />
                <span>Volver a Vista Staff</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setBellOpen((prev) => !prev)}
              aria-label={
                unreadCount > 0
                  ? `Abrir centro de notificaciones (${unreadCount} sin leer)`
                  : "Abrir centro de notificaciones"
              }
              title="Centro de Notificaciones"
              className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-brand-charcoal/10 bg-brand-platinum/50 text-brand-charcoal hover:bg-brand-platinum transition-colors"
            >
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-brand-red text-[10px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </button>

            {bellOpen && (
              <div className="absolute right-0 top-12 w-80 sm:w-96 rounded-2xl bg-brand-white border border-brand-charcoal/15 shadow-xl p-4 z-50 space-y-3">
                <div className="flex items-center justify-between border-b border-brand-platinum pb-2.5">
                  <span className="font-display text-xs font-bold text-brand-charcoal">
                    Notificaciones del Portal ({notifications.length})
                  </span>
                  {unreadCount > 0 && (
                    <button
                      type="button"
                      onClick={handleMarkNotificationsRead}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-red hover:underline"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                      <span>Marcar leídas</span>
                    </button>
                  )}
                </div>

                {notifications.length === 0 ? (
                  <p className="text-xs text-brand-charcoal/65 py-6 text-center">
                    No tienes notificaciones pendientes.
                  </p>
                ) : (
                  <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                    {notifications.slice(0, 12).map((n) => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setBellOpen(false);
                          if (n.link) router.push(n.link);
                        }}
                        className={`cursor-pointer rounded-xl p-3 border text-xs transition-all ${
                          n.read
                            ? "bg-brand-platinum/20 border-brand-platinum text-brand-charcoal/70"
                            : "bg-brand-red/[0.04] border-brand-red/30 text-brand-charcoal"
                        }`}
                      >
                        <p className="font-bold text-brand-charcoal">
                          {n.title}
                        </p>
                        <p className="text-[11px] text-brand-charcoal/75 mt-0.5 leading-relaxed">
                          {n.message}
                        </p>
                        <p className="text-[10px] text-brand-charcoal/55 mt-1">
                          {new Date(n.createdAt).toLocaleString("es-CO")}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="p-6 lg:p-10 max-w-7xl w-full mx-auto flex-1">
          {children}
        </div>
      </main>
    </div>
  );
}

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<DashboardContentSkeleton />}>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </Suspense>
  );
}